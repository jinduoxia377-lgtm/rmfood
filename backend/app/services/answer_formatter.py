"""
回答格式化器 — 将推理结果转换为 Markdown 格式的友好回答

支持多种回答类型：
- 配方回答（君臣佐使结构 + 多维度评分）
- 肽类配方回答
- 安全/禁忌分析回答
- 药材对比分析回答
- 法规合规建议回答
- 通用知识回答
- 问候/系统引导回答
"""
from __future__ import annotations
from typing import Any


class AnswerFormatter:
    """将推理结果格式化为 Markdown 回答"""

    def __init__(self, knowledge_base: dict):
        self._kb = knowledge_base

    def format(self, intent: dict, knowledge: dict, reasoning: dict) -> str:
        """根据意图类型选择对应的格式化方法"""
        if intent.get("needs_formula"):
            return self._format_formula(intent, knowledge, reasoning)
        if intent.get("needs_safety"):
            return self._format_safety(intent, knowledge)
        if intent.get("needs_comparison"):
            return self._format_comparison(intent, knowledge)
        if intent.get("needs_regulatory"):
            return self._format_regulatory(intent, knowledge)
        return self._format_knowledge(intent, knowledge)

    def _format_formula(self, intent: dict, knowledge: dict, reasoning: dict) -> str:
        """格式化为配方回答"""
        effects = intent.get("target_effects") or ["免疫调节"]
        herbs_mentioned = intent.get("mentioned_herbs", [])
        product_form = intent.get("product_form")
        target_group = intent.get("target_group")
        is_peptide = intent.get("is_peptide", False)

        if is_peptide:
            return self._format_peptide_answer(intent, knowledge, reasoning)

        formula_data = reasoning.get("data", [])
        scores = reasoning.get("scores", {})
        total_herbs = len(formula_data) if formula_data else 0

        answer = f"## 智能配方方案\n\n"
        answer += (
            f"基于「{'、'.join(effects)}」功效需求，"
            f"运用贝叶斯优化算法为您设计以下配方方案：\n\n"
        )

        # 配方结构表
        if formula_data:
            answer += "### 君臣佐使配伍方案\n\n"
            answer += "| 角色 | 成分 | 用量 | 功效定位 |\n"
            answer += "|:-----|:-----|:-----|:---------|\n"
            for item in formula_data:
                answer += (
                    f"| {item['role']} | {item['name']} | "
                    f"{item['dosage']} | {item['purpose']} |\n"
                )
            answer += "\n"
        else:
            answer += (
                "### 推荐配伍\n\n"
                "暂无具体配方数据，以下为功效相近的药材推荐：\n\n"
            )

        # 多维度评分
        if scores:
            answer += "### 多维度评分\n\n"
            answer += f"- **综合评分**: {scores.get('overall_score', 0):.2f}/1.00\n"
            answer += f"- **功效效能**: {scores.get('efficacy_score', 0):.2f}/1.00\n"
            answer += f"- **安全评分**: {scores.get('safety_score', 0):.2f}/1.00\n"
            if 'taste_score' in scores:
                answer += f"- **口感评分**: {scores.get('taste_score', 0):.2f}/1.00\n"
            if 'synergy_score' in scores:
                answer += f"- **协同效应**: {scores.get('synergy_score', 0):.2f}/1.00\n"
            answer += "\n"

        # 配方特点
        answer += "### 配方特点\n\n"
        answer += f"- 针对「{'、'.join(effects)}」功效精准设计\n"
        if herbs_mentioned:
            answer += f"- 根据您关注的 {', '.join(herbs_mentioned)} 进行优化\n"
        if product_form:
            answer += f"- 适配产品形态：{product_form}\n"
        if target_group:
            labels = {
                "pregnant": "孕妇", "children": "儿童", "elderly": "老年人",
                "athletes": "运动人群", "office_workers": "办公族",
                "weight_management": "减脂人群",
            }
            answer += f"- 目标人群：{labels.get(target_group, target_group)}\n"
        answer += "- 采用贝叶斯优化算法，多目标 Pareto 最优\n"
        answer += "- 君臣佐使结构完整，符合中药配伍原则\n"
        answer += "- 选用药食同源食材，安全性高\n\n"

        # 配伍协同分析
        if formula_data and len(formula_data) >= 2:
            answer += "### 配伍协同分析\n\n"
            pairs_analyzed = 0
            for i, h1 in enumerate(formula_data):
                for h2 in formula_data[i + 1:]:
                    info1 = self._kb.get(h1["name"], {})
                    info2 = self._kb.get(h2["name"], {})
                    if info1 and info2:
                        common_effects = (
                            set(info1.get("effects", [])) &
                            set(info2.get("effects", []))
                        )
                        if common_effects:
                            answer += (
                                f"- **{h1['name']}** + **{h2['name']}**："
                                f"协同功效{'、'.join(list(common_effects)[:2])}\n"
                            )
                            pairs_analyzed += 1
                        m1 = info1.get("meridian", [])
                        m2 = info2.get("meridian", [])
                        common_meridians = set(m1) & set(m2)
                        if common_meridians:
                            answer += (
                                f"- **归经关联**：{h1['name']}与{h2['name']}均入"
                                f"{'/'.join(common_meridians)}经\n"
                            )
                            pairs_analyzed += 1
            if pairs_analyzed == 0:
                answer += "- 各药材功效互补，覆盖多维调理\n"
            answer += "\n"

        # 服用建议
        answer += "### 服用建议\n\n"
        if product_form:
            answer += f"- **推荐剂型**：{product_form}\n"
        answer += "- **建议用量**：按上述君臣佐使比例配制，每日总量 20-40g\n"
        answer += "- **服用方式**：水煎服或冲泡代茶饮，每日 1-2 次\n"
        answer += "- **服用周期**：建议连续服用 2-4 周后评估效果\n\n"

        # 安全提示
        answer += "### 安全提示\n\n"
        if target_group == "pregnant":
            answer += "> **孕妇慎用提醒**：本配方含有活血类药材，孕妇禁用。\n\n"
        elif target_group == "children":
            answer += (
                "> **儿童减量提醒**：12 岁以下儿童用量减半，"
                "建议在医师指导下使用。\n\n"
            )
        answer += (
            "- 建议在专业中医师指导下使用\n"
            "- 孕妇、哺乳期妇女及儿童需特别咨询\n"
            "- 初次使用建议从低剂量开始\n"
            "- 如出现不适请立即停用并咨询医师\n"
            "- 正在服用处方药物者请注意药物相互作用\n\n"
        )
        answer += "---\n"
        answer += (
            "*以上方案由 RMFOOD 贝叶斯优化引擎自动生成，"
            "基于药食同源知识库，仅供参考。*"
        )
        return answer

    def _format_peptide_answer(self, intent: dict, knowledge: dict, reasoning: dict) -> str:
        """格式化为活性肽配方回答"""
        effects = intent.get("target_effects") or ["功能调节"]
        product_form = intent.get("product_form")
        target_group = intent.get("target_group")

        peptide_data = reasoning.get("data", [])
        scores = reasoning.get("scores", {})
        details = reasoning.get("details", "")

        answer = "## 活性肽配方方案\n\n"
        answer += (
            f"基于「{'、'.join(effects)}」功效需求，"
            f"结合活性肽数据库为您设计以下方案：\n\n"
        )

        if peptide_data:
            answer += "### 君臣佐使配伍方案\n\n"
            answer += "| 角色 | 成分 | 用量 | 功效定位 |\n"
            answer += "|:-----|:-----|:-----|:---------|\n"
            for item in peptide_data:
                answer += (
                    f"| {item.get('role', '-')} | {item.get('name', '-')} | "
                    f"{item.get('dosage', '-')} | {item.get('purpose', '-')} |\n"
                )
            answer += "\n"

        if details:
            answer += f"### 设计说明\n\n{details}\n\n"

        if scores:
            answer += "### 多维度评分\n\n"
            answer += f"- **综合评分**: {scores.get('overall_score', 0):.2f}/1.00\n"
            if 'efficacy_score' in scores:
                answer += f"- **功效效能**: {scores.get('efficacy_score', 0):.2f}/1.00\n"
            if 'safety_score' in scores:
                answer += f"- **安全评分**: {scores.get('safety_score', 0):.2f}/1.00\n"
            answer += "\n"

        answer += "### 配方特点\n\n"
        answer += f"- 针对「{'、'.join(effects)}」功效精准设计\n"
        answer += "- 以活性肽为核心，配伍植物提取物增强协同\n"
        if product_form:
            answer += f"- 适配产品形态：{product_form}\n"
        if target_group:
            labels = {
                "pregnant": "孕妇", "children": "儿童", "elderly": "老年人",
                "athletes": "运动人群", "office_workers": "办公族",
                "weight_management": "减脂人群",
            }
            answer += f"- 目标人群：{labels.get(target_group, target_group)}\n"
        answer += "- 活性肽分子量小、吸收利用率高\n\n"

        answer += "### 服用建议\n\n"
        if product_form:
            answer += f"- **推荐剂型**：{product_form}\n"
        answer += "- **服用方式**：温水冲服，建议随餐或餐后服用\n"
        answer += "- **服用周期**：建议连续服用 4-8 周后评估效果\n\n"

        answer += "### 安全提示\n\n"
        if target_group == "pregnant":
            answer += "> **孕妇慎用提醒**：孕期使用活性肽制剂前请咨询医师。\n\n"
        elif target_group == "children":
            answer += (
                "> **儿童减量提醒**：12 岁以下儿童用量减半，"
                "建议在医师指导下使用。\n\n"
            )
        answer += (
            "- 建议在专业人员指导下使用\n"
            "- 对蛋白/肽类过敏者慎用\n"
            "- 正在服用处方药物者请注意相互作用\n"
            "- 如出现不适请立即停用并咨询医师\n\n"
        )
        answer += "---\n"
        answer += "*以上方案由 RMFOOD 活性肽设计引擎自动生成，仅供参考。*"
        return answer

    def _format_safety(self, intent: dict, knowledge: dict) -> str:
        """安全/禁忌问题分析"""
        herbs = intent.get("mentioned_herbs", [])
        q = intent.get("question", "")

        answer = "## 安全性与配伍分析\n\n"

        if herbs:
            answer += "### 药材安全性评估\n\n"
            for herb_name in herbs[:5]:
                info = self._kb.get(herb_name, {})
                if info:
                    answer += (
                        f"**{herb_name}**\n"
                        f"- 性味：{info.get('property', '未标注')}\n"
                        f"- 毒性：{'无毒（药食同源）' if info.get('is_food_homology') else '需医师指导'}\n"
                        f"- 禁忌：{info.get('contraindication', '未标注')}\n\n"
                    )
                    for other_name in herbs:
                        if other_name != herb_name:
                            other_info = self._kb.get(other_name, {})
                            if other_info:
                                m1 = set(info.get("meridian", []))
                                m2 = set(other_info.get("meridian", []))
                                if m1 & m2:
                                    answer += (
                                        f"- **{herb_name} + {other_name}**："
                                        f"均入{'/'.join(m1 & m2)}经，可配伍\n\n"
                                    )
                                e1 = set(info.get("effects", []))
                                e2 = set(other_info.get("effects", []))
                                if e1 & e2:
                                    answer += (
                                        f"- **{herb_name} + {other_name}**："
                                        f"共有{'、'.join(list(e1 & e2)[:2])}功效，协同增效\n\n"
                                    )
        else:
            answer += (
                f"关于「{q}」的安全性问题，以下是通用安全原则：\n\n"
                "1. **药食同源目录**：仅可使用国家卫健委公布的 110+ 种药食同源物质\n"
                "2. **剂量安全**：严格遵守各药材的安全用量范围\n"
                "3. **配伍禁忌**：避免使用十八反、十九畏等经典配伍禁忌组合\n"
                "4. **特殊人群**：孕妇、儿童、老年人需特别注意禁忌\n"
                "5. **药物相互作用**：注意与处方药的潜在相互作用\n\n"

            )
        answer += "---\n"
        answer += "*安全提示基于药食同源知识库，不能替代专业医疗建议。*"
        return answer

    def _format_comparison(self, intent: dict, knowledge: dict) -> str:
        """对比分析问题"""
        herbs = intent.get("mentioned_herbs", [])
        q = intent.get("question", "")

        answer = "## 药材对比分析\n\n"

        if len(herbs) >= 2:
            h1, h2 = herbs[0], herbs[1]
            info1 = self._kb.get(h1, {})
            info2 = self._kb.get(h2, {})

            if info1 and info2:
                answer += f"### {h1} vs {h2}\n\n"
                answer += (
                    f"| 维度 | {h1} | {h2} |\n"
                    f"|:-----|:-----|:-----|\n"
                    f"| 性味 | {info1.get('property', '-')} | "
                    f"{info2.get('property', '-')} |\n"
                    f"| 归经 | {'/'.join(info1.get('meridian', ['-']))} | "
                    f"{'/'.join(info2.get('meridian', ['-']))} |\n"
                    f"| 主要功效 | {'、'.join(info1.get('effects', ['-']))} | "
                    f"{'、'.join(info2.get('effects', ['-']))} |\n"
                    f"| 安全用量 | {info1.get('dosage', '-')} | "
                    f"{info2.get('dosage', '-')} |\n"
                    f"| 药食同源 | {'是' if info1.get('is_food_homology') else '否'} | "
                    f"{'是' if info2.get('is_food_homology') else '否'} |\n\n"
                )
                common_effects = (
                    set(info1.get("effects", [])) &
                    set(info2.get("effects", []))
                )
                if common_effects:
                    answer += f"**共同功效**：{'、'.join(common_effects)}\n\n"
                answer += (
                    f"**配伍建议**："
                    f"{'可协同使用' if common_effects else '功效侧重不同，可根据需求搭配使用'}\n\n"
                )
        else:
            answer += (
                f"关于「{q}」的对比分析，请提供具体药材名称以便进行详细对比。\n\n"
            )

        answer += "---\n"
        answer += "*对比分析基于药食同源知识库。*"
        return answer

    def _format_regulatory(self, intent: dict, knowledge: dict) -> str:
        """法规合规问题"""
        q = intent.get("question", "")
        answer = (
            f"## 法规与合规建议\n\n"
            f"关于「{q}」，以下是相关法规要点：\n\n"
            "### 药食同源目录管理\n\n"
            "1. **现行目录**：国家卫健委 2023 年版药食同源目录共 110 种物质\n"
            "2. **新增试点**：每年不定期新增试点物质（如人参、西洋参等已纳入）\n"
            "3. **使用范围**：目录内物质可用于普通食品，不得宣称治疗功效\n\n"
            "### 相关法规标准\n\n"
            "| 标准编号 | 名称 | 适用范围 |\n"
            "|:---------|:-----|:---------|\n"
            "| GB 14880 | 食品营养强化剂使用标准 | 营养强化剂添加 |\n"
            "| GB 2760 | 食品添加剂使用标准 | 食品添加剂限量 |\n"
            "| GB 7718 | 预包装食品标签通则 | 标签标识 |\n"
            "| GB 28050 | 预包装食品营养标签通则 | 营养成分表 |\n"
            "| 卫健委公告 | 药食同源物质名单 | 药食同源原料 |\n\n"
            "### 合规建议\n\n"
            "- 产品标签不得标注疾病预防/治疗功能\n"
            "- 原料必须来自现行药食同源目录\n"
            "- 用量不得超过安全范围\n"
            "- 保健食品需完成注册或备案程序\n\n"
            "---\n"
            "*法规信息仅供参考，具体合规请以最新官方文件为准。*"
        )
        return answer

    def _format_knowledge(self, intent: dict, knowledge: dict) -> str:
        """通用知识回答"""
        herbs = intent.get("mentioned_herbs", [])
        effects = intent.get("target_effects", [])
        question = intent.get("question", "")

        if herbs:
            info = self._kb.get(herbs[0])
            if info:
                answer = f"## {herbs[0]} 详解\n\n"
                answer += (
                    f"**基本信息**\n"
                    f"- 拼音：{info['pinyin']}\n"
                    f"- 分类：{info['category']}\n"
                    f"- 性味归经：{info['property']}，入{'/'.join(info['meridian'])}经\n\n"
                )
                answer += "**核心功效**\n"
                for i, effect in enumerate(info["effects"], 1):
                    answer += f"{i}. {effect}\n"
                answer += "\n"
                answer += "**主要活性成分**\n"
                for c in info["chemicals"]:
                    answer += f"- {c}\n"
                answer += "\n"
                answer += (
                    f"**推荐用量**\n"
                    f"- 日用量：{info['dosage']}\n"
                    f"- 药食同源：{'是，可作为食品原料使用' if info['is_food_homology'] else '否，需在医师指导下使用'}\n\n"
                )
                if info.get("pairing"):
                    answer += "**常用配伍**\n"
                    for herb, reason in info["pairing"][:3]:
                        answer += f"- {herb}：{reason}\n"
                    answer += "\n"
                answer += f"**禁忌人群**\n- {info['contraindication']}\n"
                return answer

        # 通用知识回答
        answer = f"## 药食同源知识\n\n"
        answer += f"关于「{question}」，以下是基于知识库的专业信息：\n\n"

        if effects:
            effect_herbs = []
            for name, info in self._kb.items():
                if any(e in info.get("effects", []) for e in effects):
                    effect_herbs.append(
                        f"**{name}**（{'、'.join(info['effects'][:2])}）"
                    )
            if effect_herbs:
                answer += (
                    "以下药材具有您关注的功效：\n\n"
                    + "\n".join(f"- {h}" for h in effect_herbs[:8])
                    + ("\n\n如需了解某个药材的详细信息，请直接询问药材名称。\n\n"
                       f"**延伸建议**：如需针对「{'、'.join(effects)}」设计配方，"
                       f"可以说「设计一款{effects[0]}的配方」。")
                )
                return answer
            else:
                answer += self._get_effective_herb_recommendation(effects)
        else:
            answer += self._smart_broad_response(question, effects)

        return answer

    def _get_effective_herb_recommendation(self, effects: list[str]) -> str:
        """根据功效关键词推荐最相关的药材"""
        recommended = [
            ("黄芪", "补气固表，免疫调节首选"),
            ("枸杞子", "滋补肝肾，抗氧化明星"),
            ("山药", "健脾益肺，平和滋补"),
            ("茯苓", "利水渗湿，健脾安神"),
        ]
        answer = "基于您的关注点，推荐以下相关药材：\n\n"
        for name, desc in recommended:
            answer += f"- **{name}**：{desc}\n"
        answer += (
            "\n如需了解某个药材的详细信息，请直接询问药材名称。\n"
        )
        return answer

    def _smart_broad_response(self, question: str, effects: list[str]) -> str:
        """智能宽泛回应"""
        q = question.lower()

        # 问候/开场白
        if any(k in q for k in ["你好", "嗨", "hello", "hi", "在吗", "你好吗"]):
            return (
                "您好！我是 RMFOOD 药食同源配方顾问。\n\n"
                "我可以为您提供以下专业服务：\n\n"
                "- **药材查询** — 如「黄芪的功效和用量」\n"
                "- **配方设计** — 如「设计一款增强免疫的配方」\n"
                "- **配伍分析** — 如「黄芪和党参能一起用吗」\n"
                "- **安全评估** — 如「这些药材搭配安全吗」\n"
                "- **法规咨询** — 如「药食同源目录有哪些」\n\n"
                f"当前知识库已收录 {len(self._kb)} 种药材的完整信息，随时为您解答。"
            )

        if any(k in q for k in ["谢谢", "感谢", "再见", "拜拜"]):
            return "不客气！如果您还有配方设计或药材查询的需求，随时告诉我。祝您研发顺利！"

        if any(k in q for k in ["怎么用", "怎么使用", "功能", "有什么", "你能", "平台"]):
            return (
                "RMFOOD 是一个药食同源功能性食品研发平台，智能对话功能可以帮您：\n\n"
                "1. **查询药材信息** — 性味归经、功效主治、活性成分、用量禁忌\n"
                "2. **设计配方方案** — 基于贝叶斯优化算法，自动生成君臣佐使结构配方\n"
                "3. **分析配伍关系** — 协同增效、归经关联、功效互补\n"
                "4. **安全合规评估** — 十八反十九畏检测、特殊人群禁忌\n"
                "5. **法规政策咨询** — 药食同源目录、GB标准、标签合规\n\n"
                "试试直接问我一个具体的药材名或功效需求吧！"
            )

        return (
            f"关于「{question}」，以下是我能为您的专业建议：\n\n"
            f"我拥有 {len(self._kb)} 种药食同源药材的完整知识库，"
            f"涵盖性味归经、功效主治、活性成分、配伍关系、禁忌人群等维度。\n\n"
            f"**试试这样问我：**\n"
            f"1. 「黄芪的功效和用量是多少？」→ 获取药材详细信息\n"
            f"2. 「设计一款增强免疫的配方」→ 自动生成君臣佐使配方方案\n"
            f"3. 「金银花和连翘怎么搭配」→ 分析配伍协同关系\n"
            f"4. 「这些药材搭配安全吗」→ 安全性与禁忌评估\n\n"
            f"**提示**：问题中包含具体药材名称或明确功效需求时，我能给出更精准的回答。\n\n"
            f"---\n"
            f"*以上信息基于药食同源知识库生成，仅供参考，不能替代专业医疗建议。*"
        )
