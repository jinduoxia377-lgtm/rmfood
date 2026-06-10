-- ════════════════════════════════════════════════
-- RMFOOD 配方平台 - 数据库性能优化脚本
--
-- 针对Phase 2-4新增模块的索引优化
-- 解决N+1查询、慢查询和数据一致性问题
--
-- 执行前请务必备份数据库！
-- 执行环境: PostgreSQL 14+
-- 作者: DBA Team
-- 日期: 2026-05-20
-- 版本: v1.0
-- ════════════════════════════════════════════════

BEGIN;

-- ════════════════════════════════════════════════
-- Part 1: 云端同步模块优化
-- ════════════════════════════════════════════════

-- 1.1 同步日志表复合索引（高频查询优化）
-- 场景: 按用户+时间范围查询同步历史
CREATE INDEX IF NOT EXISTS idx_sync_log_user_timestamp_status
ON sync_logs (user_id, timestamp DESC, status)
WHERE status != 'DELETED';

COMMENT ON INDEX idx_sync_log_user_timestamp_status IS
'E2E测试优化: 加速用户同步历史分页查询';

-- 1.2 实体类型+ID复合索引（冲突检测加速）
-- 场景: 快速查找特定实体的所有同步记录
CREATE INDEX IF NOT EXISTS idx_sync_log_entity_type_id
ON sync_logs (entity_type, entity_id, timestamp DESC);

COMMENT ON INDEX idx_sync_log_entity_type_id IS
'E2E测试优化: 冲突检测时快速定位实体变更';

-- 1.3 设备+时间索引（设备状态监控）
-- 场景: 查询设备的最近同步活动
CREATE INDEX IF NOT EXISTS idx_sync_log_device_timestamp
ON sync_logs (device_id, timestamp DESC)
WHERE device_id IS NOT NULL;

COMMENT ON INDEX idx_sync_log_device_timestamp IS
'E2E测试优化: 设备同步状态监控查询';

-- 1.4 状态筛选索引（待处理队列）
-- 场景: 获取用户的离线队列（PENDING状态）
CREATE INDEX IF NOT EXISTS idx_sync_log_pending_queue
ON sync_logs (user_id, created_at ASC)
WHERE status = 'PENDING';

COMMENT ON INDEX idx_sync_log_pending_queue IS
'E2E测试优化: 离线变更队列快速检索';


-- ════════════════════════════════════════════════
-- Part 2: 团队协作模块优化
-- ════════════════════════════════════════════════

-- 2.1 团队成员表复合索引（权限检查加速）
-- 场景: 验证用户在团队中的角色
CREATE INDEX IF NOT EXISTS idx_team_member_team_user_role
ON team_members (team_id, user_id, role);

COMMENT ON INDEX idx_team_member_team_user_role IS
'E2E测试优化: 权限验证查询（每API调用）';

-- 2.2 用户团队列表索引（我的团队页面）
-- 场景: 获取用户参与的所有团队
CREATE INDEX IF NOT EXISTS idx_team_member_user_joined
ON team_members (user_id, joined_at DESC);

COMMENT ON INDEX idx_team_member_user_joined IS
'E2E测试优化: 用户团队列表加载';

-- 2.3 角色筛选索引（管理员面板）
-- 场景: 查找团队的所有管理员/Owner
CREATE INDEX IF NOT EXISTS idx_team_member_team_role
ON team_members (team_id, role)
WHERE role IN ('OWNER', 'ADMIN');

COMMENT ON INDEX idx_team_member_team_role IS
'E2E测试优化: 团队管理员快速查询';

-- 2.4 团队Owner索引（团队详情关联）
-- 场景: 从团队获取Owner信息
CREATE INDEX IF NOT EXISTS idx_teams_owner_created
ON teams (owner_id, created_at DESC);

COMMENT ON INDEX idx_teams_owner_created IS
'E2E测试优化: Owner的团队列表查询';

-- 2.5 团队归档状态索引（活跃团队筛选）
-- 场景: 只显示未归档的团队
CREATE INDEX IF NOT EXISTS idx_teams_active
ON teams (is_archived, updated_at DESC)
WHERE is_archived = FALSE;

COMMENT ON INDEX idx_teams_active IS
'E2E测试优化: 活跃团队列表过滤';


-- ════════════════════════════════════════════════
-- Part 3: AI助手模块优化
-- ════════════════════════════════════════════════

-- 3.1 提示词版本索引（版本历史查询）
-- 场景: 获取提示词的所有版本
CREATE INDEX IF NOT EXISTS idx_prompt_versions_prompt_version
ON prompt_versions (prompt_id, version_number DESC);

COMMENT ON INDEX idx_prompt_versions_prompt_version IS
'E2E测试优化: 版本历史时间线展示';

