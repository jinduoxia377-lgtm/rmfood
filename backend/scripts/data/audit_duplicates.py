"""中药材数据库去重审查脚本 - 多维度重复检测"""
import asyncio
import json
import sys
from sqlalchemy import text
from app.core.session import async_session_factory

REPORT_PATH = "tcmsp_data/reports/duplicate_audit_report.json"


async def run_audit():
    results = {}
    all_duplicates = []

    async with async_session_factory() as session:
        # ===== 0. 基础统计 =====
        r = await session.execute(text("SELECT COUNT(*) FROM tcm_herbs"))
        total = r.scalar()
        r = await session.execute(text(
            "SELECT COUNT(*) FROM tcm_herbs WHERE tcmsp_id IS NOT NULL AND tcmsp_id != ''"
        ))
        with_id = r.scalar()
        r = await session.execute(text(
            "SELECT COUNT(*) FROM tcm_herbs WHERE name_latin IS NOT NULL AND name_latin != ''"
        ))
        with_latin = r.scalar()
        results["基础统计"] = {
            "总记录数": total,
            "有tcmsp_id": with_id,
            "有拉丁名": with_latin,
            "无tcmsp_id": total - with_id,
            "无拉丁名": total - with_latin,
        }
        print(f"[总数] {total} 条 (有ID:{with_id}, 有拉丁名:{with_latin})")

        # ===== 类型A: name_cn 完全相同 =====
        r = await session.execute(text("""
            SELECT name_cn, COUNT(*) as cnt,
                   STRING_AGG(CAST(id AS VARCHAR), ',') as ids,
                   STRING_AGG(COALESCE(tcmsp_id, '[无]'), ' | ') as tids,
                   STRING_AGG(COALESCE(name_latin, '[无]'), ' | ') as latins
            FROM tcm_herbs
            GROUP BY name_cn HAVING COUNT(*) > 1
            ORDER BY cnt DESC
        """))
        rows = r.fetchall()
        type_a = []
        for row in rows:
            ids = row[2].split(",")
            entry = {
                "name_cn": row[0], "count": row[1],
                "ids": ids, "tcmsp_ids": row[3].split(" | "),
                "latin_names": row[4].split(" | "),
                "类型": "A-名称完全重复",
            }
            type_a.append(entry)
            all_duplicates.extend(ids)
            print(f'  [A] "{row[0]}" x{row[1]}  ids=[{row[2]}]')
        results["类型A_名称完全重复"] = {"组数": len(type_a), "详情": type_a}
        print(f"  [类型A总计] {len(type_a)} 组\n")

        # ===== 类型B: name_latin 完全相同(忽略大小写) =====
        r = await session.execute(text("""
            SELECT LOWER(name_latin) as latin_lower, COUNT(*) as cnt,
                   STRING_AGG(name_cn, ' | ') as names,
                   STRING_AGG(CAST(id AS VARCHAR), ',') as ids,
                   STRING_AGG(COALESCE(tcmsp_id, '[无]'), ' | ') as tids
            FROM tcm_herbs
            WHERE name_latin IS NOT NULL AND name_latin != ''
            GROUP BY LOWER(name_latin) HAVING COUNT(*) > 1
            ORDER BY cnt DESC
        """))
        rows = r.fetchall()
        type_b = []
        for row in rows:
            ids = row[3].split(",")
            entry = {
                "latin_name_normalized": row[0], "count": row[1],
                "chinese_names": row[2].split(" | "), "ids": ids,
                "tcmsp_ids": row[4].split(" | "),
                "类型": "B-拉丁名重复(忽略大小写)",
            }
            type_b.append(entry)
            all_duplicates.extend(ids)
            print(f'  [B] "{row[0]}" x{row[1]}  names=[{row[2]}]')
        results["类型B_拉丁名重复"] = {"组数": len(type_b), "详情": type_b}
        print(f"  [类型B总计] {len(type_b)} 组\n")

        # ===== 类型C: tcmsp_id 重复 =====
        r = await session.execute(text("""
            SELECT tcmsp_id, COUNT(*) as cnt,
                   STRING_AGG(name_cn, ' | ') as names,
                   STRING_AGG(CAST(id AS VARCHAR), ',') as ids,
                   STRING_AGG(COALESCE(name_latin, '[无]'), ' | ') as latins
            FROM tcm_herbs
            WHERE tcmsp_id IS NOT NULL AND tcmsp_id != ''
            GROUP BY tcmsp_id HAVING COUNT(*) > 1
            ORDER BY cnt DESC
        """))
        rows = r.fetchall()
        type_c = []
        for row in rows:
            ids = row[3].split(",")
            entry = {
                "tcmsp_id": row[0], "count": row[1],
                "chinese_names": row[2].split(" | "), "ids": ids,
                "latin_names": row[4].split(" | "),
                "类型": "C-TCMSP_ID重复",
            }
            type_c.append(entry)
            all_duplicates.extend(ids)
            print(f'  [C] ID="{row[0]}" x{row[1]}  names=[{row[2]}]')
        results["类型C_tcmsp_id重复"] = {"组数": len(type_c), "详情": type_c}
        print(f"  [类型C总计] {len(type_c)} 组\n")

        # ===== 类型D: 去空格/特殊字符后名称相同 =====
        r = await session.execute(text("""
            SELECT REGEXP_REPLACE(REPLACE(name_cn, ' ', ''), '[·．\-—＿]', '', 'g') as clean_name,
                   COUNT(*) as cnt,
                   STRING_AGG(name_cn, ' | ') as orig_names,
                   STRING_AGG(CAST(id AS VARCHAR), ',') as ids,
                   STRING_AGG(COALESCE(category, '[无]'), ' | ') as cats
            FROM tcm_herbs
            GROUP BY clean_name HAVING COUNT(*) > 1
            ORDER BY cnt DESC
        """))
        rows = r.fetchall()
        type_d = []
        for row in rows:
            ids = row[3].split(",")
            entry = {
                "cleaned_name": row[0], "count": row[1],
                "original_names": row[2].split(" | "), "ids": ids,
                "categories": row[4].split(" | "),
                "类型": "D-标准化后名称重复",
            }
            type_d.append(entry)
            all_duplicates.extend(ids)
            print(f'  [D] "{row[0]}" x{row[1]}  orig=[{row[2]}]')
        results["类型D_标准化后名称重复"] = {"组数": len(type_d), "详情": type_d}
        print(f"  [类型D总计] {len(type_d)} 组\n")

        # ===== 类型E: 拼音相似 + 分类相同(疑似同药异名) =====
        r = await session.execute(text("""
            SELECT a.name_cn as name_a, b.name_cn as name_b,
                   a.id as id_a, b.id as id_b,
                   a.name_latin as latin_a, b.name_latin as latin_b,
                   a.category as cat_a, b.category as cat_b,
                   a.tcmsp_id as tid_a, b.tcmsp_id as tid_b
            FROM tcm_herbs a
            JOIN tcm_herbs b ON a.id < b.id
                AND a.category = b.category
                AND a.category IS NOT NULL AND a.category != ''
                AND LOWER(a.name_latin) = LOWER(b.name_latin)
                AND a.name_latin IS NOT NULL AND a.name_latin != ''
            ORDER BY a.category, a.name_cn
        """))
        rows = r.fetchall()
        type_e = []
        seen_pairs = set()
        for row in rows:
            pair_key = f"{row[2]}-{row[3]}"
            if pair_key in seen_pairs:
                continue
            seen_pairs.add(pair_key)
            entry = {
                "name_a": row[0], "name_b": row[1],
                "id_a": row[2], "id_b": row[3],
                "latin_a": row[4], "latin_b": row[5],
                "category": row[6],
                "tcmsp_id_a": row[8], "tcmsp_id_b": row[9],
                "类型": "E-同分类+同拉丁名(疑似异名)",
            }
            type_e.append(entry)
            print(f'  [E] [{row[6]}] "{row[0]}" vs "{row[1]}"  latin=({row[4]}/{row[5]})')
        results["类型E_同分类同拉丁名"] = {"组数": len(type_e), "详情": type_e}
        print(f"  [类型E总计] {len(type_e)} 组\n")

        # ===== 汇总统计 =====
        unique_dup_ids = set(all_duplicates)
        results["汇总"] = {
            "总记录数": total,
            "涉及重复的记录数": len(unique_dup_ids),
            "重复率_pct": round(len(unique_dup_ids) / total * 100, 2),
            "类型A_名称完全重复": len(type_a),
            "类型B_拉丁名重复": len(type_b),
            "类型C_ID重复": len(type_c),
            "类型D_标准化后重复": len(type_d),
            "类型E_同分类同拉丁名": len(type_e),
        }

        print("=" * 60)
        print("=== 审查汇总 ===")
        for k, v in results["汇总"].items():
            print(f"  {k}: {v}")
        print("=" * 60)

    # 写入报告文件
    report_path = REPORT_PATH
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(results, f, ensure_ascii=False, indent=2)
    print(f"\n完整报告已保存: {report_path}")

    return results


if __name__ == "__main__":
    asyncio.run(run_audit())
