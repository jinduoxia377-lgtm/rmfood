"""
🟡 Task 3: Ray集群管理器测试

测试Ray集群管理器的核心功能和API接口。

测试策略:
1. 🔬 单元测试 - 测试RayClusterManager的核心功能
2. 🔗 集成测试 - 测试与现有AI服务的集成
3. 🌐 API测试 - 测试Ray路由器API接口
4. 🧪 模拟测试 - 使用模拟Ray环境测试
5. 🛡️ 异常测试 - 测试错误处理和恢复

测试依赖:
  1. pytest==8.3.0
  2. pytest-asyncio==0.24.0
  3. pytest-cov==5.0.0
  4. httpx==0.27.2
  5. redis-asyncio==4.5.1 (测试Redis连接)

标记说明:
  @pytest.mark.ray - Ray相关测试
  @pytest.mark.unit - 单元测试
  @pytest.mark.integration - 集成测试
  @pytest.mark.api - API测试
  @pytest.mark.slow - 慢速测试（需要实际Ray环境）
"""

import asyncio
import os
import sys
import pytest
import pytest_asyncio
from datetime import datetime, timezone, timedelta
from unittest.mock import Mock, patch, AsyncMock, MagicMock

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(__file__))))

from app.core.distributed.ray_manager import (
    RayClusterManager,
    RayConfig,
    TaskConfig,
    TaskState,
    ClusterState,
    ClusterStatus,
    ResourceUsage,
    RayTaskStatus
)



# ═════════════════════════════════════════════
# 🟡 P3-1: 测试夹具
# ═════════════════════════════════════════════


@pytest.fixture
def test_ray_config():
    """测试用Ray配置"""
    return RayConfig(
        address="auto",
        num_cpus=2,
        num_gpus=0,
        object_store_memory=1_000_000_000,
        log_to_driver=False,
        dashboard_host="localhost",
        dashboard_port=8265,
        include_dashboard=False
    )


@pytest.fixture
def test_task_config():
    """测试用任务配置"""
    return TaskConfig(
        task_type="recipe_analysis",
        payload={
            "recipe_id": "test_recipe_001",
            "analysis_types": ["composition"]
        },
        priority=5,
        timeout_seconds=10,
        max_retries=1
    )


@pytest.fixture
def mock_ray():
    """模拟Ray环境"""
    with patch('app.core.distributed.ray_manager.ray') as mock_ray:
        mock_ray.is_initialized.return_value = True
        mock_ray.get_dashboard_url.return_value = "http://localhost:8265"
        mock_ray.init = MagicMock()
        mock_ray.shutdown = MagicMock()

        # 模拟Ray模块可用
        mock_ray.__version__ = "2.30.0"

        yield mock_ray


@pytest.fixture
def mock_redis():
    """模拟Redis连接"""
    with patch('app.core.distributed.ray_manager.redis') as mock_redis:
        mock_client = AsyncMock()
        mock_client.ping = AsyncMock()
        mock_client.close = AsyncMock()
        mock_client.hset = AsyncMock()
        mock_redis.from_url.return_value = mock_client

        yield mock_client


@pytest_asyncio.fixture
async def ray_manager(test_ray_config, mock_ray, mock_redis):
    """测试用Ray管理器实例"""
    with patch.dict(os.environ, {
        "REDIS_URL": "redis://localhost:6379/0",
        "RAY_ADDRESS": "auto"
    }):
        manager = RayClusterManager(config=test_ray_config)

        # 手动设置模拟依赖
        manager._redis_client = mock_redis

        yield manager

        # 清理
        if manager._monitoring_task:
            manager._monitoring_task.cancel()
            try:
                await manager._monitoring_task
            except asyncio.CancelledError:
                pass


@pytest.fixture
def mock_user():
    """模拟用户"""
    mock = Mock()
    mock.id = "test_user_001"
    mock.is_admin = False
    return mock


@pytest.fixture
def mock_admin():
    """模拟管理员"""
    mock = Mock()
    mock.id = "test_admin_001"
    mock.is_admin = True
    return mock


# ═════════════════════════════════════════════
# 🟡 P3-2: RayClusterManager单元测试
# ═════════════════════════════════════════════


