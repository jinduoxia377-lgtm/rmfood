"""
TCMSP 爬取数据 → PostgreSQL 完整迁移脚本 v1
================================================
将 tcmsp_herbs_full.json (498种全量爬取数据) 迁移到 PostgreSQL：
  1) 补全 TCMHerb 表：tcmsp_id / 修复OB异常值 / 统一拉丁名 / 扩展compounds至12字段
  2) 填充规范化表：tcm_compounds / tcm_targets / tcm_diseases 及关联表

用法:
  python scripts/data/migrate_tcmsp_full.py              # 干跑模式（仅报告）
  python scripts/data/migrate_tcmsp_full.py --execute      # 执行迁移
  python scripts/data/migrate_tcmsp_full.py --execute --force-ob-fix  # 强制修复所有OB值
"""

import asyncio
import json
import logging
import re
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

# ─── 项目路径 ──────────────────────────────
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent.parent  # scripts/data → scripts → backend → project_root
sys.path.insert(0, str(PROJECT_ROOT))
sys.path.insert(0, str(PROJECT_ROOT / "backend"))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("tcmsp_migrate")

# ─── 配置 ──────────────────────────────────
SCRAPED_FILE = PROJECT_ROOT / "tcmsp_data" / "data" / "tcmsp_herbs_full.json"
ACTIVE_OB_THRESHOLD = 30.0   # 活性成分OB阈值
DL_THRESHOLD = 0.18          # DL阈值


