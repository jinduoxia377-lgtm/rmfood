"""
RMFOOD 核心模块单元测试 - 认证与授权系统

覆盖范围:
- 用户注册/登录流程
- JWT Token 生成与验证
- 密码哈希与验证
- 权限检查
- 账户锁定机制
"""

import pytest
import asyncio
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch

# ============================================================
# 1. 认证服务测试
# ============================================================

class TestAuthService:
    """认证服务核心逻辑测试"""
    
    @pytest.mark.asyncio
    async def test_register_user_success(self):
        """测试正常用户注册"""
        from app.services.auth import AuthService
        
        db = AsyncMock()
        service = AuthService(db)
        
        # Mock 数据库操作
        db.execute.return_value = AsyncMock()
        db.execute.return_value.scalars.return_value.first.return_value = None  # username不存在
        
        # 执行注册
        user = await service.register(
            username="testuser",
            email="test@example.com",
            password="SecurePass123!",
            full_name="Test User"
        )
        
        # 验证结果
        assert user is not None
        assert user.username == "testuser"
        assert user.email == "test@example.com"
        assert user.role.value == "researcher"  # 默认角色
    
    @pytest.mark.asyncio
    async def test_register_duplicate_username(self):
        """测试重复用户名注册失败"""
        from app.services.auth import AuthService
        from sqlalchemy.exc import IntegrityError
        
        db = AsyncMock()
        service = AuthService(db)
        
        # Mock 用户已存在
        db.execute.side_effect = IntegrityError("duplicate key", params=None, orig=None)
        
        # 验证抛出异常
        with pytest.raises(ValueError) as exc_info:
            await service.register(
                username="existing_user",
                email="new@email.com",
                password="password",
                full_name="User"
            )
        
        assert "已存在" in str(exc_info.value)
    
    @pytest.mark.asyncio
    async def test_login_success(self):
        """测试成功登录"""
        from app.services.auth import AuthService
        
        db = AsyncMock()
        service = AuthService(db)
        
        # Mock 用户查询
        mock_user = MagicMock()
        mock_user.id = 1
        mock_user.username = "admin"
        mock_user.hashed_password = "$2b$12$hashed_password_here"  # bcrypt hash
        mock_user.is_active = True
        mock_user.locked_until = None
        mock_user.login_attempts = 0
        
        with patch.object(service, '_verify_password', return_value=True):
            with patch.object(service, '_create_tokens', return_value={
                "access_token": "jwt_access_token",
                "refresh_token": "jwt_refresh_token",
                "token_type": "bearer",
            }):
                result = await service.authenticate("admin", "correct_password")
        
        assert "access_token" in result
        assert "refresh_token" in result
    
    @pytest.mark.asyncio
    async def test_login_wrong_password(self):
        """测试密码错误"""
        from app.services.auth import AuthService
        from fastapi import HTTPException
        
        db = AsyncMock()
        service = AuthService(db)
        
        with pytest.raises(HTTPException) as exc_info:
            await service.authenticate("admin", "wrong_password")
        
        assert exc_info.value.status_code == 401
    
    @pytest.mark.asyncio
    async def test_login_account_locked(self):
        """测试账户被锁定"""
        from app.services.auth import AuthService
        from fastapi import HTTPException
        from datetime import datetime, timezone
        
        db = AsyncMock()
        service = AuthService(db)
        
        # Mock 锁定账户
        mock_user = MagicMock()
        mock_user.id = 1
        mock_user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
        
        with patch('app.services.auth.get_user_by_username', return_value=mock_user):
            with pytest.raises(HTTPException) as exc_info:
                await service.authenticate("locked_user", "password")
            
            assert exc_info.value.status_code == 423  # Locked
            assert "锁定" in str(exc_info.value.detail)


# ============================================================
# 2. JWT Token 测试
# ============================================================