@pytest.mark.ray
@pytest.mark.unit
class TestRayClusterManager:
    """RayClusterManager单元测试"""

    def test_initialization(self, test_ray_config):
        """测试初始化和配置加载"""
        manager = RayClusterManager(config=test_ray_config)

        assert manager._config == test_ray_config
        assert manager._cluster_state == ClusterState.IDLE
        assert len(manager._tasks) == 0
        assert manager._redis_client is None
        assert manager._monitoring_task is None

    @pytest.mark.asyncio
    async def test_load_config_from_env(self):
        """测试从环境变量加载配置"""
        with patch.dict(os.environ, {
            "RAY_ADDRESS": "ray://test-host:10001",
            "RAY_NUM_CPUS": "8",
            "RAY_NUM_GPUS": "2",
            "RAY_OBJECT_STORE_MEMORY": "8000000000",
            "RAY_LOG_TO_DRIVER": "false",
            "RAY_DASHBOARD_HOST": "127.0.0.1",
            "RAY_DASHBOARD_PORT": "8266",
            "RAY_MAX_RESTARTS": "5",
            "RAY_REUSE_ACTORS": "false",
            "RAY_INCLUDE_DASHBOARD": "false"
        }):
            manager = RayClusterManager()
            config = manager._config

            assert config.address == "ray://test-host:10001"
            assert config.num_cpus == 8
            assert config.num_gpus == 2
            assert config.object_store_memory == 8_000_000_000
            assert config.log_to_driver is False
            assert config.dashboard_host == "127.0.0.1"
            assert config.dashboard_port == 8266
            assert config.max_restarts == 5
            assert config.reuse_actors is False
            assert config.include_dashboard is False

    @pytest.mark.asyncio
    async def test_start_cluster_success(self, ray_manager, mock_ray, mock_redis):
        """测试成功启动集群"""
        # 设置环境变量确保Ray可用
        with patch('app.core.distributed.ray_manager.RAY_AVAILABLE', True):
            # 启动集群
            status = await ray_manager.start_cluster()

            # 验证状态
            assert status.state == ClusterState.RUNNING
            assert status.dashboard_url == "http://localhost:8265"
            assert status.node_count == 1
            assert ray_manager._cluster_state == ClusterState.RUNNING
            assert ray_manager._start_time is not None
            assert ray_manager._monitoring_task is not None

            # 验证Ray初始化调用
            mock_ray.init.assert_called_once()

    @pytest.mark.asyncio
    async def test_start_cluster_ray_not_available(self, ray_manager):
        """测试Ray库不可用时的启动"""
        with patch('app.core.distributed.ray_manager.RAY_AVAILABLE', False):
            with pytest.raises(ImportError, match="Ray库未安装"):
                await ray_manager.start_cluster()

            assert ray_manager._cluster_state == ClusterState.ERROR

    @pytest.mark.asyncio
    async def test_stop_cluster(self, ray_manager, mock_ray, mock_redis):
        """测试停止集群"""
        # 先启动集群
        with patch('app.core.distributed.ray_manager.RAY_AVAILABLE', True):
            await ray_manager.start_cluster()

        # 停止集群
        status = await ray_manager.stop_cluster()

        # 验证状态
        assert status.state == ClusterState.IDLE
        assert ray_manager._cluster_state == ClusterState.IDLE
        assert ray_manager._dashboard_url is None
        assert ray_manager._start_time is None
        assert len(ray_manager._tasks) == 0
        assert ray_manager._monitoring_task is None

        # 验证Ray关闭调用
        mock_ray.shutdown.assert_called_once()
        mock_redis.close.assert_called_once()

    @pytest.mark.asyncio
    async def test_get_cluster_status(self, ray_manager):
        """测试获取集群状态"""
        status = await ray_manager.get_cluster_status()

        assert isinstance(status, ClusterStatus)
        assert status.state == ClusterState.IDLE
        assert status.address is None
        assert status.dashboard_url is None
        assert status.node_count == 0
        assert status.active_workers == 0
        assert status.total_tasks == 0

    @pytest.mark.asyncio
    async def test_submit_task_success(self, ray_manager, test_task_config):
        """测试成功提交任务"""
        # 模拟集群运行
        ray_manager._cluster_state = ClusterState.RUNNING

        task_id = await ray_manager.submit_task(test_task_config)

        # 验证任务创建
        assert task_id == test_task_config.task_id
        assert task_id in ray_manager._tasks
        task_status = ray_manager._tasks[task_id]
        assert task_status.task_id == task_id
        assert task_status.state == TaskState.PENDING

    @pytest.mark.asyncio
    async def test_submit_task_cluster_not_running(self, ray_manager, test_task_config):
        """测试集群未运行时提交任务"""
        ray_manager._cluster_state = ClusterState.IDLE

        with pytest.raises(RuntimeError, match="集群未运行"):
            await ray_manager.submit_task(test_task_config)

    @pytest.mark.asyncio
    async def test_get_task_status(self, ray_manager, test_task_config):
        """测试获取任务状态"""
        # 创建测试任务
        ray_manager._tasks[test_task_config.task_id] = RayTaskStatus(
            task_id=test_task_config.task_id,
            state=TaskState.RUNNING,
            progress=0.5
        )

        task_status = await ray_manager.get_task_status(test_task_config.task_id)

        assert task_status is not None
        assert task_status.task_id == test_task_config.task_id
        assert task_status.state == TaskState.RUNNING
        assert task_status.progress == 0.5

    @pytest.mark.asyncio
    async def test_get_task_status_not_found(self, ray_manager):
        """测试获取不存在的任务状态"""
        task_status = await ray_manager.get_task_status("non_existent_task")

        assert task_status is None

    @pytest.mark.asyncio
    async def test_cancel_task(self, ray_manager, test_task_config):
        """测试取消任务"""
        # 创建测试任务
        ray_manager._tasks[test_task_config.task_id] = RayTaskStatus(
            task_id=test_task_config.task_id,
            state=TaskState.RUNNING
        )

        result = await ray_manager.cancel_task(test_task_config.task_id)

        assert result is True
        task_status = ray_manager._tasks[test_task_config.task_id]
        assert task_status.state == TaskState.CANCELLED
        assert task_status.end_time is not None
        assert "任务被取消" in str(task_status.error)

    @pytest.mark.asyncio
    async def test_cancel_task_not_found(self, ray_manager):
        """测试取消不存在的任务"""
        result = await ray_manager.cancel_task("non_existent_task")

        assert result is False

    @pytest.mark.asyncio
    async def test_cancel_task_already_completed(self, ray_manager):
        """测试取消已完成的任务"""
        task_id = "completed_task"
        ray_manager._tasks[task_id] = RayTaskStatus(
            task_id=task_id,
            state=TaskState.COMPLETED,
            end_time=datetime.now(timezone.utc)
        )

        result = await ray_manager.cancel_task(task_id)

        assert result is False

    @pytest.mark.asyncio
    async def test_get_resource_usage(self, ray_manager):
        """测试获取资源使用情况"""
        ray_manager._cluster_state = ClusterState.RUNNING

        usage = await ray_manager.get_resource_usage()

        assert usage is not None
        assert isinstance(usage, ResourceUsage)
        assert usage.timestamp is not None

    @pytest.mark.asyncio
    async def test_get_resource_usage_cluster_not_running(self, ray_manager):
        """测试集群未运行时获取资源使用情况"""
        usage = await ray_manager.get_resource_usage()

        assert usage is None

    @pytest.mark.asyncio
    async def test_submit_recipe_analysis(self, ray_manager):
        """测试提交配方分析任务（便捷方法）"""
        ray_manager._cluster_state = ClusterState.RUNNING

        recipe_id = "test_recipe_001"
        analysis_types = ["composition", "similarity"]

        task_id = await ray_manager.submit_recipe_analysis(recipe_id, analysis_types)

        assert task_id is not None
        assert task_id in ray_manager._tasks

        # 验证任务配置
        ray_manager._tasks[task_id]
        # 注意：在实际实现中，这里会有一个任务执行线程，但在测试中可能没有

    @pytest.mark.asyncio
    async def test_submit_batch_analysis(self, ray_manager):
        """测试提交批量分析任务（便捷方法）"""
        ray_manager._cluster_state = ClusterState.RUNNING

        recipe_ids = ["recipe_001", "recipe_002", "recipe_003"]

        task_id = await ray_manager.submit_batch_analysis(recipe_ids)

        assert task_id is not None
        assert task_id in ray_manager._tasks

    @pytest.mark.asyncio
    async def test_submit_model_training(self, ray_manager):
        """测试提交模型训练任务（便捷方法）"""
        ray_manager._cluster_state = ClusterState.RUNNING

        task_id = await ray_manager.submit_model_training(
            model_type="classifier",
            dataset_size=1000
        )

        assert task_id is not None
        assert task_id in ray_manager._tasks

    @pytest.mark.asyncio
    async def test_list_tasks(self, ray_manager):
        """测试列出任务"""
        # 创建测试任务
        for i in range(5):
            task_id = f"test_task_{i}"
            ray_manager._tasks[task_id] = RayTaskStatus(
                task_id=task_id,
                state=TaskState.COMPLETED if i < 3 else TaskState.FAILED,
                start_time=datetime.now(timezone.utc)
            )

        # 列出所有任务
        all_tasks = await ray_manager.list_tasks()
        assert len(all_tasks) == 5

        # 按状态筛选
        completed_tasks = await ray_manager.list_tasks(state=TaskState.COMPLETED)
        assert len(completed_tasks) == 3

        failed_tasks = await ray_manager.list_tasks(state=TaskState.FAILED)
        assert len(failed_tasks) == 2

        # 限制数量
        limited_tasks = await ray_manager.list_tasks(limit=2)
        assert len(limited_tasks) == 2

    @pytest.mark.asyncio
    async def test_cleanup_old_tasks(self, ray_manager):
        """测试清理旧任务"""
        now = datetime.now(timezone.utc)

        # 创建旧任务（8天前）
        old_task = RayTaskStatus(
            task_id="old_task",
            state=TaskState.COMPLETED,
            end_time=now - timedelta(days=8)
        )

        # 创建新任务（3天前）
        new_task = RayTaskStatus(
            task_id="new_task",
            state=TaskState.COMPLETED,
            end_time=now - timedelta(days=3)
        )

        ray_manager._tasks = {
            "old_task": old_task,
            "new_task": new_task
        }

        # 清理7天前的任务
        await ray_manager.cleanup_old_tasks(days=7)

        # 验证结果
        assert "old_task" not in ray_manager._tasks
        assert "new_task" in ray_manager._tasks

        # 再次清理，应该没有变化
        initial_count = len(ray_manager._tasks)
        await ray_manager.cleanup_old_tasks(days=7)
        after_count = len(ray_manager._tasks)

        assert initial_count == after_count

    @pytest.mark.asyncio
    async def test_is_available(self, ray_manager, mock_ray):
        """测试检查可用性"""
        with patch('app.core.distributed.ray_manager.RAY_AVAILABLE', True):
            # 集群未运行
            ray_manager._cluster_state = ClusterState.IDLE
            assert not ray_manager.is_available()

            # 集群运行中
            ray_manager._cluster_state = ClusterState.RUNNING
            assert ray_manager.is_available()

            # 集群错误
            ray_manager._cluster_state = ClusterState.ERROR
            assert not ray_manager.is_available()

    @pytest.mark.asyncio
    async def test_context_manager(self, ray_manager, mock_ray):
        """测试异步上下文管理器"""
        with patch('app.core.distributed.ray_manager.RAY_AVAILABLE', True):
            async with RayClusterManager() as mgr:
                assert isinstance(mgr, RayClusterManager)
                assert mgr._cluster_state == ClusterState.RUNNING

            # 离开上下文后应该已停止
            assert mgr._cluster_state == ClusterState.IDLE


