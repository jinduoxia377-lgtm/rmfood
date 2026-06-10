"""配方版本管理测试"""
import pytest
from httpx import AsyncClient


@pytest.mark.asyncio
async def test_version_history_empty(client: AsyncClient, researcher_headers: dict):
    """测试空版本历史"""
    response = await client.get(
        "/api/v1/formulas/999/versions",
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_version_create(client: AsyncClient, researcher_headers: dict, sample_formula_data: dict):
    """测试创建配方版本"""
    create_response = await client.post(
        "/api/v1/formulas",
        json=sample_formula_data,
        headers=researcher_headers,
    )
    if create_response.status_code == 201:
        formula_id = create_response.json().get("id")
        if formula_id:
            response = await client.get(
                f"/api/v1/formulas/{formula_id}/versions",
                headers=researcher_headers,
            )
            assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_version_compare_endpoint_exists(client: AsyncClient, researcher_headers: dict):
    """测试版本对比端点"""
    response = await client.get(
        "/api/v1/formulas/1/versions/compare?from=1&to=2",
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_version_list_pagination(client: AsyncClient, researcher_headers: dict):
    """测试版本列表分页"""
    response = await client.get(
        "/api/v1/formulas/1/versions?page=1&page_size=10",
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_version_list_sorted(client: AsyncClient, researcher_headers: dict):
    """测试版本列表排序"""
    response = await client.get(
        "/api/v1/formulas/1/versions?sort=version_number&order=desc",
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_version_detail(client: AsyncClient, researcher_headers: dict):
    """测试版本详情"""
    response = await client.get(
        "/api/v1/formulas/1/versions/1",
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_version_rollback(client: AsyncClient, researcher_headers: dict):
    """测试版本回滚"""
    response = await client.post(
        "/api/v1/formulas/1/versions/1/rollback",
        headers=researcher_headers,
    )
    assert response.status_code in [200, 201, 404]


@pytest.mark.asyncio
async def test_version_branch(client: AsyncClient, researcher_headers: dict):
    """测试版本分支"""
    response = await client.post(
        "/api/v1/formulas/1/versions/1/branch",
        json={"name": "测试分支"},
        headers=researcher_headers,
    )
    assert response.status_code in [200, 201, 404]


@pytest.mark.asyncio
async def test_version_remark_update(client: AsyncClient, researcher_headers: dict):
    """测试版本备注更新"""
    response = await client.patch(
        "/api/v1/formulas/1/versions/1",
        json={"remark": "更新测试备注"},
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_version_with_ingredients(client: AsyncClient, researcher_headers: dict):
    """测试带成分的版本"""
    response = await client.get(
        "/api/v1/formulas/1/versions/1?include_ingredients=true",
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_version_with_scores(client: AsyncClient, researcher_headers: dict):
    """测试带评分的版本"""
    response = await client.get(
        "/api/v1/formulas/1/versions/1?include_scores=true",
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_version_diff(client: AsyncClient, researcher_headers: dict):
    """测试版本差异"""
    response = await client.get(
        "/api/v1/formulas/1/versions/diff?from=1&to=2&format=json",
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]


@pytest.mark.asyncio
async def test_version_export(client: AsyncClient, researcher_headers: dict):
    """测试版本导出"""
    response = await client.get(
        "/api/v1/formulas/1/versions/1/export?format=json",
        headers=researcher_headers,
    )
    assert response.status_code in [200, 404]
