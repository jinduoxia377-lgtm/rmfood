"""
LLM 服务层 - 统一接入多家大语言模型提供商
支持 OpenAI / DeepSeek / 智谱AI / 百度千帆 / 通义千问
通过环境变量配置切换，无需改代码
配置持久化到数据库，重启后自动恢复
"""
from __future__ import annotations

import json
import logging
import httpx
from typing import Any, AsyncIterator
from dataclasses import dataclass, field

from ..core.config import settings

logger = logging.getLogger(__name__)

# ── 数据库持久化 ──
_CONFIG_DB_KEY = "llm_runtime_config"


def _get_encryption_key() -> bytes:
    """从 SECRET_KEY 派生 API Key 加密密钥（32字节）"""
    import hashlib
    raw = settings.secret_key or "rmfood-fallback-key"
    return hashlib.sha256(raw.encode("utf-8")).digest()


def _encrypt_api_key(api_key: str) -> dict:
    """加密 API Key，返回加密字典"""
    if not api_key:
        return ""
    try:
        from ..utils.encryption import EncryptionUtils
        key = _get_encryption_key()
        ciphertext, nonce = EncryptionUtils.encrypt(api_key.encode("utf-8"), key)
        import base64
        return {
            "__encrypted__": True,
            "v": base64.b64encode(ciphertext).decode("ascii"),
            "n": base64.b64encode(nonce).decode("ascii"),
        }
    except Exception as e:
        logger.warning(f"[LLMConfig] API Key 加密失败，明文存储（不安全）: {e}")
        return api_key


def _decrypt_api_key(encrypted_value) -> str:
    """解密 API Key，兼容旧版明文存储"""
    if not encrypted_value:
        return ""
    if isinstance(encrypted_value, dict) and encrypted_value.get("__encrypted__"):
        try:
            from ..utils.encryption import EncryptionUtils
            import base64
            key = _get_encryption_key()
            ciphertext = base64.b64decode(encrypted_value["v"])
            nonce = base64.b64decode(encrypted_value["n"])
            return EncryptionUtils.decrypt(ciphertext, nonce, key).decode("utf-8")
        except Exception as e:
            logger.error(f"[LLMConfig] API Key 解密失败: {e}")
            return ""
    # 兼容旧版明文存储
    return str(encrypted_value)


def save_config_to_db(config: "LLMConfig", user_id: int | None = None) -> bool:
    """将 LLM 配置持久化到数据库（API Key 加密存储）"""
    try:
        from ..core.session import async_session_factory
        from ..models.system import SystemConfig
        import asyncio

        async def _do_save():
            async with async_session_factory() as db:
                result = await db.execute(
                    __import__("sqlalchemy", fromlist=["select"]).select(SystemConfig).where(
                        SystemConfig.config_key == _CONFIG_DB_KEY
                    )
                )
                existing = result.scalar_one_or_none()
                value_dict = {
                    "provider": config.provider,
                    "api_key": _encrypt_api_key(config.api_key),
                    "base_url": config.base_url,
                    "model": config.model,
                    "max_tokens": config.max_tokens,
                    "temperature": config.temperature,
                }
                if existing:
                    existing.config_value = value_dict
                    existing.updated_by = user_id
                else:
                    row = SystemConfig(
                        config_key=_CONFIG_DB_KEY,
                        config_value=value_dict,
                        updated_by=user_id,
                    )
                    db.add(row)
                await db.commit()
                logger.info(f"[LLMConfig] 配置已持久化到数据库 (provider={config.provider}, model={config.model})")

        # 在已有事件循环中创建任务，否则新建
        try:
            loop = asyncio.get_running_loop()
            loop.create_task(_do_save())
        except RuntimeError:
            asyncio.run(_do_save())
        return True
    except Exception as e:
        logger.warning(f"[LLMConfig] 数据库保存失败（非致命）: {e}")
        return False


