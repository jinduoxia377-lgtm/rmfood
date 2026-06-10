"""添加缺失的外键索引

Revision ID: 009_add_missing_fk_indexes
Revises: 008_add_performance_indexes
Create Date: 2026-06-03

为所有外键字段添加索引，提升 JOIN 查询性能。
"""
from typing import Sequence, Union
from alembic import op

# revision identifiers, used by Alembic.
revision: str = '009_missing_fk'
down_revision: Union[str, None] = '008_performance'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# 需要添加索引的 (表名, 列名) 列表
INDEXES_TO_ADD = [
    # 肽分析
    ("peptide_analyses", "created_by"),
    ("peptide_analyses", "user_id"),
    ("peptide_analyses", "peptide_id"),
    ("peptide_analysis_details", "analysis_id"),
    # 肽设计
    ("peptide_designs", "parent_version_id"),
    ("peptide_design_candidates", "peptide_id"),
    # 配方关联表
    ("formula_ingredients", "ingredient_id"),
    ("formula_ingredients", "formula_id"),
    ("formula_peptides", "peptide_id"),
    ("formula_peptides", "formula_id"),
    ("formula_categories", "category_id"),
    ("formula_categories", "formula_id"),
    ("formula_tags", "formula_id"),
    ("formula_tags", "tag_id"),
    # 分类
    ("categories", "parent_id"),
    # 配方
    ("formulas", "creator_id"),
    ("formulas", "reviewer_id"),
    ("formula_versions", "formula_id"),
    ("formula_versions", "created_by"),
    # 实验
    ("experiments", "researcher_id"),
    ("experiments", "formula_id"),
    ("experiment_data", "experiment_id"),
    # 评论
    ("comments", "parent_id"),
    ("comments", "experiment_id"),
    ("comments", "user_id"),
    ("comments", "formula_id"),
    ("comment_likes", "user_id"),
    ("comment_likes", "comment_id"),
    # 工作流
    ("workflows", "created_by"),
    ("workflow_tasks", "workflow_id"),
    # 系统
    ("audit_logs", "user_id"),
    ("attachments", "experiment_id"),
    ("attachments", "uploaded_by"),
    ("attachments", "formula_id"),
    # 团队
    ("team_members", "invited_by"),
    # AI
    ("prompt_templates", "created_by"),
    ("prompt_versions", "created_by"),
    ("ai_suggestions", "prompt_id"),
    # 对话
    ("chat_messages", "reply_to"),
    # 术语
    ("term_categories", "parent_id"),
    ("terms", "category_id"),
    ("term_variants", "term_id"),
    ("term_validations", "matched_term_id"),
    ("term_statistics", "category_id"),
    # 深度集成
    ("synergy_records", "formula_id"),
    ("synergy_records", "user_id"),
    ("compatibility_reports", "formula_id"),
    ("effect_predictions", "formula_id"),
    ("safety_alert_logs", "operator_id"),
    ("safety_alert_logs", "formula_id"),
    ("formula_generation_history", "effect_prediction_id"),
    ("formula_generation_history", "compatibility_report_id"),
    ("formula_generation_history", "optimization_result_id"),
    ("formula_generation_history", "synergy_record_id"),
    ("formula_generation_history", "user_id"),
    ("lab_validation_data", "reviewer_id"),
    ("safety_threshold_change_log", "operator_id"),
]


def upgrade() -> None:
    """添加外键索引"""
    for table, column in INDEXES_TO_ADD:
        index_name = f"ix_{table}_{column}"
        try:
            op.create_index(index_name, table, [column], if_not_exists=True)
        except Exception:
            # 索引可能已存在，忽略错误
            pass


def downgrade() -> None:
    """删除外键索引"""
    for table, column in INDEXES_TO_ADD:
        index_name = f"ix_{table}_{column}"
        try:
            op.drop_index(index_name, table_name=table, if_exists=True)
        except Exception:
            pass
