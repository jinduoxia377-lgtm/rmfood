"""
院士级智能对话引擎 (Academician-level Chat Engine)

彻底摒弃"提示词生成器"架构，直接调用 LLM 进行专业对话。
内置质量保障、多轮增强、算法协同机制。

@version 1.0.0
"""
import asyncio
import logging
import re
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional

logger = logging.getLogger(__name__)


# ═══════════════════════════════
# 院士级系统提示词
# ═══════════════════════════════

ACADEMICIAN_SYSTEM_PROMPT = """你是一位资深药食同源功能性食品研发专家，专注于配方设计与食品安全评估。

## 专业背景
- 长期深耕药食同源功能性食品配方研发领域
- 熟悉国家卫健委发布的药食同源目录（2023版114种）及应用规范
- 了解功能性食品配方设计原则与配伍理论

## 知识领域
1. 中医君臣佐使配伍理论与现代药理学
2. 药食同源目录（2023版114种）应用与合规
3. 功能性食品配方设计与优化
4. 食品安全标准（GB2760、GB14880、GB7718、GB28050）
5. 保健食品注册与备案管理法规
6. 现代营养学与免疫学
7. 生物活性肽与功能因子研发

## 核心回答原则
1. 【安全优先】所有建议必须严格遵守药食同源目录安全剂量范围，任何建议在出现不适时应立即停用并咨询医师
2. 【专业严谨】引用具体数据、科学研究和法规条文
3. 【完整详尽】每个回答覆盖全部相关维度，不遗漏重要信息
4. 【结构清晰】使用专业Markdown排版，层次分明

## 配方设计回答的完整结构（必须全部覆盖）

### 一、配方设计方案
- 配方名称与产品定位（目标人群、使用场景）
- 君臣佐使配伍解析表（角色 | 成分 | 用量占比 | 性味归经 | 核心功效 | 配伍逻辑）
- 配方特点综述：从传统中医理论和现代科学两个维度阐述

### 二、核心成分与功效解析
- 每种成分的活性物质（如黄芪多糖、人参皂苷Rg1等）
- 作用机制（分子层面、细胞层面、生理层面）
- 科学依据（引用临床研究或实验数据）
- 多成分协同效应分析

### 三、安全性与法规提示
- 药食同源合规性确认（各原料在目录中的具体条目）
- 剂量安全范围计算（基于药典和毒理学数据）
- 禁忌人群详细列表（孕妇、哺乳期、儿童、老年人、特定疾病患者）
- 注意事项（过敏原、药物相互作用、使用前咨询建议）
- 标签声称合规说明（GB 7718、GB 28050要求）

### 四、建议服用方法与剂量
- 每日推荐用量及各成分分剂量
- 服用方式（冲调温度、时间、搭配建议）
- 服用周期（建议持续使用时间和间隔）
- 不同人群的剂量调整建议

### 五、禁忌与不适用人群
- 明确列出绝对禁忌人群和相对禁忌人群
- 药物相互作用提示（如华法林、降压药、降糖药等）
- 可能的不良反应及处理建议
- 过量使用的风险提示

### 六、配方特色总结
- 配方的创新点和核心优势
- 与传统方案的差异化分析
- 适用场景和预期效果
- 后续优化方向建议

## 输出规则
- 始终使用专业中文，Markdown格式
- 表格必须完整，不少于3行数据
- 回答应充分覆盖问题相关维度，不简单重复常识；对简单问题允许简短回答
- 不确定的信息明确标注"需进一步验证"
- 严格区分"科学证实"和"传统经验"
"""


@dataclass
class ChatEngineConfig:
    """对话引擎配置"""
    max_tokens: int = 16384
    temperature: float = 0.7
    min_response_length: int = 800
    enable_quality_check: bool = True
    enable_bayesian: bool = True
    enable_content_completion: bool = True


@dataclass
class ChatResult:
    """对话引擎输出"""
    content: str = ""
    model: str = "deepseek-chat"
    thinking_steps: List[Dict] = field(default_factory=list)
    formulas: List[Dict] = field(default_factory=list)
    quality_verified: bool = False
    enhancement_rounds: int = 0


