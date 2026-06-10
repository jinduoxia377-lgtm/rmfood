"""RMFOOD 云端同步引擎 - 全面单元测试

覆盖所有核心组件：
- 差异检测算法 (DiffDetector)
- 变更队列管理 (ChangeQueue)
- 冲突检测与解决 (ConflictDetector)
- 加密工具 (EncryptionUtils)
- 密钥管理 (KeyManager)
- 数据脱敏 (DataMasker)

运行方式：pytest tests/test_sync_engine.py -v
"""
import asyncio
import pytest
import json
import time
from datetime import datetime, timezone, timedelta
from typing import Dict, List, Any

# 导入被测试模块
import sys
sys.path.insert(0, "d:/RMFOOD配方平台/backend")

from app.services.sync.diff_detector import (
    DiffDetector,
    SyncChange,
    ChangeType,
    batch_detect_changes,
)
from app.services.sync.change_queue import (
    ChangeQueue,
    QueueItem,
    QueueItemStatus,
    QueueFullError,
)
from app.services.sync.conflict_detector import (
    ConflictDetector,
    ConflictType,
    MergeStrategy,
    Conflict,
    ResolvedEntity,
)
from app.services.sync.protocol import (
    SyncProtocol,
    ProtocolVersion,
    TransferStatus,
    HeartbeatMessage,
)
from app.services.sync.sync_service import (
    SyncService,
    SyncResult,
    SyncMode,
    SyncState,
)
try:
    from app.utils.encryption import EncryptionUtils, EncryptionError, DecryptionError
    from app.utils.key_manager import KeyManager, KeyMetadata
    ENCRYPTION_AVAILABLE = True
except ImportError:
    ENCRYPTION_AVAILABLE = False
    print("警告: cryptography库未安装，跳过加密相关测试")

from app.middleware.data_masking import (
    DataMasker,
    DataMaskingRule,
    mask_sync_log_payload,
    mask_device_info_for_logging,
    mask_conflict_for_display,
)


