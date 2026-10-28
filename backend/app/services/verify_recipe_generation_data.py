"""
配方生成数据验证脚本

快速验证数据库连接和数据完整性

用法:
    python -m app.services.verify_recipe_generation_data
"""
import asyncio
import sys

sys.path.insert(0, ".")

from sqlalchemy import func, select

from app.core.database.session import async_session_factory
from app.infrastructure.herb_knowledge_adapters import TCMSPHerbKnowledgeAdapter
from app.models.external_data import TCMHerb


async def main():
    print("=" * 60)
    print("配方生成数据验证")
    print("=" * 60)

    try:
        async with async_session_factory() as db:
            # 1. 检查数据库连接
            print("\n[1] 数据库连接...")
            result = await db.execute(select(func.count()).select_from(TCMHerb))
            total = result.scalar()
            print(f"    [OK] Database connected, TCMHerb table has {total} records")

            if total == 0:
                print("    [FAIL] Database is empty, please run seed script first")
                print("    命令: python -m app.services.seed_knowledge_base")
                return 1

            # 2. 检查 extra_knowledge 字段
            print("\n[2] 检查 extra_knowledge 字段...")
            result = await db.execute(
                select(func.count())
                .select_from(TCMHerb)
                .where(TCMHerb.extra_knowledge != None)
                .where(TCMHerb.extra_knowledge != '')
            )
            with_knowledge = result.scalar()
            rate = with_knowledge / total * 100 if total > 0 else 0
            print(f"    有知识数据: {with_knowledge}/{total} ({rate:.1f}%)")

            if with_knowledge < total * 0.8:
                print("    ⚠️  知识数据覆盖率不足 80%，建议运行补全脚本")
                print("    命令: python -m app.services.recipe_generation_data_completer")

            # 3. 测试适配器
            print("\n[3] 测试 HerbKnowledgeAdapter...")
            adapter = TCMSPHerbKnowledgeAdapter(db)

            try:
                all_herbs = await adapter.get_all_herbs()
                print(f"    [OK] Adapter working, loaded {len(all_herbs)} herbs")

                # 显示样本
                if all_herbs:
                    print("\n[4] 样本药材:")
                    for herb in all_herbs[:5]:
                        efficacy_count = len(herb.efficacy_scores)
                        print(f"    - {herb.name_cn}: {efficacy_count} 项功效, 安全指数 {herb.safety_index}")

                # 检查功效索引
                efficacy_index = await adapter.get_efficacy_index()
                print("\n[5] 功效索引:")
                print(f"    功效类别数: {len(efficacy_index)}")
                for eff, herb_ids in list(efficacy_index.items())[:5]:
                    print(f"    - {eff}: {len(herb_ids)} 种药材")

            except Exception as e:
                print(f"    [FAIL] Adapter load failed: {e}")
                return 1

            # 4. 最终评估
            print("\n" + "=" * 60)
            if total >= 50 and with_knowledge >= 40 and len(all_herbs) >= 20:
                print("[PASS] Data verification passed, recipe generation is ready")
                return 0
            else:
                print("[WARN] Data incomplete, consider running completer")
                print("    命令: python -m app.services.recipe_generation_data_completer")
                return 1

    except Exception as e:
        print(f"\n[FAIL] Verification failed: {e}")
        import traceback
        traceback.print_exc()
        return 1


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    sys.exit(exit_code)
