"""RAG 数据模型"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime


class DocumentChunk(BaseModel):
    """文档分块"""
    id: str
    content: str
    metadata: dict = Field(default_factory=dict)
    embedding: Optional[list[float]] = None


class ChunkResult(BaseModel):
    """检索结果"""
    chunk: DocumentChunk
    score: float


class RAGQueryResult(BaseModel):
    """RAG 查询结果"""
    chunks: list[ChunkResult]
    augmented_prompt: str
    total_chunks: int


class DocumentInfo(BaseModel):
    """文档信息"""
    id: str
    filename: str
    content_type: str
    chunk_count: int
    created_at: datetime
    file_size: int
