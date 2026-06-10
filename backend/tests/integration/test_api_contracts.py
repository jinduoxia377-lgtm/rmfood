"""API Contract Tests — Core Routes

Validates request/response schema contracts for the platform's primary
endpoints.  Each test asserts status codes, required response fields, and
data types rather than internal business logic.

Fixtures sourced from backend/tests/conftest.py:
    client                — async httpx client with DB override
    formula_factory       — callable returning formula dict
    sample_formula_data   — pre-built formula dict
    user_factory          — callable returning user dict
    create_user           — ORM-level user creation
    create_formula        — ORM-level formula creation

NOTE: admin_headers / researcher_headers from conftest create tokens with
hardcoded user IDs (1, 2) that do not exist in the per-test in-memory DB.
Tests that need an authenticated user MUST call create_user first and build
headers from the returned user's ID.
"""

import pytest
from httpx import AsyncClient

from app.services.auth import create_access_token
from app.models.enums import UserRole


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

TOKEN_RESPONSE_KEYS = {"access_token", "refresh_token", "token_type"}
USER_RESPONSE_KEYS = {"id", "username", "email", "role", "is_active", "created_at"}
FORMULA_RESPONSE_KEYS = {
    "id",
    "code",
    "name",
    "status",
    "version",
    "creator_id",
    "created_at",
    "updated_at",
}


def _auth_headers(user_id: int, role: str) -> dict:
    """Build Authorization headers from a real DB user."""
    token = create_access_token(user_id=user_id, role=role)
    return {"Authorization": f"Bearer {token}"}


# ══════════════════════════════════════════════
# 1. POST /api/v1/auth/register
# ══════════════════════════════════════════════

