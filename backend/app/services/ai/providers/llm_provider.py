# ruff: noqa: E402
"""RMFOOD LLM Provider抽象层

定义统一的LLM接口，支持多种提供商：
- OpenAI (GPT-4/GPT-4-turbo/GPT-3.5-turbo)
- Anthropic (Claude 3 Opus/Sonnet)
- Local Llama (Ollama API)

特性：
- 统一的generate/stream_generate接口
- 自动重试和错误处理
- Token使用统计
- 连接验证
"""
from __future__ import annotations

import json
import logging
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any, AsyncIterator, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


@dataclass
class LLMMessage:
    """对话消息"""
    role: str  # "system" | "user" | "assistant"
    content: str


@dataclass
class LLMResponse:
    """LLM响应结果"""
    content: str
    model: str = ""
    provider: str = ""
    usage: Dict[str, int] = field(default_factory=dict)
    finish_reason: str = ""
    latency_ms: float = 0.0


# ── 流式 finish_reason 归一化 + 流式结果载体 ──
# 各上游对"为何停止生成"的命名不同，这里统一映射为规范值：
#   "stop"          正常结束
#   "length"        达到 max_tokens 上限被截断（续写触发信号）
#   "content_filter"内容安全过滤
#   "tool_calls"    模型请求工具调用
#   "other"/""      其他/未知
_FINISH_REASON_ALIASES: Dict[str, str] = {
    # OpenAI / OpenAI 兼容（DeepSeek、Ollama OpenAI 层等）
    "stop": "stop",
    "length": "length",
    "content_filter": "content_filter",
    "tool_calls": "tool_calls",
    "function_call": "tool_calls",
    # Anthropic messages API
    "end_turn": "stop",
    "max_tokens": "length",
    "stop_sequence": "stop",
    "tool_use": "tool_calls",
    "refusal": "content_filter",
    # Ollama /api/chat
    "done": "stop",
}


def normalize_finish_reason(raw: str) -> str:
    """把各 provider 的停止原因归一化为规范字符串（未知值归为 "other"）。"""
    if not raw:
        return ""
    return _FINISH_REASON_ALIASES.get(str(raw).strip().lower(), "other")


@dataclass
class StreamMeta:
    """流式结果载体（side-channel）。

    ``stream_generate`` / ``chat_stream`` 是 ``AsyncIterator[str]``，为保持向后兼容
    （现有调用方按纯文本迭代器消费），不改变 yield 类型；当调用方需要感知上游的
    finish_reason / usage 时，传入一个 ``StreamMeta`` 实例，适配器在解析 SSE 过程中
    就地回填字段。调用方在流结束后读取 ``meta.finish_reason`` 即可。
    """

    finish_reason: str = ""  # 归一化后的停止原因（见 normalize_finish_reason）
    raw_finish_reason: str = ""  # 上游原始值（便于排查）
    usage: Dict[str, int] = field(default_factory=dict)


@dataclass
class ProviderConfig:
    """Provider配置"""
    api_key: str = ""
    base_url: str = ""
    model: str = ""
    max_tokens: int = 32000
    temperature: float = 0.7
    top_p: float = 1.0
    timeout: float = 60.0
    max_retries: int = 3
    retry_delay: float = 1.0