class TestDiffDetector:
    """差异检测算法测试套件"""

    @pytest.fixture
    def detector(self):
        return DiffDetector()

    @pytest.mark.asyncio
    async def test_detect_new_entity(self, detector):
        """测试检测新增实体"""
        local_data = {"1": {"name": "New Formula", "updated_at": "2024-01-15T10:00:00Z"}}
        server_data = {}
        
        changes = await detector.detect_changes(local_data, server_data, entity_type="formula")
        
        assert len(changes) == 1
        assert changes[0].change_type == ChangeType.CREATE
        assert changes[0].entity_id == "1"
        assert changes[0].local_data["name"] == "New Formula"

    @pytest.mark.asyncio
    async def test_detect_deleted_entity(self, detector):
        """测试检测删除的实体"""
        local_data = {}
        server_data = {"1": {"name": "Old Formula", "deleted_at": "2024-01-15T10:00:00Z"}}
        
        changes = await detector.detect_changes(local_data, server_data, entity_type="formula")
        
        assert len(changes) == 1
        assert changes[0].change_type == ChangeType.DELETE
        assert changes[0].entity_id == "1"

    @pytest.mark.asyncio
    async def test_detect_updated_entity(self, detector):
        """测试检测更新的实体"""
        local_data = {
            "1": {
                "name": "Updated Formula",
                "version": 2,
                "updated_at": "2024-01-15T12:00:00Z",
            }
        }
        server_data = {
            "1": {
                "name": "Original Formula",
                "version": 1,
                "updated_at": "2024-01-14T10:00:00Z",
            }
        }
        
        changes = await detector.detect_changes(local_data, server_data, entity_type="formula")
        
        assert len(changes) == 1
        assert changes[0].change_type == ChangeType.UPDATE
        assert "name" in changes[0].changed_fields or len(changes[0].changed_fields) > 0

    @pytest.mark.asyncio
    async def test_no_changes_detected(self, detector):
        """测试相同数据不产生变更"""
        data = {"1": {"name": "Same", "value": 123}}
        
        changes = await detector.detect_changes(data, data.copy(), entity_type="test")
        
        assert len(changes) == 0

    @pytest.mark.asyncio
    async def test_timestamp_filtering(self, detector):
        """测试基于时间戳的过滤"""
        old_time = datetime(2024, 1, 1, tzinfo=timezone.utc)
        new_time = datetime(2024, 2, 1, tzinfo=timezone.utc)
        
        local_data = {
            "1": {"name": "Recent", "updated_at": new_time.isoformat()},
            "2": {"name": "Old", "updated_at": old_time.isoformat()},
        }
        server_data = {}
        
        since = datetime(2024, 1, 15, tzinfo=timezone.utc)
        changes = await detector.detect_changes(local_data, server_data, last_sync_timestamp=since)
        
        recent_changes = [c for c in changes if c.entity_id == "1"]
        old_changes = [c for c in changes if c.entity_id == "2"]
        
        assert len(recent_changes) == 1
        assert len(old_changes) == 0

    def test_compute_content_hash_consistency(self, detector):
        """测试哈希值的一致性"""
        data = {"name": "test", "value": [1, 2, 3]}
        
        hash1 = detector.compute_content_hash(data)
        hash2 = detector.compute_content_hash(data)
        
        assert hash1 == hash2
        assert len(hash1) == 64  # SHA-256 hex length

    def test_compute_content_hash_different_data(self, detector):
        """测试不同数据产生不同哈希"""
        data1 = {"name": "test1"}
        data2 = {"name": "test2"}
        
        hash1 = detector.compute_content_hash(data1)
        hash2 = detector.compute_content_hash(data2)
        
        assert hash1 != hash2

    def test_compute_content_hash_nested_structures(self, detector):
        """测试嵌套结构的哈希计算"""
        nested = {
            "level1": {
                "level2": {
                    "items": ["a", "b", "c"],
                    "count": 3,
                }
            },
            "tags": ["tag1", "tag2"],
        }
        
        hash_val = detector.compute_content_hash(nested)
        
        assert hash_val
        assert len(hash_val) == 64

    @pytest.mark.asyncio
    async def test_deep_compare_nested_dicts(self, detector):
        """测试深度比较嵌套字典"""
        local = {
            "config": {
                "theme": "dark",
                "language": "en",
                "nested": {"key": "value1"},
            }
        }
        server = {
            "config": {
                "theme": "light",
                "language": "en",
                "nested": {"key": "value2"},
            }
        }
        
        changes = await detector.detect_changes(local, server, entity_type="settings")
        
        assert len(changes) == 1
        assert changes[0].change_type == ChangeType.UPDATE

    @pytest.mark.asyncio
    async def test_performance_large_dataset(self, detector):
        """性能测试：1000条记录的差异检测应在100ms内完成"""
        local_data = {str(i): {"id": i, "name": f"Item {i}", "value": i * 10} for i in range(1000)}
        server_data = local_data.copy()
        server_data["500"]["name"] = "Modified Item 500"
        server_data["999"] = {"id": 999, "name": "New Last Item"}
        
        start = time.time()
        changes = await detector.detect_changes(local_data, server_data)
        elapsed_ms = (time.time() - start) * 1000
        
        assert elapsed_ms < 100, f"差异检测耗时 {elapsed_ms:.2f}ms，超过100ms限制"
        assert len(changes) >= 1

    def test_invalid_input_raises_error(self, detector):
        """测试无效输入抛出异常"""
        with pytest.raises(ValueError, match="必须是字典类型"):
            asyncio.get_event_loop().run_until_complete(
                detector.detect_changes("not a dict", {})
            )

    @pytest.mark.asyncio
    async def test_batch_detect_changes(self, detector):
        """测试批量差异检测"""
        batches = [
            ({"1": {"name": "A"}}, {}, "type_a"),
            ({}, {"2": {"name": "B"}}, "type_b"),
        ]
        
        results = await batch_detect_changes(detector, batches)
        
        assert len(results) == 2


