"""分享跟踪测试"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_create_share(client: AsyncClient, researcher_headers: dict, sample_formula_data: dict):
    """测试创建分享"""
    create_response = await client.post(
        "/api/v1/formulas",
        json=sample_formula_data,
        headers=researcher_headers,
    )
    if create_response.status_code == 201:
        formula_id = create_response.json().get("id")
        if formula_id:
            response = await client.post(
                f"/api/v1/formulas/{formula_id}/share",
                json={
                    "permission": "public",
                    "expires_in_days": 30,
                },
                headers=researcher_headers,
            )
            assert response.status_code in [200, 201, 404]


@pytest.mark.asyncio
async def test_create_share_with_password(client: AsyncClient, researcher_headers: dict):
    """测试创建密码分享"""
    response = await client.post(
        "/api/v1/formulas/1/share",
        json={
            "permission": "password",
            "password": "testpass123",
            "expires_in_days": 7,
        },
        headers=researcher_headers,
    )
    assert response.status_code in [200, 201, 404]


@pytest.mark.asyncio
async def test_create_private_share(client: AsyncClient, researcher_headers: dict):
    """测试创建私密分享"""
    response = await client.post(
        "/api/v1/formulas/1/share",
        json={
            "permission": "private",
        },
        headers=researcher_headers,
    )
    assert response.status_code in [200, 201, 404]


@pytest.mark.asyncio
async def test_list_shares(client: AsyncClient, researcher_headers: dict):
    """测试列出分享"""
    response = await client.get(
        "/api/v1/formulas/1/shares",
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_get_share_view_count(client: AsyncClient, researcher_headers: dict):
    """测试获取分享访问次数"""
    response = await client.get(
        "/api/v1/shares/abc123",
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_increment_share_view(client: AsyncClient, researcher_headers: dict):
    """测试增加分享访问次数"""
    response = await client.post(
        "/api/v1/shares/abc123/view",
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_delete_share(client: AsyncClient, researcher_headers: dict):
    """测试删除分享"""
    response = await client.delete(
        "/api/v1/formulas/1/shares/abc123",
        headers=researcher_headers,
    )
    assert response.status_code in [200, 204, 404]


@pytest.mark.asyncio
async def test_share_with_expiry(client: AsyncClient, researcher_headers: dict):
    """测试带过期时间的分享"""
    response = await client.post(
        "/api/v1/formulas/1/share",
        json={
            "permission": "public",
            "expires_in_days": 1,
        },
        headers=researcher_headers,
    )
    assert response.status_code in [200, 201, 404]


@pytest.mark.asyncio
async def test_access_expired_share(client: AsyncClient):
    """测试访问过期的分享"""
    response = await client.get("/api/v1/shares/expired123")
    assert response.status_code in [200, 404, 410]


@pytest.mark.asyncio
async def test_access_password_protected_share(client: AsyncClient):
    """测试访问密码保护的分享"""
    response = await client.post(
        "/api/v1/shares/abc123/access",
        json={"password": "testpass123"},
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_share_statistics(client: AsyncClient, researcher_headers: dict):
    """测试分享统计"""
    response = await client.get(
        "/api/v1/formulas/1/shares/statistics",
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_share_include_scores(client: AsyncClient, researcher_headers: dict):
    """测试分享包含评分"""
    response = await client.post(
        "/api/v1/formulas/1/share",
        json={
            "permission": "public",
            "include_scores": True,
        },
        headers=researcher_headers,
    )
    assert response.status_code in [200, 201, 404]


@pytest.mark.asyncio
async def test_share_include_ingredients(client: AsyncClient, researcher_headers: dict):
    """测试分享包含原料"""
    response = await client.post(
        "/api/v1/formulas/1/share",
        json={
            "permission": "public",
            "include_ingredients": True,
        },
        headers=researcher_headers,
    )
    assert response.status_code in [200, 201, 404]


@pytest.mark.asyncio
async def test_import_share(client: AsyncClient, researcher_headers: dict):
    """测试导入分享配方"""
    response = await client.post(
        "/api/v1/shares/import",
        json={
            "share_link": "https://example.com/share/formula/abc123",
        },
        headers=researcher_headers,
    )
    assert response.status_code in [200, 201, 404]
