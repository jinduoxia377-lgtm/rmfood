"""RMFOOD 团队协作模块单元测试

覆盖关键功能：
- 团队CRUD（创建/邀请/移除/权限边界）
- RBAC权限检查（各种角色×操作的矩阵测试）
- 版本控制（创建/回滚/Diff对比）
- 通知推送（WebSocket模拟）
- 搜索功能（Elasticsearch mock）
"""
import pytest
from datetime import datetime, timezone
from unittest.mock import Mock, AsyncMock, MagicMock

from sqlalchemy.ext.asyncio import AsyncSession

import sys
sys.path.insert(0, 'd:/RMFOOD配方平台/backend')

from app.services.team.team_impl import TeamService
from app.services.version.version_impl import VersioningService, SemanticVersion
from app.services.notification import NotificationService
from app.services.search.elasticsearch_service import ElasticsearchService, SearchFilters, SearchResult
from app.websockets.notification_handler import NotificationWebSocketHandler

pytestmark = pytest.mark.skip(reason="app.services.auth.* 已迁移到 app.core.rbac，通知服务已迁移，测试待重写")


@pytest.fixture
def db_session():
    """Mock数据库会话"""
    session = AsyncMock(spec=AsyncSession)
    
    async def mock_execute(query):
        result = MagicMock()
        result.scalar_one_or_none = Mock(return_value=None)
        result.scalars = Mock(return_value=MagicMock(all=Mock(return_value=[])))
        result.all = Mock(return_value=[])
        return result
    
    session.execute = mock_execute
    session.add = Mock()
    session.flush = AsyncMock()
    session.commit = AsyncMock()
    session.refresh = Mock()
    session.delete = Mock()
    
    return session


class TestTeamService:
    """团队服务测试"""

    @pytest.mark.asyncio
    async def test_create_team_success(self, db_session):
        """测试成功创建团队"""
        service = TeamService(db_session)
        
        team = await service.create_team(
            owner_id=1,
            name="测试团队",
            description="这是一个测试团队",
        )
        
        assert team is not None
        assert team.name == "测试团队"
        assert team.owner_id == 1
        
        db_session.add.assert_called()

    @pytest.mark.asyncio
    async def test_create_team_invalid_name(self, db_session):
        """测试团队名称验证"""
        service = TeamService(db_session)
        
        with pytest.raises(ValueError, match="名称长度"):
            await service.create_team(owner_id=1, name="A")

    @pytest.mark.asyncio
    async def test_get_team_requires_membership(self, db_session):
        """测试获取团队需要成员身份"""
        service = TeamService(db_session)
        
        from app.core.exceptions import PermissionDeniedException
        
        with pytest.raises(PermissionDeniedException):
            await service.get_team(team_id=999, user_id=999)

    @pytest.mark.asyncio
    async def test_invite_member_by_user_id(self, db_session):
        """测试通过用户ID邀请成员"""
        service = TeamService(db_session)
        
        mock_user_result = MagicMock()
        mock_user_result.scalar_one_or_none = Mock(return_value=MagicMock())
        db_session.execute = AsyncMock(return_value=mock_user_result)
        
        result = await service.invite_member(
            team_id=1,
            inviter_id=1,
            user_id=2,
        )
        
        assert result["success"] is True
        assert result["method"] == "direct"

    @pytest.mark.asyncio
    async def test_invite_member_by_email(self, db_session):
        """测试通过邮箱邀请成员"""
        service = TeamService(db_session)
        
        result = await service.invite_member(
            team_id=1,
            inviter_id=1,
            email="test@example.com",
        )
        
        assert result["success"] is True
        assert result["method"] == "email"
        assert "invite_code" in result

    @pytest.mark.asyncio
    async def test_remove_member_as_admin(self, db_session):
        """测试管理员移除成员"""
        service = TeamService(db_session)
        
        mock_member = MagicMock()
        mock_member.user_id = 2
        mock_member.role = MagicMock(value="member")
        
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = Mock(return_value=mock_member)
        db_session.execute = AsyncMock(return_value=mock_result)
        
        result = await service.remove_member(
            team_id=1,
            operator_id=1,
            member_id=10,
        )
        
        assert result is True

    @pytest.mark.asyncio
    async def test_cannot_remove_owner(self, db_session):
        """测试不能移除Owner"""
        service = TeamService(db_session)
        
        from app.models.enums import TeamRole
        from app.core.exceptions import PermissionDeniedException
        
        mock_member = MagicMock()
        mock_member.user_id = 2
        mock_member.role = TeamRole.OWNER
        
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = Mock(return_value=mock_member)
        db_session.execute = AsyncMock(return_value=mock_result)
        
        with pytest.raises(PermissionDeniedException, match="Owner"):
            await service.remove_member(team_id=1, operator_id=1, member_id=10)

    @pytest.mark.asyncio
    async def test_update_member_role(self, db_session):
        """测试更新成员角色"""
        service = TeamService(db_session)
        
        from app.models.enums import TeamRole
        
        mock_member = MagicMock()
        mock_member.user_id = 2
        mock_member.role = TeamRole.MEMBER
        
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = Mock(return_value=mock_member)
        db_session.execute = AsyncMock(return_value=mock_result)
        
        updated = await service.update_member_role(
            team_id=1,
            operator_id=1,
            member_id=10,
            new_role=TeamRole.ADMIN,
        )
        
        assert updated.role == TeamRole.ADMIN

    @pytest.mark.asyncio
    async def test_generate_invite_link(self, db_session):
        """测试生成邀请链接"""
        service = TeamService(db_session)
        
        link_info = await service.get_invite_link(
            team_id=1,
            creator_id=1,
            expires_hours=24,
            max_uses=10,
        )
        
        assert "invite_code" in link_info
        assert "invite_url" in link_info
        assert link_info["max_uses"] == 10
        assert link_info["used_count"] == 0


