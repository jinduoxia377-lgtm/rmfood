"""RMFOOD API集成测试 - 配方管理"""
import pytest
from httpx import AsyncClient



class TestFormulaAPI:
    """配方API集成测试"""

    @pytest.mark.asyncio
    async def test_create_formula_success(self, client: AsyncClient, admin_headers: dict):
        """测试成功创建配方"""
        response = await client.post(
            "/api/v1/formulas",
            json={
                "name": "测试配方",
                "code": "RMF-TEST-001",
                "description": "这是一个测试配方",
                "target_effects": ["补气", "养血"],
                "dosage": "10g/次",
            },
            headers=admin_headers
        )

        assert response.status_code == 201
        data = response.json()
        assert data["success"] is True
        assert data["data"]["name"] == "测试配方"
        assert data["data"]["code"] == "RMF-TEST-001"

    @pytest.mark.asyncio
    async def test_create_formula_without_auth(self, client: AsyncClient):
        """测试未认证创建配方失败"""
        response = await client.post(
            "/api/v1/formulas",
            json={
                "name": "测试配方",
                "code": "RMF-TEST-001",
            }
        )

        assert response.status_code == 403

    @pytest.mark.asyncio
    async def test_list_formulas(self, client: AsyncClient, admin_headers: dict):
        """测试列出配方"""
        # 先创建配方
        await client.post(
            "/api/v1/formulas",
            json={
                "name": "测试配方1",
                "code": "RMF-TEST-001",
            },
            headers=admin_headers
        )

        await client.post(
            "/api/v1/formulas",
            json={
                "name": "测试配方2",
                "code": "RMF-TEST-002",
            },
            headers=admin_headers
        )

        response = await client.get(
            "/api/v1/formulas",
            headers=admin_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["total"] >= 2

    @pytest.mark.asyncio
    async def test_get_formula_by_id(self, client: AsyncClient, admin_headers: dict):
        """测试根据ID获取配方"""
        # 先创建配方
        create_response = await client.post(
            "/api/v1/formulas",
            json={
                "name": "测试配方",
                "code": "RMF-TEST-001",
            },
            headers=admin_headers
        )
        formula_id = create_response.json()["data"]["id"]

        response = await client.get(
            f"/api/v1/formulas/{formula_id}",
            headers=admin_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["data"]["name"] == "测试配方"

    @pytest.mark.asyncio
    async def test_update_formula(self, client: AsyncClient, admin_headers: dict):
        """测试更新配方"""
        # 先创建配方
        create_response = await client.post(
            "/api/v1/formulas",
            json={
                "name": "测试配方",
                "code": "RMF-TEST-001",
            },
            headers=admin_headers
        )
        formula_id = create_response.json()["data"]["id"]

        response = await client.put(
            f"/api/v1/formulas/{formula_id}",
            json={
                "name": "更新后的配方",
                "description": "新的描述",
            },
            headers=admin_headers
        )

        assert response.status_code == 200
        data = response.json()
        assert data["data"]["name"] == "更新后的配方"

    @pytest.mark.asyncio
    async def test_delete_formula(self, client: AsyncClient, admin_headers: dict):
        """测试删除配方"""
        # 先创建配方
        create_response = await client.post(
            "/api/v1/formulas",
            json={
                "name": "测试配方",
                "code": "RMF-TEST-001",
            },
            headers=admin_headers
        )
        formula_id = create_response.json()["data"]["id"]

        response = await client.delete(
            f"/api/v1/formulas/{formula_id}",
            headers=admin_headers
        )

        assert response.status_code == 200

        # 验证删除
        get_response = await client.get(
            f"/api/v1/formulas/{formula_id}",
            headers=admin_headers
        )

        assert get_response.status_code == 404

    @pytest.mark.asyncio
    async def test_formula_review_flow(self, client: AsyncClient, admin_headers: dict):
        """测试配方审核流程"""
        # 创建配方
        create_response = await client.post(
            "/api/v1/formulas",
            json={
                "name": "测试配方",
                "code": "RMF-TEST-001",
            },
            headers=admin_headers
        )
        formula_id = create_response.json()["data"]["id"]

        # 提交审核
        submit_response = await client.post(
            f"/api/v1/formulas/{formula_id}/submit",
            headers=admin_headers
        )

        assert submit_response.status_code == 200
        assert submit_response.json()["data"]["status"] == "pending_review"

        # 审核通过
        review_response = await client.post(
            f"/api/v1/formulas/{formula_id}/review",
            json={
                "decision": "approve",
                "notes": "审核通过"
            },
            headers=admin_headers
        )

        assert review_response.status_code == 200
        assert review_response.json()["data"]["status"] == "approved"

    @pytest.mark.asyncio
    async def test_formula_validation_error(self, client: AsyncClient, admin_headers: dict):
        """测试配方验证错误"""
        response = await client.post(
            "/api/v1/formulas",
            json={
                "name": "测试配方",
                # 缺少必填的code字段
            },
            headers=admin_headers
        )

        assert response.status_code == 422
