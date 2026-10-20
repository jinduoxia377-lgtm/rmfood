"""
SSS 企业级功能 - 单元测试套件

覆盖模块:
- 通知中心 (notification_center)
- 数据分析引擎 (analytics_engine)
- 多租户服务 (multi_tenant)
- 集成框架 (integration_framework)
- 合规审计系统 (audit_system)
- 营养计算引擎 (nutrition_engine)
- 扩展框架 (extension_framework)

运行方式:
  pytest tests/test_sss_features.py -v
"""

import pytest
import json
import asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from typing import Dict, Any


# ════════════════════════════════════════════
# Mock 数据库会话
# ════════════════════════════════════════════

class MockDB:
    """模拟数据库会话"""
    def __init__(self):
        self.data = {}
        self.queries = []
    
    async def execute(self, query, params=None):
        self.queries.append((query, params))
        result = MagicMock()
        result.fetchone.return_value = None
        result.fetchall.return_value = []
        result.scalar.return_value = 0
        return result
    
    async def commit(self):
        pass


@pytest.fixture
def db():
    return MockDB()


# ════════════════════════════════════════════
# 1. 通知中心测试
# ═════════════════════════════════════════════

class TestNotificationCenter:
    """通知中心服务测试"""
    
    @pytest.mark.asyncio
    async def test_create_notification_service(self, db):
        """测试创建通知服务实例"""
        from app.core.notification_center import NotificationService
        
        service = NotificationService(db)
        
        assert service.db == db
        assert len(service.senders) >= 2  # 至少有InApp和Email发送器
    
    @pytest.mark.asyncio
    async def test_get_user_notifications_empty(self, db):
        """测试获取空通知列表"""
        from app.core.notification_center import NotificationService
        
        service = NotificationService(db)
        result = await service.get_user_notifications(user_id=1)
        
        assert 'items' in result
        assert 'pagination' in result
        assert 'unread_count' in result
        assert result['items'] == []
        assert result['unread_count'] == 0
    
    @pytest.mark.asyncio
    async def test_render_template(self, db):
        """测试模板渲染"""
        from app.core.notification_center import NotificationService
        
        service = NotificationService(db)
        
        template = "Hello {{name}}, your {{resource_type}} is ready!"
        variables = {"name": "张三", "resource_type": "配方"}
        
        result = service._render_template(template, variables)
        
        assert "张三" in result
        assert "配方" in result
        assert "{{" not in result  # 所有变量都被替换
    
    @pytest.mark.asyncio
    async def test_notification_preference_defaults(self, db):
        """测试用户偏好默认值"""
        from app.core.notification_center import (
            NotificationService,
            UserNotificationPreference,
            NotificationChannel,
        )
        
        service = NotificationService(db)
        pref = await service._get_user_preference(999)  # 不存在的用户
        
        assert isinstance(pref, UserNotificationPreference)
        assert pref.user_id == 999
        assert pref.enabled == True
        assert len(pref.channel_preferences) == 0
    
    @pytest.mark.asyncio
    async def test_quiet_hours_detection(self, db):
        """测试免打扰时段检测"""
        from app.core.notification_center import (
            NotificationService,
            UserNotificationPreference,
            NotificationChannel,
            NotificationPriority,
        )
        
        service = NotificationService(db)
        
        # 设置免打扰时段为22:00-08:00
        pref = UserNotificationPreference(
            user_id=1,
            quiet_hours_start="22:00",
            quiet_hours_end="08:00",
        )
        
        # 模拟在免打扰时间内
        with patch('app.core.notification_center.datetime') as mock_datetime:
            now = datetime(2026, 5, 2, 23, 30, tzinfo=timezone.utc)
            mock_datetime.now.return_value = now
            
            is_in_quiet = service._is_in_quiet_hours(pref)
            
            assert is_in_quiet == True
    
    @pytest.mark.asyncio
    async def test_should_send_channel(self, db):
        """测试渠道发送判断逻辑"""
        from app.core.notification_center import (
            NotificationService,
            UserNotificationPreference,
            NotificationChannel,
            NotificationCategory,
        )
        
        service = NotificationService(db)
        
        # 用户禁用了邮件渠道
        pref = UserNotificationPreference(
            user_id=1,
            channel_preferences={NotificationChannel.EMAIL: False},
            category_enabled={NotificationCategory.COLLABORATION: True},
        )
        
        should_send = service._should_send_channel(
            pref,
            NotificationChannel.EMAIL,
            NotificationCategory.COLLABORATION,
        )
        
        assert should_send == False
        
        should_send_in_app = service._should_send_channel(
            pref,
            NotificationChannel.IN_APP,
            NotificationCategory.COLLABORATION,
        )
        
        assert should_send_in_app == True  # 站内信默认开启


