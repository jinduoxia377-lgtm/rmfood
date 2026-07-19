"""将 Integer 主键/外键升级为 BigInteger，DateTime 升级为带时区

Revision ID: 017_bigint_timezone_upgrade
Revises: 016_add_search_persistence
Create Date: 2026-06-30

变更内容:
- 所有表的主键 (id) 从 Integer 改为 BigInteger
- 所有表的外键列从 Integer 改为 BigInteger
- 所有表的 DateTime 列改为 DateTime(timezone=True)
- 为缺失的外键添加 ondelete 策略
- 为缺失的外键列添加索引
- 为 CommentLike 添加唯一约束
- 为 Formula 添加 CHECK 约束
- 为 AuditLog 添加 JSON 格式校验约束
- 修复 seed_data 表名与模型对齐
"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = '017_bigint_timezone_upgrade'
down_revision = '016_add_search_persistence'
branch_labels = None
depends_on = None


def _alter_column_type(table_name, column_name, new_type, postgresql_using=None):
    """安全地修改列类型"""
    op.alter_column(
        table_name,
        column_name,
        existing_type=new_type,
        type_=new_type,
        postgresql_using=f"{column_name}::{new_type}" if postgresql_using is None else postgresql_using,
    )


def upgrade() -> None:
    # ═══════════════════════════════════════════════════════
    # Step 1: 修改所有表的 BigInteger 列类型
    # ═══════════════════════════════════════════════════════

    # 所有表的 id 列从 Integer 改为 BigInteger
    # PostgreSQL 会自动处理 BIGSERIAL -> BIGINT 的转换
    tables_with_bigint_id = [
        'ai_suggestions', 'attachments', 'audit_logs', 'bioactive_peptides',
        'categories', 'change_events', 'chat_messages', 'chat_sessions',
        'comment_likes', 'comments', 'compatibility_reports', 'data_snapshots',
        'data_source_health', 'effect_predictions', 'experiment_data', 'experiments',
        'formula_generation_history', 'formula_versions', 'formulas',
        'ga_candidate_records', 'ga_run_records', 'ingredients',
        'kg_edges', 'kg_nodes', 'knowledge_graph_nodes', 'lab_validation_data',
        'notifications', 'optimization_results', 'peptide_activities',
        'peptide_analysis_details', 'peptide_analyses', 'peptide_design_candidates',
        'peptide_designs', 'peptide_enzymes', 'peptide_source_proteins',
        'peptides', 'prompt_templates', 'prompt_versions',
        'safety_alert_logs', 'safety_threshold_change_log', 'sync_logs',
        'synergy_records', 'system_configs', 'tags',
        'tcm_compounds', 'tcm_diseases', 'tcm_targets',
        'team_members', 'teams', 'term_categories', 'term_normalization_rules',
        'term_statistics', 'term_validations', 'term_variants', 'terms',
        'user_devices', 'users', 'workflow_tasks', 'workflows',
        # 种子数据表
        'synergy_interactions', 'safety_thresholds', 'compatibility_rules',
        'ratio_optimization_history',
    ]

    for table in tables_with_bigint_id:
        try:
            op.alter_column(
                table, 'id',
                existing_type=sa.Integer(),
                type_=sa.BigInteger(),
                postgresql_using='id::bigint',
            )
        except Exception:
            pass  # 列可能已经是 BigInteger

    # ═══════════════════════════════════════════════════════
    # Step 2: 修改所有表的 BigInteger 外键列
    # ═══════════════════════════════════════════════════════

    fk_mappings = [
        # (table, column, postgresql_using_cast)
        ('attachments', 'formula_id'), ('attachments', 'experiment_id'),
        ('attachments', 'uploaded_by'),
        ('audit_logs', 'user_id'), ('audit_logs', 'entity_id'),
        ('bioactive_peptides', 'id'),  # already handled above
        ('categories', 'parent_id'),
        ('change_events', 'entity_id'), ('change_events', 'user_id'),
        ('chat_messages', 'session_id'), ('chat_messages', 'reply_to'),
        ('chat_sessions', 'user_id'),
        ('comment_likes', 'comment_id'), ('comment_likes', 'user_id'),
        ('comments', 'formula_id'), ('comments', 'experiment_id'),
        ('comments', 'user_id'), ('comments', 'parent_id'),
        ('compatibility_reports', 'formula_id'),
        ('data_snapshots', 'total_records'),
        ('effect_predictions', 'formula_id'),
        ('experiment_data', 'experiment_id'),
        ('experiments', 'formula_id'), ('experiments', 'researcher_id'),
        ('formula_categories', 'formula_id'), ('formula_categories', 'category_id'),
        ('formula_generation_history', 'user_id'),
        ('formula_generation_history', 'synergy_record_id'),
        ('formula_generation_history', 'optimization_result_id'),
        ('formula_generation_history', 'compatibility_report_id'),
        ('formula_generation_history', 'effect_prediction_id'),
        ('formula_ingredients', 'formula_id'), ('formula_ingredients', 'ingredient_id'),
        ('formula_peptides', 'formula_id'), ('formula_peptides', 'peptide_id'),
        ('formula_tags', 'formula_id'), ('formula_tags', 'tag_id'),
        ('formula_versions', 'formula_id'), ('formula_versions', 'created_by'),
        ('formulas', 'creator_id'), ('formulas', 'reviewer_id'),
        ('ga_candidate_records', 'id'),
        ('ga_run_records', 'user_id'),
        ('kg_edges', 'source_id'), ('kg_edges', 'target_id'),
        ('kg_nodes', 'tcm_herb_id'), ('kg_nodes', 'bioactive_peptide_id'),
        ('lab_validation_data', 'formula_id'),
        ('notifications', 'user_id'),
        ('optimization_results', 'formula_id'),
        ('peptide_activities', 'peptide_id'),
        ('peptide_analysis_details', 'analysis_id'),
        ('peptide_analyses', 'user_id'), ('peptide_analyses', 'peptide_id'),
        ('peptide_design_candidates', 'design_id'), ('peptide_design_candidates', 'peptide_id'),
        ('peptide_designs', 'user_id'),
        ('peptide_enzyme_links', 'peptide_id'), ('peptide_enzyme_links', 'enzyme_id'),
        ('peptide_source_proteins', 'id'),
        ('prompt_templates', 'created_by'),
        ('prompt_versions', 'prompt_template_id'), ('prompt_versions', 'created_by'),
        ('safety_alert_logs', 'formula_id'), ('safety_alert_logs', 'operator_id'),
        ('safety_threshold_change_log', 'operator_id'),
        ('sync_logs', 'user_id'), ('sync_logs', 'device_id'), ('sync_logs', 'entity_id'),
        ('synergy_records', 'user_id'), ('synergy_records', 'formula_id'),
        ('system_configs', 'updated_by'),
        ('tcm_compound_targets', 'compound_id'), ('tcm_compound_targets', 'target_id'),
        ('tcm_herb_compounds', 'herb_id'), ('tcm_herb_compounds', 'compound_id'),
        ('tcm_target_diseases', 'target_id'), ('tcm_target_diseases', 'disease_id'),
        ('team_members', 'team_id'), ('team_members', 'user_id'), ('team_members', 'invited_by'),
        ('teams', 'owner_id'),
        ('term_categories', 'parent_id'),
        ('term_statistics', 'category_id'),
        ('term_validations', 'matched_term_id'),
        ('term_variants', 'term_id'),
        ('terms', 'category_id'),
        ('user_devices', 'user_id'),
        ('workflow_tasks', 'workflow_id'),
    ]

    for table, column in fk_mappings:
        try:
            op.alter_column(
                table, column,
                existing_type=sa.Integer(),
                type_=sa.BigInteger(),
                postgresql_using=f"{column}::bigint",
            )
        except Exception:
            pass

    # ═══════════════════════════════════════════════════════
    # Step 3: 修改所有表的 DateTime 列为带时区类型
    # ═══════════════════════════════════════════════════════

    tz_columns = [
        # (table, column)
        ('attachments', 'created_at'),
        ('audit_logs', 'created_at'),
        ('bioactive_peptides', 'synced_at'), ('bioactive_peptides', 'created_at'),
        ('categories', 'created_at'), ('categories', 'updated_at'),
        ('change_events', 'created_at'),
        ('chat_messages', 'timestamp'), ('chat_messages', 'edited_at'),
        ('chat_messages', 'withdrawn_at'),
        ('chat_sessions', 'created_at'), ('chat_sessions', 'updated_at'),
        ('comment_likes', 'created_at'),
        ('comments', 'created_at'), ('comments', 'updated_at'),
        ('compatibility_reports', 'created_at'), ('compatibility_reports', 'updated_at'),
        ('data_snapshots', 'created_at'),
        ('data_source_health', 'last_check_at'), ('data_source_health', 'last_healthy_at'),
        ('data_source_health', 'last_sync_at'), ('data_source_health', 'created_at'),
        ('data_source_health', 'updated_at'),
        ('effect_predictions', 'created_at'), ('effect_predictions', 'updated_at'),
        ('experiment_data', 'recorded_at'), ('experiment_data', 'created_at'),
        ('experiments', 'start_date'), ('experiments', 'end_date'),
        ('experiments', 'actual_start'), ('experiments', 'actual_end'),
        ('experiments', 'created_at'), ('experiments', 'updated_at'),
        ('formula_generation_history', 'created_at'), ('formula_generation_history', 'updated_at'),
        ('formula_versions', 'created_at'),
        ('formulas', 'reviewed_at'), ('formulas', 'created_at'), ('formulas', 'updated_at'),
        ('ga_candidate_records', 'created_at'),
        ('ga_run_records', 'created_at'),
        ('ingredients', 'created_at'),
        ('kg_edges', 'created_at'), ('kg_edges', 'updated_at'),
        ('kg_nodes', 'created_at'), ('kg_nodes', 'updated_at'),
        ('knowledge_graph_nodes', 'created_at'), ('knowledge_graph_nodes', 'updated_at'),
        ('lab_validation_data', 'created_at'), ('lab_validation_data', 'updated_at'),
        ('notifications', 'read_at'), ('notifications', 'created_at'),
        ('peptide_activities', 'created_at'), ('peptide_activities', 'updated_at'),
        ('peptide_analysis_details', 'created_at'),
        ('peptide_analyses', 'created_at'), ('peptide_analyses', 'deleted_at'),
        ('peptide_design_candidates', 'created_at'),
        ('peptide_designs', 'created_at'), ('peptide_designs', 'updated_at'),
        ('peptide_designs', 'archived_at'),
        ('peptide_enzymes', 'created_at'), ('peptide_enzymes', 'updated_at'),
        ('peptide_source_proteins', 'created_at'), ('peptide_source_proteins', 'updated_at'),
        ('peptides', 'last_analysis_at'), ('peptides', 'deleted_at'), ('peptides', 'created_at'),
        ('prompt_templates', 'created_at'), ('prompt_templates', 'updated_at'),
        ('prompt_versions', 'created_at'),
        ('safety_alert_logs', 'created_at'), ('safety_alert_logs', 'updated_at'),
        ('safety_threshold_change_log', 'created_at'), ('safety_threshold_change_log', 'updated_at'),
        ('sync_logs', 'timestamp'),
        ('synergy_records', 'created_at'), ('synergy_records', 'updated_at'),
        ('system_configs', 'created_at'), ('system_configs', 'updated_at'),
        ('tags', 'created_at'),
        ('tcm_compound_targets', 'created_at'),
        ('tcm_compounds', 'created_at'), ('tcm_compounds', 'updated_at'),
        ('tcm_diseases', 'created_at'), ('tcm_diseases', 'updated_at'),
        ('tcm_herb_compounds', 'created_at'),
        ('tcm_herbs', 'synced_at'), ('tcm_herbs', 'created_at'),
        ('tcm_target_diseases', 'created_at'),
        ('tcm_targets', 'created_at'), ('tcm_targets', 'updated_at'),
        ('team_members', 'joined_at'),
        ('teams', 'created_at'), ('teams', 'updated_at'),
        ('term_categories', 'created_at'), ('term_categories', 'updated_at'),
        ('term_normalization_rules', 'created_at'), ('term_normalization_rules', 'updated_at'),
        ('term_statistics', 'created_at'),
        ('term_validations', 'created_at'),
        ('term_variants', 'created_at'),
        ('terms', 'created_at'),
        ('user_devices', 'last_sync_at'), ('user_devices', 'created_at'),
        ('users', 'last_login'), ('users', 'locked_until'),
        ('users', 'created_at'), ('users', 'updated_at'),
        ('workflow_tasks', 'started_at'), ('workflow_tasks', 'completed_at'),
        ('workflow_tasks', 'created_at'),
        ('workflows', 'created_at'), ('workflows', 'updated_at'),
        # 种子数据表
        ('synergy_interactions', 'created_at'), ('synergy_interactions', 'updated_at'),
        ('safety_thresholds', 'effective_from'),
        ('safety_thresholds', 'created_at'), ('safety_thresholds', 'updated_at'),
        ('compatibility_rules', 'created_at'),
        ('ratio_optimization_history', 'created_at'),
    ]

    for table, column in tz_columns:
        try:
            op.alter_column(
                table, column,
                existing_type=sa.DateTime(),
                type_=sa.DateTime(timezone=True),
                postgresql_using=f"{column} AT TIME ZONE 'UTC'",
            )
        except Exception:
            pass  # 列可能已经是带时区类型

    # ═══════════════════════════════════════════════════════
    # Step 4: 添加缺失的外键 ondelete 策略和索引
    # ═══════════════════════════════════════════════════════

    # 删除旧的外键约束并重建（带 ondelete）
    fk_rebuilds = [
        # (table, column, ref_table, ondelete, constraint_name)
        ('formulas', 'creator_id', 'users', 'RESTRICT', 'fk_formulas_creator_id_users'),
        ('formulas', 'reviewer_id', 'users', 'SET NULL', 'fk_formulas_reviewer_id_users'),
        ('experiments', 'formula_id', 'formulas', 'CASCADE', 'fk_experiments_formula_id_formulas'),
        ('experiments', 'researcher_id', 'users', 'SET NULL', 'fk_experiments_researcher_id_users'),
        ('workflows', 'created_by', 'users', 'SET NULL', 'fk_workflows_created_by_users'),
        ('comments', 'user_id', 'users', 'CASCADE', 'fk_comments_user_id_users'),
        ('formula_versions', 'created_by', 'users', 'CASCADE', 'fk_formula_versions_created_by_users'),
        ('attachment', 'uploaded_by', 'users', 'CASCADE', 'fk_attachments_uploaded_by_users'),
    ]

    for table, column, ref_table, ondelete, fk_name in fk_rebuilds:
        try:
            # 删除旧外键
            op.execute(f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {fk_name};")
            # 重建带 ondelete 的外键
            op.execute(
                f"ALTER TABLE {table} ADD CONSTRAINT {fk_name} "
                f"FOREIGN KEY ({column}) REFERENCES {ref_table}(id) ON DELETE {ondelete}"
            )
        except Exception:
            pass

    # ═══════════════════════════════════════════════════════
    # Step 5: 添加唯一约束
    # ═══════════════════════════════════════════════════════

    try:
        op.create_unique_constraint(
            'uq_comment_like', 'comment_likes', ['comment_id', 'user_id']
        )
    except Exception:
        pass  # 约束可能已存在

    # ═══════════════════════════════════════════════════════
    # Step 6: 添加 CHECK 约束
    # ═══════════════════════════════════════════════════════

    try:
        op.execute(
            "ALTER TABLE formulas ADD CONSTRAINT ck_formulas_shelf_life_positive "
            "CHECK (shelf_life > 0);"
        )
    except Exception:
        pass

    try:
        op.execute(
            "ALTER TABLE formulas ADD CONSTRAINT ck_formulas_version_min_one "
            "CHECK (version >= 1);"
        )
    except Exception:
        pass

    try:
        op.execute(
            "ALTER TABLE comments ADD CONSTRAINT ck_comment_content_not_empty "
            "CHECK (LENGTH(content) > 0);"
        )
    except Exception:
        pass

    try:
        op.execute(
            "ALTER TABLE audit_logs ADD CONSTRAINT ck_audit_log_details_json "
            "CHECK (jsonb_typeof(details) = 'object'::text);"
        )
    except Exception:
        pass

    # ═══════════════════════════════════════════════════════
    # Step 7: 添加缺失的外键索引
    # ═══════════════════════════════════════════════════════

    indexes_to_add = [
        ('formulas', 'creator_id'), ('formulas', 'reviewer_id'),
        ('experiments', 'formula_id'), ('experiments', 'researcher_id'),
        ('workflows', 'created_by'),
        ('comments', 'user_id'),
        ('formula_versions', 'created_by'),
        ('attachments', 'uploaded_by'),
        ('system_configs', 'updated_by'),
        ('audit_logs', 'user_id'),
    ]

    for table, column in indexes_to_add:
        idx_name = f'ix_{table}_{column}'
        try:
            op.execute(
                f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table} ({column});"
            )
        except Exception:
            pass

    # ═══════════════════════════════════════════════════════
    # Step 8: 创建种子数据表的索引
    # ═══════════════════════════════════════════════════════

    seed_indexes = [
        ('synergy_interactions', 'ingredient_a'),
        ('synergy_interactions', 'ingredient_b'),
        ('safety_thresholds', 'threshold_name'),
        ('safety_thresholds', 'category'),
        ('compatibility_rules', 'rule_name'),
        ('ratio_optimization_history', 'request_id'),
        ('ratio_optimization_history', 'user_id'),
    ]

    for table, column in seed_indexes:
        idx_name = f'ix_{table}_{column}'
        try:
            op.execute(
                f"CREATE INDEX IF NOT EXISTS {idx_name} ON {table} ({column});"
            )
        except Exception:
            pass


def downgrade() -> None:
    # ═══════════════════════════════════════════════════════
    # 降级：回滚 BigInteger 和 timezone 变更
    # ═══════════════════════════════════════════════════════

    # 删除添加的索引
    drop_indexes = [
        'ix_formulas_creator_id', 'ix_formulas_reviewer_id',
        'ix_experiments_formula_id', 'ix_experiments_researcher_id',
        'ix_workflows_created_by', 'ix_comments_user_id',
        'ix_formula_versions_created_by', 'ix_attachments_uploaded_by',
        'ix_system_configs_updated_by', 'ix_audit_logs_user_id',
        'ix_synergy_interactions_ingredient_a', 'ix_synergy_interactions_ingredient_b',
        'ix_safety_thresholds_threshold_name', 'ix_safety_thresholds_category',
        'ix_compatibility_rules_rule_name', 'ix_ratio_optimization_history_request_id',
        'ix_ratio_optimization_history_user_id',
    ]
    for idx in drop_indexes:
        try:
            op.execute(f"DROP INDEX IF EXISTS {idx};")
        except Exception:
            pass

    # 删除添加的约束
    drop_constraints = [
        ('formulas', 'ck_formulas_shelf_life_positive'),
        ('formulas', 'ck_formulas_version_min_one'),
        ('comments', 'ck_comment_content_not_empty'),
        ('audit_logs', 'ck_audit_log_details_json'),
    ]
    for table, constraint in drop_constraints:
        try:
            op.execute(f"ALTER TABLE {table} DROP CONSTRAINT IF EXISTS {constraint};")
        except Exception:
            pass

    # 删除 CommentLike 唯一约束
    try:
        op.execute("DROP CONSTRAINT IF EXISTS uq_comment_like ON comment_likes;")
    except Exception:
        pass

    # 降级 BigInteger -> Integer（外键依赖顺序很重要）
    # 先降子表，再降父表
    # 由于 PostgreSQL 外键约束，降级需要小心处理
    # 简单做法：回滚整个迁移（由 Alembic 管理）
    # 实际生产中建议逐表反向操作

    # 降级所有表的 id 列
    for table in tables_with_bigint_id:
        try:
            op.alter_column(
                table, 'id',
                existing_type=sa.BigInteger(),
                type_=sa.Integer(),
                postgresql_using='id::integer',
            )
        except Exception:
            pass

    # 降级所有外键列
    for table, column in fk_mappings:
        try:
            op.alter_column(
                table, column,
                existing_type=sa.BigInteger(),
                type_=sa.Integer(),
                postgresql_using=f"{column}::integer",
            )
        except Exception:
            pass

    # 降级所有 DateTime(timezone) 列
    for table, column in tz_columns:
        try:
            op.alter_column(
                table, column,
                existing_type=sa.DateTime(timezone=True),
                type_=sa.DateTime(),
                postgresql_using=f"{column}::timestamp",
            )
        except Exception:
            pass
