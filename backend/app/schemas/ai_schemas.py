"""RMFOOD AI助手 Pydantic Schemas

用于AI生成、优化、推荐和模板管理的请求/响应模型定义。
支持流式输出、多级优化和个性化推荐。
"""
from datetime import datetime
from typing import List, Optional, Any, Dict
from enum import Enum
# reloaded: 2026-06-05T17:42
from pydantic import BaseModel, Field, model_validator


class OutputLength(str, Enum):
    """输出长度枚举"""
    SHORT = "short"
    MEDIUM = "medium"
    DETAIL = "detail"


class Tone(str, Enum):
    """语气风格枚举"""
    FORMAL = "formal"
    CASUAL = "casual"
    PROFESSIONAL = "professional"


class OptimizationLevel(str, Enum):
    """优化级别枚举"""
    BASIC = "basic"
    ADVANCED = "advanced"
    EXPERT = "expert"


class AIGenerateParams(BaseModel):
    """AI生成参数"""
    creativity: float = Field(0.7, ge=0.0, le=1.0, description="创造性系数 (0.0保守 - 1.0创新)")
    length: OutputLength = Field(OutputLength.MEDIUM, description="输出长度: short/medium/detail")
    tone: Tone = Field(Tone.PROFESSIONAL, description="语气风格: formal/casual/professional")
    focus_areas: Optional[List[str]] = Field(None, description="关注领域列表")
    constraints: Optional[Dict[str, Any]] = Field(None, description="约束条件")


class AIGenerateRequest(BaseModel):
    """AI生成请求

    支持两种模式:
    - 对话模式: 传入 description（需求描述）
    - 配方生成模式: 传入 target_effects（目标功效列表）
    """
    description: Optional[str] = Field(None, min_length=10, max_length=5000, description="需求描述", examples=["设计一款针对中老年人群的增强免疫力功能食品配方"])
    target_effects: Optional[List[str]] = Field(None, min_length=1, max_length=5, description="目标功效，如 ['降血压', '抗氧化']")
    constraints: Optional[Dict[str, Any]] = Field(None, description="约束条件")
    use_llm: bool = Field(False, description="是否使用 LLM 生成")
    parameters: Optional[AIGenerateParams] = Field(None, description="生成参数")
    context: Optional[Dict[str, Any]] = Field(None, description="上下文信息（如现有配方、目标人群等）")

    @model_validator(mode='after')
    def validate_required_field(self) -> 'AIGenerateRequest':
        if not self.description and not self.target_effects:
            raise ValueError('必须提供 description 或 target_effects 其中之一')
        return self


class AIGenerateResponse(BaseModel):
    """AI生成响应"""
    task_id: str = Field(..., description="任务ID（用于轮询结果）")
    status: str = Field("processing", description="状态: processing/completed/failed")
    result: Optional[str] = Field(None, description="生成结果")
    estimated_time: Optional[int] = Field(None, description="预计完成时间（秒）")
    tokens_used: Optional[int] = Field(None, description="消耗的Token数")


class AIOptimizeRequest(BaseModel):
    """AI优化请求"""
    prompt_content: str = Field(..., min_length=10, description="待优化的提示词/内容")
    optimization_level: OptimizationLevel = Field(OptimizationLevel.ADVANCED, description="优化级别: basic/advanced/expert")
    goals: Optional[List[str]] = Field(None, description="优化目标列表", examples=["提高可读性", "增加专业性"])
    current_metrics: Optional[Dict[str, float]] = Field(None, description="当前性能指标")


class AIOptimizeResponse(BaseModel):
    """AI优化响应"""
    original_content: str
    optimized_content: str
    improvements: List[str] = Field(default_factory=list, description="改进点列表")
    score_improvement: float = Field(0.0, description="评分提升幅度")
    suggestions: List[str] = Field(default_factory=list, description="额外建议")


class RecommendationItem(BaseModel):
    """推荐项"""
    id: int
    type: str
    title: str
    description: str
    confidence_score: float = Field(..., ge=0.0, le=1.0, description="置信度分数")
    metadata: Optional[Dict[str, Any]] = None


class AIRecommendationResponse(BaseModel):
    """AI推荐响应"""
    recommendations: List[RecommendationItem]
    context_signals: Dict[str, Any] = Field(default_factory=dict, description="推荐原因解释")
    generated_at: datetime


class TemplateCategory(str, Enum):
    """模板分类枚举"""
    FORMULA_DESIGN = "formula_design"
    INGREDIENT_SELECTION = "ingredient_selection"
    PROCESS_OPTIMIZATION = "process_optimization"
    NUTRITION_ANALYSIS = "nutrition_analysis"
    SAFETY_CHECK = "safety_check"
    COST_ANALYSIS = "cost_analysis"


class TemplateItem(BaseModel):
    """模板项"""
    id: int
    name: str
    category: TemplateCategory
    description: str
    version: str
    usage_count: int = 0
    rating: Optional[float] = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class TemplateDetail(TemplateItem):
    """模板详情"""
    content: str
    variables: List[str] = Field(default_factory=list, description="变量列表")
    examples: List[Dict[str, Any]] = Field(default_factory=list, description="使用示例")
    tags: List[str] = Field(default_factory=list, description="标签列表")


class TemplateListResponse(BaseModel):
    """模板列表响应"""
    templates: List[TemplateItem]
    total: int
    page: int
    page_size: int


class FeedbackType(str, Enum):
    """反馈类型枚举"""
    LIKE = "like"
    DISLIKE = "dislike"
    NEUTRAL = "neutral"


class AIFeedbackRequest(BaseModel):
    """AI反馈请求"""
    suggestion_id: int = Field(..., description="建议ID")
    feedback_type: FeedbackType = Field(..., description="反馈类型: like/dislike/neutral")
    comment: Optional[str] = Field(None, max_length=500, description="反馈评论")
    is_helpful: Optional[bool] = Field(None, description="是否有帮助")


class AIFeedbackResponse(BaseModel):
    """AI反馈响应"""
    success: bool = True
    message: str = "反馈已提交"
    suggestion_id: int
    feedback_type: str

# reloaded at 2026-06-06 01:26:16.140464
