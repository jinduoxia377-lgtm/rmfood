"""RAG 检索增强生成服务模块

提供基于 ChromaDB 的文档知识库问答功能：
- 文档解析与分块（PDF/TXT/CSV/MD）
- 向量化存储（ChromaDB）
- 语义检索（余弦相似度）
- Prompt 增强（检索结果注入）
"""

from .rag_service import RAGService, rag_service

__all__ = ["RAGService", "rag_service"]
