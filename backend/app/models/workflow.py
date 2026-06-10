"""RMFOOD 工作流模型"""
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, DateTime, JSON, Enum, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship
from ..core.database import Base
from .enums import WorkflowStatus, TaskStatus


def _now() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class Workflow(Base):
    __tablename__ = "workflows"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    workflow_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    status: Mapped[WorkflowStatus] = mapped_column(
        Enum(WorkflowStatus), default=WorkflowStatus.PENDING, nullable=False
    )
    description: Mapped[str | None] = mapped_column(Text)
    config: Mapped[dict | None] = mapped_column(JSON, default=dict)
    result: Mapped[dict | None] = mapped_column(JSON, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=_now, onupdate=_now)

    tasks: Mapped[list["WorkflowTask"]] = relationship(
        "WorkflowTask", back_populates="workflow", order_by="WorkflowTask.step_order"
    )


class WorkflowTask(Base):
    __tablename__ = "workflow_tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    workflow_id: Mapped[int] = mapped_column(Integer, ForeignKey("workflows.id", ondelete="CASCADE"))
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    task_type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus), default=TaskStatus.PENDING, nullable=False
    )
    input_data: Mapped[dict | None] = mapped_column(JSON, default=dict)
    output_data: Mapped[dict | None] = mapped_column(JSON, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime)
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_now)

    workflow: Mapped["Workflow"] = relationship("Workflow", back_populates="tasks")


from .user_model import User
