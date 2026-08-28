"""药食同源关系链数据导入脚本

读取 herb-formula-master 中的「药食同源_真实关系链」Excel，
将 100 种药食同源中药 → 化合物 → 靶点 → 疾病 四层关系链
批量导入 RMFOODFP 的 PostgreSQL 数据库。

用法:
    cd D:/RMFOODFP/backend
    python -m app.services.import_herb_food_homology
    # 或指定源路径:
    python -m app.services.import_herb_food_homology --source "E:/参考案例配方系统/herb-formula-master/data/药食同源_真实关系链（去重）(1).xlsx"
"""

import argparse
import logging
import sys
import time
from pathlib import Path

# 允许从 backend/ 根目录直接运行
_BACKEND_ROOT = Path(__file__).resolve().parent.parent.parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("import_herb_food_homology")


async def _import_herb_food_homology(source_path: str) -> dict:
    """执行导入，返回统计信息。"""
    import asyncio
    from sqlalchemy import text
    from app.core.database import engine

    stats = {
        "herbs": 0,
        "compounds": 0,
        "targets": 0,
        "diseases": 0,
        "herb_compound_edges": 0,
        "compound_target_edges": 0,
        "target_disease_edges": 0,
        "errors": [],
    }

    # ── 1. 读取 Excel ───────────────────────────────────────────
    try:
        import pandas as pd
    except ImportError:
        stats["errors"].append("pandas not installed")
        return stats

    xls_path = Path(source_path)
    if not xls_path.exists():
        stats["errors"].append(f"源文件不存在: {source_path}")
        return stats

    logger.info(f"读取 Excel: {xls_path} ({xls_path.stat().st_size / 1024 / 1024:.1f} MB)")
    xls = pd.ExcelFile(xls_path)

    sheet_herb_compound = None
    sheet_compound_target = None
    sheet_target_disease = None
    for s in xls.sheet_names:
        if "中药" in s and "化合物" in s:
            sheet_herb_compound = s
        elif "化合物" in s and "靶点" in s:
            sheet_compound_target = s
        elif "靶点" in s and "疾病" in s:
            sheet_target_disease = s

    if not all([sheet_herb_compound, sheet_compound_target, sheet_target_disease]):
        stats["errors"].append(f"未找到三个必要的 Sheet，可用: {xls.sheet_names}")
        return stats

    df_hc = pd.read_excel(xls, sheet_name=sheet_herb_compound, header=0)
    df_ct = pd.read_excel(xls, sheet_name=sheet_compound_target, header=0)
    df_td = pd.read_excel(xls, sheet_name=sheet_target_disease, header=0)

    logger.info(
        f"  中药-化合物: {len(df_hc)} 行 | "
        f"化合物-靶点: {len(df_ct)} 行 | "
        f"靶点-疾病: {len(df_td)} 行"
    )

    # ── 2. 异步导入 ─────────────────────────────────────────────
    async with engine.begin() as conn:
        # 2a. 插入药材
        seen_herbs: dict[str, int] = {}  # source_id → db_id
        for _, row in df_hc.drop_duplicates(subset=["中药ID"]).iterrows():
            src_id = str(row["中药ID"]).strip()
            if src_id in seen_herbs:
                continue
            name_cn = str(row["官方药食同源名称"]).strip()
            name_en = str(row.get("中文名", "") or "").strip()
            await conn.execute(
                text("""
                    INSERT INTO herb_food_herbs (source_id, name_cn, name_en)
                    VALUES (:sid, :cn, :en)
                    ON CONFLICT (source_id) DO UPDATE SET
                        name_cn = EXCLUDED.name_cn,
                        updated_at = now()
                    RETURNING id
                """),
                {"sid": src_id, "cn": name_cn, "en": name_en},
            )
            result = await conn.execute(
                text("SELECT id FROM herb_food_herbs WHERE source_id = :sid"),
                {"sid": src_id},
            )
            db_id = result.scalar_one()
            seen_herbs[src_id] = db_id
            stats["herbs"] += 1

        # 2b. 插入化合物
        seen_compounds: dict[str, int] = {}
        for _, row in df_hc.drop_duplicates(subset=["化合物ID"]).iterrows():
            src_id = str(row["化合物ID"]).strip()
            if src_id in seen_compounds:
                continue
            name_cn = str(row.get("化合物中文", row.get("化合物名", ""))).strip()
            name_en = str(row.get("化合物英文", "")).strip()
            formula = str(row.get("分子式", "")).strip() if pd.notna(row.get("分子式")) else None
            smiles = str(row.get("SMILES", "")).strip() if pd.notna(row.get("SMILES")) else None
            await conn.execute(
                text("""
                    INSERT INTO herb_food_compounds (source_id, name_cn, name_en, molecular_formula, smiles)
                    VALUES (:sid, :cn, :en, :formula, :smiles)
                    ON CONFLICT (source_id) DO UPDATE SET
                        name_cn = EXCLUDED.name_cn,
                        updated_at = now()
                    RETURNING id
                """),
                {"sid": src_id, "cn": name_cn, "en": name_en,
                 "formula": formula, "smiles": smiles},
            )
            result = await conn.execute(
                text("SELECT id FROM herb_food_compounds WHERE source_id = :sid"),
                {"sid": src_id},
            )
            db_id = result.scalar_one()
            seen_compounds[src_id] = db_id
            stats["compounds"] += 1

        # 2c. 插入靶点
        seen_targets: dict[str, int] = {}
        for _, row in df_ct.drop_duplicates(subset=["靶点ID"]).iterrows():
            src_id = str(row["靶点ID"]).strip()
            if src_id in seen_targets:
                continue
            gene = str(row.get("基因符号", "") or "").strip()
            protein = str(row.get("靶点全称", row.get("蛋白名", ""))).strip()
            await conn.execute(
                text("""
                    INSERT INTO herb_food_targets (source_id, gene_symbol, protein_name)
                    VALUES (:sid, :gene, :protein)
                    ON CONFLICT (source_id) DO UPDATE SET
                        gene_symbol = EXCLUDED.gene_symbol,
                        updated_at = now()
                    RETURNING id
                """),
                {"sid": src_id, "gene": gene or None, "protein": protein or None},
            )
            result = await conn.execute(
                text("SELECT id FROM herb_food_targets WHERE source_id = :sid"),
                {"sid": src_id},
            )
            db_id = result.scalar_one()
            seen_targets[src_id] = db_id
            stats["targets"] += 1

        # 2d. 插入疾病
        seen_diseases: dict[str, int] = {}
        for _, row in df_td.drop_duplicates(subset=["疾病ID"]).iterrows():
            src_id = str(row["疾病ID"]).strip()
            if src_id in seen_diseases:
                continue
            name_en = str(row["疾病名称"]).strip()
            umls = str(row.get("UMLS疾病类型", "") or "").strip() if pd.notna(row.get("UMLS疾病类型")) else None
            dgnet = str(row.get("DisGeNET关联类型", "") or "").strip() if pd.notna(row.get("DisGeNET关联类型")) else None
            pubmed = str(row.get("PubMed文献", "") or "").strip() if pd.notna(row.get("PubMed文献")) else None
            await conn.execute(
                text("""
                    INSERT INTO herb_food_diseases (source_id, name_en, umls_type, disgenet_type, pubmed_id)
                    VALUES (:sid, :en, :umls, :dgnet, :pubmed)
                    ON CONFLICT (source_id) DO UPDATE SET
                        updated_at = now()
                    RETURNING id
                """),
                {"sid": src_id, "en": name_en, "umls": umls or None,
                 "dgnet": dgnet or None, "pubmed": pubmed or None},
            )
            result = await conn.execute(
                text("SELECT id FROM herb_food_diseases WHERE source_id = :sid"),
                {"sid": src_id},
            )
            db_id = result.scalar_one()
            seen_diseases[src_id] = db_id
            stats["diseases"] += 1

        # 2e. 插入 中药-化合物 边
        seen_hc_edges: set[tuple] = set()
        for _, row in df_hc.iterrows():
            herb_src = str(row["中药ID"]).strip()
            comp_src = str(row["化合物ID"]).strip()
            key = (herb_src, comp_src)
            if key in seen_hc_edges:
                continue
            seen_hc_edges.add(key)
            herb_db_id = seen_herbs.get(herb_src)
            comp_db_id = seen_compounds.get(comp_src)
            if herb_db_id is None or comp_db_id is None:
                continue
            await conn.execute(
                text("""
                    INSERT INTO herb_food_herb_compound (herb_id, compound_id)
                    VALUES (:hid, :cid)
                    ON CONFLICT DO NOTHING
                """),
                {"hid": herb_db_id, "cid": comp_db_id},
            )
            stats["herb_compound_edges"] += 1

        # 2f. 插入 化合物-靶点 边
        seen_ct_edges: set[tuple] = set()
        for _, row in df_ct.iterrows():
            comp_src = str(row["化合物ID"]).strip()
            tgt_src = str(row["靶点ID"]).strip()
            key = (comp_src, tgt_src)
            if key in seen_ct_edges:
                continue
            seen_ct_edges.add(key)
            comp_db_id = seen_compounds.get(comp_src)
            tgt_db_id = seen_targets.get(tgt_src)
            if comp_db_id is None or tgt_db_id is None:
                continue
            evidence = str(row.get("数据来源", "") or "").strip() if pd.notna(row.get("数据来源")) else None
            await conn.execute(
                text("""
                    INSERT INTO herb_food_compound_target (compound_id, target_id, evidence_source)
                    VALUES (:cid, :tid, :ev)
                    ON CONFLICT DO NOTHING
                """),
                {"cid": comp_db_id, "tid": tgt_db_id, "ev": evidence or None},
            )
            stats["compound_target_edges"] += 1

        # 2g. 插入 靶点-疾病 边
        seen_td_edges: set[tuple] = set()
        for _, row in df_td.iterrows():
            tgt_src = str(row["靶点ID"]).strip()
            dis_src = str(row["疾病ID"]).strip()
            key = (tgt_src, dis_src)
            if key in seen_td_edges:
                continue
            seen_td_edges.add(key)
            tgt_db_id = seen_targets.get(tgt_src)
            dis_db_id = seen_diseases.get(dis_src)
            if tgt_db_id is None or dis_db_id is None:
                continue
            await conn.execute(
                text("""
                    INSERT INTO herb_food_target_disease (target_id, disease_id)
                    VALUES (:tid, :did)
                    ON CONFLICT DO NOTHING
                """),
                {"tid": tgt_db_id, "did": dis_db_id},
            )
            stats["target_disease_edges"] += 1

    # ── 3. 统计验证 ─────────────────────────────────────────────
    async with engine.begin() as conn:
        for table, key in [
            ("herb_food_herbs", "herbs"),
            ("herb_food_compounds", "compounds"),
            ("herb_food_targets", "targets"),
            ("herb_food_diseases", "diseases"),
            ("herb_food_herb_compound", "herb_compound_edges"),
            ("herb_food_compound_target", "compound_target_edges"),
            ("herb_food_target_disease", "target_disease_edges"),
        ]:
            result = await conn.execute(text(f"SELECT COUNT(*) FROM {table}"))
            stats[key] = result.scalar_one()

    return stats