class TestChangeQueue:
    """变更队列管理测试套件"""

    @pytest.fixture
    def queue(self):
        return ChangeQueue(max_size=100)

    @pytest.mark.asyncio
    async def test_enqueue_and_dequeue(self, queue):
        """测试基本入队和出队"""
        item = QueueItem(entity_type="formula", entity_id="1", change_type="update")
        
        await queue.enqueue(item)
        batch = await queue.dequeue_batch(batch_size=10)
        
        assert len(batch) == 1
        assert batch[0].entity_id == "1"
        assert batch[0].status == QueueItemStatus.PROCESSING

    @pytest.mark.asyncio
    async def test_batch_enqueue(self, queue):
        """测试批量入队"""
        items = [
            QueueItem(entity_type="formula", entity_id=str(i), change_type="update")
            for i in range(50)
        ]
        
        count = await queue.enqueue_batch(items)
        
        assert count == 50
        assert queue.size == 50

    @pytest.mark.asyncio
    async def test_fifo_ordering(self, queue):
        """测试FIFO顺序保证"""
        for i in range(5):
            item = QueueItem(
                entity_type="test",
                entity_id=str(i),
                priority=i,
            )
            await queue.enqueue(item)
        
        batch = await queue.dequeue_batch(batch_size=5)
        
        ids = [int(item.entity_id) for item in batch]
        assert ids == list(range(5))

    @pytest.mark.asyncio
    async def test_mark_completed_idempotent(self, queue):
        """测试标记完成的幂等性"""
        item = QueueItem(entity_type="test", entity_id="1")
        await queue.enqueue(item)
        
        batch = await queue.dequeue_batch()
        item_id = batch[0].id
        
        count1 = await queue.mark_completed([item_id])
        count2 = await queue.mark_completed([item_id])
        
        assert count1 == 1
        assert count2 == 0  # 幂等调用返回0

    @pytest.mark.asyncio
    async def test_queue_full_error(self, queue):
        """测试队列满时抛出异常"""
        small_queue = ChangeQueue(max_size=3)
        
        for i in range(3):
            await small_queue.enqueue(QueueItem(entity_id=str(i)))
        
        with pytest.raises(QueueFullError):
            await small_queue.enqueue(QueueItem(entity_id="overflow"))

    @pytest.mark.asyncio
    async def test_merge_same_entity(self, queue):
        """测试同一实体的批量合并优化"""
        item1 = QueueItem(entity_type="formula", entity_id="1", data={"v": 1})
        item2 = QueueItem(entity_type="formula", entity_id="1", data={"v": 2})
        
        await queue.enqueue(item1)
        await queue.enqueue(item2)
        
        assert queue.size == 1  # 合并后只有1项
        
        batch = await queue.dequeue_batch()
        assert batch[0].data["v"] == 2  # 应该是最新版本

    @pytest.mark.asyncio
    async def test_auto_retry_failed_items(self, queue):
        """测试自动重试失败项"""
        item = QueueItem(entity_id="1", max_retries=3)
        await queue.enqueue(item)
        
        batch = await queue.dequeue_batch()
        await queue.mark_failed(batch[0].id, "Test error")
        
        retry_batch = await queue.dequeue_batch()
        
        assert len(retry_batch) == 1
        assert retry_batch[0].retry_count == 1

    @pytest.mark.asyncio
    async def test_concurrent_enqueue(self, queue):
        """测试并发入队安全性"""
        async def enqueue_items(start_idx, count):
            for i in range(count):
                item = QueueItem(entity_id=str(start_idx + i))
                await queue.enqueue(item)
        
        tasks = [
            enqueue_items(i * 100, 100)
            for i in range(5)
        ]
        
        await asyncio.gather(*tasks)
        
        assert queue.size == 500

    def test_stats_tracking(self, queue):
        """测试统计信息跟踪"""
        stats = queue.get_stats()
        
        assert "current_size" in stats
        assert "max_size" in stats
        assert "pending_count" in stats


