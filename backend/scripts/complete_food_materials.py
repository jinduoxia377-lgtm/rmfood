# -*- coding: utf-8 -*-
"""一次性补全 food_materials 平台原料库（默认 dry-run，--apply 才写库）。

背景（RAG 非功能遗留 任务3）：
  food_materials 当前仅 13 行，且 effects/active_ingredients/indications/
  contraindications/interactions/description 等关键字段 100% 为空。
  平台知识库（P1-6 注入）依赖该表，需补全至官方药食同源规模（106+）。

补全源（按 name_cn 合并，优先级从高到低）：
  1. curated  : scripts/import_food_materials.py 内置 TCM 功效/毒性（YAO_SHI_TONG_YUAN_DATA + COMMON_FOODS_DATA）
  2. dosage   : app/services/data_sources/herb_dosage_database.py HERB_DOSAGE_DATABASE（《中国药典》2020，106种）
  3. backbone : hf_enriched_herbs 表（官方106+，结构/归经/安全/max_dosage）

字段映射说明（源 → food_materials）：
  name_cn/latin_name/name_en/category/is_food_homology  ← backbone（hf_enriched_herbs）
  nature_cn/flavor_cn/meridians_cn                       → description 前缀（性味归经）
  is_toxic(bool)                                         → toxicity_class（无毒/有毒，粗粒度）
  max_dosage(mg)                                         → safe_dose_max（/1000 转 g）
  compounds                                              → active_ingredients
  restrictions                                           → contraindications
  notes                                                  → description
  ── 剂量权威 ──
  HERB_DOSAGE_DATABASE.dosage_min/max(g)                 → safe_dose_min/max（覆盖 backbone）
  HERB_DOSAGE_DATABASE.restrictions                      → contraindications（覆盖）
  HERB_DOSAGE_DATABASE.usage_forms                       → 追加 description
  HERB_DOSAGE_DATABASE.special_population/preparation    → 追加 description
  ── TCM 功效 ──
  curated.effects                                        → effects（TCM 功效，权威）
  curated.toxicity_class                                 → toxicity_class（无毒/小毒，覆盖布尔粗粒度）
  curated.description                                    → description（覆盖）

用法：
  python scripts/complete_food_materials.py            # dry-run：只打印计划，不写库
  python scripts/complete_food_materials.py --apply    # 实际写库（需用户确认后执行）
"""
import asyncio
import argparse
import sys
from datetime import datetime, timezone
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))


def _load_curated():
    """从 import_food_materials 内置数据提取 TCM 功效/毒性（按 name_cn）。"""
    from scripts.import_food_materials import YAO_SHI_TONG_YUAN_DATA, COMMON_FOODS_DATA
    curated = {}
    for it in YAO_SHI_TONG_YUAN_DATA:
        # (name_cn, name_latin, name_en, category, sub_category, effects, toxicity, safe_dose_max, description[, aliases])
        curated[it[0]] = {
            "name_latin": it[1], "name_en": it[2], "category": it[3],
            "sub_category": it[4], "effects": it[5], "toxicity_class": it[6],
            "safe_dose_max": it[7], "description": it[8],
            "aliases": it[9] if len(it) > 9 else [], "food_homology": True,
        }
    for it in COMMON_FOODS_DATA:
        # (name_cn, category, sub_category, effects, description[, aliases])
        # 注意：import_food_materials.build_food_material_records 对 COMMON_FOODS 存在字段偏移 bug
        # （把 category 误当 name_latin），此处按正确语义解析。
        curated[it[0]] = {
            "name_latin": None, "name_en": None, "category": it[1],
            "sub_category": it[2], "effects": it[3], "description": it[4],
            "aliases": it[5] if len(it) > 5 else [], "food_homology": False,
        }
    return curated


def _load_dosage():
    """从《中国药典》剂量库提取（按 name_cn）。"""
    from app.services.data_sources.herb_dosage_database import HERB_DOSAGE_DATABASE
    return {d["name_cn"]: d for d in HERB_DOSAGE_DATABASE}


def _to_g(value):
    """max_dosage(mg)→g；已是 g 则原样。"""
    if value is None:
        return None
    try:
        v = float(value)
    except (TypeError, ValueError):
        return None
    if v >= 1000:  # 视作 mg → g
        return round(v / 1000.0, 2)
    return v


def _toxicity_from_bool(is_toxic):
    return "有毒" if is_toxic else "无毒"


