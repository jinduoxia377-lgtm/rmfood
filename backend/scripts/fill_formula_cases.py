# -*- coding: utf-8 -*-
"""填充12条配方案例数据到数据库 - ORM方式"""
import sys
import asyncio
sys.path.insert(0, '.')
from app.core.database.session import get_session_factory
from app.models.formula_case import FormulaCase
from scripts.seed_formula_cases import CASES


async def main():
    Session = get_session_factory()
    async with Session() as db:
        # 检查已有数据
        from sqlalchemy import select, func
        r = await db.execute(select(func.count()).select_from(FormulaCase))
        existing = r.scalar_one()
        print(f'Existing cases: {existing}')

        # 获取创建者
        from app.models.user_model import User
        r = await db.execute(select(User.id).order_by(User.id).limit(1))
        user_row = r.fetchone()
        if not user_row:
            print('ERROR: No users found!')
            return
        creator_id = user_row[0]
        print(f'Creator ID: {creator_id}')

        # 获取配方ID
        from app.models.formula import Formula
        r = await db.execute(select(Formula.id).order_by(Formula.id))
        formula_rows = r.fetchall()
        print(f'Total formulas: {len(formula_rows)}')

        if len(formula_rows) < 12:
            print(f'WARNING: Only {len(formula_rows)} formulas')
            return

        # 删除旧数据
        from sqlalchemy import delete
        await db.execute(delete(FormulaCase))
        await db.commit()
        print(f'Deleted {existing} cases')

        # 插入新数据
        for i, case in enumerate(CASES):
            formula_id = formula_rows[i][0]
            obj = FormulaCase(
                formula_id=formula_id,
                organization_id=None,
                created_by=creator_id,
                title=case['title'],
                category=case['category'],
                tags=case['tags'],
                summary=case['summary'],
                content=case['content'],
                views=0,
                likes=0,
                is_featured=case['is_featured'],
                generated_by_ai=False,
            )
            db.add(obj)
            print(f'  [{i+1}/12] {case["title"][:50]}')

        await db.commit()
        print(f'\nDone! Inserted 12 cases successfully.')

        # 验证
        r = await db.execute(select(func.count()).select_from(FormulaCase))
        total = r.scalar_one()
        print(f'Verified: {total} cases in DB')


if __name__ == '__main__':
    asyncio.run(main())