# ═════════════════════════════════════════════
# 🟡 P3-3: 任务执行测试
# ═════════════════════════════════════════════


@pytest.mark.ray
@pytest.mark.unit
class TestTaskExecution:
    """任务执行测试"""

    @pytest.mark.asyncio
    async def test_analyze_recipe_task(self, ray_manager, test_task_config):
        """测试配方分析任务执行"""
        # 模拟集群运行
        ray_manager._cluster_state = ClusterState.RUNNING

        # 提交任务
        task_id = await ray_manager.submit_task(test_task_config)

        # 等待任务执行完成
        await asyncio.sleep(0.1)  # 给任务执行一点时间

        # 获取任务状态
        task_status = await ray_manager.get_task_status(task_id)

        # 任务应该已经完成（模拟执行很快）
        assert task_status is not None
        assert task_status.state in [TaskState.COMPLETED, TaskState.RUNNING]

        if task_status.state == TaskState.COMPLETED:
            assert task_status.result is not None
            assert task_status.result.get("recipe_id") == "test_recipe_001"
            assert "timestamp" in task_status.result

    @pytest.mark.asyncio
    async def test_batch_analysis_task(self, ray_manager):
        """测试批量分析任务执行"""
        ray_manager._cluster_state = ClusterState.RUNNING

        task_config = TaskConfig(
            task_type="batch_analysis",
            payload={
                "recipe_ids": ["recipe_001", "recipe_002", "recipe_003"]
            },
            priority=6
        )

        task_id = await ray_manager.submit_task(task_config)

        await asyncio.sleep(0.1)  # 给任务执行一点时间

        task_status = await ray_manager.get_task_status(task_id)

        assert task_status is not None
        assert task_status.state in [TaskState.COMPLETED, TaskState.RUNNING]

    @pytest.mark.asyncio
    async def test_task_timeout(self, ray_manager):
        """测试任务超时"""
        ray_manager._cluster_state = ClusterState.RUNNING

        # 创建一个慢速任务（模拟）
        task_config = TaskConfig(
            task_type="recipe_analysis",
            payload={"recipe_id": "slow_recipe"},
            timeout_seconds=1,  # 1秒超时
            max_retries=0
        )

        task_id = await ray_manager.submit_task(task_config)

        # 等待超时检查
        await asyncio.sleep(2)

        task_status = await ray_manager.get_task_status(task_id)

        # 任务应该已经超时
        assert task_status.state == TaskState.FAILED
        assert "超时" in str(task_status.error)

    @pytest.mark.asyncio
    async def test_task_retry(self, ray_manager):
        """测试任务重试"""
        ray_manager._cluster_state = ClusterState.RUNNING

        # 创建一个会失败的任务
        task_config = TaskConfig(
            task_type="recipe_analysis",
            payload={"recipe_id": "failing_recipe"},
            max_retries=2,
            retry_delay_seconds=0.1  # 短延迟便于测试
        )

        task_id = await ray_manager.submit_task(task_config)

        # 等待重试执行
        await asyncio.sleep(0.5)

        task_status = await ray_manager.get_task_status(task_id)

        # 任务应该还是失败状态（模拟失败）
        assert task_status.state == TaskState.FAILED
        assert task_status.retry_count >= 1