# ════════════════════════════════════════════
# 2. 数据分析引擎测试
# ════════════════════════════════════════════

class TestAnalyticsEngine:
    """数据分析引擎测试"""
    
    @pytest.mark.asyncio
    async def test_get_dashboard_stats_structure(self, db):
        """测试仪表盘数据结构"""
        from app.core.analytics_engine import AnalyticsService, get_analytics_service
        
        service = get_analytics_service(db)
        stats = await service.get_dashboard_stats()
        
        assert 'timestamp' in stats
        assert 'kpi' in stats
        assert 'charts' in stats
        assert 'recent_activity' in stats
        assert 'top_entities' in stats
        assert 'system_health' in stats
        
        # KPI应该包含核心指标
        kpi_names = [k['id'] for k in stats['kpi']]
        assert 'total_formulas' in kpi_names
        assert 'total_experiments' in kpi_names
    
    @pytest.mark.asyncio
    async def test_kpi_metrics_format(self, db):
        """测试KPI指标格式"""
        from app.core.analytics_engine import AnalyticsService, KPIMetric
        
        service = AnalyticsService(db)
        kpi_list = await service._get_kpi_metrics()
        
        for kpi in kpi_list:
            assert 'id' in kpi
            assert 'name' in kpi
            assert 'value' in kpi
            assert 'unit' in kpi
    
    @pytest.mark.asyncio
    async def test_chart_data_types(self, db):
        """测试图表数据类型"""
        from app.core.analytics_engine import AnalyticsService
        
        service = AnalyticsService(db)
        charts = await service._get_chart_data()
        
        # 应该包含多种图表类型
        chart_types = [v.get('chart_type') for v in charts.values()]
        assert 'pie' in chart_types
        assert 'line' in chart_types or 'bar' in chart_types
    
    @pytest.mark.asyncio
    async def test_export_csv(self, db):
        """测试CSV导出"""
        from app.core.analytics_engine import AnalyticsService, ExportFormat
        
        service = AnalyticsService(db)
        data = {
            "items": [
                {"id": 1, "name": "测试配方", "status": "published"},
                {"id": 2, "name": "实验A", "status": "completed"},
            ]
        }
        
        result = await service.export_data(data, format=ExportFormat.CSV)
        
        assert result.format == ExportFormat.CSV
        assert b'test' in result.data  # 包含中文
        assert result.content_type == 'text/csv; charset=utf-8'
        assert result.file_size_bytes > 0
    
    @pytest.mark.asyncio
    async def test_export_excel(self, db):
        """测试Excel导出（如果openpyql可用）"""
        from app.core.analytics_engine import AnalyticsService, ExportFormat
        
        service = AnalyticsService(db)
        data = {
            "items": [
                {"name": "配方1", "count": 100},
                {"name": "配方2", "count": 200},
            ]
        }
        
        try:
            result = await service.export_data(data, format=ExportFormat.EXCEL)
            assert result.format == ExportFormat.EXCEL
            assert result.file_size_bytes > 0
        except ImportError:
            pytest.skip("openpyql未安装，跳过Excel导出测试")
    
    @pytest.mark.asyncio
    async def test_calc_change_percentage(self, db):
        """测试变化率计算"""
        from app.core.analytics_engine import AnalyticsService
        
        service = AnalyticsService(db)
        
        # 正增长
        change = service._calc_change(150, 100)
        assert change == 50.0
        
        # 负增长
        change = service._calc_change(80, 100)
        assert change == -20.0
        
        # 无前值
        change = service._calc_change(100, 0)
        assert change is None


