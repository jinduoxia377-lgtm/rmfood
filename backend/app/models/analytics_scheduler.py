"""
Analytics Scheduler Job Model — 定时报表任务持久化

支持:
- 任务列表查询（API 加载时从 DB 读取）
- 任务创建（API 写入时同步到 DB）
- 任务删除（API 删除时同步清理 DB）
- 启动时自动注册所有持久化任务
"""
from __future__ import annotations

import json
from datetime import datetime
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class AnalyticsSchedulerJob(BaseModel):
    __tablename__ = "analytics_scheduler_jobs"

    template_id: Mapped[str] = mapped_column(
        "template_id", index=True, comment="报表模板 ID"
    )
    cron_expr: Mapped[str] = mapped_column(
        "cron_expr", comment="Cron 表达式"
    )
    recipients: Mapped[str] = mapped_column(
        "recipients", comment="收件人列表（JSON 数组字符串）"
    )
    settings: Mapped[str] = mapped_column(
        "settings", comment="SMTP 等配置（JSON 字符串）"
    )
    enabled: Mapped[bool] = mapped_column(
        "enabled", default=True, comment="是否启用"
    )
    last_run: Mapped[Optional[datetime]] = mapped_column(
        "last_run", nullable=True, comment="上次运行时间"
    )
    next_run: Mapped[Optional[datetime]] = mapped_column(
        "next_run", nullable=True, comment="下次运行时间"
    )

    @property
    def recipient_list(self) -> List[str]:
        try:
            return json.loads(self.recipients) if self.recipients else []
        except json.JSONDecodeError:
            return []

    @property
    def settings_dict(self) -> Dict[str, Any]:
        try:
            return json.loads(self.settings) if self.settings else {}
        except json.JSONDecodeError:
            return {}

    def to_dict(self) -> Dict[str, Any]:
        return {
            "id": self.id,
            "job_id": f"job_{self.template_id}",
            "template_id": self.template_id,
            "cron": self.cron_expr,
            "recipients": self.recipient_list,
            "settings": self.settings_dict,
            "enabled": self.enabled,
            "last_run": self.last_run.isoformat() if self.last_run else None,
            "next_run": self.next_run.isoformat() if self.next_run else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }


# ── 纯函数工具（无需 DB 会话即可调用）───────────────────────

CREATE_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS analytics_scheduler_jobs (
    id            BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
    template_id   VARCHAR(100) NOT NULL,
    cron_expr     VARCHAR(100) NOT NULL DEFAULT '0 9 * * *',
    recipients    TEXT,
    settings      TEXT,
    enabled       BOOLEAN NOT NULL DEFAULT TRUE,
    last_run      TIMESTAMPTZ,
    next_run      TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_asj_template ON analytics_scheduler_jobs(template_id);
"""


async def ensure_table_exists(db) -> None:
    """确保数据表存在（幂等）。"""
    await db.execute(text(CREATE_TABLE_SQL))
    await db.commit()


async def load_all_jobs(db) -> List[AnalyticsSchedulerJob]:
    """从数据库加载所有启用的任务。"""
    from sqlalchemy import select as sa_select
    result = await db.execute(
        sa_select(AnalyticsSchedulerJob).order_by(AnalyticsSchedulerJob.created_at.desc())
    )
    return list(result.scalars().all())


async def upsert_job(
    db,
    job_id: str,
    template_id: str,
    cron_expr: str,
    recipients: List[str],
    settings: Dict[str, Any],
) -> AnalyticsSchedulerJob:
    """创建或更新定时任务。"""
    from sqlalchemy import select as sa_select
    existing = await db.execute(
        sa_select(AnalyticsSchedulerJob).where(
            AnalyticsSchedulerJob.template_id == template_id
        )
    )
    existing_row = existing.scalar_one_or_none()

    if existing_row:
        existing_row.cron_expr = cron_expr
        existing_row.recipients = json.dumps(recipients, ensure_ascii=False)
        existing_row.settings = json.dumps(settings, ensure_ascii=False)
        existing_row.enabled = True
        await db.commit()
        await db.refresh(existing_row)
        return existing_row
    else:
        new_job = AnalyticsSchedulerJob(
            template_id=template_id,
            cron_expr=cron_expr,
            recipients=json.dumps(recipients, ensure_ascii=False),
            settings=json.dumps(settings, ensure_ascii=False),
            enabled=True,
        )
        db.add(new_job)
        await db.commit()
        await db.refresh(new_job)
        return new_job


async def remove_job(db, template_id: str) -> bool:
    """按模板 ID 删除定时任务。"""
    from sqlalchemy import delete as sa_delete
    result = await db.execute(
        sa_delete(AnalyticsSchedulerJob).where(
            AnalyticsSchedulerJob.template_id == template_id
        )
    )
    await db.commit()
    return result.rowcount > 0
