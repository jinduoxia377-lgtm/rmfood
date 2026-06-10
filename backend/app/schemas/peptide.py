"""RMFOOD 肽相关 Pydantic 模式"""
from typing import Any, Dict, List, Optional
from datetime import datetime
from pydantic import BaseModel, Field


class PeptideBase(BaseModel):
    """肽基础模式"""
    sequence: str = Field(..., min_length=1, max_length=500)
    source_protein: Optional[str] = Field(None, max_length=200)
    source_organism: Optional[str] = Field(None, max_length=200)
    activity_type: Optional[str] = Field(None, max_length=100)
    activity_value: Optional[float] = None
    activity_unit: Optional[str] = Field(None, max_length=50)
    molecular_weight: Optional[float] = None
    dfbp_id: Optional[str] = Field(None, max_length=50)


class PeptideCreate(PeptideBase):
    """肽创建"""
    pass


class PeptideUpdate(BaseModel):
    """肽更新"""
    sequence: Optional[str] = Field(None, min_length=1, max_length=500)
    source_protein: Optional[str] = Field(None, max_length=200)
    source_organism: Optional[str] = Field(None, max_length=200)
    activity_type: Optional[str] = Field(None, max_length=100)
    activity_value: Optional[float] = None
    activity_unit: Optional[str] = Field(None, max_length=50)
    molecular_weight: Optional[float] = None
    dfbp_id: Optional[str] = Field(None, max_length=50)


class PeptideResponse(PeptideBase):
    """肽响应"""
    id: int
    created_at: str

    # 新增统计字段（数据库集成扩展）
    analysis_count: int = Field(default=0, description="关联分析次数")
    last_analysis_at: Optional[datetime] = Field(None, description="最后分析时间")
    design_usage_count: int = Field(default=0, description="被设计使用的次数")

    model_config = {"from_attributes": True}


class PeptideListResponse(BaseModel):
    """肽列表响应"""
    items: list[PeptideResponse]
    total: int
    page: int
    page_size: int


# ===== 批量导入支持 =====

class PeptideBatchCreateItem(BaseModel):
    """单条批量导入项"""
    sequence: str = Field(..., min_length=1, max_length=500)
    source_protein: Optional[str] = None
    source_organism: Optional[str] = None
    activity_type: Optional[str] = None
    activity_value: Optional[float] = None
    activity_unit: Optional[str] = None
    molecular_weight: Optional[float] = None


class PeptideBatchCreate(BaseModel):
    """批量创建请求"""
    items: List[PeptideBatchCreateItem] = Field(..., max_length=100, description="肽列表（最多100条）")


# ===== 通用筛选参数 =====

class AnalysisFilterParams(BaseModel):
    """分析记录筛选参数"""
    search: Optional[str] = Field(None, description="序列关键词搜索")
    activity_type: Optional[str] = Field(None, description="活性类型筛选")
    start_date: Optional[datetime] = Field(None, description="开始日期")
    end_date: Optional[datetime] = Field(None, description="结束日期")
    user_id: Optional[int] = Field(None, description="用户ID筛选")
    sort_by: Optional[str] = Field("created_at", description="排序字段")
    sort_order: Optional[Literal["asc", "desc"]] = "desc"


class DesignFilterParams(BaseModel):
    """设计项目筛选参数"""
    status: Optional[str] = Field(None, description="状态筛选: draft/in_progress/completed/archived")
    target_effects: Optional[List[str]] = Field(None, description="目标活性类型多选")
    start_date: Optional[datetime] = Field(None, description="开始日期")
    end_date: Optional[datetime] = Field(None, description="结束日期")
    user_id: Optional[int] = Field(None, description="用户ID筛选")
    sort_by: Optional[str] = Field("updated_at", description="排序字段")
    sort_order: Optional[Literal["asc", "desc"]] = "desc"