# ════════════════════════════════════════════
# 3. 多租户组织管理测试
# ════════════════════════════════════════════

class TestMultiTenant:
    """多租户服务测试"""
    
    @pytest.mark.asyncio
    async def test_generate_slug(self, db):
        """测试URL slug生成"""
        from app.core.multi_tenant_service import OrganizationService
        
        service = OrganizationService(db)
        slug = service._generate_slug("我的组织")
        
        assert '-' in slug  # 应包含连字符
        assert ' ' not in slug  # 不应包含空格
        assert len(slug) > 5  # 应有足够长度
    
    @pytest.mark.asyncio
    async def test_plan_limits_exist(self, db):
        """测试计划限制配置"""
        from app.core.multi_tenant_service import PLAN_LIMITS, OrganizationPlan
        
        assert OrganizationPlan.FREE in PLAN_LIMITS
        assert OrganizationPlan.PRO in PLAN_LIMITS
        assert OrganizationPlan.ENTERPRISE in PLAN_LIMITS
        
        free_limits = PLAN_LIMITS[OrganizationPlan.FREE]
        assert free_limits.max_members == 5
        assert free_limits.max_teams == 1
        
        enterprise_limits = PLAN_LIMITS[OrganizationPlan.ENTERPRISE]
        assert enterprise_limits.max_members == -1  # 无限
    
    @pytest.mark.asyncio
    async def test_quota_usage_calculations(self, db):
        """测试配额使用率计算"""
        from app.core.multi_tenant_service import QuotaUsage, ResourceType
        
        quota = QuotaUsage(
            resource_type=ResourceType.STORAGE,
            used=3200,
            limit=10240,
            unit="MB",
        )
        
        assert quota.percentage == 31.25  # 3200/10240*100
        assert quota.remaining == 7040
        assert quota.is_exceeded == False
        
        exceeded_quota = QuotaUsage(
            resource_type=ResourceType.MEMBERS,
            used=10,
            limit=5,
            unit="人",
        )
        
        assert exceeded_quota.is_exceeded == True
    
    @pytest.mark.asyncio
    async def test_role_hierarchy(self, db):
        """测试角色层级验证"""
        from app.core.multi_tenant_service import OrganizationService, OrganizationRole
        
        service = OrganizationService(db)
        
        with patch.object(service, '_get_membership', return_value={"role": "admin"}):
            has_permission = await service._check_permission(1, 1, [
                OrganizationRole.ADMIN,
                OrganizationRole.MEMBER,
            ])
            assert has_permission == True
        
        with patch.object(service, '_get_membership', return_value={"role": "member"}):
            no_permission = await service._check_permission(1, 1, [OrganizationRole.ADMIN])
            assert no_permission == False


# ════════════════════════════════════════════
# 4. 集成框架测试
# ════════════════════════════════════════════