async def load_config_from_db() -> "LLMConfig | None":
    """从数据库加载 LLM 运行时配置"""
    try:
        from ..core.session import async_session_factory
        from ..models.system import SystemConfig

        async with async_session_factory() as db:
            result = await db.execute(
                __import__("sqlalchemy", fromlist=["select"]).select(SystemConfig).where(
                    SystemConfig.config_key == _CONFIG_DB_KEY
                )
            )
            row = result.scalar_one_or_none()
            if row and row.config_value:
                v = row.config_value
                cfg = LLMConfig(
                    provider=v.get("provider", ""),
                    api_key=_decrypt_api_key(v.get("api_key", "")),
                    base_url=v.get("base_url", ""),
                    model=v.get("model", ""),
                    max_tokens=v.get("max_tokens", 4096),
                    temperature=v.get("temperature", 0.7),
                )
                masked = cfg.api_key[:8] + "..." + cfg.api_key[-4:] if len(cfg.api_key) > 12 else "***"
                logger.info(f"[LLMConfig] 从数据库恢复配置: provider={cfg.provider}, model={cfg.model}, key={masked}")
                return cfg
    except Exception as e:
        logger.warning(f"[LLMConfig] 数据库加载失败: {e}")
    return None


# ── 提供商常量 ──
PROVIDER_OPENAI = "openai"
PROVIDER_DEEPSEEK = "deepseek"
PROVIDER_ZHIPU = "zhipu"
PROVIDER_QWEN = "qwen"
PROVIDER_CUSTOM = "custom"

# 各提供商默认配置
PROVIDER_DEFAULTS: dict[str, dict[str, str]] = {
    PROVIDER_OPENAI: {
        "base_url": "https://api.openai.com/v1",
        "model": "gpt-4o-mini",
    },
    PROVIDER_DEEPSEEK: {
        "base_url": "https://api.deepseek.com/v1",
        "model": "deepseek-chat",
    },
    PROVIDER_ZHIPU: {
        "base_url": "https://open.bigmodel.cn/api/paas/v4",
        "model": "glm-4-flash",
    },
    PROVIDER_QWEN: {
        "base_url": "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "model": "qwen-turbo",
    },
}


@dataclass
class LLMMessage:
    """对话消息"""
    role: str  # "system" | "user" | "assistant"
    content: str


@dataclass
class LLMConfig:
    """LLM 调用配置"""
    provider: str = PROVIDER_OPENAI
    api_key: str = ""
    base_url: str = ""
    model: str = ""
    max_tokens: int = 4096
    temperature: float = 0.7
    top_p: float = 1.0
    timeout: float = 60.0


@dataclass
class LLMResponse:
    """LLM 响应结果"""
    content: str
    model: str = ""
    provider: str = ""
    usage: dict[str, int] = field(default_factory=dict)
    finish_reason: str = ""


