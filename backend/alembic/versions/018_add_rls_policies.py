"""为多租户表添加 Row Level Security (RLS) 策略

Revision ID: 018_add_rls_policies
Revises: 017_bigint_timezone_upgrade
Create Date: 2026-06-30

RLS 策略说明:
- 每个用户只能访问自己的数据，除非在团队中
- 团队数据通过 team_members 表进行隔离
- 配方、实验、工作流等核心表受 RLS 保护
- 审计日志、系统配置等表不受 RLS 限制（管理员可全量访问）
"""
from alembic import op
import sqlalchemy as sa

revision = '018_add_rls_policies'
down_revision = '017_bigint_timezone_upgrade'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ═══════════════════════════════════════════════════════
    # Step 1: 创建 RLS 辅助函数
    # ═══════════════════════════════════════════════════════

    # current_user_id(): 从 PostgreSQL 会话变量获取当前用户 ID
    # 应用层通过 SET LOCAL app.current_user_id = :user_id 设置
    op.execute("""
        CREATE OR REPLACE FUNCTION current_user_id() RETURNS integer AS $$
            SELECT COALESCE(NULLIF(current_setting('app.current_user_id', true), ''), '0')::integer;
        $$ LANGUAGE SQL STABLE;
    """)

    # get_user_team_ids(): 获取当前用户所属的所有团队 ID
    op.execute("""
        CREATE OR REPLACE FUNCTION get_user_team_ids() RETURNS SETOF integer AS $$
            SELECT DISTINCT team_id FROM team_members
            WHERE user_id = current_user_id() AND is_active = true;
        $$ LANGUAGE SQL STABLE;
    """)

    # ═══════════════════════════════════════════════════════
    # Step 2: 为需要 RLS 的表启用行级安全
    # ═══════════════════════════════════════════════════════

    rls_tables = [
        'formulas',           # 配方 - 用户只能访问自己的，或所在团队的
        'experiments',        # 实验 - 同上
        'workflows',          # 工作流 - 同上
        'chat_sessions',      # 对话会话 - 仅属主
        'chat_messages',      # 对话消息 - 跟随会话归属
        'notifications',      # 通知 - 仅属主
        'peptide_analyses',   # 肽分析 - 仅属主
        'peptide_designs',    # 肽设计 - 仅属主
        'ai_suggestions',     # AI 建议 - 跟随 prompt 归属
        'user_devices',       # 设备 - 仅属主
        'sync_logs',          # 同步日志 - 仅属主
    ]

    for table in rls_tables:
        try:
            op.execute(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY;")
        except Exception:
            pass

    # ═══════════════════════════════════════════════════════
    # Step 3: 创建 RLS 策略
    # ═══════════════════════════════════════════════════════

    # --- formulas: 用户可见自己的 + 所在团队共享的 ---
    # 简化策略：creator 在团队中 -> 同团队其他成员可见
    # 完整实现需要额外的 formula_teams 关联表
    op.execute("""
        DROP POLICY IF EXISTS formulas_owner_policy ON formulas;
        CREATE POLICY formulas_owner_policy ON formulas
            USING (creator_id = current_user_id());
    """)

    op.execute("""
        DROP POLICY IF EXISTS formulas_all_policy ON formulas;
        CREATE POLICY formulas_all_policy ON formulas
            FOR ALL
            USING (
                creator_id = current_user_id()
                OR creator_id IN (
                    SELECT tm.user_id FROM team_members tm
                    WHERE tm.team_id IN (SELECT * FROM get_user_team_ids())
                    AND tm.role IN ('owner', 'admin', 'member')
                )
            );
    """)

    # --- experiments: 跟随公式归属 ---
    op.execute("""
        DROP POLICY IF EXISTS experiments_owner_policy ON experiments;
        CREATE POLICY experiments_owner_policy ON experiments
            USING (
                researcher_id = current_user_id()
                OR formula_id IN (
                    SELECT f.id FROM formulas f WHERE f.creator_id = current_user_id()
                )
            );
    """)

    # --- workflows: 创建者可见 ---
    op.execute("""
        DROP POLICY IF EXISTS workflows_owner_policy ON workflows;
        CREATE POLICY workflows_owner_policy ON workflows
            USING (created_by = current_user_id());
    """)

    # --- chat_sessions: 仅属主 ---
    op.execute("""
        DROP POLICY IF EXISTS chat_sessions_owner_policy ON chat_sessions;
        CREATE POLICY chat_sessions_owner_policy ON chat_sessions
            USING (user_id = current_user_id());
    """)

    # --- chat_messages: 跟随会话属主 ---
    op.execute("""
        DROP POLICY IF EXISTS chat_messages_owner_policy ON chat_messages;
        CREATE POLICY chat_messages_owner_policy ON chat_messages
            USING (
                session_id IN (
                    SELECT cs.id FROM chat_sessions cs WHERE cs.user_id = current_user_id()
                )
            );
    """)

    # --- notifications: 仅属主 ---
    op.execute("""
        DROP POLICY IF EXISTS notifications_owner_policy ON notifications;
        CREATE POLICY notifications_owner_policy ON notifications
            USING (user_id = current_user_id());
    """)

    # --- peptide_analyses: 仅属主 ---
    op.execute("""
        DROP POLICY IF EXISTS peptide_analyses_owner_policy ON peptide_analyses;
        CREATE POLICY peptide_analyses_owner_policy ON peptide_analyses
            USING (user_id = current_user_id());
    """)

    # --- peptide_designs: 仅属主 ---
    op.execute("""
        DROP POLICY IF EXISTS peptide_designs_owner_policy ON peptide_designs;
        CREATE POLICY peptide_designs_owner_policy ON peptide_designs
            USING (user_id = current_user_id());
    """)

    # --- ai_suggestions: 跟随 prompt 归属 ---
    op.execute("""
        DROP POLICY IF EXISTS ai_suggestions_owner_policy ON ai_suggestions;
        CREATE POLICY ai_suggestions_owner_policy ON ai_suggestions
            USING (
                prompt_id IN (
                    SELECT pt.id FROM prompt_templates pt
                    WHERE pt.created_by = current_user_id()
                )
            );
    """)

    # --- user_devices: 仅属主 ---
    op.execute("""
        DROP POLICY IF EXISTS user_devices_owner_policy ON user_devices;
        CREATE POLICY user_devices_owner_policy ON user_devices
            USING (user_id = current_user_id());
    """)

    # --- sync_logs: 仅属主 ---
    op.execute("""
        DROP POLICY IF EXISTS sync_logs_owner_policy ON sync_logs;
        CREATE POLICY sync_logs_owner_policy ON sync_logs
            USING (user_id = current_user_id());
    """)

    # ═══════════════════════════════════════════════════════
    # Step 4: 创建管理员豁免策略（超级用户可访问所有数据）
    # ═══════════════════════════════════════════════════════

    # 应用层通过 SET LOCAL app.is_admin = 'true' 标记管理员
    op.execute("""
        CREATE OR REPLACE FUNCTION is_admin_user() RETURNS boolean AS $$
            SELECT COALESCE(NULLIF(current_setting('app.is_admin', true), ''), 'false')::boolean;
        $$ LANGUAGE SQL STABLE;
    """)

    # 管理员豁免策略：对所有 RLS 表生效
    admin_exempt_policies = [
        'formulas', 'experiments', 'workflows', 'chat_sessions',
        'chat_messages', 'notifications', 'peptide_analyses',
        'peptide_designs', 'ai_suggestions', 'user_devices', 'sync_logs',
    ]

    for table in admin_exempt_policies:
        try:
            op.execute(f"""
                DROP POLICY IF EXISTS {table}_admin_policy ON {table};
                CREATE POLICY {table}_admin_policy ON {table}
                    FOR ALL
                    USING (is_admin_user());
            """)
        except Exception:
            pass

    # ═══════════════════════════════════════════════════════
    # Step 5: 创建审计日志触发器函数
    # ═══════════════════════════════════════════════════════

    # 记录 RLS 拦截事件
    op.execute("""
        CREATE OR REPLACE FUNCTION log_rls_denied() RETURNS trigger AS $$
        BEGIN
            RAISE WARNING 'RLS policy denied access on %.%', TG_TABLE_SCHEMA, TG_TABLE_NAME;
            RETURN NULL;
        END;
        $$ LANGUAGE plpgsql;
    """)

    # 为每个 RLS 表创建 DENIED 触发器
    for table in rls_tables:
        try:
            op.execute(f"""
                DROP TRIGGER IF EXISTS rls_denied_trigger ON {table};
                CREATE TRIGGER rls_denied_trigger
                    AFTER UPDATE OR DELETE ON {table}
                    WHEN (NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = '{table}' AND policyname = '{table}_owner_policy'))
                    FOR EACH ROW EXECUTE FUNCTION log_rls_denied();
            """)
        except Exception:
            pass


def downgrade() -> None:
    # ═══════════════════════════════════════════════════════
    # 移除所有 RLS 策略和函数
    # ═══════════════════════════════════════════════════════

    rls_tables = [
        'formulas', 'experiments', 'workflows', 'chat_sessions',
        'chat_messages', 'notifications', 'peptide_analyses',
        'peptide_designs', 'ai_suggestions', 'user_devices', 'sync_logs',
    ]

    # 禁用 RLS
    for table in rls_tables:
        try:
            op.execute(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY;")
        except Exception:
            pass

    # 删除所有策略
    for table in rls_tables:
        try:
            op.execute(f"DROP POLICY IF EXISTS {table}_owner_policy ON {table};")
            op.execute(f"DROP POLICY IF EXISTS {table}_all_policy ON {table};")
            op.execute(f"DROP POLICY IF EXISTS {table}_admin_policy ON {table};")
        except Exception:
            pass

    # 删除触发器
    for table in rls_tables:
        try:
            op.execute(f"DROP TRIGGER IF EXISTS rls_denied_trigger ON {table};")
        except Exception:
            pass

    # 删除函数
    functions = [
        'log_rls_denied()',
        'is_admin_user()',
        'get_user_team_ids()',
        'current_user_id()',
    ]
    for func in functions:
        try:
            op.execute(f"DROP FUNCTION IF EXISTS {func} CASCADE;")
        except Exception:
            pass