class TestJWTTokenManagement:
    """JWT Token 管理测试"""
    
    def test_create_access_token(self):
        """测试 Access Token 创建"""
        from app.core.auth import create_access_token
        
        token_data = {
            "sub": 1,
            "username": "testuser",
            "role": "researcher"
        }
        
        token = create_access_token(token_data, expires_delta=timedelta(minutes=30))
        
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 100  # JWT tokens are long
    
    def test_decode_valid_token(self):
        """测试有效 Token 解码"""
        from app.core.auth import create_access_token, decode_token
        
        token_data = {"sub": 1, "username": "testuser", "role": "admin"}
        token = create_access_token(token_data)
        
        payload = decode_token(token)
        
        assert payload["sub"] == 1
        assert payload["username"] == "testuser"
        assert payload["role"] == "admin"
    
    def test_decode_expired_token(self):
        """测试过期 Token 解码"""
        from app.core.auth import create_access_token, decode_token
        from jose import JWTError
        
        token_data = {"sub": 1}
        # 创建立即过期的Token
        token = create_access_token(token_data, expires_delta=timedelta(seconds=-1))
        
        with pytest.raises(JWTError):
            decode_token(token)
    
    def test_decode_invalid_token(self):
        """测试无效 Token 解码"""
        from app.core.auth import decode_token
        from jose import JWTError
        
        invalid_token = "this.is.not.a.valid.jwt.token"
        
        with pytest.raises(JWTError):
            decode_token(invalid_token)


# ============================================================
# 3. 密码安全测试
# ============================================================

class TestPasswordSecurity:
    """密码安全相关测试"""
    
    def test_hash_password_strength(self):
        """测试密码哈希强度 (bcrypt cost=12)"""
        from passlib.context import CryptContext
        
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        
        # 哈希一个复杂密码
        hashed = pwd_context.hash("VerySecurePassword123!")
        
        # 验证哈希格式 ($2b$ 表示bcrypt)
        assert hashed.startswith("$2b$12$")
        assert len(hashed) == 60  # bcrypt hash长度固定
    
    def test_verify_correct_password(self):
        """测试正确密码验证"""
        from passlib.context import CryptContext
        
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        password = "MySecurePassword2024!"
        hashed = pwd_context.hash(password)
        
        assert pwd_context.verify(password, hashed) is True
    
    def test_verify_wrong_password(self):
        """测试错误密码验证"""
        from passlib.context import CryptContext
        
        pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
        hashed = pwd_context.hash("CorrectPassword")
        
        assert pwd_context.verify("WrongPassword", hashed) is False
    
    def test_password_complexity_validation(self):
        """测试密码复杂度规则"""
        from app.core.security_middleware import InputSanitizer
        
        # 弱密码应该被拒绝
        weak_passwords = [
            "123456",           # 纯数字
            "password",         # 常见词
            "abcdef",          # 纯字母
            "abc123",           # 太短
            "Admin123",         # 缺少特殊字符
        ]
        
        for pwd in weak_passwords:
            with pytest.raises(ValueError):
                validate_password_strength(pwd)
        
        # 强密码应该通过
        strong_passwords = [
            "Secure@Pass2024!",
            "MyP@ssw0rd#Strong",
            "C0mplex_Pass!2024",
        ]
        
        for pwd in strong_passwords:
            # 应该不抛出异常
            try:
                validate_password_strength(pwd)
            except ValueError:
                pytest.fail(f"强密码 '{pwd}' 不应被拒绝")


# ============================================================
# 4. RBAC 权限测试
# ============================================================

class TestRBACPermissions:
    """基于角色的访问控制测试"""
    
    def test_admin_has_all_permissions(self):
        """测试管理员拥有所有权限"""
        from app.core.rbac import RBACEngine, Permission
        
        rbac = RBACEngine()
        admin_permissions = rbac.get_role_permissions("admin")
        
        # 管理员应该有所有权限
        assert Permission.MANAGE_USERS in admin_permissions
        assert Permission.DELETE_FORMULA in admin_permissions
        assert Permission.MANAGE_SYSTEM in admin_permissions
    
    def test_researcher_limited_permissions(self):
        """测试研究员权限受限"""
        from app.core.rbac import RBACEngine, Permission
        
        rbac = RBACEngine()
        researcher_permissions = rbac.get_role_permissions("researcher")
        
        # 研究员不应该有管理权限
        assert Permission.MANAGE_USERS not in researcher_permissions
        assert Permission.DELETE_FORMULA not in researcher_permissions
        
        # 但应该有基本权限
        assert Permission.VIEW_DASHBOARD in researcher_permissions
        assert Permission.CREATE_FORMULA in researcher_permissions
    
    def test_permission_check_success(self):
        """测试权限检查成功"""
        from app.core.rbac import RBACEngine
        
        rbac = RBACEngine()
        admin_user = MagicMock()
        admin_user.role = "admin"
        
        assert rbac.check_permission(admin_user, Permission.MANAGE_USERS) is True
    
    def test_permission_check_failure(self):
        """测试权限检查失败"""
        from app.core.rbac import RBACEngine
        
        rbac = RBACEngine()
        researcher_user = MagicMock()
        researcher_user.role = "researcher"
        
        assert rbac.check_permission(researcher_user, Permission.MANAGE_USERS) is False


