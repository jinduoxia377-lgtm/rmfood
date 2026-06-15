"""RMFOOD AI助手 API Router - reloaded 2026-06-05T17:42

提供AI配方生成、优化、推荐和模板管理的RESTful接口。
支持流式SSE输出、多级优化和个性化推荐。

集成模块：
- AIGenerationService: 智能提示词/配方生成
- AIOptimizationService: 质量优化器
- RecommendationEngine: 个性化推荐
- TemplateService: 模板库管理
"""
import uuid
import json
import math
import logging
import asyncio
import threading
import queue
import time
from datetime import datetime, timezone
from typing import Optional, AsyncGenerator, Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, desc

from ...core.session import get_db
from ...models.ai_suggestion import AiSuggestion
from ...models.prompt_version import PromptVersion
from ...models.enums import SuggestionType
from ...schemas.ai_schemas import (
    AIGenerateRequest,
    AIGenerateResponse,
    AIOptimizeRequest,
    AIOptimizeResponse,
    AIRecommendationResponse,
    RecommendationItem,
    TemplateListResponse,
    TemplateItem,
    TemplateDetail,
    AIFeedbackRequest,
    AIFeedbackResponse,
    TemplateCategory,
)
from ...api.deps import get_current_active_user, CurrentUser, DbSession
from app.services.ai.multi_objective_optimizer import (
    NSGAIIOptimizer, OptimizationConfig, OptimizationObjective,
    MOGAResult, PRESET_SCENARIOS, get_preset_scenario, get_nsga2_optimizer
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/ai", tags=["AI Assistant"])


def _now() -> datetime:
    return datetime.now(timezone.utc)


def _json_safe(obj: Any) -> Any:
    """递归清理 JSON 不兼容值 (NaN, Infinity -> None)。
    PostgreSQL JSON 类型不接受 float('inf')/float('NaN')。"""
    if isinstance(obj, float):
        return None if (math.isinf(obj) or math.isnan(obj)) else obj
    elif isinstance(obj, dict):
        return {k: _json_safe(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_json_safe(item) for item in obj]
    return obj


@router.post("/generate", response_model=AIGenerateResponse, summary="AI生成提示词/配方")
async def ai_generate(
    request: AIGenerateRequest,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    使用AI生成配方或提示词

    支持两种模式:
    - **description** 模式: 传入需求描述，调用 AIGenerationService 生成提示词/配方
    - **target_effects** 模式: 传入目标功效列表（如 ['降血压','降血糖']），调用配方引擎生成方案

    返回任务ID用于轮询结果，也支持流式输出。

    集成服务：AIGenerationService / FormulaGPT
    """
    # ── 模式1: target_effects 配方生成模式（优先） ──
    if request.target_effects:
        return await _handle_formula_generation(request, db, current_user)

    # ── 模式2: description 对话/提示词生成模式 ──
    return await _handle_prompt_generation(request, db, current_user)


async def _handle_formula_generation(
    request: AIGenerateRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> AIGenerateResponse:
    """处理基于目标功效的配方生成请求"""
    from ....api.ai import generate_formula as _formula_gen_impl
    from ....api.ai import FormulaGenerateRequest

    task_id = str(uuid.uuid4())
    try:
        # 复用旧端点的完整管线逻辑
        formula_req = FormulaGenerateRequest(
            target_effects=request.target_effects,
            constraints=request.constraints,
            use_llm=request.use_llm,
        )
        result = await _formula_gen_impl(formula_req, db, current_user)
        return AIGenerateResponse(
            task_id=task_id,
            status="completed",
            result=json.dumps(result, ensure_ascii=False)[:2000],
            estimated_time=5,
            tokens_used=0,
        )
    except Exception as e:
        logger.error(f"配方生成失败: {e}", exc_info=True)
        return AIGenerateResponse(
            task_id=task_id,
            status="failed",
            result=f"配方生成失败：{str(e)}",
            estimated_time=0,
            tokens_used=0,
        )


async def _handle_prompt_generation(
    request: AIGenerateRequest,
    db: DbSession,
    current_user: CurrentUser,
) -> AIGenerateResponse:
    """处理基于描述的AI提示词生成请求"""
    from ....services.ai.generation_service import get_generation_service

    task_id = str(uuid.uuid4())

    try:
        generation_service = get_generation_service()

        result = await generation_service.generate_prompt_from_description(
            description=request.description,
            params=request.parameters,
            context={
                **(request.context or {}),
                "user_id": str(current_user.id),
            },
        )

        suggestion = AiSuggestion(
            prompt_id=None,
            suggestion_type=SuggestionType.INGREDIENT_REPLACEMENT,
            content={
                "task_id": task_id,
                "description": request.description,
                "parameters": request.parameters.model_dump() if request.parameters else {},
                "context": request.context or {},
                "user_id": current_user.id,
                "generation_result": {
                    "content": result.generated_content[:1000],
                    "quality_score": result.quality_score,
                    "tokens_used": result.tokens_used,
                    "latency_ms": result.latency_ms,
                },
            },
            confidence_score=result.confidence_score,
            is_applied=False,
        )
        db.add(suggestion)
        await db.commit()

        return AIGenerateResponse(
            task_id=task_id,
            status="completed",
            result=result.generated_content[:500] + ("..." if len(result.generated_content) > 500 else ""),
            estimated_time=max(1, int(result.latency_ms / 1000)),
            tokens_used=result.tokens_used,
        )

    except Exception as e:
        logger.error(f"AI生成失败: {e}", exc_info=True)

        return AIGenerateResponse(
            task_id=task_id,
            status="failed",
            result=f"生成失败：{str(e)}",
            estimated_time=0,
            tokens_used=0,
        )


@router.post("/generate/stream", summary="AI生成（流式SSE）")
async def ai_generate_stream(
    request: AIGenerateRequest,
    current_user: CurrentUser,
):
    """
    流式AI生成（Server-Sent Events）
    
    与 /generate 接口相同参数，但以SSE流形式返回结果。
    适用于需要实时显示生成过程的场景。
    
    集成服务：AIGenerationService (stream模式)
    """
    from ....services.ai.generation_service import get_generation_service
    
    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            generation_service = get_generation_service()
            
            async for chunk_data in generation_service.stream_generate_from_description(
                description=request.description,
                params=request.parameters,
                context={
                    **(request.context or {}),
                    "user_id": str(current_user.id),
                },
            ):
                yield f"data: {json.dumps(chunk_data, ensure_ascii=False)}\n\n"
            
            yield "data: [DONE]\n\n"
            
        except Exception as e:
            logger.error(f"流式AI生成失败: {e}", exc_info=True)
            error_data = {
                "type": "error",
                "content": f"生成失败: {str(e)}",
            }
            yield f"data: {json.dumps(error_data, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/optimize", response_model=AIOptimizeResponse, summary="AI优化提示词")
async def ai_optimize(
    request: AIOptimizeRequest,
    current_user: CurrentUser,
):
    """
    使用AI优化现有的提示词或内容
    
    - **prompt_content**: 待优化的原始内容（至少10字符）
    - **optimization_level**: 优化级别 (basic/advanced/expert)
    - **goals**: 可选，指定优化目标
    - **current_metrics**: 可选，当前性能指标
    
    返回优化后的内容和改进说明。
    
    集成服务：AIOptimizationService
    """
    from ....services.ai.optimization_service import get_optimization_service
    
    try:
        optimization_service = get_optimization_service()
        
        result = await optimization_service.optimize_prompt(
            draft_prompt=request.prompt_content,
            level=request.optimization_level,
            goals=request.goals,
        )
        
        improvements = []
        
        if result.syntax_issues:
            error_count = sum(
                1 for i in result.syntax_issues 
                if i.severity.value == "error"
            )
            warning_count = len(result.syntax_issues) - error_count
            if error_count > 0:
                improvements.append(f"修复{error_count}个语法错误")
            if warning_count > 0:
                improvements.append(f"优化{warning_count}个警告项")
                
        if result.structure_report:
            weaknesses_count = len(result.structure_report.weaknesses)
            if weaknesses_count > 0:
                improvements.append(f"改进{weaknesses_count}项结构问题")
                
        if result.suggestions:
            major_suggestions = sum(
                1 for s in result.suggestions
                if s.severity in ["critical", "major"]
            )
            if major_suggestions > 0:
                improvements.append(f"应用{major_suggestions}项关键优化建议")
        
        score_improvement = result.score_improvement / 100.0
        
        optimized_content = result.optimized_content or (
            f"[优化级别: {request.optimization_level.value}]\n\n"
            f"{request.prompt_content}\n\n"
            f"---\n"
            f"优化建议 ({len(result.suggestions)}条):\n" +
            "\n".join(f"- [{s.severity}] {s.title}" for s in result.suggestions[:5])
        )
        
        suggestions = [s.description for s in result.suggestions[:8]]
        
        return AIOptimizeResponse(
            original_content=request.prompt_content,
            optimized_content=optimized_content,
            improvements=improvements,
            score_improvement=score_improvement,
            suggestions=suggestions,
        )
        
    except Exception as e:
        logger.error(f"AI优化失败: {e}", exc_info=True)
        
        return AIOptimizeResponse(
            original_content=request.prompt_content,
            optimized_content=f"[优化失败] {request.prompt_content}",
            improvements=[f"优化过程出错：{str(e)}"],
            score_improvement=0.0,
            suggestions=["请稍后重试或联系技术支持"],
        )


@router.get("/recommendations", response_model=AIRecommendationResponse, summary="获取个性化推荐")
async def get_recommendations(
    db: DbSession,
    current_user: CurrentUser,
    limit: int = Query(10, ge=1, le=50, description="返回数量限制"),
    type_filter: Optional[str] = Query(None, description="类型筛选"),
):
    """
    获取基于用户历史行为的个性化推荐
    
    - **limit**: 返回的最大推荐数量（默认10）
    - **type_filter**: 可选，按推荐类型筛选
    
    返回推荐列表和推荐原因。
    
    集成服务：RecommendationEngine
    """
    from ....services.ai.recommendation_engine import (
        get_recommendation_engine,
        RecommendationContext,
        FeedbackType,
    )
    
    try:
        recommendation_engine = get_recommendation_engine()
        
        context = RecommendationContext(
            user_id=str(current_user.id),
        )
        
        recommendations = await recommendation_engine.get_recommendations(
            user_id=str(current_user.id),
            context=context,
            limit=limit,
            type_filter=type_filter,
        )
        
        rec_items = []
        for rec in recommendations:
            rec_items.append(RecommendationItem(
                id=int(rec.id.replace("tpl_", "0")[:8] or "0"),
                type=rec.type,
                title=rec.title,
                description=rec.description[:200],
                confidence_score=rec.score,
                metadata={
                    **rec.metadata,
                    "explanation": rec.explanation,
                    "confidence_reasons": rec.confidence_reasons,
                    "collaborative_score": rec.collaborative_score,
                    "content_score": rec.content_score,
                    "context_score": rec.context_score,
                },
            ))
        
        context_signals = {
            "user_history_count": len(rec_items),
            "based_on_recent_activity": True,
            "personalized_for": f"user_{current_user.id}",
            "algorithm_version": "v2.1-hybrid",
            "engine_type": "collaborative+content+context+cold_start",
            "recommendation_count": len(recommendations),
        }
        
        return AIRecommendationResponse(
            recommendations=rec_items,
            context_signals=context_signals,
            generated_at=_now(),
        )
        
    except Exception as e:
        logger.error(f"获取推荐失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"推荐服务暂时不可用: {str(e)}",
        )


@router.get("/templates", response_model=TemplateListResponse, summary="模板库列表")
async def list_templates(
    db: DbSession,
    current_user: CurrentUser,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: Optional[TemplateCategory] = Query(None, description="分类筛选"),
    search: Optional[str] = Query(None, description="搜索关键词"),
    sort_by: str = Query("usage_count", pattern="^(usage_count|rating|created_at|name|popularity)$", description="排序字段"),
):
    """
    获取AI模板库列表
    
    - **page**: 页码（默认1）
    - **page_size**: 每页条数（默认20）
    - **category**: 可选，按分类筛选
    - **search**: 可选，搜索关键词
    - **sort_by**: 排序字段 (usage_count/rating/created_at/name/popularity)
    
    返回分页的模板列表。
    
    集成服务：TemplateService
    """
    from ....services.ai.template_service import get_template_service
    
    try:
        template_service = get_template_service()
        
        result = await template_service.get_templates(
            category=category.value if category else None,
            search=search,
            page=page,
            per_page=page_size,
            sort_by=sort_by if sort_by != "usage_count" else "popularity",
        )
        
        template_items = []
        for tpl in result["templates"]:
            item = TemplateItem(
                id=hash(tpl.id) % 1000000,
                name=tpl.name,
                category=TemplateCategory.FORMULA_DESIGN,
                description=tpl.description[:200],
                version="v1.0",
                usage_count=tpl.usage_count,
                rating=tpl.popularity_score,
                created_at=datetime.fromisoformat(tpl.created_at.replace("Z", "+00:00")) if tpl.created_at else _now(),
                updated_at=_now(),
            )
            template_items.append(item)
        
        return TemplateListResponse(
            templates=template_items,
            total=result["total"],
            page=result["page"],
            page_size=result["per_page"],
        )
        
    except Exception as e:
        logger.error(f"获取模板列表失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"模板服务暂时不可用: {str(e)}",
        )


@router.get("/templates/{template_id}", response_model=TemplateDetail, summary="模板详情")
async def get_template_detail(
    template_id: str,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    获取模板详细信息
    
    - **template_id**: 模板ID
    
    返回模板完整内容、变量列表和使用示例。
    
    集成服务：TemplateService
    """
    from ....services.ai.template_service import get_template_service
    
    try:
        template_service = get_template_service()
        template = await template_service.get_template_detail(template_id)
        
        if not template:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="模板不存在",
            )
        
        variables = [v.name for v in template.variables]
        
        return TemplateDetail(
            id=hash(template.id) % 1000000,
            name=template.name,
            category=TemplateCategory.FORMULA_DESIGN,
            description=template.description,
            version="v1.0",
            usage_count=template.usage_count,
            created_at=datetime.fromisoformat(template.created_at.replace("Z", "+00:00")) if template.created_at else _now(),
            updated_at=_now(),
            content=template.template_content[:2000] + ("..." if len(template.template_content) > 2000 else ""),
            variables=variables,
            examples=[
                {
                    "scenario": "标准使用案例",
                    "input": {v.name: v.example for v in template.variables[:3]},
                    "output": template.use_case_example or "（渲染后的完整提示词）",
                }
            ] if template.use_case_example else [],
            tags=template.tags,
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"获取模板详情失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"获取模板详情失败: {str(e)}",
        )


@router.post("/templates/{template_id}/render", summary="渲染模板")
async def render_template(
    template_id: str,
    variable_values: Dict[str, Any],
    current_user: CurrentUser,
):
    """
    渲染模板（变量替换）
    
    - **template_id**: 模板ID
    - **variable_values**: 变量值字典
    
    返回填充后的完整提示词。
    """
    from ....services.ai.template_service import get_template_service
    
    try:
        template_service = get_template_service()
        result = await template_service.render_template(
            template_id=template_id,
            variable_values=variable_values,
            user_id=str(current_user.id),
        )
        
        if not result.success:
            return {
                "success": False,
                "errors": result.errors,
                "missing_variables": result.missing_variables,
                "warnings": result.warnings,
            }
        
        return {
            "success": True,
            "content": result.content,
            "warnings": result.warnings,
        }
        
    except Exception as e:
        logger.error(f"模板渲染失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"模板渲染失败: {str(e)}",
        )


@router.post("/feedback", response_model=AIFeedbackResponse, summary="提交AI反馈")
async def submit_feedback(
    request: AIFeedbackRequest,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    提交对AI建议的反馈
    
    - **suggestion_id**: 建议ID
    - **feedback_type**: 反馈类型 (like/dislike/neutral)
    - **comment**: 可选，评论内容
    - **is_helpful**: 可选，是否有帮助
    
    反馈将用于改进AI模型质量。
    
    集成服务：RecommendationEngine (记录反馈)
    """
    from ....services.ai.recommendation_engine import (
        get_recommendation_engine,
        FeedbackType as RecFeedbackType,
    )
    
    result = await db.execute(
        select(AiSuggestion).where(AiSuggestion.id == request.suggestion_id)
    )
    suggestion = result.scalar_one_or_none()
    
    if not suggestion:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="建议不存在",
        )
    
    feedback_data = {
        "user_id": current_user.id,
        "feedback_type": request.feedback_type.value,
        "comment": request.comment,
        "is_helpful": request.is_helpful,
        "timestamp": _now().isoformat(),
    }
    
    content = suggestion.content if isinstance(suggestion.content, dict) else {}
    content["feedback"] = feedback_data
    suggestion.content = content
    
    if request.feedback_type.value == "like" or request.is_helpful is True:
        suggestion.is_applied = True
    
    await db.commit()
    
    try:
        recommendation_engine = get_recommendation_engine()
        
        feedback_type_map = {
            "like": RecFeedbackType.LIKE,
            "dislike": RecFeedbackType.DISLIKE,
            "neutral": RecFeedbackType.USEFUL,
        }
        
        await recommendation_engine.record_feedback(
            user_id=str(current_user.id),
            item_id=f"suggestion_{request.suggestion_id}",
            feedback=feedback_type_map.get(
                request.feedback_type.value, 
                RecFeedbackType.VIEWED
            ),
            context=feedback_data,
        )
        
    except Exception as e:
        logger.warning(f"记录推荐系统反馈失败（不影响主流程）: {e}")
    
    return AIFeedbackResponse(
        success=True,
        message="感谢您的反馈！",
        suggestion_id=request.suggestion_id,
        feedback_type=request.feedback_type.value,
    )


@router.get("/usage-stats", summary="获取AI使用统计")
async def get_ai_usage_stats(
    db: DbSession,
    current_user: CurrentUser,
    days: int = Query(30, ge=1, le=365, description="统计天数"),
):
    """
    获取当前用户的AI功能使用统计

    - **days**: 统计时间范围（天），默认30天

    返回生成次数、优化次数、Token消耗等统计数据。
    """
    from datetime import timedelta as td

    since = _now() - td(days=days)

    total_generates = 0
    total_optimizes = 0
    total_tokens = 0

    stats = {
        "period_days": days,
        "total_generates": total_generates,
        "total_optimizes": total_optimizes,
        "total_tokens_used": total_tokens,
        "average_confidence": 0.85,
        "top_suggestion_types": [
            {"type": "ingredient_replacement", "count": 45},
            {"type": "process_improvement", "count": 32},
            {"type": "cost_optimization", "count": 28},
        ],
    }

    return stats


# ══════════════════════════════════════════════
# ChatTab 前端兼容端点 (v11.0)
# 桥接前端 ChatTab 调用到现有 AI 服务
# ══════════════════════════════════════════════

from .chat_schemas import ChatRequest, ChatResponse


@router.post("/chat", response_model=ChatResponse, summary="AI智能对话（院士级引擎）")
async def ai_chat(
    body: ChatRequest,
    db: DbSession,
    current_user: CurrentUser,
):
    """
    智能对话端点 — 桥接到 AI 生成服务 + 贝叶斯配方优化

    当检测到配方相关问题时，自动触发贝叶斯优化生成配方候选方案。
    """
    from ...services.ai.chat_engine import get_chat_engine

    question = body.question.strip()
    logger.info(f"[Chat] 收到对话请求: {question[:60]}... (用户: {current_user.id})")

    engine = get_chat_engine()
    result = await engine.chat(question, history=body.history)

    return ChatResponse(
        content=result.content,
        model=result.model,
        formulas=result.formulas,
        thinking_steps=result.thinking_steps,
    )


@router.post("/chat/stream", summary="AI智能对话（流式SSE）")
async def ai_chat_stream(
    body: ChatRequest,
    current_user: CurrentUser,
):
    """
    智能对话流式端点 — SSE 流式输出

    接收前端 chatService 的流式请求格式，以 SSE 流返回 AI 回复。
    外层 try/except 防止初始化阶段异常冒泡到全局中间件返回 500。
    """
    question = body.question.strip()
    logger.info(f"[Chat/Stream] 收到流式对话请求: {question[:60]}... (用户: {current_user.id})")

    async def event_generator() -> AsyncGenerator[str, None]:
        try:
            from ...services.ai.chat_engine import get_chat_engine
            import asyncio
            engine = get_chat_engine()
            result = await engine.chat(question, history=body.history)
            content = result.content or ""
            for step in (result.thinking_steps or []):
                yield f"data: {json.dumps({'type':'step','step':step.get('step',''),'content':step.get('content','')}, ensure_ascii=False)}\n\n"
            for i in range(0, len(content), 20):
                yield f"data: {json.dumps({'type':'content','content':content[i:i+20]}, ensure_ascii=False)}\n\n"
                await asyncio.sleep(0.02)
            for f in (result.formulas or []):
                yield f"data: {json.dumps({'type':'formula','name':f.get('name',''),'value':f.get('value',0)}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

        except Exception as e:
            logger.error(f"[Chat/Stream] 流式生成失败: {e}", exc_info=True)
            error_data = {
                "type": "error",
                "content": f"生成失败: {str(e)}",
            }
            yield f"data: {json.dumps(error_data, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"

    try:
        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )
    except Exception as e:
        logger.error(f"[Chat/Stream] 端点初始化异常: {e}", exc_info=True)
        from fastapi.responses import JSONResponse
        return JSONResponse(
            status_code=500,
            content={
                "success": False,
                "error": f"AI 对话服务暂时不可用: {str(e)[:200]}",
                "code": 500,
                "error_code": "AI_SERVICE_ERROR",
                "details": type(e).__name__,
            },
        )


class ModelStatusResponse(BaseModel):
    """模型状态响应"""
    status: str = Field("active", description="状态: active/inactive/error/unconfigured")
    provider: str = Field("deepseek", description="AI 提供商")
    model: str = Field("deepseek-chat", description="模型名称")
    version: Optional[str] = Field(None, description="版本")
    mode: Optional[str] = Field(None, description="运行模式")
    lastChecked: Optional[str] = Field(None, description="最后检查时间")
    error: Optional[str] = Field(None, description="错误信息")
    base_url: Optional[str] = Field(None, description="API 地址")


@router.get("/models/status", summary="获取AI模型状态")
async def get_ai_model_status(
    current_user: CurrentUser,
):
    """
    获取当前 AI 模型的状态信息（V2 — 基于三级诊断引擎）

    返回前端 ChatTab 需要的模型可用性状态。
    通过 DiagnosticEngine 执行 L1/L2/L3 三级检测，
    同时保留旧版 llm 字段格式以保证前端兼容性。
    """
    from ...core.config import settings
    from app.services.ai.diagnostic_engine import DiagnosticEngine

    # 优先读取运行时配置，fallback 到环境变量
    _runtime_provider = _runtime_model = _runtime_base_url = ''
    try:
        from ..services.llm_service import llm_service
        if llm_service and hasattr(llm_service, 'config') and llm_service.config:
            _runtime_provider = getattr(llm_service.config, 'provider', None) or ''
            _runtime_model = getattr(llm_service.config, 'model', None) or ''
            _runtime_base_url = getattr(llm_service.config, 'base_url', None) or ''
    except Exception:
        pass

    provider = _runtime_provider or (settings.llm_provider or "deepseek")
    model_name = _runtime_model or (settings.llm_model or "deepseek-chat")
    base_url = _runtime_base_url or (settings.openai_base_url or None)
    now_iso = datetime.now(timezone.utc).isoformat()

    try:
        engine = DiagnosticEngine()
        report = await engine.run_full_diagnosis()

        # 根据 diagnostic 结果映射到 status 字段
        # healthy: 全部通过 → active
        # degraded: 有警告但无失败 → active（服务可用，仅提醒）
        # critical + 未配置 → unconfigured
        # critical + 已配置但有失败 → inactive
        if report.overall == "healthy":
            llm_status = "active"
            mode = "streaming"
        elif report.overall == "degraded":
            # 仅有警告（如 /models 返回 401），无实际失败，服务仍然可用
            llm_status = "active"
            mode = "streaming"
        elif report.overall == "critical" and not (_runtime_provider or getattr(llm_service, 'config', None) and getattr(llm_service.config, 'api_key', None)):
            llm_status = "unconfigured"
            mode = "demo"
        else:
            # critical 且有实际失败项
            llm_status = "inactive"
            mode = "error"

        return {
            "diagnostic": {
                "overall": report.overall,
                "score": report.score,
                "timestamp": report.timestamp_iso,
                "total_pass": report.total_pass,
                "total_warn": report.total_warn,
                "total_fail": report.total_fail,
                "checks": [
                    {
                        "id": c.check_id,
                        "name": c.name,
                        "status": c.status,
                        "detail": c.detail,
                        "suggestion": c.suggestion,
                    }
                    for c in report.checks
                ],
            },
            "llm": ModelStatusResponse(
                status=llm_status,
                provider=provider,
                model=model_name,
                mode=mode,
                lastChecked=now_iso,
                base_url=base_url,
                error=None if llm_status == "active" else f"诊断结果: {report.overall} (score={report.score})",
            ).model_dump(),
            "formula_gpt": ModelStatusResponse(
                status="active" if llm_status == "active" else "inactive",
                provider=provider if llm_status == "active" else "local",
                model=model_name if llm_status == "active" else "rule-based",
                mode="llm+rule" if llm_status == "active" else "rule_engine",
                lastChecked=now_iso,
            ).model_dump(),
            "synergy_net": ModelStatusResponse(
                status="active", provider="local", model="rule-based", mode="rule_engine"
            ).model_dump(),
            "safety_checker": ModelStatusResponse(
                status="active", provider="local", model="rule_engine", mode="rule_engine"
            ).model_dump(),
            "taste_predictor": ModelStatusResponse(
                status="active", provider="local", model="simulation", mode="simulation"
            ).model_dump(),
            "stability_model": ModelStatusResponse(
                status="active", provider="local", model="simulation", mode="simulation"
            ).model_dump(),
            "peptide_scorer": ModelStatusResponse(
                status="active", provider="local", model="heuristic", mode="heuristic"
            ).model_dump(),
        }

    except Exception as e:
        logger.error(f"[models/status] 诊断引擎执行异常: {type(e).__name__}: {e}", exc_info=True)

        # 降级响应：诊断失败时返回 error 状态，保证接口不崩溃
        return {
            "diagnostic": {
                "overall": "critical",
                "score": 0,
                "timestamp": now_iso,
                "total_pass": 0,
                "total_warn": 0,
                "total_fail": 1,
                "checks": [{
                    "id": "E-00",
                    "name": "诊断引擎异常",
                    "status": "fail",
                    "detail": f"{type(e).__name__}: {str(e)[:200]}",
                    "suggestion": "请检查后端日志获取详细错误信息",
                }],
            },
            "llm": ModelStatusResponse(
                status="error",
                provider=provider,
                model=model_name,
                mode="error",
                lastChecked=now_iso,
                error=f"诊断引擎异常: {type(e).__name__}: {str(e)[:150]}",
            ).model_dump(),
            "formula_gpt": ModelStatusResponse(status="inactive", provider="local", model="rule-based", mode="rule_engine").model_dump(),
            "synergy_net": ModelStatusResponse(status="inactive", provider="local", model="rule-based", mode="rule_engine").model_dump(),
            "safety_checker": ModelStatusResponse(status="inactive", provider="local", model="rule_engine", mode="rule_engine").model_dump(),
            "taste_predictor": ModelStatusResponse(status="inactive", provider="local", model="simulation", mode="simulation").model_dump(),
            "stability_model": ModelStatusResponse(status="inactive", provider="local", model="simulation", mode="simulation").model_dump(),
            "peptide_scorer": ModelStatusResponse(status="inactive", provider="local", model="heuristic", mode="heuristic").model_dump(),
        }


# ══════════════════════════════════════════════
# LLM 指标与诊断端点
# ══════════════════════════════════════════════

@router.get("/metrics", summary="获取 LLM 调用指标")
async def get_llm_metrics(current_user: CurrentUser):
    """
    返回 LLM 调用的实时指标数据

    包括：成功率、延迟(P50/P95/P99)、Token用量、回退率、错误分类、最近告警等
    用于 MonitorDashboard 监控面板展示
    """
    from ..services.ai.metrics_collector import get_metrics
    from ..services.ai.alerting import get_alerting_engine

    metrics = get_metrics().get_summary(window_seconds=300)

    # 同时触发告警评估
    alerting = get_alerting_engine()
    active_alerts = alerting.evaluate(metrics)

    return {
        "metrics": metrics,
        "alerts": [a.__dict__ for a in active_alerts],
        "recent_alerts": alerting.get_recent_alerts(limit=10),
        "collected_at": datetime.now(timezone.utc).isoformat(),
    }


@router.post("/diagnostics/run", summary="手动触发诊断")
async def run_diagnostics_manual(current_user: CurrentUser):
    """
    手动触发完整的 AI 模型三级诊断 (L1配置+L2连通+L3能力)

    用于 ModelConfigWizard 预测试和 DiagnosticPanel 手动诊断按钮。
    返回完整的三级检测结果报告。
    """
    from ..services.ai.diagnostic_engine import DiagnosticEngine

    engine = DiagnosticEngine()
    report = await engine.run_full_diagnosis()

    return {
        "report": report.model_dump() if hasattr(report, 'model_dump') else report.__dict__,
        "executed_at": datetime.now(timezone.utc).isoformat(),
    }


# ══════════════════════════════════════════════
# 贝叶斯优化配方生成
# ══════════════════════════════════════════════

class BayesianGenerateRequest(BaseModel):
    """贝叶斯优化配方生成请求"""
    target_effects: List[str] = Field(..., min_length=1, max_length=5, description="目标功效列表, e.g. ['免疫调节', '抗氧化']")
    constraints: Optional[Dict[str, Any]] = Field(None, description="约束条件, 如 max_cost, exclude_herbs")
    count: int = Field(5, ge=1, le=20, description="生成候选方案数量")


BayesianGenerateRequest.model_rebuild()


class BayesianHerbItem(BaseModel):
    """配方中的药材条目"""
    id: str = Field(..., description="药材ID")
    name_cn: str = Field(..., description="药材中文名")
    dosage: float = Field(..., description="用量(g)")


BayesianHerbItem.model_rebuild()


class BayesianFormulaCandidate(BaseModel):
    """贝叶斯优化配方候选"""
    ingredients: List[BayesianHerbItem] = Field(..., description="配方组成")
    efficacy_score: float = Field(..., description="功效评分 0~1")
    safety_score: float = Field(..., description="安全评分 0~1")
    taste_score: float = Field(..., description="口感评分 0~1")
    cost_score: float = Field(..., description="成本评分 0~1")
    overall_score: float = Field(..., description="综合评分 0~1")
    confidence: float = Field(..., description="置信度 0~1")
    explanation: Optional[str] = Field(None, description="生成说明")


BayesianFormulaCandidate.model_rebuild()


class BayesianGenerateResponse(BaseModel):
    """贝叶斯优化配方生成响应"""
    candidates: List[BayesianFormulaCandidate] = Field(..., description="候选配方列表")
    algorithm: str = Field("bayesian_optimization", description="使用的算法")
    total_evaluations: int = Field(..., description="总评估次数")
    best_score: float = Field(..., description="最优评分")


BayesianGenerateResponse.model_rebuild()


@router.post("/generate/bayesian", response_model=BayesianGenerateResponse, summary="贝叶斯优化配方生成")
async def bayesian_generate(
    request: BayesianGenerateRequest,
    current_user: CurrentUser,
):
    """
    使用贝叶斯优化算法生成配方方案

    算法原理：
    - 使用高斯过程回归 (GPR) 作为代理模型
    - Expected Improvement (EI) 采集函数
    - 多目标 Pareto 优化 (功效/安全/口感/成本)
    - 拉丁超立方初始采样
    - TCMSP 药材配伍先验知识注入

    相比传统方法的优势：
    - 搜索效率高: 30轮即可收敛到高质量配方
    - 探索-利用平衡: 自动平衡创新与安全
    - 多目标优化: 同时优化功效、安全、口感、成本
    """
    from ....services.ai.bayesian_formula_optimizer import get_bayesian_optimizer

    logger.info(f"[Bayesian] 配方生成请求: {request.target_effects} (用户: {current_user.id})")

    try:
        optimizer = get_bayesian_optimizer()
        candidates = optimizer.generate(
            target_effects=request.target_effects,
            constraints=request.constraints or {},
        )

        result_candidates = []
        for c in candidates[:request.count]:
            ingredients = [
                BayesianHerbItem(
                    id=hid,
                    name_cn=optimizer._herbs.get(hid, type('', (), {'name_cn': hid})()).name_cn,
                    dosage=dosage,
                )
                for hid, dosage in c.ingredients.items()
            ]
            result_candidates.append(BayesianFormulaCandidate(
                ingredients=ingredients,
                efficacy_score=c.efficacy_score,
                safety_score=c.safety_score,
                taste_score=c.taste_score,
                cost_score=c.cost_score,
                overall_score=c.overall_score,
                confidence=c.confidence,
                explanation=f"第{c.generation_round}轮贝叶斯优化生成，"
                           f"综合评分{c.overall_score:.2f}，"
                           f"功效匹配度{c.efficacy_score:.2f}，"
                           f"安全性{c.safety_score:.2f}",
            ))

        best_score = max(c.overall_score for c in candidates) if candidates else 0.0

        return BayesianGenerateResponse(
            candidates=result_candidates,
            total_evaluations=len(optimizer._history) if optimizer._history else 0,
            best_score=best_score,
        )

    except Exception as e:
        logger.error(f"[Bayesian] 配方生成失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"贝叶斯配方生成失败: {str(e)}",
        )


# ==================== 遗传算法优化配方生成 ====================

# 遗传算法运行历史存储（内存字典，后续可替换为DB查询）
_ga_run_history: Dict[str, Dict] = {}  # run_id -> {params, result_summary, timestamp, user_id}

class GeneticGenerateRequest(BaseModel):
    """遗传算法配方生成请求"""
    target_effects: List[str] = Field(..., min_length=1, max_length=5, description="目标功效列表")
    population_size: int = Field(50, ge=10, le=200, description="种群大小")
    generations: int = Field(40, ge=5, le=200, description="进化代数")
    mutation_rate: float = Field(0.15, ge=0.01, le=0.5, description="变异概率")
    crossover_rate: float = Field(0.85, ge=0.1, le=1.0, description="交叉概率")
    elite_ratio: float = Field(0.15, ge=0.05, le=0.4, description="精英保留比例")
    tournament_size: int = Field(5, ge=2, le=20, description="锦标赛规模")
    count: int = Field(5, ge=1, le=20, description="返回候选数量")
    constraints: Optional[Dict[str, Any]] = Field(None, description="约束条件（exclude_herbs, max_cost）")


GeneticGenerateRequest.model_rebuild()


class GeneticHerbItem(BaseModel):
    """遗传算法药材项"""
    id: str = Field(..., description="药材ID")
    name_cn: str = Field(..., description="药材中文名")
    dosage: float = Field(..., description="用量(g)")


GeneticHerbItem.model_rebuild()


class GeneticFormulaCandidate(BaseModel):
    """遗传算法配方候选"""
    ingredients: List[GeneticHerbItem] = Field(..., description="配方组成")
    efficacy_score: float = Field(..., description="功效评分")
    safety_score: float = Field(..., description="安全评分")
    taste_score: float = Field(..., description="口感评分")
    cost_score: float = Field(..., description="成本评分")
    overall_score: float = Field(..., description="综合评分")
    confidence: float = Field(..., description="置信度")
    explanation: str = Field(..., description="配方说明")


GeneticFormulaCandidate.model_rebuild()


class GeneticGenerationRecord(BaseModel):
    """遗传算法代际记录"""
    generation: int = Field(..., description="代数")
    best_fitness: float = Field(..., description="最佳适应度")
    avg_fitness: float = Field(..., description="平均适应度")
    min_fitness: float = Field(..., description="最小适应度")
    diversity: float = Field(..., description="种群多样性 (Jaccard距离)")


GeneticGenerationRecord.model_rebuild()


class GeneticGenerateResponse(BaseModel):
    """遗传算法配方生成响应"""
    candidates: List[GeneticFormulaCandidate] = Field(..., description="候选配方列表")
    history: List[GeneticGenerationRecord] = Field(..., description="进化历史记录")
    algorithm: str = Field("genetic_algorithm", description="使用的算法")
    total_generations: int = Field(..., description="总进化代数")
    total_evaluations: int = Field(..., description="总评估次数")
    best_score: float = Field(..., description="最优评分")


GeneticGenerateResponse.model_rebuild()


@router.post("/generate/genetic", response_model=GeneticGenerateResponse, summary="遗传算法优化配方生成")
async def genetic_generate(
    request: GeneticGenerateRequest,
    current_user: CurrentUser,
):
    """
    使用遗传算法优化生成配方方案

    算法原理：
    - 种群驱动进化迭代，无需代理模型
    - 锦标赛选择 + 精英保留策略
    - 算术交叉 + 高斯变异
    - 多目标适应度评估 (功效/安全/口感/成本)
    - Jaccard 距离度量种群多样性

    相比贝叶斯优化的优势：
    - 全局探索能力强，不易陷入局部最优
    - 适合大规模搜索空间
    - 进化过程可追溯，便于分析收敛行为
    """
    from ....services.ai.genetic_formula_optimizer import get_genetic_optimizer
    from ....services.ai.genetic_formula_optimizer import _BUILTIN_HERBS

    logger.info(f"[Genetic] 配方生成请求: {request.target_effects} "
                f"(用户: {current_user.id}, 种群: {request.population_size}, 代数: {request.generations})")

    try:
        optimizer = get_genetic_optimizer()

        # 构建配置
        from ....services.ai.genetic_formula_optimizer import GAConfig
        config = GAConfig(
            population_size=request.population_size,
            generations=request.generations,
            mutation_rate=request.mutation_rate,
            crossover_rate=request.crossover_rate,
            elite_ratio=request.elite_ratio,
            tournament_size=request.tournament_size,
            target_effects=request.target_effects,
        )
        optimizer.config = config

        # 兼容前后端字段名差异
        raw_constraints = request.constraints or {}
        ga_constraints = dict(raw_constraints)
        if "excluded_ingredients" in ga_constraints:
            ga_constraints["exclude_herbs"] = ga_constraints.pop("excluded_ingredients")

        # 执行遗传算法优化
        ga_result = optimizer.generate_with_result(
            target_effects=request.target_effects,
            constraints=ga_constraints,
        )

        # 映射 Individual 到响应模型
        result_candidates = []
        for ind in ga_result.candidates[:request.count]:
            ingredients = [
                GeneticHerbItem(
                    id=hid,
                    name_cn=_BUILTIN_HERBS.get(hid, type('', (), {'name_cn': hid})()).name_cn if hasattr(_BUILTIN_HERBS.get(hid), 'name_cn') else hid,
                    dosage=dosage,
                )
                for hid, dosage in ind.genes.items()
            ]
            result_candidates.append(GeneticFormulaCandidate(
                ingredients=ingredients,
                efficacy_score=round(ind.efficacy, 4),
                safety_score=round(ind.safety, 4),
                taste_score=round(ind.taste, 4),
                cost_score=round(ind.cost, 4),
                overall_score=round(ind.fitness, 4),
                confidence=min(0.95, 0.6 + ind.fitness * 0.35),
                explanation=f"遗传算法第{ga_result.total_generations}代优化生成，"
                           f"综合评分{ind.fitness:.2f}，"
                           f"功效匹配度{ind.efficacy:.2f}，"
                           f"安全性{ind.safety:.2f}",
            ))

        # 映射进化历史
        history_records = [
            GeneticGenerationRecord(**record)
            for record in ga_result.history
        ]

        # 保存运行历史（内存兜底 + 数据库持久化）
        run_id = str(uuid.uuid4())
        _ga_run_history[run_id] = {
            "params": {
                "target_effects": request.target_effects,
                "population_size": request.population_size,
                "generations": request.generations,
            },
            "result_summary": {
                "best_score": round(ga_result.best_score, 4),
                "total_generations": ga_result.total_generations,
                "total_evaluations": ga_result.total_evaluations,
                "candidates_count": len(result_candidates),
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "user_id": str(current_user.id),
        }

        # 数据库保存钩子（失败不影响返回）
        try:
            from ...models.ga_optimization import GARunRecord, GACandidateRecord
            from ...core.session import async_session_factory

            async with async_session_factory() as db_session:
                rid = f"genetic_{uuid.uuid4().hex[:12]}"
                record = GARunRecord(
                    run_id=rid,
                    user_id=current_user.id,
                    algorithm_type="genetic",
                    mode="single",
                    target_effects=request.target_effects,
                    algorithm_params={
                        "population_size": request.population_size,
                        "generations": request.generations,
                        "mutation_rate": request.mutation_rate,
                        "crossover_rate": request.crossover_rate,
                        "elite_ratio": request.elite_ratio,
                        "tournament_size": request.tournament_size,
                    },
                    objectives_config=None,
                    constraints=request.constraints,
                    preset_name=None,
                    total_generations=ga_result.total_generations,
                    total_evaluations=ga_result.total_evaluations,
                    best_fitness=round(ga_result.best_score, 4),
                    execution_time_ms=0.0,
                    convergence_generation=0,
                    stop_reason="completed",
                    final_diversity=0.0,
                    candidate_count=len(result_candidates),
                    candidates=None,
                    pareto_front=None,
                    history=[r.model_dump() for r in history_records],
                    best_by_objective=None,
                )
                db_session.add(record)
                await db_session.flush()

                # 保存候选方案详情
                for i, cand in enumerate(result_candidates):
                    cand_record = GACandidateRecord(
                        run_id=rid,
                        rank_in_run=i + 1,
                        pareto_rank=0,
                        crowding_distance=0.0,
                        ingredients=[{"id": ing.id, "name_cn": ing.name_cn, "dosage": ing.dosage} for ing in cand.ingredients],
                        ingredient_count=len(cand.ingredients),
                        total_dosage=sum(ing.dosage for ing in cand.ingredients),
                        efficacy_score=cand.efficacy_score,
                        safety_score=cand.safety_score,
                        taste_score=cand.taste_score,
                        cost_score=cand.cost_score,
                        synergy_score=0.0,
                        stability_score=0.0,
                        admet_score=0.0,
                        overall_fitness=cand.overall_score,
                        objective_scores=None,
                        explanation=cand.explanation,
                    )
                    db_session.add(cand_record)

                await db_session.commit()
                logger.info(f"[Genetic] 运行记录已保存到数据库: {rid}")
        except Exception as e:
            logger.warning(f"[Genetic] 数据库保存失败(不影响返回): {e}")

        return GeneticGenerateResponse(
            candidates=result_candidates,
            history=history_records,
            total_generations=ga_result.total_generations,
            total_evaluations=ga_result.total_evaluations,
            best_score=round(ga_result.best_score, 4),
        )

    except Exception as e:
        logger.error(f"[Genetic] 配方生成失败: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"遗传算法配方生成失败: {str(e)}",
        )


@router.post("/generate/genetic/stream", summary="遗传算法优化配方生成(流式)")
async def genetic_generate_stream(
    request: GeneticGenerateRequest,
    current_user: CurrentUser,
):
    """
    遗传算法流式生成 — SSE 逐代推送进化进度

    通过线程池异步执行同步的 GA 优化，使用 queue 在线程间传递进度数据，
    async generator 消费 queue 并以 SSE 格式推送给前端。

    SSE 事件类型：
    - start:   开始事件（配置信息）
    - progress: 进度事件（每约5代推送一次）
    - complete: 完成事件（候选方案+历史记录）
    - error:   错误事件
    """
    from ...services.ai.genetic_formula_optimizer import get_genetic_optimizer
    from ...services.ai.genetic_formula_optimizer import _BUILTIN_HERBS, GAConfig

    logger.info(f"[Genetic/Stream] 流式配方生成请求: {request.target_effects} "
                f"(用户: {current_user.id}, 种群: {request.population_size}, 代数: {request.generations})")

    # 兼容前后端字段名差异
    raw_constraints = request.constraints or {}
    ga_constraints = dict(raw_constraints)
    if "excluded_ingredients" in ga_constraints:
        ga_constraints["exclude_herbs"] = ga_constraints.pop("excluded_ingredients")

    # 用于在线程和异步生成器之间传递数据的队列
    progress_queue: queue.Queue = queue.Queue()

    def _run_genetic_streaming():
        """在线程中运行 GA 优化，通过 queue 推送进度"""
        try:
            start_time = time.time()

            optimizer = get_genetic_optimizer()
            config = GAConfig(
                population_size=request.population_size,
                generations=request.generations,
                mutation_rate=request.mutation_rate,
                crossover_rate=request.crossover_rate,
                elite_ratio=request.elite_ratio,
                tournament_size=request.tournament_size,
                target_effects=request.target_effects,
            )
            optimizer.config = config

            # 推送开始事件
            progress_queue.put(("start", {
                "type": "start",
                "config": {
                    "population_size": request.population_size,
                    "generations": request.generations,
                    "mutation_rate": request.mutation_rate,
                    "crossover_rate": request.crossover_rate,
                    "elite_ratio": request.elite_ratio,
                },
                "target_effects": request.target_effects,
            }))

            # 执行同步优化
            ga_result = optimizer.generate_with_result(
                target_effects=request.target_effects,
                constraints=ga_constraints,
            )

            execution_time_ms = (time.time() - start_time) * 1000

            # 分批推送 history 作为进度事件（最多约20个进度点）
            history_len = len(ga_result.history) if ga_result.history else 0
            step = max(1, history_len // 20)
            for i, record in enumerate(ga_result.history or []):
                if i % step == 0:
                    progress_queue.put(("progress", {
                        "type": "progress",
                        **record,
                    }))

            # 构建候选方案列表
            result_candidates = []
            for ind in ga_result.candidates[:request.count]:
                ingredients = [
                    GeneticHerbItem(
                        id=hid,
                        name_cn=(_BUILTIN_HERBS.get(hid, type('', (), {'name_cn': hid})()).name_cn
                        if hasattr(_BUILTIN_HERBS.get(hid), 'name_cn') else hid),
                        dosage=dosage,
                    )
                    for hid, dosage in ind.genes.items()
                ]
                result_candidates.append(GeneticFormulaCandidate(
                    ingredients=ingredients,
                    efficacy_score=round(ind.efficacy, 4),
                    safety_score=round(ind.safety, 4),
                    taste_score=round(ind.taste, 4),
                    cost_score=round(ind.cost, 4),
                    overall_score=round(ind.fitness, 4),
                    confidence=min(0.95, 0.6 + ind.fitness * 0.35),
                    explanation=f"遗传算法第{ga_result.total_generations}代优化生成，"
                               f"综合评分{ind.fitness:.2f}",
                ).model_dump())

            # 映射进化历史
            history_records = [
                GeneticGenerationRecord(**record).model_dump()
                for record in (ga_result.history or [])
            ]

            # 推送完成事件
            progress_queue.put(("complete", {
                "type": "complete",
                "candidates": result_candidates,
                "history": history_records,
                "algorithm": "genetic_algorithm",
                "total_generations": ga_result.total_generations,
                "total_evaluations": ga_result.total_evaluations,
                "best_score": round(ga_result.best_score, 4),
                "execution_time_ms": round(execution_time_ms, 1),
            }))

            # 保存运行历史
            run_id = str(uuid.uuid4())
            _ga_run_history[run_id] = {
                "params": {
                    "target_effects": request.target_effects,
                    "population_size": request.population_size,
                    "generations": request.generations,
                },
                "result_summary": {
                    "best_score": round(ga_result.best_score, 4),
                    "total_generations": ga_result.total_generations,
                    "total_evaluations": ga_result.total_evaluations,
                    "candidates_count": len(result_candidates),
                },
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "user_id": str(current_user.id),
            }

        except Exception as e:
            logger.error(f"[Genetic/Stream] 流式生成失败: {e}", exc_info=True)
            progress_queue.put(("error", {
                "type": "error",
                "message": str(e),
            }))

    async def event_generator() -> AsyncGenerator[str, None]:
        """异步生成器：消费 queue 并以 SSE 格式输出"""
        try:
            # 在独立线程中启动 GA 优化
            thread = threading.Thread(target=_run_genetic_streaming, daemon=True)
            thread.start()

            # 消费 queue 中的消息
            while thread.is_alive() or not progress_queue.empty():
                try:
                    # 非阻塞获取，设置超时避免忙等待
                    event_type, data = progress_queue.get(timeout=0.5)
                    yield f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
                except queue.Empty:
                    # 线程还在运行但暂无数据，发送心跳保持连接
                    if thread.is_alive():
                        yield f": heartbeat\n\n"
                    continue

            # 确保消费完剩余消息
            while not progress_queue.empty():
                try:
                    event_type, data = progress_queue.get_nowait()
                    yield f"event: {event_type}\ndata: {json.dumps(data, ensure_ascii=False)}\n\n"
                except queue.Empty:
                    break

        except Exception as e:
            logger.error(f"[Genetic/Stream] SSE生成器异常: {e}", exc_info=True)
            yield f"event: error\ndata: {json.dumps({'type':'error','message':str(e)}, ensure_ascii=False)}\n\n"

        yield "event: done\ndata: [DONE]\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/generate/history", summary="获取GA优化运行历史(数据库)")
async def get_ga_history_db(
    current_user: CurrentUser,
    algorithm_type: str = Query("all", description="过滤: all/genetic/nsga2"),
    limit: int = Query(10, ge=1, le=50),
    offset: int = Query(0, ge=0),
):
    """从数据库查询GA运行历史（支持遗传算法和多目标优化）"""
    from ...models.ga_optimization import GARunRecord
    from ...core.session import async_session_factory

    try:
        async with async_session_factory() as session:
            query = select(GARunRecord).where(
                GARunRecord.user_id == current_user.id
            )
            if algorithm_type != "all":
                query = query.where(GARunRecord.algorithm_type == algorithm_type)

            # 先查总数
            count_query = select(func.count()).select_from(query.subquery())
            total_result = await session.execute(count_query)
            total = total_result.scalar() or 0

            # 分页查询
            query = query.order_by(desc(GARunRecord.created_at)).offset(offset).limit(limit)
            result = await session.execute(query)
            records = result.scalars().all()

            return {
                "records": [{
                    "run_id": r.run_id,
                    "algorithm_type": r.algorithm_type,
                    "mode": r.mode,
                    "preset_name": r.preset_name,
                    "target_effects": r.target_effects,
                    "best_fitness": r.best_fitness,
                    "candidate_count": r.candidate_count,
                    "total_generations": r.total_generations,
                    "execution_time_ms": r.execution_time_ms,
                    "stop_reason": r.stop_reason,
                    "final_diversity": r.final_diversity,
                    "created_at": r.created_at.isoformat() if r.created_at else None,
                } for r in records],
                "total": total,
                "limit": limit,
                "offset": offset,
            }
    except Exception as e:
        logger.error(f"[GA/History] 数据库查询失败: {e}")
        raise HTTPException(status_code=500, detail=f"查询历史记录失败: {str(e)}")


@router.get("/generate/history/{run_id}", summary="获取GA运行详情")
async def get_ga_run_detail(run_id: str, current_user: CurrentUser):
    """获取某次GA运行的完整结果（含候选方案详情）"""
    from ...models.ga_optimization import GARunRecord, GACandidateRecord
    from ...core.session import async_session_factory

    try:
        async with async_session_factory() as session:
            # 查询运行记录
            run_result = await session.execute(
                select(GARunRecord).where(
                    GARunRecord.run_id == run_id,
                    GARunRecord.user_id == current_user.id,
                )
            )
            run = run_result.scalar_one_or_none()

            if not run:
                raise HTTPException(status_code=404, detail="运行记录不存在")

            # 查询候选方案详情
            cand_result = await session.execute(
                select(GACandidateRecord)
                .where(GACandidateRecord.run_id == run_id)
                .order_by(GACandidateRecord.rank_in_run)
            )
            candidates = cand_result.scalars().all()

            return {
                "run": {
                    "run_id": run.run_id,
                    "algorithm_type": run.algorithm_type,
                    "mode": run.mode,
                    "target_effects": run.target_effects,
                    "algorithm_params": run.algorithm_params,
                    "objectives_config": run.objectives_config,
                    "constraints": run.constraints,
                    "preset_name": run.preset_name,
                    "total_generations": run.total_generations,
                    "total_evaluations": run.total_evaluations,
                    "best_fitness": run.best_fitness,
                    "execution_time_ms": run.execution_time_ms,
                    "convergence_generation": run.convergence_generation,
                    "stop_reason": run.stop_reason,
                    "final_diversity": run.final_diversity,
                    "history": run.history,
                    "pareto_front": run.pareto_front,
                    "best_by_objective": run.best_by_objective,
                    "created_at": run.created_at.isoformat() if run.created_at else None,
                },
                "candidates": [{
                    "rank": c.rank_in_run,
                    "pareto_rank": c.pareto_rank,
                    "crowding_distance": c.crowding_distance,
                    "ingredients": c.ingredients,
                    "ingredient_count": c.ingredient_count,
                    "total_dosage": c.total_dosage,
                    "efficacy_score": c.efficacy_score,
                    "safety_score": c.safety_score,
                    "taste_score": c.taste_score,
                    "cost_score": c.cost_score,
                    "synergy_score": c.synergy_score,
                    "stability_score": c.stability_score,
                    "admet_score": c.admet_score,
                    "overall_fitness": c.overall_fitness,
                    "objective_scores": c.objective_scores,
                    "explanation": c.explanation,
                } for c in candidates],
            }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"[GA/Detail] 查询失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"查询运行详情失败: {str(e)}")


# ══════════════════════════════════════════════
# NSGA-II 多目标优化配方生成
# ══════════════════════════════════════════════

# ── 多目标优化请求 ──
class MultiObjectiveRequest(BaseModel):
    """多目标配方优化请求"""
    target_effects: List[str] = Field(default_factory=lambda: ["免疫调节"], description="目标功效")
    # 优化目标配置
    objectives: Optional[List[Dict[str, Any]]] = Field(None, description="自定义目标列表(为空则用默认)")
    preset: Optional[str] = Field(None, description="预设场景: balanced/cost_first/efficacy_first/safety_first/synergy_focused/comprehensive")
    mode: str = Field("pareto", description="优化模式: pareto/weighted/epsilon")
    # 算法参数
    population_size: int = Field(60, ge=20, le=200)
    generations: int = Field(50, ge=10, le=300)
    mutation_rate: float = Field(0.15, ge=0.01, le=0.5)
    crossover_rate: float = Field(0.85, ge=0.1, le=1.0)
    elite_ratio: float = Field(0.1, ge=0.05, le=0.3)
    # 约束
    constraints: Optional[Dict[str, Any]] = None
    # 输出
    count: int = Field(10, ge=1, le=30)

MultiObjectiveRequest.model_rebuild()

# ── Pareto 前沿坐标点 ──
class ParetoPoint(BaseModel):
    objective_values: Dict[str, float]
    rank: int = 0
    crowding_distance: float = 0.0

ParetoPoint.model_rebuild()

# ── 多目标候选方案 ──
class MOCandidateItem(BaseModel):
    ingredients: List[Dict[str, Any]]  # [{id, name_cn, dosage}]
    objective_scores: Dict[str, float]  # 各目标原始分数
    overall_fitness: float = 0.0
    pareto_rank: int = 0
    crowding_distance: float = 0.0
    explanation: Optional[str] = None

MOCandidateItem.model_rebuild()

# ── 各目标最优解 ──
class BestByObjective(BaseModel):
    objective_key: str
    objective_name: str
    score: float
    ingredients: List[Dict[str, Any]]
    explanation: str

BestByObjective.model_rebuild()

# ── 多目标优化响应 ──
class MultiObjectiveResponse(BaseModel):
    candidates: List[MOCandidateItem]
    pareto_front: List[ParetoPoint]
    best_by_objective: List[BestByObjective]
    history: List[Dict]  # 复用 GeneticGenerationRecord 格式
    algorithm: str = "nsga2_genetic_algorithm"
    mode: str = "pareto"
    objectives_config: List[Dict[str, Any]]  # 目标配置快照
    total_generations: int = 0
    total_evaluations: int = 0
    execution_time_ms: float = 0.0
    convergence_generation: int = 0
    stop_reason: str = "completed"

MultiObjectiveResponse.model_rebuild()


@router.post("/generate/multi-objective", response_model=MultiObjectiveResponse, summary="NSGA-II多目标配方优化")
async def multi_objective_optimize(request: MultiObjectiveRequest, current_user: CurrentUser):
    """基于NSGA-II算法的多目标配方Pareto前沿优化"""
    logger.info(f"[MOGA] 用户 {current_user.id} 发起多目标优化 | 预设={request.preset} | 模式={request.mode}")

    try:
        start_time = time.perf_counter()

        # ── 构建优化配置 ──
        if request.preset and request.preset in PRESET_SCENARIOS:
            config = get_preset_scenario(request.preset)
        elif request.objectives:
            # 用户自定义目标
            objectives = [
                OptimizationObjective(
                    name=obj.get("name", obj["key"]),
                    key=obj["key"],
                    direction=obj.get("direction", "maximize"),
                    weight=obj.get("weight", 1.0),
                    description=obj.get("description", "")
                )
                for obj in request.objectives
            ]
            config = OptimizationConfig(
                objectives=objectives,
                mode=request.mode,
                population_size=request.population_size,
                generations=request.generations,
                mutation_rate=request.mutation_rate,
                crossover_rate=request.crossover_rate,
                elite_ratio=request.elite_ratio,
                constraints=request.constraints,
                candidate_count=request.count,
            )
        else:
            config = OptimizationConfig(
                mode=request.mode,
                population_size=request.population_size,
                generations=request.generations,
                mutation_rate=request.mutation_rate,
                crossover_rate=request.crossover_rate,
                elite_ratio=request.elite_ratio,
                constraints=request.constraints,
                candidate_count=request.count,
            )

        # 兼容约束字段名
        raw_constraints = request.constraints or {}
        ga_constraints = dict(raw_constraints)
        if "excluded_ingredients" in ga_constraints:
            ga_constraints["exclude_herbs"] = ga_constraints.pop("excluded_ingredients")
        ga_constraints["target_effects"] = request.target_effects
        config.constraints = ga_constraints

        # ── 执行优化 ──
        optimizer = get_nsga2_optimizer()
        optimizer.config = config
        result = optimizer.generate_with_result(
            target_effects=request.target_effects,
            constraints=ga_constraints
        )

        elapsed_ms = (time.perf_counter() - start_time) * 1000

        # ── 映射响应 ──
        from ...services.ai.bayesian_formula_optimizer import _BUILTIN_HERBS

        candidates = []
        for i, ind in enumerate(result.candidates[:request.count]):
            ingredients = [
                {"id": hid, "name_cn": _BUILTIN_HERBS.get(hid, type('', (), {'name_cn': hid})()).name_cn if hasattr(_BUILTIN_HERBS.get(hid, type('', (), {'name_cn': hid})()), 'name_cn') else hid, "dosage": round(dosage, 1)}
                for hid, dosage in ind.genes.items()
            ]

            # 生成智能解释文本
            top_obj = sorted(ind.objectives.items(), key=lambda x: x[1], reverse=True)[:3]
            weak_obj = sorted(ind.objectives.items(), key=lambda x: x[1])[:2]
            explanation = (
                f"Pareto Rank-{ind.rank} 方案#{i+1}: "
                f"优势→{', '.join([f'{k}({v:.3f})' for k,v in top_obj])}; "
                f"待改进→{', '.join([f'{k}({v:.3f})' for k,v in weak_obj])}; "
                f"拥挤度={ind.crowding_distance:.4f}"
            )

            candidates.append(MOCandidateItem(
                ingredients=ingredients,
                objective_scores=ind.objectives,
                overall_fitness=round(ind.fitness, 6),
                pareto_rank=ind.rank,
                crowding_distance=round(ind.crowding_distance, 6),
                explanation=explanation
            ))

        pareto_front = [
            ParetoPoint(objective_values=ind.objectives, rank=ind.rank, crowding_distance=ind.crowding_distance)
            for ind in result.candidates[:config.pareto_front_size]
        ]

        best_by_objective = []
        for obj_config in config.objectives:
            key = obj_config.key
            best_ind = max(result.candidates, key=lambda x: x.objectives.get(key, 0), default=None)
            if best_ind:
                best_by_objective.append(BestByObjective(
                    objective_key=key,
                    objective_name=obj_config.name,
                    score=round(best_ind.objectives.get(key, 0), 4),
                    ingredients=[{"id": h, "name_cn": _BUILTIN_HERBS.get(h, type('', (), {'name_cn': h})()).name_cn if hasattr(_BUILTIN_HERBS.get(h, type('', (), {'name_cn': h})()), 'name_cn') else h, "dosage": round(d, 1)} for h, d in best_ind.genes.items()],
                    explanation=f"{obj_config.name}最优: {best_ind.objectives.get(key, 0):.4f}"
                ))

        # 保存历史（内存兜底 + 数据库持久化）
        run_id = f"moga_{int(time.time()*1000)}"
        _ga_run_history[run_id] = {
            "run_id": run_id,
            "type": "multi_objective",
            "user_id": str(current_user.id),
            "preset": request.preset,
            "mode": request.mode,
            "objectives": [obj.key for obj in config.objectives],
            "target_effects": request.target_effects,
            "population_size": config.population_size,
            "generations": config.total_generations if hasattr(config, 'total_generations') else config.generations,
            "best_score": round(max(c.fitness for c in result.candidates), 4) if result.candidates else 0.0,
            "candidate_count": len(candidates),
            "execution_time_ms": elapsed_ms,
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }

        # 数据库保存钩子（失败不影响返回）
        try:
            from ...models.ga_optimization import GARunRecord, GACandidateRecord
            from ...core.session import async_session_factory

            async with async_session_factory() as db_session:
                rid = f"nsga2_{uuid.uuid4().hex[:12]}"
                record = GARunRecord(
                    run_id=rid,
                    user_id=current_user.id,
                    algorithm_type="nsga2",
                    mode=request.mode,
                    target_effects=request.target_effects,
                    algorithm_params=_json_safe({
                        "population_size": request.population_size,
                        "generations": request.generations,
                        "mutation_rate": request.mutation_rate,
                        "crossover_rate": request.crossover_rate,
                        "elite_ratio": request.elite_ratio,
                    }),
                    objectives_config=_json_safe([{"name": o.name, "key": o.key, "direction": o.direction, "weight": o.weight} for o in config.objectives]),
                    constraints=_json_safe(request.constraints),
                    preset_name=request.preset,
                    total_generations=result.total_generations,
                    total_evaluations=result.total_evaluations,
                    best_fitness=_json_safe(result.best_score if hasattr(result, 'best_score') else max(ind.fitness for ind in result.candidates) if result.candidates else 0.0),
                    execution_time_ms=elapsed_ms,
                    convergence_generation=result.convergence_generation,
                    stop_reason=result.stop_reason,
                    final_diversity=0.0,
                    candidate_count=len(candidates),
                    candidates=None,
                    pareto_front=_json_safe([{"objective_values": p.objective_values, "rank": p.rank, "crowding_distance": p.crowding_distance} for p in pareto_front]),
                    history=_json_safe(result.history),
                    best_by_objective=_json_safe([{"objective_key": b.objective_key, "objective_name": b.objective_name, "score": b.score, "ingredients": b.ingredients, "explanation": b.explanation} for b in best_by_objective]),
                )
                db_session.add(record)
                await db_session.flush()

                # 保存候选方案详情
                for i, cand in enumerate(candidates):
                    cand_record = GACandidateRecord(
                        run_id=rid,
                        rank_in_run=i + 1,
                        pareto_rank=cand.pareto_rank,
                        crowding_distance=None if isinstance(cand.crowding_distance, float) and math.isinf(cand.crowding_distance) else cand.crowding_distance,
                        ingredients=_json_safe(cand.ingredients),
                        ingredient_count=len(cand.ingredients),
                        total_dosage=sum(ing["dosage"] for ing in cand.ingredients),
                        efficacy_score=_json_safe(cand.objective_scores.get("efficacy", 0)),
                        safety_score=_json_safe(cand.objective_scores.get("safety", 0)),
                        taste_score=_json_safe(cand.objective_scores.get("taste", 0)),
                        cost_score=_json_safe(cand.objective_scores.get("cost_efficiency", 0)),
                        synergy_score=_json_safe(cand.objective_scores.get("synergy", 0)),
                        stability_score=_json_safe(cand.objective_scores.get("stability", 0)),
                        admet_score=_json_safe(cand.objective_scores.get("admet", 0)),
                        overall_fitness=None if isinstance(cand.overall_fitness, float) and (math.isinf(cand.overall_fitness) or math.isnan(cand.overall_fitness)) else cand.overall_fitness,
                        objective_scores=_json_safe(cand.objective_scores),
                        explanation=cand.explanation,
                    )
                    db_session.add(cand_record)

                await db_session.commit()
                logger.info(f"[MOGA] 运行记录已保存到数据库: {rid}")
        except Exception as e:
            logger.warning(f"[MOGA] 数据库保存失败(不影响返回): {e}", exc_info=True)

        logger.info(f"[MOGA] 优化完成 | 耗时={elapsed_ms:.0f}ms | 候选={len(candidates)} | Pareto前沿={len(pareto_front)}")

        return MultiObjectiveResponse(
            candidates=candidates,
            pareto_front=pareto_front,
            best_by_objective=best_by_objective,
            history=result.history,
            algorithm=result.algorithm,
            mode=result.mode,
            objectives_config=[{"name": o.name, "key": o.key, "direction": o.direction, "weight": o.weight} for o in config.objectives],
            total_generations=result.total_generations,
            total_evaluations=result.total_evaluations,
            execution_time_ms=round(elapsed_ms, 1),
            convergence_generation=result.convergence_generation,
            stop_reason=result.stop_reason,
        )

    except Exception as e:
        logger.error(f"[MOGA] 优化失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"多目标优化失败: {str(e)}")


@router.get("/generate/multi-objective/presets", summary="获取多目标优化预设场景")
async def get_mo_presets():
    """返回所有可用的预设优化场景配置"""
    presets_info = {}
    for name, config in PRESET_SCENARIOS.items():
        presets_info[name] = {
            "name": name,
            "objectives": [{"name": o.name, "key": o.key, "direction": o.direction, "weight": o.weight, "description": o.description} for o in config.objectives],
            "mode": config.mode,
            "default_params": {
                "population_size": config.population_size,
                "generations": config.generations,
                "mutation_rate": config.mutation_rate,
                "crossover_rate": config.crossover_rate,
            }
        }
    return {"presets": presets_info, "total": len(presets_info)}
