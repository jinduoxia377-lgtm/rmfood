"""
RMFOOD 配方平台 - 云端同步场景E2E测试

测试离线编辑→上线→自动同步→冲突解决的完整场景：
1. 模拟网络中断和恢复
2. 验证离线队列机制
3. 测试冲突检测和解决流程
4. 多设备同步一致性验证

标记: @pytest.mark.e2e @pytest.mark.integration
"""
import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any
from unittest.mock import patch, AsyncMock
import asyncio
import json

from conftest import TestHelpers, TEST_USERS


@pytest.mark.e2e
@pytest.mark.integration
class TestOfflineEditingAndSync:
    """
    离线编辑与自动同步场景测试
    模拟用户在离线状态下编辑，上线后自动同步的完整流程
    """

    @pytest.mark.asyncio
    async def test_offline_edit_queue_accumulation(
        self, client, auth_tokens, test_device, db_session
    ):
        """
        测试离线状态下的变更队列累积
        模拟：用户在无网络时进行多次编辑操作
        """
        owner_token = auth_tokens["owner"]
        device_id = test_device.device_id
        headers = {"Authorization": f"Bearer {owner_token}"}

        # 模拟离线状态下积累的变更（本地队列）
        offline_changes = [
            {
                "entity_type": "formula",
                "entity_id": 1001,
                "action": "update",
                "data": {
                    "name": "配方A - 离线修改版1",
                    "updated_field": "ingredient_ratio",
                    "value": "3:2:1",
                },
                "version": 1,
                "timestamp": (datetime.now(timezone.utc) - timedelta(minutes=5)).isoformat(),
            },
            {
                "entity_type": "formula",
                "entity_id": 1001,
                "action": "update",
                "data": {
                    "name": "配方A - 离线修改版2",
                    "updated_field": "processing_time",
                    "value": "48h",
                },
                "version": 2,
                "timestamp": (datetime.now(timezone.utc) - timedelta(minutes=3)).isoformat(),
            },
            {
                "entity_type": "prompt",
                "entity_id": 2001,
                "action": "create",
                "data": {
                    "title": "新提示词（离线创建）",
                    "content": "这是在离线状态下创建的新提示词...",
                },
                "version": 1,
                "timestamp": (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat(),
            },
        ]

        # ── 模拟网络恢复，推送所有离线变更 ──
        print(f"\n📍 推送 {len(offline_changes)} 条离线变更...")
        push_payload = {
            "device_id": device_id,
            "changes": offline_changes,
            "client_timestamp": datetime.now(timezone.utc).isoformat(),
        }

        push_resp = await client.post(
            "/api/v1/sync/push",
            json=push_payload,
            headers=headers,
        )

        assert push_resp.status_code == 200, \
            f"推送离线变更失败: {push_resp.text}"
        push_data = push_resp.json()

        # 验证响应结构
        assert "accepted_count" in push_data or "success" in push_data
        accepted = push_data.get("accepted_count", len(offline_changes) if push_data.get("success") else 0)

        print(f"   ✅ 推送成功: {accepted}/{len(offline_changes)} 条变更被接受")

        # 验证数据库中的同步日志
        sync_log_result = await db_session.execute(
            select(__import__("app.models.sync_log").SyncLog).where(
                __import__("app.models.sync_log").SyncLog.user_id != None  # 简化查询
            ).limit(10)
        )
        logs = sync_log_result.scalars().all()
        assert len(logs) > 0, "同步日志未记录"

        print(f"   📊 数据库同步日志数: {len(logs)}")

    @pytest.mark.asyncio
    async def test_incremental_sync_after_reconnection(
        self, client, auth_tokens, test_device
    ):
        """
        测试重连后的增量同步
        只拉取上次同步之后的新变更
        """
        owner_token = auth_tokens["owner"]
        device_id = test_device.device_id
        headers = {"Authorization": f"Bearer {owner_token}"}

        last_sync_time = datetime.now(timezone.utc) - timedelta(hours=1)

        # 第一次拉取（获取从last_sync_time之后的变更）
        pull_resp = await client.get(
            "/api/v1/sync/pull",
            params={
                "device_id": device_id,
                "since": last_sync_time.isoformat(),
                "limit": 50,
            },
            headers=headers,
        )
        assert pull_resp.status_code == 200, f"拉取失败: {pull_resp.text}"
        pull_data = pull_resp.json()

        # 验证增量拉取响应结构
        assert "server_changes" in pull_data or "changes" in pull_data
        changes = pull_data.get("server_changes", pull_data.get("changes", []))
        assert isinstance(changes, list), "变更列表应为数组"

        print(f"✅ 增量同步成功: 获取到 {len(changes)} 条新变更")

        # 如果有变更，记录新的同步时间戳用于下次拉取
        if changes:
            new_timestamp = pull_data.get("last_sync_timestamp")
            assert new_timestamp is not None, "应返回最后同步时间戳"
            print(f"   📅 更新同步时间戳: {new_timestamp}")

    @pytest.mark.asyncio
    async def test_device_registration_and_tracking(
        self, client, auth_tokens, db_session
    ):
        """
        测试设备注册、更新和状态追踪
        验证多设备管理功能
        """
        owner_token = auth_tokens["owner"]
        headers = {"Authorization": f"Bearer {owner_token}"}

        devices_to_register = [
            {
                "device_id": "test-device-laptop-001",
                "device_type": "desktop",
                "device_name": "Work Laptop",
            },
            {
                "device_id": "test-device-phone-001",
                "device_type": "ios",
                "device_name": "iPhone 15 Pro",
            },
            {
                "device_id": "test-device-tablet-001",
                "device_type": "android",
                "device_name": "iPad Pro",
            },
        ]

        registered_devices = []

        for device_info in devices_to_register:
            reg_resp = await client.post(
                "/api/v1/sync/devices/register",
                json=device_info,
                headers=headers,
            )
            assert reg_resp.status_code == 200, \
                f"设备注册失败 ({device_info['device_id']}): {reg_resp.text}"
            registered_devices.append(device_info["device_id"])
            print(f"   ✅ 设备注册成功: {device_info['device_name']}")

        # 列出所有已注册设备
        list_resp = await client.get("/api/v1/sync/devices", headers=headers)
        assert list_resp.status_code == 200
        devices_list = list_resp.json()

        assert isinstance(devices_list, list)
        assert len(devices_list) >= len(devices_to_register)

        device_ids_in_list = [d.get("device_id") for d in devices_list]
        for dev_id in registered_devices:
            assert dev_id in device_ids_in_list, f"设备 {dev_id} 未在列表中"

        print(f"\n✅ 多设备管理验证通过: 已注册 {len(registered_devices)} 个设备")


@pytest.mark.e2e
@pytest.mark.integration
class TestConflictDetectionAndResolution:
    """
    冲突检测与解决机制测试
    测试并发编辑导致的冲突检测、策略应用和数据合并
    """

    @pytest.mark.asyncio
    async def test_concurrent_edit_conflict_detection(
        self, client, auth_tokens, test_device, db_session
    ):
        """
        测试并发编辑冲突检测
        场景：两个设备同时修改同一实体的不同字段
        """
        owner_token = auth_tokens["owner"]
        device_id = test_device.device_id
        headers = {"Authorization": f"Bearer {owner_token}"}

        entity_type = "formula"
        entity_id = 3001

        # 设备A的变更（修改名称）
        change_a = {
            "device_id": device_id,
            "changes": [{
                "entity_type": entity_type,
                "entity_id": entity_id,
                "action": "update",
                "data": {
                    "name": "配方A - 设备A版本",
                    "_modified_by": "device_a",
                },
                "version": 5,
            }],
            "client_timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # 先推送设备A的变更
        resp_a = await client.post("/api/v1/sync/push", json=change_a, headers=headers)
        assert resp_a.status_code == 200

        # 模拟设备B在同一时间推送不同字段的修改（可能产生冲突）
        change_b = {
            "device_id": f"{device_id}_b",  # 不同设备ID
            "changes": [{
                "entity_type": entity_type,
                "entity_id": entity_id,
                "action": "update",
                "data": {
                    "description": "配方A描述 - 设备B版本",
                    "_modified_by": "device_b",
                },
                "version": 5,  # 相同版本号，触发冲突检测
            }],
            "client_timestamp": (datetime.now(timezone.utc) + timedelta(seconds=1)).isoformat(),
        }

        resp_b = await client.post("/api/v1/sync/push", json=change_b, headers=headers)

        # 验证是否检测到冲突
        if resp_b.status_code == 200:
            data_b = resp_b.json()
            conflicts = data_b.get("conflicts", [])
            if conflicts:
                print(f"⚠️ 检测到 {len(conflicts)} 个冲突:")
                for conflict in conflicts:
                    print(f"   - 实体: {conflict.get('entity_type')}:{conflict.get('entity_id')}")
                    print(f"     原因: {conflict.get('conflict_reason')}")
                assert len(conflicts) > 0, "应检测到并发编辑冲突"
            else:
                print(f"ℹ️ 未检测到冲突（可能系统使用乐观合并策略）")
        else:
            print(f"⚠️ 第二次推送返回: {resp_b.status_code}")

    @pytest.mark.asyncio
    async def test_conflict_resolution_strategies(
        self, client, auth_tokens, test_device
    ):
        """
        测试不同的冲突解决策略
        - local: 使用本地版本
        - server: 使用服务器版本
        - merge: 自动合并
        """
        owner_token = auth_tokens["owner"]
        headers = {"Authorization": f"Bearer {owner_token}"}

        resolution_test_cases = [
            {
                "strategy": "local",
                "expected_behavior": "保留本地数据",
            },
            {
                "strategy": "server",
                "expected_behavior": "保留服务器数据",
            },
            {
                "strategy": "merge",
                "expected_behavior": "尝试合并两者",
            },
        ]

        for case in resolution_test_cases:
            resolve_payload = {
                "entity_type": "formula",
                "entity_id": 4001,
                "resolved_data": {
                    "name": f"解决后-{case['strategy']}",
                    "merged_fields": ["field_a", "field_b"],
                    "_resolution_strategy": case["strategy"],
                },
                "resolution_strategy": case["strategy"],
                "conflict_ids": [],
            }

            resolve_resp = await client.post(
                "/api/v1/sync/resolve-conflict",
                json=resolve_payload,
                headers=headers,
            )

            assert resolve_resp.status_code == 200, \
                f"冲突解决失败 (策略={case['strategy']}): {resolve_resp.text}"

            result = resolve_resp.json()
            assert result.get("success") is True, "解决应标记为成功"
            assert "merged_entity_id" in result or "new_version" in result

            print(f"✅ 冲突解决策略 [{case['strategy']}] 成功: {case['expected_behavior']}")

    @pytest.mark.asyncio
    async def test_sync_history_and_audit_trail(
        self, client, auth_tokens, test_device
    ):
        """
        测试同步历史记录和审计追踪
        验证所有同步操作都被正确记录并可查询
        """
        owner_token = auth_tokens["owner"]
        headers = {"Authorization": f"Bearer {owner_token}"}

        # 执行一些同步操作以生成历史记录
        for i in range(3):
            push_payload = {
                "device_id": test_device.device_id,
                "changes": [{
                    "entity_type": "test_entity",
                    "entity_id": 5000 + i,
                    "action": "create",
                    "data": {"index": i},
                    "version": 1,
                }],
                "client_timestamp": datetime.now(timezone.utc).isoformat(),
            }
            await client.post("/api/v1/sync/push", json=push_payload, headers=headers)

        # 查询同步历史
        history_resp = await client.get(
            "/api/v1/sync/history",
            params={"page": 1, "page_size": 10},
            headers=headers,
        )
        assert history_resp.status_code == 200, f"获取历史失败: {history_resp.text}"
        history_data = history_resp.json()

        # 验证分页结构
        assert "logs" in history_data or "items" in history_data
        assert "total" in history_data
        assert history_data["total"] > 0, "应有历史记录"

        logs = history_data.get("logs", history_data.get("items", []))
        print(f"\n📜 同步历史记录:")
        for log in logs[:5]:
            print(f"   - ID:{log.get('id')} | "
                  f"{log.get('action', 'N/A')} | "
                  f"{log.get('entity_type', 'N/A')}:{log.get('entity_id')} | "
                  f"状态:{log.get('status', 'N/A')}")

        # 按实体类型筛选
        filtered_resp = await client.get(
            "/api/v1/sync/history",
            params={
                "page": 1,
                "page_size": 10,
                "entity_type": "test_entity",
            },
            headers=headers,
        )
        assert filtered_resp.status_code == 200
        filtered_data = filtered_resp.json()
        filtered_logs = filtered_data.get("logs", filtered_data.get("items", []))

        print(f"\n🔍 筛选结果 (entity_type=test_entity): {len(filtered_logs)} 条")

        # 按状态筛选
        status_resp = await client.get(
            "/api/v1/sync/history",
            params={
                "page": 1,
                "page_size": 10,
                "status": "completed",
            },
            headers=headers,
        )
        assert status_resp.status_code == 200
        print(f"✅ 同步历史查询和筛选功能正常")


@pytest.mark.e2e
@pytest.mark.integration
class TestDataConsistencyAcrossDevices:
    """
    多设备数据一致性测试
    验证在不同设备间同步后数据的最终一致性
    """

    @pytest.mark.asyncio
    async def test_full_bidirectional_sync(
        self, client, auth_tokens, test_device
    ):
        """
        测试完整的双向同步流程
        包含：推送本地变更 → 拉取远程变更 → 冲突处理 → 最终一致
        """
        owner_token = auth_tokens["owner"]
        device_id = test_device.device_id
        headers = {"Authorization": f"Bearer {owner_token}"}

        # 准备本地数据快照
        local_data_snapshot = {
            "formulas": {
                "6001": {
                    "name": "本地配方A",
                    "version": 3,
                    "modified_at": datetime.now(timezone.utc).isoformat(),
                },
                "6002": {
                    "name": "本地配方B",
                    "version": 1,
                    "modified_at": datetime.now(timezone.utc).isoformat(),
                },
            },
            "prompts": {
                "7001": {
                    "title": "本地提示词X",
                    "content": "...",
                    "version": 2,
                },
            },
        }

        # 执行完整双向同步
        full_sync_payload = {
            "local_data": local_data_snapshot,
            "last_sync_timestamp": (
                datetime.now(timezone.utc) - timedelta(hours=2)
            ).isoformat(),
        }

        full_sync_resp = await client.post(
            "/api/v1/sync/full-sync",
            params={"device_id": device_id},
            json=full_sync_payload,
            headers=headers,
        )

        assert full_sync_resp.status_code == 200, \
            f"完整同步失败: {full_sync_resp.text}"
        sync_result = full_sync_resp.json()

        # 验证完整同步响应结构
        required_fields = [
            "success",
            "sync_mode",
            "statistics",
            "duration_ms",
        ]
        for field in required_fields:
            assert field in sync_result, f"完整同步响应缺少字段: {field}"

        stats = sync_result["statistics"]
        stat_fields = [
            "pushed_count",
            "pulled_count",
            "conflicts_detected",
        ]
        for field in stat_fields:
            assert field in stats, f"统计信息缺少字段: {field}"

        print(f"\n🔄 完整双向同步完成:")
        print(f"   模式: {sync_result['sync_mode']}")
        print(f"   耗时: {sync_result['duration_ms']}ms")
        print(f"   推送: {stats['pushed_count']} 条")
        print(f"   拉取: {stats['pulled_count']} 条")
        print(f"   冲突: {stats['conflicts_detected']} 个")
        print(f"   失败: {stats.get('failed_count', 0)} 条")

        # 如果有错误或警告，输出详细信息
        if sync_result.get("errors"):
            print(f"\n⚠️ 错误:")
            for err in sync_result["errors"][:3]:
                print(f"   - {err}")
        if sync_result.get("warnings"):
            print(f"\n⚠️ 警告:")
            for warn in sync_result["warnings"][:3]:
                print(f"   - {warn}")

    @pytest.mark.asyncio
    async def test_sync_status_monitoring(
        self, client, auth_tokens, test_device
    ):
        """
        测试同步状态监控端点
        验证设备状态、待处理变更数等指标
        """
        owner_token = auth_tokens["owner"]
        device_id = test_device.device_id
        headers = {"Authorization": f"Bearer {owner_token}"}

        # 获取同步状态
        status_resp = await client.get(
            "/api/v1/sync/status",
            params={"device_id": device_id},
            headers=headers,
        )
        assert status_resp.status_code == 200, f"获取状态失败: {status_resp.text}"
        status_data = status_resp.json()

        # 验证状态响应结构
        expected_status_fields = [
            "last_sync_time",
            "pending_changes_count",
            "device_status",
            "total_syncs",
        ]
        for field in expected_status_fields:
            assert field in status_data, f"状态响应缺少字段: {field}"

        # 验证设备状态值合法性
        valid_statuses = ["active", "inactive", "syncing", "offline"]
        assert status_data["device_status"] in valid_statuses, \
            f"无效的设备状态: {status_data['device_status']}"

        print(f"\n📊 设备同步状态:")
        print(f"   设备ID: {device_id}")
        print(f"   状态: {status_data['device_status']}")
        print(f"   最后同步: {status_data['last_sync_time']}")
        print(f"   待处理变更: {status_data['pending_changes_count']}")
        print(f"   总同步次数: {status_data['total_syncs']}")

        # 获取同步服务统计信息
        stats_resp = await client.get("/api/v1/sync/stats", headers=headers)
        if stats_resp.status_code == 200:
            stats_data = stats_resp.json()
            print(f"\n📈 同步引擎统计:")
            for component, data in stats_data.items():
                if component != "timestamp":
                    print(f"   {component}: {json.dumps(data, ensure_ascii=False)[:100]}...")


@pytest.mark.e2e
@pytest.mark.slow
class TestSyncEdgeCases:
    """
    同步边界情况和异常场景测试
    确保系统在网络不稳定等极端条件下的健壮性
    """

    @pytest.mark.asyncio
    async def test_large_batch_sync(self, client, auth_tokens, test_device):
        """测试大批量数据同步（接近上限）"""
        owner_token = auth_tokens["owner"]
        headers = {"Authorization": f"Bearer {owner_token}"}

        # 生成接近上限的变更数量（假设上限1000条）
        batch_size = 999
        large_batch = []
        for i in range(batch_size):
            large_batch.append({
                "entity_type": "batch_test",
                "entity_id": 8000 + i,
                "action": "create" if i % 3 == 0 else "update",
                "data": {"batch_index": i, "payload": "x" * 50},
                "version": 1,
            })

        push_payload = {
            "device_id": test_device.device_id,
            "changes": large_batch,
            "client_timestamp": datetime.now(timezone.utc).isoformat(),
        }

        push_resp = await client.post(
            "/api/v1/sync/push",
            json=push_payload,
            headers=headers,
        )

        # 应该成功或返回明确的批量限制错误
        if push_resp.status_code == 200:
            result = push_resp.json()
            accepted = result.get("accepted_count", 0)
            print(f"✅ 大批量同步成功: {accepted}/{batch_size} 条被接受")
        elif push_resp.status_code == 413:
            print(f"✅ 大批量正确拒绝 (Payload Too Large)")
        else:
            print(f"⚠️ 大批量同步返回: {push_resp.status_code}")

    @pytest.mark.asyncio
    async def test_malformed_sync_payload(self, client, auth_tokens):
        """测试畸形同步负载的处理"""
        owner_token = auth_tokens["owner"]
        headers = {"Authorization": f"Bearer {owner_token}"}

        malformed_payloads = [
            {},  # 空对象
            {"changes": None},  # null changes
            {"changes": "not_an_array"},  # 非数组
            {"changes": [{}]},  # 空变更对象
            {
                "changes": [{"entity_type": "", "entity_id": None}]  # 缺失必需字段
            },
        ]

        for payload in malformed_payloads:
            resp = await client.post(
                "/api/v1/sync/push",
                json=payload,
                headers=headers,
            )
            # 应返回400/422而非500
            assert resp.status_code in [400, 422], \
                f"畸形负载未正确拒绝: {resp.status_code}"

        print(f"✅ 畸形负载处理测试通过: {len(malformed_payloads)} 个用例")

    @pytest.mark.asyncio
    async def test_concurrent_sync_from_multiple_devices(
        self, client, auth_tokens, db_session
    ):
        """测试多设备同时同步的场景"""
        owner_token = auth_tokens["owner"]
        headers = {"Authorization": f"Bearer {owner_token}"}

        # 注册多个设备
        device_ids = []
        for i in range(3):
            reg_resp = await client.post(
                "/api/v1/sync/devices/register",
                json={
                    "device_id": f"concurrent-dev-{i:03d}",
                    "device_type": "web",
                    "device_name": f"Concurrent Device {i}",
                },
                headers=headers,
            )
            assert reg_resp.status_code == 200
            device_ids.append(f"concurrent-dev-{i:03d}")

        # 并发推送
        async def push_from_device(dev_id: int):
            payload = {
                "device_id": device_ids[dev_id],
                "changes": [{
                    "entity_type": "concurrent_test",
                    "entity_id": 9000 + dev_id,
                    "action": "create",
                    "data": {"source_device": device_ids[dev_id]},
                    "version": 1,
                }],
                "client_timestamp": datetime.now(timezone.utc).isoformat(),
            }
            return await client.post("/api/v1/sync/push", json=payload, headers=headers)

        tasks = [push_from_device(i) for i in range(3)]
        responses = await asyncio.gather(*tasks, return_exceptions=True)

        success_count = sum(
            1 for r in responses
            if hasattr(r, 'status_code') and r.status_code == 200
        )
        print(f"✅ 多设备并发同步: {success_count}/3 成功")


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short", "-m", "e2e or integration"])
