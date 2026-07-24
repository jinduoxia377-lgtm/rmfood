"""RMFOOD 系统模型"""
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, DateTime, JSON, ForeignKey, Boolean, BigInteger, CheckConstraint, Index
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base
from app.models.utils import now_utc_mapped


class AuditLog(Base):
    __tablename__ = "audit_logs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    user_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.id"), index=True)
    action: Mapped[str] = mapped_column(String(256), nullable=True, index=True)
    entity_type: Mapped[str | None] = mapped_column(String(50))
    entity_id: Mapped[int | None] = mapped_column(BigInteger)
    details: Mapped[dict | None] = mapped_column(JSON, default=dict)
    ip_address: Mapped[str | None] = mapped_column(String(45))
    request_id: Mapped[str | None] = mapped_column(String(64), index=True)
    username: Mapped[str | None] = mapped_column(String(128))
    user_role: Mapped[str | None] = mapped_column(String(32))
    method: Mapped[str] = mapped_column(String(8), nullable=False)
    path: Mapped[str] = mapped_column(String(512), nullable=False, index=True)
    query_params: Mapped[dict | None] = mapped_column(JSON)
    status_code: Mapped[int | None] = mapped_column(Integer)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    user_agent: Mapped[str | None] = mapped_column(String(512))
    severity: Mapped[str] = mapped_column(String(16), nullable=False, default="low", index=True)
    masked_request_body: Mapped[str | None] = mapped_column(Text)
    masked_response_body: Mapped[str | None] = mapped_column(Text)
    checksum_chain: Mapped[str | None] = mapped_column(String(64))
    error: Mapped[str | None] = mapped_column(Text)
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, nullable=False, index=True)

    __table_args__ = (
        CheckConstraint("jsonb_typeof(details) = 'object'::text", name="ck_audit_log_details_json"),
        Index("ix_audit_logs_created_severity", "created_at", "severity"),
        Index("ix_audit_logs_user_created", "user_id", "created_at"),
        Index("ix_audit_logs_path_created", "path", "created_at"),
    )


class Attachment(Base):
    __tablename__ = "attachments"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    formula_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("formulas.id", ondelete="SET NULL"), index=True)
    experiment_id: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("experiments.id", ondelete="SET NULL"), index=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    original_file_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    file_size: Mapped[int] = mapped_column(BigInteger)
    mime_type: Mapped[str | None] = mapped_column(String(100))
    uploaded_by: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)


class DataSnapshot(Base):
    __tablename__ = "data_snapshots"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    snapshot_id: Mapped[str] = mapped_column(String(50), nullable=False, unique=True)
    source_db: Mapped[str] = mapped_column(String(50), nullable=False)
    total_records: Mapped[int] = mapped_column(BigInteger, default=0)
    checksum: Mapped[str | None] = mapped_column(String(64))
    metadata_: Mapped[dict | None] = mapped_column("metadata", JSON, default=dict)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)


class SystemConfig(Base):
    """系统运行时配置（持久化到数据库，重启后自动恢复）

    用于存储前端通过配置面板保存的 LLM 等服务参数，
    解决后端重启后内存配置丢失的问题。
    """
    __tablename__ = "system_configs"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    config_key: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    config_value: Mapped[dict] = mapped_column(JSON, nullable=False, default=dict)
    updated_by: Mapped[int | None] = mapped_column(BigInteger, ForeignKey("users.id"), nullable=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped)

    def __repr__(self) -> str:
        return f"<SystemConfig(key={self.config_key})>"

    def get_sensitive_keys(self) -> list[str]:
        """
        返回 config_value 中需要加密的键名

        根据 config_key 返回对应的敏感字段列表。
        """
        sensitive_map = {
            "llm_api_key": ["api_key", "key", "token", "password"],
            "database_backup": ["password", "api_key", "secret"],
            "redis_auth": ["password", "token"],
            "oauth": ["client_secret", "api_key", "token"],
        }
        for key, fields in sensitive_map.items():
            if key in self.config_key:
                return fields
        return ["api_key", "secret", "password", "token", "credential"]

    def get_decrypted_value(self) -> dict:
        """
        解密 config_value 中的敏感字段

        Returns:
            解密后的配置字典
        """
        from app.core.security.crypto import decrypt_dict_field
        sensitive_keys = self.get_sensitive_keys()
        return decrypt_dict_field(self.config_value, sensitive_keys)

    def set_encrypted_value(self, data: dict, sensitive_keys: list[str] = None) -> None:
        """
        加密敏感字段后存入 config_value

        Args:
            data: 原始配置字典
            sensitive_keys: 需要加密的键名列表
        """
        from app.core.security.crypto import encrypt_dict_field
        if sensitive_keys is None:
            sensitive_keys = self.get_sensitive_keys()
        self.config_value = encrypt_dict_field(data, sensitive_keys)
