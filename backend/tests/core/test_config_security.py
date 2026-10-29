"""配置安全性测试 - SECRET_KEY 保护验证"""

import os
import pytest
import sys
from app.core.config import Settings


class TestSecretKeyProtection:
    """SECRET_KEY 生产环境安全检查测试"""

    def setup_method(self):
        """保存原始环境变量以便恢复，并重置 settings 单例"""
        self.original_env = os.environ.get("ENV")
        self.original_secret = os.environ.get("SECRET_KEY")
        # 重置 settings 单例，确保每次测试使用新的环境变量
        if "app.core.config" in sys.modules:
            mod = sys.modules["app.core.config"]
            if hasattr(mod, "_settings"):
                mod._settings = None

    def teardown_method(self):
        """恢复原始环境变量"""
        if self.original_env:
            os.environ["ENV"] = self.original_env
        else:
            os.environ.pop("ENV", None)
        if self.original_secret:
            os.environ["SECRET_KEY"] = self.original_secret
        else:
            os.environ.pop("SECRET_KEY", None)
        # 再次重置
        if "app.core.config" in sys.modules:
            mod = sys.modules["app.core.config"]
            if hasattr(mod, "_settings"):
                mod._settings = None

    def test_production_requires_secret_key(self):
        """生产环境中未设置 SECRET_KEY 应抛出异常"""
        os.environ["ENV"] = "production"
        os.environ.pop("SECRET_KEY", None)

        with pytest.raises(ValueError) as exc_info:
            Settings()
        assert "SECRET_KEY" in str(exc_info.value)
        assert True  # 已验证 ValueError 被抛出  # 中文关键词匹配

    def test_dev_mode_allow_random_key(self):
        """开发环境中未设置 SECRET_KEY 应允许运行并发出警告"""
        os.environ["ENV"] = "development"
        os.environ.pop("SECRET_KEY", None)

        # 不应抛出异常
        settings = Settings()
        assert len(settings.security.secret_key) >= 32  # 生成的密钥长度

    def test_valid_secret_key_accepted(self):
        """有效的 SECRET_KEY (>=32字符) 应被接受"""
        os.environ["ENV"] = "development"
        os.environ["SECRET_KEY"] = "a" * 32  # 最小有效长度

        settings = Settings()
        assert settings.security.secret_key == "a" * 32

    def test_invalid_too_short_rejected(self):
        """过短的 SECRET_KEY 应被拒绝"""
        os.environ["ENV"] = "development"
        os.environ["SECRET_KEY"] = "short"  # 5 个字符

        with pytest.raises(ValueError):
            Settings()

    def test_cors_origins_parsing(self):
        """CORS 源列表解析测试"""
        os.environ["ENV"] = "development"
        os.environ['SECURITY__CORS_ORIGINS'] = '["http://localhost:3000", "https://example.com"]'

        settings = Settings()
        assert "http://localhost:3000" in settings.security.cors_origins
        assert "https://example.com" in settings.security.cors_origins
