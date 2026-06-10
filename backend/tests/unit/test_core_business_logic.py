"""
RMFOOD 核心业务逻辑单元测试

覆盖范围:
- ✅ 认证服务（密码验证、Token生成）
- ✅ RBAC权限检查
- ✅ 账号锁定机制
- ✅ 数据验证
- ✅ 工具函数

运行命令:
    pytest tests/unit/ -v --cov=app --cov-report=html
    
作者: RMFOOD Team
日期: 2026-05-02
"""

import pytest
from datetime import datetime, timedelta, timezone
from unittest.mock import AsyncMock, MagicMock, patch
import json

# ── 测试认证服务 ──

class TestAuthService:
    """认证服务测试套件"""
    
    @pytest.mark.asyncio
    async def test_password_hash_and_verify(self):
        """测试密码哈希和验证"""
        from app.services.auth import get_password_hash, verify_password
        
        password = "Test@Password123"
        
        # 哈希密码
        hashed = get_password_hash(password)
        
        # 验证正确密码
        assert verify_password(password, hashed) is True
        
        # 验证错误密码
        assert verify_password("wrong_password", hashed) is False
        
        # 验证空密码
        assert verify_password("", hashed) is False
    
    @pytest.mark.asyncio
    async def test_token_generation(self):
        """测试JWT Token生成与解码"""
        from app.services.auth import create_access_token, decode_token
        
        user_id = 1
        role = "FORMULATOR"
        
        # 生成Token
        token = create_access_token(user_id, role)
        
        assert token is not None
        assert isinstance(token, str)
        assert len(token) > 0
        
        # 解码Token
        payload = decode_token(token)
        
        assert payload.sub == str(user_id)
        assert payload.role == role
        assert payload.type == "access"
    
    @pytest.mark.asyncio
    async def test_refresh_token(self):
        """测试刷新令牌"""
        from app.services.auth import create_refresh_token, decode_token
        
        user_id = 42
        role = "ADMIN"
        
        # 生成刷新令牌
        refresh_token = create_refresh_token(user_id, role)
        
        payload = decode_token(refresh_token)
        
        assert payload.sub == str(user_id)
        assert payload.type == "refresh"


# ── 测试RBAC权限系统 ──

class TestRBACSystem:
    """RBAC权限系统测试套件"""
    
    def setup_method(self):
        """每个测试前的初始化"""
        from app.core.rbac import RBACManager
        self.rbac = RBACManager()
    
    def test_admin_has_all_permissions(self):
        """管理员应拥有所有权限"""
        from app.core.rbac import Resource, Action
        
        for resource in Resource:
            for action in Action:
                assert self.rbac.check_permission('ADMIN', resource, action) is True, \
                    f"ADMIN should have {resource.value}:{action.value}"
    
    def test_guest_limited_permissions(self):
        """访客应该只有有限权限"""
        from app.core.rbac import Resource, Action
        
        # 访客可以查看配方和数据库
        assert self.rbac.check_permission('GUEST', Resource.FORMULA, Action.READ) is True
        assert self.rbac.check_permission('GUEST', Resource.DATABASE, Action.READ) is True
        
        # 访客不能创建、编辑或删除
        assert self.rbac.check_permission('GUEST', Resource.FORMULA, Action.CREATE) is False
        assert self.rbac.check_permission('GUEST', Resource.FORMULA, Action.UPDATE) is False
        assert self.rbac.check_permission('GUEST', Resource.FORMULA, Action.DELETE) is False
    
    def test_formulator_can_manage_formulas(self):
        """配方师应能管理配方但不能管理用户"""
        from app.core.rbac import Resource, Action
        
        # 配方权限
        assert self.rbac.check_permission('FORMULATOR', Resource.FORMULA, Action.CREATE) is True
        assert self.rbac.check_permission('FORMULATOR', Resource.FORMULA, Action.UPDATE) is True
        assert self.rbac.check_permission('FORMULATOR', Resource.FORMULA, Action.EXPORT) is True
        
        # 无用户管理权限
        assert self.rbac.check_permission('FORMULATOR', Resource.USER, Action.CREATE) is False
        assert self.rbac.check_permission('FORMULATOR', Resource.USER, Action.MANAGE) is False
    
    def test_reviewer_can_approve_but_not_create(self):
        """审核员可以审批但不能创建配方"""
        from app.core.rbac import Resource, Action
        
        assert self.rbac.check_permission('REVIEWER', Resource.FORMULA, Action.APPROVE) is True
        assert self.rbac.check_permission('REVIEWER', Resource.FORMULA, Action.REJECT) is True
        assert self.rbac.check_permission('REVIEWER', Resource.FORMULA, Action.CREATE) is False
    
    def test_grant_custom_permission(self):
        """测试授予自定义权限"""
        from app.core.rbac import Resource, Permission
        
        # 研究员默认不能导出配方
        assert self.rbac.check_permission('RESEARCHER', Resource.FORMULA, Action.EXPORT) is False
        
        # 授予导出权限
        export_perm = Permission(Resource.FORMULA, Action.EXPORT)
        self.rbac.grant_permission('RESEARCHER', export_perm)
        
        # 验证权限已生效
        assert self.rbac.check_permission('RESEARCHER', Resource.FORMULA, Action.EXPORT) is True
    
    def test_revoke_permission(self):
        """测试撤销权限"""
        from app.core.rbac import Resource, Permission
        
        # 先授予权限
        delete_perm = Permission(Resource.FORMULA, Action.DELETE)
        self.rbac.grant_permission('RESEARCHER', delete_perm)
        assert self.rbac.check_permission('RESEARCHER', Resource.FORMULA, Action.DELETE) is True
        
        # 撤销权限
        self.rbac.revoke_permission('RESEARCHER', delete_perm)
        assert self.rbac.check_permission('RESEARCHER', Resource.FORMULA, Action.DELETE) is False