def build_plan(backbone_rows, curated, dosage):
    """按 name_cn 合并三源，产出补全记录列表 + 覆盖统计。"""
    plan = {}
    for row in backbone_rows:
        name = row.get("name_cn")
        if not name:
            continue
        rec = {
            "name_cn": name,
            "name_latin": row.get("latin_name"),
            "name_en": row.get("name_en"),
            "category": row.get("category"),
            "sub_category": None,
            "food_homology": bool(row.get("is_food_homology")),
            "toxicity_class": _toxicity_from_bool(row.get("is_toxic")),
            "effects": [],
            "active_ingredients": _as_list(row.get("compounds")),
            "contraindications": _as_list(row.get("restrictions")),
            "interactions": [],
            "safe_dose_min": None,
            "safe_dose_max": _to_g(row.get("max_dosage")),
            "description": "；".join(
                str(x) for x in [row.get("nature_cn"), row.get("flavor_cn"), row.get("meridians_cn"),
                                 row.get("notes")] if x
            ),
            "source_db": "hf_enriched_herbs",
            "data_quality": 0.95,
            "review_status": "approved",
            "_backbone": True,
        }
        plan[name] = rec

    # 剂量权威覆盖
    for name, d in dosage.items():
        rec = plan.setdefault(name, {"name_cn": name, "_backbone": False})
        rec.setdefault("toxicity_class", "无毒")
        rec.setdefault("effects", [])
        rec.setdefault("active_ingredients", [])
        rec.setdefault("contraindications", [])
        rec.setdefault("interactions", [])
        rec.setdefault("description", "")
        if d.get("dosage_min") is not None:
            rec["safe_dose_min"] = d["dosage_min"]
        if d.get("dosage_max") is not None:
            rec["safe_dose_max"] = d["dosage_max"]
        rec["contraindications"] = _as_list(d.get("restrictions")) or rec.get("contraindications")
        extras = [x for x in [d.get("usage_forms"), d.get("special_population"), d.get("preparation")] if x]
        if extras:
            rec["description"] = (rec.get("description") or "") + ("；" if rec.get("description") else "") + "；".join(map(str, extras))
        if d.get("dosage_unit"):
            rec["_dosage_unit"] = d["dosage_unit"]
        rec.setdefault("name_latin", None)
        rec.setdefault("name_en", None)
        rec.setdefault("category", None)
        rec.setdefault("sub_category", None)
        rec.setdefault("food_homology", True)
        rec.setdefault("source_db", "药典剂量库")
        rec.setdefault("data_quality", 0.9)
        rec.setdefault("review_status", "approved")

    # TCM 功效权威覆盖
    for name, c in curated.items():
        rec = plan.setdefault(name, {"name_cn": name, "_backbone": False})
        for k in ("effects", "toxicity_class", "description", "name_latin", "name_en",
                  "category", "sub_category", "safe_dose_max", "aliases", "food_homology"):
            rec.setdefault(k, None if k in ("safe_dose_max",) else ([] if k in ("effects", "aliases") else None))
        if c.get("effects"):
            rec["effects"] = c["effects"]
        if c.get("toxicity_class"):
            rec["toxicity_class"] = c["toxicity_class"]
        if c.get("description"):
            rec["description"] = c["description"]
        if c.get("name_latin"):
            rec["name_latin"] = c["name_latin"]
        if c.get("name_en"):
            rec["name_en"] = c["name_en"]
        if c.get("category"):
            rec["category"] = c["category"]
        if c.get("sub_category"):
            rec["sub_category"] = c["sub_category"]
        if c.get("safe_dose_max") is not None:
            rec["safe_dose_max"] = c["safe_dose_max"]
        if c.get("aliases"):
            rec["aliases"] = c["aliases"]
        if c.get("food_homology") is not None:
            rec["food_homology"] = c["food_homology"]
        rec.setdefault("active_ingredients", [])
        rec.setdefault("contraindications", [])
        rec.setdefault("interactions", [])
        rec.setdefault("safe_dose_min", None)
        rec.setdefault("source_db", "卫健委药食同源目录")
        rec.setdefault("data_quality", 0.95)
        rec.setdefault("review_status", "approved")

    return plan


def _as_list(v):
    if v is None:
        return []
    if isinstance(v, (list, tuple)):
        return list(v)
    if isinstance(v, str):
        return [v] if v.strip() else []
    return [v]


def _as_text(v):
    """description 可能被构造成 list（如 dosage 追加 usage_forms），统一转 str。"""
    if v is None:
        return None
    if isinstance(v, (list, tuple)):
        return "\n".join(str(x) for x in v if x)
    return str(v)


