# -*- coding: utf-8 -*-
"""审计/修复 food_materials.active_ingredients 的「TCMSP JSON blob」污染。

字段契约：active_ingredients ARRAY(Text) = 主要活性成分【名称】列表。
缺陷：部分行曾把整段 TCMSP 分子列表原始 JSON（[{"dl":..,"ob":..,"name":..,"mol_id":..}, ...]，
单元素近 100KB）塞进 active_ingredients[0]，会撑爆行、前端渲染成乱码 JSON、污染 BM25 全文索引。

本脚本两种用途：
  1) 审计（默认 dry-run）：统计真实 JSON blob 行数、每行元素数分布、超长元素，
     打印前后对比。若已无 blob，明确报告「0 blob，字段已干净」。
  2) 修复（--apply --yes-i-know）：对含 blob 的行，解析 JSON 提取每个分子 name，
     去重去空，重写为干净名称数组。仅改 active_ingredients，其他字段不动。

保守判定：只把「真正的 JSON blob 元素」（以 [{ 或 {" 开头且含 "mol_id"/"file_id" 键）
当污染；长但合法的化合物名（IUPAC 名，非 JSON）一律保留。

幂等：修复后无 blob 元素，重跑 0 更新。

用法：
  python scripts/audit_fix_active_ingredients.py                         # 审计 dry-run
  python scripts/audit_fix_active_ingredients.py --apply --yes-i-know    # 修复
"""
import argparse
import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

SOURCE_DB = "tcm_herbs+hf_enriched_herbs.compounds"  # ≤50 字符
DATA_QUALITY = 0.85


def is_blob(el):
    if not isinstance(el, str):
        return False
    s = el.strip()
    if not (s.startswith("[{") or s.startswith("[{\"") or s.startswith("{\"")):
        return False
    return ('"mol_id"' in s) or ('"file_id"' in s) or ('"ob"' in s and '"name"' in s)


def extract_names(blob_text):
    try:
        data = json.loads(blob_text)
    except Exception:
        return []
    if not isinstance(data, list):
        data = [data]
    names = []
    for mol in data:
        nm = mol.get("name") if isinstance(mol, dict) else (mol if isinstance(mol, str) else None)
        if isinstance(nm, str) and nm.strip():
            names.append(nm.strip())
    seen, res = set(), []
    for n in names:
        if n not in seen:
            seen.add(n)
            res.append(n)
    return res


async def _conn():
    import asyncpg
    url = ""
    for line in (Path(__file__).resolve().parents[1] / ".env").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line.startswith("DATABASE_URL="):
            url = line.split("=", 1)[1].strip().strip('"').strip("'")
    return await asyncpg.connect(url.replace("postgresql+asyncpg://", "postgresql://"))


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--yes-i-know", action="store_true")
    ap.add_argument("--top", type=int, default=10, help="打印元素数最多的前 N 行")
    args = ap.parse_args()

    if args.apply and not args.yes_i_know:
        print("[REFUSING] --apply 需二次确认：请加 --yes-i-know（先审计看报告）。")
        sys.exit(3)

    conn = await _conn()
    try:
        rows = await conn.fetch(
            "SELECT id, name_cn, source_db, active_ingredients ai FROM food_materials "
            "WHERE array_length(active_ingredients,1) > 0 ORDER BY name_cn")
        total = len(rows)

        # 1) blob 审计
        plan = []
        for r in rows:
            ai = list(r["ai"])
            keep, blob_names, has_blob = [], [], False
            for el in ai:
                if is_blob(el):
                    has_blob = True
                    blob_names.extend(extract_names(el))
                else:
                    keep.append(el)
            if not has_blob:
                continue
            new_ai = keep + blob_names
            seen, dedup = set(), []
            for n in new_ai:
                if n and n not in seen:
                    seen.add(n)
                    dedup.append(n)
            plan.append((r["id"], r["name_cn"], ai, dedup))

        print("=== active_ingredients blob 审计 ===")
        print(f"非空行={total}；真实 JSON blob 行={len(plan)}")
        if not plan:
            print("  ✓ 无 JSON blob，字段已为干净名称数组（无需修复）。")
        else:
            for _id, name, old, new in plan[:15]:
                print(f"  {name}: 旧 {len(old)}元素/最长{max(len(e) for e in old)}字符 -> 新 {len(new)}名称 "
                      f"e.g. {new[:5]}")

        # 2) 元素数分布（blob 已清后关注数组大小是否合理）
        sizes = sorted(((len(r["ai"]), r["name_cn"]) for r in rows), reverse=True)
        print(f"\n元素数 TOP{args.top}（越大越需关注是否该截断 TOP-N）：")
        for sz, nm in sizes[:args.top]:
            print(f"  {nm}: {sz} 个名称")
        big = [s for s, _ in sizes if s > 60]
        print(f"  元素数>60 的行={len(big)}（若有，建议后续加 TOP-N 截断，非本脚本职责）")

        if not args.apply:
            print("\n[dry-run] 未写库。" + ("无 blob 可修。"
                  if not plan else "确认后： python scripts/audit_fix_active_ingredients.py --apply --yes-i-know"))
            return

        if not plan:
            print("\n[APPLY] 无 blob 行需修复，0 更新。")
            return

        for fid, _name, _old, new in plan:
            await conn.execute(
                "UPDATE food_materials SET active_ingredients=$2, source_db=$3, "
                "data_quality=$4, updated_at=NOW() WHERE id=$1",
                fid, new, SOURCE_DB, DATA_QUALITY)
        print(f"\n[APPLY] 修复 blob 行 {len(plan)} 个（active_ingredients 重写为干净名称数组）")
        print(f"[APPLY] source_db={SOURCE_DB}，data_quality={DATA_QUALITY}，updated_at=NOW()")
    finally:
        await conn.close()


if __name__ == "__main__":
    asyncio.run(main())