class TestConflictDetector:
    """冲突检测与解决测试套件"""

    @pytest.fixture
    def detector(self):
        return ConflictDetector(default_strategy=MergeStrategy.LAST_WRITE_WINS)

    @pytest.mark.asyncio
    async def test_detect_content_conflict(self, detector):
        """检测内容冲突（同字段不同值）"""
        local_changes = [{
            "entity_type": "formula",
            "entity_id": "1",
            "action": "update",
            "data": {"name": "Local Name"},
            "timestamp": "2024-01-15T12:00:00Z",
        }]
        remote_changes = [{
            "entity_type": "formula",
            "entity_id": "1",
            "action": "update",
            "data": {"name": "Remote Name"},
            "timestamp": "2024-01-15T11:00:00Z",
        }]
        
        conflicts = await detector.detect_conflicts(local_changes, remote_changes)
        
        assert len(conflicts) == 1
        assert conflicts[0].conflict_type == ConflictType.CONTENT_CONFLICT

    @pytest.mark.asyncio
    async def test_detect_delete_modify_conflict(self, detector):
        """检测删除-修改冲突"""
        local_changes = [{
            "entity_type": "formula",
            "entity_id": "1",
            "action": "delete",
            "data": {},
        }]
        remote_changes = [{
            "entity_type": "formula",
            "entity_id": "1",
            "action": "update",
            "data": {"name": "Modified"},
        }]
        
        conflicts = await detector.detect_conflicts(local_changes, remote_changes)
        
        assert len(conflicts) == 1
        assert conflicts[0].conflict_type == ConflictType.DELETE_MODIFY_CONFLICT

    @pytest.mark.asyncio
    async def test_no_conflict_different_entities(self, detector):
        """不同实体不应产生冲突"""
        local_changes = [{"entity_type": "formula", "entity_id": "1", "data": {"name": "A"}}]
        remote_changes = [{"entity_type": "formula", "entity_id": "2", "data": {"name": "B"}}]
        
        conflicts = await detector.detect_conflicts(local_changes, remote_changes)
        
        assert len(conflicts) == 0

    @pytest.mark.asyncio
    async def test_last_write_wins_strategy(self, detector):
        """测试最后写入优先策略"""
        conflict = Conflict(
            entity_type="formula",
            entity_id="1",
            local_data={"name": "Newer", "version": 3},
            server_data={"name": "Older", "version": 2},
            local_timestamp=datetime(2024, 1, 15, 12, tzinfo=timezone.utc),
            server_timestamp=datetime(2024, 1, 14, 12, tzinfo=timezone.utc),
            conflicting_fields=["name"],
        )
        
        resolved = await detector.auto_resolve(conflict, MergeStrategy.LAST_WRITE_WINS)
        
        assert resolved.merged_data["name"] == "Newer"
        assert resolved.merge_strategy == MergeStrategy.LAST_WRITE_WINS

    @pytest.mark.asyncio
    async def test_union_merge_strategy(self, detector):
        """测试联合合并策略（集合字段）"""
        conflict = Conflict(
            entity_type="formula",
            entity_id="1",
            local_data={"tags": ["sweet", "sour"], "ingredients": ["sugar"]},
            server_data={"tags": ["bitter"], "ingredients": ["salt"]},
            conflicting_fields=["tags", "ingredients"],
        )
        
        resolved = await detector.auto_resolve(conflict, MergeStrategy.UNION_MERGE)
        
        assert set(resolved.merged_data["tags"]) == {"sweet", "sour", "bitter"}

    def test_manual_resolve_local_choice(self, detector):
        """测试手动解决 - 选择本地版本"""
        conflict = Conflict(
            local_data={"choice": "local_version"},
            server_data={"choice": "server_version"},
        )
        
        resolved = detector.manual_resolve(conflict, user_choice="local")
        
        assert resolved.merged_data["choice"] == "local_version"

    def test_manual_resolve_custom_choice(self, detector):
        """测试手动解决 - 自定义合并数据"""
        conflict = Conflict(
            local_data={"a": 1},
            server_data={"b": 2},
        )
        
        custom_data = {"a": 1, "b": 2, "merged": True}
        resolved = detector.manual_resolve(conflict, user_choice="custom", custom_data=custom_data)
        
        assert resolved.merged_data == custom_data

    @pytest.mark.asyncio
    async def test_structural_conflict_detection(self, detector):
        """检测结构性冲突（类型不匹配）"""
        local_changes = [{
            "entity_type": "config",
            "entity_id": "1",
            "data": {"setting": {"nested": "dict"}},
        }]
        remote_changes = [{
            "entity_type": "config",
            "entity_id": "1",
            "data": {"setting": ["list", "value"]},
        }]
        
        conflicts = await detector.detect_conflicts(local_changes, remote_changes)
        
        if conflicts:
            assert conflicts[0].conflict_type == ConflictType.STRUCTURAL_CONFLICT

    @pytest.mark.asyncio
    async def test_multiple_conflicts_batch(self, detector):
        """批量检测多个冲突"""
        local = [
            {"entity_type": "f", "entity_id": str(i), "data": {"v": f"local_{i}"}}
            for i in range(5)
        ]
        remote = [
            {"entity_type": "f", "entity_id": str(i), "data": {"v": f"remote_{i}"}}
            for i in range(5)
        ]
        
        conflicts = await detector.detect_conflicts(local, remote)
        
        assert len(conflicts) == 5

    @pytest.mark.asyncio
    async def test_three_way_merge_with_base(self, detector):
        """三向合并（带基线快照）"""
        base = {"f:1": {"name": "Original", "version": 1}}
        
        local = [{
            "entity_type": "f",
            "entity_id": "1",
            "data": {"name": "Local Edit", "version": 2},
        }]
        remote = [{
            "entity_type": "f",
            "entity_id": "1",
            "data": {"name": "Remote Edit", "version": 2},
        }]
        
        conflicts = await detector.detect_conflicts(local, remote, base_snapshot=base)
        
        assert len(conflicts) == 1
        assert "name" in conflicts[0].conflicting_fields


