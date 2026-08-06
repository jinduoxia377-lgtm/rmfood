"""
肽设计优化 CRUD 单元测试

覆盖范围：
- 项目创建（配置验证、初始化）
- 候选方案添加（Pareto计算、统计更新）
- 项目查询（详情加载、权限检查）
- 状态流转（状态机规则验证）
- 版本控制（版本历史、对比）
- 归档操作

运行方式：
    pytest tests/test_peptide_design_crud.py -v --cov=backend/app/services/peptide_design_service
"""

import pytest
from datetime import datetime, timezone
from unittest.mock import AsyncMock, MagicMock

import sys
sys.path.insert(0, 'backend')

from app.services.peptide_design_service import (
    PeptideDesignService,
    VALID_TARGET_EFFECTS,
    VALID_STATUS_TRANSITIONS,
)
from app.schemas.peptide_design import (
    PeptideDesignCreate,
    PeptideDesignCandidateCreate,
)
from app.models.peptide_design import (
    PeptideDesignStatus,
)
from app.core.api_framework.api_contract import NotFoundError, ValidationError as AppValidationError (
    ResourceNotFoundError,
    InvalidStatusTransitionError,
)


class TestTargetEffectsValidation:
    """目标活性类型验证测试"""

    def setup_method(self):
        self.db = MagicMock(spec=AsyncSession)
        self.service = PeptideDesignService(self.db)

    def test_valid_target_effects(self):
        """测试1: 有效的目标活性类型应通过验证"""
        valid_combinations = [
            ["ACE_inhibitory"],
            ["ACE_inhibitory", "antioxidant"],
            list(VALID_TARGET_EFFECTS),  # 全部有效类型
        ]

        for effects in valid_combinations:
            assert self.service.validate_target_effects(effects) is True

    def test_invalid_target_effects(self):
        """测试2: 无效的目标活性类型应返回False"""
        invalid_effects = [
            ["invalid_effect"],
            ["ACE_inhibitory", "nonexistent"],
            [],
        ]

        for effects in invalid_effects:
            assert self.service.validate_target_effects(effects) is False


class TestObjectiveWeightsValidation:
    """目标权重验证测试"""

    def test_valid_weights_sum_to_one(self):
        """权重总和为1.0应通过"""
        valid_weights = [
            {"ACE_inhibitory": 1.0},
            {"ACE_inhibitory": 0.5, "antioxidant": 0.5},
            {"a": 0.3, "b": 0.3, "c": 0.4},
        ]

        for weights in valid_weights:
            assert self.service.validate_objective_weights(weights) is True

    def test_invalid_weights_not_sum_to_one(self):
        """权重总和不等于1.0应失败"""
        invalid_weights = [
            {"ACE_inhibitory": 0.8},  # 总和0.8
            {"ACE_inhibitory": 1.2},  # 超过1.0
            {"a": 0.4, "b": 0.3},  # 总和0.7
        ]

        for weights in invalid_weights:
            result = self.service.validate_objective_weights(weights)
            assert result is False, f"权重 {weights} 应该失败"

    def test_invalid_weights_out_of_range(self):
        """权重值超出[0,1]范围应失败"""
        out_of_range = [
            {"ACE_inhibitory": -0.5},
            {"ACE_inhibitory": 1.5},
            {"a": 2.0, "b": -1.0},
        ]

        for weights in out_of_range:
            result = self.service.validate_objective_weights(weights)
            assert result is False


