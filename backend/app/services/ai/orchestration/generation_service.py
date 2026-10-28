"""RMFOOD 智能生成服务

提供AI驱动的提示词/配方智能生成功能：
- 从自然语言描述生成结构化提示词
- 多轮对话引导和迭代优化
- 流式输出支持
- 质量验证和后处理
"""
from __future__ import annotations

import json
import logging
import re
import time
import uuid
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, AsyncIterator, Dict, List, Optional

from ....schemas.ai_schemas import AIGenerateParams, OutputLength
from ..providers.provider_factory import TaskType, get_provider_factory

logger = logging.getLogger(__name__)

PROMPTS_DIR = Path(__file__).parent / "prompts"


@dataclass
class AIGenerationResult:
    """AI生成结果"""
    task_id: str
    generated_content: str
    metadata: Dict[str, Any] = field(default_factory=dict)

    # 性能指标
    tokens_used: int = 0
    latency_ms: float = 0.0
    confidence_score: float = 0.0

    # 质量指标
    is_valid_json: bool = False
    has_few_shot_examples: bool = False
    quality_score: float = 0.0


@dataclass
class GenerationContext:
    """生成上下文"""
    user_id: Optional[str] = None
    project_id: Optional[str] = None
    domain: str = "general"  # formula_design / marketing / customer_service etc.
    expertise_level: str = "intermediate"  # beginner / intermediate / expert
    language: str = "zh-CN"
    additional_context: Dict[str, Any] = field(default_factory=dict)


