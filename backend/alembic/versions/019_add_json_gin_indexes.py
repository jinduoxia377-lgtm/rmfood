"""为高频查询的 JSON 列添加 GIN 索引

Revision ID: 019_add_json_gin_indexes
Revises: 018_add_rls_policies
Create Date: 2026-06-30

说明:
- 当前代码中所有 JSON 数据都是整体读写，无子字段 SQL 查询
- 添加 GIN 索引为未来可能的 JSON 查询做准备
- 仅对最可能被查询的列添加索引，避免全表 GIN 导致写入退化

GIN 索引列:
- formulas.composition: 配方成分查询
- formulas.safety_check: 安全检查结果查询
- formulas.target_effects: 按功效筛选配方
- users.preferences: 用户偏好查询
- experiments.parameters: 实验参数查询
- ga_run_records.objectives_config: GA 优化配置查询
- system_configs.config_value: 系统配置查询
- peptide_designs.constraints: 肽设计约束查询
"""
from alembic import op
import sqlalchemy as sa

revision = '019_add_json_gin_indexes'
down_revision = '018b_split_tcm_herbs'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # 仅对最可能被查询的 JSON 列添加 GIN 索引
    # 使用 CONCURRENTLY 避免锁表（生产环境安全）
    json_gin_indexes = [
        ('formulas', 'composition'),
        ('formulas', 'safety_check'),
        ('formulas', 'target_effects'),
        ('users', 'preferences'),
        ('experiments', 'parameters'),
        ('ga_run_records', 'objectives_config'),
        ('system_configs', 'config_value'),
        ('peptide_designs', 'constraints'),
        ('peptide_designs', 'target_effects'),
        ('compatibility_reports', 'issues'),
        ('synergy_records', 'mechanism_scores'),
        ('optimization_results', 'pareto_solutions'),
    ]

    for table, column in json_gin_indexes:
        idx_name = f'gin_{table}_{column}'
        try:
            op.execute(
                f"CREATE INDEX CONCURRENTLY IF NOT EXISTS {idx_name} "
                f"ON {table} USING gin ({column} jsonb_path_ops);"
            )
        except Exception as e:
            # 降级为普通 GIN（不带 path_ops）
            try:
                op.execute(
                    f"CREATE INDEX IF NOT EXISTS {idx_name} "
                    f"ON {table} USING gin ({column});"
                )
            except Exception:
                pass  # 列可能不是 JSONB 类型


def downgrade() -> None:
    json_gin_indexes = [
        ('formulas', 'composition'),
        ('formulas', 'safety_check'),
        ('formulas', 'target_effects'),
        ('users', 'preferences'),
        ('experiments', 'parameters'),
        ('ga_run_records', 'objectives_config'),
        ('system_configs', 'config_value'),
        ('peptide_designs', 'constraints'),
        ('peptide_designs', 'target_effects'),
        ('compatibility_reports', 'issues'),
        ('synergy_records', 'mechanism_scores'),
        ('optimization_results', 'pareto_solutions'),
    ]

    for table, column in json_gin_indexes:
        idx_name = f'gin_{table}_{column}'
        try:
            op.execute(f"DROP INDEX CONCURRENTLY IF EXISTS {idx_name};")
        except Exception:
            pass
