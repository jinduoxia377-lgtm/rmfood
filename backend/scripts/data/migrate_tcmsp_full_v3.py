"""
TCMSP 全量数据迁移脚本 v3 — 从 tcmsp_herbs_full.json 导入
=========================================================
数据源: tcmsp_data/data/tcmsp_herbs_full.json (498种药材，含完整化合物列表)
       tcmsp_data/TCMSP/tcmsp_targets.json (3,339靶点)
       tcmsp_data/TCMSP/tcmsp_diseases.json (867疾病)

迁移内容:
  1) tcm_compounds — 从 herbs_full 提取所有化合物 (去重)
  2) tcm_targets   — 从 tcmsp_targets.json 导入
  3) tcm_diseases  — 从 tcmsp_diseases.json 导入
  4) tcm_herb_compounds — 药材-化合物关联
  5) tcm_herbs    — 更新 compounds JSON、tcmsp_id、category 等
"""
import asyncio
import json
import logging
import sys
from pathlib import Path
from typing import Any

_SCRIPT_PATH = Path(__file__).resolve()
_PROJECT_CANDIDATE = _SCRIPT_PATH.parent.parent.parent.parent
if (_PROJECT_CANDIDATE / "frontend").exists():
    PROJECT_ROOT = _PROJECT_CANDIDATE
else:
    PROJECT_ROOT = _SCRIPT_PATH.parent.parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("tcmsp_migrate_v3")

FULL_HERBS_FILE = PROJECT_ROOT / "tcmsp_data" / "data" / "tcmsp_herbs_full.json"
TARGETS_FILE = PROJECT_ROOT / "tcmsp_data" / "TCMSP" / "tcmsp_targets.json"
DISEASES_FILE = PROJECT_ROOT / "tcmsp_data" / "TCMSP" / "tcmsp_diseases.json"
HERBS_FILE = PROJECT_ROOT / "tcmsp_data" / "TCMSP" / "tcmsp_herbs.json"


def safe_float(val, default=None):
    if val is None or val == "":
        return default
    try:
        return float(val)
    except (ValueError, TypeError):
        return default


def safe_int(val, default=None):
    if val is None or val == "":
        return default
    try:
        return int(float(val))
    except (ValueError, TypeError):
        return default


