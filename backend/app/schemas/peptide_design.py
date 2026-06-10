"""RMFOOD 肽设计优化相关 Pydantic 模式

定义肽设计优化项目的创建、更新、响应等数据模式，
包括候选肽序列、版本管理和对比分析等功能。
"""
from datetime import datetime
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field


class PeptideDesignCreate(BaseModel):
    """肽设计项目创建模式"""

    project_name: str = Field(
        ...,
        min_length=1,
        max_length=200,
        description="项目名称",
        example="ACE抑制肽优化设计"
    )
    target_effects: List[str] = Field(
        ...,
        min_length=1,
        description="目标活性类型列表",
        example=["ACE_inhibitory", "antioxidant"]
    )
    objective_weights: Dict[str, float] = Field(
        ...,
        description="目标权重分配",
        example={"ACE_inhibitory": 0.7, "antioxidant": 0.3}
    )
    constraints: Optional[Dict[str, Any]] = Field(
        None,
        description="约束条件，如分子量上限等",
        example={"max_molecular_weight": 1000, "min_hydrophobicity": 0.3}
    )
    seed_sequence: Optional[str] = Field(
        None,
        max_length=50,
        description="种子序列",
        example="AFKDE"
    )


class PeptideDesignUpdate(BaseModel):
    """肽设计项目更新模式（仅允许更新元数据）"""

    project_name: Optional[str] = Field(
        None,
        min_length=1,
        max_length=200,
        description="项目名称",
        example="ACE抑制肽优化设计v2"
    )
    notes: Optional[str] = Field(
        None,
        max_length=1000,
        description="备注信息",
        example="调整了抗氧化活性的权重"
    )
    tags: Optional[List[str]] = Field(
        None,
        description="标签列表",
        example=["高血压", "功能性食品"]
    )


class PeptideDesignCandidateCreate(BaseModel):
    """单个候选肽方案创建模式"""

    sequence: str = Field(
        ...,
        min_length=2,
        max_length=50,
        description="肽序列",
        example="AFKDENVIR"
    )
    objectives_scores: Dict[str, float] = Field(
        ...,
        description="各目标活性得分",
        example={"ACE_inhibitory": 0.85, "antioxidant": 0.72}
    )
    rank: Optional[int] = Field(
        None,
        description="Pareto前沿排名",
        example=1
    )
    is_pareto_frontier: Optional[bool] = Field(
        False,
        description="是否位于Pareto前沿面"
    )
    dominated_by_count: Optional[int] = Field(
        0,
        description="被支配的解的数量",
        example=3
    )
    additional_data: Optional[Dict[str, Any]] = Field(
        None,
        description="附加数据，如理化性质预测值等",
        example={"molecular_weight": 987.5, "isoelectric_point": 5.6}
    )


class PeptideDesignCandidateResponse(BaseModel):
    """候选肽响应模式"""

    id: int = Field(..., description="候选ID")
    design_id: int = Field(..., description="所属设计项目ID")
    sequence: str = Field(..., description="肽序列", example="AFKDENVIR")
    objectives_scores: Dict[str, float] = Field(
        ...,
        description="各目标活性得分",
        example={"ACE_inhibitory": 0.85, "antioxidant": 0.72}
    )
    rank: int = Field(..., description="Pareto排名", example=1)
    is_pareto_frontier: bool = Field(
        ...,
        description="是否位于Pareto前沿面"
    )
    dominated_by_count: int = Field(
        ...,
        description="被支配数量",
        example=0
    )
    additional_data: Optional[Dict[str, Any]] = Field(
        None,
        description="附加数据"
    )
    created_at: datetime = Field(..., description="创建时间")

    model_config = {"from_attributes": True}


class PeptideDesignResponse(BaseModel):
    """肽设计项目完整响应模式"""

    id: int = Field(..., description="项目ID")
    project_name: str = Field(..., description="项目名称")
    user_id: int = Field(..., description="所属用户ID")
    target_effects: List[str] = Field(
        ...,
        description="目标活性类型列表",
        example=["ACE_inhibitory", "antioxidant"]
    )
    objective_weights: Dict[str, float] = Field(
        ...,
        description="目标权重分配",
        example={"ACE_inhibitory": 0.7, "antioxidant": 0.3}
    )
    constraints: Optional[Dict[str, Any]] = Field(
        None,
        description="约束条件"
    )
    seed_sequence: Optional[str] = Field(
        None,
        description="种子序列"
    )
    status: str = Field(
        ...,
        description="项目状态",
        pattern="^(draft|in_progress|completed|archived)$",
        example="in_progress"
    )
    version: int = Field(..., description="当前版本号", example=1)
    parent_version_id: Optional[int] = Field(
        None,
        description="父版本ID"
    )
    total_candidates: int = Field(
        ...,
        description="总候选数",
        example=150
    )
    pareto_size: int = Field(
        ...,
        description="Pareto前沿解集大小",
        example=12
    )
    candidates: List[PeptideDesignCandidateResponse] = Field(
        default_factory=list,
        description="嵌套候选列表"
    )
    created_at: datetime = Field(..., description="创建时间")
    updated_at: datetime = Field(..., description="更新时间")
    archived_at: Optional[datetime] = Field(
        None,
        description="归档时间"
    )

    model_config = {"from_attributes": True}


class PeptideDesignListResponse(BaseModel):
    """肽设计项目列表响应模式"""

    items: List[PeptideDesignResponse] = Field(
        ...,
        description="项目列表"
    )
    total: int = Field(..., description="总数", example=10)
    page: int = Field(..., description="当前页码", example=1)
    page_size: int = Field(
        ...,
        description="每页数量",
        example=20
    )


class VersionInfo(BaseModel):
    """版本信息摘要模式"""

    version: int = Field(..., description="版本号", example=2)
    status: str = Field(
        ...,
        description="版本状态",
        example="completed"
    )
    config_snapshot: Dict[str, Any] = Field(
        ...,
        description="配置快照",
        example={
            "target_effects": ["ACE_inhibitory"],
            "objective_weights": {"ACE_inhibitory": 1.0},
            "constraints": {"max_molecular_weight": 800}
        }
    )
    candidate_count: int = Field(
        ...,
        description="该版本的候选数",
        example=120
    )
    created_at: datetime = Field(..., description="版本创建时间")
    change_summary: Optional[str] = Field(
        None,
        description="变更摘要说明",
        example="增加了抗氧化活性目标，调整了分子量约束"
    )


class ComparisonResult(BaseModel):
    """版本对比结果模式"""

    v1_version: int = Field(
        ...,
        description="对比版本1的版本号",
        example=1
    )
    v2_version: int = Field(
        ...,
        description="对比版本2的版本号",
        example=2
    )
    config_changes: Dict[str, Any] = Field(
        ...,
        description="配置变更差异详情",
        example={
            "added_targets": ["antioxidant"],
            "removed_targets": [],
            "weight_changes": {
                "ACE_inhibitory": {"old": 1.0, "new": 0.7}
            },
            "constraint_changes": {
                "max_molecular_weight": {"old": 1000, "new": 800}
            }
        }
    )
    candidate_changes: Dict[str, Any] = Field(
        ...,
        description="候选集变更统计",
        example={
            "v1_candidates": 150,
            "v2_candidates": 180,
            "pareto_v1": 12,
            "pareto_v2": 18,
            "improved_sequences": ["NEWSEQ1", "NEWSEQ2"]
        }
    )
    summary: str = Field(
        ...,
        description="人类可读的差异描述",
        example="v2相比v1增加了抗氧化目标，Pareto前沿从12个解增加到18个解"
    )
