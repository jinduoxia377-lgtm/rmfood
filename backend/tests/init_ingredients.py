"""初始化成分数据"""
import asyncio
from app.core.session import get_db
from app.models.formula import Ingredient


async def main():
    ingredients_data = [
        {"name": "Astragalus", "name_cn": "黄芪", "category": "补益类", "source": "TCMSP", "is_food_homology": True, "properties": {"moisture": "12.5%", "ash": "3.2%"}},
        {"name": "Angelica", "name_cn": "当归", "category": "活血类", "source": "TCMSP", "is_food_homology": False, "properties": {"moisture": "11.8%", "ash": "2.8%"}},
        {"name": "Codonopsis", "name_cn": "党参", "category": "补益类", "source": "TCMSP", "is_food_homology": True, "properties": {"moisture": "13.2%", "ash": "3.5%"}},
        {"name": "Lycium", "name_cn": "枸杞子", "category": "补益类", "source": "TCMSP", "is_food_homology": True, "properties": {"moisture": "12.0%", "ash": "2.1%"}},
        {"name": "Honeysuckle", "name_cn": "金银花", "category": "清热类", "source": "TCMSP", "is_food_homology": True, "properties": {"moisture": "10.5%", "ash": "3.0%"}},
        {"name": "Forsythia", "name_cn": "连翘", "category": "清热类", "source": "TCMSP", "is_food_homology": False, "properties": {"moisture": "9.8%", "ash": "2.5%"}},
        {"name": "Dandelion", "name_cn": "蒲公英", "category": "清热类", "source": "TCMSP", "is_food_homology": True, "properties": {"moisture": "11.2%", "ash": "4.0%"}},
        {"name": "Atractylodes", "name_cn": "白术", "category": "补益类", "source": "TCMSP", "is_food_homology": False, "properties": {"moisture": "12.0%", "ash": "3.3%"}},
        {"name": "Poria", "name_cn": "茯苓", "category": "利水类", "source": "TCMSP", "is_food_homology": True, "properties": {"moisture": "14.5%", "ash": "2.2%"}},
        {"name": "Dioscorea", "name_cn": "山药", "category": "补益类", "source": "TCMSP", "is_food_homology": True, "properties": {"moisture": "15.0%", "ash": "2.8%"}},
        {"name": "Ginseng", "name_cn": "人参", "category": "补益类", "source": "TCMSP", "is_food_homology": False, "properties": {"moisture": "12.8%", "ash": "2.5%"}},
        {"name": "Ganoderma", "name_cn": "灵芝", "category": "补益类", "source": "TCMSP", "is_food_homology": True, "properties": {"moisture": "13.5%", "ash": "3.0%"}},
        {"name": "Epimedium", "name_cn": "淫羊藿", "category": "补益类", "source": "TCMSP", "is_food_homology": False, "properties": {"moisture": "11.5%", "ash": "2.8%"}},
        {"name": "Rehmannia", "name_cn": "地黄", "category": "补益类", "source": "TCMSP", "is_food_homology": False, "properties": {"moisture": "14.0%", "ash": "3.2%"}},
        {"name": "Salvia", "name_cn": "丹参", "category": "活血类", "source": "TCMSP", "is_food_homology": True, "properties": {"moisture": "12.2%", "ash": "2.9%"}},
    ]
    
    async for session in get_db():
        # 检查是否已有数据
        from sqlalchemy import select
        result = await session.execute(select(Ingredient))
        existing = result.scalars().all()
        
        if len(existing) > 0:
            print(f"数据库中已有 {len(existing)} 条成分数据，跳过初始化")
            break
        
        # 添加新成分
        for data in ingredients_data:
            ingredient = Ingredient(**data)
            session.add(ingredient)
        
        await session.commit()
        print(f"成功添加 {len(ingredients_data)} 条成分数据")
        break


if __name__ == "__main__":
    asyncio.run(main())