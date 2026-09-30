"""Add test ingredients to formula 14"""
import asyncio
from app.core.database.session import get_session_factory
from sqlalchemy import text, select
from app.models import Formula, Ingredient
from sqlalchemy.orm import selectinload

async def add_ingredients():
    async with get_session_factory()() as db:
        # Load formula 14
        result = await db.execute(
            select(Formula)
            .where(Formula.id == 14)
            .options(selectinload(Formula.ingredients))
        )
        formula = result.scalar_one_or_none()
        if not formula:
            print("Formula 14 not found")
            return
        
        print(f"Formula: {formula.name}")
        print(f"Current ingredients: {len(formula.ingredients)}")
        
        # Add test ingredients if none exist
        if len(formula.ingredients) == 0:
            # Create some test ingredients
            test_ingredients = [
                ("黄芪", "Astragalus membranaceus", "root", 15.0, 0.3),
                ("当归", "Angelica sinensis", "root", 10.0, 0.2),
                ("茯苓", "Poria cocos", "mycelium", 12.0, 0.25),
                ("甘草", "Glycyrrhiza uralensis", "root", 5.0, 0.1),
                ("大枣", "Ziziphus jujuba", "fruit", 8.0, 0.15),
            ]
            
            for name_cn, name_latin, part, amount_g, percentage in test_ingredients:
                # Check if ingredient exists
                ing_result = await db.execute(
                    select(Ingredient).where(Ingredient.name_cn == name_cn)
                )
                ing = ing_result.scalar_one_or_none()
                
                if not ing:
                    ing = Ingredient(
                        name=name_cn,
                        name_cn=name_cn,
                        category=part,
                        source=name_latin,
                        properties={"weight_g": amount_g, "percentage": percentage},
                    )
                    db.add(ing)
                
                # Add to formula
                formula.ingredients.append(ing)
            
            await db.commit()
            print(f"Added {len(test_ingredients)} ingredients to formula 14")
        else:
            print(f"Formula already has {len(formula.ingredients)} ingredients")
        
        # Verify
        await db.refresh(formula, ["ingredients"])
        print(f"Final ingredient count: {len(formula.ingredients)}")
        for ing in formula.ingredients:
            props = ing.properties or {}
            print(f"  - {ing.name_cn}: {props.get('weight_g', 0)}g ({props.get('percentage', 0)*100:.0f}%)")

if __name__ == "__main__":
    asyncio.run(add_ingredients())
