"""
⚠️ MOCK IMPLEMENTATION - 模拟实现，非真实 AI 模型

当前使用规则匹配和 random.sample() 模拟配方生成。
接入 vLLM 或其他真实 LLM 后替换为真实推理实现。
"""
import logging
import random
from typing import Any

logger = logging.getLogger(__name__)


# 模拟中药材数据库（TCMSP 药食同源子集）
_FOOD_HOMOLOGY_HERBS = {
    "降血压": ["菊花", "山楂", "决明子", "葛根", "杜仲叶", "罗布麻叶"],
    "抗氧化": ["枸杞子", "红枣", "茯苓", "山药", "桑葚", "黑芝麻"],
    "降血糖": ["苦瓜", "桑叶", "玉竹", "黄精", "麦冬", "知母"],
    "补气养阴": ["人参", "西洋参", "太子参", "黄芪", "白术", "甘草"],
    "抗疲劳": ["刺五加", "红景天", "五味子", "巴戟天", "淫羊藿", "肉苁蓉"],
    "改善睡眠": ["酸枣仁", "百合", "龙眼肉", "莲子", "远志", "合欢花"],
    "增强免疫": ["黄芪", "党参", "灵芝", "香菇", "虫草", "银耳"],
}

# 模拟活性肽数据
_MOCK_PEPTIDES = [
    {"sequence": "VLGYT", "source": "乳清蛋白", "activity": "ACE抑制", "ic50": 12.5, "mw": 503.6},
    {"sequence": "LRPFF", "source": "大豆蛋白", "activity": "抗氧化", "ic50": 28.3, "mw": 641.8},
    {"sequence": "YFYP", "source": "鱼肉蛋白", "activity": "DPP-IV抑制", "ic50": 45.2, "mw": 569.6},
    {"sequence": "VLPVPQK", "source": "酪蛋白", "activity": "ACE抑制", "ic50": 8.7, "mw": 773.9},
    {"sequence": "GPTGP", "source": "大米蛋白", "activity": "抗氧化", "ic50": 62.1, "mw": 431.5},
]


class MockFormulaGPTService:
    """AI 配方生成服务（模拟实现）"""

    async def generate_candidates(
        self,
        target_effects: list[str],
        constraints: dict[str, Any] | None = None,
    ) -> list[dict[str, Any]]:
        """
        根据目标功效生成多套候选配方

        当前使用规则匹配模拟，接入 LLM 后替换为真实推理
        """
        constraints = constraints or {}
        max_candidates = constraints.get("max_candidates", 3)
        max_herbs = constraints.get("max_herbs", 6)

        # 收集候选药材
        herb_pool: set[str] = set()
        for effect in target_effects:
            herbs = _FOOD_HOMOLOGY_HERBS.get(effect, [])
            herb_pool.update(herbs)

        # 去除排除项
        exclude = set(constraints.get("exclude_ingredients", []))
        herb_pool -= exclude

        herb_list = list(herb_pool)
        if not herb_list:
            logger.warning(f"未找到匹配 '{target_effects}' 的药材")
            return []

        # 生成多套方案（随机组合）
        candidates = []
        for i in range(min(max_candidates, 3)):
            num_herbs = min(max_herbs, max(3, len(herb_list) - 1))
            selected = random.sample(herb_list, min(num_herbs, len(herb_list)))
            # 选择关联肽
            peptides = random.sample(
                _MOCK_PEPTIDES, min(2, len(_MOCK_PEPTIDES))
            )

            candidates.append({
                "name": f"AI方案-{i + 1}（{'+'.join(target_effects[:2])}）",
                "herbs": [{"name": h, "role": self._assign_role(h)} for h in selected],
                "peptides": peptides,
                "target_effects": target_effects,
                "confidence": round(random.uniform(0.7, 0.95), 2),
            })

        return candidates

    def _assign_role(self, herb_name: str) -> str:
        """为药材分配君臣佐使角色（简化版）"""
        major_herbs = {"人参", "黄芪", "灵芝", "枸杞子", "当归", "党参"}
        if herb_name in major_herbs:
            return "君"
        return random.choice(["臣", "佐", "使"])
