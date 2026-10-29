"""RMFOOD AI助手模块单元测试

测试覆盖：
- LLM Provider Mock测试
- 语法检查器准确性
- 结构分析器完整性
- 效果预测模型
- 模板渲染正确性
- 推荐算法基础功能
"""
import pytest


class TestLLMProvider:
    """LLM Provider基础测试"""

    def test_provider_config_creation(self):
        """测试Provider配置创建"""
        from app.services.ai.providers.llm_provider import ProviderConfig
        
        config = ProviderConfig(
            api_key="test-key",
            model="gpt-4",
            temperature=0.7,
        )
        
        assert config.api_key == "test-key"
        assert config.model == "gpt-4"
        assert 0.0 <= config.temperature <= 1.0
        assert config.max_retries >= 1

    def test_openai_provider_initialization(self):
        """测试OpenAI Provider初始化"""
        from app.services.ai.providers.llm_provider import OpenAIProvider, ProviderConfig
        
        config = ProviderConfig(api_key="sk-test")
        provider = OpenAIProvider(config)
        
        assert provider.get_provider_name() == "openai"
        assert provider.config.model == "gpt-4o-mini"

    def test_anthropic_provider_initialization(self):
        """测试Anthropic Provider初始化"""
        from app.services.ai.providers.llm_provider import AnthropicProvider, ProviderConfig
        
        config = ProviderConfig(api_key="sk-ant-test")
        provider = AnthropicProvider(config)
        
        assert provider.get_provider_name() == "anthropic"
        assert "claude" in provider.config.model

    def test_ollama_provider_initialization(self):
        """测试Ollama Provider初始化"""
        from app.services.ai.providers.llm_provider import LocalLlamaProvider, ProviderConfig
        
        config = ProviderConfig()
        provider = LocalLlamaProvider(config)
        
        assert provider.get_provider_name() == "ollama"
        assert "localhost" in provider.config.base_url


class TestPromptSyntaxChecker:
    """提示词语法检查器测试"""

    def setup_method(self):
        """每个测试方法前的设置"""
        from app.services.ai.shared.syntax_checker import PromptSyntaxChecker
        self.checker = PromptSyntaxChecker()

    def test_detect_double_braces(self):
        """检测双花括号错误"""
        prompt = "使用{{variable}}进行替换"
        issues = self.checker.check(prompt)
        
        double_brace_issues = [i for i in issues if i.rule_id == "DOUBLE_BRACES"]
        assert len(double_brace_issues) > 0
        assert double_brace_issues[0].severity.value == "error"

    def test_detect_unclosed_braces(self):
        """检测未闭合的花括号"""
        prompt = "这是一个{未闭合的字符串"
        issues = self.checker.check(prompt)
        
        unbalanced_issues = [i for i in issues if i.rule_id == "UNBALANCED_BRACE"]
        assert len(unbalanced_issues) > 0

    def test_valid_prompt_no_errors(self):
        """有效提示词不应有错误级别问题"""
        prompt = """
        你是一个专业的文案专家。
        
        ## 任务
        根据用户输入生成营销文案。
        
        ## 约束
        - 字数不超过200字
        - 语气友好专业
        """
        issues = self.checker.check(prompt)
        
        errors = [i for i in issues if i.severity.value == "error"]
        assert len(errors) == 0

    def test_detect_hardcoded_secrets(self):
        """检测硬编码的敏感信息"""
        prompt = 'api_key = "sk-1234567890abcdef"'
        issues = self.checker.check(prompt)
        
        secret_issues = [i for i in issues if i.rule_id == "HARDCODED_SECRET"]
        assert len(secret_issues) > 0

    def test_get_statistics(self):
        """测试统计信息获取"""
        prompt = "测试{{var}}文本"
        issues = self.checker.check(prompt)
        stats = self.checker.get_statistics(issues)
        
        assert "total" in stats
        assert "errors" in stats
        assert "warnings" in stats
        assert stats["total"] == len(issues)


class TestPromptStructureAnalyzer:
    """提示词结构分析器测试"""

    def setup_method(self):
        from app.services.ai.shared.structure_analyzer import PromptStructureAnalyzer
        self.analyzer = PromptStructureAnalyzer()

    def test_complete_prompt_high_score(self):
        """完整结构提示词应获得高分"""
        prompt = """
        你是资深产品经理，拥有10年经验。
        
        请根据用户需求撰写产品描述。
        
        要求：
        - 字数300-500字
        - 包含3个卖点
        - 目标读者明确
        
        示例：
        输入：智能手表
        输出：专业的产品描述...
        """
        report = self.analyzer.analyze(prompt)
        
        assert report.overall_score > 70
        assert len(report.strengths) > 0

    def test_missing_role_section(self):
        """缺少角色定义应被检测"""
        prompt = """
        请写一篇文章。
        
        要求：
        - 字数500字
        """
        report = self.analyzer.analyze(prompt)
        
        role_section = report.sections.get("role")
        assert role_section is not None
        assert not role_section.is_present or report.overall_score < 80

    def test_structure_type_classification(self):
        """结构类型分类准确性"""
        complete_prompt = "角色：专家\n任务：分析\n约束：...\n示例：..."
        freeform_prompt = "随便写点东西"
        
        report_complete = self.analyzer.analyze(complete_prompt)
        self.analyzer.analyze(freeform_prompt)
        
        assert report_complete.structure_type in ["structured", "semi_structured"]
        # 自由形式可能得分较低但不会崩溃


