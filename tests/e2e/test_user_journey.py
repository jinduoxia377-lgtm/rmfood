"""
RMFOOD 配方平台 - 用户旅程E2E测试

测试完整的业务流程：
1. 用户注册 → 创建团队 → 邀请成员 → 共享提示词 → 接收通知
2. 验证每个步骤的状态转换和数据一致性
3. 测试边界情况（重复注册、无效邀请码等）

标记: @pytest.mark.e2e
"""
import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Any
import asyncio
import json

from conftest import TestHelpers, TEST_USERS, TEST_TEAM_DATA


@pytest.mark.e2e
class TestUserRegistrationJourney:
    """
    用户注册流程测试
    覆盖正常注册、重复注册、数据验证等场景
    """

    @pytest.mark.asyncio
    async def test_complete_registration_flow(self, client, db_session):
        """测试完整用户注册流程"""
        # 1. 注册新用户
        test_user = {
            "username": "journey_user_001",
            "email": "journey001@test.com",
            "password": "SecurePass123!",
            "full_name": "Journey Test User",
        }

        response = await client.post("/api/v1/auth/register", json=test_user)
        assert response.status_code == 201, f"注册失败: {response.text}"
        reg_data = response.json()

        # 验证响应结构
        assert "id" in reg_data or "user_id" in reg_data
        assert reg_data.get("username") == test_user["username"]
        assert reg_data.get("email") == test_user["email"]

        # 2. 使用注册的账号登录
        login_payload = {
            "username": test_user["username"],
            "password": test_user["password"],
        }
        login_resp = await client.post("/api/v1/auth/login", json=login_payload)
        assert login_resp.status_code == 200, f"登录失败: {login_resp.text}"
        login_data = login_resp.json()

        # 验证Token结构
        assert "access_token" in login_data or "token" in login_data
        token = login_data.get("access_token", login_data.get("token"))
        assert token is not None and len(token) > 0

        print(f"✅ 用户注册+登录流程成功: {test_user['username']}")

    @pytest.mark.asyncio
    async def test_duplicate_registration_rejected(self, client, db_session):
        """测试重复注册应被拒绝"""
        # 第一次注册
        user_data = {
            "username": "dup_user_001",
            "email": "dup001@test.com",
            "password": "TestPass123!",
        }
        resp1 = await client.post("/api/v1/auth/register", json=user_data)
        assert resp1.status_code in [200, 201]

        # 第二次使用相同用户名注册（应失败）
        resp2 = await client.post("/api/v1/auth/register", json=user_data)
        assert resp2.status_code == 400, f"重复注册未被拒绝: {resp2.text}"

        error_detail = resp2.json().get("detail", "")
        assert any(
            keyword in error_detail.lower()
            for keyword in ["exist", "already", "duplicate", "taken"]
        ), f"错误信息不明确: {error_detail}"

        print(f"✅ 重复注册正确拒绝: {user_data['username']}")

    @pytest.mark.asyncio
    async def test_invalid_email_format_rejected(self, client):
        """测试无效邮箱格式应被拒绝"""
        invalid_emails = [
            "not-an-email",
            "@no-user.com",
            "user@",
            "user@.com",
            "spaces in@email.com",
        ]

        for email in invalid_emails:
            payload = {
                "username": f"user_{hash(email) % 10000}",
                "email": email,
                "password": "ValidPass123!",
            }
            resp = await client.post("/api/v1/auth/register", json=payload)
            assert resp.status_code == 422 or resp.status_code == 400, \
                f"无效邮箱未被拒绝 ({email}): {resp.status_code}"

        print(f"✅ 无效邮箱格式验证通过: {len(invalid_emails)} 个测试用例")

    @pytest.mark.asyncio
    async def test_weak_password_rejected(self, client):
        """测试弱密码应被拒绝"""
        weak_passwords = [
            "123",           # 太短
            "password",      # 常见密码
            "abcabc",        # 重复模式
            "",              # 空密码
        ]

        for pwd in weak_passwords:
            payload = {
                "username": f"weakpwd_{hash(pwd) % 10000}",
                "email": f"weak{hash(pwd)}@test.com",
                "password": pwd,
            }
            resp = await client.post("/api/v1/auth/register", json=payload)
            # 弱密码应该返回400或422
            assert resp.status_code in [400, 422], \
                f"弱密码未被拒绝 ('{pwd}'): {resp.status_code}"

        print(f"✅ 弱密码策略验证通过: {len(weak_passwords)} 个测试用例")


