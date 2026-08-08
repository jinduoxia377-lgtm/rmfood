"""RMFOOD 协同配方深度集成 - 数据库迁移

新增表:
- synergy_records: 协同效应分析记录
- optimization_results: 配比优化结果
- compatibility_reports: 兼容性检测报告
- effect_predictions: 效果预测记录
- safety_alert_logs: 安全预警日志
- formula_generation_history: 配方生成历史
- lab_validation_data: 实验室验证数据
- safety_threshold_change_log: 阈值变更审计

Revision ID: 002_formula_deep_integration
Revises: 015_enhance_tcm_dfbp_tables
Create Date: 2026-05-03

作者: RMFOOD AI Team (PepINVERT Integration)
"""

from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '20260503_000000_formula_deep_integration'
down_revision: Union[str, None] = '20260502_000100_account_security'
branch_labels: Union[str, Sequence[str], None] = ('formula_deep_integration',)
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """创建协同配方深度集成相关的所有表"""
    
    # ============================================================
    # 1. 协同效应分析记录表 (synergy_records)
    # ============================================================
    op.create_table('synergy_records',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('ingredient_a', sa.String(100), nullable=False),
        sa.Column('ingredient_b', sa.String(100), nullable=False),
        sa.Column('overall_si', sa.Float(), nullable=False),
        sa.Column('confidence', sa.Float(), server_default='0.8', nullable=False),
        sa.Column('dominant_mechanism', sa.String(50), nullable=True),
        sa.Column('mechanism_scores', sa.JSON(), server_default='{}'),
        sa.Column('context_params', sa.JSON(), server_default='{}'),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('formula_id', sa.Integer(), sa.ForeignKey('formulas.id'), nullable=True),
        sa.Column('data_version', sa.String(20), server_default='v1.0'),
        sa.Column('source_reference', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_synergy_records_ingredient_a', 'synergy_records', ['ingredient_a'])
    op.create_index('ix_synergy_records_ingredient_b', 'synergy_records', ['ingredient_b'])
    op.create_index('ix_synergy_records_pair', 'synergy_records', ['ingredient_a', 'ingredient_b'], unique=True)
    
    # ============================================================
    # 2. 配比优化结果表 (optimization_results)
    # ============================================================
    op.create_table('optimization_results',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('generation_request_id', sa.String(100), unique=True, nullable=False),
        sa.Column('ingredients_input', sa.JSON(), nullable=False),
        sa.Column('optimization_config', sa.JSON(), server_default='{}'),
        sa.Column('pareto_solutions', sa.JSON(), server_default='[]'),
        sa.Column('best_solution', sa.JSON(), nullable=True),
        sa.Column('computation_time_ms', sa.Float(), nullable=False),
        sa.Column('solution_count', sa.Integer(), server_default='0'),
        sa.Column('diversity_metric', sa.Float(), server_default='0.0'),
        sa.Column('generations_completed', sa.Integer(), server_default='0'),
        sa.Column('efficacy_score', sa.Float(), nullable=True),
        sa.Column('safety_score', sa.Float(), nullable=True),
        sa.Column('stability_score', sa.Float(), nullable=True),
        sa.Column('cost_efficiency', sa.Float(), nullable=True),
        sa.Column('recommendation_reason', sa.Text(), nullable=True),
        sa.Column('cache_hit', sa.Boolean(), server_default='false'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    
    # ============================================================
    # 3. 兼容性检测报告表 (compatibility_reports)
    # ============================================================
    op.create_table('compatibility_reports',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('formula_id', sa.Integer(), sa.ForeignKey('formulas.id'), nullable=True),
        sa.Column('overall_score', sa.Float(), nullable=False),
        sa.Column('issues', sa.JSON(), server_default='[]'),
        sa.Column('passed_checks', sa.Integer(), server_default='0'),
        sa.Column('total_checks', sa.Integer(), server_default='0'),
        sa.Column('error_count', sa.Integer(), server_default='0'),
        sa.Column('warning_count', sa.Integer(), server_default='0'),
        sa.Column('info_count', sa.Integer(), server_default='0'),
        sa.Column('recommendations', sa.JSON(), server_default='[]'),
        sa.Column('target_population', sa.String(20), server_default='adult'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    
    # ============================================================
    # 4. 效果预测记录表 (effect_predictions)
    # ============================================================
    op.create_table('effect_predictions',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('formula_id', sa.Integer(), sa.ForeignKey('formulas.id'), nullable=True),
        sa.Column('peak_time_tmax', sa.Float(), nullable=False),
        sa.Column('peak_concentration_cmax', sa.Float(), nullable=False),
        sa.Column('max_effect_emax', sa.Float(), nullable=False),
        sa.Column('effect_duration', sa.Float(), nullable=False),
        sa.Column('auc_value', sa.Float(), nullable=False),
        sa.Column('optimal_window_start', sa.Float(), nullable=False),
        sa.Column('optimal_window_end', sa.Float(), nullable=False),
        sa.Column('ct_curve_data', sa.JSON(), server_default='[]'),
        sa.Column('et_curve_data', sa.JSON(), server_default='[]'),
        sa.Column('visualization_data', sa.JSON(), server_default='{}'),
        sa.Column('body_weight_kg', sa.Float(), server_default='70.0'),
        sa.Column('simulation_hours', sa.Float(), server_default='24.0'),
        sa.Column('time_points_count', sa.Integer(), server_default='100'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    
    # ============================================================
    # 5. 安全预警日志表 (safety_alert_logs)
    # ============================================================
    op.create_table('safety_alert_logs',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('ingredient_name', sa.String(100), nullable=False),
        sa.Column('formula_id', sa.Integer(), sa.ForeignKey('formulas.id'), nullable=True),
        sa.Column('alert_level', sa.String(20), nullable=False),
        sa.Column('parameter', sa.String(50), nullable=False),
        sa.Column('current_value', sa.Float(), nullable=False),
        sa.Column('threshold_value', sa.Float(), nullable=False),
        sa.Column('percentage_of_threshold', sa.Float(), nullable=False),
        sa.Column('message', sa.Text(), nullable=False),
        sa.Column('recommendation', sa.Text(), nullable=True),
        sa.Column('is_blocking', sa.Boolean(), server_default='false'),
        sa.Column('target_group', sa.String(20), server_default='adult'),
        sa.Column('operator_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_safety_alert_logs_level', 'safety_alert_logs', ['alert_level'])
    op.create_index('ix_safety_alert_logs_ingredient', 'safety_alert_logs', ['ingredient_name'])
    
    # ============================================================
    # 6. 配方生成历史表 (formula_generation_history)
    # ============================================================
    op.create_table('formula_generation_history',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('request_id', sa.String(100), unique=True, nullable=False),
        sa.Column('user_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('mode', sa.String(20), server_default='deep_integration'),
        sa.Column('input_ingredients', sa.JSON(), nullable=False),
        sa.Column('target_efficacy', sa.Float(), server_default='0.75'),
        sa.Column('safety_priority', sa.Boolean(), server_default='true'),
        sa.Column('target_population', sa.String(20), server_default='adult'),
        sa.Column('synergy_record_id', sa.Integer(), sa.ForeignKey('synergy_records.id'), nullable=True),
        sa.Column('optimization_result_id', sa.Integer(), sa.ForeignKey('optimization_results.id'), nullable=True),
        sa.Column('compatibility_report_id', sa.Integer(), sa.ForeignKey('compatibility_reports.id'), nullable=True),
        sa.Column('effect_prediction_id', sa.Integer(), sa.ForeignKey('effect_predictions.id'), nullable=True),
        sa.Column('total_generation_time_ms', sa.Float(), nullable=False),
        sa.Column('cache_hit', sa.Boolean(), server_default='false'),
        sa.Column('success', sa.Boolean(), server_default='false'),
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('recommendations', sa.JSON(), server_default='[]'),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_gen_history_user', 'formula_generation_history', ['user_id'])
    op.create_index('ix_gen_history_mode', 'formula_generation_history', ['mode'])
    
    # ============================================================
    # 7. 实验室验证数据表 (lab_validation_data)
    # ============================================================
    op.create_table('lab_validation_data',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('target_type', sa.String(20), nullable=False),
        sa.Column('target_id', sa.Integer(), nullable=True),
        sa.Column('target_name', sa.String(200), nullable=False),
        sa.Column('experiment_id', sa.String(100), unique=True, nullable=False),
        sa.Column('lab_name', sa.String(200), nullable=False),
        sa.Column('experiment_date', sa.Date(), nullable=False),
        sa.Column('researcher_name', sa.String(100), nullable=False),
        sa.Column('status', sa.String(20), server_default='pending'),
        sa.Column('method_description', sa.Text(), nullable=True),
        sa.Column('equipment_used', sa.Text(), nullable=True),
        sa.Column('measured_parameters', sa.JSON(), server_default='{}'),
        sa.Column('raw_data_file_path', sa.String(500), nullable=True),
        sa.Column('predicted_values', sa.JSON(), server_default='{}'),
        sa.Column('deviation_analysis', sa.JSON(), server_default='{}'),
        sa.Column('validation_result', sa.String(20), nullable=True),
        sa.Column('conclusion_notes', sa.Text(), nullable=True),
        sa.Column('qc_passed', sa.Boolean(), server_default='false'),
        sa.Column('reviewer_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=True),
        sa.Column('reviewed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_lab_validation_experiment', 'lab_validation_data', ['experiment_id'])
    op.create_index('ix_lab_validation_target', 'lab_validation_data', ['target_name'])
    op.create_index('ix_lab_validation_status', 'lab_validation_data', ['status'])
    
    # ============================================================
    # 8. 安全阈值变更审计日志表 (safety_threshold_change_log)
    # ============================================================
    op.create_table('safety_threshold_change_log',
        sa.Column('id', sa.Integer(), autoincrement=True, nullable=False),
        sa.Column('ingredient_name', sa.String(100), nullable=False),
        sa.Column('old_values', sa.JSON(), nullable=False),
        sa.Column('new_values', sa.JSON(), nullable=False),
        sa.Column('changes_summary', sa.JSON(), server_default='{}'),
        sa.Column('operator_id', sa.Integer(), sa.ForeignKey('users.id'), nullable=False),
        sa.Column('operation_type', sa.String(20), nullable=False),
        sa.Column('version_before', sa.String(20), nullable=False),
        sa.Column('version_after', sa.String(20), nullable=False),
        sa.Column('effective_immediately', sa.Boolean(), server_default='true'),
        sa.Column('change_reason', sa.Text(), nullable=True),
        sa.Column('reference_document', sa.String(255), nullable=True),
        sa.Column('created_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(), server_default=sa.func.now(), nullable=False),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_index('ix_threshold_change_ingredient', 'safety_threshold_change_log', ['ingredient_name'])
    op.create_index('ix_threshold_change_operator', 'safety_threshold_change_log', ['operator_id'])
    
    # ============================================================
    # 初始化种子数据（安全阈值）
    # ============================================================
    # 注意：实际的安全阈值数据将在应用启动时从 SafetyAlertSystem 加载


def downgrade() -> None:
    """回滚迁移 - 删除所有新增的表"""
    
    op.drop_table('safety_threshold_change_log')
    op.drop_table('lab_validation_data')
    op.drop_table('formula_generation_history')
    op.drop_table('safety_alert_logs')
    op.drop_table('effect_predictions')
    op.drop_table('compatibility_reports')
    op.drop_table('optimization_results')
    op.drop_table('synergy_records')