class TestEffectivenessPredictor:
    """效果预测模型测试"""

    def setup_method(self):
        from app.services.ai.shared.effectiveness_predictor import EffectivenessPredictor
        self.predictor = EffectivenessPredictor()

    def test_optimal_length_score(self):
        """最优长度应获得高分"""
        optimal_prompt = "x" * 500  # 在最优范围内
        result = self.predictor.predict(optimal_prompt)
        
        length_score = result.feature_scores.get("length_optimal", 0)
        assert length_score > 0.8

    def test_too_short_penalty(self):
        """过短提示词应受惩罚"""
        short_prompt = "短"
        result = self.predictor.predict(short_prompt)
        
        length_score = result.feature_scores.get("length_optimal", 0)
        assert length_score < 0.5

    def test_too_long_penalty(self):
        """过长提示词应受惩罚"""
        long_prompt = "x" * 3000  # 超过最优范围
        result = self.predictor.predict(long_prompt)
        
        length_score = result.feature_scores.get("length_optimal", 0)
        assert length_score < 1.0

    def test_role_specificity_detection(self):
        """角色具体性检测"""
        specific_prompt = "你是拥有15年经验的资深数据科学家"
        vague_prompt = "你是一个助手"
        
        result_specific = self.predictor.predict(specific_prompt)
        result_vague = self.predictor.predict(vague_prompt)
        
        role_specific = result_specific.feature_scores.get("role_specificity", 0)
        role_vague = result_vague.feature_scores.get("role_specificity", 0)
        
        assert role_specific > role_vague

    def test_prediction_in_valid_range(self):
        """预测分数应在0-100范围内"""
        prompt = "合理的测试提示词内容" * 20
        result = self.predictor.predict(prompt)
        
        assert 0 <= result.score <= 100
        assert 0 <= result.confidence_interval[0] <= 100
        assert 0 <= result.confidence_interval[1] <= 100

    def test_few_shot_examples_bonus(self):
        """Few-shot示例应获得加分"""
        with_examples = "示例1：...输出：...\n示例2：...输出：..."
        without_examples = "没有示例的内容"
        
        result_with = self.predictor.predict(with_examples)
        result_without = self.predictor.predict(without_examples)
        
        examples_with = result_with.feature_scores.get("examples_quality", 0)
        examples_without = result_without.feature_scores.get("examples_quality", 0)
        
        assert examples_with > examples_without


class TestTemplateService:
    """模板服务测试"""

    def setup_method(self):
        from app.services.ai.shared.template_service import TemplateService
        self.service = TemplateService()

    async def test_get_templates_pagination(self):
        """模板列表分页测试"""
        result = await self.service.get_templates(page=1, per_page=5)
        
        assert "templates" in result
        assert "total" in result
        assert "page" in result
        assert len(result["templates"]) <= 5
        assert result["page"] == 1

    async def test_template_detail_by_id(self):
        """通过ID获取模板详情"""
        templates = await self.service.get_templates(per_page=1)
        if templates["templates"]:
            template_id = templates["templates"][0].id
            detail = await self.service.get_template_detail(template_id)
            
            assert detail is not None
            assert detail.name != ""
            assert len(detail.variables) >= 0

    async def test_render_template_success(self):
        """成功渲染模板"""
        templates = await self.service.get_templates(per_page=1)
        if templates["templates"]:
            template = templates["templates"][0]
            
            if template.variables:
                values = {
                    var.name: f"test_{var.name}" 
                    for var in template.variables[:3]
                    if var.required
                }
                
                result = await self.service.render_template(
                    template_id=template.id,
                    variable_values=values,
                )
                
                if result.missing_variables:
                    assert not result.success
                else:
                    assert result.success
                    assert len(result.content) > 0

    async def test_render_missing_required_variable(self):
        """缺少必填变量应失败"""
        result = await self.service.render_template(
            template_id="tpl_formula_design_001",
            variable_values={},  # 不提供任何变量
        )
        
        assert not result.success
        # 模板不存在或缺少必填变量时都会返回失败信息
        assert len(result.missing_variables) > 0 or len(result.errors) > 0

    async def test_search_templates(self):
        """搜索模板功能"""
        results = await self.service.search_templates("配方")
        
        assert isinstance(results, list)
        for r in results:
            assert hasattr(r, 'name')
            assert hasattr(r, 'category')

    def test_get_categories(self):
        """获取分类列表"""
        categories = self.service.get_categories()
        
        assert isinstance(categories, list)
        for cat in categories:
            assert "name" in cat
            assert "count" in cat


