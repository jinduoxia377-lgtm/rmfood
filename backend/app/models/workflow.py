"""RMFOOD 工作流模型"""
from datetime import datetime, timezone
from sqlalchemy import Integer, String, Text, DateTime, JSON, Enum, ForeignKey, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship
from .base import Base
from .enums import WorkflowStatus, TaskStatus
from app.models.utils import now_utc_mapped


class Workflow(Base):
    __tablename__ = "workflows"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    workflow_type: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    status: Mapped[WorkflowStatus] = mapped_column(
        Enum(WorkflowStatus), default=WorkflowStatus.PENDING, nullable=False
    )
    description: Mapped[str | None] = mapped_column(Text)
    config: Mapped[dict | None] = mapped_column(JSON, default=dict)
    result: Mapped[dict | None] = mapped_column(JSON, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text)
    created_by: Mapped[int] = mapped_column(BigInteger, ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped)

    tasks: Mapped[list["WorkflowTask"]] = relationship(
        "WorkflowTask", back_populates="workflow", order_by="WorkflowTask.step_order"
    )


class WorkflowTask(Base):
    __tablename__ = "workflow_tasks"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    workflow_id: Mapped[int] = mapped_column(BigInteger, ForeignKey("workflows.id", ondelete="CASCADE"), index=True)
    step_order: Mapped[int] = mapped_column(Integer, nullable=False)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    task_type: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[TaskStatus] = mapped_column(
        Enum(TaskStatus), default=TaskStatus.PENDING, nullable=False
    )
    input_data: Mapped[dict | None] = mapped_column(JSON, default=dict)
    output_data: Mapped[dict | None] = mapped_column(JSON, default=dict)
    error_message: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    duration_ms: Mapped[int | None] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)

    workflow: Mapped["Workflow"] = relationship("Workflow", back_populates="tasks")


class WorkflowTemplate(Base):
    """工作流模板表——驱动可视化编辑器的预设模板，替代硬编码"""

    __tablename__ = "workflow_templates"

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    template_id: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True, comment="模板ID，如 ai-formula-gen")
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(50), nullable=False, index=True, comment="ai_generation|review|data_sync|analysis|custom")
    icon: Mapped[str | None] = mapped_column(String(20))
    node_definitions: Mapped[dict | None] = mapped_column(JSON, comment="节点定义列表，JSON 格式")
    edge_definitions: Mapped[dict | None] = mapped_column(JSON, comment="边定义列表，JSON 格式")
    preset_config: Mapped[dict | None] = mapped_column(JSON, comment="预设配置参数")
    is_active: Mapped[bool] = mapped_column(Integer, default=1, nullable=False)
    node_count: Mapped[int | None] = mapped_column(Integer, comment="节点总数")
    estimated_duration: Mapped[str | None] = mapped_column(String(100), comment="预估执行时长")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "template_id": self.template_id,
            "name": self.name,
            "description": self.description,
            "category": self.category,
            "icon": self.icon,
            "node_count": self.node_count,
            "estimated_duration": self.estimated_duration,
            "nodes": self.node_definitions or [],
            "edges": self.edge_definitions or [],
            "preset_config": self.preset_config or {},
        }


from .user_model import User