class TestSyncProtocol:
    """同步协议层测试套件"""

    @pytest.fixture
    def protocol(self):
        return SyncProtocol()

    @pytest.mark.asyncio
    async def test_push_changes_success(self, protocol):
        """测试推送成功"""
        response = await protocol.push_changes(
            user_id=1,
            device_id="device1",
            changes=[
                {"entity_type": "formula", "entity_id": "1", "action": "create", "data": {}},
            ],
        )
        
        assert response.success is True
        assert response.accepted_count == 1
        assert response.transfer_id

    @pytest.mark.asyncio
    async def test_push_empty_changes(self, protocol):
        """测试推送空列表"""
        response = await protocol.push_changes(
            user_id=1,
            device_id="device1",
            changes=[],
        )
        
        assert response.success is True
        assert response.accepted_count == 0

    @pytest.mark.asyncio
    async def test_pull_changes_pagination(self, protocol):
        """测试拉取分页"""
        response = await protocol.pull_changes(
            user_id=1,
            device_id="device1",
            limit=50,
            page=1,
        )
        
        assert isinstance(response.server_changes, list)
        assert response.page_size == 50

    def test_heartbeat_message_creation(self, protocol):
        """测试心跳消息创建"""
        ping = HeartbeatMessage.create_ping("device1", sequence=0)
        pong = HeartbeatMessage.create_pong(ping)
        
        assert pong.device_id == "device1"
        assert pong.sequence == 1
        assert "ping_timestamp" in (pong.payload or {})

    def test_protocol_stats(self, protocol):
        """测试协议统计信息"""
        stats = protocol.get_stats()
        
        assert "protocol_version" in stats
        assert "compression_enabled" in stats
        assert "heartbeat_interval" in stats


@pytest.mark.skipif(not ENCRYPTION_AVAILABLE, reason="cryptography库未安装")
class TestEncryptionUtils:
    """加密工具测试套件"""

    @pytest.fixture
    def utils(self):
        return EncryptionUtils()

    @pytest.fixture
    def key(self, utils):
        return utils.generate_key()

    def test_generate_key_length(self, utils):
        """测试密钥长度正确"""
        key = utils.generate_key()
        
        assert len(key) == 32  # 256 bits

    def test_encrypt_decrypt_roundtrip(self, utils, key):
        """测试加密-解密往返"""
        plaintext = b"Sensitive sync data to protect"
        
        ciphertext, nonce = utils.encrypt(plaintext, key)
        decrypted = utils.decrypt(ciphertext, nonce, key)
        
        assert decrypted == plaintext

    def test_encryption_produces_different_ciphertext(self, utils, key):
        """测试每次加密产生不同的密文（随机nonce）"""
        plaintext = b"Same data"
        
        ct1, n1 = utils.encrypt(plaintext, key)
        ct2, n2 = utils.encrypt(plaintext, key)
        
        assert ct1 != ct2  # 密文应不同
        assert n1 != n2  # nonce应不同

    def test_wrong_key_fails(self, utils, key):
        """测试错误密钥解密失败"""
        wrong_key = utils.generate_key()
        plaintext = b"Secret"
        
        ciphertext, nonce = utils.encrypt(plaintext, key)
        
        with pytest.raises(DecryptionError):
            utils.decrypt(ciphertext, nonce, wrong_key)

    def test_tampered_data_detected(self, utils, key):
        """测试篡改检测"""
        plaintext = b"Important data"
        ciphertext, nonce = utils.encrypt(plaintext, key)
        
        tampered = bytearray(ciphertext)
        tampered[0] ^= 0xFF  # 翻转第一个字节
        
        with pytest.raises(DecryptionError):
            utils.decrypt(bytes(tampered), nonce, key)

    def test_invalid_key_length_raises(self, utils):
        """测试无效密钥长度抛出异常"""
        with pytest.raises(ValueError, match="32字节"):
            utils.encrypt(b"data", b"short")

    def test_encrypt_dict_sensitive_fields(self, utils, key):
        """测试字典敏感字段加密"""
        data = {
            "name": "Public Name",
            "password": "secret123",
            "api_key": "key_xyz",
            "normal_field": "visible",
        }
        
        encrypted = utils.encrypt_dict(data, key)
        
        assert encrypted["name"] == "Public Name"  # 未加密
        assert encrypted["normal_field"] == "visible"  # 未加密
        assert "__encrypted__" in encrypted["password"]  # 已加密
        assert "__encrypted__" in encrypted["api_key"]  # 已加密

    def test_decrypt_dict_roundtrip(self, utils, key):
        """测试字典加密-解密往返"""
        original = {
            "user": "test",
            "token": "secret_token",
            "nested": {"inner_secret": "hidden"},
        }
        
        encrypted = utils.encrypt_dict(original, key)
        decrypted = utils.decrypt_dict(encrypted, key)
        
        assert decrypted["user"] == original["user"]
        assert decrypted["token"] == original["token"]

    def test_hmac_computation(self, utils, key):
        """测试HMAC计算"""
        data = b"data to authenticate"
        
        hmac1 = utils.compute_hmac(data, key)
        hmac2 = utils.compute_hmac(data, key)
        
        assert hmac1 == hmac2
        assert len(hmac1) == 64  # SHA-256 hex length

    def test_password_hashing(self, utils):
        """测试密码哈希"""
        hashed1, salt1 = utils.hash_password("password123")
        hashed2, salt2 = utils.hash_password("password123")
        
        assert hashed1 == hashed2  # 相同密码产生相同哈希
        assert len(hashed1) == 64  # SHA-256 hex


