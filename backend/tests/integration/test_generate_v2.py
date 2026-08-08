"""集成测试 - /generate/v2 API 端点

测试场景:
1. 正常请求（新引擎 + 模板）
2. 降级路径（传统引擎）
3. 异常处理（无效参数）
4. 性能测试（并发请求）
"""

import pytest
import time
import asyncio
from typing import Any, Dict, List
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker

# 导入应用
from app.main import app
from app.api.ai_modules.generation import sub_router, FormulaGenerateV2Request


class TestGenerateV2API:
    """测试 /generate/v2 端点"""

    @pytest.mark.asyncio
    async def test_generate_v2_with_new_engine(self):
        """测试使用新统一引擎生成配方"""
        # 构造请求
        request = FormulaGenerateV2Request(
            target_effects=["补气", "养血"],
            use_new_engine=True,
            template=None,
            n_candidates=10,
            select_top_k=3,
            use_rl_tuning=False,
        )

        # 直接测试业务逻辑（不依赖完整 API）
        from app.services.formula_designer import FormulaDesigner

        designer = FormulaDesigner(knowledge_base={})
        intent = {
            "target_effects": request.target_effects,
            "use_new_engine": request.use_new_engine,
            "template": request.template,
            "n_candidates": request.n_candidates,
            "select_top_k": request.select_top_k,
            "use_rl_tuning": request.use_rl_tuning,
            "constraints": request.constraints or {},
        }

        result = await designer.design(intent, {})

        # 验证返回格式
        assert isinstance(result, dict)
        assert "summary" in result
        assert "data" in result
        assert "scores" in result
        assert "strategy" in result

    @pytest.mark.asyncio
    async def test_generate_v2_with_template(self):
        """测试带模板的配方生成"""
        from app.services.formula_designer import FormulaDesigner

        designer = FormulaDesigner(knowledge_base={})
        intent = {
            "target_effects": ["补气"],
            "use_new_engine": True,
            "template": "四君子汤",
            "n_candidates": 5,
            "select_top_k": 2,
        }

        result = await designer.design(intent, {})

        assert isinstance(result, dict)
        assert "strategy" in result

    @pytest.mark.asyncio
    async def test_generate_v2_traditional_fallback(self):
        """测试降级到传统引擎"""
        from app.services.formula_designer import FormulaDesigner

        designer = FormulaDesigner(knowledge_base={})
        intent = {
            "target_effects": ["补气"],
            "use_new_engine": False,  # 使用传统引擎
        }

        result = await designer.design(intent, {})

        assert isinstance(result, dict)
        assert "data" in result

    @pytest.mark.asyncio
    async def test_generate_v2_empty_effects(self):
        """测试空功效列表的处理"""
        from app.services.formula_designer import FormulaDesigner

        designer = FormulaDesigner(knowledge_base={})
        intent = {
            "target_effects": [],  # 空列表
            "use_new_engine": True,
        }

        result = await designer.design(intent, {})

        # 应该使用默认功效
        assert isinstance(result, dict)

    @pytest.mark.asyncio
    async def test_generate_v2_invalid_template(self):
        """测试无效模板名称的处理"""
        from app.services.formula_designer import FormulaDesigner

        designer = FormulaDesigner(knowledge_base={})
        intent = {
            "target_effects": ["补气"],
            "use_new_engine": True,
            "template": "不存在的模板",
        }

        result = await designer.design(intent, {})

        assert isinstance(result, dict)
        # 模板不存在时应该返回 None
        assert result.get("template_used") is None


class TestGenerateV2Validation:
    """测试请求参数验证"""

    def test_request_model_valid(self):
        """测试有效请求参数"""
        request = FormulaGenerateV2Request(
            target_effects=["补气", "养血"],
            use_new_engine=True,
            n_candidates=10,
            select_top_k=3,
        )
        assert request.target_effects == ["补气", "养血"]
        assert request.n_candidates == 10
        assert request.select_top_k == 3

    def test_request_model_defaults(self):
        """测试默认参数"""
        request = FormulaGenerateV2Request(target_effects=["补气"])
        assert request.use_new_engine is True
        assert request.n_candidates == 10
        assert request.select_top_k == 3
        assert request.use_rl_tuning is False

    def test_request_model_min_effects(self):
        """测试最少功效数量"""
        request = FormulaGenerateV2Request(target_effects=["补气"])
        assert len(request.target_effects) == 1

    def test_request_model_max_effects(self):
        """测试最多功效数量"""
        effects = ["a", "b", "c", "d", "e"]
        request = FormulaGenerateV2Request(target_effects=effects)
        assert len(request.target_effects) == 5


