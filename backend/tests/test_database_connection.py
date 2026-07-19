"""
数据库连接与查询测试（连接真实PostgreSQL数据库）
用于验证中药成分和多肽成分数据的查询功能
"""
import asyncio
import time
import sys
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

sys.path.insert(0, 'd:/RMFOOD配方平台/backend')

from app.core.config import settings
from app.core.session import engine, get_db
from app.models.models import TCMHerb, BioactivePeptide


async def test_database_connection():
    """测试数据库连接"""
    try:
        async for session in get_db():
            result = await session.execute(select(func.count()).select_from(TCMHerb))
            count = result.scalar()
            print(f"✓ 数据库连接成功，中药材表共有 {count} 条记录")
            break
    except Exception as e:
        print(f"✗ 数据库连接失败: {e}")
        raise


async def test_tcm_herb_query():
    """测试中药材查询"""
    try:
        async for session in get_db():
            # 测试总数查询
            count = (await session.execute(select(func.count()).select_from(TCMHerb))).scalar()
            print(f"✓ 中药材总数: {count}")
            
            # 测试按名称搜索
            start = time.perf_counter()
            result = (await session.execute(
                select(TCMHerb).where(TCMHerb.name_cn.ilike("%人参%"))
            )).scalars().all()
            elapsed = (time.perf_counter() - start) * 1000
            print(f"✓ 按名称搜索 '人参' 结果数: {len(result)}, 耗时: {elapsed:.2f}ms")
            
            # 测试按分类过滤
            result = (await session.execute(
                select(TCMHerb).where(TCMHerb.category == "补气药")
            )).scalars().all()
            print(f"✓ 分类 '补气药' 结果数: {len(result)}")
            
            # 测试药食同源过滤
            result = (await session.execute(
                select(TCMHerb).where(TCMHerb.is_food_homology == True)
            )).scalars().all()
            print(f"✓ 药食同源药材数: {len(result)}")
            
            # 测试分页
            result = (await session.execute(
                select(TCMHerb).order_by(TCMHerb.name_cn).offset(0).limit(10)
            )).scalars().all()
            print(f"✓ 分页查询成功，返回 {len(result)} 条记录")
            break
    except Exception as e:
        print(f"✗ 中药材查询失败: {e}")
        raise


async def test_peptide_query():
    """测试多肽查询"""
    try:
        async for session in get_db():
            # 测试总数查询
            count = (await session.execute(select(func.count()).select_from(BioactivePeptide))).scalar()
            print(f"✓ 多肽总数: {count}")
            
            # 测试按序列搜索
            start = time.perf_counter()
            result = (await session.execute(
                select(BioactivePeptide).where(BioactivePeptide.sequence.ilike("%Gly%"))
            )).scalars().all()
            elapsed = (time.perf_counter() - start) * 1000
            print(f"✓ 按序列搜索 'Gly' 结果数: {len(result)}, 耗时: {elapsed:.2f}ms")
            
            # 测试按活性类型过滤
            result = (await session.execute(
                select(BioactivePeptide).where(BioactivePeptide.activity_type == "ACE inhibitory")
            )).scalars().all()
            print(f"✓ 活性类型 'ACE inhibitory' 结果数: {len(result)}")
            
            # 测试分页
            result = (await session.execute(
                select(BioactivePeptide).order_by(BioactivePeptide.sequence).offset(0).limit(10)
            )).scalars().all()
            print(f"✓ 多肽分页查询成功，返回 {len(result)} 条记录")
            break
    except Exception as e:
        print(f"✗ 多肽查询失败: {e}")
        raise


async def test_performance():
    """测试查询性能"""
    try:
        async for session in get_db():
            # 中药材查询性能
            start = time.perf_counter()
            await session.execute(select(TCMHerb).where(TCMHerb.name_cn.ilike("%当归%")))
            elapsed = (time.perf_counter() - start) * 1000
            status = "✓" if elapsed < 200 else "✗"
            print(f"{status} 中药材查询耗时: {elapsed:.2f}ms (要求: <200ms)")
            
            # 多肽查询性能
            start = time.perf_counter()
            await session.execute(select(BioactivePeptide).limit(20))
            elapsed = (time.perf_counter() - start) * 1000
            status = "✓" if elapsed < 200 else "✗"
            print(f"{status} 多肽查询耗时: {elapsed:.2f}ms (要求: <200ms)")
            break
    except Exception as e:
        print(f"✗ 性能测试失败: {e}")
        raise


async def test_concurrent_queries():
    """测试并发查询（100次）"""
    success_count = 0
    failure_count = 0
    
    async def query_task(query_num: int):
        nonlocal success_count, failure_count
        try:
            async for session in get_db():
                await session.execute(select(func.count()).select_from(TCMHerb))
                success_count += 1
                if query_num % 20 == 0:
                    print(f"  已完成 {query_num} 次查询")
                break
        except Exception as e:
            failure_count += 1
            print(f"  查询 {query_num} 失败: {e}")
    
    try:
        tasks = [query_task(i) for i in range(1, 101)]
        await asyncio.gather(*tasks)
        print(f"✓ 并发查询完成: 成功 {success_count} 次, 失败 {failure_count} 次")
        if failure_count > 0:
            raise Exception(f"并发查询失败率 {failure_count}%")
    except Exception as e:
        print(f"✗ 并发测试失败: {e}")
        raise


async def main():
    """执行所有测试"""
    print("=" * 60)
    print("数据库连接与查询测试")
    print("=" * 60)
    
    print("\n1. 测试数据库连接...")
    await test_database_connection()
    
    print("\n2. 测试中药材查询...")
    await test_tcm_herb_query()
    
    print("\n3. 测试多肽查询...")
    await test_peptide_query()
    
    print("\n4. 测试查询性能...")
    await test_performance()
    
    print("\n5. 测试并发查询...")
    await test_concurrent_queries()
    
    print("\n" + "=" * 60)
    print("所有测试通过！")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())