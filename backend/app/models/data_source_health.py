"""RMFOOD 数据源健康监控模型

记录外部数据源（TCMSP、DFBP 等）的可用性、延迟和同步状态。
用于监控数据源健康状况，及时发现和处理数据源故障。
"""
from datetime import datetime, timezone
from typing import Optional
import enum

from sqlalchemy import Integer, String, Float, Boolean, DateTime, JSON, Enum as SAEnum, BigInteger
from sqlalchemy.orm import Mapped, mapped_column
from .base import Base
from app.models.utils import now_utc_mapped


class DataSourceStatus(str, enum.Enum):
    """数据源状态"""
    HEALTHY = "healthy"           # 健康
    DEGRADED = "degraded"         # 降级（延迟高或部分功能不可用）
    UNHEALTHY = "unhealthy"       # 不健康（无法连接）
    UNKNOWN = "unknown"           # 未知（未检测）


class DataSourceType(str, enum.Enum):
    """数据源类型"""
    TCMSP = "tcmsp"               # TCMSP 中药系统药理学数据库
    DFBP = "dfbp"                 # DFBP 食品生物活性肽数据库
    NEO4J = "neo4j"               # Neo4j 图数据库
    ELASTICSEARCH = "elasticsearch"  # Elasticsearch 搜索引擎
    REDIS = "redis"               # Redis 缓存
    LLM = "llm"                   # LLM 服务
    EXTERNAL_API = "external_api" # 其他外部 API


class DataSourceHealth(Base):
    """
    数据源健康记录表

    记录每个数据源的：
    - 连接状态（健康/降级/不健康）
    - 响应延迟（毫秒）
    - 最后同步时间
    - 同步统计（成功/失败次数）
    - 错误信息
    """
    __tablename__ = "data_source_health"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)

    # 数据源标识
    source_type: Mapped[DataSourceType] = mapped_column(
        SAEnum(DataSourceType), nullable=False, unique=True, index=True,
        comment="数据源类型"
    )
    source_name: Mapped[str] = mapped_column(
        String(100), nullable=False,
        comment="数据源显示名称"
    )
    source_url: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True,
        comment="数据源 URL"
    )

    # 健康状态
    status: Mapped[DataSourceStatus] = mapped_column(
        SAEnum(DataSourceStatus), default=DataSourceStatus.UNKNOWN, nullable=False,
        comment="当前健康状态"
    )
    last_check_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
        comment="最后检查时间"
    )
    last_healthy_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
        comment="最后健康时间"
    )

    # 性能指标
    latency_ms: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True,
        comment="最后响应延迟（毫秒）"
    )
    avg_latency_ms: Mapped[Optional[float]] = mapped_column(
        Float, nullable=True,
        comment="平均响应延迟（毫秒）"
    )

    # 同步统计
    last_sync_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True,
        comment="最后同步时间"
    )
    sync_success_count: Mapped[int] = mapped_column(
        Integer, default=0,
        comment="同步成功次数"
    )
    sync_failure_count: Mapped[int] = mapped_column(
        Integer, default=0,
        comment="同步失败次数"
    )
    last_sync_records: Mapped[int] = mapped_column(
        Integer, default=0,
        comment="最后同步记录数"
    )

    # 错误信息
    last_error: Mapped[Optional[str]] = mapped_column(
        String(500), nullable=True,
        comment="最后错误信息"
    )
    error_count: Mapped[int] = mapped_column(
        Integer, default=0,
        comment="连续错误次数"
    )

    # 配置信息
    config: Mapped[Optional[dict]] = mapped_column(
        JSON, default=dict,
        comment="数据源配置（脱敏）"
    )

    # 时间戳
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped, nullable=False)

    @property
    def is_available(self) -> bool:
        """数据源是否可用"""
        return self.status in (DataSourceStatus.HEALTHY, DataSourceStatus.DEGRADED)

    @property
    def sync_success_rate(self) -> float:
        """同步成功率"""
        success = self.sync_success_count or 0
        failure = self.sync_failure_count or 0
        total = success + failure
        if total == 0:
            return 0.0
        return (success / total) * 100

    def to_dict(self) -> dict:
        """转换为字典"""
        return {
            "id": self.id,
            "source_type": self.source_type.value,
            "source_name": self.source_name,
            "status": self.status.value,
            "is_available": self.is_available,
            "latency_ms": self.latency_ms,
            "avg_latency_ms": self.avg_latency_ms,
            "last_check_at": self.last_check_at.isoformat() if self.last_check_at else None,
            "last_healthy_at": self.last_healthy_at.isoformat() if self.last_healthy_at else None,
            "last_sync_at": self.last_sync_at.isoformat() if self.last_sync_at else None,
            "sync_success_count": self.sync_success_count or 0,
            "sync_failure_count": self.sync_failure_count or 0,
            "sync_success_rate": round(self.sync_success_rate, 2),
            "last_sync_records": self.last_sync_records or 0,
            "last_error": self.last_error,
            "error_count": self.error_count or 0,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }

    def __repr__(self) -> str:
        return f"<DataSourceHealth({self.source_type.value}, status={self.status.value}, latency={self.latency_ms}ms)>"