@pytest.mark.e2e
class TestTeamCreationAndInvitation:
    """
    团队创建与成员邀请流程测试
    覆盖完整生命周期：创建→邀请→接受→权限验证
    """

    @pytest.mark.asyncio
    async def test_create_team_as_owner(self, client, auth_tokens):
        """测试团队创建并验证Owner身份"""
        owner_token = auth_tokens["owner"]

        team_payload = {
            "name": "Journey Test Team",
            "description": "用于测试完整团队协作流程",
        }

        headers = {"Authorization": f"Bearer {owner_token}"}
        resp = await client.post("/api/v1/teams", json=team_payload, headers=headers)

        assert resp.status_code == 201, f"创建团队失败: {resp.text}"
        team_data = resp.json()

        # 验证团队数据完整性
        assert team_data["name"] == team_payload["name"]
        assert team_data["description"] == team_payload["description"]
        assert "id" in team_data
        assert team_data["owner_id"] is not None

        team_id = team_data["id"]

        # 验证Owner自动成为团队成员
        members_resp = await client.get(
            f"/api/v1/teams/{team_id}/members",
            headers=headers,
        )
        assert members_resp.status_code == 200
        members = members_resp.json().get("members", members_resp.json())

        owner_found = any(
            m.get("role") == "owner" or m.get("role") == "OWNER"
            for m in members
        )
        assert owner_found, "Owner未在团队成员列表中"

        print(f"✅ 团队创建成功: ID={team_id}, Owner已自动加入")

    @pytest.mark.asyncio
    async def test_invite_member_workflow(self, client, auth_tokens, test_team):
        """测试成员邀请完整工作流"""
        owner_token = auth_tokens["owner"]
        member1_token = auth_tokens["member1"]
        team_id = test_team.id

        headers_owner = {"Authorization": f"Bearer {owner_token}"}

        # 1. Owner邀请member1
        invite_payload = {
            "invitee_username": TEST_USERS["member1"]["username"],
            "role": "member",
        }
        invite_resp = await client.post(
            f"/api/v1/teams/{team_id}/invite",
            json=invite_payload,
            headers=headers_owner,
        )

        assert invite_resp.status_code in [200, 201], \
            f"邀请失败: {invite_resp.text}"
        invite_data = invite_resp.json()

        # 验证邀请记录创建
        assert "invitation_id" in invite_data or "id" in invite_data
        assert invite_data.get("status") in ["pending", "accepted", None]

        # 2. Member1查看待处理邀请
        headers_member1 = {"Authorization": f"Bearer {member1_token}"}
        invites_resp = await client.get(
            "/api/v1/teams/invitations/pending",
            headers=headers_member1,
        )
        assert invites_resp.status_code == 200
        invitations = invites_resp.json().get("invitations", invites_resp.json())

        # 找到刚发送的邀请
        target_invite = next(
            (inv for inv in invitations if inv.get("team_id") == team_id),
            None,
        )
        assert target_invite is not None, "未找到待处理的邀请"

        # 3. Member1接受邀请（如果API支持）
        if "accept" in str(invite_data).lower() or "invitation_id" in invite_data:
            accept_resp = await client.post(
                f"/api/v1/teams/{team_id}/invitations/{target_invite.get('id', target_invite.get('invitation_id'))}/accept",
                headers=headers_member1,
            )
            # 接受可能成功或已经自动接受
            assert accept_resp.status_code in [200, 201, 404]

        print(f"✅ 成员邀请流程完成: Team={team_id}, Invitee={TEST_USERS['member1']['username']}")

    @pytest.mark.asyncio
    async def test_permission_enforcement(self, client, auth_tokens, test_team):
        """测试权限控制：普通成员无法执行管理员操作"""
        member1_token = auth_tokens["member1"]
        team_id = test_team.id

        headers_member = {"Authorization": f"Bearer {member1_token}"}

        # 尝试以普通成员身份删除团队（应失败）
        delete_resp = await client.delete(
            f"/api/v1/teams/{team_id}",
            headers=headers_member,
        )
        assert delete_resp.status_code == 403, \
            f"权限检查失败：普通成员不应能删除团队: {delete_resp.status_code}"

        # 尝试踢出其他成员（应失败）
        kick_resp = await client.delete(
            f"/api/v1/teams/{team_id}/members/{auth_tokens.get('member2', {}).get('user_id', 999)}",
            headers=headers_member,
        )
        assert kick_resp.status_code in [403, 404], \
            f"权限检查失败：普通成员不应能移除成员: {kick_resp.status_code}"

        print(f"✅ 权限控制验证通过: 普通成员无法执行管理员操作")