class LLMProvider(ABC):
    """LLM提供商抽象基类"""

    def __init__(self, config: ProviderConfig):
        self.config = config
        self._client: Optional[httpx.AsyncClient] = None
        self._total_tokens_used: int = 0
        self._request_count: int = 0

    @property
    def client(self) -> httpx.AsyncClient:
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(timeout=self.config.timeout)
        return self._client

    @property
    def total_tokens_used(self) -> int:
        return self._total_tokens_used

    @property
    def request_count(self) -> int:
        return self._request_count

    async def close(self):
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    @abstractmethod
    async def generate(
        self,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> str:
        """
        一次性生成（非流式）

        Args:
            messages: [{"role": "system"/"user", "content": "..."}]
            kwargs: temperature, max_tokens, top_p etc.

        Returns:
            完整生成文本
        """
        pass

    @abstractmethod
    async def stream_generate(
        self,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> AsyncIterator[str]:
        """
        流式生成（SSE格式）

        Yields:
            每个token或文本块，用于前端打字机效果

        附加：调用方可传入 ``meta=StreamMeta()``（见本模块 ``StreamMeta``），
        适配器会把上游的 finish_reason（归一化）与 usage 回填到该载体，
        从而在不破坏 ``AsyncIterator[str]`` 纯文本契约的前提下透传停止原因。
        """
        pass

    @abstractmethod
    async def validate_connection(self) -> bool:
        """验证API Key有效性和网络连通性"""
        pass

    @abstractmethod
    def get_provider_name(self) -> str:
        """返回Provider名称"""
        pass

    async def _retry_with_backoff(self, func, *args, **kwargs):
        """带指数退避的重试机制"""
        last_exception = None

        for attempt in range(self.config.max_retries):
            try:
                return await func(*args, **kwargs)
            except Exception as e:
                last_exception = e

                if attempt < self.config.max_retries - 1:
                    delay = self.config.retry_delay * (2 ** attempt)
                    logger.warning(
                        f"调用失败（第{attempt+1}次），{delay}秒后重试: {e}"
                    )
                    await asyncio.sleep(delay)
                else:
                    logger.error(f"已达最大重试次数，放弃: {e}")

        raise last_exception


class OpenAIProvider(LLMProvider):
    """OpenAI GPT系列实现

    支持模型：
    - gpt-4o / gpt-4o-mini (推荐)
    - gpt-4-turbo
    - gpt-3.5-turbo

    特性：
    - 流式SSE输出
    - Rate Limiting: 40 RPM / 200 RPD
    - JSON模式支持
    """

    SUPPORTED_MODELS = [
        "gpt-4o", "gpt-4o-mini", "gpt-4-turbo",
        "gpt-4", "gpt-3.5-turbo"
    ]

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        if not config.base_url:
            self.config.base_url = "https://api.openai.com/v1"
        if not config.model:
            self.config.model = "gpt-4o-mini"

    def get_provider_name(self) -> str:
        return "openai"

    def _build_headers(self) -> Dict[str, str]:
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.config.api_key}",
        }

    def _build_payload(
        self,
        messages: List[Dict[str, str]],
        stream: bool = False,
        **kwargs
    ) -> Dict[str, Any]:
        payload = {
            "model": kwargs.get("model", self.config.model),
            "messages": messages,
            "max_tokens": kwargs.get("max_tokens", self.config.max_tokens),
            "temperature": kwargs.get("temperature", self.config.temperature),
            "top_p": kwargs.get("top_p", self.config.top_p),
            "stream": stream,
        }

        if kwargs.get("response_format"):
            payload["response_format"] = kwargs["response_format"]

        # 传递 tools（function calling schema）
        if kwargs.get("tools"):
            payload["tools"] = kwargs["tools"]
            # 如果有 tool_choice，也传递
            if kwargs.get("tool_choice"):
                payload["tool_choice"] = kwargs["tool_choice"]

        return payload

    async def generate(
        self,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> str:
        start_time = time.time()

        url = f"{self.config.base_url}/chat/completions"
        headers = self._build_headers()
        payload = self._build_payload(messages, stream=False, **kwargs)

        # 打印请求用于调试
        tool_names = [t.get("function", {}).get("name", "?")
                      for t in payload.get("tools", [])]
        logger.info(
            f"[LLM请求] model={self.config.model}, tools={tool_names}, "
            f"messages_count={len(messages)}, system前50={messages[0].get('content','')[:50] if messages else ''}"
        )

        try:
            resp = await self.client.post(url, headers=headers, json=payload)
            resp.raise_for_status()

            data = resp.json()
            choice = data["choices"][0]
            usage = data.get("usage", {})

            self._total_tokens_used += usage.get("total_tokens", 0)
            self._request_count += 1

            latency = (time.time() - start_time) * 1000
            logger.info(
                f"OpenAI生成完成 - 模型: {self.config.model}, "
                f"Token: {usage.get('total_tokens', 0)}, "
                f"延迟: {latency:.0f}ms"
            )

            message = choice["message"]
            # 如果有 tool_calls，返回 JSON 字符串供上层解析
            if message.get("tool_calls"):
                import json as _json
                tool_calls_str = _json.dumps(
                    message["tool_calls"], ensure_ascii=False
                )
                logger.info(f"LLM 请求了 {len(message['tool_calls'])} 个工具调用")
                # 在 content 前添加标记以便识别
                return f"__TOOL_CALLS__:{tool_calls_str}"
            # 记录实际返回内容的前200字
            content = message.get("content", "")
            logger.info(f"LLM 返回纯文本，长度={len(content)}, 前100字={content[:100]}")
            return content

        except httpx.HTTPStatusError as e:
            logger.error(f"HTTP错误: {e.response.status_code} - {e.response.text[:500]}")
            await self._handle_http_error(e)
        except Exception as e:
            logger.error(f"OpenAI生成失败: {e}")
            raise

    async def stream_generate(
        self,
        messages: List[Dict[str, str]],
        meta: Optional[StreamMeta] = None,
        **kwargs
    ) -> AsyncIterator[str]:
        url = f"{self.config.base_url}/chat/completions"
        headers = self._build_headers()
        payload = self._build_payload(messages, stream=True, **kwargs)

        try:
            async with self.client.stream(
                "POST", url, headers=headers, json=payload
            ) as resp:
                resp.raise_for_status()

                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue

                    data_str = line[6:].strip()
                    if data_str == "[DONE]":
                        break

                    try:
                        chunk = json.loads(data_str)
                        choice = chunk["choices"][0]
                        delta = choice.get("delta", {})
                        content = delta.get("content", "")
                        if content:
                            yield content
                        # 透传停止原因（最后一个 chunk 携带 finish_reason）
                        if meta is not None:
                            raw_fr = choice.get("finish_reason")
                            if raw_fr:
                                meta.raw_finish_reason = raw_fr
                                meta.finish_reason = normalize_finish_reason(raw_fr)
                            # 部分 provider 在末尾 chunk 附带 usage
                            if chunk.get("usage"):
                                meta.usage = chunk["usage"]
                    except (json.JSONDecodeError, KeyError) as e:
                        logger.warning(f"流式响应解析失败: {e}")
                        continue

        except httpx.HTTPStatusError as e:
            await self._handle_http_error(e)
        except Exception as e:
            logger.error(f"OpenAI流式生成失败: {e}")
            raise

    async def validate_connection(self) -> bool:
        try:
            url = f"{self.config.base_url}/models"
            headers = self._build_headers()

            resp = await self.client.get(url, headers=headers)
            resp.raise_for_status()

            models = resp.json().get("data", [])
            model_ids = [m["id"] for m in models]

            is_valid = self.config.model in model_ids
            logger.info(
                f"OpenAI连接验证成功 - 可用模型数: {len(models)}, "
                f"当前模型{'可用' if is_valid else '不可用'}"
            )

            return is_valid

        except Exception as e:
            logger.error(f"OpenAI连接验证失败: {e}")
            return False

    async def _handle_http_error(self, error: httpx.HTTPStatusError):
        status_code = error.response.status_code
        error_detail = ""

        try:
            error_body = error.response.json()
            error_detail = error_body.get("error", {}).get("message", "")
        except Exception as e:
            logger.debug("OpenAI 错误响应体解析失败: %s", e)
            error_detail = error.response.text[:200]
        if status_code == 401:
            raise RuntimeError(f"OpenAI API认证失败 (401): {error_detail}")
        elif status_code == 429:
            raise RuntimeError(f"OpenAI API频率限制 (429): {error_detail}")
        elif status_code == 500:
            raise RuntimeError(f"OpenAI服务器错误 (500): {error_detail}")
        else:
            raise RuntimeError(f"OpenAI API错误 ({status_code}): {error_detail}")


class AnthropicProvider(LLMProvider):
    """Anthropic Claude实现

    支持模型：
    - claude-3-5-sonnet-20241022 (推荐，性价比高)
    - claude-3-opus-20240229 (最强性能)
    - claude-3-haiku-20240307 (最快速度)

    特性：
    - 超长上下文窗口（200K tokens）
    - 更强的推理能力
    - 系统提示词分离
    """

    SUPPORTED_MODELS = [
        "claude-3-5-sonnet-20241022",
        "claude-3-opus-20240229",
        "claude-3-haiku-20240307",
    ]

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        if not config.base_url:
            self.config.base_url = "https://api.anthropic.com"
        if not config.model:
            self.config.model = "claude-3-5-sonnet-20241022"

    def get_provider_name(self) -> str:
        return "anthropic"

    def _build_headers(self) -> Dict[str, str]:
        return {
            "Content-Type": "application/json",
            "x-api-key": self.config.api_key,
            "anthropic-version": "2023-06-01",
            "anthropic-dangerous-direct-browser-access": "true",
        }

    def _convert_messages(
        self,
        messages: List[Dict[str, str]]
    ) -> tuple:
        """转换消息格式为Anthropic格式"""
        system_content = ""
        anthropic_messages = []

        for msg in messages:
            if msg["role"] == "system":
                system_content += msg["content"] + "\n"
            else:
                anthropic_messages.append({
                    "role": msg["role"],
                    "content": msg["content"],
                })

        return system_content, anthropic_messages

    async def generate(
        self,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> str:
        start_time = time.time()

        url = f"{self.config.base_url}/v1/messages"
        headers = self._build_headers()

        system_content, anthropic_messages = self._convert_messages(messages)

        payload = {
            "model": kwargs.get("model", self.config.model),
            "max_tokens": kwargs.get("max_tokens", self.config.max_tokens),
            "temperature": kwargs.get("temperature", self.config.temperature),
            "top_p": kwargs.get("top_p", self.config.top_p),
            "messages": anthropic_messages,
        }

        if system_content:
            payload["system"] = system_content.strip()

        try:
            resp = await self.client.post(url, headers=headers, json=payload)
            resp.raise_for_status()

            data = resp.json()
            usage = data.get("usage", {})

            self._total_tokens_used += usage.get("output_tokens", 0)
            self._request_count += 1

            latency = (time.time() - start_time) * 1000
            logger.info(
                f"Anthropic生成完成 - 模型: {self.config.model}, "
                f"Token: {usage.get('output_tokens', 0)}, "
                f"延迟: {latency:.0f}ms"
            )

            return data["content"][0]["text"]

        except httpx.HTTPStatusError as e:
            await self._handle_http_error(e)
        except Exception as e:
            logger.error(f"Anthropic生成失败: {e}")
            raise

    async def stream_generate(
        self,
        messages: List[Dict[str, str]],
        meta: Optional[StreamMeta] = None,
        **kwargs
    ) -> AsyncIterator[str]:
        url = f"{self.config.base_url}/v1/messages"
        headers = self._build_headers()

        system_content, anthropic_messages = self._convert_messages(messages)

        payload = {
            "model": kwargs.get("model", self.config.model),
            "max_tokens": kwargs.get("max_tokens", self.config.max_tokens),
            "stream": True,
            "messages": anthropic_messages,
        }

        if system_content:
            payload["system"] = system_content.strip()

        try:
            async with self.client.stream(
                "POST", url, headers=headers, json=payload
            ) as resp:
                resp.raise_for_status()

                async for line in resp.aiter_lines():
                    if not line.startswith("data: "):
                        continue

                    data_str = line[6:].strip()

                    try:
                        chunk = json.loads(data_str)

                        if chunk.get("type") == "content_block_delta":
                            delta = chunk.get("delta", {})
                            text = delta.get("text", "")
                            if text:
                                yield text
                        # 透传停止原因：Anthropic 在 message_delta 事件里带 stop_reason
                        if meta is not None:
                            if chunk.get("type") == "message_delta":
                                raw_sr = (chunk.get("delta", {}) or {}).get("stop_reason")
                                if raw_sr:
                                    meta.raw_finish_reason = raw_sr
                                    meta.finish_reason = normalize_finish_reason(raw_sr)
                                msg_usage = chunk.get("usage")
                                if msg_usage:
                                    meta.usage = {
                                        "input_tokens": msg_usage.get("input_tokens", 0),
                                        "output_tokens": msg_usage.get("output_tokens", 0),
                                    }
                            elif chunk.get("type") == "message_start":
                                msg_usage = (chunk.get("message", {}) or {}).get("usage")
                                if msg_usage and not meta.usage:
                                    meta.usage = {
                                        "input_tokens": msg_usage.get("input_tokens", 0),
                                        "output_tokens": msg_usage.get("output_tokens", 0),
                                    }
                    except (json.JSONDecodeError, KeyError) as e:
                        logger.warning(f"流式响应解析失败: {e}")
                        continue

        except httpx.HTTPStatusError as e:
            await self._handle_http_error(e)
        except Exception as e:
            logger.error(f"Anthropic流式生成失败: {e}")
            raise

    async def validate_connection(self) -> bool:
        try:
            await self.generate(
                [{"role": "user", "content": "Hi"}],
                max_tokens=5
            )
            logger.info("Anthropic连接验证成功")
            return True
        except Exception as e:
            logger.error(f"Anthropic连接验证失败: {e}")
            return False

    async def _handle_http_error(self, error: httpx.HTTPStatusError):
        status_code = error.response.status_code
        error_detail = ""

        try:
            error_body = error.response.json()
            error_detail = error_body.get("error", {}).get("message", "")
        except Exception as e:
            logger.debug("Anthropic 错误响应体解析失败: %s", e)
            error_detail = error.response.text[:200]
        if status_code == 401:
            raise RuntimeError(f"Anthropic API认证失败 (401): {error_detail}")
        elif status_code == 429:
            raise RuntimeError(f"Anthropic API频率限制 (429): {error_detail}")
        else:
            raise RuntimeError(f"Anthropic API错误 ({status_code}): {error_detail}")


class LocalLlamaProvider(LLMProvider):
    """本地Llama模型（Ollama API）实现

    支持通过Ollama运行本地模型：
    - llama3.1 (8B/70B)
    - llama3.2 (1B/3B)
    - qwen2.5 (7B/72B)
    - 其他Ollama支持的模型

    特性：
    - 私有化部署，无数据外传风险
    - 低延迟（本地网络）
    - 免费使用（无API费用）
    - 质量略低于云端模型但可接受
    """

    DEFAULT_OLLAMA_URL = "http://localhost:11434"

    def __init__(self, config: ProviderConfig):
        super().__init__(config)
        if not config.base_url:
            self.config.base_url = self.DEFAULT_OLLAMA_URL
        if not config.model:
            self.config.model = "llama3.1:8b"

    def get_provider_name(self) -> str:
        return "ollama"

    async def generate(
        self,
        messages: List[Dict[str, str]],
        **kwargs
    ) -> str:
        start_time = time.time()

        url = f"{self.config.base_url}/api/chat"

        payload = {
            "model": kwargs.get("model", self.config.model),
            "messages": messages,
            "stream": False,
            "options": {
                "temperature": kwargs.get("temperature", self.config.temperature),
                "num_predict": kwargs.get("max_tokens", self.config.max_tokens),
                "top_p": kwargs.get("top_p", self.config.top_p),
            },
        }

        try:
            resp = await self.client.post(url, json=payload)
            resp.raise_for_status()

            data = resp.json()
            content = data.get("message", {}).get("content", "")

            _ = data.get("prompt_eval_count", 0)
            eval_count = data.get("eval_count", 0)

            self._total_tokens_used += eval_count
            self._request_count += 1

            latency = (time.time() - start_time) * 1000
            logger.info(
                f"Ollama生成完成 - 模型: {self.config.model}, "
                f"Token: {eval_count}, 延迟: {latency:.0f}ms"
            )

            return content

        except httpx.HTTPStatusError as e:
            await self._handle_http_error(e)
        except Exception as e:
            logger.error(f"Ollama生成失败: {e}")
            raise

    async def stream_generate(
        self,
        messages: List[Dict[str, str]],
        meta: Optional[StreamMeta] = None,
        **kwargs
    ) -> AsyncIterator[str]:
        url = f"{self.config.base_url}/api/chat"

        payload = {
            "model": kwargs.get("model", self.config.model),
            "messages": messages,
            "stream": True,
            "options": {
                "temperature": kwargs.get("temperature", self.config.temperature),
                "num_predict": kwargs.get("max_tokens", self.config.max_tokens),
            },
        }

        try:
            async with self.client.stream(
                "POST", url, json=payload
            ) as resp:
                resp.raise_for_status()

                async for line in resp.aiter_lines():
                    if not line.strip():
                        continue

                    try:
                        chunk = json.loads(line)
                        message = chunk.get("message", {})
                        content = message.get("content", "")
                        if content:
                            yield content
                        # 透传停止原因：Ollama 末尾 chunk 带 done=True + done_reason
                        if meta is not None and chunk.get("done"):
                            raw_dr = chunk.get("done_reason", "")
                            meta.raw_finish_reason = raw_dr
                            meta.finish_reason = normalize_finish_reason(raw_dr)
                            meta.usage = {
                                "prompt_tokens": chunk.get("prompt_eval_count", 0),
                                "completion_tokens": chunk.get("eval_count", 0),
                                "total_tokens": chunk.get("prompt_eval_count", 0)
                                + chunk.get("eval_count", 0),
                            }
                    except (json.JSONDecodeError, KeyError) as e:
                        logger.warning(f"流式响应解析失败: {e}")
                        continue

        except httpx.HTTPStatusError as e:
            await self._handle_http_error(e)
        except Exception as e:
            logger.error(f"Ollama流式生成失败: {e}")
            raise

    async def validate_connection(self) -> bool:
        try:
            url = f"{self.config.base_url}/api/tags"
            resp = await self.client.get(url)
            resp.raise_for_status()

            models = resp.json().get("models", [])
            model_names = [m["name"] for m in models]

            is_available = self.config.model in model_names
            logger.info(
                f"Ollama连接验证成功 - 已安装模型: {len(models)}, "
                f"当前模型{'可用' if is_available else '未安装'}"
            )

            return is_available

        except Exception as e:
            logger.error(f"Ollama连接验证失败（请确认Ollama已启动）: {e}")
            return False

    async def _handle_http_error(self, error: httpx.HTTPStatusError):
        status_code = error.response.status_code

        if status_code == 404:
            raise RuntimeError(
                f"Ollama模型不存在: {self.config.model}。"
                f"请先执行: ollama pull {self.config.model}"
            )
        elif status_code == 500:
            raise RuntimeError("Ollama服务内部错误")
        else:
            raise RuntimeError(f"Ollama API错误 ({status_code})")


import asyncio