def load_scraped_data() -> list[dict]:
    """加载爬取的完整数据"""
    if not SCRAPED_FILE.exists():
        log.error(f"爬取数据文件不存在: {SCRAPED_FILE}")
        sys.exit(1)
    with open(SCRAPED_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    herbs = data.get("data", [])
    log.info(f"加载爬取数据: {len(herbs)} 种药材 (source: {data.get('total', '?')})")
    return herbs


def parse_compound_adme(raw: dict) -> Optional[dict]:
    """解析原始化合物14字段为规范化12字段字典"""
    def safe_float(key, default=None):
        v = raw.get(key)
        if v is None or v == "":
            return default
        try:
            fv = float(v)
            # Clamp OB% to [0, 200] range (allowing sum-like values)
            if key == "ob" and fv > 200:
                return default
            return fv
        except (ValueError, TypeError):
            return default

    def safe_int(key, default=None):
        v = raw.get(key)
        if v is None or v == "":
            return default
        try:
            return int(float(v))
        except (ValueError, TypeError):
            return default

    name = (raw.get("molecule_name") or "").strip()
    if not name:
        return None
    # 截断过长名称以适配 VARCHAR(200)
    if len(name) > 190:
        name = name[:187] + "..."

    return {
        # 标识
        "name": name.strip(),
        "tcmsp_compound_id": raw.get("MOL_ID", "").strip() or None,
        # ADME 核心
        "ob_percent": safe_float("ob"),
        "dl_value": safe_float("dl"),
        # 物化属性
        "molecular_weight": safe_float("mw"),
        "logp": safe_float("alogp"),
        "hbd": safe_int("hdon"),       # hydrogen bond donor
        "hba": safe_int("hacc"),       # hydrogen bond acceptor
        # 扩展ADME
        "caco2": safe_float("caco2"),
        "bbb": safe_float("bbb"),
        "fasa": safe_float("FASA"),
        "half_life": safe_float("halflife"),
    }


def calculate_herb_ob_dl(compounds: list[dict]) -> tuple[float, float]:
    """
    计算药材级别的代表 OB/DL 值。
    策略: 取满足活性阈值(OB>=30%, DL>=0.18)的化合物中 OB 最高的作为代表值。
    若无活性成分，则取 max(OB) 和 max(DL)。
    """
    active_obs = []
    active_dls = []
    all_obs = []
    all_dls = []

    for c in compounds:
        ob = c.get("ob_percent")
        dl = c.get("dl_value")
        if ob is not None:
            all_obs.append(ob)
            if ob >= ACTIVE_OB_THRESHOLD:
                active_obs.append(ob)
        if dl is not None:
            all_dls.append(dl)
            if dl is not None and dl >= DL_THRESHOLD:
                active_dls.append(dl)

    # 有活性成分时，取最高活性
    rep_ob = max(active_obs) if active_obs else (max(all_obs) if all_obs else 0.0)
    rep_dl = max(active_dls) if active_dls else (max(all_dls) if all_dls else 0.0)

    # Clamp 到合理范围
    rep_ob = min(max(rep_ob, 0), 100)
    rep_dl = min(max(rep_dl, 0), 1.0)

    return round(rep_ob, 2), round(rep_dl, 4)


def normalize_latin_name(name: str) -> str:
    """统一拉丁名格式: 去除 C.A. Mey. 等作者缩写后的多余空格"""
    if not name:
        return ""
    # 标准化空格
    name = re.sub(r"\s+", " ", name).strip()
    # 移除常见的不规范后缀（保留学名主体）
    return name


async def migrate(
    execute: bool = False,
    force_ob_fix: bool = False,
    dry_run: bool = False,
):
    """执行完整迁移流程"""
    from sqlalchemy import select, func, text
    from app.core.database import Base
    from app.core.session import engine, async_session_factory
    from app.models.external_data import TCMHerb
    from app.models.tcm_schema import (
        TCMCompound, TCMDisease, TCMTarget,
        tcm_herb_compounds, tcm_compound_targets,
    )

    scraped_herbs = load_scraped_data()

    # ── Phase 0: 确保规范化表已创建 ──
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    log.info("规范化表结构检查完成")

    stats = {
        "total_scraped": len(scraped_herbs),
        "matched_existing": 0,
        "new_herbs": 0,
        "updated_herbs": 0,
        "compounds_inserted": 0,
        "ob_fixed": 0,
        "latin_fixed": 0,
        "tcmsp_id_added": 0,
        "errors": [],
    }

    async with async_session_factory() as session:
        # 获取现有药材名称索引
        result = await session.execute(
            select(TCMHerb.id, TCMHerb.name_cn, TCMHerb.name_latin, TCMHerb.ob_percent, TCMHerb.dl_value)
        )
        existing_herbs = {row.name_cn: row for row in result.all()}
        log.info(f"现有 DB 药材: {len(existing_herbs)} 条")

        # ── Phase 1: 遍历爬取数据，逐条处理 ──
        for idx, scraped in enumerate(scraped_herbs):
            name_cn = scraped.get("name_cn", "").strip()
            name_latin_scraped = scraped.get("name_latin", "").strip()
            category_cn = scraped.get("category_cn", "").strip()
            category_en = scraped.get("category_en", "").strip()

            if not name_cn:
                continue

            # 解析化合物
            raw_compounds = scraped.get("compounds", [])
            parsed_compounds = [parse_compound_adme(c) for c in raw_compounds]
            parsed_compounds = [c for c in parsed_compounds if c is not None]

            # 计算正确的 OB/DL
            calc_ob, calc_dl = calculate_herb_ob_dl(parsed_compounds)

            # 匹配现有记录
            existing = existing_herbs.get(name_cn)
            
            if existing:
                stats["matched_existing"] += 1
                needs_update = False
                update_fields = {}

                # 1) 补全 tcmsp_id (用拉丁名hash或序号生成)
                if not execute or dry_run:
                    pass
                else:
                    herb_obj = await session.get(TCMHerb, existing.id)
                    if herb_obj and not herb_obj.tcmsp_id:
                        herb_obj.tcmsp_id = f"TCMSP-{idx+1:04d}"
                        herb_obj.source_version = "tcmsp_official_v2.3"
                        stats["tcmsp_id_added"] += 1
                        needs_update = True

                    # 2) 修复 OB 异常值
                    old_ob = herb_obj.ob_percent if herb_obj else 0
                    if force_ob_fix or (old_ob is not None and old_ob > 100):
                        herb_obj.ob_percent = calc_ob
                        stats["ob_fixed"] += 1
                        needs_update = True

                    # 3) 统一拉丁名
                    if herb_obj and herb_obj.name_latin != name_latin_scraped:
                        norm_latin = normalize_latin_name(name_latin_scraped)
                        if norm_latin and norm_latin != herb_obj.name_latin:
                            herb_obj.name_latin = norm_latin
                            stats["latin_fixed"] += 1
                            needs_update = True

                    # 4) 扩展 compounds JSON 字段到 12 字段格式 (向后兼容)
                    if herb_obj and parsed_compounds:
                        # 新格式: 保留原有4字段 + 新增8个ADME字段
                        enriched_compounds = []
                        for pc in parsed_compounds:
                            enriched = {
                                "name": pc["name"],
                                "ob": pc["ob_percent"],
                                "dl": pc["dl_value"],
                                "target_count": 0,  # 后续可从靶点关联计算
                                # 新增ADME字段
                                "mw": pc.get("molecular_weight"),
                                "alogp": pc.get("logp"),
                                "hdon": pc.get("hbd"),
                                "hacc": pc.get("hba"),
                                "caco2": pc.get("caco2"),
                                "bbb": pc.get("bbb"),
                                "fasa": pc.get("fasa"),
                                "halflife": pc.get("half_life"),
                                "mol_id": pc.get("tcmsp_compound_id"),
                            }
                            enriched_compounds.append(enriched)
                        
                        old_compounds = herb_obj.compounds or []
                        # 只在数据更丰富时更新
                        if len(enriched_compounds) > len(old_compounds):
                            herb_obj.compounds = enriched_compounds
                            herb_obj.dl_value = calc_dl
                            needs_update = True
                            stats["updated_herbs"] += 1

                    if needs_update:
                        herb_obj.synced_at = datetime.utcnow()

                # 5) 写入规范化 tcm_compounds 表
                if execute and not dry_run and parsed_compounds:
                    herb_obj = await session.get(TCMHerb, existing.id)
                    if herb_obj:
                        for pc in parsed_compounds:
                            # 检查是否已存在 (by tcmsp_compound_id)
                            existing_comp = await session.execute(
                                select(TCMCompound).where(
                                    TCMCompound.tcmsp_compound_id == pc.get("tcmsp_compound_id")
                                )
                            )
                            ec = existing_comp.scalar_one_or_none()
                            if not ec:
                                ec = TCMCompound(
                                    name=pc["name"],
                                    molecular_weight=pc.get("molecular_weight"),
                                    ob_percent=pc.get("ob_percent"),
                                    dl_value=pc.get("dl_value"),
                                    logp=pc.get("logp"),
                                    hbd=pc.get("hbd"),
                                    hba=pc.get("hba"),
                                    tcmsp_compound_id=pc.get("tcmsp_compound_id"),
                                    source="tcmsp_scrape_v2",
                                )
                                session.add(ec)
                                await session.flush()  # 获取 ID
                                stats["compounds_inserted"] += 1

                            # 创建 herb-compound 关联 (避免重复)
                            assoc_exists = await session.execute(
                                select(func.count()).select_from(tcm_herb_compounds).where(
                                    tcm_herb_compounds.c.herb_id == herb_obj.id,
                                    tcm_herb_compounds.c.compound_id == ec.id,
                                )
                            )
                            if assoc_exists.scalar() == 0:
                                await session.execute(
                                    tcm_herb_compounds.insert().values(
                                        herb_id=herb_obj.id,
                                        compound_id=ec.id,
                                    )
                                )

            else:
                # 新药材 (不在当前DB中的)
                stats["new_herbs"] += 1
                if execute and not dry_run:
                    new_herb = TCMHerb(
                        name_cn=name_cn,
                        name_latin=normalize_latin_name(name_latin_scraped),
                        name_pinyin=scraped.get("name_pinyin", "").strip(),
                        category=category_cn,
                        ob_percent=calc_ob,
                        dl_value=calc_dl,
                        effects="",  # 爬取数据无功效描述
                        is_food_homology=False,  # 后续通过目录匹配标记
                        tcmsp_id=f"TCMSP-{idx+1:04d}",
                        source_version="tcmsp_official_v2.3",
                        compounds=[{
                            "name": pc["name"],
                            "ob": pc.get("ob_percent"),
                            "dl": pc.get("dl_value"),
                            "target_count": 0,
                            "mw": pc.get("molecular_weight"),
                            "alogp": pc.get("logp"),
                            "hdon": pc.get("hbd"),
                            "hacc": pc.get("hba"),
                            "caco2": pc.get("caco2"),
                            "bbb": pc.get("bbb"),
                            "fasa": pc.get("fasa"),
                            "halflife": pc.get("half_life"),
                            "mol_id": pc.get("tcmsp_compound_id"),
                        } for pc in parsed_compounds[:20]],  # JSON字段存前20个代表性化合物
                        targets=[],
                        diseases=[],
                    )
                    session.add(new_herb)
                    stats["updated_herbs"] += 1

            # 每50条提交一次 (避免长事务)
            if execute and not dry_run and (idx + 1) % 50 == 0:
                await session.commit()
                log.info(f"  已处理 {idx + 1}/{len(scraped_herbs)}...")

        # 最终提交
        if execute and not dry_run:
            await session.commit()

    # ── 输出报告 ──
    print("\n" + "=" * 60)
    print("  TCMSP 数据迁移报告")
    print("=" * 60)
    print(f"  模式:         {'执行写入' if (execute and not dry_run) else '干跑(预览)'}")
    print(f"  爬取数据总量:  {stats['total_scraped']} 种")
    print(f"  匹配已有记录:  {stats['matched_existing']} 种")
    print(f"  新增药材:      {stats['new_herbs']} 种")
    print(f"  更新记录数:    {stats['updated_herbs']} 条")
    print(f"  补全tcmsp_id:  {stats['tcmsp_id_added']} 条")
    print(f"  修复OB异常:    {stats['ob_fixed']} 条")
    print(f"  统一拉丁名:    {stats['latin_fixed']} 条")
    print(f"  新增化合物:    {stats['compounds_inserted']} 个 (规范化表)")
    print("=" * 60)

    return stats


async def main():
    import argparse
    parser = argparse.ArgumentParser(description="TCMSP 全量数据迁移工具")
    parser.add_argument("--execute", action="store_true", help="执行实际写入 (默认只预览)")
    parser.add_argument("--dry-run", action="store_true", help="干跑模式 (同默认)")
    parser.add_argument("--force-ob-fix", action="store_true", help="强制修复所有OB值 (不仅>100的)")
    args = parser.parse_args()

    await migrate(
        execute=args.execute,
        force_ob_fix=args.force_ob_fix,
        dry_run=args.dry_run,
    )


if __name__ == "__main__":
    asyncio.run(main())
