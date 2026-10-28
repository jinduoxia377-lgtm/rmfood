"""RMFOOD 肽序列分析相关 Pydantic 模式"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field
from typing_extensions import Literal


class PeptideAnalysisCreate(BaseModel):
    """肽分析创建请求"""

    sequence: str = Field(..., min_length=2, max_length=50, description="肽序列")
    analysis_mode: Literal["quick", "deep", "custom"] = "deep"
    tags: Optional[List[str]] = None
    notes: Optional[str] = Field(None, max_length=1000, description="备注信息")
    peptide_id: Optional[int] = Field(None, description="关联的肽记录ID")


class PeptideAnalysisUpdate(BaseModel):
    """肽分析更新请求（仅允许更新元数据）"""

    tags: Optional[List[str]] = Field(None, description="标签列表")
    notes: Optional[str] = Field(None, max_length=1000, description="备注信息")


class PeptideAnalysisDetailResponse(BaseModel):
    """分析详情响应"""

    id: int
    dimension_type: str = Field(..., description="维度类型: basic/structure/physicochemical/bioactivity/safety/overall")
    data: Dict[str, Any] = Field(..., description="具体数值数据")
    created_at: datetime

    model_config = {"from_attributes": True}


class PeptideAnalysisResponse(BaseModel):
    """肽分析完整响应"""

    id: int
    sequence: str
    user_id: int
    analysis_mode: str
    tags: Optional[List[str]] = None
    notes: Optional[str] = None
    peptide_id: Optional[int] = None
    created_at: datetime
    updated_at: datetime
    details: List[PeptideAnalysisDetailResponse] = Field(default_factory=list, description="7维分析详情列表")

    model_config = {"from_attributes": True}


class PeptideAnalysisListResponse(BaseModel):
    """肽分析分页列表响应"""

    items: List[PeptideAnalysisResponse]
    total: int
    page: int
    page_size: int


class BatchResult(BaseModel):
    """批量操作结果"""

    success_count: int = Field(..., description="成功数量")
    failed_items: List[Dict[str, Any]] = Field(default_factory=list, description="失败项详情")
