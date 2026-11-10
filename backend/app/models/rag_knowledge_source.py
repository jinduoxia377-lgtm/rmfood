"""RAG 知识来源（本草古籍书目元数据） — SQLAlchemy 数据模型

用途:
    为已导入 ChromaDB 的 RAG 文档（首批 42 部本草古籍，user_id="system"）
    建立 PostgreSQL 书目登记，支持 SQL 查询 / 审计 / 分块统计。
    清洗清单见 backend/data/ancient_books_md/ancient_books_manifest.json。

设计要点:
    - 与本项目 Base 共用同一 MetaData（app.models.base.Base → app.core.database）。
    - ``metadata`` 是 SQLAlchemy Declarative 保留属性名，故 Python 侧属性名为
      ``metadata_json``，数据库列名保持 ``metadata``（JSONB）。
    - 唯一约束落在 source 上（ancient/<书名>.md），重复导入时可按 source upsert。
    - 时间列使用 TIMESTAMPTZ，并以 now() 作为 server_default，便于
      psycopg2 / SQLAlchemy 两条写入路径都无需显式赋值。

注意:
    本模型只登记书目元数据，不写入向量块；实际回填由 rag 导入脚本负责。
"""
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import BigInteger, DateTime, String, func, text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base


class RagKnowledgeSource(Base):
    """RAG 知识来源（书目元数据）"""

    __tablename__ = "rag_knowledge_sources"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # ancient/本草纲目-明-李时珍.md —— 与 ChromaDB metadata["source"] 对齐
    source: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)

    title: Mapped[str] = mapped_column(String(128), nullable=False)
    dynasty: Mapped[Optional[str]] = mapped_column(String(32), nullable=True, index=True)
    author: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)

    # ancient_book / seed / upload
    category: Mapped[str] = mapped_column(
        String(32),
        nullable=False,
        default="ancient_book",
        server_default=text("'ancient_book'"),
        index=True,
    )

    display_name: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    chunk_count: Mapped[int] = mapped_column(
        nullable=False, default=0, server_default=text("0")
    )
    char_count: Mapped[int] = mapped_column(
        nullable=False, default=0, server_default=text("0")
    )
    checksum: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    user_id: Mapped[str] = mapped_column(
        String(64), nullable=False, default="system", server_default=text("'system'")
    )

    # 额外信息：md_file / original_file / lines / estimated_chunks 等
    metadata_json: Mapped[Optional[Any]] = mapped_column("metadata", JSONB, nullable=True)

    imported_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )

    def to_dict(self) -> dict[str, Any]:
        """将模型转换为字典（对外使用 metadata 作为键名）"""
        result: dict[str, Any] = {}
        for column in self.__table__.columns:
            # 列名 metadata 在 ORM 上映射为 metadata_json，避免取到 Declarative 的 MetaData
            attr = "metadata_json" if column.name == "metadata" else column.name
            result[column.name] = getattr(self, attr)
        return result

    def __repr__(self) -> str:
        return f"<RagKnowledgeSource(id={self.id}, source={self.source!r})>"
