"""用户服务单元测试

覆盖:
- 用户创建
- 用户查询（单个/列表）
- 用户更新
- 用户禁用（软删除）
- 角色管理
"""
import pytest

from app.services.user import UserService
from app.models.enums import UserRole


@pytest.mark.asyncio
class TestUserService:
    """用户业务逻辑"""

    async def test_create_user(self, db_session):
        """创建用户成功"""
        service = UserService(db_session)

        from app.schemas.user import UserCreate
        user = await service.create_user(UserCreate(
            username="newuser",
            email="new@test.com",
            password="SecurePass123!",
            full_name="新用户",
        ))

        assert user.id is not None
        assert user.username == "newuser"
        assert user.email == "new@test.com"
        assert user.role == UserRole.RESEARCHER
        assert user.is_active is True

    async def test_create_duplicate_username(self, db_session, create_user):
        """重复用户名创建失败"""
        await create_user(username="existing")

        service = UserService(db_session)
        from app.schemas.user import UserCreate
        with pytest.raises(Exception) as exc_info:
            await service.create_user(UserCreate(
                username="existing",
                email="other@test.com",
                password="Pass123!",
            ))
        assert exc_info.value.status_code == 400

    async def test_get_user_by_id(self, db_session, create_user):
        """按 ID 查询用户"""
        user = await create_user(username="getuser")

        service = UserService(db_session)
        result = await service.get_user(user.id)

        assert result is not None
        assert result.username == "getuser"

    async def test_get_user_by_username(self, db_session, create_user):
        """按用户名查询用户"""
        await create_user(username="findme")

        service = UserService(db_session)
        result = await service.get_user_by_username("findme")

        assert result is not None
        assert result.username == "findme"

    async def test_list_users(self, db_session, create_user):
        """用户列表查询"""
        await create_user(username="user1")
        await create_user(username="user2")
        await create_user(username="user3")

        service = UserService(db_session)
        users, total = await service.list_users(page=1, page_size=10)

        assert total >= 3
        assert len(users) >= 3

    async def test_list_users_with_role_filter(self, db_session, create_user):
        """按角色过滤用户"""
        await create_user(username="researcher1", role=UserRole.RESEARCHER)
        await create_user(username="admin1", role=UserRole.ADMIN)

        service = UserService(db_session)
        researchers, _ = await service.list_users(role=UserRole.RESEARCHER)
        admins, _ = await service.list_users(role=UserRole.ADMIN)

        researcher_names = [u.username for u in researchers]
        admin_names = [u.username for u in admins]

        assert "researcher1" in researcher_names
        assert "admin1" in admin_names

    async def test_list_users_with_search(self, db_session, create_user):
        """搜索用户"""
        await create_user(username="alice", full_name="爱丽丝")
        await create_user(username="bob", full_name="鲍勃")

        service = UserService(db_session)
        results, _ = await service.list_users(search="alice")

        usernames = [u.username for u in results]
        assert "alice" in usernames

    async def test_update_user(self, db_session, create_user):
        """更新用户信息"""
        user = await create_user(username="upduser")

        service = UserService(db_session)
        from app.schemas.user import UserUpdate
        updated = await service.update_user(user.id, UserUpdate(
            full_name="更新后名称",
            department="新部门",
        ))

        assert updated.full_name == "更新后名称"
        assert updated.department == "新部门"

    async def test_deactivate_user(self, db_session, create_user):
        """禁用用户（软删除）"""
        user = await create_user(username="deactivate")

        service = UserService(db_session)
        await service.deactivate_user(user.id)

        result = await service.get_user(user.id)
        assert result.is_active is False