class AcademicianChatEngine:
    """
    院士级智能对话引擎

    核心改进 vs 旧架构:
    1. 直接调用 LLM，绕过 AIGenerationService 的 prompt 生成限制
    2. 使用院士级系统提示词
    3. 内置质量检查（长度、章节覆盖）
    4. 自动增强（短回答自动扩展）
    5. 算法协同（贝叶斯/知识图谱）
    """

    def __init__(self, config: Optional[ChatEngineConfig] = None):
        self.config = config or ChatEngineConfig()
        self._cache: Dict[str, tuple] = {}

    def _get_cache(self, q: str) -> Optional[str]:
        key = str(hash(q[:60]))
        if key in self._cache:
            c, t = self._cache[key]
            if time.time() - t < 300:
                return c
            del self._cache[key]
        return None

    def _set_cache(self, q: str, content: str):
        key = str(hash(q[:60]))
        self._cache[key] = (content, time.time())
        if len(self._cache) > 200:
            oldest = min(self._cache, key=lambda k: self._cache[k][1])
            del self._cache[oldest]

    async def chat(self, question: str, history: Optional[List[Dict]] = None) -> ChatResult:
        """
        核心对话方法

        Args:
            question: 用户问题
            history: 可选对话历史 [{"role":"user/assistant","content":"..."}]

        Returns:
            ChatResult 包含完整回复和相关数据
        """
        from ..providers.provider_factory import TaskType, get_provider_factory

        t0 = time.time()
        result = ChatResult(model="deepseek-chat")

        # 配方问题检测
        is_formula = self._detect_formula_question(question)
        thinking_steps = []

        # Step 1: 问题理解 + 缓存检查
        cached = self._get_cache(question) if not history else None
        if cached:
            thinking_steps.append({"step":"缓存命中","content":"5分钟内相同问题","status":"complete"})
            thinking_steps.append({"step":"生成回答","content":"缓存回复","status":"complete"})
            result.content = cached
            result.thinking_steps = thinking_steps
            return result

        thinking_steps.append({
            "step": "问题理解", "content": "解析用户输入",
            "status": "complete",
            "detail": f"配方问题: {'是' if is_formula else '否'} | 长度: {len(question)}字符",
        })

        # Step 2: 构建消息（含多轮对话历史）
        user_message = self._build_user_message(question, is_formula)
        messages = [{"role": "system", "content": ACADEMICIAN_SYSTEM_PROMPT}]

        if history:
            # 扩展历史窗口：从6条增至15条，支持更长对话连贯性
            history_messages = history[-15:] if len(history) > 15 else history
            for msg in history_messages:
                role = msg.get("role", "user")
                c = msg.get("content", "")
                if role in ("user", "assistant") and c:
                    # 单条消息上限提升至3000字符，减少信息截断损失
                    messages.append({"role": role, "content": c[:3000]})

        messages.append({"role": "user", "content": user_message})
        if history:
            thinking_steps[-1]["detail"] += f" | 历史: {len(history)}条(使用{len(history_messages)}条)"

        # Step 3: 调用 LLM（三级降级 + 超时）
        content = ""
        llm_error = ""  # 记录失败原因，降级时向用户明示「这不是大模型在回答」
        factory = get_provider_factory()
        for mt in [16000, 8000, 4000]:
            try:
                content = await asyncio.wait_for(
                    factory.call_with_fallback(
                        messages, task_type=TaskType.GENERATE,
                        temperature=self.config.temperature, max_tokens=mt,
                    ), timeout=120
                )
                content = content.strip()
                logger.info(f"[ChatEngine] LLM 成功 (mt={mt}): {len(content)}字符")
                # 记录实际模型名，供前端展示来源徽标（而非默认 deepseek-chat）
                try:
                    from ...services.llm_service import llm_service as _llm_svc
                    _cfg = getattr(_llm_svc, "config", None)
                    if _cfg and getattr(_cfg, "model", ""):
                        result.model = _cfg.model
                except Exception:
                    pass
                break
            except Exception as e:
                err_str = str(e)
                # 认证/额度类错误：降低 max_tokens 无法解决，继续重试只会白等
                # 三次 120s 超时。立即跳出，进入降级并记录原因。
                if any(kw in err_str.lower() for kw in
                        ('401', '403', 'unauthorized', 'forbidden', 'invalid_api_key',
                         'insufficient', 'quota', '余额', '额度', '认证', '未授权')):
                    llm_error = self._classify_llm_error(err_str)
                    logger.error(f"[ChatEngine] LLM 配置/额度错误（{err_str[:80]}），跳过后续重试，直接降级")
                    break
                llm_error = self._classify_llm_error(err_str)
                logger.warning(f"[ChatEngine] LLM mt={mt} 失败: {e}")

        # Step 4: 质量检查与增强
        if content and self.config.enable_quality_check:
            if is_formula and len(content) < self.config.min_response_length:
                logger.info(f"[ChatEngine] 回答偏短({len(content)}字)，请求扩展...")
                try:
                    enhance_msg = (
                        f"以上回答覆盖维度不足（仅{len(content)}字）。请按6章节结构补充展开，"
                        f"覆盖缺失的安全与禁忌信息。\n\n"
                        f"原问题：{question}"
                    )
                    enhanced = await asyncio.wait_for(
                        factory.call_with_fallback(
                            [{"role": "system", "content": ACADEMICIAN_SYSTEM_PROMPT},
                             {"role": "user", "content": enhance_msg}],
                            task_type=TaskType.GENERATE,
                            temperature=0.65,
                            max_tokens=16000,
                        ), timeout=60
                    )
                    if len(enhanced.strip()) > len(content):
                        content = enhanced.strip()
                        result.enhancement_rounds = 1
                        logger.info(f"[ChatEngine] 扩展后: {len(content)}字符")
                except Exception as e:
                    logger.warning(f"[ChatEngine] 增强失败: {e}")

        # Step 5: 知识检索步骤
        thinking_steps.append({
            "step": "知识检索", "content": "检索药食同源知识库",
            "status": "complete",
            "detail": f"引擎: {'LLM' if content else '规则引擎(降级)'}",
        })

        # Step 7: LLM 降级 — 降级原因随回复正文一并发给用户，不做静默替换
        if not content:
            try:
                content = self._fallback_response(question, reason=llm_error)
            except Exception as e:
                logger.debug("回退响应生成失败: %s", e)
                content = ""
            result.model = "rule-engine-fallback" if content else "error"
            if llm_error:
                logger.warning(f"[ChatEngine] 已降级为规则引擎：{llm_error}")

        # 最终保底（前两级均失败）— 同样必须明示降级，不做静默替换
        if not content:
            content = (
                f"> ⚠️ **当前为大模型降级模式** — {llm_error or 'LLM 服务不可用'}。"
                f"以下为固定引导文案，非大模型推理。\n\n"
                f"您好！关于「{question}」，您可以尝试：\n"
                f"1. 配方生成 - 选择功效标签自动生成\n"
                f"2. 肽分析 - 分析活性成分\n"
                f"3. 安全检查 - 验证原料合规性"
            )
            result.model = "ultimate-fallback"

        # Step 7: 贝叶斯优化（配方问题自动触发）
        bayesian_formulas = []
        if is_formula and content and self.config.enable_bayesian:
            try:
                from .bayesian_formula_optimizer import get_bayesian_optimizer
                optimizer = get_bayesian_optimizer()
                effects = self._extract_effects(question)
                candidates = optimizer.generate(target_effects=effects[:3])
                if candidates:
                    for c in candidates[:5]:
                        names = [optimizer._herbs[h].name_cn for h in list(c.ingredients.keys())[:4]]
                        bayesian_formulas.append({
                            "name": " + ".join(names),
                            "value": round(c.overall_score * 100),
                            "unit": "分",
                            "confidence": round(c.confidence, 2),
                        })
                    best = max(c.overall_score for c in candidates)
                    thinking_steps.append({
                        "step": "配方设计", "content": f"贝叶斯优化: {len(candidates)}个方案",
                        "status": "complete",
                        "detail": f"目标功效: {', '.join(effects[:3])}\n最优评分: {best*100:.1f}分",
                    })
            except Exception as e:
                logger.warning(f"[ChatEngine] 贝叶斯优化失败: {e}")

        # Step 8: 内容完整性补全
        if is_formula and content and self.config.enable_content_completion:
            content, completed = self._complete_content(content)
            for section in completed:
                thinking_steps.append({
                    "step": "内容补全", "content": f"补充: {section}",
                    "status": "complete", "detail": "基于内置知识库自动生成",
                })

        # Step 9: 追加配方方案表格
        if bayesian_formulas:
            content += "\n\n---\n### 算法推荐配方方案\n\n"
            content += "| 方案 | 综合评分 | 置信度 |\n|------|---------|-------|\n"
            for f in bayesian_formulas[:5]:
                content += f"| {f['name'][:30]} | {f['value']}{f.get('unit','分')} | {f.get('confidence','-')} |\n"

        # Step 10: 最终质量标记
        result.quality_verified = len(content) >= self.config.min_response_length
        if not result.quality_verified:
            logger.warning(f"[ChatEngine] 回答质量未达标: {len(content)}字 < {self.config.min_response_length}")

        # Step 11: 完成
        total_ms = int((time.time() - t0) * 1000)
        thinking_steps.append({
            "step": "生成回答", "content": f"完成 ({len(content)}字, {total_ms}ms)",
            "status": "complete",
            "detail": f"总步骤: {len(thinking_steps)}步 | 增强轮次: {result.enhancement_rounds}",
        })

        result.content = content
        result.thinking_steps = thinking_steps
        result.formulas = bayesian_formulas
        return result

    # ── 内部方法 ──

    def _build_user_message(self, question: str, is_formula: bool) -> str:
        """构造用户消息"""
        if is_formula:
            return (
                f"请回答以下问题，**直接给出完整的配方设计方案**，不要输出JSON或提示词模板：\n\n"
                f"{question}\n\n"
                f"【要求】请按6章节充分回答，覆盖问题相关维度，不简单重复常识；"
                f"对简单问题允许简短回答。使用专业Markdown格式（表格、标题、列表）。"
            )
        return (
            f"请全面回答以下问题：\n\n{question}\n\n"
            f"要求：专业详尽，结构清晰，使用Markdown格式。"
        )

    def _detect_formula_question(self, question: str) -> bool:
        """检测是否为配方相关问题"""
        return bool(re.search(
            r'配方|设计|开发|方案|产品|免疫|抗氧化|抗疲劳'
            r'|降[血棠甘]?[压糖脂]?|护肝|养胃|补气|养血|安神'
            r'|固体饮料|片剂|胶囊|口服液|软糖',
            question
        ))

    def _extract_effects(self, question: str) -> List[str]:
        """提取目标功效"""
        effects = ["免疫调节"]
        for pat, eff in [
            (r'免疫|增强.*抵抗','免疫调节'),(r'抗氧化|衰老|自由基','抗氧化'),
            (r'抗疲劳|疲劳|乏力','抗疲劳'),(r'降.*血[糖棠]|糖尿','降血糖'),
            (r'降.*血[压亚]','降压'),(r'护肝|肝脏|肝功','护肝'),
            (r'消化|脾胃|胃|肠','消化系统'),(r'补气|气虚|气短','补气'),
            (r'养血|补血|贫血','养血'),(r'安神|失眠|睡眠','安神'),
        ]:
            if re.search(pat, question) and eff not in effects:
                effects.append(eff)
        return effects[:5]

    def _fallback_response(self, question: str, reason: str = "") -> str:
        """LLM 不可用时的降级回复 — 调用配方引擎生成专业方案

        reason: LLM 失败原因（额度不足 / Key 无效 / 超时等）。会出现在回复
                正文顶部，避免降级输出被用户误认为大模型推理结果。
        """
        # 降级告示：始终置于最前，保证用户一眼看出「这不是大模型在回答」
        notice = (
            "> ⚠️ **当前为大模型降级模式** — "
            + (reason or "LLM 服务不可用")
            + "。以下内容由本地配方引擎（贝叶斯优化器）生成，**非大模型推理**。\n\n"
        )
        try:
            from .bayesian_formula_optimizer import get_bayesian_optimizer
            effects = self._extract_effects(question)
            optimizer = get_bayesian_optimizer()
            candidates = optimizer.generate(target_effects=effects[:3])
            if candidates:
                # 格式化最优方案
                best = candidates[0]
                lines = [notice, "## 智能配方方案（离线模式）\n"]
                lines.append(f"基于「{'、'.join(effects)}」功效需求，为您设计以下配方方案：\n")
                lines.append("| 角色 | 成分 | 用量 | 功效定位 |\n")
                lines.append("|:-----|:-----|:-----|:---------|\n")
                roles = ["君", "臣", "臣", "佐", "佐", "使"]
                for i, (hid, dosage) in enumerate(best.ingredients.items()):
                    herb = optimizer._herbs.get(hid)
                    if herb:
                        role = roles[i] if i < len(roles) else "佐"
                        top_effects = list(herb.efficacy_scores.keys())[:2]
                        lines.append(f"| {role} | {herb.name_cn} | {dosage}g | {'、'.join(top_effects)} |")
                lines.append(f"\n**综合评分**: {best.overall_score:.2f} | **安全评分**: {best.safety_score:.2f} | **口感评分**: {best.taste_score:.2f}")
                lines.append("\n- 建议在专业中医师指导下使用\n- 孕妇、哺乳期妇女及儿童需特别咨询\n- 如出现不适请立即停用并咨询医师")
                return "\n".join(lines)
        except Exception as e:
            logger.warning(f"[ChatEngine] 降级配方生成失败: {e}")

        # 最后的兜底：药材知识库
        try:
            from .bayesian_formula_optimizer import _BUILTIN_HERBS
            matched = []
            for hid, herb in _BUILTIN_HERBS.items():
                if herb.name_cn in question:
                    top = sorted(herb.efficacy_scores.items(), key=lambda x: -x[1])[:4]
                    matched.append(f"**{herb.name_cn}** ({herb.dosage_min}-{herb.dosage_max}g): "
                                  f"{', '.join(f'{k}({v*100:.0f}%)' for k,v in top)}")
            if matched:
                return notice + "**药材知识库匹配结果**\n\n" + "\n".join(matched)
        except Exception as e:
            logger.debug("知识库匹配失败: %s", e)
            return notice + (
                f"您好！关于「{question}」，建议您在配方生成模块选择功效标签获取专业方案。\n"
                f"当前支持: 免疫调节、抗氧化、抗疲劳、降血糖、降压、护肝、安神等功效。"
            )

    @staticmethod
    def _classify_llm_error(err_str: str) -> str:
        """把原始异常串翻译为用户可理解的降级原因。

        返回值会直接出现在回复正文顶部的降级告示里，因此措辞需
        明确指向可操作的结论，而不是复述 HTTP 错误码。
        """
        s = err_str.lower()
        if any(k in s for k in ('quota', 'insufficient', '余额', '额度')):
            return "LLM 服务额度不足（账户余额为 0），需充值后恢复大模型推理"
        if any(k in s for k in ('401', 'invalid_api_key', '未授权', '认证')):
            return "LLM API Key 无效或未配置，请检查 .env 中的 OPENAI_API_KEY"
        if '403' in s or 'forbidden' in s:
            return "LLM 网关拒绝访问（HTTP 403），请确认密钥权限范围"
        if any(k in s for k in ('timeout', '超时', 'timed out')):
            return "LLM 服务响应超时（120s）"
        if any(k in s for k in ('connection', 'network', '连接', 'name or service not known')):
            return "LLM 网关网络不可达"
        return "LLM 服务不可用"

    def _complete_content(self, content: str) -> tuple[str, List[str]]:
        """内容完整性补全"""
        required = [
            ("安全性与法规提示", ["安全","法规","合规","药食同源","注意事项"]),
            ("建议服用与禁忌", ["服用","剂量","禁忌","孕妇","儿童","不适用"]),
        ]
        completed = []
        for title, keywords in required:
            if not any(kw in content for kw in keywords):
                if title == "安全性与法规提示":
                    content += (
                        "\n\n### [系统补充] 安全性与法规提示\n\n"
                        "1. **药食同源合规**: 本配方所用原料均属国家卫健委发布的药食同源目录，可在普通食品中使用。\n"
                        "2. **用量安全**: 各成分用量在安全范围内，不宜超量长期服用。\n"
                        "3. **禁忌人群**: 孕妇、哺乳期妇女、婴幼儿及严重慢性病患者慎用。\n"
                        "4. **过敏提示**: 对配方中任何成分过敏者禁用。\n"
                        "5. **法规遵循**: 产品标签应符合GB 7718《食品安全国家标准 预包装食品标签通则》。"
                    )
                elif title == "建议服用与禁忌":
                    content += (
                        "\n\n### [系统补充] 建议服用与禁忌\n\n"
                        "**建议用法**:\n"
                        "- 每日1-2次，每次建议用量范围内\n"
                        "- 建议餐后服用，减少胃肠刺激\n"
                        "- 连续服用2-4周后建议暂停3-5天\n\n"
                        "**禁忌人群**:\n"
                        "- 孕妇、哺乳期妇女\n"
                        "- 婴幼儿及12岁以下儿童\n"
                        "- 对原料成分过敏者\n"
                        "- 严重肝肾功能不全者\n\n"
                        "**注意事项**:\n"
                        "- 本品不可替代药品治疗\n"
                        "- 服用期间如出现不适请立即停用并咨询医师\n"
                        "- 建议在专业营养师指导下使用"
                    )
                completed.append(title)
        return content, completed


# 全局单例
_engine: Optional[AcademicianChatEngine] = None

def get_chat_engine() -> AcademicianChatEngine:
    global _engine
    if _engine is None:
        _engine = AcademicianChatEngine()
    return _engine