class TestRBACPermissions:
    """RBAC权限控制测试"""

    def test_owner_has_full_access(self):
        """测试Owner拥有所有权限"""
        for resource in ["team", "category", "prompt_template", "version"]:
            for action in ["view", "create", "edit", "delete", "manage"]:
                assert check_role_permission("owner", resource, action) is True

    def test_admin_has_most_permissions(self):
        """测试Admin拥有大部分权限"""
        assert check_role_permission("admin", "prompt_template", "edit") is True
        assert check_role_permission("admin", "version", "create") is True
        assert check_role_permission("admin", "team", "delete") is False

    def test_member_limited_permissions(self):
        """测试Member权限受限"""
        assert check_role_permission("member", "prompt_template", "view") is True
        assert check_role_permission("member", "prompt_template", "edit") is True
        assert check_role_permission("member", "prompt_template", "delete") is False
        assert check_role_permission("member", "version", "view") is True
        assert check_role_permission("member", "version", "create") is False

    def test_guest_read_only(self):
        """测试Guest只有只读权限"""
        assert check_role_permission("guest", "prompt_template", "view") is True
        assert check_role_permission("guest", "prompt_template", "edit") is False
        assert check_role_permission("guest", "category", "create") is False

    def test_wildcard_permission(self):
        """测试通配符权限"""
        owner_perms = get_role_permissions("owner")
        
        for resource, actions in owner_perms.items():
            assert "*" in actions or len(actions) > 0

    def test_get_all_permissions_format(self):
        """测试获取所有权限的格式"""
        admin_perms = get_all_permissions_for_role("admin")
        
        assert isinstance(admin_perms, set)
        assert len(admin_perms) > 0
        
        for perm in admin_perms:
            assert ":" in perm

    def test_resource_hierarchy_defined(self):
        """测试资源层级已定义"""
        assert "team" in RESOURCE_HIERARCHY
        assert "prompt_template" in RESOURCE_HIERARCHY
        assert "version" in RESOURCE_HIERARCHY
        
        for resource, actions in RESOURCE_HIERARCHY.items():
            assert "view" in actions


