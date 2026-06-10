"""
RAG（检索增强生成）领域实体（M2.1）

定义知识检索的核心实体：文档块、嵌入向量、检索结果。
不依赖任何向量数据库或 Embedding 模型。
"""
from __future__ import annotations
from dataclasses import dataclass, field
from datetime import datetime
from typing import Optional


@dataclass
class DocumentChunk:
    """文档块"""
    id: str
    content: str               # 文本内容
    source: str                # 来源（文件名/URL）
    source_type: str           # 来源类型：patent/paper/tcmsp/dfbp/regulation/internal
    metadata: dict = field(default_factory=dict)
    chunk_index: int = 0       # 在原始文档中的块序号
    created_at: datetime = field(default_factory=datetime.utcnow)


@dataclass
class EmbeddedChunk:
    """已嵌入的文档块（带向量）"""
    chunk: DocumentChunk
    vector: list[float]
    model: str                 # 使用的 Embedding 模型名


@dataclass
class RetrievalResult:
    """检索结果"""
    chunk: DocumentChunk
    score: float               # 相似度分数 (0-1)
    rank: int                  # 排序位置

    @property
    def is_relevant(self) -> bool:
        return self.score > 0.5


@dataclass
class RetrievalQuery:
    """检索查询"""
    text: str
    top_k: int = 5
    score_threshold: float = 0.5
    source_types: Optional[list[str]] = None  # 限制来源类型
    metadata_filter: dict = field(default_factory=dict)


@dataclass
class RAGContext:
    """RAG 上下文（组装给 LLM 的检索结果）"""
    query: str
    results: list[RetrievalResult]
    max_tokens: int = 4000

    def to_context_string(self, max_chars: int = 8000) -> str:
        """将检索结果格式化为 LLM 上下文文本"""
        parts = []
        used_chars = 0
        for r in self.results:
            header = f"[来源: {r.chunk.source} | 类型: {r.chunk.source_type} | 相关度: {r.score:.2f}]\n"
            content = f"{r.chunk.content}\n"
            entry = header + content
            if used_chars + len(entry) > max_chars:
                break
            parts.append(entry)
            used_chars += len(entry)

        if not parts:
            return ""

        return "以下是与问题相关的研究资料：\n\n" + "\n---\n".join(parts)

    def get_sources(self) -> list[str]:
        """获取来源列表（用于引用溯源）"""
        seen = set()
        sources = []
        for r in self.results:
            key = f"{r.chunk.source} ({r.chunk.source_type})"
            if key not in seen:
                seen.add(key)
                sources.append(key)
        return sources


# ─── 知识库索引 ───


@dataclass
class KnowledgeBase:
    """知识库元信息"""
    id: str
    name: str
    description: str
    source_type: str           # patent/tcmsp/dfbp/regulation/internal
    chunk_count: int = 0
    last_indexed: Optional[datetime] = None
