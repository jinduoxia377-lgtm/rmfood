"""重复记录深度分析 - 逐字段对比+保留建议"""
import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from app.core.session import async_session_factory


async def deep_analysis():
    async with async_session_factory() as session:
        # 获取所有类型A(名称完全重复)的记录对
        r = await session.execute(text("""
            SELECT name_cn,
                   STRING_AGG(CAST(id AS VARCHAR), ',') as ids
            FROM tcm_herbs
            GROUP BY name_cn HAVING COUNT(*) > 1
            ORDER BY name_cn
        """))
        dup_groups = r.fetchall()

        report = {
            "审查标准": {
                "类型A": "name_cn 完全相同 — 硬重复，必须合并",
                "类型B": "name_latin 相同(忽略大小写) — 可能是同药异名或同源不同部位",
                "类型C": "tcmsp_id 重复 — 硬重复，数据导入错误",
                "类型E": "同分类+同拉丁名 — 同源不同部位(如合欢皮/合欢花)",
            },
            "重复组详情": [],
            "统计摘要": {},
            "处理建议": [],
        }

        total_records = 0
        total_to_remove = 0
        keep_recs = []
        remove_recs = []
        special_cases = []  # 异名/不同部位情况

        for group in dup_groups:
            name_cn = group[0]
            ids = group[1].split(",")

            # 获取每条记录的完整字段
            records = []
            for rid in ids:
                r2 = await session.execute(text("""
                    SELECT id, name_cn, name_latin, name_pinyin, category,
                           ob_percent, dl_value, is_food_homology,
                           tcmsp_id, source_version,
                           json_array_length(compounds) as compound_count,
                           CASE WHEN effects IS NOT NULL AND effects != '' AND effects != '[]' THEN 1 ELSE 0 END as has_effects,
                           synced_at, created_at
                    FROM tcm_herbs WHERE id = :id
                """), {"id": int(rid)})
                row = r2.fetchone()
                if row:
                    records.append({
                        "id": row[0], "name_cn": row[1], "name_latin": row[2],
                        "name_pinyin": row[3], "category": row[4],
                        "ob_percent": row[5], "dl_value": row[6],
                        "is_food_homology": row[7], "tcmsp_id": row[8],
                        "source_version": row[9], "compound_count": row[10] or 0,
                        "has_effects": row[11], "synced_at": str(row[12]) if row[12] else None,
                        "created_at": str(row[13]) if row[13] else None,
                    })

            total_records += len(records)
            if len(records) < 2:
                continue

            # 质量评分
            def score(rec):
                s = 0
                if rec.get("tcmsp_id"): s += 10
                if rec.get("compound_count", 0) > 0: s += min(rec["compound_count"], 20)  # 每个化合物+1分,上限20
                if rec.get("ob_percent") and rec["ob_percent"] > 0: s += 3
                if rec.get("dl_value") and rec["dl_value"] > 0: s += 3
                if rec.get("category"): s += 2
                if rec.get("name_latin"): s += 2
                if rec.get("name_pinyin"): s += 1
                if rec.get("has_effects"): s += 2
                if rec.get("is_food_homology"): s += 1
                if rec.get("source_version") and "TCMSP" in (rec["source_version"] or ""): s += 5
                # ID越大通常是后插入的(迁移数据), 数据可能更完整
                s += min(rec["id"] * 0.001, 1)
                return s

            scored = [(score(r), r) for r in records]
            scored.sort(key=lambda x: -x[0])

            best = scored[0][1]
            others = [s[1] for s in scored[1:]]

            # 判断是否为"同药异名/不同部位"
            latins = set(r["name_latin"] or "" for r in records)
            cats = set(r["category"] or "" for r in records)
            is_same_latin = len(latins) == 1 and "" not in latins
            is_diff_name = len(set(r["name_cn"] for r in records)) > 1

            dup_type = "硬重复(完全相同药材)"
            if is_same_latin and is_diff_name:
                # 检查是否是不同部位: 合欢皮/合欢花, 枳实/玳玳花
                dup_type = "同源不同部位(异名)"
                special_cases.append({
                    "name_cn": name_cn, "ids": ids,
                    "records": records, "recommendation": "保留全部,标注关联关系"
                })

            entry = {
                "name_cn": name_cn,
                "重复类型": dup_type,
                "记录数": len(records),
                "记录详情": records,
                "质量评分": {r["id"]: s for s, r in scored},
                "建议保留": best["id"],
                "建议删除": [r["id"] for r in others],
                "保留理由": _reason(best, others[0] if others else None),
            }
            report["重复组详情"].append(entry)

            keep_recs.append(best["id"])
            remove_recs.extend(r["id"] for r in others)
            total_to_remove += len(others)

        # 统计摘要
        report["统计摘要"] = {
            "总记录数": 603,
            "涉及重复组数": len(dup_groups),
            "涉及重复记录数": total_records,
            "应删除记录数": total_to_remove,
            "去重后预期数量": 603 - total_to_remove,
            "重复率": f"{total_records/603*100:.2f}%",
            "硬重复组数": len([g for g in report["重复组详情"] if g["重复类型"] == "硬重复(完全相同药材)"]),
            "同源异名组数": len(special_cases),
        }

        # 处理建议
        report["处理建议"] = [
            {
                "优先级": "P0-立即执行",
                "操作": "删除25组硬重复中的低质量记录",
                "影响": f"删除{total_to_remove - len(special_cases)}条记录, 去重后约{603 - total_to_remove + len(special_cases)}条",
                "SQL模板": "DELETE FROM tcm_herbs WHERE id IN ({})".format(
                    ",".join(str(i) for i in remove_recs if not any(
                        sc["name_cn"] == g["name_cn"]
                        for g in report["重复组详情"]
                        for sc in special_cases
                        if sc.get("name_cn") == g.get("name_cn")
                    ))
                ) if remove_recs else "",
            },
            {
                "优先级": "P1-人工审核",
                "操作": "审核同源不同部位药材(合欢皮/合欢花, 枳实/玳玳花等)",
                "详情": [
                    f"{sc['records'][0]['name_cn']} vs {sc['records'][1]['name_cn']} "
                    f"(拉丁名={sc['records'][0].get('name_latin')})"
                    for sc in special_cases
                ],
                "建议": "这些是同一植物的不同药用部位, 建议保留并建立关联表",
            },
            {
                "优先级": "P2-预防",
                "操作": "迁移脚本增加唯一约束检查",
                "建议": "在 tcm_herbs 表上添加 UNIQUE(name_cn) 或使用 UPSERT",
            },
        ]

        # 输出结果
        print("=" * 70)
        print("=== 中药材数据库去重审查报告 ===")
        print("=" * 70)
        print(f"\n总记录数: {report['统计摘要']['总记录数']}")
        print(f"涉及重复组: {report['统计摘要']['涉及重复组数']}")
        print(f"涉及重复记录: {report['统计摘要']['涉及重复记录数']}")
        print(f"应删除记录: {report['统计摘要']['应删除记录数']}")
        print(f"去重后预期: {report['统计摘要']['去重后预期数量']}")
        print(f"重复率: {report['统计摘要']['重复率']}")

        print(f"\n{'='*70}")
        print("=== 各重复组详细对比 ===")
        print(f"{'='*70}")

        for g in report["重复组详情"]:
            print(f'\n--- {g["name_cn"]} [{g["重复类型"]}] ---')
            for r in g["记录详情"]:
                marker = " >>> KEEP" if r["id"] == g["建议保留"] else " (DEL)"
                details = (f"ID={r['id']}{marker}  OB={r['ob_percent']}  DL={r['dl_value']}  "
                           f"cat={r.get('category','-')}  latin={r.get('name_latin','-')}  "
                           f"tcmsp_id={r.get('tcmsp_id','-')}  化合物={r['compound_count']}  "
                           f"source={r.get('source_version','-')}  score={g['质量评分'][r['id']]:.1f}")
                print(f"  {details}")
            print(f"  => 建议: 保留ID={g['建议保留']}, 删除ID={g['建议删除']}")
            print(f"     理由: {g['保留理由']}")

        print(f"\n{'='*70}")
        print("=== 同源不同部位特殊情况 ===")
        print(f"{'='*70}")
        for sc in special_cases:
            print(f"  {sc['records'][0]['name_cn']} / {sc['records'][1]['name_cn']} "
                  f"— 同一植物({sc['records'][0].get('name_latin')})的不同部位, 建议保留双方")

        print(f"\n{'='*70}")
        print("=== 处理建议汇总 ===")
        print(f"{'='*70}")
        for rec in report["处理建议"]:
            print(f"\n[{rec['优先级']}] {rec['操作']}")
            if "详情" in rec:
                for d in rec["详情"]:
                    print(f"  - {d}")
            print(f"  影响: {rec.get('影响', '')}")
            print(f"  建议: {rec.get('建议', '')}")

        # 保存报告
        out_dir = os.path.join(os.path.dirname(__file__), "..", "..", "..", "tcmsp_data", "reports")
        os.makedirs(out_dir, exist_ok=True)
        out_path = os.path.join(out_dir, "duplicate_audit_report.json")
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(report, f, ensure_ascii=False, indent=2, default=str)
        print(f"\n报告已保存: {out_path}")


def _reason(best, other):
    reasons = []
    if best.get("tcmsp_id") and not (other or {}).get("tcmsp_id"):
        reasons.append("有TCMSP_ID")
    bc = best.get("compound_count", 0)
    oc = (other or {}).get("compound_count", 0)
    if bc > oc:
        reasons.append(f"化合物更多({bc}vs{oc})")
    if best.get("ob_percent") and not (other or {}).get("ob_percent"):
        reasons.append("有OB值")
    if best.get("category") and not (other or {}).get("category"):
        reasons.append("有分类")
    bs = best.get("source_version") or ""
    os_ = (other or {}).get("source_version") or ""
    if "TCMSP" in bs and "TCMSP" not in os_:
        reasons.append("来源更权威(TCMSP)")
    if best.get("is_food_homology") and not (other or {}).get("is_food_homology"):
        reasons.append("标记了药食同源")
    if not reasons:
        reasons.append("综合数据完整度更高")
    return "; ".join(reasons)


if __name__ == "__main__":
    asyncio.run(deep_analysis())