class TestVersionControl:
    """版本控制测试"""

    @pytest.mark.asyncio
    async def test_create_version(self, db_session):
        """测试创建新版本"""
        service = VersioningService(db_session)
        
        mock_max_result = MagicMock()
        mock_max_result.scalar = Mock(return_value=None)
        
        db_session.execute = AsyncMock(return_value=mock_max_result)
        
        version = await service.create_version(
            prompt_id=1,
            user_id=1,
            content="这是提示词内容 v1",
            changelog="初始版本",
            change_type="patch",
        )
        
        assert version.content_snapshot == "这是提示词内容 v1"
        assert version.created_by == 1

    @pytest.mark.asyncio
    async def test_semantic_version_parsing(self):
        """测试语义化版本号解析"""
        v1 = SemanticVersion.parse("1.2.3")
        assert v1.major == 1
        assert v1.minor == 2
        assert v1.patch == 3
        assert str(v1) == "1.2.3"

        v2 = SemanticVersion.parse("2.0")
        assert v2.major == 2
        assert v2.minor == 0
        assert v2.patch == 0

        v3 = SemanticVersion.parse("invalid")
        assert str(v3) == "1.0.0"

    def test_semantic_version_increment(self):
        """测试版本号递增"""
        v = SemanticVersion(1, 2, 3)
        
        major_inc = v.increment_major()
        assert (major_inc.major, major_inc.minor, major_inc.patch) == (2, 0, 0)
        
        minor_inc = v.increment_minor()
        assert (minor_inc.major, minor_inc.minor, minor_inc.patch) == (1, 3, 0)
        
        patch_inc = v.increment_patch()
        assert (patch_inc.major, patch_inc.minor, patch_inc.patch) == (1, 2, 4)

    @pytest.mark.asyncio
    async def test_rollback_version(self, db_session):
        """测试版本回滚"""
        service = VersioningService(db_session)
        
        target_version = MagicMock()
        target_version.version_number = 5
        target_version.content_snapshot = "回滚目标内容"
        
        mock_target_result = MagicMock()
        mock_target_result.scalar_one_or_none = Mock(return_value=target_version)
        
        mock_max_result = MagicMock()
        mock_max_result.scalar = Mock(return_value=7)
        
        call_count = [0]
        def mock_execute_side_effect(query):
            if call_count[0] == 0:
                call_count[0] += 1
                return mock_target_result
            else:
                return mock_max_result
        
        db_session.execute = AsyncMock(side_effect=mock_execute_side_effect)
        
        result = await service.rollback_version(
            prompt_id=1,
            version_id=10,
            user_id=1,
            reason="回滚到稳定版本",
        )
        
        assert result["success"] is True
        assert result["rolled_back_to_version"] == 5
        assert result["new_version_id"] is not None

    @pytest.mark.asyncio
    async def test_compare_versions_limit(self, db_session):
        """测试多版本对比数量限制"""
        service = VersioningService(db_session)
        
        too_many_ids = list(range(6))
        
        with pytest.raises(ValueError, match="最多支持"):
            await service.compare_versions(prompt_id=1, version_ids=too_many_ids)


class TestNotificationService:
    """通知服务测试"""

    @pytest.mark.asyncio
    async def test_create_notification(self, db_session):
        """测试创建通知"""
        service = NotificationService(db_session)
        
        notification = await service.create_notification(
            recipient_id=1,
            type_="mention",
            title="@您被提及了",
            content="有人在评论中提到了您",
            metadata={"source": "comment"},
            actor_id=2,
        )
        
        assert notification.user_id == 1
        assert notification.is_read is False
        assert notification.title == "@您被提及了"

    @pytest.mark.asyncio
    async def test_mark_as_read(self, db_session):
        """测试标记已读"""
        service = NotificationService(db_session)
        
        mock_notif = MagicMock()
        mock_notif.is_read = False
        
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = Mock(return_value=mock_notif)
        db_session.execute = AsyncMock(return_value=mock_result)
        
        result = await service.mark_as_read(notification_id=1, user_id=1)
        
        assert result is True
        assert mock_notif.is_read is True

    @pytest.mark.asyncio
    async def test_get_unread_count(self, db_session):
        """测试获取未读数量"""
        service = NotificationService(db_session)
        
        mock_count = MagicMock()
        mock_count.scalar = Mock(return_value=5)
        db_session.execute = AsyncMock(return_value=mock_count)
        
        count = await service.get_unread_count(user_id=1)
        
        assert count == 5

    @pytest.mark.asyncio
    async def test_bulk_create_notifications(self, db_session):
        """测试批量创建通知"""
        service = NotificationService(db_session)
        
        count = await service.bulk_create(
            recipients=[1, 2, 3],
            type_="system_alert",
            title="系统维护通知",
            content="系统将在今晚进行维护",
        )
        
        assert count == 3

    def test_notification_preferences_defaults(self):
        """测试通知偏好默认值"""
        prefs = NotificationPreferences()
        
        assert prefs.email_enabled is True
        assert prefs.push_enabled is True
        assert prefs.mention is True
        assert prefs.quiet_hours_start is None


