"""为10个配方关联成分到 formula_ingredients junction table"""
import sys
import os
import asyncio

os.chdir(os.path.join(os.path.dirname(__file__), '..', 'backend'))
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
os.environ.setdefault('SECRET_KEY', 'rmfood-2024-quantum-peptide-formulation-platform-production-secret-key-minimum-64-chars-long')
os.environ.setdefault('DATABASE_URL', 'postgresql+asyncpg://postgres:@localhost:5432/rmfood_db')
os.environ.setdefault('ADMIN_USERNAME', 'admin')
os.environ.setdefault('ADMIN_PASSWORD', 'admin123')
os.environ.setdefault('ENV', 'development')

from app.core.session import async_session_factory
from app.models.formula import Formula, Ingredient
from sqlalchemy import select, text

# 配方名称 -> 需要关联的成分名称（ingredient.name）
FORMULA_INGREDIENT_MAP = {
    "人参皂苷多肽抗疲劳配方": ["Ginseng", "Astragalus", "Lycium"],
    "黄芪多糖胶原蛋白肽免疫调节配方": ["Astragalus", "Collagen_Fish"],
    "枸杞多糖大豆肽护眼配方": ["Lycium", "Glycine"],
    "葛根素小麦肽尿酸管理配方": ["Pueraria", "Triticum", "Hawthorn"],
    "纳豆激酶红曲多肽心血管养护配方": ["Natto", "Monascus", "Glycine"],
    "GABA茶肽助眠配方": ["Camellia", "Acacia"],
    "益生菌后生元乳酸肽肠道健康配方": ["Lactobacillus"],
    "熊果酸白藜芦醇灵芝肽代谢调节配方": ["Hawthorn", "Resveratrol_Plant", "Ganoderma"],
    "虾青素藻油肽抗氧化配方": ["Haematococcus", "Botanical_Oil", "Holothuria"],
    "乳铁蛋白骨肽钙镁VD骨骼健康配方": ["Lactoferrin", "Collagen_Fish"],
}


async def main():
    async with async_session_factory() as session:
        # 1. 获取所有 ingredient 的 id->name 映射
        result = await session.execute(select(Ingredient))
        all_ingredients = result.scalars().all()
        ing_by_name = {ing.name: ing for ing in all_ingredients}
        print(f"Loaded {len(ing_by_name)} ingredients")

        # 2. 为每个配方关联成分
        total_linked = 0
        for formula_name, ing_names in FORMULA_INGREDIENT_MAP.items():
            result = await session.execute(
                select(Formula).where(Formula.name == formula_name)
            )
            formula = result.scalar_one_or_none()
            if not formula:
                print(f"  SKIP: Formula '{formula_name}' not found")
                continue

            # 检查已关联的 ingredient ids
            existing_result = await session.execute(
                text("SELECT ingredient_id FROM formula_ingredients WHERE formula_id = :fid").bindparams(fid=formula.id)
            )
            existing_ids = {row[0] for row in existing_result}

            linked_this = 0
            for ing_name in ing_names:
                if ing_name in ing_by_name:
                    ing = ing_by_name[ing_name]
                    if ing.id not in existing_ids:
                        await session.execute(
                            text("""
                                INSERT INTO formula_ingredients (formula_id, ingredient_id)
                                VALUES (:fid, :iid)
                                ON CONFLICT DO NOTHING
                            """).bindparams(fid=formula.id, iid=ing.id)
                        )
                        print(f"  Linked '{ing.name}' (id={ing.id}, cn={ing.name_cn}) -> '{formula_name}'")
                        linked_this += 1
                        total_linked += 1

            if linked_this == 0:
                print(f"  SKIP: '{formula_name}' already linked or no ingredients")

        await session.commit()
        print(f"\nDone! Total new links: {total_linked}")


if __name__ == "__main__":
    asyncio.run(main())
