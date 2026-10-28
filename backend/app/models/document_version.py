"""
RAG 知识库文档版本 — SQLAlchemy 数据模型

持久化 DocumentVersionManager 的版本数据和审计日志。
"""
from datetime import datetime

from sqlalchemy import JSON, BigInteger, Column, DateTime, Index, Integer, String

from app.core.database.database import Base


class DocumentVersion(Base):
    """文档版本记录"""
    __tablename__ = "rag_document_versions"

    id = Column(String(36), primary_key=True)
    version = Column(Integer, nullable=False)
    filename = Column(String(512), nullable=False, index=True)
    content_type = Column(String(128), nullable=False, default="text/plain")
    chunk_count = Column(Integer, nullable=False, default=0)
    file_size = Column(BigInteger, nullable=False, default=0)
    checksum = Column(String(64), nullable=False)
    created_at = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    metadata_ = Column(JSON, nullable=False, default=dict)

    __table_args__ = (
        Index("ix_rag_doc_versions_filename_version", "filename", "version", unique=True),
    )


class DocumentAuditLog(Base):
    """文档操作审计日志"""
    __tablename__ = "rag_document_audit_logs"

    id = Column(String(36), primary_key=True)
    action = Column(String(64), nullable=False)  # version_added, version_rollback, version_archived
    filename = Column(String(512), nullable=False, index=True)
    version = Column(Integer, nullable=True)
    from_version = Column(Integer, nullable=True)
    to_version = Column(Integer, nullable=True)
    archived_version = Column(Integer, nullable=True)
    timestamp = Column(DateTime(timezone=True), nullable=False, default=datetime.utcnow)
    details = Column(JSON, nullable=False, default=dict)

    __table_args__ = (
        Index("ix_rag_audit_logs_filename_ts", "filename", "timestamp"),
    )