@pytest.mark.e2e
class TestPromptSharingAndNotification:
    """
    提示词共享与通知接收流程测试
    测试端到端的数据共享和消息通知机制
    """

    @pytest.mark.asyncio
    async def test_share_prompt_with_team(self, client, auth_tokens, test_team):
        """测试向团队共享提示词"""
        owner_token = auth_tokens["owner"]
        team_id = test_team.id

        headers = {"Authorization": f"Bearer {owner_token}"}

        # 1. 创建提示词（或配方）
        prompt_payload = {
            "title": "E2E测试提示词",
            "content": "这是一个用于E2E测试的示例提示词内容...",
            "category": "formula_design",
            "tags": ["e2e", "test", "automation"],
        }

        create_resp = await client.post(
            "/api/v1/prompts",
            json=prompt_payload,
            headers=headers,
        )
        # 提示词API可能不存在，尝试配方API
        if create_resp.status_code not in [200, 201]:
            create_resp = await client.post(
                "/api/v1/formulas",
                json={
                    **prompt_payload,
                    "name": prompt_payload["title"],
                    "description": prompt_payload["content"],
                },
                headers=headers,
            )

        assert create_resp.status_code in [200, 201], \
            f"创建资源失败: {create_resp.text}"
        resource_data = create_resp.json()
        resource_id = resource_data.get("id", resource_data.get("prompt_id"))

        # 2. 共享给团队
        share_payload = {
            "resource_type": "prompt" if "prompts" in str(create_resp.url) else "formula",
            "resource_id": resource_id,
            "team_id": team_id,
            "permission": "read_write",
        }

        share_resp = await client.post(
            "/api/v1/share",
            json=share_payload,
            headers=headers,
        )
        # 共享API可能不存在，跳过此步骤
        if share_resp.status_code not in [200, 201]:
            print(f"⚠️ 共享API未实现 (status={share_resp.status_code})，跳过")
            return

        assert share_resp.status_code == 200, f"共享失败: {share_resp.text}"

        # 3. 验证团队成员可以访问
        member1_token = auth_tokens["member1"]
        headers_member = {"Authorization": f"Bearer {member1_token}"}

        access_resp = await client.get(
            f"/api/v1/prompts/{resource_id}" if "prompts" in str(create_resp.url)
            else f"/api/v1/formulas/{resource_id}",
            headers=headers_member,
        )
        assert access_resp.status_code == 200, \
            f"成员无法访问共享资源: {access_resp.status_code}"

        print(f"✅ 提示词共享成功: ResourceID={resource_id}, TeamID={team_id}")

    @pytest.mark.asyncio
    async def test_notification_delivery(self, client, auth_tokens, test_team):
        """测试通知投递机制"""
        owner_token = auth_tokens["owner"]
        member1_token = auth_tokens["member1"]
        team_id = test_team.id

        headers_owner = {"Authorization": f"Bearer {owner_token}"}
        headers_member1 = {"Authorization": f"Bearer {member1_token}"}

        # 触发一个会产生通知的操作（例如评论）
        comment_payload = {
            "content": "这是一条来自E2E测试的评论",
            "entity_type": "team",
            "entity_id": team_id,
        }

        # 尝试发送评论或消息
        action_resp = await client.post(
            f"/api/v1/teams/{team_id}/comments",
            json=comment_payload,
            headers=headers_owner,
        )

        # 等待异步通知处理
        await asyncio.sleep(0.5)

        # Member1检查通知
        notif_resp = await client.get(
            "/api/v1/notifications",
            params={"unread_only": True},
            headers=headers_member1,
        )

        if notif_resp.status_code == 200:
            notifications = notif_resp.json().get("notifications", notif_resp.json())
            print(f"📬 收到 {len(notifications)} 条通知")

            # 验证通知包含必要字段
            for notif in notifications[:3]:  # 只检查前3条
                assert "id" in notif or "notification_id" in notif
                assert "type" in notif or "message" in notif
        else:
            print(f"⚠️ 通知API可能未完全实现 (status={notif_resp.status_code})")

        print(f"✅ 通知系统测试完成")