def main():
    parser = argparse.ArgumentParser(description="导入药食同源关系链数据")
    parser.add_argument(
        "--source",
        default=None,
        help="Excel 文件路径（默认: 同项目目录下的 data/药食同源_真实关系链（去重）(1).xlsx）",
    )
    args = parser.parse_args()

    if args.source:
        source_path = args.source
    else:
        # 默认从 herb-formula-master 复制
        source_path = (
            Path(__file__).resolve().parent.parent.parent.parent.parent.parent
            / "参考案例配方系统"
            / "herb-formula-master"
            / "data"
            / "药食同源_真实关系链（去重）(1).xlsx"
        )

    if not Path(source_path).exists():
        logger.error(f"源文件不存在: {source_path}")
        logger.info("请使用 --source 参数指定 Excel 路径")
        sys.exit(1)

    logger.info(f"开始导入: {source_path}")
    t0 = time.perf_counter()

    stats = asyncio.run(_import_herb_food_homology(str(source_path)))

    elapsed = time.perf_counter() - t0
    logger.info("=" * 50)
    logger.info(f"导入完成！耗时 {elapsed:.1f}s")
    logger.info(f"  中药:   {stats['herbs']:,} 种")
    logger.info(f"  化合物: {stats['compounds']:,} 种")
    logger.info(f"  靶点:   {stats['targets']:,} 个")
    logger.info(f"  疾病:   {stats['diseases']:,} 种")
    logger.info(f"  中药-化合物边:  {stats['herb_compound_edges']:,} 条")
    logger.info(f"  化合物-靶点边:  {stats['compound_target_edges']:,} 条")
    logger.info(f"  靶点-疾病边:    {stats['target_disease_edges']:,} 条")
    if stats["errors"]:
        logger.warning(f"  错误: {stats['errors']}")
    logger.info("=" * 50)


if __name__ == "__main__":
    main()
