"""检查数据库中的成分数据"""
import asyncio
from sqlalchemy import select
from app.core.session import get_db
from app.models.formula import Ingredient


async def main():
    async for session in get_db():
        result = await session.execute(select(Ingredient))
        ingredients = result.scalars().all()
        print(f"成分数量: {len(ingredients)}")
        
        if len(ingredients) > 0:
            print("\n前5条成分:")
            for ing in ingredients[:5]:
                print(f"ID: {ing.id}, Name: {ing.name}, NameCN: {ing.name_cn}, Category: {ing.category}")
        else:
            print("\n数据库中没有成分数据，需要初始化")
        break


if __name__ == "__main__":
    asyncio.run(main())