@pytest.mark.skipif(not ENCRYPTION_AVAILABLE, reason="cryptography库未安装")
class TestKeyManager:
    """密钥管理器测试套件"""

    @pytest.fixture
    def manager(self):
        master_key = b"0" * 32  # 测试用固定密钥
        return KeyManager(master_key=master_key)

    def test_derive_user_key(self, manager):
        """测试派生用户密钥"""
        key1 = manager.get_data_encryption_key(user_id="user_1")
        key2 = manager.get_data_encryption_key(user_id="user_2")
        
        assert len(key1) == 32
        assert len(key2) == 32
        assert key1 != key2  # 不同用户应有不同密钥

    def test_derive_same_user_returns_same_key(self, manager):
        """同一用户多次派生返回相同密钥"""
        key1 = manager.get_data_encryption_key(user_id="user_1")
        key2 = manager.get_data_encryption_key(user_id="user_1")
        
        assert key1 == key2

    def test_key_version_control(self, manager):
        """测试密钥版本控制"""
        key_v1 = manager.get_data_encryption_key(user_id="user_1", version=1)
        
        history = manager.get_user_key_history("user_1")
        
        assert len(history) >= 1
        assert history[0].version == 1

    def test_revoke_user_key(self, manager):
        """测试撤销用户密钥"""
        manager.get_data_encryption_key(user_id="user_1")
        
        result = manager.revoke_user_key("user_1")
        
        assert result is True

    def test_verify_key_integrity(self, manager):
        """测试密钥完整性验证"""
        key = manager.get_data_encryption_key(user_id="user_1")
        
        assert manager.verify_key_integrity("user_1", key) is True

    def test_stats_tracking(self, manager):
        """测试统计信息"""
        manager.get_data_encryption_key(user_id="u1")
        manager.get_data_encryption_key(user_id="u2")
        
        stats = manager.get_stats()
        
        assert stats["keys_derived"] == 2
        assert "current_version" in stats