class TestIntegrationFramework:
    """集成框架测试"""
    
    def test_webhook_signature_generation(self):
        """测试Webhook签名生成"""
        from app.core.integration_framework import WebhookService
        
        body = b'{"test": "data"}'
        secret = "my-secret-key"
        
        signature = WebhookService._generate_signature(body, secret)
        
        assert isinstance(signature, str)
        assert len(signature) == 64  # SHA256 hex长度
    
    def test_webhook_signature_verification(self):
        """测试签名验证"""
        from app.core.integration_framework import WebhookService
        
        body = b'{"event": "test", "data": 123}'
        secret = "test-secret"
        
        signature = WebhookService._generate_signature(body, secret)
        is_valid = WebhookService.verify_signature(body, f"sha256={signature}", secret)
        
        assert is_valid == True
        
        # 错误签名应失败
        is_invalid = WebhookService.verify_signature(body, "sha256=wrongsignature", secret)
        assert is_invalid == False
    
    def test_api_key_generation(self):
        """测试API密钥生成"""
        from app.core.integration_framework import APIKeyService
        
        service = APIKeyService.__new__(APIKeyService)
        plain_key, prefix = service.generate_key()
        
        assert plain_key.startswith('rmf_')
        assert prefix.endswith('...')
        assert len(plain_key) > 50  # 应该足够长
        assert prefix != plain_key  # 前缀不应是完整的密钥
    
    def test_event_bus_subscription(self):
        """测试事件总线订阅/发布"""
        from app.core.integration_framework import event_bus, WebhookEvent
        
        received_events = []
        
        async def handler(event, payload):
            received_events.append((event, payload))
        
        event_bus.subscribe(WebhookEvent.FORMULA_CREATED, handler)
        
        asyncio.get_event_loop().run_until_complete(
            event_bus.publish(WebhookEvent.FORMULA_CREATED, {"id": 123})
        )
        
        assert len(received_events) == 1
        assert received_events[0][0] == WebhookEvent.FORMULA_CREATED
        assert received_events[0][1]["id"] == 123


# ════════════════════════════════════════════
# 5. 合规审计系统测试
# ══════════════════════════════════════════════

class TestAuditSystem:
    """合规审计系统测试"""
    
    @pytest.mark.asyncio
    async def test_audit_log_entry_checksum(self, db):
        """测试审计日志完整性校验值"""
        from app.core.audit_system import AuditLogEntry, AuditAction, AuditResourceType
        
        entry = AuditLogEntry(
            id="test-123",
            action=AuditAction.CREATE,
            resource_type=AuditResourceType.FORMULA,
            resource_id="456",
            user_id=1,
            username="testuser",
            old_value='{"name": "old"}',
            new_value='{"name": "new"}',
        )
        
        checksum = entry.checksum
        assert isinstance(checksum, str)
        assert len(checksum) == 64
    
    @pytest.mark.asyncio
    async def test_audit_log_query_filters(self, db):
        """测试审计日志查询筛选"""
        from app.core.audit_system import AuditService, AuditAction, AuditResourceType, AuditSeverity
        
        service = AuditService(db)
        
        result = await service.query_logs(
            actions=[AuditAction.CREATE],
            severities=[AuditSeverity.HIGH],
            page=1,
            page_size=10,
        )
        
        assert 'logs' in result
        assert 'pagination' in result
        assert result['pagination']['page'] == 1
    
    @pytest.mark.asyncio
    async def test_compliance_report_generation(self, db):
        """测试合规报告生成"""
        from app.core.audit_system import AuditService
        
        service = AuditService(db)
        
        start = datetime.now(timezone.utc) - timedelta(days=30)
        end = datetime.now(timezone.utc)
        
        report = await service.generate_compliance_report(
            title="月度合规报告",
            start_date=start,
            end_date=end,
        )
        
        assert report.title == "月度合规报告"
        assert report.total_events >= 0
        assert 'summary' in report.__dict__
        assert 'sections' in report.__dict__


# ════════════════════════════════════════════
# 6. 营养计算引擎测试
# ════════════════════════════════════════════

