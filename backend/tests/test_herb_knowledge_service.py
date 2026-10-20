"""
测试 HerbKnowledgeService 从数据库加载中药数据
"""
import asyncio
import sys
import pytest

pytestmark = pytest.mark.skip(reason="MultiObjectiveOptimizer 类已随模块迁移/删除，脚本待基于新优化器 API 重写")

sys.path.insert(0, 'd:/RMFOOD配方平台/backend')

from app.core.database.session import get_db
from app.services.ai.algorithms.herb_knowledge_service import HerbKnowledgeService, init_herb_knowledge
from app.services.ai.algorithms.bayesian_formula_optimizer import BayesianFormulaOptimizer


async def test_herb_knowledge_service():
    """测试 HerbKnowledgeService"""
    print("=" * 60)
    print("测试 HerbKnowledgeService")
    print("=" * 60)
    
    async for session in get_db():
        # 创建服务实例
        service = HerbKnowledgeService(session)
        
        # 加载药材数据
        herbs = await service.load_herbs()
        
        print(f"\n1. 从数据库加载药材: {len(herbs)} 种")
        
        # 输出部分药材信息
        if herbs:
            print("\n2. 药材列表:")
            for i, (hid, herb) in enumerate(list(herbs.items())[:10]):
                efficacy_str = ", ".join(list(herb.efficacy_scores.keys())[:3])
                print(f"   {i+1}. {herb.id} - {herb.name} ({efficacy_str})")
        
        # 测试功效索引
        efficacy_map = service.get_efficacy_to_herbs()
        print(f"\n3. 功效类型数量: {len(efficacy_map)}")
        
        # 测试搜索功能
        search_result = service.search_herbs("黄")
        print(f"4. 搜索 '黄' 结果: {len(search_result)} 种")
        
        # 测试按功效查询
        if efficacy_map:
            first_efficacy = list(efficacy_map.keys())[0]
            herbs_by_efficacy = service.get_herbs_by_efficacy(first_efficacy)
            print(f"5. 功效 '{first_efficacy}' 包含 {len(herbs_by_efficacy)} 种药材")
        
        break


async def test_multi_objective_optimizer_with_db():
    """测试多目标优化器使用数据库数据"""
    print("\n" + "=" * 60)
    print("测试 MultiObjectiveOptimizer 使用数据库数据")
    print("=" * 60)
    
    async for session in get_db():
        # 创建药材知识服务
        herb_knowledge = HerbKnowledgeService(session)
        await herb_knowledge.load_herbs()
        
        # 创建优化器并注入药材知识服务
        optimizer = MultiObjectiveOptimizer(herb_knowledge=herb_knowledge)
        
        # 使用异步优化方法
        candidates, history = await optimizer.optimize_async(
            target_effects=["免疫调节", "抗氧化"],
            constraints={"max_ingredients": 6}
        )
        
        print(f"\n优化完成，生成 {len(candidates)} 个候选方案")
        
        if candidates:
            print("\n候选方案示例:")
            for i, candidate in enumerate(candidates[:3]):
                herbs_str = ", ".join([f"{hid}({dosage:.1f}g)" for hid, dosage in candidate.genes.items()])
                print(f"   {i+1}. {herbs_str}")
        
        break


async def test_bayesian_optimizer_with_db():
    """测试贝叶斯优化器使用数据库数据"""
    print("\n" + "=" * 60)
    print("测试 BayesianFormulaOptimizer 使用数据库数据")
    print("=" * 60)
    
    async for session in get_db():
        # 创建药材知识服务
        herb_knowledge = HerbKnowledgeService(session)
        await herb_knowledge.load_herbs()
        
        # 创建优化器并注入药材知识服务
        optimizer = BayesianFormulaOptimizer(herb_knowledge=herb_knowledge)
        
        # 生成配方
        candidates = await optimizer.generate(
            target_effects=["免疫调节", "抗氧化"],
            constraints={"max_cost": 50.0}
        )
        
        print(f"\n优化完成，生成 {len(candidates)} 个候选方案")
        
        if candidates:
            print("\n候选方案示例:")
            for i, candidate in enumerate(candidates[:3]):
                herbs_str = ", ".join([f"{hid}({dosage:.1f}g)" for hid, dosage in candidate.ingredients.items()])
                print(f"   {i+1}. {herbs_str}")
        
        break


async def main():
    """执行所有测试"""
    await test_herb_knowledge_service()
    await test_multi_objective_optimizer_with_db()
    await test_bayesian_optimizer_with_db()
    
    print("\n" + "=" * 60)
    print("所有测试完成！")
    print("=" * 60)


if __name__ == "__main__":
    asyncio.run(main())