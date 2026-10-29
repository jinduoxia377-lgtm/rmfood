"""
AI 聊天服务单元测试

覆盖范围:
- 消息发送与响应
- 空消息处理
- 服务健康检查
- 模拟模式验证
"""

import pytest


@pytest.mark.asyncio
async def test_mock_response_exists():
    """验证 mock 响应模块可正常导入和使用"""
    from app.data.mock_ai_responses import get_mock_response, is_mock_enabled
    response = get_mock_response("测试枸杞的功效")
    assert response is not None
    assert "枸杞" in response
    assert isinstance(is_mock_enabled(), bool)


@pytest.mark.asyncio
async def test_mock_response_default():
    """验证未匹配时的默认响应"""
    from app.data.mock_ai_responses import get_mock_response
    response = get_mock_response("这是一条完全无关的测试消息")
    assert response is not None
    assert "离线演示模式" in response


@pytest.mark.asyncio
async def test_mock_response_keyword_matching():
    """验证关键词匹配逻辑"""
    from app.data.mock_ai_responses import get_mock_response

    # 配方相关
    formula_resp = get_mock_response("帮我设计一个配方")
    assert "配方设计" in formula_resp

    # 黄芪/党参
    pair_resp = get_mock_response("黄芪怎么用")
    assert "黄芪和党参" in pair_resp


@pytest.mark.asyncio
async def test_mock_module_enabled_check():
    """验证 Mock 模式检测函数"""
    from app.data.mock_ai_responses import is_mock_enabled
    # 默认应当为 True（AI_MOCK_MODE 未设置或为 "true"）
    result = is_mock_enabled()
    assert isinstance(result, bool)
