"""
协同配方深度集成 - 数据库模型定义

功能:
- SynergyRecord: 协同效应分析记录
- OptimizationResult: 配比优化结果
- CompatibilityReport: 兼容性检测报告
- EffectPrediction: 效果预测记录
- SafetyAlertLog: 安全预警日志
- FormulaGenerationHistory: 配方生成历史
- LabValidationData: 实验室验证数据对接
- SafetyThresholdChangeLog: 安全阈值变更审计日志
"""

import enum
from datetime import datetime
from typing import Optional

from sqlalchemy import JSON, BigInteger, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.utils import now_utc_mapped

from .base import Base

# ==================== 枚举类型 ====================

class SynergyMechanismType(str, enum.Enum):
    BLISS_INDEPENDENCE = "bliss_independence"
    PK_INTERACTION = "pk_interaction"
    GIBBS_STABILITY = "gibbs_stability"
    NETWORK_PHARMACOLOGY = "network_pharmacology"
    TASTE_MATRIX = "taste_matrix"


class AlertLevel(str, enum.Enum):
    INFO = "info"
    WARNING = "warning"
    CRITICAL = "critical"


class GenerationMode(str, enum.Enum):
    STANDARD = "standard"
    DEEP_INTEGRATION = "deep_integration"


class ValidationStatus(str, enum.Enum):
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    FAILED = "failed"


# ==================== 模型1: 协同效应记录 ====================

class SynergyRecord(Base):
    """协同效应分析结果持久化"""

    __tablename__ = 'synergy_records'

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped, nullable=False)

    # 成分对信息
    ingredient_a: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    ingredient_b: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # 综合指标
    overall_si: Mapped[float] = mapped_column(Float, nullable=False)
    confidence: Mapped[float] = mapped_column(Float, default=0.8)
    dominant_mechanism: Mapped[Optional[str]] = mapped_column(String(50), nullable=True)

    # 5种机制得分 (JSON存储，便于扩展)
    mechanism_scores: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)

    # 分析上下文参数
    context_params: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)

    # 关联用户和配方
    user_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey('users.id'), nullable=True, index=True)
    formula_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey('formulas.id'), nullable=True, index=True)

    # 版本控制
    data_version: Mapped[str] = mapped_column(String(20), default='v1.0')
    source_reference: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # 关系
    user: Mapped[Optional["User"]] = relationship("User", backref="synergy_records")
    formula: Mapped[Optional["Formula"]] = relationship("Formula", backref="synergy_records")

    def __repr__(self):
        return f"<SynergyRecord {self.ingredient_a}+{self.ingredient_b} SI={self.overall_si:.3f}>"


# ==================== 模型2: 配比优化结果 ====================

class OptimizationResultRecord(Base):
    """NSGA-III优化结果持久化"""

    __tablename__ = 'optimization_results'

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped, nullable=False)

    # 关联的配方生成请求
    generation_request_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)

    # 输入成分列表 (JSON)
    ingredients_input: Mapped[dict] = mapped_column(JSON, nullable=False)

    # 优化配置参数
    optimization_config: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)

    # Pareto前沿解集 (JSON数组)
    pareto_solutions: Mapped[Optional[list]] = mapped_column(JSON, default=list)

    # 最优解详情
    best_solution: Mapped[Optional[dict]] = mapped_column(JSON, nullable=True)

    # 性能指标
    computation_time_ms: Mapped[float] = mapped_column(Float, nullable=False)
    solution_count: Mapped[int] = mapped_column(Integer, default=0)
    diversity_metric: Mapped[float] = mapped_column(Float, default=0.0)
    generations_completed: Mapped[int] = mapped_column(Integer, default=0)

    # 4维目标函数值
    efficacy_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    safety_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    stability_score: Mapped[Optional[float]] = mapped_column(Float, nullable=True)
    cost_efficiency: Mapped[Optional[float]] = mapped_column(Float, nullable=True)

    # 推荐理由
    recommendation_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 缓存命中标记
    cache_hit: Mapped[bool] = mapped_column(Boolean, default=False)

    def __repr__(self):
        return f"<OptimizationResult {self.generation_request_id} solutions={self.solution_count}>"


# ==================== 模型3: 兼容性报告 ====================

class CompatibilityReportRecord(Base):
    """兼容性检测结果持久化"""

    __tablename__ = 'compatibility_reports'

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped, nullable=False)

    # 关联配方
    formula_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey('formulas.id'), nullable=True, index=True)

    # 总体评分 (0-100)
    overall_score: Mapped[float] = mapped_column(Float, nullable=False)

    # 问题列表 (JSON数组)
    issues: Mapped[Optional[list]] = mapped_column(JSON, default=list)

    # 统计信息
    passed_checks: Mapped[int] = mapped_column(Integer, default=0)
    total_checks: Mapped[int] = mapped_column(Integer, default=0)
    error_count: Mapped[int] = mapped_column(Integer, default=0)
    warning_count: Mapped[int] = mapped_column(Integer, default=0)
    info_count: Mapped[int] = mapped_column(Integer, default=0)

    # 修改建议
    recommendations: Mapped[Optional[list]] = mapped_column(JSON, default=list)

    # 目标人群
    target_population: Mapped[str] = mapped_column(String(20), default='adult')

    # 关系
    formula: Mapped[Optional["Formula"]] = relationship("Formula", backref="compatibility_reports")

    @property
    def is_safe(self) -> bool:
        return self.error_count == 0 and self.overall_score >= 70

    def __repr__(self):
        return f"<CompatibilityReport score={self.overall_score} errors={self.error_count}>"