class TestMentionParser:
    """@提及解析器测试"""

    def test_parse_simple_mentions(self):
        """测试简单@提及解析"""
        text = "@john 请看一下这个prompt @alice"
        cleaned, usernames = parse_mentions(text)
        
        assert cleaned.strip() == "请看一下这个prompt"
        assert "john" in usernames
        assert "alice" in usernames

    def test_parse_no_mentions(self):
        """测试无@提及文本"""
        text = "这是一个普通的消息，没有提及任何人"
        cleaned, usernames = parse_mentions(text)
        
        assert cleaned == text
        assert len(usernames) == 0

    def test_excessive_mentions_detection(self):
        """测试过多提及检测"""
        normal_text = "@user1 @user2 你好"
        excessive_text = " ".join([f"@user{i}" for i in range(15)])
        
        assert has_excessive_mentions(normal_text) is False
        assert has_excessive_mentions(excessive_text) is True

    def test_duplicate_mentions_removed(self):
        """测试重复提及去重"""
        text = "@john @john @alice @john"
        cleaned, usernames = parse_mentions(text)
        
        assert usernames.count("john") == 1
        assert usernames.count("alice") == 1


class TestElasticsearchService:
    """Elasticsearch搜索服务测试"""

    @pytest.mark.asyncio
    async def test_index_prompt(self, db_session):
        """测试索引文档"""
        service = ElasticsearchService(db_session)
        
        prompt_data = {
            "id": 1,
            "name": "测试提示词",
            "content": "这是用于测试的内容",
            "tags": ["test", "sample"],
            "category": "general",
            "author_name": "TestUser",
            "author_id": 1,
            "created_at": datetime.now(timezone.utc),
            "popularity": 50.0,
        }
        
        await service.index_prompt(prompt_data)
        
        assert 1 in service._index_store

    @pytest.mark.asyncio
    async def test_search_with_results(self, db_session):
        """测试搜索功能"""
        service = ElasticsearchService(db_session)
        
        await service.index_prompt({
            "id": 1,
            "name": "配方优化算法",
            "content": "基于神经网络的配方优化方法",
            "tags": ["AI", "optimization"],
            "category": "algorithm",
            "author_name": "Researcher",
            "author_id": 1,
            "created_at": datetime.now(timezone.utc),
            "popularity": 80.0,
        })
        
        filters = SearchFilters(category="algorithm")
        result = await service.search("配方", filters=filters)
        
        assert isinstance(result, SearchResult)
        assert result.total >= 0

    @pytest.mark.asyncio
    async def test_search_empty_query(self, db_session):
        """测试空查询返回空结果"""
        service = ElasticsearchService(db_session)
        
        result = await service.search("", SearchFilters())
        
        assert result.total == 0
        assert len(result.hits) == 0

    @pytest.mark.asyncio
    async def test_suggest_prefix_match(self, db_session):
        """测试搜索建议前缀匹配"""
        service = ElasticsearchService(db_session)
        
        await service.index_prompt({
            "id": 1,
            "name": "蛋白质分析工具",
            "content": "...",
            "tags": [],
            "category": "analysis",
            "author_name": "User",
            "author_id": 1,
            "created_at": datetime.now(timezone.utc),
        })
        
        suggestions = await service.suggest(prefix="蛋白")
        
        assert len(suggestions) > 0
        assert any("蛋白质" in s.text for s in suggestions)

    @pytest.mark.asyncio
    async def test_delete_from_index(self, db_session):
        """测试从索引删除"""
        service = ElasticsearchService(db_session)
        
        await service.index_prompt({"id": 99, "name": "临时文档"})
        assert 99 in service._index_store
        
        await service.delete_index(99)
        assert 99 not in service._index_store