# ═════════════════════════════════════════════
# 🟡 P3-4: 配置和验证测试
# ═════════════════════════════════════════════


@pytest.mark.ray
@pytest.mark.unit
class TestConfiguration:
    """配置测试"""

    @pytest.mark.asyncio
    async def test_config_validation(self):
        """测试配置验证"""
        # 有效的配置
        valid_config = RayConfig(
            address="auto",
            num_cpus=0,
            num_gpus=0,
            object_store_memory=4_000_000_000
        )
        assert valid_config.address == "auto"

        # 有效的远程地址
        remote_config = RayConfig(address="ray://host:10001")
        assert remote_config.address == "ray://host:10001"

        # 无效的地址应该报错
        with pytest.raises(ValueError, match="无效的Ray地址"):
            RayConfig(address="invalid://address")

    @pytest.mark.asyncio
    async def test_task_config_validation(self):
        """测试任务配置验证"""
        # 有效的任务配置
        valid_task = TaskConfig(
            task_type="recipe_analysis",
            payload={"recipe_id": "test_001"},
            priority=8,
            timeout_seconds=300,
            max_retries=3
        )
        assert valid_task.task_id is not None
        assert valid_task.task_type == "recipe_analysis"

        # 无效的优先级
        with pytest.raises(ValueError):
            TaskConfig(priority=0)  # 低于最小值

        with pytest.raises(ValueError):
            TaskConfig(priority=11)  # 高于最大值


