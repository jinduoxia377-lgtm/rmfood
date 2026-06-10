"""
LLM Provider HTTP 连接池管理

为每个 base_url 维护独立的 httpx.AsyncClient 连接池实例，
避免频繁创建/销毁连接的开销。

用法:
    from app.services.ai.connection_pool import get_connection_pool

    pool = get_connection_pool()
    client = pool.get_client("https://api.openai.com/v1")
    response = await client.post("/chat/completions", json={...})

    # 关闭所有连接池（通常在 shutdown 时调用）
    await pool.close_all()
"""
from __future__ import annotations

import logging

import httpx

logger = logging.getLogger(__name__)


class LLMConnectionPool:
    """LLM Provider 专用 HTTP 连接池管理

    特性:
    - 按 base_url 归一化后缓存连接池客户端
    - 配置合理的超时和连接限制
    - 支持批量关闭所有连接池
    """

    def __init__(self) -> None:
        self._pools: dict[str, httpx.AsyncClient] = {}

    def get_client(
        self,
        base_url: str,
        timeout: float = 60.0,
    ) -> httpx.AsyncClient:
        """获取或创建指定 base_url 的连接池客户端

        Args:
            base_url: API 基础地址（会自动去除尾部斜杠并归一化）
            timeout: 默认请求超时时间（秒）

        Returns:
            httpx.AsyncClient 实例（已配置连接池参数）
        """
        normalized = base_url.rstrip("/")

        if normalized not in self._pools:
            self._pools[normalized] = httpx.AsyncClient(
                base_url=normalized,
                timeout=httpx.Timeout(timeout, connect=10.0),
                limits=httpx.Limits(
                    max_connections=10,
                    max_keepalive_connections=5,
                    keepalive_expiry=30.0,
                ),
            )
            logger.info("创建新连接池客户端: %s", normalized)

        return self._pools[normalized]

    async def close_all(self) -> None:
        """关闭所有连接池（应在应用 shutdown 时调用）"""
        for url, client in list(self._pools.items()):
            try:
                await client.aclose()
                logger.debug("连接池已关闭: %s", url)
            except Exception as e:
                logger.warning("关闭连接池失败 %s: %s", url, e)
        self._pools.clear()
        logger.info("所有连接池已关闭")

    @property
    def pool_count(self) -> int:
        """当前活跃的连接池数量"""
        return len(self._pools)

    @property
    def active_urls(self) -> list[str]:
        """当前活跃的 base_url 列表"""
        return list(self._pools.keys())


# ══════════════════════════════════════════════
# 全局单例
# ══════════════════════════════════════════════

_pool = LLMConnectionPool()


def get_connection_pool() -> LLMConnectionPool:
    """获取全局 LLMConnectionPool 单例"""
    return _pool