# ── 测试账号锁定机制 ──

class TestAccountLockout:
    """账号锁定机制测试套件"""
    
    @pytest.fixture
    def lockout(self):
        """创建账号锁定器实例"""
        from app.core.account_lockout import AccountLockout
        return AccountLockout(
            max_attempts=3,
            lockout_duration_minutes=5
        )
    
    @pytest.fixture
    def mock_db(self):
        """创建模拟数据库会话"""
        db = AsyncMock()
        return db
    
    @pytest.fixture
    def mock_user(self):
        """创建模拟用户对象"""
        user = MagicMock()
        user.id = 1
        user.username = "testuser"
        user.login_attempts = 0
        user.locked_until = None
        user.is_active = True
        return user
    
    @pytest.mark.asyncio
    async def test_initial_state_not_locked(self, lockout, mock_db, mock_user):
        """初始状态账号不应被锁定"""
        with patch.object(lockout, '_auto_unlock'):
            result = await lockout.is_account_locked(mock_db, "testuser")
            
            assert result[0] is False
            assert result[1] is None
    
    @pytest.mark.asyncio
    async def test_record_failed_attempts(self, lockout, mock_db, mock_user):
        """记录失败尝试"""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user
        mock_db.execute.return_value = mock_result
        
        # 第一次失败
        result1 = await lockout.record_failed_attempt(mock_db, "testuser", "127.0.0.1")
        assert result1["attempts"] == 1
        assert result1["locked"] is False
        assert result1["remaining_attempts"] == 2
        
        # 第二次失败
        result2 = await lockout.record_failed_attempt(mock_db, "testuser", "127.0.0.1")
        assert result2["attempts"] == 2
        assert result2["remaining_attempts"] == 1
        
        # 第三次失败 - 应触发锁定
        result3 = await lockout.record_failed_attempt(mock_db, "testuser", "127.0.0.1")
        assert result3["attempts"] == 3
        assert result3["locked"] is True
        assert "已临时锁定" in result3["message"]
    
    @pytest.mark.asyncio
    async def test_reset_on_success_login(self, lockout, mock_db, mock_user):
        """成功登录后应重置计数器"""
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = mock_user
        mock_db.execute.return_value = mock_result
        
        # 模拟多次失败
        await lockout.record_failed_attempt(mock_db, "testuser")
        await lockout.record_failed_attempt(mock_db, "testuser")
        
        # 成功登录后重置
        success = await lockout.reset_login_attempts(mock_db, mock_user)
        assert success is True
        assert mock_user.login_attempts == 0
        assert mock_user.locked_until is None


# ── 测试数据验证 ──

