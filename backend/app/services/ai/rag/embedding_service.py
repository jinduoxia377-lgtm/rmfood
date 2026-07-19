"""Embedding 服务 — 文本向量化

支持多种向量化策略：
1. 本地嵌入模型（local，fastembed + ONNX，免 API key、离线可用）
2. DeepSeek Embeddings API（复用 LLM 配置）
3. OpenAI Embeddings API

自动从环境变量读取配置：
- EMBEDDING_PROVIDER: local | deepseek | openai（未设置时回退到 LLM_PROVIDER）
- LLM_PROVIDER: deepseek | openai（决定 API 默认 model）
- OPENAI_API_KEY: API Key（DeepSeek 也使用此字段；local 无需）
- OPENAI_BASE_URL: API 基础地址
- EMBEDDING_MODEL: 覆盖默认模型名（local 时为 fastembed 模型名）

降级策略：当 API 不可用时，返回空数组并标记降级状态，
由上游 RAGService 决定是否阻断整个检索流程。
"""

import os
import asyncio
import logging
from typing import Optional
import httpx

logger = logging.getLogger(__name__)

# 本地 fastembed 模型单例缓存（按模型名）——避免重复加载与下载
_LOCAL_MODEL_CACHE: dict[str, object] = {}


class EmbeddingService:
    """文本向量化服务

    自动从环境变量读取配置。优先级：构造函数参数 > 环境变量 > 默认值。
    """

    PROVIDER_MODELS: dict[str, str] = {
        "deepseek": "deepseek-embedding",
        "openai": "text-embedding-3-small",
        "local": "BAAI/bge-small-zh-v1.5",
    }

    def __init__(
        self,
        provider: str = "",
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self.provider = provider or os.getenv("EMBEDDING_PROVIDER") or os.getenv("LLM_PROVIDER", "openai")
        self.api_key = api_key or os.getenv("OPENAI_API_KEY") or ""
        self.base_url = (base_url or os.getenv("OPENAI_BASE_URL") or "").rstrip("/")
        self.model = model or os.getenv("EMBEDDING_MODEL") or ""

        # 远程 API 提供商：未显式配置 base_url 时使用提供商默认（local 不需要 base_url）
        if self.provider != "local" and not self.base_url:
            self.base_url = "https://api.deepseek.com/v1" if self.provider == "deepseek" else "https://api.openai.com/v1"

        # 未显式配置 model 时使用提供商默认
        if not self.model:
            self.model = self.PROVIDER_MODELS.get(self.provider, "text-embedding-3-small")

        logger.debug("EmbeddingService 初始化: provider=%s, model=%s", self.provider, self.model)
        self._using_fallback = False  # 追踪是否处于降级模式

    async def embed_texts(self, texts: list[str]) -> list[list[float]]:
        """批量文本向量化

        Args:
            texts: 要向量化的文本列表

        Returns:
            向量列表（每文本一个向量）。
            若 API 不可用且处于 fallback 模式，返回空数组并标记降级状态，
            由上游 RAGService 检测到后给出明确的用户提示。

        Note:
            不再返回无语义意义的哈希向量——这会导致检索退化为伪随机近似，
            给用户造成"知识库在工作"的错觉。
        """
        if not texts:
            return []

        # 本地嵌入模型（fastembed / ONNX）——无需 API key
        if self.provider == "local":
            try:
                result = await self._embed_local(texts)
                self._using_fallback = False
                return result
            except Exception as e:
                logger.error("本地 Embedding 模型加载或推理失败: %s", e)
                self._using_fallback = True
                return []

        try:
            if self.api_key:
                result = await self._embed_via_api(texts)
                self._using_fallback = False
                return result
        except Exception as e:
            logger.warning(
                "Embedding API 调用失败，进入降级模式: %s — 检索结果将不可靠", e,
            )

        # 降级模式：返回空数组，由上层决定是否阻断检索
        self._using_fallback = True
        logger.error(
            "Embedding 服务处于降级模式（API 不可用），"
            "向量检索将返回无语义意义的数据，请配置有效的 EMBEDDING_API_KEY",
        )
        return []

    def is_fallback_mode(self) -> bool:
        """检查当前是否处于降级模式（API 不可用）"""
        return self._using_fallback

    async def _embed_local(self, texts: list[str]) -> list[list[float]]:
        """使用本地 fastembed 模型向量化。

        fastembed 推理为同步 CPU 密集操作，放入线程池执行以避免阻塞事件循环。
        """
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, self._embed_local_sync, texts)

    def _embed_local_sync(self, texts: list[str]) -> list[list[float]]:
        model = self._get_local_model()
        return [[float(x) for x in vec] for vec in model.embed(texts)]

    def _get_local_model(self):
        """惰性加载并缓存本地嵌入模型（首次调用会下载模型文件）。"""
        model = _LOCAL_MODEL_CACHE.get(self.model)
        if model is None:
            from fastembed import TextEmbedding
            logger.info("加载本地嵌入模型: %s（首次运行将下载模型文件，请稍候）", self.model)
            model = TextEmbedding(model_name=self.model)
            _LOCAL_MODEL_CACHE[self.model] = model
        return model

    async def _embed_via_api(self, texts: list[str]) -> list[list[float]]:
        """调用远程 Embedding API"""
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{self.base_url}/embeddings",
                headers={
                    "Authorization": f"Bearer {self.api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "model": self.model,
                    "input": texts,
                    "encoding_format": "float",
                },
            )
            response.raise_for_status()
            data = response.json()
            return [item["embedding"] for item in data["data"]]
