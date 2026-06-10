"""诊断: 模拟后端API查询tcm_herbs表"""
import asyncio
import sys
sys.path.insert(0, r'd:\RMFOOD配方平台\backend')

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
from app.models.external_data import TCMHerb

async def diagnose():
    engine = create_async_engine("postgresql+asyncpg://postgres@localhost:5432/rmfood_platform")
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    
    async with async_session() as db:
        # 1. 基础计数
        try:
            r = await db.execute(select(func.count()).select_from(TCMHerb))
            total = r.scalar()
            print(f"✅ COUNT: {total}")
        except Exception as e:
            print(f"❌ COUNT 失败: {e}")
            return
        
        # 2. 查询全部记录 (模拟dashboard_overview)
        try:
            print("正在查询全部记录...")
            result = await db.execute(select(TCMHerb))
            herbs_db = result.scalars().all()
            print(f"✅ 查询到 {len(herbs_db)} 条记录")
        except Exception as e:
            print(f"❌ 全量查询失败: {type(e).__name__}: {e}")
            
            # 尝试逐条查询找问题记录
            print("\n尝试逐条查询定位问题...")
            try:
                result = await db.execute(select(TCMHerb).limit(10))
                herbs = result.scalars().all()
                print(f"前10条正常: {len(herbs)}")
                
                for i, h in enumerate(herbs):
                    print(f"  [{i+1}] id={h.id} name_cn={h.name_cn} ob={h.ob_percent} dl={h.dl_value} compounds_type={type(h.compounds).__name__}")
                    if h.compounds:
                        cc = len(h.compounds)
                        print(f"       compounds count via len()={cc}")
            except Exception as e2:
                print(f"❌ 前10条也失败: {e2}")
            return
        
        # 3. 遍历处理 (模拟dashboard统计)
        try:
            print("\n开始遍历统计...")
            ob_dist = {"<10":0,"10-30":0,"30-50":0,"50-70":0,">70":0}
            cat_breakdown = {}
            fh_count = 0
            
            for idx, h in enumerate(herbs_db):
                ob = h.ob_percent or 0
                dl = h.dl_value or 0
                cat = h.category or "未分类"
                
                if ob < 10: ob_dist["<10"] += 1
                elif ob < 30: ob_dist["10-30"] += 1
                elif ob < 50: ob_dist["30-50"] += 1
                elif ob < 70: ob_dist["50-70"] += 1
                else: ob_dist[">70"] += 1
                
                cat_breakdown[cat] = cat_breakdown.get(cat, 0) + 1
                
                if h.is_food_homology:
                    fh_count += 1
                
                if (idx + 1) % 100 == 0:
                    print(f"  已处理 {idx+1}/{len(herbs_db)}...")
                
                # 测试 compounds 访问
                if h.compounds:
                    cc = len(h.compounds)
            
            print(f"\n✅ 统计完成!")
            print(f"  OB分布: {ob_dist}")
            print(f"  分类数: {len(cat_breakdown)}")
            print(f"  药食同源: {fh_count}")
            
        except Exception as e:
            print(f"\n❌ 遍历处理失败 at record #{idx}: {type(e).__name__}: {e}")
            print(f"   问题记录: id={h.id} name_cn={h.name_cn}")
            return
    
    await engine.dispose()

asyncio.run(diagnose())