class LLMService:
    """
    统一 LLM 服务
    加载优先级: 显式参数 > 数据库持久化 > settings 环境变量
    """

    def __init__(self, config: LLMConfig | None = None):
        if config:
            self.config = config
        else:
            # 优先级: 尝试从数据库恢复 → fallback 到 settings
            db_config = None
            try:
                import asyncio
                try:
                    loop = asyncio.get_running_loop()
                    # 在事件循环中无法同步等待，跳过 DB 加载（由 startup 事件补充）
                except RuntimeError:
                    db_config = asyncio.run(load_config_from_db())
            except Exception:
                pass
            self.config = db_config or self._build_config_from_settings()
        self._client: httpx.AsyncClient | None = None

    def update_config(self, config: LLMConfig, user_id: int | None = None):
        """更新LLM配置并持久化到数据库"""
        self.config = config
        # 关闭旧客户端，使用新配置创建新客户端
        if self._client and not self._client.is_closed:
            import asyncio
            asyncio.create_task(self._client.aclose())
        # 立即创建新客户端，减少首次调用的延迟
        try:
            timeout = getattr(self.config, 'timeout', 60.0)
            self._client = httpx.AsyncClient(timeout=timeout)
        except Exception as e:
            logger.error(f"创建HTTP客户端失败: {e}")
            self._client = None

        # 重置 Provider 工厂单例，确保下次调用使用最新配置
        try:
            from app.services.ai.provider_factory import cleanup_provider_factory
            import asyncio
            asyncio.create_task(cleanup_provider_factory())
        except Exception:
            pass

        # 持久化到数据库（非阻塞）
        save_config_to_db(config, user_id=user_id)

    @staticmethod
    def _build_config_from_settings() -> LLMConfig:
        """从应用配置构建 LLM 配置"""
        provider = getattr(settings, "llm_provider", PROVIDER_OPENAI)
        api_key = settings.openai_api_key or ""
        base_url = settings.openai_base_url or ""

        # 如果环境变量中有 DEEPSEEK_API_KEY 且使用 deepseek provider，自动切换
        import os
        deepseek_api_key = os.environ.get("DEEPSEEK_API_KEY", "")
        if deepseek_api_key and provider == PROVIDER_DEEPSEEK:
            api_key = deepseek_api_key

        # API Key 安全检查：检测明显的占位符或无效值
        placeholder_patterns = [
            "your-api-key-here",
            "your-actual-api-key",
            "change-me",
            "your-key-here",
            "sk-xxxxxxxx",
            "<your-api-key>",
        ]
        is_placeholder = any(
            api_key.lower().strip() == pattern.lower()
            for pattern in placeholder_patterns
        )

        if is_placeholder:
            logger.warning(
                f"⚠️ 检测到 API Key 占位符值！当前值看起来像是示例/占位符。"
                f"请在 .env 文件中配置真实的 API Key，或通过前端界面配置。"
                f"Provider: {provider}"
            )
            api_key = ""  # 清空占位符，避免使用假密钥调用API

        # API Key 格式验证
        if api_key and len(api_key) < 20:
            logger.warning(
                f"⚠️ API Key 长度过短（{len(api_key)}字符），可能无效。"
                f"正常的 DeepSeek/OpenAI API Key 通常为 40-60 字符。"
            )
        elif api_key:
            masked_key = api_key[:8] + "..." + api_key[-4:] if len(api_key) > 12 else "***"
            logger.info(f"✅ API Key 已加载 - Provider: {provider}, Key: {masked_key}")

        # 如果没配置 base_url，使用提供商默认值
        if not base_url and provider in PROVIDER_DEFAULTS:
            base_url = PROVIDER_DEFAULTS[provider]["base_url"]

        # 默认模型
        model = getattr(settings, "llm_model", "")
        if not model and provider in PROVIDER_DEFAULTS:
            model = PROVIDER_DEFAULTS[provider]["model"]
        if not model:
            model = "gpt-4o-mini"

        return LLMConfig(
            provider=provider,
            api_key=api_key,
            base_url=base_url,
            model=model,
            max_tokens=settings.ai_max_tokens,
            temperature=settings.ai_temperature,
        )

    @property
    def is_available(self) -> bool:
        """LLM 服务是否可用（基于运行时配置判断）"""
        try:
            return bool(self.config.api_key)
        except Exception as e:
            logger.error(f"检查LLM服务可用性失败: {e}")
            return False

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=self.config.timeout)
        return self._client

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    def _build_headers(self) -> dict[str, str]:
        headers = {"Content-Type": "application/json"}
        if self.config.api_key:
            # 智谱 API 的 Authorization 格式与其他 OpenAI 兼容 API 不同
            if self.config.provider == PROVIDER_ZHIPU:
                headers["Authorization"] = f"Bearer {self.config.api_key}"
            else:
                headers["Authorization"] = f"Bearer {self.config.api_key}"
        return headers

    def _build_payload(
        self,
        messages: list[LLMMessage],
        stream: bool = False,
        tools: list[dict] | None = None,
        response_format: dict | None = None,
    ) -> dict[str, Any]:
        payload: dict[str, Any] = {
            "model": self.config.model,
            "messages": [{"role": m.role, "content": m.content} for m in messages],
            "max_tokens": self.config.max_tokens,
            "temperature": self.config.temperature,
            "top_p": self.config.top_p,
            "stream": stream,
        }
        if tools:
            payload["tools"] = tools
        if response_format:
            payload["response_format"] = response_format
        return payload

    async def chat(
        self,
        messages: list[LLMMessage],
        tools: list[dict] | None = None,
        response_format: dict | None = None,
    ) -> LLMResponse:
        """
        非流式对话

        Args:
            messages: 对话消息列表
            tools: 函数调用定义（Function Calling）
            response_format: 响应格式约束

        Returns:
            LLMResponse
        """
        if not self.is_available:
            raise RuntimeError("LLM 服务未配置：请在 .env 中设置 OPENAI_API_KEY 或 LLM_PROVIDER + OPENAI_API_KEY")

        url = f"{self.config.base_url}/chat/completions"
        headers = self._build_headers()
        payload = self._build_payload(messages, stream=False, tools=tools, response_format=response_format)

        try:
            resp = await self.client.post(url, headers=headers, json=payload)
            resp.raise_for_status()
        except httpx.HTTPStatusError as e:
            status_code = e.response.status_code
            error_detail = ""

            # 尝试解析错误响应体
            try:
                error_body = e.response.json()
                error_detail = error_body.get("error", {}).get("message", str(error_body))
            except Exception:
                error_detail = e.response.text[:200]

            # 针对不同状态码提供清晰的错误信息
            if status_code == 401:
                logger.error(
                    f"🔑 API 认证失败 (401 Unauthorized)\n"
                    f"   URL: {url}\n"
                    f"   Provider: {self.config.provider}\n"
                    f"   Model: {self.config.model}\n"
                    f"   API Key 长度: {len(self.config.api_key)} 字符\n"
                    f"   错误详情: {error_detail}\n"
                    f"   可能原因:\n"
                    f"     1. API Key 无效或已过期\n"
                    f"     2. API Key 格式错误（应为 sk- 开头）\n"
                    f"     3. 账户余额不足\n"
                    f"     4. IP 地址被限制"
                )
                raise RuntimeError(
                    f"API 认证失败 (401 Unauthorized): {error_detail}。"
                    f"\n请检查：\n"
                    f"1. API Key 是否正确（应在 https://platform.deepseek.com/ 获取有效 Key）\n"
                    f"2. 是否已充值账户余额\n"
                    f"3. 前端配置面板中的 Key 是否完整保存"
                ) from e
            elif status_code == 403:
                logger.error(f"🚫 API 权限被拒绝 (403): {error_detail}")
                raise RuntimeError(f"API 权限被拒绝 (403 Forbidden): {error_detail}. 请检查账户权限和余额") from e
            elif status_code == 429:
                logger.warning(f"⏳ API 请求频率限制 (429): {error_detail}")
                raise RuntimeError(f"API 调用频率过高 (429): {error_detail}. 请稍后重试") from e
            else:
                logger.error(f"❌ LLM API 调用失败 ({status_code}): {error_detail}")
                raise RuntimeError(f"LLM API 调用失败 (HTTP {status_code}): {error_detail}") from e

        data = resp.json()

        choice = data["choices"][0]
        message = choice.get("message", {})
        usage = data.get("usage", {})

        return LLMResponse(
            content=message.get("content", ""),
            model=data.get("model", self.config.model),
            provider=self.config.provider,
            usage={
                "prompt_tokens": usage.get("prompt_tokens", 0),
                "completion_tokens": usage.get("completion_tokens", 0),
                "total_tokens": usage.get("total_tokens", 0),
            },
            finish_reason=choice.get("finish_reason", ""),
        )

    async def chat_stream(
        self,
        messages: list[LLMMessage],
        tools: list[dict] | None = None,
    ) -> AsyncIterator[str]:
        """
        流式对话（SSE）

        Yields:
            每次产出一段文本 chunk
        """
        if not self.is_available:
            raise RuntimeError("LLM 服务未配置")

        url = f"{self.config.base_url}/chat/completions"
        headers = self._build_headers()
        payload = self._build_payload(messages, stream=True, tools=tools)

        logger.info(f"[chat_stream] 开始流式请求: URL={url}, model={payload.get('model')}, msg_count={len(payload.get('messages', []))}, stream={payload.get('stream')}")
        logger.debug(f"[chat_stream] 请求 payload keys: {list(payload.keys())}, headers keys: {list(headers.keys())}")

        try:
            async with self.client.stream("POST", url, headers=headers, json=payload) as resp:
                logger.info(f"[chat_stream] 收到响应: status={resp.status_code}")
                try:
                    resp.raise_for_status()
                except httpx.HTTPStatusError as e:
                    status_code = e.response.status_code
                    error_detail = ""

                    try:
                        error_body = e.response.json()
                        error_detail = error_body.get("error", {}).get("message", str(error_body))
                    except Exception:
                        error_detail = e.response.text[:200] if hasattr(e.response, 'text') else str(e)

                    logger.error(f"[chat_stream] HTTP 状态错误: status={status_code}, detail={error_detail}")

                    if status_code == 401:
                        raise RuntimeError(f"API 认证失败 (401): {error_detail}") from e
                    elif status_code == 429:
                        raise RuntimeError(f"API 频率限制 (429): {error_detail}") from e
                    else:
                        raise RuntimeError(f"流式API调用失败 ({status_code}): {error_detail}") from e

                line_count = 0
                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue
                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        logger.info(f"[chat_stream] 流式响应完成, 共 {line_count} 行")
                        break
                    try:
                        chunk = json.loads(data_str)
                        delta = chunk["choices"][0].get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            line_count += 1
                            yield content
                    except (json.JSONDecodeError, KeyError, IndexError) as parse_err:
                        logger.warning(f"[chat_stream] 流式响应解析失败: {data_str[:100]}, error={parse_err}")
                        continue

        except httpx.TimeoutException as e:
            logger.error(f"[chat_stream] 流式对话超时: {e}")
            raise RuntimeError(f"AI 服务响应超时，请简化问题或稍后重试") from e
        except httpx.ConnectError as e:
            logger.error(f"[chat_stream] 无法连接到 AI 服务: {e}")
            raise RuntimeError(f"无法连接到 AI 服务 ({self.config.base_url})，请检查网络配置") from e

    async def chat_with_json(
        self,
        messages: list[LLMMessage],
    ) -> dict[str, Any]:
        """
        对话并解析 JSON 响应
        自动尝试从 markdown 代码块中提取 JSON
        """
        response_format = {"type": "json_object"}
        result = await self.chat(messages, response_format=response_format)

        text = result.content.strip()
        # 尝试从 markdown 代码块中提取
        if "```json" in text:
            text = text.split("```json", 1)[1].split("```", 1)[0].strip()
        elif "```" in text:
            text = text.split("```", 1)[1].split("```", 1)[0].strip()

        return json.loads(text)


