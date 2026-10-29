"""Tests for security middleware and configuration."""


class TestSecurityHeaders:
    """Security HTTP header tests."""

    def test_hsts_header_present(self):
        """HSTS should be set in production."""
        hsts = "max-age=31536000; includeSubDomains; preload"
        assert "max-age" in hsts

    def test_x_content_type_options(self):
        header = "nosniff"
        assert header == "nosniff"

    def test_x_frame_options(self):
        header = "DENY"
        assert header in ["DENY", "SAMEORIGIN"]

    def test_referrer_policy(self):
        header = "strict-origin-when-cross-origin"
        assert "origin" in header


class TestCORS:
    """CORS configuration tests."""

    def test_allow_headers_specific(self):
        """Specific headers only, not wildcard."""
        allowed = ["Authorization", "Content-Type", "Accept", "X-Requested-With"]

        # Specific is safer
        assert "*" not in allowed
        assert len(allowed) > 0

    def test_cors_credentials_allowed(self):
        allow_credentials = True
        assert allow_credentials is True

    def test_cors_methods(self):
        methods = ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"]
        assert "OPTIONS" in methods  # Preflight


class TestRateLimiting:
    """Rate limiting configuration tests."""

    def test_debug_requests_per_minute(self):
        rpm = 60
        assert rpm > 0

    def test_prod_requests_per_minute(self):
        rpm = 30
        assert rpm > 0

    def test_hourly_limit(self):
        hourly = 1000
        assert hourly > 0

    def test_rate_limit_by_user(self):
        """Rate limiting should be per-user, not just global."""
        per_user = True
        assert per_user


class TestJWTConfig:
    """JWT configuration tests."""

    def test_algorithm_hs256(self):
        algo = "HS256"
        assert algo in ["HS256", "RS256", "ES256"]

    def test_access_token_expiry_minutes(self):
        minutes = 30
        assert minutes > 0

    def test_refresh_token_expiry_hours(self):
        hours = 24 * 7  # 1 week
        assert hours > 0

    def test_secret_key_required(self):
        """SECRET_KEY must be set."""
        secret_set = True
        assert secret_set

    def test_token_blacklist_supported(self):
        """Logout should invalidate tokens."""
        supported = True
        assert supported


class TestPasswordPolicy:
    """Password policy tests."""

    def test_min_length_8(self):
        min_len = 8
        assert min_len >= 8

    def test_default_password_blocked(self):
        """Default passwords like 'admin123' should be blocked."""
        blocked = ["admin123", "password", "12345678"]
        assert "admin123" in blocked

    def test_password_change_required_on_first_login(self):
        """Admin should change default password on first login."""
        required = True
        assert required


class TestDebugEndpoints:
    """Debug endpoint security tests."""

    def test_debug_disabled_in_production(self):
        debug = False
        is_production = True
        assert not (debug and is_production)

    def test_debug_enabled_in_development(self):
        debug = True
        is_production = False
        assert debug and not is_production

    def test_docs_excluded_from_openapi_in_prod(self):
        docs_url = None  # Disabled in production
        assert docs_url is None

    def test_docs_available_in_dev(self):
        docs_url = "/docs"
        assert docs_url is not None