# ============================================================
# 5. 安全中间件测试
# ============================================================

class TestSecurityMiddleware:
    """安全中间件测试"""
    
    def test_rate_limiting_basic(self):
        """测试基础速率限制"""
        from app.core.security_middleware import SlidingWindowRateLimiter, RateLimitConfig, ClientInfo
        
        limiter = SlidingWindowRateLimiter(requests_per_minute=60)
        client_ip = "192.168.1.100"
        
        # 前60个请求应该都允许
        for i in range(60):
            assert limiter.is_allowed(client_ip) is True
        
        # 第61个请求应该被拒绝
        assert limiter.is_allowed(client_ip) is False
    
    def test_rate_limiting_different_clients(self):
        """测试不同客户端独立计数"""
        from app.core.security_middleware import SlidingWindowRateLimiter, RateLimitConfig, ClientInfo
        
        limiter = SlidingWindowRateLimiter(requests_per_minute=5)
        
        # 客户端A发送5次
        for _ in range(5):
            assert limiter.is_allowed("client_A") is True
        
        # 客户端A的第6次应该被拒绝
        assert limiter.is_allowed("client_A") is False
        
        # 客户端B应该仍然可以发送
        assert limiter.is_allowed("client_B") is True
    
    def test_sql_injection_prevention(self):
        """测试SQL注入防护"""
        from app.core.security.sql_security import SafeQueryBuilder, SecurityError
        
        builder = SafeQueryBuilder("users")
        
        # 正常参数应该工作
        query, params = builder.where("id = :id", {"id": 1}).build()
        assert ":id" in query
        assert params["id"] == 1
        
        # 危险的SQL模式应该被拒绝
        with pytest.raises(SecurityError):
            builder.where("id = 1; DROP TABLE users--", {})
    
    def test_table_name_whitelist(self):
        """测试表名白名单验证"""
        from app.core.security.sql_security import SafeQueryBuilder
        
        # 允许的表
        builder = SafeQueryBuilder("users")  # 不抛异常
        
        # 不允许的表
        with pytest.raises(ValueError):
            SafeQueryBuilder("sensitive_table; DROP DATABASE")


# ============================================================
# 6. 异常处理体系测试
# ============================================================

class TestExceptionHandling:
    """异常处理体系测试"""
    
    @pytest.mark.asyncio
    async def test_database_error_handling(self):
        """测试数据库错误正确处理"""
        from sqlalchemy.exc import OperationalError
        from app.core.exceptions import DatabaseError, handle_database_error
        
        original_error = OperationalError("connection failed", params={}, orig=None)
        wrapped_error = DatabaseError(original_error, "数据库连接失败")
        
        # 应该包含原始错误信息
        assert "数据库连接失败" in str(wrapped_error)
        assert wrapped_error.status_code == 503
    
    async def test_not_found_error_handling(self):
        """测试404错误处理"""
        from app.core.exceptions import NotFoundError
        
        error = NotFoundError(resource="配方", resource_id=999)
        
        assert error.status_code == 404
        assert "配方" in str(error)
        assert "999" in str(error)
    
    def test_authentication_error_handling(self):
        """测试认证错误处理"""
        from app.core.exceptions import AuthenticationError
        
        error = AuthenticationError(message="Token已过期")
        
        assert error.status_code == 401
        assert "Token" in str(error)
    
    def test_authorization_error_handling(self):
        """测试授权错误处理"""
        from app.core.exceptions import AuthorizationError
        
        error = AuthorizationError(required_role="admin", current_role="researcher")
        
        assert error.status_code == 403
        assert "admin" in str(error)


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
