"""
意图分析器 — 解析用户问题的意图

从问题中提取：
- 是否需要配方设计
- 目标功效
- 提及的药材
- 产品形态
- 目标人群
- 是否涉及安全/法规
"""
from __future__ import annotations
import re
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from ..knowledge_base import HerbKnowledge

# ── 配方需求关键词 ──
FORMULA_KEYWORDS = [
    "配方", "设计", "组成", "搭配", "组合", "配比", "比例",
    "开发", "产品", "制作", "方子", "组方", "处方",
    "方案", "推荐", "怎么配", "用什么",
]

# ── 功效需求关键词 ──
EFFECT_KEYWORDS = [
    "功效", "作用", "效果", "功能", "好处", "有什么用",
]

# ── 安全/禁忌关键词 ──
SAFETY_KEYWORDS = [
    "安全", "禁忌", "副作用", "毒性", "注意", "能不能",
    "冲突", "相克", "十八反", "十九畏",
]

# ── 对比关键词 ──
COMPARISON_KEYWORDS = [
    "vs", "对比", "区别", "不同", "还是", "哪个",
]

# ── 法规关键词 ──
REGULATORY_KEYWORDS = [
    "法规", "合规", "标准", "GB", "药食同源目录", "备案",
    "标签", "声称", "批准",
]

# ── 功效映射（正则 pattern → 标准化功效名）──
EFFECT_MAP: dict[str, str] = {
    # 免疫/抗疲劳
    "免疫": "免疫调节", "增强.*抵抗": "免疫调节", "抵抗力": "免疫调节",
    "抗疲劳": "抗疲劳", "疲劳": "抗疲劳", "乏力": "抗疲劳", "精神不振": "抗疲劳",
    # 抗氧化/抗衰老
    "抗氧化": "抗氧化", "衰老": "抗衰老", "自由基": "抗氧化", "年轻": "抗衰老",
    # 心血管
    "降血压": "降压", "降压": "降压", "血压高": "降压", "高血压": "降压",
    "降血糖": "降血糖", "降糖": "降血糖", "糖尿病": "降血糖", "血糖高": "降血糖",
    "降血脂": "降脂", "降脂": "降脂", "血脂高": "降脂", "胆固醇": "降脂",
    "心血管": "心血管保护", "护心": "心血管保护", "心脏": "心血管保护",
    "活血": "活血", "化瘀": "活血", "循环": "心血管保护",
    # 消化
    "健脾": "健脾", "脾胃": "消化系统", "养胃": "消化系统", "消化": "消化系统",
    "肠胃": "消化系统", "肠道": "肠道健康", "腹泻": "消化系统", "便秘": "消化系统",
    "祛湿": "利水", "湿气": "利水", "水肿": "利水", "利尿": "利水",
    # 呼吸
    "润肺": "润肺", "咳嗽": "止咳", "化痰": "化痰", "咽喉": "清热解毒",
    "感冒": "清热解毒", "发热": "清热解毒",
    # 神经/精神
    "安神": "安神", "失眠": "助眠", "睡眠": "助眠", "焦虑": "安神",
    "健忘": "认知功能", "记忆力": "认知功能", "脑": "认知功能",
    # 血液
    "补血": "养血", "气血": "养血", "贫血": "养血", "面色": "养血",
    "月经": "调经", "痛经": "调经", "妇科": "调经",
    # 肝肾
    "护肝": "护肝", "肝脏": "护肝", "转氨酶": "护肝",
    "补肾": "补肾", "腰膝": "补肾", "精力": "补肾",
    "明目": "明目", "眼睛": "明目", "视力": "明目", "眼干": "明目",
    # 其他
    "美容": "美容养颜", "养颜": "美容养颜", "皮肤": "美容养颜", "白发": "补肾",
    "关节": "关节健康", "筋骨": "筋骨强健", "疼痛": "止痛",
    "解毒": "清热解毒", "消炎": "抗炎", "抗炎": "抗炎",
}