# ==================== 模型4: 效果预测记录 ====================

class EffectPredictionRecord(Base):
    """PopPK/PD效果预测结果持久化"""

    __tablename__ = 'effect_predictions'

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped, nullable=False)

    # 关联配方
    formula_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey('formulas.id'), nullable=True, index=True)

    # 核心指标
    peak_time_tmax: Mapped[float] = mapped_column(Float, nullable=False)  # 小时
    peak_concentration_cmax: Mapped[float] = mapped_column(Float, nullable=False)  # μg/mL
    max_effect_emax: Mapped[float] = mapped_column(Float, nullable=False)  # 归一化 0-1
    effect_duration: Mapped[float] = mapped_column(Float, nullable=False)  # 小时
    auc_value: Mapped[float] = mapped_column(Float, nullable=False)  # μg·h/mL

    # 最佳服用窗口
    optimal_window_start: Mapped[float] = mapped_column(Float, nullable=False)
    optimal_window_end: Mapped[float] = mapped_column(Float, nullable=False)

    # 曲线数据 (JSON序列化)
    ct_curve_data: Mapped[Optional[list]] = mapped_column(JSON, default=list)  # 时效曲线
    et_curve_data: Mapped[Optional[list]] = mapped_column(JSON, default=list)  # 效应曲线
    visualization_data: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)  # 图表数据

    # 预测参数
    body_weight_kg: Mapped[float] = mapped_column(Float, default=70.0)
    simulation_hours: Mapped[float] = mapped_column(Float, default=24.0)
    time_points_count: Mapped[int] = mapped_column(Integer, default=100)

    # 关系
    formula: Mapped[Optional["Formula"]] = relationship("Formula", backref="effect_predictions")

    def __repr__(self):
        return f"<EffectPrediction Tmax={self.peak_time_tmax}h Emax={self.max_effect_emax:.2f}>"


# ==================== 模型5: 安全预警日志 ====================

class SafetyAlertLog(Base):
    """安全检查预警日志"""

    __tablename__ = 'safety_alert_logs'

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped, nullable=False)

    # 关联配方/成分
    ingredient_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    formula_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey('formulas.id'), nullable=True, index=True)

    # 预警级别
    alert_level: Mapped[AlertLevel] = mapped_column(SAEnum(AlertLevel), nullable=False, index=True)

    # 参数信息
    parameter: Mapped[str] = mapped_column(String(50), nullable=False)
    current_value: Mapped[float] = mapped_column(Float, nullable=False)
    threshold_value: Mapped[float] = mapped_column(Float, nullable=False)
    percentage_of_threshold: Mapped[float] = mapped_column(Float, nullable=False)

    # 预警内容
    message: Mapped[str] = mapped_column(Text, nullable=False)
    recommendation: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 是否阻断操作
    is_blocking: Mapped[bool] = mapped_column(Boolean, default=False)

    # 目标人群
    target_group: Mapped[str] = mapped_column(String(20), default='adult')

    # 操作人（管理员更新时）
    operator_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey('users.id'), nullable=True, index=True)

    # 关系
    formula: Mapped[Optional["Formula"]] = relationship("Formula", backref="safety_alert_logs")
    operator: Mapped[Optional["User"]] = relationship("User", backref="safety_alert_logs_operated")

    def __repr__(self):
        return f"<SafetyAlert {self.ingredient_name} {self.alert_level.value} {self.percentage_of_threshold:.1f}%>"


# ==================== 模型6: 配方生成历史 ====================

class FormulaGenerationHistory(Base):
    """完整的配方生成管线历史记录"""

    __tablename__ = 'formula_generation_history'

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped, nullable=False)

    # 请求标识
    request_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)

    # 用户
    user_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('users.id'), nullable=False, index=True)

    # 生成模式
    mode: Mapped[GenerationMode] = mapped_column(SAEnum(GenerationMode), default=GenerationMode.DEEP_INTEGRATION)

    # 输入参数
    input_ingredients: Mapped[list] = mapped_column(JSON, nullable=False)
    target_efficacy: Mapped[float] = mapped_column(Float, default=0.75)
    safety_priority: Mapped[bool] = mapped_column(Boolean, default=True)
    target_population: Mapped[str] = mapped_column(String(20), default='adult')

    # 输出结果 (关联各子表ID)
    synergy_record_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey('synergy_records.id'), nullable=True, index=True)
    optimization_result_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey('optimization_results.id'), nullable=True, index=True)
    compatibility_report_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey('compatibility_reports.id'), nullable=True, index=True)
    effect_prediction_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey('effect_predictions.id'), nullable=True, index=True)

    # 性能统计
    total_generation_time_ms: Mapped[float] = mapped_column(Float, nullable=False)
    cache_hit: Mapped[bool] = mapped_column(Boolean, default=False)

    # 最终状态
    success: Mapped[bool] = mapped_column(Boolean, default=False)
    error_message: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 综合推荐
    recommendations: Mapped[Optional[list]] = mapped_column(JSON, default=list)

    # 关系
    user: Mapped["User"] = relationship("User", backref="formula_generations")
    synergy_record: Mapped[Optional["SynergyRecord"]] = relationship("SynergyRecord", backref="generation_history")
    optimization_result: Mapped[Optional["OptimizationResultRecord"]] = relationship("OptimizationResultRecord", backref="generation_history")
    compatibility_report: Mapped[Optional["CompatibilityReportRecord"]] = relationship("CompatibilityReportRecord", backref="generation_history")
    effect_prediction: Mapped[Optional["EffectPredictionRecord"]] = relationship("EffectPredictionRecord", backref="generation_history")

    def __repr__(self):
        return f"<FormulaGenHistory {self.request_id} mode={self.mode.value} success={self.success}>"