-- 3.2 创建者提示词列表（我的提示词）
-- 场景: 用户查看自己创建的所有提示词
CREATE INDEX IF NOT EXISTS idx_prompt_versions_creator_created
ON prompt_versions (created_by, created_at DESC);

COMMENT ON INDEX idx_prompt_versions_creator_created IS
'E2E测试优化: 个人提示词库浏览';

-- 3.3 AI生成记录索引（生成历史追踪）
-- 场景: 查看AI生成日志和Token使用统计
CREATE INDEX IF NOT EXISTS idx_ai_suggestions_user_created
ON ai_suggestions (user_id, created_at DESC);

COMMENT ON INDEX idx_ai_suggestions_user_created IS
'E2E测试优化: AI使用历史和配额管理';


-- ════════════════════════════════════════════════
-- Part 4: 通知系统优化
-- ════════════════════════════════════════════════

-- 4.1 用户通知索引（通知中心核心查询）
-- 场景: 获取用户的通知列表（按时间倒序）
CREATE INDEX IF NOT EXISTS idx_notifications_user_read_time
ON notifications (recipient_id, is_read, created_at DESC);

COMMENT ON INDEX idx_notifications_user_read_time IS
'E2E测试优化: 通知中心主查询（支持已读/未读筛选）';

-- 4.2 未读通知计数索引（实时红点提醒）
-- 场景: 快速计算未读消息数
CREATE INDEX IF NOT EXISTS idx_notifications_unread_count
ON notifications (recipient_id)
WHERE is_read = FALSE;

COMMENT ON INDEX idx_notifications_unread_count IS
'E2E测试优化: 未读消息计数（高性能）';

-- 4.3 通知类型筛选（分类查看）
-- 场景: 按类型过滤通知（团队/AI/系统等）
CREATE INDEX IF NOT EXISTS idx_notifications_user_type
ON notifications (recipient_id, notification_type, created_at DESC);

COMMENT ON INDEX idx_notifications_user_type IS
'E2E测试优化: 通知分类筛选';


-- ════════════════════════════════════════════════
-- Part 5: 用户设备管理优化
-- ════════════════════════════════════════════════

-- 5.1 用户设备列表索引
-- 场景: 账户设置页显示已登录设备
CREATE INDEX IF NOT EXISTS idx_user_devices_user_active
ON user_devices (user_id, is_active, last_sync_at DESC);

COMMENT ON INDEX idx_user_devices_user_active IS
'E2E测试优化: 已登录设备管理';

-- 5.2 设备唯一性约束（防止重复注册）
-- 场景: 确保同一设备不会重复注册
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_devices_unique_device
ON user_devices (device_id, user_id)
WHERE is_active = TRUE;

COMMENT ON INDEX idx_user_devices_unique_device IS
'E2E测试优化: 设备去重约束';


-- ════════════════════════════════════════════════
-- Part 6: 全文搜索优化（Elasticsearch备用）
-- ════════════════════════════════════════════════

-- 6.1 PostgreSQL全文搜索GIN索引（如果未使用ES）
-- 注意: 仅当项目使用PostgreSQL全文搜索而非ES时执行

-- CREATE INDEX IF NOT EXISTS idx_formulas_fulltext_search
-- ON formulas USING GIN (to_tsvector('chinese', name || ' ' || description))
-- WHERE is_deleted = FALSE;
--
-- COMMENT ON INDEX idx_formulas_fulltext_search IS
-- '可选: 中文全文搜索加速（需要pg_trgm扩展）';


-- ════════════════════════════════════════════════
-- Part 7: 审计日志优化
-- ════════════════════════════════════════════════

-- 7.1 审计日志时间范围索引（合规查询）
-- 场景: GDPR数据导出、安全审计时间范围查询
CREATE INDEX IF NOT EXISTS idx_audit_logs_action_timestamp
ON audit_logs (action_type, timestamp DESC);

COMMENT ON INDEX idx_audit_logs_action_timestamp IS
'E2E测试优化: 安全审计日志检索';

-- 7.2 用户操作审计索引
-- 场景: 查看特定用户的所有操作记录
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_timestamp
ON audit_logs (user_id, timestamp DESC);

COMMENT ON INDEX idx_audit_logs_user_timestamp IS
'E2E测试优化: 用户行为审计追踪';


-- ════════════════════════════════════════════════
-- Part 8: 统计和分析查询优化
-- ════════════════════════════════════════════════

-- 8.1 团队仪表盘聚合预计算（Materialized View）
-- 提升团队统计数据查询性能

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_team_stats AS
SELECT
    t.id AS team_id,
    t.name AS team_name,
    COUNT(DISTINCT tm.user_id) AS member_count,
    COUNT(CASE WHEN tm.role = 'OWNER' THEN 1 END) AS owner_count,
    COUNT(CASE WHEN tm.role = 'ADMIN' THEN 1 END) AS admin_count,
    COUNT(CASE WHEN tm.role = 'MEMBER' THEN 1 END) AS member_count_role,
    MAX(tm.joined_at) AS last_member_join,
    t.created_at AS team_created_at,
    t.updated_at AS team_updated_at
