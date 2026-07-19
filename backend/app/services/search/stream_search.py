"""
流式搜索 (SSE) 服务

对标 Potion AI VFT 的 /search/raw-materials/stream 端点。
使用 Server-Sent Events 逐批推送搜索结果，提升用户体验。
"""
import json
import logging
from typing import AsyncIterator, Dict, Any, List, Optional
from fastapi.responses import StreamingResponse

logger = logging.getLogger(__name__)


class StreamSearchService:
    """SSE 流式搜索服务"""

    def __init__(self, bm25_searcher, vector_searcher, hybrid_searcher, nlp_pipeline):
        self.bm25_searcher = bm25_searcher
        self.vector_searcher = vector_searcher
        self.hybrid_searcher = hybrid_searcher
        self.nlp_pipeline = nlp_pipeline

    async def generate_stream(
        self,
        query: str,
        search_type: str = "food_materials",
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 50,
    ) -> AsyncIterator[str]:
        """
        生成 SSE 事件流

        事件顺序:
        1. meta: 预估结果数
        2. progress: 正在搜索...
        3. results_batch_1: BM25 初步结果
        4. results_batch_2: 向量补充结果
        5. results_final: 融合排序最终结果
        6. done: 搜索完成
        """
        # Step 1: 发送元数据
        yield self._sse_event("meta", {
            "query": query,
            "search_type": search_type,
            "estimated_count": limit,
        })

        # Step 2: 中文查询标准化
        normalized_query = self.nlp_pipeline.normalize_query(query)
        yield self._sse_event("progress", {
            "step": "normalizing",
            "normalized_query": normalized_query,
        })

        # Step 3: 并行执行 BM25 + 向量搜索
        bm25_results = []
        vector_results = []

        if search_type == "food_materials":
            bm25_results = await self.bm25_searcher.search_food_materials(
                normalized_query, filters=filters, limit=limit
            )
            vector_results = await self.vector_searcher.search_food_materials(
                normalized_query, top_k=limit
            )
        elif search_type == "retail_products":
            bm25_results = await self.bm25_searcher.search_retail_products(
                normalized_query, filters=filters, limit=limit
            )
            vector_results = await self.vector_searcher.search_retail_products(
                normalized_query, top_k=limit
            )

        # Step 4: 发送 BM25 结果 (第一批)
        yield self._sse_event("results_batch_1", {
            "count": len(bm25_results),
            "source": "bm25",
        })

        # Step 5: 发送向量结果 (第二批)
        yield self._sse_event("results_batch_2", {
            "count": len(vector_results),
            "source": "vector",
        })

        # Step 6: 融合排序
        if search_type == "food_materials":
            fused = self.hybrid_searcher.search_food_materials(
                bm25_results, vector_results, query=query
            )
        else:
            fused = self.hybrid_searcher.search_retail_products(
                bm25_results, vector_results, query=query
            )

        # Step 7: 逐条发送最终结果
        for i, item in enumerate(fused[:limit]):
            yield self._sse_event("result_item", item)

        # Step 8: 完成
        yield self._sse_event("done", {
            "total_results": len(fused),
            "returned": min(len(fused), limit),
        })

    @staticmethod
    def _sse_event(event_type: str, data: Dict[str, Any]) -> str:
        """构造 SSE 事件格式"""
        return (
            f"event: {event_type}\n"
            f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
        )

    def create_streaming_response(
        self,
        query: str,
        search_type: str = "food_materials",
        filters: Optional[Dict[str, Any]] = None,
        limit: int = 50,
    ) -> StreamingResponse:
        """创建 SSE StreamingResponse"""
        return StreamingResponse(
            self.generate_stream(query, search_type, filters, limit),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",  # 禁用 Nginx 缓冲
            },
        )