# ── 全局 LLM 实例 ──
llm_service = LLMService()


# ── RMFOOD 专用 Prompt 模板 ──

RMFOOD_SYSTEM_PROMPT = """你是 RMFOOD 配方设计平台的 AI 配方顾问，专精于药食同源功能性食品的研发。

## 你的专业领域
1. **药食同源中药学**：熟悉国家卫健委公布的药食同源目录，理解药材性味归经、功效主治
2. **功能性食品配方**：了解配方设计原则、功效成分配伍、剂量安全范围
3. **活性肽科学**：掌握生物活性肽的分类、来源、功能机制
4. **食品安全法规**：熟悉 GB standards、保健食品注册备案要求

## 配方设计原则
- 君臣佐使配伍，主次分明
- 功效协同，避免拮抗
- 安全优先，严格遵守药食同源目录
- 兼顾口感与稳定性
- 剂量科学合理

## 输出要求
- 基于中医药理论和现代科学证据
- 提供具体用量建议和安全依据
- 标注可能的禁忌和注意事项
- 如不确定，明确说明"""

FORMULA_GENERATION_PROMPT = """请为以下需求设计 {num} 套药食同源功能性食品配方方案。

## 目标功效
{effects}

## 约束条件
{constraints}

## 输出格式（严格 JSON）
```json
{{
  "formulas": [
    {{
      "name": "配方名称",
      "description": "配方概述（50字内）",
      "herbs": [
        {{
          "name": "药材名",
          "role": "君/臣/佐/使",
          "dosage": "建议用量(g)",
          "rationale": "选药理由",
          "food_homology": true
        }}
      ],
      "peptides": [
        {{
          "name": "肽名称",
          "source": "来源蛋白",
          "sequence": "氨基酸序列",
          "activity": "活性类型",
          "dosage": "建议用量(mg)"
        }}
      ],
      "preparation": "制备工艺建议",
      "target_population": "适用人群",
      "contraindications": "禁忌人群",
      "expected_effects": ["预期功效1", "预期功效2"],
      "scores": {{
        "synergy": 0.85,
        "taste": 0.75,
        "stability": 0.80,
        "overall": 0.80
      }}
    }}
  ]
}}
```"""