FROM teams t
LEFT JOIN team_members tm ON t.id = tm.team_id
WHERE t.is_archived = FALSE
GROUP BY t.id, t.name, t.created_at, t.updated_at
WITH DATA;

CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_team_stats_pk
ON mv_team_stats (team_id);

COMMENT ON MATERIALIZED VIEW mv_team_stats IS
'E2E测试优化: 团队统计仪表盘预聚合视图';

-- 8.2 用户同步统计预计算
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_user_sync_stats AS
SELECT
    user_id,
    COUNT(*) AS total_syncs,
    COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) AS successful_syncs,
    COUNT(CASE WHEN status = 'FAILED' THEN 1 END) AS failed_syncs,
    COUNT(CASE WHEN status = 'PENDING' THEN 1 END) AS pending_count,
    MAX(timestamp) AS last_sync_at,
    MIN(timestamp) AS first_sync_at,
    COUNT(DISTINCT device_id) AS device_count
FROM sync_logs
GROUP BY user_id;

CREATE UNIQUE INDEX IF NOT EXISTS mv_user_sync_stats_pk
ON mv_user_sync_stats (user_id);

COMMENT ON MATERIALIZED VIEW mv_user_sync_stats IS
'E2E测试优化: 用户同步统计预聚合';


-- ════════════════════════════════════════════════
-- Part 9: 定期刷新策略
-- ════════════════════════════════════════════════

-- 创建物化视图刷新函数（建议通过cron定时执行）
CREATE OR REPLACE FUNCTION refresh_performance_views()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_team_stats;
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_user_sync_stats;
    
    RAISE NOTICE 'Performance materialized views refreshed at %', now();
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION refresh_performance_views() IS
'E2E测试优化: 刷新性能优化物化视图（建议每5分钟执行一次）';


-- ════════════════════════════════════════════════
-- Part 10: 慢查询分析辅助
-- ════════════════════════════════════════════════

-- 启用慢查询日志（建议在生产环境开启）
-- 注意: 这需要超级用户权限，且会轻微影响性能

-- ALTER SYSTEM SET log_min_duration_statement = 100;  -- 记录超过100ms的查询
-- SELECT pg_reload_conf();


COMMIT;

-- ════════════════════════════════════════════════
-- 验证脚本 - 检查索引是否创建成功
-- ════════════════════════════════════════════════

DO $$
DECLARE
    idx_record RECORD;
    idx_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '╔══════════════════════════════════════════╗';
    RAISE NOTICE '║   索引创建完成验证                          ║';
    RASE NOTICE '╠══════════════════════════════════════════╣';
    
    FOR idx_record IN 
        SELECT indexname, tablename 
        FROM pg_indexes 
        WHERE indexname LIKE ANY(ARRAY[
            'idx_sync_log_%',
            'idx_team_%',
            'idx_prompt_%',
            'idx_notification_%',
            'idx_user_device_%',
            'idx_ai_%',
            'idx_audit_%'
        ])
        ORDER BY tablename, indexname
    LOOP
        idx_count := idx_count + 1;
        RAISE NOTICE '  ✓ % (%)', idx_record.indexname, idx_record.tablename;
    END LOOP;
    
    RAISE NOTICE '╠══════════════════════════════════════════╣';
    RAISE NOTICE '  总计创建/更新索引: % 个', idx_count;
    RAISE NOTICE '╚══════════════════════════════════════════╝';
    RAISE NOTICE '';
END $$;


-- ════════════════════════════════════════════════
-- 使用说明
-- ════════════════════════════════════════════════

/*
执行步骤:

1. 备份数据库:
   pg_dump -U username -d database_name > backup_$(date +%Y%m%d).sql

2. 执行本脚本:
   psql -U username -d database_name -f database_optimization.sql

3. 验证索引效果:
   - 使用EXPLAIN ANALYZE分析慢查询
   - 对比优化前后执行计划
   - 监控pg_stat_user_indexes查看索引使用率

4. 定期维护:
   - 物化视图刷新: SELECT refresh_performance_views();
   - 或配置cron: */5 * * * * psql -c "SELECT refresh_performance_models();"

5. 回滚方案（如需）:
   DROP INDEX IF EXISTS idx_sync_log_user_timestamp_status;
   -- ... 其他索引以此类推
   
预期性能提升:
- 同步API P95延迟: 降低40-60%
- 团队成员查询: 提升3-5倍速度
- 通知列表加载: 提升5-10倍速度
- AI历史查询: 提升2-3倍速度
*/