class TestGenerateV2Performance:
    """测试性能指标"""

    @pytest.mark.asyncio
    async def test_generation_speed(self):
        """测试生成速度"""
        from app.services.formula_designer import FormulaDesigner
        from app.services.ai.models import get_data_loader

        # 加载数据
        data_loader = get_data_loader()
        data_loader.load_all()

        designer = FormulaDesigner(knowledge_base={})
        intent = {
            "target_effects": ["补气", "养血"],
            "use_new_engine": True,
            "n_candidates": 5,
            "select_top_k": 2,
        }

        # 计时
        start = time.perf_counter()
        result = await designer.design(intent, {})
        elapsed = (time.perf_counter() - start) * 1000

        # 验证速度（应该在 500ms 以内）
        assert elapsed < 500, f"生成耗时过长: {elapsed:.1f}ms"
        assert isinstance(result, dict)

    @pytest.mark.asyncio
    async def test_concurrent_generation(self):
        """测试并发生成"""
        from app.services.formula_designer import FormulaDesigner

        designer = FormulaDesigner(knowledge_base={})
        intent = {
            "target_effects": ["补气"],
            "use_new_engine": True,
            "n_candidates": 3,
            "select_top_k": 1,
        }

        # 并发 5 个请求
        tasks = [designer.design(intent, {}) for _ in range(5)]
        results = await asyncio.gather(*tasks)

        # 所有请求都应成功
        assert len(results) == 5
        for result in results:
            assert isinstance(result, dict)
            assert "data" in result


class TestGenerateV2ErrorHandling:
    """测试异常处理"""

    @pytest.mark.asyncio
    async def test_engine_error_handling(self):
        """测试引擎错误处理"""
        from app.services.formula_designer import FormulaDesigner

        designer = FormulaDesigner(knowledge_base={})

        # 模拟引擎错误 — _new_engine_design 抛出异常时，异常会向上抛出
        # 因为 design() 没有 try/except 包裹 _new_engine_design 调用
        original = designer._new_engine_design
        async def mock_error(*args, **kwargs):
            raise Exception("Test error")
        designer._new_engine_design = mock_error

        intent = {
            "target_effects": ["补气"],
            "use_new_engine": True,
        }

        with pytest.raises(Exception, match="Test error"):
            await designer.design(intent, {})

        # 恢复原始方法
        designer._new_engine_design = original

    @pytest.mark.asyncio
    async def test_data_loader_error(self):
        """测试数据加载器错误"""
        from app.services.ai.models import get_data_loader

        # 模拟数据加载器错误
        with patch('app.services.ai.models.data_loader.get_data_loader') as mock_loader:
            mock_loader.return_value.load_all.side_effect = Exception("Data load error")

            # 应该能够处理错误
            from app.services.formula_designer import FormulaDesigner
            designer = FormulaDesigner(knowledge_base={})

            intent = {
                "target_effects": ["补气"],
                "use_new_engine": True,
            }

            result = await designer.design(intent, {})
            assert isinstance(result, dict)


class TestGenerateV2ResponseFormat:
    """测试响应格式"""

    @pytest.mark.asyncio
    async def test_response_structure(self):
        """测试响应结构完整性"""
        from app.services.formula_designer import FormulaDesigner

        designer = FormulaDesigner(knowledge_base={})
        intent = {
            "target_effects": ["补气"],
            "use_new_engine": True,
        }

        result = await designer.design(intent, {})

        # 验证必需字段
        assert "summary" in result
        assert "data" in result
        assert "scores" in result

        # 验证 data 格式
        if result.get("data"):
            for item in result["data"]:
                assert "role" in item
                assert "name" in item
                assert "dosage" in item

        # 验证 scores 格式
        if result.get("scores"):
            assert isinstance(result["scores"], dict)


class TestGenerateV2Integration:
    """端到端集成测试"""

    @pytest.mark.asyncio
    async def test_full_pipeline(self):
        """测试完整生成管线"""
        from app.services.ai.models import (
            SignalEncoder,
            PyTorchFormulaGenerator,
            FormulaPredictor,
            TemplateSubsystem,
            FormulaSelector,
        )

        # 1. 信号编码
        encoder = SignalEncoder()
        signal = encoder.encode(["补气", "养血"])
        assert len(signal.raw_vector) == 36

        # 2. 模板选择
        template_subsystem = TemplateSubsystem()
        template = template_subsystem.select_template(["补气"])
        assert template is not None

        # 3. 生成器
        generator = PyTorchFormulaGenerator(
            input_dim=36,
            hidden_dim=32,
            n_layers=2,
            n_herbs=20,
        )
        herb_vocab = ["hq", "ds", "gz", "rs", "dg", "bq", "fp", "gq", "jgh", "cs"]
        import torch
        formulas = generator.generate(
            torch.tensor(signal.raw_vector).unsqueeze(0),
            herb_vocab,
            None,
        )
        assert len(formulas) >= 1

        # 4. 预测器
        predictor = FormulaPredictor()
        pred = predictor.predict(formulas[0], ["补气"])
        assert 0 <= pred.efficacy <= 1
        assert 0 <= pred.safety <= 1

        # 5. 选择器
        selector = FormulaSelector()
        candidates = [{"efficacy_score": pred.efficacy, "safety_score": pred.safety}]
        selected = selector.select(candidates, top_k=1)
        assert len(selected) >= 1

        print("Full pipeline test PASSED")
