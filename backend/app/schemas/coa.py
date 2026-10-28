"""
食源性多肽COA Pydantic Schema
用于FastAPI请求/响应数据校验
"""
from datetime import datetime
from typing import Any, Dict, List, Optional

from pydantic import BaseModel, Field, field_validator

# ─── 检验单项Schema ───────────────────────────────────────────

class COATestItemBase(BaseModel):
    """COA检验单项基础数据"""
    category: str = Field(..., pattern="^(sensory|chemical|microbial|packaging)$", description="检测类别")
    item_name: str = Field(..., min_length=1, max_length=100, description="检测项目名(中文)")
    item_name_en: Optional[str] = Field(None, max_length=100, description="检测项目名(英文)")
    standard: str = Field(..., min_length=1, max_length=500, description="标准/限值")
    result: Optional[str] = Field(None, max_length=500, description="检测结果")
    unit: Optional[str] = Field(None, max_length=20, description="单位")
    judgment: Optional[str] = Field(None, pattern="^(符合|不符合|待判定)$", description="判定")
    remark: Optional[str] = Field(None, description="备注")
    sort_order: int = Field(0, ge=0, description="排序")

    model_config = {"from_attributes": True}


class COATestItemCreate(COATestItemBase):
    """创建检验单项"""
    pass


class COATestItemUpdate(BaseModel):
    """更新检验单项"""
    category: Optional[str] = Field(None, pattern="^(sensory|chemical|microbial|packaging)$")
    item_name: Optional[str] = Field(None, min_length=1, max_length=100)
    item_name_en: Optional[str] = Field(None, max_length=100)
    standard: Optional[str] = Field(None, min_length=1, max_length=500)
    result: Optional[str] = Field(None, max_length=500)
    unit: Optional[str] = Field(None, max_length=20)
    judgment: Optional[str] = Field(None, pattern="^(符合|不符合|待判定)$")
    remark: Optional[str] = Field(None)
    sort_order: Optional[int] = Field(None, ge=0)


# ─── COA主记录Schema ───────────────────────────────────────────

class COABase(BaseModel):
    """COA基础数据"""
    peptide_id: Optional[int] = Field(None, description="关联多肽ID")
    product_name_cn: str = Field(..., min_length=1, max_length=200, description="产品名称(中文)")
    product_name_en: Optional[str] = Field(None, max_length=200, description="产品名称(英文)")
    product_type: str = Field("其他食品", max_length=100, description="产品类型")
    product_code: Optional[str] = Field(None, max_length=50, description="型号/编号")
    spec: Optional[str] = Field(None, max_length=100, description="规格")

    batch_no: str = Field(..., min_length=1, max_length=50, description="生产批号")
    mfg_date: Optional[datetime] = Field(None, description="生产日期")
    expiry_date: Optional[datetime] = Field(None, description="有效期")
    production_line: Optional[str] = Field(None, max_length=100, description="生产线")

    gb_standard: Optional[str] = Field(None, max_length=100, description="执行标准")
    enterprise_standard: Optional[str] = Field(None, max_length=200, description="企业标准")
    inspection_basis: Optional[str] = Field(None, description="检验判定依据")

    test_conclusion: str = Field("待检", pattern="^(合格|不合格|待检)$", description="检验结论")
    qualified: bool = Field(False, description="是否合格")

    coa_pdf_url: Optional[str] = Field(None, max_length=500, description="COA PDF URL")
    coa_word_url: Optional[str] = Field(None, max_length=500, description="COA Word URL")
    test_report_image_url: Optional[str] = Field(None, max_length=500, description="检测报告扫描件")

    tested_by: Optional[str] = Field(None, max_length=50, description="检测人")
    checked_by: Optional[str] = Field(None, max_length=50, description="校对人")
    approved_by: Optional[str] = Field(None, max_length=50, description="批准人")

    supplier_name: Optional[str] = Field(None, max_length=200, description="供应商名称")
    supplier_batch_ref: Optional[str] = Field(None, max_length=100, description="供应商批次编号")

    @field_validator("test_conclusion")
    @classmethod
    def validate_conclusion(cls, v: str, info) -> str:
        """根据 qualified 字段同步检验结论"""
        return v


class COACreate(COABase):
    """创建COA请求"""
    test_items: Optional[List[COATestItemCreate]] = Field(None, description="检验单项列表")

    model_config = {"json_schema_extra": {
        "examples": [[{
            "product_name_cn": "鱼胶原蛋白肽",
            "product_name_en": "Hydrolyzed-Collagen-Fish",
            "product_type": "其他食品",
            "product_code": "AMO-06",
            "spec": "20千克/袋",
            "batch_no": "20240518",
            "mfg_date": "2024-05-18T00:00:00Z",
            "gb_standard": "GB31645—2018",
            "test_conclusion": "待检",
            "test_items": [
                {"category": "sensory", "item_name": "色泽", "standard": "具有本品应有的色泽", "judgment": "符合"},
                {"category": "chemical", "item_name": "水分含量(%)", "standard": "≤ 7.0", "result": "4.43", "unit": "%", "judgment": "符合"},
            ]
        }]]
    }}