# ==================== 模型7: 实验室验证数据 ====================

class LabValidationData(Base):
    """实验室验证数据对接模型"""

    __tablename__ = 'lab_validation_data'

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped, nullable=False)

    # 关联的配方或成分
    target_type: Mapped[str] = mapped_column(String(20), nullable=False)
    target_id: Mapped[Optional[int]] = mapped_column(BigInteger, nullable=True)
    target_name: Mapped[str] = mapped_column(String(200), nullable=False, index=True)

    # 实验元数据
    experiment_id: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    lab_name: Mapped[str] = mapped_column(String(200), nullable=False)
    experiment_date: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    researcher_name: Mapped[str] = mapped_column(String(100), nullable=False)

    # 验证状态
    status: Mapped[ValidationStatus] = mapped_column(SAEnum(ValidationStatus), default=ValidationStatus.PENDING)

    # 实验方法
    method_description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    equipment_used: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 测量数据 (JSON格式，灵活适应不同实验类型)
    measured_parameters: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    raw_data_file_path: Mapped[Optional[str]] = mapped_column(String(500), nullable=True)

    # 对比分析
    predicted_values: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)
    deviation_analysis: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)

    # 结论
    validation_result: Mapped[Optional[str]] = mapped_column(String(20), nullable=True)
    conclusion_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)

    # 质量控制
    qc_passed: Mapped[bool] = mapped_column(Boolean, default=False)
    reviewer_id: Mapped[Optional[int]] = mapped_column(BigInteger, ForeignKey('users.id'), nullable=True, index=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime(timezone=True), nullable=True)

    # 关系
    reviewer: Mapped[Optional["User"]] = relationship("User", backref="lab_validations_reviewed")

    @property
    def is_validated(self) -> bool:
        return self.status == ValidationStatus.COMPLETED and self.validation_result == 'passed'

    def __repr__(self):
        return f"<LabValidation {self.experiment_id} {self.target_name} status={self.status.value}>"


# ==================== 模型8: 安全阈值配置历史 ====================

class SafetyThresholdChangeLog(Base):
    """安全阈值变更审计日志"""

    __tablename__ = 'safety_threshold_change_log'

    id: Mapped[int] = mapped_column(BigInteger, primary_key=True, autoincrement=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc_mapped, onupdate=now_utc_mapped, nullable=False)

    # 变更目标
    ingredient_name: Mapped[str] = mapped_column(String(100), nullable=False, index=True)

    # 变更前后的值
    old_values: Mapped[dict] = mapped_column(JSON, nullable=False)
    new_values: Mapped[dict] = mapped_column(JSON, nullable=False)
    changes_summary: Mapped[Optional[dict]] = mapped_column(JSON, default=dict)

    # 操作信息
    operator_id: Mapped[int] = mapped_column(BigInteger, ForeignKey('users.id'), nullable=False, index=True)
    operation_type: Mapped[str] = mapped_column(String(20), nullable=False)

    # 版本管理
    version_before: Mapped[str] = mapped_column(String(20), nullable=False)
    version_after: Mapped[str] = mapped_column(String(20), nullable=False)

    # 生效时间
    effective_immediately: Mapped[bool] = mapped_column(Boolean, default=True)

    # 备注和原因
    change_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    reference_document: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)

    # 关系
    operator: Mapped["User"] = relationship("User", backref="threshold_changes")

    def __repr__(self):
        return f"<ThresholdChange {self.ingredient_name} v{self.version_before}→v{self.version_after} by={self.operator_id}>"


# 导入关系引用
from .formula import Formula
from .user_model import User

# 导出所有模型
__all__ = [
    'SynergyRecord',
    'OptimizationResultRecord',
    'CompatibilityReportRecord',
    'EffectPredictionRecord',
    'SafetyAlertLog',
    'FormulaGenerationHistory',
    'LabValidationData',
    'SafetyThresholdChangeLog',
    # 枚举
    'SynergyMechanismType',
    'AlertLevel',
    'GenerationMode',
    'ValidationStatus'
]