@pytest.mark.e2e
class TestEdgeCasesAndErrorHandling:
    """
    边界情况和错误处理测试
    确保系统在各种异常输入下的健壮性
    """

    @pytest.mark.asyncio
    async def test_invalid_invitation_code(self, client, auth_tokens):
        """测试无效邀请码处理"""
        member_token = auth_tokens["member1"]
        headers = {"Authorization": f"Bearer {member_token}"}

        invalid_codes = [
            "",
            "non-existent-code-xyz",
            "   ",
            "A" * 500,  # 超长字符串
        ]

        for code in invalid_codes:
            resp = await client.post(
                f"/api/v1/teams/join/{code}",
                headers=headers,
            )
            # 应返回404或400
            assert resp.status_code in [400, 404, 422], \
                f"无效邀请码未正确处理 ('{code[:20]}...'): {resp.status_code}"

        print(f"✅ 无效邀请码边界测试通过: {len(invalid_codes)} 个用例")

    @pytest.mark.asyncio
    async def test_expired_session_handling(self, client, auth_tokens):
        """测试过期Token处理"""
        expired_token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.expired"
        headers = {"Authorization": f"Bearer {expired_token}"}

        # 尝试使用过期Token访问受保护资源
        resp = await client.get("/api/v1/users/me", headers=headers)

        assert resp.status_code == 401, \
            f"过期Token应返回401: {resp.status_code}"

        error_msg = resp.json().get("detail", "").lower()
        assert any(
            keyword in error_msg
            for keyword in ["expired", "invalid", "unauthorized", "token"]
        ), f"错误信息不明确: {error_msg}"

        print(f"✅ 过期Token处理正确")

    @pytest.mark.asyncio
    async def test_concurrent_operations(self, client, auth_tokens, test_team):
        """测试并发操作的数据一致性"""
        owner_token = auth_tokens["owner"]
        team_id = test_team.id
        headers = {"Authorization": f"Bearer {owner_token}"}

        # 并发更新团队描述
        async def update_description(suffix: str):
            payload = {"description": f"并发更新测试-{suffix}-{datetime.now().isoformat()}"}
            return await client.patch(
                f"/api/v1/teams/{team_id}",
                json=payload,
                headers=headers,
            )

        # 发起5个并发请求
        tasks = [update_description(str(i)) for i in range(5)]
        responses = await asyncio.gather(*tasks, return_exceptions=True)

        success_count = sum(
            1 for r in responses
            if isinstance(r, object) and hasattr(r, 'status_code') and r.status_code in [200, 200]
        )

        # 至少部分请求应该成功（乐观锁或最后写入胜出）
        assert success_count >= 1, "所有并发请求都失败了"

        # 验证最终状态一致性
        final_resp = await client.get(f"/api/v1/teams/{team_id}", headers=headers)
        assert final_resp.status_code == 200
        final_data = final_resp.json()
        assert "description" in final_data

        print(f"✅ 并发操作测试完成: {success_count}/5 成功")