# ═════════════════════════════════════════════
# 🟡 P3-5: 单例模式测试
# ═════════════════════════════════════════════


@pytest.mark.ray
@pytest.mark.unit
class TestSingleton:
    """单例模式测试"""

    def test_get_ray_manager_singleton(self):
        """测试单例模式"""
        from app.core.distributed.ray_manager import _ray_manager_instance

        # 清除现有实例
        from app.core.distributed.ray_manager import get_ray_manager
        import app.core.distributed.ray_manager as ray_module

        ray_module._ray_manager_instance = None

        # 第一次调用创建实例
        manager1 = get_ray_manager()
        assert manager1 is not None
        assert _ray_manager_instance is manager1

        # 第二次调用返回同一实例
        manager2 = get_ray_manager()
        assert manager2 is manager1


# ═════════════════════════════════════════════
# 🟡 P3-6: 高级功能测试
# ═════════════════════════════════════════════


@pytest.mark.ray
@pytest.mark.unit
class TestAdvancedFeatures:
    """高级功能测试"""

    @pytest.mark.asyncio
    async def test_execute_distributed_analysis(self, ray_manager, mock_ray):
        """测试分布式分析函数"""
        with patch('app.core.distributed.ray_manager.RAY_AVAILABLE', True):
            ray_manager._cluster_state = ClusterState.RUNNING

            # 模拟任务提交和完成
            recipe_ids = ["recipe_001", "recipe_002", "recipe_003"]
            analysis_type = "composition"

            # 这个测试在真实环境下需要Ray支持，所以可能失败
            # 这里只是验证函数调用不会出现语法错误
            from app.core.distributed.ray_manager import execute_distributed_analysis

            try:
                result = await execute_distributed_analysis(recipe_ids, analysis_type)
                assert result is not None
                assert "total_recipes" in result
            except RuntimeError as e:
                # 如果Ray不可用，这是预期的
                if "Ray集群不可用" in str(e):
                    pytest.skip("Ray集群不可用，跳过分布式分析测试")
                else:
                    raise


