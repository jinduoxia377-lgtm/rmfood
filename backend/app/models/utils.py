"""RMFOOD 模型通用工具

提供所有模型共享的工具函数和类型定义。
"""
from datetime import datetime, timezone
from sqlalchemy import BigInteger, DateTime, CheckConstraint
from sqlalchemy.orm import Mapped, mapped_column


def now_utc() -> datetime:
    """获取当前 UTC 时间（带时区信息）"""
    return datetime.now(timezone.utc)


def now_utc_naive() -> datetime:
    """
    获取当前 UTC 时间（无时区的 naive UTC）。

    用于 DB 列定义为 timestamp without time zone 的表（如 audit_logs、experiments、
    experiment_data 等）。返回的 naive datetime 表示 UTC 墙钟时间，与
    datetime.utcnow() 语义一致。

    为什么是"UTC 墙钟"而非本地时间：
    - 本项目的 DB 会话时区为 Asia/Shanghai，若用 datetime.now() 会写入本地墙钟，
      与 users.last_login 等列（经 aware-UTC 写入、SQLAlchemy 剥离时区后存 UTC 墙钟）
      产生不一致，导致跨表时间比较出偏差。
    - 带时区 datetime 写入 naive 列会触发 asyncpg 的
      "can't subtract offset-naive and offset-aware datetimes" 错误。
    """
    return datetime.now(timezone.utc).replace(tzinfo=None)


def now_utc_mapped() -> datetime:
    """
    作为 mapped_column default 使用的时区感知 UTC 时间。
    与 DateTime(timezone=True) 配合使用时，SQLAlchemy 会自动处理时区转换。
    """
    return datetime.now(timezone.utc)


def big_int_pk() -> Mapped[int]:
    """BigInteger 自增主键"""
    return mapped_column(BigInteger, primary_key=True, autoincrement=True)


def utc_timestamp_col(default=True, onupdate=False, nullable=True, index=False) -> Mapped[datetime]:
    """带时区的 UTC 时间戳列"""
    kwargs: dict = {"timezone": True}
    if default:
        kwargs["default"] = now_utc_mapped
    if onupdate:
        kwargs["onupdate"] = now_utc_mapped
    if nullable:
        kwargs["nullable"] = None
    if index:
        kwargs["index"] = True
    return mapped_column(DateTime(**kwargs), **({"nullable": None} if nullable else {}))


def audit_json_check_constraint(table_name: str = "audit_logs") -> CheckConstraint:
    """审计日志 JSON 格式校验约束"""
    return CheckConstraint(
        f"json_typeof(details) = 'object'::text",
        name=f"ck_{table_name}_details_json",
    )
