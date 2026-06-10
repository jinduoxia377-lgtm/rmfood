"""
RAG 端口接口（M2.1）

向量存储、嵌入生成、文档处理的抽象接口。
"""
from abc import ABC, abstractmethod
from typing import Optional

from .rag import DocumentChunk, EmbeddedChunk, RetrievalQuery, RetrievalResult, KnowledgeBase


class VectorStore(ABC):
    """向量存储接口"""

    @abstractmethod
    async def store_embeddings(self, chunks: list[EmbeddedChunk]) -> int:
        """存储嵌入向量，返回成功存储数"""
        ...

    @abstractmethod
    async def search(self, query_vector: list[float], query: RetrievalQuery) -> list[RetrievalResult]:
        """根据向量检索相似块"""
        ...

    @abstractmethod
    async def delete_collection(self, collection_name: str) -> None:
        """删除集合"""
        ...

    @abstractmethod
    async def collection_stats(self, collection_name: str) -> dict:
        """获取集合统计信息"""
        ...


class EmbeddingService(ABC):
    """嵌入生成服务接口"""

    @abstractmethod
    async def embed_text(self, text: str) -> list[float]:
        """将文本转为嵌入向量"""
        ...

    @abstractmethod
    async def embed_batch(self, texts: list[str]) -> list[list[float]]:
        """批量将文本转为嵌入向量"""
        ...

    @property
    @abstractmethod
    def dimension(self) -> int:
        """向量维度"""
        ...

    @property
    @abstractmethod
    def model_name(self) -> str:
        """模型名称"""
        ...


class DocumentProcessor(ABC):
    """文档处理器接口"""

    @abstractmethod
    async def process_text(self, text: str, source: str, source_type: str, metadata: dict = None) -> list[DocumentChunk]:
        """处理文本，分割为文档块"""
        ...

    @abstractmethod
    async def process_file(self, file_path: str, source_type: str) -> list[DocumentChunk]:
        """处理文件，解析并分割为文档块"""
        ...