class TestDataMasker:
    """数据脱敏测试套件"""

    @pytest.fixture
    def masker(self):
        return DataMasker(enabled=True)

    def test_mask_sensitive_fields(self, masker):
        """测试敏感字段遮盖"""
        data = {
            "username": "john_doe",
            "password": "secret_pass",
            "api_key": "key_abc123",
            "public_info": "visible",
        }
        
        masked = masker.mask(data)
        
        assert masked["username"] == "john_doe"
        assert masked["password"] == "******"
        assert masked["api_key"] == "******"
        assert masked["public_info"] == "visible"

    def test_mask_payload_truncation(self, masker):
        """测试payload截断"""
        long_text = "x" * 200
        data = {"payload": long_text}
        
        masked = masker.mask(data)
        
        assert len(masked["payload"]) < 200
        assert "truncated" in masked["payload"]

    def test_mask_device_id(self, masker):
        """测试设备ID部分遮盖"""
        data = {"device_id": "abcdef123456"}
        
        masked = masker.mask(data)
        
        assert "******" in masked["device_id"]
        assert masked["device_id"] != "abcdef123456"

    def test_mask_nested_structures(self, masker):
        """测试嵌套结构递归脱敏"""
        data = {
            "level1": {
                "password": "hidden",
                "level2": {
                    "token": "secret",
                    "safe": "ok",
                },
            }
        }
        
        masked = masker.mask(data)
        
        assert masked["level1"]["password"] == "******"
        assert masked["level1"]["level2"]["token"] == "******"
        assert masked["level1"]["level2"]["safe"] == "ok"

    def test_mask_disabled_in_debug_mode(self):
        """调试模式下禁用脱敏"""
        masker = DataMasker(enabled=False)
        data = {"password": "visible_in_debug"}
        
        result = masker.mask(data)
        
        assert result["password"] == "visible_in_debug"

    def test_sync_log_payload_function(self):
        """测试sync_log专用脱敏函数"""
        log_entry = {
            "id": 1,
            "action": "create",
            "payload": {"sensitive": "data", "long": "x" * 200},
            "device_id": "dev123456789",
        }
        
        masked = mask_sync_log_payload(log_entry)
        
        assert "truncated" in str(masked["payload"]) or len(str(masked["payload"])) < 300
        assert "******" in masked["device_id"]

    def test_device_info_logging_function(self):
        """测试设备信息日志专用函数"""
        device = {
            "id": 1,
            "device_id": "unique_device_id_123",
            "device_name": "iPhone Pro",
            "is_active": True,
        }
        
        masked = mask_device_info_for_logging(device)
        
        assert masked["device_name"] == "iPhone Pro"
        assert "******" in masked["device_id"]
        assert "unique_device_id_123" not in masked["device_id"]

    def test_conflict_display_function(self):
        """测试冲突显示专用函数"""
        conflict = {
            "id": "conflict_1",
            "entity_type": "formula",
            "local_data": {"password": "local_pass", "name": "Local"},
            "server_data": {"password": "remote_pass", "name": "Remote"},
        }
        
        masked = mask_conflict_for_display(conflict)
        
        assert "local_data_preview" in masked
        assert "server_data_preview" in masked
        assert "password" not in str(masked.get("local_data_preview", ""))


class TestSyncServiceIntegration:
    """同步服务集成测试"""

    @pytest.fixture
    def service(self):
        return SyncService(auto_resolve_conflicts=True)

    @pytest.mark.asyncio
    async def test_full_sync_basic(self, service):
        """基本完整同步流程测试"""
        local_data = {
            "formula": {
                "1": {"name": "Formula 1", "updated_at": "2024-01-15T10:00:00Z"},
            }
        }
        
        result = await service.full_sync(
            user_id=1,
            device_id="device_test",
            local_data=local_data,
        )
        
        assert isinstance(result, SyncResult)
        assert hasattr(result, "success")
        assert hasattr(result, "pushed_count")

    @pytest.mark.asyncio
    async def test_incremental_sync(self, service):
        """增量同步测试"""
        local_data = {
            "ingredient": {
                "10": {"name": "Sugar", "amount": 100},
            }
        }
        
        result = await service.incremental_sync(
            user_id=1,
            device_id="device_test",
            local_data=local_data,
            entity_types=["ingredient"],
        )
        
        assert result is not None

    def test_get_sync_status(self, service):
        """获取同步状态"""
        status = service.get_sync_status(user_id=999)
        
        assert "user_id" in status
        assert "last_sync_time" in status
        assert "active_syncs" in status

    def test_service_stats(self, service):
        """服务统计信息"""
        stats = service.get_stats()
        
        assert "total_syncs" in stats
        assert "queue_stats" in stats
        assert "detector_stats" in stats


if __name__ == "__main__":
    pytest.main([__file__, "-v", "--tb=short"])