async def migrate(execute: bool = False, force: bool = False):
    from sqlalchemy import select, func, text
    from app.core.database import Base
    from app.core.database.session import engine, async_session_factory
    from app.models.tcm_schema import (
        TCMCompound, TCMDisease, TCMTarget,
        tcm_herb_compounds, tcm_compound_targets, tcm_target_diseases,
    )
    from app.models.external_data import TCMHerb

    # ── Phase 0: 建表 ──
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    log.info("数据库表结构检查完成")

    # ── Phase 1: 加载数据 ──
    if not FULL_HERBS_FILE.exists():
        log.error(f"主数据文件不存在: {FULL_HERBS_FILE}")
        return

    with open(FULL_HERBS_FILE, "r", encoding="utf-8") as f:
        full_data = json.load(f)
    herbs_full = full_data.get("data", [])
    log.info(f"加载药材数据: {len(herbs_full)} 种")

    # 加载靶点
    targets_list = []
    if TARGETS_FILE.exists():
        with open(TARGETS_FILE, "r", encoding="utf-8") as f:
            targets_list = json.load(f)
        if isinstance(targets_list, dict) and "results" in targets_list:
            targets_list = targets_list["results"]
        log.info(f"加载靶点数据: {len(targets_list)} 条")

    # 加载疾病
    diseases_list = []
    if DISEASES_FILE.exists():
        with open(DISEASES_FILE, "r", encoding="utf-8") as f:
            diseases_list = json.load(f)
        if isinstance(diseases_list, dict) and "results" in diseases_list:
            diseases_list = diseases_list["results"]
        log.info(f"加载疾病数据: {len(diseases_list)} 条")

    # 加载 herbs 基础信息（用于匹配中文名称）
    herbs_basic = []
    if HERBS_FILE.exists():
        with open(HERBS_FILE, "r", encoding="utf-8") as f:
            herbs_basic = json.load(f)
        log.info(f"加载基础药材数据: {len(herbs_basic)} 条")

    # ── Phase 2: 提取所有化合物（去重）──
    all_compounds: dict[str, dict] = {}  # MOL_ID -> compound data
    for herb in herbs_full:
        for comp in herb.get("compounds", []):
            mol_id = comp.get("MOL_ID", "")
            if mol_id and mol_id not in all_compounds:
                all_compounds[mol_id] = comp

    log.info(f"提取化合物总数（去重）: {len(all_compounds)}")

    # ── Phase 3: 执行迁移 ──
    stats = {
        "compounds_inserted": 0,
        "compounds_updated": 0,
        "targets_inserted": 0,
        "targets_updated": 0,
        "diseases_inserted": 0,
        "diseases_updated": 0,
        "herb_compound_links": 0,
        "herbs_updated": 0,
        "errors": [],
    }

    async with async_session_factory() as session:
        # ── 3a: Upsert Compounds ──
        log.info("开始迁移化合物...")
        existing_mol_ids: dict[str, int] = {}
        if not force:
            result = await session.execute(
                select(TCMCompound.tcmsp_compound_id, TCMCompound.id)
            )
            for row in result.all():
                if row[0]:
                    existing_mol_ids[row[0]] = row[1]

        compound_id_map: dict[str, int] = {}  # MOL_ID -> DB id
        for mol_id, comp_data in all_compounds.items():
            parsed_name = (comp_data.get("molecule_name") or "").strip()
            if not parsed_name:
                continue
            # 截断过长名称以适配 VARCHAR(200)
            if len(parsed_name) > 190:
                parsed_name = parsed_name[:187] + "..."

            ob_val = safe_float(comp_data.get("ob"))
            dl_val = safe_float(comp_data.get("dl"))

            # Clamp OB to valid range
            if ob_val is not None and ob_val > 100:
                # Some compounds have sum-of-OB > 100, keep as-is but note it
                pass

            if mol_id in existing_mol_ids and not force:
                comp_id = existing_mol_ids[mol_id]
                compound_id_map[mol_id] = comp_id
                stats["compounds_inserted"] += 1
                continue

            if mol_id in existing_mol_ids and force:
                comp_id = existing_mol_ids[mol_id]
                stats["compounds_updated"] += 1
            else:
                comp = TCMCompound(
                    name=parsed_name,
                    molecular_weight=safe_float(comp_data.get("mw")),
                    ob_percent=ob_val,
                    dl_value=dl_val,
                    logp=safe_float(comp_data.get("alogp")),
                    hbd=safe_int(comp_data.get("hdon")),
                    hba=safe_int(comp_data.get("hacc")),
                    tpsa=safe_float(comp_data.get("tpsa")),
                    tcmsp_compound_id=mol_id,
                    source="tcmsp_full_scrape",
                )
                session.add(comp)
                await session.flush()
                comp_id = comp.id
                stats["compounds_inserted"] += 1

            compound_id_map[mol_id] = comp_id

        # 提交化合物
        if execute:
            await session.commit()
            log.info(f"化合物迁移完成: 新增 {stats['compounds_inserted']}, 更新 {stats['compounds_updated']}")
        else:
            await session.rollback()

        # ── 3b: Upsert Targets ──
        log.info("开始迁移靶点...")
        existing_targets: dict[str, int] = {}
        if not force:
            result = await session.execute(
                select(TCMTarget.id, TCMTarget.name)
            )
            for row in result.all():
                existing_targets[row[1]] = row[0]

        target_id_map: dict[str, int] = {}  # TAR_ID -> DB id (for later linking)
        for tar in targets_list:
            tar_name = (tar.get("target_name") or "").strip()
            if not tar_name:
                continue
            tar_id = tar.get("TAR_ID", "")
            drugbank_id = tar.get("drugbank_ID", "") or None
            kegg_id = tar.get("kegg", "") or None

            if tar_name in existing_targets and not force:
                target_id_map[tar_id] = existing_targets[tar_name]
                stats["targets_inserted"] += 1
                continue

            if tar_name in existing_targets and force:
                target_id_map[tar_id] = existing_targets[tar_name]
                stats["targets_updated"] += 1
            else:
                target = TCMTarget(
                    name=tar_name,
                    gene_symbol=drugbank_id,
                    organism="Homo sapiens",
                    source="tcmsp_scrape",
                )
                session.add(target)
                await session.flush()
                target_id_map[tar_id] = target.id
                stats["targets_inserted"] += 1

        if execute:
            await session.commit()
            log.info(f"靶点迁移完成: 新增 {stats['targets_inserted']}, 更新 {stats['targets_updated']}")
        else:
            await session.rollback()

        # ── 3c: Upsert Diseases ──
        log.info("开始迁移疾病...")
        existing_diseases: dict[str, int] = {}
        if not force:
            result = await session.execute(
                select(TCMDisease.id, TCMDisease.name)
            )
            for row in result.all():
                existing_diseases[row[1]] = row[0]

        for dis in diseases_list:
            dis_name = (dis.get("disease_name") or "").strip()
            if not dis_name:
                continue
            dis_id = dis.get("DIS_ID", "")

            if dis_name in existing_diseases and not force:
                stats["diseases_inserted"] += 1
                continue

            if dis_name in existing_diseases and force:
                stats["diseases_updated"] += 1
            else:
                disease = TCMDisease(
                    name=dis_name,
                    mesh_id=dis_id,
                    source="tcmsp_scrape",
                )
                session.add(disease)
                await session.flush()
                stats["diseases_inserted"] += 1

        if execute:
            await session.commit()
            log.info(f"疾病迁移完成: 新增 {stats['diseases_inserted']}, 更新 {stats['diseases_updated']}")
        else:
            await session.rollback()

        # ── 3d: 关联药材-化合物 & 更新 herbs 表 ──
        log.info("开始构建药材-化合物关联...")

        # 建立药材名称索引
        result = await session.execute(select(TCMHerb.id, TCMHerb.name_cn, TCMHerb.name_latin))
        herb_rows = result.all()
        herb_by_name: dict[str, int] = {}
        herb_by_latin: dict[str, int] = {}
        for herb_id, name_cn, name_latin in herb_rows:
            if name_cn:
                herb_by_name[name_cn] = herb_id
            if name_latin:
                herb_by_latin[name_latin] = herb_id

        log.info(f"药材索引: name_cn={len(herb_by_name)}, name_latin={len(herb_by_latin)}")

        for herb_full in herbs_full:
            name_cn = (herb_full.get("name_cn") or "").strip()
            name_latin = (herb_full.get("name_latin") or "").strip()
            category = (herb_full.get("category_cn") or "").strip()
            ob_val = safe_float(herb_full.get("ob_percent"))
            dl_val = safe_float(herb_full.get("dl_value"))
            compounds_raw = herb_full.get("compounds", [])

            # 查找 herb_id
            herb_id = herb_by_name.get(name_cn) or herb_by_latin.get(name_latin)
            if not herb_id:
                # 尝试通过 basic herbs 匹配
                for hb in herbs_basic:
                    hb_cn = hb.get("herb_cn_name", "")
                    hb_en = hb.get("herb_en_name", "")
                    if (name_cn and hb_cn and name_cn == hb_cn) or \
                       (name_latin and hb_en and name_latin == hb_en):
                        herb_id = herb_by_name.get(hb_cn)
                        break
                if not herb_id:
                    stats["errors"].append(f"未找到药材: {name_cn} / {name_latin}")
                    continue

            # 更新药材 JSON 字段
            enriched_compounds = []
            for comp in compounds_raw[:50]:  # 限制每个药材最多50个化合物在JSON中
                enriched_compounds.append({
                    "name": (comp.get("molecule_name") or "").strip(),
                    "mol_id": comp.get("MOL_ID"),
                    "ob": safe_float(comp.get("ob")),
                    "dl": safe_float(comp.get("dl")),
                    "mw": safe_float(comp.get("mw")),
                    "alogp": safe_float(comp.get("alogp")),
                })

            # 清除错误记录的化合物
            if herb_full.get("error"):
                enriched_compounds = []

            # 获取该药材的化合物 ID 列表
            compound_ids = []
            for comp in compounds_raw:
                mol_id = comp.get("MOL_ID", "")
                if mol_id and mol_id in compound_id_map:
                    compound_ids.append(compound_id_map[mol_id])

            if execute:
                herb_obj = await session.get(TCMHerb, herb_id)
                if herb_obj:
                    herb_obj.compounds = enriched_compounds
                    herb_obj.category = category or herb_obj.category
                    if ob_val is not None:
                        herb_obj.ob_percent = min(ob_val, 100.0) if ob_val <= 100 else herb_obj.ob_percent
                    if dl_val is not None:
                        herb_obj.dl_value = dl_val
                    herb_obj.source_version = "tcmsp_full_v3"
                    herb_obj.synced_at = asyncio.get_event_loop().run_in_executor(
                        None, lambda: __import__('datetime').datetime.utcnow()
                    ) if execute else None
                    stats["herbs_updated"] += 1

                    # 插入 herb-compound 关联
                    for cid in compound_ids:
                        exists = await session.execute(
                            select(func.count())
                            .select_from(tcm_herb_compounds)
                            .where(
                                tcm_herb_compounds.c.herb_id == herb_id,
                                tcm_herb_compounds.c.compound_id == cid,
                            )
                        )
                        if exists.scalar() == 0:
                            await session.execute(
                                tcm_herb_compounds.insert().values(
                                    herb_id=herb_id, compound_id=cid
                                )
                            )
                            stats["herb_compound_links"] += 1

        if execute:
            await session.commit()
            log.info(f"药材更新完成: {stats['herbs_updated']} 条, 化合物关联 {stats['herb_compound_links']} 条")
        else:
            await session.rollback()

    # ── 报告 ──
    print("\n" + "=" * 60)
    print("  TCMSP 全量数据迁移报告 v3")
    print("=" * 60)
    print(f"  化合物导入:     {stats['compounds_inserted']} 新增")
    print(f"  化合物更新:     {stats['compounds_updated']} 条")
    print(f"  靶点导入:       {stats['targets_inserted']} 条")
    print(f"  疾病导入:       {stats['diseases_inserted']} 条")
    print(f"  药材更新:       {stats['herbs_updated']} 条")
    print(f"   herb-compound 关联: {stats['herb_compound_links']} 条")
    if stats["errors"]:
        print(f"  错误: {len(stats['errors'])} 条")
        for e in stats["errors"][:5]:
            print(f"    - {e}")
    print("=" * 60)
    return stats


async def main():
    import argparse
    parser = argparse.ArgumentParser(description="TCMSP 全量数据迁移 v3")
    parser.add_argument("--execute", action="store_true", help="执行实际写入")
    parser.add_argument("--force", action="store_true", help="强制更新已有记录")
    args = parser.parse_args()
    await migrate(execute=args.execute, force=args.force)


if __name__ == "__main__":
    asyncio.run(main())
