"""RMFOOD 效果预测模型

基于特征工程简化版的效果预测器，
预测提示词在实际使用中的表现效果。
"""
from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any, Dict, List, Tuple


@dataclass
class EffectivenessPrediction:
    """效果预测结果"""
    score: float  # 0-100
    confidence_interval: Tuple[float, float]  # 置信区间
    feature_scores: Dict[str, float] = field(default_factory=dict)
    strengths: List[str] = field(default_factory=list)
    weaknesses: List[str] = field(default_factory=dict)
    improvement_potential: float = 0.0  # 预期提升空间


class EffectivenessPredictor:
    """
    效果预测模型（基于特征工程）

    考虑因素：
    - 长度（optimal range: 200-800字符）
    - Few-shot examples数量（>=2个好，>5个冗余）
    - 约束明确性（是否有measurable criteria）
    - 角色具体性（是否包含职位/行业/技能）
    - 输出格式化程度
    - 语言清晰度

    基于经验和启发式规则的评分模型，
    生产环境应替换为ML模型或A/B测试数据。
    """

    # 特征权重配置
    FEATURE_WEIGHTS = {
        "length_optimal": 15,           # 长度适中
        "role_specificity": 18,         # 角色具体性
        "task_clarity": 17,             # 任务清晰度
        "examples_quality": 15,         # 示例质量
        "constraints_measurable": 12,   # 约束可衡量
        "output_format_structured": 13, # 输出结构化
        "language_clarity": 10,         # 语言清晰度
    }

    # 最优参数范围
    OPTIMAL_RANGES = {
        "length": (200, 1500),
        "examples_count": (2, 4),
        "role_keywords_min": 3,
        "constraints_count": (2, 6),
    }

    def predict(self, prompt_text: str) -> EffectivenessPrediction:
        """
        预测提示词效果

        Args:
            prompt_text: 待预测的提示词

        Returns:
            EffectivenessPrediction 包含分数和详细分析
        """
        # 提取特征
        features = self._extract_features(prompt_text)

        # 计算各项特征得分
        feature_scores = {}
        for feature_name, extractor in [
            ("length_optimal", self._score_length),
            ("role_specificity", self._score_role_specificity),
            ("task_clarity", self._score_task_clarity),
            ("examples_quality", self._score_examples),
            ("constraints_measurable", self._score_constraints),
            ("output_format_structured", self._score_output_format),
            ("language_clarity", self._score_language_clarity),
        ]:
            score = extractor(features)
            feature_scores[feature_name] = score

        # 加权计算总分
        total_score = sum(
            score * self.FEATURE_WEIGHTS.get(name, 10) / 100.0
            for name, score in feature_scores.items()
        )
        total_score = max(0.0, min(100.0, total_score))

        # 计算置信区间（基于特征覆盖度）
        coverage = sum(1 for s in feature_scores.values() if s > 0.5) / len(feature_scores)
        margin = 10.0 * (1 - coverage)  # 覆盖度越低，置信区间越宽
        confidence_interval = (
            max(0, total_score - margin),
            min(100, total_score + margin),
        )

        # 识别优势和劣势
        strengths, weaknesses = self._analyze_strengths_weaknesses(feature_scores)

        # 计算提升潜力
        improvement_potential = 100 - total_score

        return EffectivenessPrediction(
            score=round(total_score, 1),
            confidence_interval=(
                round(confidence_interval[0], 1),
                round(confidence_interval[1], 1),
            ),
            feature_scores={k: round(v, 1) for k, v in feature_scores.items()},
            strengths=strengths,
            weaknesses=weaknesses,
            improvement_potential=round(improvement_potential, 1),
        )

    def _extract_features(self, text: str) -> Dict[str, Any]:
        """提取文本特征"""
        return {
            "text": text,
            "length": len(text),
            "word_count": len(text.split()),
            "sentence_count": len(re.split(r'[。！？.!?\n]', text)),
            "has_json_format": "{" in text and "}" in text,
            "has_markdown": any(marker in text for marker in ['#', '*', '`', '-']),
            "lines": text.count('\n') + 1,
        }

    def _score_length(self, features: Dict[str, Any]) -> float:
        """评分：长度适中"""
        length = features["length"]
        optimal_min, optimal_max = self.OPTIMAL_RANGES["length"]

        if optimal_min <= length <= optimal_max:
            return 1.0
        elif length < optimal_min:
            return max(0, length / optimal_min)
        else:
            penalty = (length - optimal_max) / (optimal_max * 2)
            return max(0, 1 - penalty)

    def _score_role_specificity(self, features: Dict[str, Any]) -> float:
        """评分：角色具体性"""
        text = features["text"].lower()

        score = 0.0

        # 检测职位关键词
        job_titles = ['专家', '工程师', '顾问', '分析师', '设计师', '经理',
                     '博士', '硕士', '教授', '研究员', 'expert', 'engineer']
        found_jobs = sum(1 for j in job_titles if j in text)
        score += min(found_jobs / 2.0, 0.4)

        # 检测年限关键词
        year_patterns = [r'\d+\s*年', r'\d+\s*years?', r'senior', 'junior']
        has_experience = any(re.search(p, text) for p in year_patterns)
        if has_experience:
            score += 0.3

        # 检测行业/领域关键词
        industry_patterns = ['医疗', '金融', '教育', '科技', '互联网', '制造',
                           'medical', 'finance', 'education', 'tech']
        found_industries = sum(1 for i in industry_patterns if i in text)
        score += min(found_industries / 3.0, 0.3)

        return min(score, 1.0)

    def _score_task_clarity(self, features: Dict[str, Any]) -> float:
        """评分：任务清晰度"""
        text = features["text"]

        score = 0.0

        # 检测动作动词
        action_verbs = ['生成', '创建', '分析', '设计', '优化', '撰写', '提取',
                       'generate', 'create', 'analyze', 'design', 'optimize']
        found_actions = sum(1 for v in action_verbs if v in text)
        score += min(found_actions / 3.0, 0.35)

        # 检测量化指标
        quantifiable = [r'\d+\s*(?:个|条|项|种|items?)',
                       r'(?:至少|最多|不超过|between)',
                       r'(?:\d+%|\d+\s*percent)']
        has_quantifiers = any(re.search(p, text) for p in quantifiable)
        if has_quantifiers:
            score += 0.35

        # 检测步骤编号
        steps = len(re.findall(r'(?:步骤|step|\d+[.)])\s*\d*', text))
        score += min(steps / 5.0, 0.30)

        return min(score, 1.0)

    def _score_examples(self, features: Dict[str, Any]) -> float:
        """评分：Few-shot示例质量"""
        text = features["text"]

        # 检测示例关键词
        example_markers = ['示例', '例子', '例如', '比如', '案例',
                          'example', 'instance', 'sample', 'for example']
        has_example_keyword = any(m in text.lower() for m in example_markers)

        if not has_example_keyword:
            return 0.0

        # 检测Input/Output模式
        input_output_pairs = len(re.findall(
            r'(?:输入|input)[:：]\s*.*?(?:输出|output)[:：]',
            text,
            re.IGNORECASE | re.DOTALL
        ))

        # 检测示例数量（粗略估计）
        example_count = input_output_pairs or 1

        optimal_min, optimal_max = self.OPTIMAL_RANGES["examples_count"]

        if optimal_min <= example_count <= optimal_max:
            return 1.0
        elif example_count < optimal_min:
            return example_count / optimal_min
        else:
            return max(0.5, 1 - (example_count - optimal_max) * 0.1)

    def _score_constraints(self, features: Dict[str, Any]) -> float:
        """评分：约束可衡量性"""
        text = features["text"]

        score = 0.0

        # 检测约束关键词
        constraint_markers = ['约束', '限制', '要求', '必须', '不得', '注意',
                            'constraint', 'requirement', 'must', 'should not']
        has_constraint_marker = any(m in text.lower() for m in constraint_markers)

        if not has_constraint_marker:
            return 0.1

        score += 0.3

        # 检测可量化约束
        measurable_patterns = [
            r'\d+\s*(?:字符|字|词|tokens?|words?)',
            r'(?:不超过|至少|最多|少于|多于)',
            r'(?:json|markdown|表格|list|列表)',
        ]
        measurable_count = sum(1 for p in measurable_patterns if re.search(p, text, re.I))
        score += min(measurable_count / 3.0, 0.4)

        # 检测安全/合规相关约束
        safety_patterns = ['安全', '合规', '隐私', '保密', 'GDPR', 'PII',
                         'security', 'privacy', 'compliance']
        has_safety = any(p in text.lower() for p in safety_patterns)
        if has_safety:
            score += 0.3

        return min(score, 1.0)

    def _score_output_format(self, features: Dict[str, Any]) -> float:
        """评分：输出结构化程度"""
        text = features["text"]

        score = 0.0

        # JSON格式
        if features["has_json_format"]:
            score += 0.4
            # 检查是否有schema定义
            if re.search(r'json\s*(?:schema|格式|结构)', text, re.I):
                score += 0.2

        # Markdown格式
        if features["has_markdown"]:
            md_elements = sum(1 for m in ['#', '**', '`', '-', '>'] if m in text)
            score += min(md_elements / 5.0, 0.3)

        # 表格提及
        if '表格' in text or 'table' in text.lower():
            score += 0.1

        return min(score, 1.0)

    def _score_language_clarity(self, features: Dict[str, Any]) -> float:
        """评分：语言清晰度"""
        text = features["text"]

        score = 0.5  # 基础分

        # 惩罚模糊词汇
        vague_words = ['一些', '某些', '适当', '合理', '可能', '大概',
                      'some', 'several', 'appropriate', 'maybe']
        vague_count = sum(1 for w in vague_words if w in text)
        score -= min(vague_count * 0.05, 0.2)

        # 奖励明确词汇
        clear_words = ['必须', '应该', '确保', '验证', '确认', '具体',
                      'must', 'should', 'ensure', 'verify', 'specifically']
        clear_count = sum(1 for w in clear_words if w in text)
        score += min(clear_count * 0.03, 0.3)

        # 惩罚过长句子
        sentences = re.split(r'[。！？.!?\n]', text)
        long_sentences = sum(1 for s in sentences if len(s.strip()) > 100)
        if long_sentences > 0:
            score -= min(long_sentences * 0.02, 0.2)

        # 检查逻辑连接词
        logical_words = ['首先', '其次', '然后', '最后', '因此', '此外',
                        'first', 'second', 'then', 'finally', 'therefore']
        has_logic = any(w in text for w in logical_words)
        if has_logic:
            score += 0.1

        return max(0.0, min(1.0, score))

    def _analyze_strengths_weaknesses(
        self,
        feature_scores: Dict[str, float],
    ) -> Tuple[List[str], List[str]]:
        """识别优势和劣势"""
        strengths = []
        weaknesses = []

        sorted_features = sorted(
            feature_scores.items(),
            key=lambda x: x[1],
            reverse=True
        )

        # Top 3优势
        for name, score in sorted_features[:3]:
            if score >= 0.7:
                label = self._get_feature_label(name)
                strengths.append(f"{label}: {score:.0%}")

        # Bottom 3劣势
        for name, score in sorted_features[-3:]:
            if score < 0.5:
                label = self._get_feature_label(name)
                weaknesses.append(f"{label}: {score:.0%}")

        return strengths, weaknesses

    def _get_feature_label(self, feature_name: str) -> str:
        """获取特征的中文名称"""
        labels = {
            "length_optimal": "长度适中",
            "role_specificity": "角色具体性",
            "task_clarity": "任务清晰度",
            "examples_quality": "示例质量",
            "constraints_measurable": "约束可衡量",
            "output_format_structured": "输出结构化",
            "language_clarity": "语言清晰度",
        }
        return labels.get(feature_name, feature_name)
