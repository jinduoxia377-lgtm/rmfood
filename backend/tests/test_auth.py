"""Tests for authentication endpoints.

Covers: login, register, token refresh, token blacklist, account lockout.
"""
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import text


@pytest.fixture
def client():
    from app.main import create_app
    app = create_app()
    return TestClient(app)


class TestLogin:
    """Login endpoint tests."""

    def test_login_with_valid_credentials(self, client, db_session):
        """Valid user can log in and receive tokens."""
        # Create test user
        from app.models.user_model import User
        from app.services.auth import AuthService
        import hashlib

        hashed_pw = hashlib.sha256("testpass123".encode()).hexdigest()
        user = User(
            username="testuser",
            email="test@example.com",
            password_hash=hashed_pw,
            is_active=True,
        )
        db_session.add(user)
        db_session.commit()

        response = client.post(
            "/api/v1/auth/login",
            data={"username": "testuser", "password": "testpass123"},
        )

        assert response.status_code == 200
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"

    def test_login_with_invalid_password(self, client, db_session):
        """Invalid password returns 401."""
        from app.models.user_model import User
        import hashlib

        hashed_pw = hashlib.sha256("correctpass".encode()).hexdigest()
        user = User(
            username="wrongpw_user",
            email="wrong@example.com",
            password_hash=hashed_pw,
            is_active=True,
        )
        db_session.add(user)
        db_session.commit()

        response = client.post(
            "/api/v1/auth/login",
            data={"username": "wrongpw_user", "password": "wrongpass"},
        )

        assert response.status_code == 401

    def test_login_nonexistent_user(self, client):
        """Non-existent user returns 401."""
        response = client.post(
            "/api/v1/auth/login",
            data={"username": "nobody", "password": "nobody"},
        )
        assert response.status_code == 401


class TestRegister:
    """Registration endpoint tests."""

    def test_register_new_user(self, client):
        """New user can register."""
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": "newuser",
                "email": "new@example.com",
                "password": "securepass123",
            },
        )
        assert response.status_code in (200, 201)

    def test_register_duplicate_username(self, client):
        """Duplicate username returns error."""
        # Register first
        client.post(
            "/api/v1/auth/register",
            json={
                "username": "dupuser",
                "email": "dup1@example.com",
                "password": "securepass123",
            },
        )
        # Try again
        response = client.post(
            "/api/v1/auth/register",
            json={
                "username": "dupuser",
                "email": "dup2@example.com",
                "password": "securepass123",
            },
        )
        assert response.status_code == 400


class TestTokenRefresh:
    """Token refresh tests."""

    def test_refresh_token_works(self, client, db_session):
        """Refresh token returns new access token."""
        # Login first
        from app.models.user_model import User
        import hashlib

        hashed_pw = hashlib.sha256("refreshtest".encode()).hexdigest()
        user = User(
            username="refreshtest",
            email="refresh@example.com",
            password_hash=hashed_pw,
            is_active=True,
        )
        db_session.add(user)
        db_session.commit()

        login_resp = client.post(
            "/api/v1/auth/login",
            data={"username": "refreshtest", "password": "refreshtest"},
        )
        assert login_resp.status_code == 200
        tokens = login_resp.json()

        # Refresh
        refresh_resp = client.post(
            "/api/v1/auth/refresh",
            json={"refresh_token": tokens.get("refresh_token", "")},
        )
        assert refresh_resp.status_code == 200
        assert "access_token" in refresh_resp.json()