class TestNutritionEngine:
    """营养计算引擎测试"""
    
    def test_nrv_values_complete(self):
        """测试NRV参考值完整性"""
        from app.core.nutrition_engine import NRV_VALUES, NutrientType
        
        required_nutrients = [
            NutrientType.ENERGY,
            NutrientType.PROTEIN,
            NutrientType.FAT,
            NutrientType.CARBOHYDRATE,
            NutrientType.SODIUM,
            NutrientType.CALCIUM,
        ]
        
        for nutrient in required_nutrients:
            assert nutrient in NRV_VALUES
            assert NRV_VALUES[nutrient] > 0
    
    def test_health_score_range(self):
        """测试健康评分范围"""
        from app.core.nutrition_engine import NutritionEngine
        
        engine = NutritionEngine.__new__(NutritionEngine)
        
        # 完美营养组合
        perfect_nutrients = {
            engine.NutrientType.PROTEIN: 15,
            engine.NutrientType.DIETARY_FIBER: 8,
            engine.NutrientType.SODIUM: 200,
            engine.NutrientType.FAT: 10,
        }
        
        score = engine._calculate_health_score(perfect_nutrients)
        assert 0 <= score <= 100
        assert score > 80  # 高分
        
        # 不健康组合
        unhealthy_nutrients = {
            engine.NutrientType.PROTEIN: 2,
            engine.NutrientType.SODIUM: 2000,
            engine.NutrientType.FAT: 50,
        }
        
        low_score = engine._calculate_health_score(unhealthy_nutrients)
        assert 0 <= low_score <= 100
        assert low_score < 60  # 低分
    
    def test_recommendations_generation(self):
        """测试改进建议生成"""
        from app.core.nutrition_engine import NutritionEngine, AllergenType
        
        engine = NutritionEngine.__new__(NutritionEngine)
        
        # 低蛋白
        recs_low_protein = engine._generate_recommendations(
            {engine.NutrientType.PROTEIN: 3},
            set(),
        )
        assert any('蛋白质' in r for r in recs_low_protein)
        
        # 含过敏原
        recs_allergen = engine._generate_recommendations(
            {engine.NutrientType.PROTEIN: 12},
            {AllergenType.GLUTEN, AllergenType.PEANUT},
        )
        assert any('过敏原' in r for r in recs_allergen)


# ════════════════════════════════════════════
# 7. 国际化与扩展框架测试
# ════════════════════════════════════════════

class TestExtensionFramework:
    """扩展框架测试"""
    
    def test_i18n_translation(self):
        """测试国际化翻译"""
        from app.core.extension_framework import i18n, Locale
        
        # 中文翻译
        zh_save = i18n.t('common.save', locale=Locale.ZH_CN)
        assert zh_save == '保存'
        
        # 英文翻译
        en_save = i18n.t('common.save', locale=Locale.EN_US)
        assert en_save == 'Save'
        
        # 变量插值
        mention = i18n.t(
            'collaboration.mention',
            locale=Locale.ZH_CN,
            user='张三',
        )
        assert '张三' in mention
    
    def test_i18n_fallback_chain(self):
        """测试翻译回退机制"""
        from app.core.extension_framework import i18n, Locale
        
        # 不存在的key应返回key本身
        unknown = i18n.t('nonexistent.key', locale=Locale.ZH_CN)
        assert unknown == 'nonexistent.key'
    
    def test_available_locales(self):
        """测试可用语言列表"""
        from app.core.extension_framework import i18n
        
        locales = i18n.get_available_locales()
        
        codes = [l['code'] for l in locales]
        assert 'zh-CN' in codes
        assert 'en-US' in codes
        assert len(locales) >= 4  # 至少支持4种语言
    
    def test_shortcut_manager_defaults(self):
        """测试快捷键默认注册"""
        from app.core.extension_framework import ShortcutManager, ShortcutScope
        
        manager = ShortcutManager()
        
        global_shortcuts = manager.get_for_scope(ShortcutScope.GLOBAL)
        assert len(global_shortcuts) > 0
        
        # 应包含Ctrl+K全局搜索
        shortcut_keys = [s.keys.lower() for s in global_shortcuts]
        assert 'ctrl+k' in shortcut_keys
    
    async def test_plugin_manager_discovery(self):
        """测试插件发现（需要plugins目录）"""
        from app.core.api_framework.extension_framework import PluginManager
        import os
        
        manager = PluginManager(plugins_dir='./plugins')
        
        if os.path.exists('./plugins'):
            plugins = await manager.discover_plugins()
            assert isinstance(plugins, list)
        else:
            plugins = await manager.discover_plugins()
            assert plugins == []  # 目录不存在时返回空列表


# ════════════════════════════════════════════
# 运行入口
# ════════════════════════════════════════════

if __name__ == '__main__':
    pytest.main([__file__, '-v', '--tb=short'])