# ── 产品形态关键词 ──
PRODUCT_FORMS: dict[str, list[str]] = {
    "固体饮料": ["固体饮料", "冲剂", "粉末", "粉剂", "冲泡"],
    "口服液": ["口服液", "饮液", "药水", "精华液"],
    "软糖": ["软糖", "糖果", "胶基"],
    "茶饮": ["茶饮", "代用茶", "花茶", "袋泡茶", "泡茶"],
    "膏方": ["膏方", "膏剂", "膏滋", "秋膏"],
    "片剂": ["片剂", "药片", "压缩"],
    "胶囊": ["胶囊", "硬胶囊", "软胶囊"],
    "酒剂": ["药酒", "浸泡酒", "泡酒"],
}

# ── 目标人群关键词 ──
TARGET_GROUPS: dict[str, list[str]] = {
    "pregnant": ["孕妇", "产妇", "哺乳期"],
    "children": ["儿童", "小孩", "宝宝", "幼儿", "小儿"],
    "elderly": ["老年", "老人", "长辈", "高龄", "退休"],
    "athletes": ["运动", "健身", "运动员", "锻炼", "马拉松"],
    "office_workers": ["办公", "上班", "久坐", "白领", "加班", "电脑"],
    "weight_management": ["减肥", "瘦身", "体重管理", "控脂"],
}

# ── 目标人群中文标签 ──
TARGET_GROUP_LABELS: dict[str, str] = {
    "pregnant": "孕妇", "children": "儿童", "elderly": "老年人",
    "athletes": "运动人群", "office_workers": "办公族", "weight_management": "减脂人群",
}


class IntentAnalyzer:
    """解析用户问题意图"""

    def __init__(self, herb_matcher=None):
        """
        Args:
            herb_matcher: 药材匹配函数 (query: str) -> list[str]
        """
        self._herb_matcher = herb_matcher

    def analyze(self, question: str, mentioned_herbs: list[str] | None = None) -> dict:
        """分析用户问题意图"""
        q = question.lower()

        needs_formula = any(k in q for k in FORMULA_KEYWORDS)
        needs_effect = any(k in q for k in EFFECT_KEYWORDS)
        needs_safety = any(k in q for k in SAFETY_KEYWORDS)
        needs_comparison = any(k in q for k in COMPARISON_KEYWORDS)
        needs_regulatory = any(k in q for k in REGULATORY_KEYWORDS)

        target_effects = self._extract_effects(q)
        product_form = self._detect_product_form(q)
        target_group = self._detect_target_group(q)
        is_peptide = any(k in q for k in ["肽", "多肽", "氨基酸", "sequence"])

        if mentioned_herbs is None and self._herb_matcher:
            mentioned_herbs = self._herb_matcher(question)

        return {
            "question": question,
            "needs_formula": needs_formula,
            "needs_effect": needs_effect,
            "needs_safety": needs_safety,
            "needs_comparison": needs_comparison,
            "needs_regulatory": needs_regulatory,
            "mentioned_herbs": mentioned_herbs or [],
            "target_effects": target_effects,
            "product_form": product_form,
            "target_group": target_group,
            "is_peptide": is_peptide,
            "analysis": self._build_analysis_report(
                needs_formula, target_effects, mentioned_herbs or [],
                product_form, target_group,
            ),
        }

    def _extract_effects(self, query: str) -> list[str]:
        """提取目标功效"""
        effects = []
        for pattern, effect in EFFECT_MAP.items():
            if re.search(pattern, query) and effect not in effects:
                effects.append(effect)
        return effects[:5]

    def _detect_product_form(self, query: str) -> str | None:
        """检测产品形态"""
        for form, keywords in PRODUCT_FORMS.items():
            if any(k in query for k in keywords):
                return form
        return None

    def _detect_target_group(self, query: str) -> str | None:
        """检测目标人群"""
        for group, keywords in TARGET_GROUPS.items():
            if any(k in query for k in keywords):
                return group
        return None

    def _build_analysis_report(
        self, needs_formula: bool, effects: list, herbs: list,
        product_form: str | None, target_group: str | None,
    ) -> str:
        """构建意图分析报告（用于思考步骤显示）"""
        parts = []
        parts.append(f"问题类型：{'配方设计' if needs_formula else '知识问答'}")
        if herbs:
            parts.append(f"识别药材：{', '.join(herbs)}")
        if effects:
            parts.append(f"目标功效：{', '.join(effects)}")
        if product_form:
            parts.append(f"产品形态：{product_form}")
        if target_group:
            label = TARGET_GROUP_LABELS.get(target_group, target_group)
            parts.append(f"目标人群：{label}")
        return " | ".join(parts)
