"""P0 去重执行脚本 - 删除25条低质量重复记录"""
import asyncio
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

from sqlalchemy import text
from app.core.session import async_session_factory


# 审查报告确认的25个待删除ID (低质量/旧版本/无TCMSP_ID)
DELETE_IDS = [171, 79, 190, 213, 176, 127, 181, 282, 189, 184,
              109, 128, 212, 168, 214, 169, 262, 283, 179, 284,
              170, 167, 182, 263, 229]

# 对应的药材名称 (用于审计日志)
DELETE_NAMES = [
    "何首乌", "厚朴", "大青叶", "川贝母", "巴戟天",
    "月季花", "木香", "杜仲", "板蓝根", "枳实",
    "桃仁", "泽兰", "浙贝母", "熟地黄", "瓜蒌",
    "白芍", "神曲", "肉苁蓉", "莱菔子", "锁阳",
    "阿胶", "饴糖", "香附", "麦芽", "黄柏",
]


async def execute_dedup():
    async with async_session_factory() as session:
        # === Step 1: 删除前快照 ===
        r = await session.execute(text("SELECT COUNT(*) FROM tcm_herbs"))
        before_count = r.scalar()

        r = await session.execute(text(f"""
            SELECT id, name_cn, tcmsp_id, source_version,
                   json_array_length(compounds) as cc
            FROM tcm_herbs WHERE id = ANY(:ids)
            ORDER BY id
        """), {"ids": DELETE_IDS})
        to_delete = [dict(r._mapping) for r in r.fetchall()]

        print("=" * 65)
        print("=== P0 去重执行: 删除25条低质量重复记录 ===")
        print("=" * 65)
        print(f"\n删除前总记录数: {before_count}")
        print(f"待删除记录数:   {len(DELETE_IDS)}")

        # 显示即将删除的记录摘要
        print(f"\n--- 待删除记录清单 ---")
        for rec in to_delete:
            marker = ""
            if rec["tcmsp_id"]:
                marker += f" [有ID:{rec['tcmsp_id']}]"
            if rec["source_version"] and "TCMSP" in (rec["source_version"] or ""):
                marker += f" [TCMSP源]"
            print(f"  ID={rec['id']:>3} | {rec['name_cn']:<6} | "
                  f"化合物={rec['cc'] or 0:>3} | "
                  f"source={rec['source_version'] or '-':<20}{marker}")

        # === Step 2: 执行删除 ===
        result = await session.execute(
            text("DELETE FROM tcm_herbs WHERE id = ANY(:ids)"),
            {"ids": DELETE_IDS}
        )
        deleted = result.rowcount
        await session.commit()

        # === Step 3: 删除后验证 ===
        r = await session.execute(text("SELECT COUNT(*) FROM tcm_herbs"))
        after_count = r.scalar()

        # 确认已删除的名称不再存在
        r = await session.execute(text("""
            SELECT name_cn FROM tcm_herbs
            WHERE name_cn = ANY(:names)
            GROUP BY name_cn HAVING COUNT(*) > 1
            ORDER BY name_cn
        """), {"names": DELETE_NAMES})
        still_dup = r.fetchall()

        # 统计各分类数量
        r = await session.execute(text("""
            SELECT category, COUNT(*)
            FROM tcm_herbs
            GROUP BY category ORDER BY COUNT(*) DESC LIMIT 10
        """))
        top_cats = r.fetchall()

        # 药食同源计数
        r = await session.execute(text(
            "SELECT COUNT(*) FROM tcm_herbs WHERE is_food_homology = true"
        ))
        food_count = r.scalar()

        # 有TCMSP_ID计数
        r = await session.execute(text(
            "SELECT COUNT(*) FROM tcm_herbs WHERE tcmsp_id IS NOT NULL AND tcmsp_id != ''"
        ))
        with_tcmsp_id = r.scalar()

        print(f"\n--- 执行结果 ---")
        print(f"实际删除行数:   {deleted}")
        print(f"删除后总记录数: {after_count}")
        print(f"净减少:         {before_count - after_count}")
        print(f"药食同源数:     {food_count}")
        print(f"有TCMSP-ID数:   {with_tcmsp_id}")

        if still_dup:
            print(f"\n⚠️ 仍有{len(still_dup)}个名称存在重复:")
            for row in still_dup:
                print(f"  - {row[0]}")
        else:
            print(f"\n✅ 名称完全去重成功! 无任何 name_cn 重复。")

        print(f"\n--- TOP10 分类分布 ---")
        for cat, cnt in top_cats:
            print(f"  {cat or '[未分类]'}: {cnt}")

        # === Step 4: 输出可回滚SQL ===
        print(f"\n--- 回滚SQL (如需恢复) ---")
        ids_str = ",".join(str(i) for i in DELETE_IDS)
        print(f"-- 注意: 仅记录了ID列表, 数据内容需从备份恢复")
        print(f"-- DELETE_IDS = ({ids_str})")

        return {
            "before": before_count,
            "deleted": deleted,
            "after": after_count,
            "remaining_dups": len(still_dup),
            "food_homology": food_count,
            "with_tcmsp_id": with_tcmsp_id,
        }


if __name__ == "__main__":
    result = asyncio.run(execute_dedup())
    print(f"\n{'='*65}")
    print(f"✅ P0去重完成: {result['before']} → {result['after']} "
          f"(删除{result['deleted']}条)")
    print(f"{'='*65}")
