"""Add test formula-ingredients data for validation testing"""
import asyncio
from app.core.database.session import get_session_factory
from sqlalchemy import text

async def migrate():
    async with get_session_factory()() as db:
        # Add formula_ingredients for formula 14 (消食导滞方)
        test_data = [
            (14, 1, 30.0, 'g', 30.0, 1, '君药-黄芪'),
            (14, 2, 20.0, 'g', 20.0, 2, '臣药-白术'),
            (14, 3, 15.0, 'g', 15.0, 3, '佐药-茯苓'),
            (14, 4, 10.0, 'g', 10.0, 4, '使药-甘草'),
            (14, 5, 10.0, 'g', 10.0, 5, '辅助-陈皮'),
            (14, 6, 15.0, 'g', 15.0, 6, '辅助-半夏'),
        ]
        
        for formula_id, ing_id, amount, unit, pct, sort_order, notes in test_data:
            try:
                await db.execute(text(
                    "INSERT INTO formula_ingredients (formula_id, ingredient_id, amount, unit, percentage, sort_order, notes) "
                    "VALUES (:formula_id, :ing_id, :amount, :unit, :pct, :sort_order, :notes)"
                ), {
                    'formula_id': formula_id,
                    'ing_id': ing_id,
                    'amount': amount,
                    'unit': unit,
                    'pct': pct,
                    'sort_order': sort_order,
                    'notes': notes,
                })
                print(f'  Added formula {formula_id} <- ingredient {ing_id}')
            except Exception as e:
                print(f'  Skip formula {formula_id} ing {ing_id}: {e}')
        
        await db.commit()
        print('Migration complete')

if __name__ == "__main__":
    asyncio.run(migrate())
