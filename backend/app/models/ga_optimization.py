"""GA/NSGA-II 优化结果持久化模型

用于存储遗传算法和多目标优化的运行记录与候选方案详情，
支持历史查询、详情查看和进化过程追溯。
"""

from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    BigInteger,
    Column,
    DateTime,
    Float,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from ..core.database import Base


class GARunRecord(Base):
    """遗传算法运行记录"""
    __tablename__ = "ga_run_records"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    run_id = Column(String(64), unique=True, nullable=False, index=True, comment="运行唯一ID")
    user_id = Column(BigInteger, ForeignKey("users.id"), nullable=False, index=True, comment="用户ID")

    # 运行类型
    algorithm_type = Column(String(32), nullable=False, default="genetic", comment="genetic/nsga2")
    mode = Column(String(20), nullable=False, default="single", comment="single/multi-objective")

    # 输入参数 (JSON)
    target_effects = Column(JSON, nullable=True, comment="目标功效列表")
    algorithm_params = Column(JSON, nullable=False, comment="算法参数快照")
    objectives_config = Column(JSON, nullable=True, comment="多目标配置(仅MO模式)")
    constraints = Column(JSON, nullable=True, comment="约束条件")
    preset_name = Column(String(50), nullable=True, comment="使用的预设名称")

    # 输出结果摘要
    total_generations = Column(Integer, default=0)
    total_evaluations = Column(Integer, default=0)
    best_fitness = Column(Float, default=0.0)
    execution_time_ms = Column(Float, default=0.0)
    convergence_generation = Column(Integer, default=0)
    stop_reason = Column(String(30), default="completed")
    final_diversity = Column(Float, default=0.0)
    candidate_count = Column(Integer, default=0)

    # 完整结果 (JSON)
    candidates = Column(JSON, nullable=True, comment="候选方案列表")
    pareto_front = Column(JSON, nullable=True, comment="Pareto前沿坐标")
    history = Column(JSON, nullable=True, comment="进化历史记录")
    best_by_objective = Column(JSON, nullable=True, comment="各目标最优解")

    # 元数据
    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    # 关联
    user = relationship("User", back_populates="ga_runs")
    candidate_details = relationship("GACandidateRecord", back_populates="run", cascade="all, delete-orphan")

    __table_args__ = (
        Index("idx_ga_run_user_type", "user_id", "algorithm_type"),
        Index("idx_ga_run_created", "created_at"),
    )


class GACandidateRecord(Base):
    """GA 候选方案详细记录"""
    __tablename__ = "ga_candidate_records"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    run_id = Column(String(64), ForeignKey("ga_run_records.run_id"), nullable=False, index=True)
    rank_in_run = Column(Integer, default=0, comment="本次运行中的排名")
    pareto_rank = Column(Integer, default=0, comment="Pareto秩(0=前沿)")
    crowding_distance = Column(Float, default=0.0)

    # 配方组成
    ingredients = Column(JSON, nullable=False, comment="[{id, name_cn, dosage}]")
    ingredient_count = Column(Integer, default=0)
    total_dosage = Column(Float, default=0.0)

    # 多维评分
    efficacy_score = Column(Float, default=0.0)
    safety_score = Column(Float, default=0.0)
    taste_score = Column(Float, default=0.0)
    cost_score = Column(Float, default=0.0)
    synergy_score = Column(Float, default=0.0)
    stability_score = Column(Float, default=0.0)
    admet_score = Column(Float, default=0.0)
    overall_fitness = Column(Float, default=0.0)
    objective_scores = Column(JSON, nullable=True, comment="{key: score}")

    # 说明
    explanation = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), default=lambda: datetime.now(timezone.utc))

    run = relationship("GARunRecord", back_populates="candidate_details")