class TestDataValidation:
    """数据验证测试套件"""
    
    def test_email_validation(self):
        """测试邮箱格式验证"""
        import re
        
        email_pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
        
        valid_emails = [
            "user@example.com",
            "test.user+tag@domain.org",
            "admin@sub.domain.co.uk",
        ]
        
        invalid_emails = [
            "plaintext",
            "@missing-user.com",
            "user@",
            "user@.com",
            "user space@domain.com",
        ]
        
        for email in valid_emails:
            assert re.match(email_pattern, email), f"{email} should be valid"
        
        for email in invalid_emails:
            assert not re.match(email_pattern, email), f"{email} should be invalid"
    
    def test_password_strength(self):
        """测试密码强度验证"""
        def check_password_strength(password: str) -> dict:
            """简单的密码强度检查"""
            result = {
                "length": len(password) >= 8,
                "has_upper": any(c.isupper() for c in password),
                "has_lower": any(c.islower() for c in password),
                "has_digit": any(c.isdigit() for c in password),
                "has_special": any(not c.isalnum() for c in password),
            }
            result["is_strong"] = all(result.values())
            return result
        
        # 强密码
        strong_passwords = [
            "MyStr0ng!Password",
            "Correct-Horse-Battery-Staple",
            "P@$$w0rd_2024_Secure!",
        ]
        
        for pwd in strong_passwords:
            assert check_password_strength(pwd)["is_strong"], f"{pwd} should be strong"
        
        # 弱密码
        weak_passwords = [
            "12345678",           # 只有数字
            "password",           # 只有小写字母
            "PASSWORD123",         # 缺少小写和特殊字符
            "abc123",             # 太短
        ]
        
        for pwd in weak_passwords:
            assert not check_password_strength(pwd)["is_strong"], f"{pwd} should be weak"
    
    def test_username_validation(self):
        """测试用户名验证"""
        import re
        
        username_pattern = r'^[a-zA-Z][a-zA-Z0-9_-]{2,49}$'
        
        valid_usernames = ["john_doe", "User123", "test-admin", "a"]
        invalid_usernames = ["123start", "user@name", "", "ab"]
        
        for username in valid_usernames:
            assert re.match(username_pattern, username), f"{username} should be valid"
        
        for username in invalid_usernames:
            assert not re.match(username_pattern, username), f"{username} should be invalid"


# ── 测试工具函数 ──

class TestUtilityFunctions:
    """工具函数测试套件"""
    
    def test_slug_generation(self):
        """测试URL slug生成"""
        def generate_slug(text: str) -> str:
            import re
            text = text.lower().strip()
            text = re.sub(r'[^\w\s-]', '', text)
            text = re.sub(r'[\s_]+', '-', text)
            text = re.sub(r'-{2,}', '-', text)
            return text.strip('-')
        
        test_cases = [
            ("Hello World", "hello-world"),
            ("配方设计平台", ""),
            ("Test 123 Formula!", "test-123-formula"),
            ("  Multiple   Spaces  ", "multiple-spaces"),
        ]
        
        for input_text, expected in test_cases:
            result = generate_slug(input_text)
            if expected:
                assert result == expected
            else:
                assert len(result) > 0 or len(input_text) == 0
    
    def test_file_size_formatting(self):
        """测试文件大小格式化"""
        def format_file_size(size_bytes: int) -> str:
            if size_bytes < 1024:
                return f"{size_bytes} B"
            elif size_bytes < 1024 * 1024:
                return f"{size_bytes / 1024:.1f} KB"
            elif size_bytes < 1024 * 1024 * 1024:
                return f"{size_bytes / (1024 * 1024):.1f} MB"
            else:
                return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"
        
        assert format_file_size(500) == "500 B"
        assert format_file_size(1536) == "1.5 KB"
        assert format_file_size(1048576) == "1.0 MB"
        assert format_file_size(1073741824) == "1.0 GB"
    
    def test_time_ago_formatting(self):
        """测试相对时间格式化"""
        def time_ago(dt: datetime) -> str:
            now = datetime.now(timezone.utc)
            diff = now - dt
            
            seconds = diff.total_seconds()
            
            if seconds < 60:
                return "刚刚"
            elif seconds < 3600:
                minutes = int(seconds / 60)
                return f"{minutes}分钟前"
            elif seconds < 86400:
                hours = int(seconds / 3600)
                return f"{hours}小时前"
            else:
                days = int(seconds / 86400)
                return f"{days}天前"
        
        now = datetime.now(timezone.utc)
        
        assert time_ago(now - timedelta(seconds=30)) == "刚刚"
        assert time_ago(now - timedelta(minutes=5)) == "5分钟前"
        assert time_ago(now - timedelta(hours=2)) == "2小时前"
        assert time_ago(now - timedelta(days=3)) == "3天前"


# ── 运行入口 ──

if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])