class TestParetoFrontierCalculation:
    """Pareto前沿算法测试"""

    @pytest.mark.asyncio
    async def test_pareto_frontier_identification(self):
        """正确识别Pareto前沿候选"""
        service = PeptideDesignService(MagicMock())

        class FakeCandidate:
            def __init__(self, seq, scores):
                self.sequence = seq
                self.objectives_scores = scores
                self.rank = 0
                self.is_pareto_frontier = False
                self.dominated_by_count = 0

        candidates = [
            FakeCandidate("A", {"score1": 0.9, "score2": 0.9}),  # 最优解
            FakeCandidate("B", {"score1": 0.8, "score2": 0.6}),  # 被A支配
            FakeCandidate("C", {"score1": 0.5, "score2": 0.95}),  # 非支配（score2最优）
            FakeCandidate("D", {"score1": 0.3, "score2": 0.3}),  # 被所有支配
        ]

        await service.compute_pareto_frontier(candidates)

        pareto_frontier = [c for c in candidates if c.is_pareto_frontier]
        assert len(pareto_frontier) == 2  # A和C应在前沿上
        assert candidates[0].is_pareto_frontier is True  # A
        assert candidates[2].is_pareto_frontier is True  # C
        assert candidates[1].is_pareto_frontier is False  # B被A支配
        assert candidates[3].dominated_by_count > 0  # D被多个支配

    @pytest.mark.asyncio
    async def test_single_candidate_always_pareto(self):
        """单个候选总是Pareto前沿"""
        service = PeptideDesignService(MagicMock())

        class FakeCandidate:
            def __init__(self):
                self.sequence = "ONLY"
                self.objectives_scores = {"score": 0.5}
                self.rank = 0
                self.is_pareto_frontier = False
                self.dominated_by_count = 0

        candidate = [FakeCandidate()]
        await service.compute_pareto_frontier(candidate)

        assert candidate[0].is_pareto_frontier is True
        assert candidate[0].rank == 1


class TestProjectCreation:
    """项目创建测试"""

    @pytest.mark.asyncio
    async def test_create_project_with_valid_config(self, mock_db_session):
        """使用合法配置成功创建项目"""
        service = PeptideDesignService(mock_db_session)

        data = PeptideDesignCreate(
            project_name="测试项目",
            target_effects=["ACE_inhibitory", "antioxidant"],
            objective_weights={"ACE_inhibitory": 0.7, "antioxidant": 0.3},
            seed_sequence="VLGYT"
        )

        mock_db_session.add = MagicMock()
        mock_db_session.commit = AsyncMock(return_value=None)
        mock_db_session.refresh = AsyncMock(return_value=None)

        project = await service.create_project(data)

        assert project.project_name == "测试项目"
        assert project.target_effects == ["ACE_inhibitory", "antioxidant"]
        assert project.status == PeptideDesignStatus.DRAFT
        assert project.version == 1
        assert project.total_candidates == 0

    @pytest.mark.asyncio
    async def test_create_project_rejects_invalid_effects(self, mock_db_session):
        """非法目标活性类型应拒绝"""
        service = PeptideDesignService(mock_db_session)

        data = PeptideDesignCreate(
            project_name="无效项目",
            target_effects=["nonexistent_effect"]
        )

        with pytest.raises(ValueError, match="无效的目标活性类型"):
            await service.create_project(data)


class TestCandidateManagement:
    """候选方案管理测试"""

    @pytest.mark.asyncio
    async def test_add_candidates_auto_status_change(self, mock_db_session, sample_project):
        """首次添加候选应自动将状态改为in_progress"""
        service = PeptideDesignService(mock_db_session)

        candidates_data = [
            PeptideDesignCandidateCreate(
                sequence=f"SEQ{i}",
                objectives_scores={f"obj{j}": 0.5 + i * 0.1 for j in range(3)}
            )
            for i in range(5)
        ]

        # Mock get_project
        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_project
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        mock_db_session.flush = AsyncMock(return_value=None)
        mock_db_session.commit = AsyncMock(return_value=None)

        new_candidates = await service.add_candidates(1, candidates_data)

        assert len(new_candidates) == 5
        # 验证状态已变更（如果原来是draft）
        if sample_project.status == PeptideDesignStatus.DRAFT:
            assert sample_project.status == PeptideDesignStatus.IN_PROGRESS

    @pytest.mark.asyncio
    async def test_add_candidates_exceeds_limit(self, mock_db_session, sample_project):
        """超过50个候选应拒绝"""
        service = PeptideDesignService(mock_db_session)

        too_many = [
            PeptideDesignCandidateCreate(sequence=f"SEQ{i}", objectives_scores={})
            for i in range(51)
        ]

        with pytest.raises(ValueError, match="超过"):
            await service.add_candidates(1, too_many)