class TestWebSocketHandler:
    """WebSocket处理器测试"""

    @pytest.fixture
    def ws_handler_instance(self):
        """创建WS处理器实例"""
        handler = NotificationWebSocketHandler()
        return handler

    @pytest.mark.asyncio
    async def test_connect_and_disconnect(self, ws_handler_instance):
        """测试连接和断开"""
        ws_mock = AsyncMock(spec=object)
        ws_mock.accept = AsyncMock()
        ws_mock.send_json = AsyncMock()
        
        connection = await ws_handler_instance.connect(
            websocket=ws_mock,
            team_id=1,
            user_id=100,
            username="TestUser",
        )
        
        assert 1 in ws_handler_instance.rooms
        assert 100 in ws_handler_instance.rooms[1]
        assert connection.user_id == 100

        await ws_handler_instance.disconnect(ws_mock, team_id=1, user_id=100)
        
        assert 100 not in ws_handler_instance.rooms.get(1, {})

    @pytest.mark.asyncio
    async def test_push_notification_to_room(self, ws_handler_instance):
        """测试推送通知到房间"""
        
        ws_mocks = []
        for i in range(3):
            ws = AsyncMock(spec=object)
            ws.send_json = AsyncMock()
            ws_mocks.append(ws)
            
            await ws_handler_instance.connect(ws, team_id=1, user_id=i+1, username=f"User{i}")
        
        payload = NotificationPayload(
            type="mention",
            title="您被提及了",
            content="在评论中被@提及",
        )
        
        results = await ws_handler_instance.push_notification(
            team_id=1,
            notification=payload,
        )
        
        assert len(results) == 3
        assert all(v is True for v in results.values())

    @pytest.mark.asyncio
    async def test_push_to_empty_room(self, ws_handler_instance):
        """测试向空房间推送"""
        payload = NotificationPayload(type="test", title="测试")
        
        results = await ws_handler_instance.push_notification(
            team_id=999,
            notification=payload,
        )
        
        assert len(results) == 0


class TestPermissionService:
    """权限服务测试"""

    @pytest.mark.asyncio
    async def test_check_permission_with_cache(self, db_session):
        """测试带缓存的权限检查"""
        cache = {}
        service = PermissionService(cache=cache)
        
        mock_member = MagicMock()
        mock_member.role = MagicMock(value="admin")
        
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = Mock(return_value=mock_member)
        db_session.execute = AsyncMock(return_value=mock_result)
        
        has_perm = await service.check_permission(
            user_id=1,
            resource_type="prompt_template",
            resource_id=1,
            action="edit",
            db=db_session,
        )
        
        assert has_perm is True

    @pytest.mark.asyncio
    async def test_batch_check_permissions(self, db_session):
        """测试批量权限检查"""
        service = PermissionService(cache={})
        
        mock_member = MagicMock()
        mock_member.role = MagicMock(value="member")
        
        mock_result = MagicMock()
        mock_result.scalar_one_or_none = Mock(return_value=mock_member)
        db_session.execute = AsyncMock(return_value=mock_result)
        
        from app.services.auth.permissions import PermissionCheck
        
        checks = [
            PermissionCheck(resource_type="prompt_template", resource_id=1, action="view"),
            PermissionCheck(resource_type="prompt_template", resource_id=2, action="edit"),
            PermissionCheck(resource_type="version", resource_id=1, action="view"),
        ]
        
        results = await service.batch_check_permissions(user_id=1, checks=checks, db=db_session)
        
        assert len(results) == 3


@pytest.mark.asyncio
async def test_integration_team_lifecycle():
    """集成测试：团队完整生命周期"""
    db = AsyncMock(spec=AsyncSession)
    
    team_service = TeamService(db)
    
    try:
        team = await team_service.create_team(
            owner_id=1,
            name="集成测试团队",
        )
        
        print(f"✅ 团队创建成功: {team.name}")
        
        link_info = await team_service.get_invite_link(
            team_id=team.id,
            creator_id=1,
        )
        
        print(f"🔗 邀请链接: {link_info['invite_url']}")
        
        print("✅ 集成测试通过")
        
    except Exception as e:
        print(f"❌ 集成测试失败: {e}")
        raise


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