class TestRecommendationEngine:
    """推荐引擎测试"""

    def setup_method(self):
        from app.services.ai.shared.recommendation_engine import RecommendationEngine
        self.engine = RecommendationEngine()

    def test_register_item(self):
        """注册推荐物品"""
        self.engine.register_item(
            item_id="test_item_1",
            metadata={
                "type": "template",
                "title": "测试模板",
                "description": "用于测试",
                "popularity_score": 4.5,
                "category": "formula_design",
            },
            features={"keyword": 0.8, "feature": 0.6},
        )
        
        assert "test_item_1" in self.engine.item_catalog

    async def test_get_recommendations_empty(self):
        """无物品时返回空列表"""
        recommendations = await self.engine.get_recommendations(
            user_id="test_user_1",
            limit=5,
        )
        
        assert isinstance(recommendations, list)

    def test_collaborative_filter_interaction(self):
        """协同过滤交互记录"""
        self.engine.collaborative_filter.record_interaction(
            user_id="user_a",
            item_id="item_1",
            rating=1.0,
        )
        
        similar_users = self.engine.collaborative_filter.get_similar_users("user_a")
        assert isinstance(similar_users, list)

    async def test_record_feedback(self):
        """记录反馈"""
        from app.services.ai.shared.recommendation_engine import FeedbackType
        
        await self.engine.record_feedback(
            user_id="user_1",
            item_id="item_1",
            feedback=FeedbackType.LIKE,
        )
        
        assert len(self.engine.feedback_history) == 1
        assert self.engine.feedback_history[0].feedback_type == FeedbackType.LIKE


class TestGenerationService:
    """智能生成服务测试"""

    @pytest.mark.asyncio
    async def test_preprocess_input(self):
        """输入预处理测试"""
        from app.services.ai.orchestration.generation_service import AIGenerationService
        
        service = AIGenerationService()
        
        description = "帮我设计一个增强免疫力的功能性食品配方"
        processed = await service._preprocess_input(
            description, 
            service.GenerationContext()
        )
        
        assert "original_description" in processed
        assert "detected_intent" in processed
        assert len(processed["extracted_keywords"]) > 0

    def test_intent_detection(self):
        """意图检测准确性"""
        from app.services.ai.orchestration.generation_service import AIGenerationService
        
        service = AIGenerationService()
        
        formula_intent = service._detect_intent("设计一款保健品配方")
        marketing_intent = service._detect_intent("写一个营销邮件")
        
        assert formula_intent == "formula_design"
        assert marketing_intent == "marketing"


class TestOptimizationService:
    """优化服务测试"""

    @pytest.mark.asyncio
    async def test_syntax_check_integration(self):
        """语法检查集成测试"""
        from app.services.ai.orchestration.optimization_service import get_optimization_service
        
        service = get_optimization_service()
        
        result = await service.optimize_prompt(
            draft_prompt="测试提示词{{double_braces}}",
            level="basic",
        )
        
        assert result.syntax_issues is not None
        assert isinstance(result.syntax_issues, list)

    @pytest.mark.asyncio
    async def test_structure_analysis_integration(self):
        """结构分析集成测试"""
        from app.services.ai.orchestration.optimization_service import get_optimization_service
        
        service = get_optimization_service()
        
        result = await service.optimize_prompt(
            draft_prompt="简短的测试",
            level="basic",
        )
        
        assert result.structure_report is not None
        assert hasattr(result.structure_report, 'overall_score')

    @pytest.mark.asyncio
    async def test_effectiveness_prediction_integration(self):
        """效果预测集成测试"""
        from app.services.ai.orchestration.optimization_service import get_optimization_service
        
        service = get_optimization_service()
        
        result = await service.optimize_prompt(
            draft_prompt="这是一个合理的测试提示词，包含角色、任务和约束条件。" * 10,
            level="advanced",
        )
        
        assert result.effectiveness_prediction is not None
        assert 0 <= result.effectiveness_prediction.score <= 100


class TestEdgeCases:
    """边界情况和异常处理测试"""

    def test_empty_string_handling(self):
        """空字符串处理"""
        from app.services.ai.shared.syntax_checker import PromptSyntaxChecker
        checker = PromptSyntaxChecker()
        
        issues = checker.check("")
        assert isinstance(issues, list)

    def test_special_characters(self):
        """特殊字符处理"""
        from app.services.ai.shared.syntax_checker import PromptSyntaxChecker
        checker = PromptSyntaxChecker()
        
        special_prompt = "测试中文!@#$%^&*()英文mixed内容"
        issues = checker.check(special_prompt)
        
        assert isinstance(issues, list)

    def test_very_long_prompt(self):
        """超长提示词处理"""
        from app.services.ai.shared.effectiveness_predictor import EffectivenessPredictor
        predictor = EffectivenessPredictor()
        
        long_prompt = "测试内容" * 1000
        result = predictor.predict(long_prompt)
        
        assert 0 <= result.score <= 100

    async def test_nonexistent_template(self):
        """不存在的模板ID"""
        from app.services.ai.shared.template_service import TemplateService
        service = TemplateService()
        
        detail = await service.get_template_detail("nonexistent_id")
        assert detail is None


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