CHAT_PROMPT_TEMPLATE = """{system_context}

用户提问：{question}

请基于你的专业知识回答。如果涉及具体配方建议，请标注安全风险。如果不确定，请明确说明。"""


# ── 便捷函数 ──

async def generate_formula_with_llm(
    target_effects: list[str],
    constraints: dict[str, Any] | None = None,
    num_formulas: int = 3,
) -> list[dict[str, Any]]:
    """
    使用 LLM 生成配方方案（JSON 模式）

    如果 LLM 不可用，回退到规则引擎
    """
    if not llm_service.is_available:
        logger.info("LLM 不可用，回退到规则引擎")
        return None  # 由调用方回退到 FormulaGPTService

    constraints_text = json.dumps(constraints or {}, ensure_ascii=False, indent=2)
    prompt = FORMULA_GENERATION_PROMPT.format(
        num=num_formulas,
        effects="、".join(target_effects),
        constraints=constraints_text,
    )

    messages = [
        LLMMessage(role="system", content=RMFOOD_SYSTEM_PROMPT),
        LLMMessage(role="user", content=prompt),
    ]

    try:
        result = await llm_service.chat_with_json(messages)
        formulas = result.get("formulas", [])
        logger.info(f"LLM 生成 {len(formulas)} 套配方方案")
        return formulas
    except Exception as e:
        logger.error(f"LLM 配方生成失败，回退到规则引擎: {e}")
        return None