class AIGenerationService:
    """
    智能生成服务

    核心流程：
    1. 输入预处理 - 提取意图、补充上下文
    2. 构造System Prompt - 加载模板+注入示例
    3. LLM调用 - 支持流式和非流式
    4. 后处理验证 - JSON校验、敏感词过滤、质量检查
    """

    def __init__(self):
        self.provider_factory = get_provider_factory()
        self._system_prompt_cache: Dict[str, str] = {}

    async def generate_prompt_from_description(
        self,
        description: str,
        params: Optional[AIGenerateParams] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> AIGenerationResult:
        """
        从自然语言描述生成结构化提示词

        Args:
            description: 用户的需求描述（至少10字符）
            params: 生成参数（创造性、长度、语气等）
            context: 额外上下文信息

        Returns:
            AIGenerationResult 包含生成结果和元数据
        """
        start_time = time.time()
        task_id = str(uuid.uuid4())

        params = params or AIGenerateParams()
        gen_ctx = GenerationContext(**(context or {}))

        logger.info(f"🚀 开始智能生成 - 任务ID: {task_id}")
        logger.info(f"   描述长度: {len(description)}字符")

        # Step 1: 输入预处理
        processed_input = await self._preprocess_input(description, gen_ctx)

        # Step 2: 构造消息
        messages = await self._build_generation_messages(processed_input, params, gen_ctx)

        # Step 3: 调用LLM生成
        try:
            result_text = await self.provider_factory.call_with_fallback(
                messages,
                task_type=TaskType.GENERATE,
                temperature=params.creativity,
                max_tokens=self._get_max_tokens_for_length(params.length),
            )

            # Step 4: 后处理验证
            validated_result = await self._post_process_and_validate(
                result_text, task_id, start_time
            )

            logger.info(
                f"✅ 智能生成完成 - Token: {validated_result.tokens_used}, "
                f"延迟: {validated_result.latency_ms:.0f}ms, "
                f"质量分: {validated_result.quality_score:.1f}"
            )

            return validated_result

        except Exception as e:
            logger.error(f"❌ 智能生成失败: {e}", exc_info=True)

            # 返回错误结果
            return AIGenerationResult(
                task_id=task_id,
                generated_content="生成失败，请稍后重试",
                latency_ms=(time.time() - start_time) * 1000,
                confidence_score=0.0,
                quality_score=0.0,
            )

    async def stream_generate_from_description(
        self,
        description: str,
        params: Optional[AIGenerateParams] = None,
        context: Optional[Dict[str, Any]] = None,
    ) -> AsyncIterator[Dict[str, Any]]:
        """
        流式生成（SSE格式）

        Yields:
            Dict包含:
            - type: "start" | "token" | "complete" | "error"
            - content: 文本内容或错误信息
            - metadata: 额外元数据
        """
        task_id = str(uuid.uuid4())
        params = params or AIGenerateParams()
        gen_ctx = GenerationContext(**(context or {}))

        # 发送开始事件
        yield {
            "type": "start",
            "task_id": task_id,
            "metadata": {
                "description_length": len(description),
                "params": params.model_dump(),
            }
        }

        try:
            # 预处理
            processed_input = await self._preprocess_input(description, gen_ctx)
            messages = await self._build_generation_messages(processed_input, params, gen_ctx)

            # 流式调用
            full_content = []
            provider = await self.provider_factory.get_provider(TaskType.GENERATE)

            async for chunk in provider.stream_generate(
                messages,
                temperature=params.creativity,
                max_tokens=self._get_max_tokens_for_length(params.length),
            ):
                full_content.append(chunk)
                yield {
                    "type": "token",
                    "content": chunk,
                    "task_id": task_id,
                }

            # 完成事件
            complete_content = "".join(full_content)
            validated = await self._post_process_and_validate(
                complete_content, task_id, 0  # 流式模式下延迟计算不精确
            )

            yield {
                "type": "complete",
                "content": complete_content,
                "task_id": task_id,
                "metadata": {
                    **validated.metadata,
                    "quality_score": validated.quality_score,
                    "is_valid_json": validated.is_valid_json,
                }
            }

        except Exception as e:
            logger.error(f"❌ 流式生成失败: {e}")
            yield {
                "type": "error",
                "content": "生成失败，请稍后重试",
                "task_id": task_id,
            }

    async def refine_generation(
        self,
        generated_prompt: str,
        user_feedback: str,
        conversation_history: List[Dict[str, str]],
        context: Optional[Dict[str, Any]] = None,
    ) -> str:
        """
        基于用户反馈迭代优化生成结果

        Args:
            generated_prompt: 上一次生成的结果
            user_feedback: 用户的反馈意见
            conversation_history: 对话历史
            context: 额外上下文

        Returns:
            优化后的生成结果
        """
        system_prompt = self._load_system_prompt("generate_prompt.txt")

        refinement_instruction = f"""请根据用户的反馈意见，对之前生成的提示词进行改进。

## 用户反馈
{user_feedback}

## 之前的版本
{generated_prompt}

## 对话历史
{json.dumps(conversation_history[-5:], ensure_ascii=False, indent=2) if conversation_history else '无'}

## 要求
- 保持原有结构和核心意图
- 针对性地解决用户提出的问题
- 不要过度修改未提及的部分
- 如果反馈合理，积极采纳并说明改进点
- 输出完整的优化后JSON格式提示词"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": refinement_instruction},
        ]

        try:
            result = await self.provider_factory.call_with_fallback(
                messages,
                task_type=TaskType.GENERATE,
                temperature=0.6,  # 稍低温度以保持稳定性
            )

            logger.info("✅ 迭代优化完成")
            return result

        except Exception as e:
            logger.error(f"❌ 迭代优化失败: {e}")
            raise

    async def _preprocess_input(
        self,
        description: str,
        context: GenerationContext,
    ) -> Dict[str, Any]:
        """
        输入预处理：
        - 提取关键词和意图
        - 补充隐含的上下文
        - 检测是否缺少必要信息
        """
        processed = {
            "original_description": description,
            "cleaned_description": description.strip(),
            "detected_intent": self._detect_intent(description),
            "extracted_keywords": self._extract_keywords(description),
            "domain_hint": context.domain,
            "missing_info": [],
        }

        # 检测缺失信息
        if len(description) < 50:
            processed["missing_info"].append("建议提供更详细的需求描述（当前较简短）")

        if not any(keyword in description.lower() for keyword in
                   ["目标人群", "适用对象", "用户", "场景"]):
            processed["missing_info"].append("未明确目标人群或使用场景")

        logger.info(f"   检测到意图: {processed['detected_intent']}")
        logger.info(f"   提取关键词: {processed['extracted_keywords'][:5]}")

        return processed

    async def _build_generation_messages(
        self,
        processed_input: Dict[str, Any],
        params: AIGenerateParams,
        context: GenerationContext,
    ) -> List[Dict[str, str]]:
        """构造发送给LLM的消息"""
        # 加载System Prompt
        system_prompt = self._load_system_prompt("generate_prompt.txt")

        # 构建User消息
        user_message = f"""## 用户需求描述
{processed_input['cleaned_description']}

## 额外上下文
- 目标领域: {context.domain}
- 专业程度: {context.expertise_level}
- 语言: {context.language}
- 输出长度要求: {params.length.value}
- 语气风格: {params.tone.value}
- 创造性系数: {params.creativity}

## 检测到的意图
- 主要意图: {processed_input['detected_intent']}
- 关键词: {', '.join(processed_input['extracted_keywords'][:10])}

## 缺失信息提示（如有）
{chr(10).join('- ' + info for info in processed_input['missing_info']) if processed_input['missing_info'] else '无明显缺失'}

## 特殊约束
{json.dumps(params.constraints, ensure_ascii=False, indent=2) if params.constraints else '无特殊约束'}

---

请根据以上信息，生成高质量的结构化提示词。"""

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ]

        return messages

    async def _post_process_and_validate(
        self,
        raw_result: str,
        task_id: str,
        start_time: float,
    ) -> AIGenerationResult:
        """后处理和质量验证"""
        cleaned_result = raw_result.strip()

        # 尝试提取JSON
        json_content = self._extract_json_from_response(cleaned_result)
        is_valid_json = json_content is not None

        # 检查Few-shot示例
        has_examples = False
        if json_content:
            examples = json_content.get("examples", [])
            has_examples = len(examples) >= 2

        # 计算质量分数
        quality_score = self._calculate_quality_score(
            cleaned_result, is_valid_json, has_examples
        )

        # 敏感词过滤（简化版）
        filtered_result = self._filter_sensitive_content(cleaned_result)

        latency = (time.time() - start_time) * 1000 if start_time > 0 else 0

        return AIGenerationResult(
            task_id=task_id,
            generated_content=filtered_result,
            tokens_used=len(filtered_result) // 4,  # 粗略估计
            latency_ms=latency,
            confidence_score=min(quality_score / 100, 1.0),
            is_valid_json=is_valid_json,
            has_few_shot_examples=has_examples,
            quality_score=quality_score,
            metadata={
                "original_length": len(raw_result),
                "cleaned_length": len(cleaned_result),
                "json_extracted": is_valid_json,
            },
        )

    def _load_system_prompt(self, filename: str) -> str:
        """加载System Prompt模板（带缓存）"""
        if filename in self._system_prompt_cache:
            return self._system_prompt_cache[filename]

        file_path = PROMPTS_DIR / filename
        if not file_path.exists():
            logger.warning(f"⚠️ System Prompt文件不存在: {filename}")
            return "你是一个有帮助的AI助手。"

        content = file_path.read_text(encoding="utf-8")
        self._system_prompt_cache[filename] = content

        return content

    def _detect_intent(self, text: str) -> str:
        """检测用户意图"""
        text_lower = text.lower()

        intent_patterns = {
            "formula_design": ["配方", "成分", "剂量", "功效", "功能性食品"],
            "marketing": ["营销", "文案", "广告", "推广", "产品描述"],
            "customer_service": ["客服", "回复", "投诉", "售后", "FAQ"],
            "code_review": ["代码", "review", "bug", "技术文档"],
            "writing": ["文章", "报告", "写作", "翻译", "会议纪要"],
            "analysis": ["分析", "调研", "竞品", "数据"],
        }

        for intent, keywords in intent_patterns.items():
            if any(kw in text_lower for kw in keywords):
                return intent

        return "general"

    def _extract_keywords(self, text: str) -> List[str]:
        """提取关键词（简单实现）"""
        import jieba
        words = jieba.cut(text)

        stop_words = {'的', '是', '在', '我', '有', '和', '就', '不', '人', '都',
                     '一', '一个', '上', '也', '很', '到', '说', '要', '去', '你',
                     '会', '着', '没有', '看', '好', '自己', '这'}

        keywords = [w.strip() for w in words
                   if len(w.strip()) >= 2 and w.strip() not in stop_words]

        return keywords[:15]

    def _get_max_tokens_for_length(self, length: OutputLength) -> int:
        """根据输出长度设置返回最大Token数"""
        mapping = {
            OutputLength.SHORT: 4000,
            OutputLength.MEDIUM: 8000,
            OutputLength.DETAIL: 16000,
        }
        return mapping.get(length, 2048)

    def _extract_json_from_response(self, text: str) -> Optional[Dict]:
        """从响应中提取JSON"""
        # 尝试直接解析
        try:
            return json.loads(text)
        except json.JSONDecodeError:
            pass

        # 尝试从markdown代码块中提取
        patterns = [
            r'```json\s*(.*?)\s*```',
            r'```\s*(.*?)\s*```',
            r'(\{.*\})',
        ]

        for pattern in patterns:
            match = re.search(pattern, text, re.DOTALL)
            if match:
                try:
                    return json.loads(match.group(1).strip())
                except json.JSONDecodeError:
                    continue

        return None

    def _calculate_quality_score(
        self,
        text: str,
        is_valid_json: bool,
        has_examples: bool,
    ) -> float:
        """计算质量分数（0-100）"""
        score = 50.0  # 基础分

        # JSON格式 (+20)
        if is_valid_json:
            score += 20

        # Few-shot示例 (+15)
        if has_examples:
            score += 15

        # 长度适中 (+10)
        if 200 <= len(text) <= 2000:
            score += 10
        elif 100 <= len(text) <= 3000:
            score += 5

        # 结构完整性 (+5)
        required_sections = ['role', 'task', 'constraints', 'examples']
        found_sections = sum(1 for s in required_sections if s in text.lower())
        score += (found_sections / len(required_sections)) * 5

        return min(score, 100.0)

    def _filter_sensitive_content(self, text: str) -> str:
        """敏感词过滤（简化版）"""
        sensitive_patterns = [
            r'密码|password',
            r'API\s*[Kk]ey\s*=\s*\S+',
            r'手机号|1[3-9]\d{9}',
        ]

        for pattern in sensitive_patterns:
            text = re.sub(pattern, '[已过滤]', text, flags=re.IGNORECASE)

        return text


# 全局单例
_generation_service_instance: Optional[AIGenerationService] = None


def get_generation_service() -> AIGenerationService:
    """获取全局生成服务实例"""
    global _generation_service_instance

    if _generation_service_instance is None:
        _generation_service_instance = AIGenerationService()
        logger.info("🎨 全局AIGenerationService已初始化")

    return _generation_service_instance