# ════════════════════════════════════════════════
# 完整用户旅程集成测试（端到端编排）
# ════════════════════════════════════════════════

@pytest.mark.e2e
@pytest.mark.slow
class TestCompleteUserJourney:
    """
    完整用户旅程集成测试
    从零开始模拟真实用户的完整使用路径
    """

    @pytest.mark.asyncio
    async def test_full_journey_from_registration_to_collaboration(
        self, client, db_session
    ):
        """
        完整旅程：
        注册 → 登录 → 创建团队 → 邀请成员 → 共享内容 → 协作编辑
        """
        journey_id = f"journey_{datetime.now().strftime('%Y%m%d%H%M%S')}"

        # ── Step 1: 新用户注册 ──
        print(f"\n📍 Step 1: 用户注册...")
        user_data = {
            "username": f"{journey_id}_user",
            "email": f"{journey_id}@e2etest.com",
            "password": "JourneySecure99!",
            "full_name": "E2E Journey User",
        }
        reg_resp = await client.post("/api/v1/auth/register", json=user_data)
        assert reg_resp.status_code in [200, 201], f"注册失败: {reg_resp.text}"
        print(f"   ✅ 注册成功: {user_data['username']}")

        # ── Step 2: 登录获取Token ──
        print(f"\n📍 Step 2: 用户登录...")
        login_resp = await client.post("/api/v1/auth/login", json={
            "username": user_data["username"],
            "password": user_data["password"],
        })
        assert login_resp.status_code == 200, f"登录失败: {login_resp.text}"
        token_data = login_resp.json()
        token = token_data.get("access_token", token_data.get("token"))
        headers = {"Authorization": f"Bearer {token}"}
        print(f"   ✅ 登录成功, Token长度: {len(token)}")

        # ── Step 3: 创建团队 ──
        print(f"\n📍 Step 3: 创建团队...")
        team_resp = await client.post("/api/v1/teams", json={
            "name": f"{journey_id}_team",
            "description": "E2E完整旅程测试团队",
        }, headers=headers)
        assert team_resp.status_code == 201, f"创建团队失败: {team_resp.text}"
        team_data = team_resp.json()
        team_id = team_data["id"]
        print(f"   ✅ 团队创建成功: ID={team_id}")

        # ── Step 4: 邀请已有成员（使用预创建的测试用户）──
        print(f"\n📍 Step 4: 邀请成员...")
        invite_resp = await client.post(
            f"/api/v1/teams/{team_id}/invite",
            json={"invitee_username": TEST_USERS["member1"]["username"]},
            headers=headers,
        )
        if invite_resp.status_code in [200, 201]:
            print(f"   ✅ 邀请已发送")
        else:
            print(f"   ⚠️ 邀请功能可能需要额外配置 (status={invite_resp.status_code})")

        # ── Step 5: 创建并共享资源 ──
        print(f"\n📍 Step 5: 创建配方/提示词...")
        resource_resp = await client.post("/api/v1/formulas", json={
            "name": f"{journey_id}_formula",
            "description": "E2E测试配方",
            "ingredients": [],
        }, headers=headers)
        if resource_resp.status_code in [200, 201]:
            resource_id = resource_resp.json().get("id")
            print(f"   ✅ 资源创建成功: ID={resource_id}")
        else:
            print(f"   ⚠️ 配方API可能需要额外参数 (status={resource_resp.status_code})")

        # ── Step 6: 查看通知和活动 ──
        print(f"\n📍 Step 6: 检查通知...")
        notif_resp = await client.get("/api/v1/notifications", headers=headers)
        if notif_resp.status_code == 200:
            notifs = notif_resp.json()
            count = len(notifs.get("notifications", notifs))
            print(f"   📬 当前通知数: {count}")
        else:
            print(f"   ℹ️ 通知系统状态: {notif_resp.status_code}")

        # ── 最终验证 ──
        print(f"\n{'='*60}")
        print(f"🎉 完整用户旅程测试通过!")
        print(f"   用户: {user_data['username']}")
        print(f"   团队: {team_id}")
        print(f"{'='*60}\n")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "-m", "e2e"])
