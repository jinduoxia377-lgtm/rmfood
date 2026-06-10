"""
AI 模拟响应数据（离线/演示模式）

这些响应仅在 AI 服务不可用时使用。生产环境应设置 AI_MOCK_MODE=false。

用法:
    >>> from app.data.mock_ai_responses import get_mock_response
    >>> response = get_mock_response("枸杞子的功效")
"""

import os
from typing import Optional

# 环境变量控制是否启用 Mock 模式
MOCK_MODE_ENABLED = os.getenv("AI_MOCK_MODE", "true").lower() == "true"

# ===== 模拟响应数据 =====

MOCK_HERB = """枸杞子（Lycium barbarum）是药食同源食材，具有以下功效：

**1. 滋补肝肾**：用于肝肾阴虚所致的头晕目眩、视力减退
**2. 益精明目**：富含玉米黄素和叶黄素，保护视力
**3. 免疫调节**：枸杞多糖增强免疫细胞活性
**4. 抗氧化**：富含枸杞多糖和类胡萝卜素，清除自由基

**建议用量**：6-15g/天
**适宜人群**：用眼过度、免疫力低下、中老年人"""

MOCK_FORMULA = """配方设计需要明确目标功效和适用人群，建议从以下步骤开始：

1. **确定功效定位**：抗氧化/免疫增强/肠道健康等
2. **选择君药**：核心功效成分的选择
3. **配伍臣药**：增强君药效果或辅助其他功能
4. **佐使调和**：调节口感、改善吸收

请告诉我您的具体需求，我可以为您提供更详细的建议。"""

MOCK_PAIRS = """黄芪和党参是经典的补气药对：

**协同作用**：
- 黄芪（君）：补气升阳，固表止汗
- 党参（臣）：补中益气，健脾益肺

**现代研究**：
- 黄芪多糖+党参皂苷协同增强免疫功能
- 共同促进能量代谢，改善疲劳

**推荐配比**：黄芪:党参 = 3:2"""

MOCK_DEFAULT = """感谢您的提问。我是RMFOOD AI配方顾问，目前处于离线演示模式。

关于您的问题，建议查阅以下资源：
- **药食同源目录**：国家卫健委公布的110+种药食同源物质
- **TCMSP数据库**：中药材系统药理学数据库
- **DFBP数据库**：食源性生物活性肽数据库

如需获得更精准的AI回答，请在系统设置中配置有效的API Key（支持OpenAI/DeepSeek/智谱等）。"""


# ===== 响应匹配规则 =====

_MOCK_RULES: list[tuple[list[str], str]] = [
    (["枸杞子", "枸杞"], MOCK_HERB),
    (["配方", "设计", "搭配"], MOCK_FORMULA),
    (["黄芪", "党参"], MOCK_PAIRS),
]


def get_mock_response(question: str) -> str:
    """根据问题关键词返回对应的模拟响应

    通过关键词匹配规则查找最相关的模拟响应。
    如果没有匹配项，返回默认响应。

    Args:
        question: 用户输入的问题字符串

    Returns:
        匹配的模拟响应文本
    """
    q = question.lower()
    for keywords, response in _MOCK_RULES:
        if any(k in q for k in keywords):
            return response
    return MOCK_DEFAULT


def is_mock_enabled() -> bool:
    """检查是否启用了 Mock 模式

    通过环境变量 AI_MOCK_MODE 控制：
    - "true"（默认）: 启用 Mock 模式
    - "false": 禁用 Mock 模式

    Returns:
        是否启用 Mock 模式
    """
    return MOCK_MODE_ENABLED