def get_mock_response(question: str) -> str:
    """
    获取模拟响应（用于演示或离线模式）
    """
    question_lower = question.lower().strip()
    
    # 药食同源相关问题
    if any(keyword in question_lower for keyword in ["药食同源", "药食两用", "中药材", "草药"]):
        return """根据国家卫生健康委员会公布的药食同源目录，常见的药食同源食材包括：
        
**补气类：**
- 黄芪：补气升阳，固表止汗
- 党参：补中益气，健脾益肺
- 山药：益气养阴，补脾肺肾

**滋阴类：**
- 枸杞子：滋补肝肾，益精明目
- 百合：养阴润肺，清心安神
- 银耳：滋阴润肺，养胃生津

**养血类：**
- 红枣：补中益气，养血安神
- 桂圆：补益心脾，养血安神

**注意事项：**
1. 药食同源食材虽好，但不能替代药物治疗
2. 特殊人群（孕妇、哺乳期、慢性病患者）应咨询医生后使用
3. 遵循适量原则，避免过量食用

如需了解特定药材的详细信息，请告诉我具体名称。"""
    
    # 配方相关问题
    elif any(keyword in question_lower for keyword in ["配方", "搭配", "组合", "比例"]):
        return """配方设计需要综合考虑以下因素：

**设计原则：**
1. **君臣佐使**：明确主药和辅药的关系
2. **功效协同**：选择具有协同作用的成分
3. **安全优先**：严格遵守药食同源目录和剂量范围
4. **口感协调**：平衡风味，提升接受度

**推荐配方示例：**

**免疫增强配方：**
- 黄芪 10g（君）- 补气固表
- 党参 8g（臣）- 补中益气  
- 枸杞子 5g（佐）- 滋补肝肾
- 红枣 3枚（使）- 调和诸药

**抗氧化配方：**
- 蓝莓提取物 500mg
- 葡萄籽提取物 300mg
- 维生素C 500mg

如需针对特定功效设计配方，请告诉我您的目标功效。"""
    
    # 活性肽相关问题
    elif any(keyword in question_lower for keyword in ["肽", "活性肽", "肽序列", "氨基酸"]):
        return """生物活性肽是具有特定生理功能的小分子肽段：

**常见活性肽类型：**
- ACE抑制肽：降血压作用
- 抗氧化肽：清除自由基
- 免疫调节肽：增强免疫力
- 抗菌肽：抑菌杀菌

**来源：**
- 乳清蛋白水解
- 大豆蛋白水解
- 海洋生物提取
- 胶原蛋白水解

**应用注意：**
1. 肽的活性依赖于序列和构象
2. 消化稳定性是重要考量
3. 需进行安全性评价

如需分析特定肽序列，请提供序列信息。"""
    
    # 安全法规相关问题
    elif any(keyword in question_lower for keyword in ["安全", "法规", "合规", "标准", "GB"]):
        return """食品配方设计需遵守相关法规标准：

**主要法规：**
- 《中华人民共和国食品安全法》
- GB 2760 食品安全国家标准 食品添加剂使用标准
- GB 14880 食品安全国家标准 食品营养强化剂使用标准
- 《保健食品注册与备案管理办法》

**药食同源目录管理：**
- 2023版目录包含110种药材
- 仅限目录内药材用于食品
- 严格遵守用量规定

**出口注意事项：**
- 了解目标市场的法规要求
- 准备相关认证文件
- 关注标签标识规范

如需特定产品的合规建议，请提供产品信息。"""
    
    # 综合问题或问候
    else:
        return f"""您好！我是 RMFOOD AI 配方顾问，专注于药食同源功能性食品研发领域。

**我可以帮助您：**
- 📖 解答药食同源知识
- 🧪 设计配方方案
- 🔬 分析活性肽特性
- ⚖️ 提供法规合规建议

**常见问题示例：**
- "黄芪和党参的配伍禁忌是什么？"
- "如何设计一个免疫增强配方？"
- "ACE抑制肽有哪些来源？"

请告诉我您的具体需求，我将为您提供专业建议！

---
💡 *提示：由于当前未配置 LLM API，以上为离线模拟回答。配置真实 API Key 后可获得更精准的智能回复。*"""


