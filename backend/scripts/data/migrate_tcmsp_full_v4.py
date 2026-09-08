"""
TCMSP 全量数据迁移脚本 v4 — 批量优化版
========================================
从 tcmsp_data/data/tcmsp_herbs_full.json 导入完整数据到规范化数据库表。
使用批量插入 + upsert 策略，大幅加速迁移。
"""
import asyncio
import json
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent
if not (PROJECT_ROOT / "frontend").exists():
    PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("tcmsp_migrate_v4")

FULL_HERBS_FILE = PROJECT_ROOT / "tcmsp_data" / "data" / "tcmsp_herbs_full.json"
TARGETS_FILE = PROJECT_ROOT / "tcmsp_data" / "TCMSP" / "tcmsp_targets.json"
DISEASES_FILE = PROJECT_ROOT / "tcmsp_data" / "TCMSP" / "tcmsp_diseases.json"


def sf(val, default=None):
    if val is None or val == "":
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def si(val, default=None):
    if val is None or val == "":
        return default
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return default


async def migrate(execute: bool = False, force: bool = False):
    from sqlalchemy import select, func, text, insert
    from app.core.database import Base
    from app.core.database.session import engine, async_session_factory
    from app.models.tcm_schema import (
        TCMCompound, TCMTarget, TCMDisease,
        tcm_herb_compounds,
    )
    from app.models.external_data import TCMHerb

    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    log.info("数据库表结构检查完成")

    # ── 加载数据 ──
    if not FULL_HERBS_FILE.exists():
        log.error(f"数据文件不存在: {FULL_HERBS_FILE}")
        return

    with open(FULL_HERBS_FILE, "r", encoding="utf-8") as f:
        full_data = json.load(f)
    herbs_full = full_data.get("data", [])
    log.info(f"加载药材数据: {len(herbs_full)} 种")

    targets_list = []
    if TARGETS_FILE.exists():
        with open(TARGETS_FILE, "r", encoding="utf-8") as f:
            targets_list = json.load(f)
        if isinstance(targets_list, dict) and "results" in targets_list:
            targets_list = targets_list["results"]
        log.info(f"加载靶点数据: {len(targets_list)} 条")

    diseases_list = []
    if DISEASES_FILE.exists():
        with open(DISEASES_FILE, "r", encoding="utf-8") as f:
            diseases_list = json.load(f)
        if isinstance(diseases_list, dict) and "results" in diseases_list:
            diseases_list = diseases_list["results"]
        log.info(f"加载疾病数据: {len(diseases_list)} 条")

    stats = {
        "compounds_upserted": 0, "targets_upserted": 0, "diseases_upserted": 0,
        "herb_compound_links": 0, "herbs_updated": 0,
    }

    # 收集所有化合物数据
    all_compounds: dict[str, dict] = {}
    herb_compound_map: dict[str, list[dict]] = {}  # herb_latin -> [compound data]
    for herb in herbs_full:
        latin = (herb.get("name_latin") or "").strip()
        if not latin:
            continue
        comps = herb.get("compounds", [])
        herb_compound_map[latin] = comps
        for c in comps:
            mol_id = c.get("MOL_ID", "")
            if mol_id and mol_id not in all_compounds:
                all_compounds[mol_id] = c

    log.info(f"提取化合物总数（去重）: {len(all_compounds)}")

    async with async_session_factory() as session:
        # ── 1. Upsert Compounds（批量）──
        log.info("开始迁移化合物...")
        existing_mols: dict[str, int] = {}
        if not force:
            rows = (await session.execute(
                select(TCMCompound.tcmsp_compound_id, TCMCompound.id)
            )).all()
            for mol_id, cid in rows:
                if mol_id:
                    existing_mols[mol_id] = cid

        compound_rows = []
        now = datetime.now(timezone.utc)
        for mol_id, cdata in all_compounds.items():
            name = ((cdata.get("molecule_name") or "").strip())[:190]
            if not name:
                continue
            compound_rows.append({
                "name": name,
                "molecular_weight": sf(cdata.get("mw")),
                "ob_percent": sf(cdata.get("ob")),
                "dl_value": sf(cdata.get("dl")),
                "logp": sf(cdata.get("alogp")),
                "hbd": si(cdata.get("hdon")),
                "hba": si(cdata.get("hacc")),
                "tpsa": sf(cdata.get("tpsa")),
                "tcmsp_compound_id": mol_id,
                "source": "tcmsp_full_scrape",
                "created_at": now,
                "updated_at": now,
            })

        # 批量 upsert
        if force:
            # 先删除再插入（强制重建）
            await session.execute(text("DELETE FROM tcm_herb_compounds"))
            await session.execute(text("DELETE FROM tcm_compounds"))
            log.info("强制模式: 清空化合物及相关关联表")

        from sqlalchemy.dialects.postgresql import insert as pg_insert
        stmt = pg_insert(TCMCompound).on_conflict_do_update(
            index_elements=["tcmsp_compound_id"],
            set_=dict(updated_at=datetime.now(timezone.utc)),
        )
        await session.execute(stmt, compound_rows)
        stats["compounds_upserted"] = len(compound_rows)
        log.info(f"化合物迁移完成: {stats['compounds_upserted']} 条")

        # 重新获取 compound ID map
        result = await session.execute(select(TCMCompound.tcmsp_compound_id, TCMCompound.id))
        compound_id_map = {row[0]: row[1] for row in result.all() if row[0]}
        log.info(f"化合物 ID 映射: {len(compound_id_map)} 条")

        # ── 2. Upsert Targets（先查后插，避免无唯一约束）──
        log.info("开始迁移靶点...")
        existing_target_names: set[str] = set()
        if not force:
            result = await session.execute(select(TCMTarget.name))
            existing_target_names = {row[0] for row in result.all()}

        target_insert_rows = []
        for t in targets_list:
            tname = ((t.get("target_name") or "").strip())[:190]
            if not tname or (not force and tname in existing_target_names):
                continue
            target_insert_rows.append({
                "name": tname,
                "gene_symbol": (t.get("drugbank_ID") or "").strip() or None,
                "organism": "Homo sapiens",
                "source": "tcmsp_scrape",
            })

        if target_insert_rows:
            await session.execute(insert(TCMTarget), target_insert_rows)
        stats["targets_upserted"] = len(target_insert_rows)
        log.info(f"靶点迁移完成: {stats['targets_upserted']} 条")

        # ── 3. Upsert Diseases（先查后插）──
        log.info("开始迁移疾病...")
        existing_dis_names: set[str] = set()
        if not force:
            result = await session.execute(select(TCMDisease.name))
            existing_dis_names = {row[0] for row in result.all()}

        disease_insert_rows = []
        for d in diseases_list:
            dname = ((d.get("disease_name") or "").strip())[:200]
            if not dname or (not force and dname in existing_dis_names):
                continue
            mesh = ((d.get("DIS_ID") or "").strip()) or None
            # mesh_id 为空的记录不设为 UNIQUE，避免重复插入
            disease_insert_rows.append({
                "name": dname,
                "mesh_id": mesh,
                "source": "tcmsp_scrape",
            })

        if disease_insert_rows:
            try:
                await session.execute(insert(TCMDisease), disease_insert_rows)
            except Exception as e:
                log.warning(f"疾病插入警告: {e}")
                # 逐条插入以跳过 mesh_id 重复
                for row in disease_insert_rows:
                    try:
                        await session.execute(insert(TCMDisease), [row])
                    except Exception:
                        pass
        stats["diseases_upserted"] = len(disease_insert_rows)
        log.info(f"疾病迁移完成: {stats['diseases_upserted']} 条")

        # ── 4. 关联药材-化合物 ──
        log.info("开始构建药材-化合物关联...")

        # 获取药材 ID 映射
        herb_result = await session.execute(select(TCMHerb.id, TCMHerb.name_latin, TCMHerb.name_cn))
        herb_rows = herb_result.all()
        herb_by_latin: dict[str, int] = {}
        herb_by_cn: dict[str, int] = {}
        for hid, latin, cn in herb_rows:
            if latin:
                herb_by_latin[latin] = hid
            if cn:
                herb_by_cn[cn] = hid

        # 获取化合物 ID 映射
        result = await session.execute(select(TCMCompound.tcmsp_compound_id, TCMCompound.id))
        comp_map = {row[0]: row[1] for row in result.all() if row[0]}

        # 批量插入 herb-compound 关联
        link_rows = []
        for herb_latin, comps in herb_compound_map.items():
            herb_id = herb_by_latin.get(herb_latin)
            if not herb_id:
                # 尝试用中文名匹配
                herb_id = None
                for h in herbs_full:
                    if h.get("name_latin") == herb_latin:
                        cn_name = h.get("name_cn", "")
                        herb_id = herb_by_cn.get(cn_name)
                        break
            if not herb_id:
                continue

            for c in comps:
                mol_id = c.get("MOL_ID", "")
                comp_id = comp_map.get(mol_id)
                if comp_id:
                    link_rows.append({"herb_id": herb_id, "compound_id": comp_id})

        # 去重：检查是否已存在
        existing_links: set[tuple[int, int]] = set()
        if not force:
            link_result = await session.execute(
                text("SELECT herb_id, compound_id FROM tcm_herb_compounds")
            )
            existing_links = {(row[0], row[1]) for row in link_result.all()}

        unique_links = []
        for lr in link_rows:
            key = (lr["herb_id"], lr["compound_id"])
            if key not in existing_links:
                unique_links.append(lr)

        if unique_links:
            stmt_link = insert(tcm_herb_compounds)
            await session.execute(stmt_link, unique_links)
            stats["herb_compound_links"] = len(unique_links)
            log.info(f"药材-化合物关联: {stats['herb_compound_links']} 条")

        # 更新 herbs 表中的 compounds JSON
        log.info("更新药材 compounds JSON...")
        for herb_latin, comps in herb_compound_map.items():
            herb_id = herb_by_latin.get(herb_latin)
            if not herb_id:
                continue
            enriched = []
            for c in comps[:50]:
                enriched.append({
                    "name": ((c.get("molecule_name") or "").strip())[:100],
                    "mol_id": c.get("MOL_ID"),
                    "ob": sf(c.get("ob")),
                    "dl": sf(c.get("dl")),
                    "mw": sf(c.get("mw")),
                })
            await session.execute(
                text("UPDATE tcm_herbs SET compounds = :data WHERE id = :id"),
                {"data": json.dumps(enriched, ensure_ascii=False), "id": herb_id},
            )
            stats["herbs_updated"] += 1

        if execute:
            await session.commit()
            log.info("事务已提交")
        else:
            await session.rollback()
            log.info("干跑模式 - 已回滚")

    print("\n" + "=" * 60)
    print("  TCMSP 全量数据迁移报告 v4")
    print("=" * 60)
    print(f"  化合物 upsert:   {stats['compounds_upserted']}")
    print(f"  靶点 upsert:     {stats['targets_upserted']}")
    print(f"  疾病 upsert:     {stats['diseases_upserted']}")
    print(f"  herb-compound 关联: {stats['herb_compound_links']}")
    print(f"  药材 JSON 更新:  {stats['herbs_updated']} 条")
    print("=" * 60)
    return stats


async def main():
    import argparse
    p = argparse.ArgumentParser(description="TCMSP 全量数据迁移 v4")
    p.add_argument("--execute", action="store_true", help="执行写入")
    p.add_argument("--force", action="store_true", help="强制重建")
    args = p.parse_args()
    await migrate(execute=args.execute, force=args.force)


if __name__ == "__main__":
    asyncio.run(main())