async def load_backbone():
    """从 hf_enriched_herbs 表读取官方106+骨架。"""
    import os
    from pathlib import Path as P
    url = ""
    for line in (P(__file__).resolve().parents[1] / ".env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("DATABASE_URL="):
            url = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not url:
        url = os.environ.get("DATABASE_URL", "")
    import asyncpg
    conn = await asyncpg.connect(url.replace("postgresql+asyncpg://", "postgresql://"))
    try:
        rows = await conn.fetch(
            "SELECT name_cn, latin_name, name_en, category, is_food_homology, is_toxic, "
            "nature_cn, flavor_cn, meridians_cn, max_dosage, restrictions, compounds, notes "
            "FROM hf_enriched_herbs ORDER BY name_cn")
        return [dict(r) for r in rows]
    finally:
        await conn.close()


async def apply(plan):
    """写库（--apply 才执行）。按 name_cn 存在性：存在则更新，否则新增。"""
    import asyncpg
    from pathlib import Path as P
    url = ""
    for line in (P(__file__).resolve().parents[1] / ".env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("DATABASE_URL="):
            url = line.split("=", 1)[1].strip().strip('"').strip("'")
    conn = await asyncpg.connect(url.replace("postgresql+asyncpg://", "postgresql://"))
    inserted = updated = 0
    try:
        existing = {r["name_cn"] for r in await conn.fetch("SELECT name_cn FROM food_materials")}
        # 数组列：部分源数据 effects/禁忌/活性成分为 str，统一转 list 再入库
        ARRAY_COLS = {"effects", "active_ingredients", "contraindications", "interactions"}
        for rec in plan.values():
            cols = ["name_cn", "name_latin", "name_en", "category", "sub_category", "food_homology",
                    "toxicity_class", "effects", "active_ingredients", "contraindications",
                    "interactions", "safe_dose_min", "safe_dose_max", "description", "source_db",
                    "data_quality", "review_status"]
            norm = {c: (_as_list(rec.get(c)) if c in ARRAY_COLS else rec.get(c)) for c in cols}
            norm["description"] = _as_text(rec.get("description"))
            if rec["name_cn"] in existing:
                set_cols = [c for c in cols if norm[c] not in (None, [], "")]
                if set_cols:
                    sets = ", ".join(f"{c}=${i+2}" for i, c in enumerate(set_cols))
                    await conn.execute(
                        f"UPDATE food_materials SET {sets}, updated_at=NOW() WHERE name_cn=$1",
                        rec["name_cn"], *[norm[c] for c in set_cols])
                    updated += 1
            else:
                # 审计字段：模型默认值为 Python 侧（now_utc_mapped），原始 INSERT 需显式提供，
                # 否则违反 created_at/updated_at NOT NULL 约束。
                _now = datetime.now(timezone.utc)
                ins_cols = cols + ["created_at", "updated_at"]
                vals = [norm[c] for c in cols] + [_now, _now]
                ph = ", ".join(f"${i+1}" for i in range(len(ins_cols)))
                await conn.execute(
                    f"INSERT INTO food_materials ({', '.join(ins_cols)}) VALUES ({ph})", *vals)
                inserted += 1
        await conn.execute("COMMIT")
        return inserted, updated
    finally:
        await conn.close()


def summarize(plan, existing_names):
    total = len(plan)
    new = [n for n in plan if n not in existing_names]
    enrich = [n for n in plan if n in existing_names]
    eff = sum(1 for r in plan.values() if r.get("effects"))
    contra = sum(1 for r in plan.values() if r.get("contraindications"))
    dose = sum(1 for r in plan.values() if r.get("safe_dose_max") is not None)
    desc = sum(1 for r in plan.values() if r.get("description"))
    print(f"补全计划：共 {total} 条唯一原料")
    print(f"  新增（food_materials 无此名）: {len(new)} 条")
    print(f"  补全/更新（已有名，回填字段）: {len(enrich)} 条")
    print(f"  补全后字段覆盖（计划内）:")
    print(f"    effects 非空: {eff}/{total}")
    print(f"    contraindications 非空: {contra}/{total}")
    print(f"    safe_dose_max 非空: {dose}/{total}")
    print(f"    description 非空: {desc}/{total}")
    return new, enrich


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="实际写库（默认 dry-run）")
    args = ap.parse_args()

    curated = _load_curated()
    dosage = _load_dosage()
    backbone = await load_backbone()

    plan = build_plan(backbone, curated, dosage)

    import asyncpg
    from pathlib import Path as P
    url = ""
    for line in (P(__file__).resolve().parents[1] / ".env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("DATABASE_URL="):
            url = line.split("=", 1)[1].strip().strip('"').strip("'")
    conn = await asyncpg.connect(url.replace("postgresql+asyncpg://", "postgresql://"))
    existing = {r["name_cn"] for r in await conn.fetch("SELECT name_cn FROM food_materials")}
    await conn.close()

    print(f"当前 food_materials 行数: {len(existing)}")
    new, enrich = summarize(plan, existing)

    if args.apply:
        ins, upd = await apply(plan)
        print(f"\n[APPLY] 已写入：新增 {ins} 条，更新 {upd} 条")
    else:
        print("\n[dry-run] 未写库。确认无误后执行： python scripts/complete_food_materials.py --apply")


if __name__ == "__main__":
    asyncio.run(main())