class TestStatusTransitions:
    """状态流转测试"""

    def test_valid_transitions(self):
        """合法的状态转换列表"""
        valid_cases = [
            (PeptideDesignStatus.DRAFT, PeptideDesignStatus.IN_PROGRESS),
            (PeptideDesignStatus.DRAFT, PeptideDesignStatus.ARCHIVED),
            (PeptideDesignStatus.IN_PROGRESS, PeptideDesignStatus.COMPLETED),
            (PeptideDesignStatus.IN_PROGRESS, PeptideDesignStatus.DRAFT),
            (PeptideDesignStatus.COMPLETED, PeptideDesignStatus.ARCHIVED),
        ]

        for current, target in valid_cases:
            assert target in VALID_STATUS_TRANSITIONS.get(current, []), \
                f"{current.value} -> {target.value} 应该是合法转换"

    def test_invalid_transitions(self):
        """非法的状态转换"""
        invalid_cases = [
            (PeptideDesignStatus.ARCHIVED, PeptideDesignStatus.DRAFT),  # 不能从归档恢复
            (PeptideDesignStatus.ARCHIVED, PeptideDesignStatus.IN_PROGRESS),
        ]

        for current, target in invalid_cases:
            assert target not in VALID_STATUS_TRANSITIONS.get(current, []), \
                f"{current.value} -> {target.value} 应该是非法转换"

    @pytest.mark.asyncio
    async def test_update_status_success(self, mock_db_session, sample_project):
        """合法状态更新应成功"""
        service = PeptideDesignService(mock_db_session)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_project
        mock_db_session.execute = AsyncMock(return_value=mock_result)
        mock_db_session.commit = AsyncMock(return_value=None)
        mock_db_session.refresh = AsyncMock(return_value=None)

        updated = await service.update_project_status(1, "in_progress")

        assert updated.status == PeptideDesignStatus.IN_PROGRESS
        assert updated.version >= 1  # 版本可能递增

    @pytest.mark.asyncio
    async def test_update_status_invalid_transition_raises_error(self, mock_db_session, archived_project):
        """非法状态转换应抛出异常"""
        service = PeptideDesignService(mock_db_session)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = archived_project
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        with pytest.raises(InvalidStatusTransitionError) as exc_info:
            await service.update_project_status(99, "draft")  # 尝试从archived回到draft

        assert "不允许" in str(exc_info.value)


class TestArchiveOperations:
    """归档操作测试"""

    @pytest.mark.asyncio
    async def test_archive_sets_timestamp(self, mock_db_session, active_project):
        """归档应设置archived_at时间戳"""
        service = PeptideDesignService(mock_db_session)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = active_project
        mock_db_session.execute = AsyncMock(return_value=mock_result)
        mock_db_session.commit = AsyncMock(return_value=None)

        await service.archive_project(1)

        assert active_project.status == PeptideDesignStatus.ARCHIVED
        assert active_project.archived_at is not None


class TestVersionControl:
    """版本控制测试"""

    @pytest.mark.asyncio
    async def test_get_versions_returns_current(self, mock_db_session, sample_project):
        """获取版本历史应包含当前版本信息"""
        service = PeptideDesignService(mock_db_session)

        mock_result = MagicMock()
        mock_result.scalar_one_or_none.return_value = sample_project
        mock_db_session.execute = AsyncMock(return_value=mock_result)

        versions = await service.get_project_versions(1)

        assert len(versions) >= 1
        assert versions[0].version == sample_project.version
        assert versions[0].status == sample_project.status.value


# ===== Fixtures =====

@pytest.fixture
def mock_db_session():
    return MagicMock(spec=AsyncSession)


@pytest.fixture
def sample_project():
    """示例设计项目"""
    class FakeProject:
        id = 1
        project_name = "测试项目"
        user_id = 1
        target_effects = ["ACE_inhibitory"]
        objective_weights = {"ACE_inhibitory": 1.0}
        constraints = None
        seed_sequence = None
        status = PeptideDesignStatus.DRAFT
        version = 1
        parent_version_id = None
        total_candidates = 0
        pareto_size = 0
        created_at = datetime.now(timezone.utc)
        updated_at = datetime.now(timezone.utc)
        archived_at = None
        candidates = []

    return FakeProject()


@pytest.fixture
def active_project():
    """活跃项目（非归档）"""
    class FakeActiveProject:
        id = 2
        status = PeptideDesignStatus.IN_PROGRESS
        version = 3
        archived_at = None
        total_candidates = 10

    return FakeActiveProject()


@pytest.fixture
def archived_project():
    """已归档项目"""
    class FakeArchivedProject:
        id = 99
        status = PeptideDesignStatus.ARCHIVED
        version = 5
        archived_at = datetime.now(timezone.utc)

    return FakeArchivedProject()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
