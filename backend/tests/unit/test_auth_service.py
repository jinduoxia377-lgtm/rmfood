"""认证服务单元测试

覆盖:
- 用户登录（成功/失败/锁定）
- 用户注册（成功/重复用户名/重复邮箱）
- Token 生成与验证
- Token 黑名单
- 密码哈希与验证
"""
import pytest
from unittest.mock import AsyncMock, patch

from app.services.auth import AuthService, get_password_hash, verify_password
from app.utils.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    add_token_to_blacklist,
    is_token_blacklisted,
    validate_password_strength,
)
from app.models.user_model import User
from app.models.enums import UserRole
from app.schemas.user import Token


# ════════════════════════════════════════════
# 密码工具测试
# ════════════════════════════════════════════

class TestPasswordUtils:
    """密码哈希与验证"""

    def test_hash_and_verify(self):
        """密码哈希后能正确验证"""
        password = "SecurePass123!"
        hashed = get_password_hash(password)

        assert hashed != password
        assert verify_password(password, hashed) is True

    def test_wrong_password_fails(self):
        """错误密码无法通过验证"""
        hashed = get_password_hash("CorrectPass123!")
        assert verify_password("WrongPass123!", hashed) is False

    def test_password_strength_validation(self):
        """密码强度验证"""
        # 弱密码
        is_valid, msg = validate_password_strength("123")
        assert is_valid is False
        assert "8位" in msg

        # 无大写字母
        is_valid, msg = validate_password_strength("abcdefgh1")
        assert is_valid is False

        # 无小写字母
        is_valid, msg = validate_password_strength("ABCDEFGH1")
        assert is_valid is False

        # 无数字
        is_valid, msg = validate_password_strength("Abcdefgh!")
        assert is_valid is False

        # 合格密码
        is_valid, msg = validate_password_strength("Abcdef1!")
        assert is_valid is True
        assert msg == ""


# ════════════════════════════════════════════
# Token 测试
# ════════════════════════════════════════════

class TestTokenOperations:
    """Token 生成、解码、黑名单"""

    def test_create_and_decode_access_token(self):
        """Access Token 生成和解码"""
        token = create_access_token({"sub": "42", "role": "admin"})
        payload = decode_token(token)

        assert payload["sub"] == "42"
        assert payload["role"] == "admin"
        assert payload["type"] == "access"

    def test_create_and_decode_refresh_token(self):
        """Refresh Token 生成和解码"""
        token = create_refresh_token("42")
        payload = decode_token(token)

        assert payload["sub"] == "42"
        assert payload["type"] == "refresh"

    def test_token_blacklist(self):
        """Token 黑名单功能"""
        token = create_access_token({"sub": "1", "role": "researcher"})

        # 未加入黑名单前可正常使用
        assert is_token_blacklisted(token) is False

        # 加入黑名单
        result = add_token_to_blacklist(token)
        assert result is True

        # 加入黑名单后被标记
        assert is_token_blacklisted(token) is True

    def test_blacklisted_token_rejected(self):
        """黑名单 Token 解码时被拒绝"""
        from fastapi import HTTPException

        token = create_access_token({"sub": "1", "role": "researcher"})
        add_token_to_blacklist(token)

        with pytest.raises(HTTPException) as exc_info:
            decode_token(token)
        assert exc_info.value.status_code == 401


# ════════════════════════════════════════════
# AuthService 测试
# ════════════════════════════════════════════

@pytest.mark.asyncio
class TestAuthService:
    """认证业务逻辑"""

    async def test_register_success(self, db_session, create_user):
        """注册成功"""
        service = AuthService(db_session)
        user = await service.register(
            username="newuser",
            email="new@test.com",
            password="NewPass123!",
            full_name="新用户",
        )

        assert user.username == "newuser"
        assert user.email == "new@test.com"
        assert user.role == UserRole.RESEARCHER
        assert user.is_active is True
        assert user.hashed_password != "NewPass123!"  # 密码已哈希

    async def test_register_duplicate_username(self, db_session, create_user):
        """重复用户名注册失败"""
        await create_user(username="existing")

        service = AuthService(db_session)
        with pytest.raises(Exception) as exc_info:
            await service.register(
                username="existing",
                email="other@test.com",
                password="Pass123!",
            )
        assert "用户名已存在" in str(exc_info.value.detail)

    async def test_register_duplicate_email(self, db_session, create_user):
        """重复邮箱注册失败"""
        await create_user(username="user1", email="same@test.com")

        service = AuthService(db_session)
        with pytest.raises(Exception) as exc_info:
            await service.register(
                username="user2",
                email="same@test.com",
                password="Pass123!",
            )
        assert "邮箱已被注册" in str(exc_info.value.detail)

    async def test_authenticate_success(self, db_session, create_user):
        """登录成功"""
        await create_user(username="loginuser", password="LoginPass123!")

        service = AuthService(db_session)
        token = await service.authenticate("loginuser", "LoginPass123!")

        assert isinstance(token, Token)
        assert token.access_token
        assert token.refresh_token

    async def test_authenticate_wrong_password(self, db_session, create_user):
        """密码错误登录失败"""
        await create_user(username="loginuser", password="CorrectPass123!")

        service = AuthService(db_session)
        with pytest.raises(Exception) as exc_info:
            await service.authenticate("loginuser", "WrongPass123!")
        assert exc_info.value.status_code == 401

    async def test_authenticate_nonexistent_user(self, db_session):
        """不存在的用户登录失败"""
        service = AuthService(db_session)
        with pytest.raises(Exception) as exc_info:
            await service.authenticate("nobody", "Pass123!")
        assert exc_info.value.status_code == 401

    async def test_authenticate_inactive_user(self, db_session, create_user):
        """禁用账户登录失败"""
        await create_user(username="inactive", is_active=False)

        service = AuthService(db_session)
        with pytest.raises(Exception) as exc_info:
            await service.authenticate("inactive", "TestPassword123!")
        # 密码正确但账户禁用，返回 403
        assert exc_info.value.status_code == 403

    async def test_change_password_success(self, db_session, create_user):
        """修改密码成功"""
        user = await create_user(username="changepw", password="OldPass123!")

        service = AuthService(db_session)
        await service.change_password(user.id, "OldPass123!", "NewPass123!")

        # 用新密码登录
        token = await service.authenticate("changepw", "NewPass123!")
        assert token.access_token

    async def test_change_password_wrong_old(self, db_session, create_user):
        """旧密码错误修改失败"""
        user = await create_user(username="changepw", password="OldPass123!")

        service = AuthService(db_session)
        with pytest.raises(Exception) as exc_info:
            await service.change_password(user.id, "WrongOld!", "NewPass123!")
        assert exc_info.value.status_code == 400

    async def test_refresh_access_token(self, db_session, create_user):
        """刷新 Token 成功"""
        user = await create_user(username="refreshuser")

        service = AuthService(db_session)
        token = await service.authenticate("refreshuser", "TestPassword123!")

        new_token = await service.refresh_access_token(token.refresh_token)
        assert isinstance(new_token, Token)
        assert new_token.access_token != token.access_token  # 新 token 不同

    async def test_get_current_user(self, db_session, create_user):
        """通过 Token 获取当前用户"""
        user = await create_user(username="meuser")

        service = AuthService(db_session)
        token = await service.authenticate("meuser", "TestPassword123!")

        current_user = await service.get_current_user(token.access_token)
        assert current_user is not None
        assert current_user.username == "meuser"