async def chat_with_rmfood(
    question: str,
    history: list[dict[str, str]] | None = None,
) -> str:
    """
    RMFOOD 智能对话（非流式）

    Args:
        question: 用户问题
        history: 对话历史 [{"role": "user/assistant", "content": "..."}]

    Returns:
        AI 回答文本

    Raises:
        RuntimeError: 当 LLM 服务调用失败时抛出异常（由上层处理）
    """
    if not llm_service.is_available:
        logger.info("LLM服务不可用，使用模拟响应")
        return get_mock_response(question)

    messages = [LLMMessage(role="system", content=RMFOOD_SYSTEM_PROMPT)]

    # 加入历史
    if history:
        for h in history[-10:]:  # 最近 10 轮
            messages.append(LLMMessage(role=h["role"], content=h["content"]))

    messages.append(LLMMessage(role="user", content=question))

    try:
        logger.info(f"开始 AI 对话 - 问题长度: {len(question)} 字符, 历史消息数: {len(history) if history else 0}")
        result = await llm_service.chat(messages)
        logger.info(f"AI 对话成功 - 回答长度: {len(result.content)} 字符, 模型: {result.model}")
        return result.content
    except httpx.ConnectError as e:
        logger.warning(f"无法连接到LLM服务，使用模拟响应: {e}")
        return get_mock_response(question)
    except Exception as e:
        logger.error(f"RMFOOD 智能对话失败: {type(e).__name__}: {e}", exc_info=True)
        raise