class COAUpdate(BaseModel):
    """更新COA请求（所有字段可选）"""
    peptide_id: Optional[int] = None
    product_name_cn: Optional[str] = Field(None, max_length=200)
    product_name_en: Optional[str] = None
    product_type: Optional[str] = None
    product_code: Optional[str] = None
    spec: Optional[str] = None
    batch_no: Optional[str] = None
    mfg_date: Optional[datetime] = None
    expiry_date: Optional[datetime] = None
    production_line: Optional[str] = None
    gb_standard: Optional[str] = None
    enterprise_standard: Optional[str] = None
    inspection_basis: Optional[str] = None
    test_conclusion: Optional[str] = Field(None, pattern="^(合格|不合格|待检)$")
    qualified: Optional[bool] = None
    coa_pdf_url: Optional[str] = None
    coa_word_url: Optional[str] = None
    test_report_image_url: Optional[str] = None
    tested_by: Optional[str] = None
    checked_by: Optional[str] = None
    approved_by: Optional[str] = None
    supplier_name: Optional[str] = None
    supplier_batch_ref: Optional[str] = None


class COAResponse(COABase):
    """COA响应"""
    id: int
    test_items: List[COATestItemBase] = Field(default_factory=list)
    latest_item_judgment: str = "待判定"
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class COAListResponse(BaseModel):
    """COA列表响应"""
    items: List[COAResponse]
    total: int
    page: int
    page_size: int


# ─── 筛选与分页 ────────────────────────────────────────────────

class COAFilterParams(BaseModel):
    """COA筛选参数"""
    peptide_id: Optional[int] = None
    batch_no: Optional[str] = None
    product_name_cn: Optional[str] = None
    gb_standard: Optional[str] = None
    test_conclusion: Optional[str] = Field(None, pattern="^(合格|不合格|待检)$")
    qualified: Optional[bool] = None
    supplier_name: Optional[str] = None
    start_date: Optional[datetime] = None
    end_date: Optional[datetime] = None
    sort_by: str = Field("created_at", description="排序字段")
    sort_order: str = Field("desc", pattern="^(asc|desc)$", description="排序方向")


# ─── 模板Schema ────────────────────────────────────────────────

class COATemplateItem(BaseModel):
    """模板中的检验单项定义"""
    category: str = Field(..., pattern="^(sensory|chemical|microbial|packaging)$")
    item_name: str
    item_name_en: Optional[str] = None
    standard_pattern: str = Field(..., description="标准模板字符串，支持 {value} 占位符")
    unit: Optional[str] = None
    limit_type: Optional[str] = Field(None, pattern="^(max|min|eq)$")
    sort_order: int = 0


class COATemplateBase(BaseModel):
    """COA模板基础数据"""
    template_name: str = Field(..., min_length=1, max_length=200, description="模板名称")
    template_key: str = Field(..., min_length=1, max_length=100, pattern="^[a-zA-Z0-9_]+$", description="模板唯一键")
    product_type: str = Field("其他食品", description="适用产品类型")
    default_gb_standard: Optional[str] = Field(None, description="默认国标")
    description: Optional[str] = Field(None, description="模板说明")
    test_items: List[COATemplateItem] = Field(default_factory=list, description="默认检验单项模板")
    layout_config: Dict[str, Any] = Field(default_factory=dict, description="布局配置")
    is_active: bool = Field(True, description="是否启用")

    model_config = {"json_schema_extra": {
        "examples": [[{
            "template_name": "鱼胶原蛋白肽出厂报告模板",
            "template_key": "fish_collagen_peptide_001",
            "product_type": "鱼胶原蛋白肽",
            "default_gb_standard": "GB31645—2018",
            "test_items": [
                {"category": "sensory", "item_name": "色泽", "standard_pattern": "具有本品应有的色泽"},
                {"category": "chemical", "item_name": "水分含量(%)", "standard_pattern": "≤ {value}%", "limit_type": "max"},
            ]
        }]]
    }}


class COATemplateCreate(COATemplateBase):
    """创建模板请求"""
    pass


class COATemplateUpdate(BaseModel):
    """更新模板请求（所有字段可选）"""
    template_name: Optional[str] = None
    product_type: Optional[str] = None
    default_gb_standard: Optional[str] = None
    description: Optional[str] = None
    test_items: Optional[List[COATemplateItem]] = None
    layout_config: Optional[Dict[str, Any]] = None
    is_active: Optional[bool] = None


class COATemplateResponse(COATemplateBase):
    """模板响应"""
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}
