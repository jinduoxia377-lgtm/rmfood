"""
智能推理引擎单元测试（M2.2增强）
覆盖：降三高、多肽、功效识别、配方设计
"""
import pytest
from app.services.thinking_engine import thinking_engine


class TestIntentAnalysis:
    """意图分析测试"""

    @pytest.mark.asyncio
    async def test_peptide_intent(self):
        stream = thinking_engine.generate_thinking_stream("设计一款辅助降三高的复合多肽配方")
        steps = []
        async for chunk in stream:
            if chunk["type"] == "thinking":
                steps.append(chunk)
            elif chunk["type"] == "text":
                final = chunk["content"]

        # 检查推理步骤完整
        step_names = [s["step"] for s in steps if s["status"] == "complete"]
        assert "问题理解" in step_names
        assert "知识检索" in step_names
        assert "推理分析" in step_names
        assert "配方设计" in step_names

        # 检查降三高和多肽识别
        intent_step = next(s for s in steps if s["step"] == "问题理解" and s["status"] == "complete")
        assert "降三高" in intent_step["content"]
        assert "活性肽" in intent_step["content"]

        # 检查最终回答包含肽相关内容
        assert "复合多肽" in final
        assert "ACE" in final

    @pytest.mark.asyncio
    async def test_blood_pressure_intent(self):
        stream = thinking_engine.generate_thinking_stream("降血压配方")
        async for chunk in stream:
            if chunk["type"] == "thinking" and chunk["step"] == "问题理解" and chunk["status"] == "complete":
                assert "降压" in chunk["content"]
            elif chunk["type"] == "text":
                assert len(chunk["content"]) > 100

    @pytest.mark.asyncio
    async def test_blood_sugar_intent(self):
        stream = thinking_engine.generate_thinking_stream("降糖配方")
        async for chunk in stream:
            if chunk["type"] == "thinking" and chunk["step"] == "问题理解" and chunk["status"] == "complete":
                assert "降糖" in chunk["content"]
            elif chunk["type"] == "text":
                assert len(chunk["content"]) > 100

    @pytest.mark.asyncio
    async def test_sleep_aid_intent(self):
        stream = thinking_engine.generate_thinking_stream("助眠配方")
        async for chunk in stream:
            if chunk["type"] == "thinking" and chunk["step"] == "问题理解" and chunk["status"] == "complete":
                assert "助眠" in chunk["content"]
            elif chunk["type"] == "text":
                assert len(chunk["content"]) > 100

    @pytest.mark.asyncio
    async def test_beauty_intent(self):
        stream = thinking_engine.generate_thinking_stream("美容养颜配方")
        async for chunk in stream:
            if chunk["type"] == "thinking" and chunk["step"] == "问题理解" and chunk["status"] == "complete":
                assert "美容养颜" in chunk["content"]
            elif chunk["type"] == "text":
                assert len(chunk["content"]) > 100

    @pytest.mark.asyncio
    async def test_knowledge_question(self):
        """非配方问题应走知识问答路径"""
        stream = thinking_engine.generate_thinking_stream("枸杞子的功效是什么")
        async for chunk in stream:
            if chunk["type"] == "text":
                assert "枸杞" in chunk["content"]
                break  # 只检查第一个文本块


class TestKnowledgeBase:
    """知识库测试"""

    @pytest.mark.asyncio
    async def test_knowledge_base_size(self):
        """知识库应有足够药材"""
        assert len(thinking_engine._knowledge_base) >= 10  # 至少10种

    @pytest.mark.asyncio
    async def test_new_herbs_added(self):
        """新增药材"""
        assert "决明子" in thinking_engine._knowledge_base
        assert "丹参" in thinking_engine._knowledge_base

    @pytest.mark.asyncio
    async def test_new_herbs_effects(self):
        """新增药材应有功效数据"""
        jm = thinking_engine._knowledge_base["决明子"]
        assert "降脂降压" in jm["effects"]
        ds = thinking_engine._knowledge_base["丹参"]
        assert "心血管健康" in ds["effects"]


class TestFormulaDesign:
    """配方设计测试"""

    @pytest.mark.asyncio
    async def test_peptide_formula_has_purpose(self):
        """肽类配方应包含作用机制"""
        stream = thinking_engine.generate_thinking_stream("设计降三高多肽配方")
        async for chunk in stream:
            if chunk["type"] == "text":
                assert "ACE抑制" in chunk["content"]
                assert "胆固醇" in chunk["content"]
                break

    @pytest.mark.asyncio
    async def test_multi_effect_formula(self):
        """多功效配方应生成足够长的回答"""
        stream = thinking_engine.generate_thinking_stream("设计一款兼具免疫增强和抗氧化的配方")
        final_text = ""
        async for chunk in stream:
            if chunk["type"] == "text":
                final_text = chunk["content"]
        assert len(final_text) > 200


class TestErrorHandling:
    """错误处理测试"""

    @pytest.mark.asyncio
    async def test_empty_input(self):
        """空输入应返回友好提示"""
        stream = thinking_engine.generate_thinking_stream("")
        async for chunk in stream:
            if chunk["type"] == "text":
                assert len(chunk["content"]) > 50

    @pytest.mark.asyncio
    async def test_very_long_input(self):
        """超长输入不崩溃"""
        long_text = "设计配方" + "测试" * 500
        stream = thinking_engine.generate_thinking_stream(long_text)
        async for chunk in stream:
            if chunk["type"] == "text":
                assert len(chunk["content"]) > 100
                break

    @pytest.mark.asyncio
    async def test_special_characters(self):
        """特殊字符输入不崩溃"""
        stream = thinking_engine.generate_thinking_stream("@#$%^&*()_+配方设计")
        async for chunk in stream:
            if chunk["type"] == "text":
                assert len(chunk["content"]) > 50
                break


class TestStreamOutput:
    """流式输出格式测试"""

    @pytest.mark.asyncio
    async def test_thinking_steps_format(self):
        """思考步骤应有正确格式"""
        stream = thinking_engine.generate_thinking_stream("枸杞子的功效")
        steps = []
        has_text = False
        async for chunk in stream:
            if chunk["type"] == "thinking":
                assert "step" in chunk
                assert "status" in chunk
                assert "content" in chunk
                steps.append(chunk)
            elif chunk["type"] == "text":
                has_text = True
        assert len(steps) >= 3  # 至少3个思考步骤
        assert has_text

    @pytest.mark.asyncio
    async def test_thinking_order(self):
        """思考步骤顺序应合理"""
        stream = thinking_engine.generate_thinking_stream("设计降三高配方")
        order = []
        async for chunk in stream:
            if chunk["type"] == "thinking" and chunk["status"] == "complete":
                order.append(chunk["step"])
        # 问题理解应在推理分析之前
        assert "问题理解" in order
        assert "推理分析" in order
        assert order.index("问题理解") < order.index("推理分析")
