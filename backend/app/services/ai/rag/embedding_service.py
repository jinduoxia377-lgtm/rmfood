"""Embedding 服务 — 文本向量化

支持多种向量化策略：
1. DeepSeek Embeddings API（默认，复用 LLM 配置）
2. OpenAI Embeddings API
3. 本地哈希 fallback（开发测试用）

自动从环境变量读取配置（与 LLM 服务共享）：
- LLM_PROVIDER: deepseek | openai（决定默认 model）
- OPENAI_API_KEY: API Key（DeepSeek 也使用此字段）
- OPENAI_BASE_URL: API 基础地址
- EMBEDDING_MODEL: 覆盖默认模型名
"""

import hashlib
import os
import logging
from typing import Optional
import httpx

logger = logging.getLogger(__name__)


class EmbeddingService:
    """文本向量化服务

    自动从环境变量读取配置。优先级：构造函数参数 > 环境变量 > 默认值。
    """

    PROVIDER_MODELS: dict[str, str] = {
        "deepseek": "deepseek-embedding",
        "openai": "text-embedding-3-small",
    }

    def __init__(
        self,
        provider: str = "",
        api_key: Optional[str] = None,
        base_url: Optional[str] = None,
        model: Optional[str] = None,
    ):
        self.provider = provider or os.getenv("LLM_PROVIDER", "openai")
        self.api_key = api_key or os.getenv("OPENAI_API_KEY") or ""
        self.base_url = (base_url or os.getenv("OPENAI_BASE_URL") or "").rstrip("/")
        self.model = model or os.getenv("EMBEDDING_MODEL") or ""

        # 未显式配置 base_url 时使用提供商默认
        if not self.base_url:
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
            向量列表（每文本一个向量）
        """
        if not texts:
            return []

        try:
            if self.api_key:
                result = await self._embed_via_api(texts)
                self._using_fallback = False
                return result
        except Exception as e:
            import logging
            logging.getLogger(__name__).warning(
                "Embedding API 调用失败，使用 fallback: %s", e
            )

        self._using_fallback = True
        return self._embed_fallback(texts)

    def is_fallback_mode(self) -> bool:
        """检查当前是否处于降级（哈希向量）模式"""
        return self._using_fallback

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

    def _embed_fallback(self, texts: list[str]) -> list[list[float]]:
        """开发/测试用 fallback 向量化

        基于 SHA-256 哈希生成固定维度向量。
        注意：不适用于生产环境，仅供开发和测试使用。

        Args:
            texts: 文本列表

        Returns:
            128 维归一化向量列表
        """
        result: list[list[float]] = []
        for text in texts:
            h = hashlib.sha256(text.encode()).digest()
            vec = [b / 255.0 for b in h[:128]]
            # 归一化
            magnitude = sum(v * v for v in vec) ** 0.5
            if magnitude > 0:
                vec = [v / magnitude for v in vec]
            result.append(vec)
        return result