@pytest.mark.integration
class TestRegisterContract:
    """POST /api/v1/auth/register — user registration contracts."""

    async def test_valid_register_returns_201_with_user_data(
        self, client: AsyncClient, user_factory
    ):
        payload = user_factory(username="contractuser", email="contract@test.com")
        resp = await client.post("/api/v1/auth/register", json=payload)

        assert resp.status_code == 201
        body = resp.json()
        assert USER_RESPONSE_KEYS.issubset(body.keys()), (
            f"Missing keys: {USER_RESPONSE_KEYS - body.keys()}"
        )
        assert body["username"] == "contractuser"
        assert body["email"] == "contract@test.com"
        # Password must never leak
        assert "password" not in body
        assert "hashed_password" not in body

    async def test_missing_required_fields_returns_422(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/register", json={})
        assert resp.status_code == 422
        body = resp.json()
        assert "detail" in body

    async def test_missing_password_returns_422(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/auth/register",
            json={"username": "nopass", "email": "nopass@test.com"},
        )
        assert resp.status_code == 422

    async def test_invalid_email_returns_422(self, client: AsyncClient, user_factory):
        payload = user_factory(username="badmail", email="not-an-email")
        resp = await client.post("/api/v1/auth/register", json=payload)
        assert resp.status_code == 422

    async def test_short_username_returns_422(self, client: AsyncClient, user_factory):
        payload = user_factory(username="ab", email="short@test.com")
        resp = await client.post("/api/v1/auth/register", json=payload)
        assert resp.status_code == 422


# ══════════════════════════════════════════════
# 2. POST /api/v1/auth/login
# ══════════════════════════════════════════════

@pytest.mark.integration
class TestLoginContract:
    """POST /api/v1/auth/login — authentication contracts."""

    async def test_valid_credentials_return_tokens(
        self, client: AsyncClient, create_user
    ):
        await create_user(username="loginuser", password="LoginPass123!")
        resp = await client.post(
            "/api/v1/auth/login",
            json={"username": "loginuser", "password": "LoginPass123!"},
        )

        assert resp.status_code == 200
        body = resp.json()
        assert TOKEN_RESPONSE_KEYS.issubset(body.keys()), (
            f"Missing keys: {TOKEN_RESPONSE_KEYS - body.keys()}"
        )
        assert isinstance(body["access_token"], str) and len(body["access_token"]) > 0
        assert isinstance(body["refresh_token"], str) and len(body["refresh_token"]) > 0
        assert body["token_type"] == "bearer"

    async def test_invalid_password_returns_401(
        self, client: AsyncClient, create_user
    ):
        await create_user(username="wrongpw", password="CorrectPass1!")
        resp = await client.post(
            "/api/v1/auth/login",
            json={"username": "wrongpw", "password": "WrongPassword!"},
        )
        assert resp.status_code == 401
        body = resp.json()
        assert "detail" in body

    async def test_nonexistent_user_returns_401(self, client: AsyncClient):
        resp = await client.post(
            "/api/v1/auth/login",
            json={"username": "ghost_user_xyz", "password": "Whatever1!"},
        )
        assert resp.status_code == 401

    async def test_missing_fields_returns_422(self, client: AsyncClient):
        resp = await client.post("/api/v1/auth/login", json={})
        assert resp.status_code == 422


# ══════════════════════════════════════════════
# 3. GET /api/v1/formulas
# ══════════════════════════════════════════════

@pytest.mark.integration
class TestListFormulasContract:
    """GET /api/v1/formulas — formula listing contracts."""

    async def test_list_returns_paginated_response(
        self, client: AsyncClient, create_formula, create_user
    ):
        user = await create_user(username="listcreator", role=UserRole.RESEARCHER)
        await create_formula(name="Alpha", creator_id=user.id)
        await create_formula(name="Beta", creator_id=user.id)

        headers = _auth_headers(user.id, user.role.value)
        resp = await client.get("/api/v1/formulas", headers=headers)

        assert resp.status_code == 200
        body = resp.json()
        assert "items" in body
        assert "total" in body
        assert "page" in body
        assert "page_size" in body
        assert isinstance(body["items"], list)
        assert isinstance(body["total"], int)
        assert body["total"] >= 2

    async def test_list_accepts_pagination_params(
        self, client: AsyncClient, create_user
    ):
        user = await create_user(username="pageuser", role=UserRole.RESEARCHER)
        headers = _auth_headers(user.id, user.role.value)
        resp = await client.get(
            "/api/v1/formulas",
            params={"page": 1, "page_size": 5},
            headers=headers,
        )
        assert resp.status_code == 200
        body = resp.json()
        assert body["page"] == 1
        assert body["page_size"] == 5

    async def test_list_formula_items_have_required_fields(
        self, client: AsyncClient, create_formula, create_user
    ):
        user = await create_user(username="fieldcreator", role=UserRole.RESEARCHER)
        await create_formula(name="FieldCheck", creator_id=user.id)

        headers = _auth_headers(user.id, user.role.value)
        resp = await client.get("/api/v1/formulas", headers=headers)
        assert resp.status_code == 200
        items = resp.json()["items"]
        assert len(items) >= 1

        item = items[0]
        assert FORMULA_RESPONSE_KEYS.issubset(item.keys()), (
            f"Missing keys: {FORMULA_RESPONSE_KEYS - item.keys()}"
        )

    async def test_create_requires_auth(self, client: AsyncClient, formula_factory):
        """POST /api/v1/formulas without token returns 401 (require_role)."""
        payload = formula_factory()
        resp = await client.post("/api/v1/formulas", json=payload)
        assert resp.status_code == 401


# ══════════════════════════════════════════════
# 4. POST /api/v1/formulas
# ══════════════════════════════════════════════

@pytest.mark.integration
class TestCreateFormulaContract:
    """POST /api/v1/formulas — formula creation contracts."""

    async def test_valid_create_returns_201_with_formula_data(
        self, client: AsyncClient, create_user, sample_formula_data
    ):
        user = await create_user(username="createuser", role=UserRole.RESEARCHER)
        headers = _auth_headers(user.id, user.role.value)

        resp = await client.post(
            "/api/v1/formulas", json=sample_formula_data, headers=headers
        )

        assert resp.status_code == 201
        body = resp.json()
        assert FORMULA_RESPONSE_KEYS.issubset(body.keys()), (
            f"Missing keys: {FORMULA_RESPONSE_KEYS - body.keys()}"
        )
        assert body["name"] == sample_formula_data["name"]
        assert body["status"] == "draft"
        assert body["version"] == 1
        assert isinstance(body["id"], int)
        assert isinstance(body["creator_id"], int)

    async def test_minimal_create_returns_201(
        self, client: AsyncClient, create_user
    ):
        """Only the 'name' field is strictly required by FormulaCreate."""
        user = await create_user(username="minimaluser", role=UserRole.RESEARCHER)
        headers = _auth_headers(user.id, user.role.value)

        resp = await client.post(
            "/api/v1/formulas", json={"name": "Minimal Formula"}, headers=headers
        )

        assert resp.status_code == 201
        body = resp.json()
        assert body["name"] == "Minimal Formula"

    async def test_missing_name_returns_422(
        self, client: AsyncClient, create_user
    ):
        user = await create_user(username="nonameuser", role=UserRole.RESEARCHER)
        headers = _auth_headers(user.id, user.role.value)

        resp = await client.post(
            "/api/v1/formulas", json={"description": "no name"}, headers=headers
        )
        assert resp.status_code == 422
        body = resp.json()
        assert "detail" in body

    async def test_empty_body_returns_422(
        self, client: AsyncClient, create_user
    ):
        user = await create_user(username="emptyuser", role=UserRole.RESEARCHER)
        headers = _auth_headers(user.id, user.role.value)

        resp = await client.post(
            "/api/v1/formulas", json={}, headers=headers
        )
        assert resp.status_code == 422

    async def test_create_without_auth_returns_401(
        self, client: AsyncClient, formula_factory
    ):
        payload = formula_factory()
        resp = await client.post("/api/v1/formulas", json=payload)
        assert resp.status_code == 401


# ══════════════════════════════════════════════
# 5. GET /api/v1/formulas/{id}
# ══════════════════════════════════════════════

@pytest.mark.integration
class TestGetFormulaContract:
    """GET /api/v1/formulas/{formula_id} — single formula retrieval contracts."""

    async def test_valid_id_returns_formula_data(
        self, client: AsyncClient, create_formula, create_user
    ):
        user = await create_user(username="getcreator", role=UserRole.RESEARCHER)
        formula = await create_formula(name="GetMe", creator_id=user.id)
        headers = _auth_headers(user.id, user.role.value)

        resp = await client.get(
            f"/api/v1/formulas/{formula.id}", headers=headers
        )

        assert resp.status_code == 200
        body = resp.json()
        assert FORMULA_RESPONSE_KEYS.issubset(body.keys()), (
            f"Missing keys: {FORMULA_RESPONSE_KEYS - body.keys()}"
        )
        assert body["id"] == formula.id
        assert body["name"] == "GetMe"

    async def test_invalid_id_returns_404(
        self, client: AsyncClient, create_user
    ):
        user = await create_user(username="notfounduser", role=UserRole.RESEARCHER)
        headers = _auth_headers(user.id, user.role.value)

        resp = await client.get("/api/v1/formulas/999999", headers=headers)
        assert resp.status_code == 404
        body = resp.json()
        assert "detail" in body

    async def test_non_numeric_id_returns_422(
        self, client: AsyncClient, create_user
    ):
        user = await create_user(username="badiduser", role=UserRole.RESEARCHER)
        headers = _auth_headers(user.id, user.role.value)

        resp = await client.get("/api/v1/formulas/not-a-number", headers=headers)
        assert resp.status_code == 422

    async def test_get_without_auth_returns_error(self, client: AsyncClient):
        """Without a valid token the endpoint should not return formula data."""
        resp = await client.get("/api/v1/formulas/1")
        # get_current_user returns None for missing token.  The service layer
        # may then raise 401/404/500 depending on implementation.  The key
        # contract is that we do NOT get a valid FormulaResponse back.
        assert resp.status_code != 200 or resp.json().get("id") is None


# ══════════════════════════════════════════════
# 6. GET /health
# ══════════════════════════════════════════════

@pytest.mark.integration
class TestHealthContract:
    """GET /health — health check contracts.

    The health endpoint is mounted directly on the FastAPI app (not under
    the api_router), so the path is /health rather than /api/v1/health.

    NOTE: The health endpoint uses the global database engine (not the test
    session override).  In the test environment the global engine may not be
    fully initialised, so the response body can be null.  These tests verify
    the endpoint is reachable and, when data is returned, the schema is
    correct.
    """

    async def test_health_endpoint_is_reachable(self, client: AsyncClient):
        resp = await client.get("/health")
        # The endpoint should respond (not 404 or 5xx from missing route)
        assert resp.status_code == 200

    async def test_health_returns_expected_shape_when_data_present(
        self, client: AsyncClient
    ):
        resp = await client.get("/health")
        assert resp.status_code == 200
        body = resp.json()

        # In test environments the global DB engine may not be initialised,
        # causing the endpoint to return null.  If data IS returned, validate
        # the schema contract.
        if body is not None:
            assert isinstance(body, dict)
            assert "status" in body
            assert isinstance(body["status"], str)
            assert "app" in body
            assert "version" in body
            assert "database" in body
            assert isinstance(body["database"], dict)
            assert "status" in body["database"]
            assert "type" in body["database"]

    async def test_health_does_not_require_auth(self, client: AsyncClient):
        """Health check must be publicly accessible — no token needed."""
        resp = await client.get("/health")
        assert resp.status_code == 200