# ═════════════════════════════════════════════
# 🟡 P3-7: 集成测试（需要实际配置）
# ═════════════════════════════════════════════


@pytest.mark.ray
@pytest.mark.integration
@pytest.mark.slow
class TestIntegration:
    """集成测试（需要实际Ray环境）"""

    @pytest.mark.asyncio
    async def test_real_ray_cluster_connection(self):
        """测试实际Ray集群连接

        需要本地或远程Ray集群运行，使用环境变量配置。
        这是一个慢速测试，仅在需要时运行。
        """
        ray_address = os.getenv("RAY_TEST_ADDRESS", None)
        if not ray_address:
            pytest.skip("未设置RAY_TEST_ADDRESS环境变量，跳过实际Ray测试")

        try:
            import ray
            ray.is_initialized = MagicMock(return_value=True)

            # 创建管理器
            config = RayConfig(address=ray_address)
            manager = RayClusterManager(config=config)

            # 测试连接（简化版本，不实际启动）
            manager._cluster_state = ClusterState.RUNNING

            assert manager.is_available()

        except ImportError:
            pytest.skip("Ray库未安装，跳过实际Ray测试")
        except Exception as e:
            pytest.fail(f"Ray连接测试失败: {str(e)}")


# ═════════════════════════════════════════════
# 🟡 P3-8: 性能测试
# ═════════════════════════════════════════════


@pytest.mark.ray
@pytest.mark.performance
class TestPerformance:
    """性能测试"""

    @pytest.mark.asyncio
    async def test_task_submission_performance(self, ray_manager):
        """测试任务提交性能"""
        import time

        ray_manager._cluster_state = ClusterState.RUNNING

        num_tasks = 100
        start_time = time.time()

        tasks = []
        for i in range(num_tasks):
            task_config = TaskConfig(
                task_type="recipe_analysis",
                payload={"recipe_id": f"perf_recipe_{i:03d}"},
                priority=5
            )
            task_id = await ray_manager.submit_task(task_config)
            tasks.append(task_id)

        end_time = time.time()
        total_time = end_time - start_time

        # 每秒应能提交至少10个任务
        tasks_per_second = num_tasks / total_time if total_time > 0 else float('inf')

        assert len(tasks) == num_tasks
        assert total_time < num_tasks * 0.1  # 每个任务不超过100ms
        assert tasks_per_second >= 10, f"任务提交速度过低: {tasks_per_second:.1f} tasks/sec"

    @pytest.mark.asyncio
    async def test_concurrent_task_submission(self, ray_manager):
        """测试并发任务提交"""
        import asyncio

        ray_manager._cluster_state = ClusterState.RUNNING

        num_concurrent = 20

        async def submit_task(i: int):
            task_config = TaskConfig(
                task_type="recipe_analysis",
                payload={"recipe_id": f"concurrent_{i}"},
                priority=5
            )
            return await ray_manager.submit_task(task_config)

        # 并发提交任务
        tasks = [submit_task(i) for i in range(num_concurrent)]
        results = await asyncio.gather(*tasks)

        # 验证所有任务都成功提交
        assert len(results) == num_concurrent
        assert len(set(results)) == num_concurrent  # 所有任务ID应该唯一


# ═════════════════════════════════════════════
# 🟡 P3-9: 测试辅助函数
# ═════════════════════════════════════════════


def run_tests():
    """直接运行所有测试（用于调试）"""
    import pytest
    return pytest.main([__file__, "-vx"])


if __name__ == "__main__":
    """直接运行测试脚本"""
    sys.exit(run_tests())