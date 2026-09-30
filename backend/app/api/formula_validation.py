"""
配方在线验证工作流 API

提供以下能力：
- 一键触发配方全流程验证（安全性→兼容性→功效→稳定性→风味→协同）
- 验证工作流状态查询与进度追踪
- 预测值与实验实测值对比分析
- 验证报告生成与导出
"""
from typing import Optional, List, Dict, Any
import logging

from fastapi import APIRouter, Depends, HTTPException, Query, BackgroundTasks
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import selectinload

from app.api.deps import get_db_session, get_current_user
from app.models import (
    Formula, Experiment, Workflow, WorkflowTask,
    WorkflowStatus, TaskStatus, User,
)
from app.schemas.workflow import WorkflowResponse, WorkflowTaskResponse
from app.services.formula_validation_workflow import (
    FormulaValidationService,
    ValidationStage,
    ValidationOutcome,
    FormulaValidationResult,
)
import asyncio


async def _run_validation_bg(
    db: AsyncSession,
    workflow_id: int,
    validation_id: str,
    stages: List[ValidationStage],
    experiment_id: Optional[int],
    config: Dict[str, Any],
):
    """后台验证管线（使用请求会话，避免连接池耗尽）"""
    from app.services.formula_validation_workflow import FormulaValidationService
    service = FormulaValidationService(db)
    await service._run_validation_pipeline(workflow_id, validation_id, stages, experiment_id, config)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/formulas", tags=["配方在线验证"])


# ═══════════════════════════════════════════════════════════
# Pydantic 请求/响应模型
# ═══════════════════════════════════════════════════════════

class FormulaValidationRequest(BaseModel):
    """触发验证请求"""
    experiment_id: Optional[int] = Field(None, description="关联实验 ID（可选，如有则自动对比预测值与实测值）")
    validation_stages: Optional[List[str]] = Field(
        None,
        description="要执行的验证阶段列表，默认为全部阶段",
        examples=[
            ["safety_check", "compatibility_check", "efficacy_prediction"],
            ["safety_check", "compatibility_check", "efficacy_prediction", "stability_prediction", "taste_prediction", "synergy_analysis"],
        ],
    )
    parallel: bool = Field(False, description="是否并行执行所有阶段（默认串行）")
    daily_dosage_g: float = Field(10.0, ge=0.1, le=100, description="每日推荐剂量（克）")
    target_population: str = Field("adult", description="目标人群")
    body_weight_kg: float = Field(65.0, ge=30, le=150, description="参考体重（kg）")
    storage_temp_c: float = Field(25.0, description="储存温度（℃）")
    storage_humidity: float = Field(60.0, description="相对湿度（%）")


class ValidationStageResult(BaseModel):
    """单阶段结果"""
    stage: str
    success: bool
    score: float
    passed: bool
    latency_ms: float
    details: dict = {}
    warnings: List[str] = []
    errors: List[str] = []


class PredictionComparison(BaseModel):
    """预测值与实验值对比"""
    parameter: str
    unit: str
    predicted_value: float
    predicted_range: List[float]
    measured_value: Optional[float] = None
    measured_range: Optional[List[float]] = None
    deviation_percent: float
    within_tolerance: bool
    confidence: str


class FormulaValidationResponse(BaseModel):
    """验证响应"""
    success: bool
    validation_id: str
    formula_id: int
    formula_name: str
    overall_score: float
    outcome: str  # passed / conditional / failed / inconclusive
    stages: List[ValidationStageResult]
    comparisons: List[PredictionComparison]
    recommendations: List[str]
    total_latency_ms: float
    error_message: Optional[str] = None


class ValidationProgressResponse(BaseModel):
    """进度查询响应"""
    validation_id: str
    formula_id: int
    formula_name: str
    workflow_id: Optional[int] = None
    status: str  # pending / in_progress / completed / failed
    current_stage: Optional[str] = None
    stage_index: int
    total_stages: int
    progress_percent: int
    current_score: float
    message: str


# ═══════════════════════════════════════════════════════════
# API 端点
# ═══════════════════════════════════════════════════════════

@router.post("/{formula_id}/validate", response_model=FormulaValidationResponse, summary="一键触发配方验证")
async def trigger_formula_validation(
    formula_id: int,
    payload: FormulaValidationRequest,
    background_tasks: BackgroundTasks,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    一键触发配方全流程在线验证。

    系统会自动按以下顺序执行验证阶段：
    1. **安全性检查** — GB 16740 / ADI / UL 阈值比对
    2. **兼容性检测** — 4层架构成分相互作用分析
    3. **功效预测** — PopPK/PD 模型模拟
    4. **稳定性预测** — 货架期与降解速率模拟
    5. **风味评分** — 感官特性预测
    6. **协同效应分析** — 网络药理学预测
    7. **数据对比** — 如有关联实验，自动对比预测值与实测值

    验证在后台异步执行，可通过 GET /formulas/{formula_id}/validation/{validation_id} 查询进度。
    """
    # 验证配方存在
    formula = (await db.execute(select(Formula).where(Formula.id == formula_id))).scalar_one_or_none()
    if not formula:
        raise HTTPException(status_code=404, detail=f"配方 {formula_id} 不存在")

    # 验证关联实验（如有）
    if payload.experiment_id:
        experiment = (await db.execute(
            select(Experiment).where(Experiment.id == payload.experiment_id)
        )).scalar_one_or_none()
        if not experiment:
            raise HTTPException(status_code=404, detail=f"关联实验 {payload.experiment_id} 不存在")
        if experiment.formula_id != formula_id:
            raise HTTPException(status_code=400, detail="关联实验不属于该配方")

    # 构建服务并执行
    service = FormulaValidationService(db)
    config = {
        "formula_id": formula_id,
        "formula_name": formula.name,
        "daily_dosage_g": payload.daily_dosage_g,
        "target_population": payload.target_population,
        "body_weight_kg": payload.body_weight_kg,
        "storage_temp_c": payload.storage_temp_c,
        "storage_humidity": payload.storage_humidity,
    }

    try:
        workflow, result = await service.create_validation_workflow(
            formula_id=formula_id,
            user_id=current_user.id,
            experiment_id=payload.experiment_id,
            validation_order=payload.validation_stages,
            parallel=payload.parallel,
            config=config,
        )
    except Exception as e:
        logger.error("创建验证工作流失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"验证启动失败: {e}")

    from app.services.formula_validation_workflow import DEFAULT_VALIDATION_ORDER

    # 启动后台验证管线（同步等待完成，确保任务执行）
    stages_list = payload.validation_stages or DEFAULT_VALIDATION_ORDER
    print(f"[DEBUG] Starting validation pipeline for workflow {workflow.id}, stages={stages_list}", flush=True)
    try:
        await _run_validation_bg(db, workflow.id, result.validation_id,
                          [ValidationStage(s) for s in stages_list],
                          payload.experiment_id, config)
        print(f"[DEBUG] Validation pipeline completed", flush=True)
    except Exception as e:
        print(f"[DEBUG] Validation pipeline error: {e}", flush=True)
        logger.error("验证管线执行失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail=f"验证执行失败: {e}")

    # 重新加载结果（从数据库获取最新状态）
    await db.refresh(workflow)
    wf_result = workflow.result or {}

    return FormulaValidationResponse(
        success=True,
        validation_id=result.validation_id,
        formula_id=result.formula_id,
        formula_name=result.formula_name,
        overall_score=wf_result.get("overall_score", 0.0),
        outcome=wf_result.get("outcome", "failed"),
        stages=[ValidationStageResult(**s) for s in wf_result.get("stages", [])],
        comparisons=[PredictionComparison(**c) for c in wf_result.get("comparisons", [])],
        recommendations=wf_result.get("recommendations", []),
        total_latency_ms=wf_result.get("total_latency_ms", 0.0),
        error_message=wf_result.get("error_message"),
    )


@router.get("/{formula_id}/validation/{validation_id}", response_model=ValidationProgressResponse, summary="查询验证进度")
async def get_validation_progress(
    formula_id: int,
    validation_id: str,
    db: AsyncSession = Depends(get_db_session),
):
    """
    查询配方验证工作流的实时进度和结果。

    适用于前端轮询或 WebSocket 断线后的状态恢复。
    """
    from app.models import Workflow

    # 优先通过 workflow ID 精确查询（validation_id 格式: val-{formula_id}-{timestamp}）
    workflow = None
    try:
        parts = validation_id.split("-")
        if len(parts) >= 3:
            wf_id = int(parts[-1])
            workflow = (await db.execute(
                select(Workflow)
                .where(Workflow.id == wf_id)
                .options(selectinload(Workflow.tasks))
            )).scalar_one_or_none()
    except (ValueError, IndexError):
        pass

    # 精确匹配未找到，尝试按 formula_id 前缀匹配
    if not workflow:
        result = (await db.execute(
            select(Workflow)
            .where(Workflow.workflow_type == "formula_validation")
            .order_by(Workflow.created_at.desc())
            .limit(20)
        ))
        candidates = result.scalars().all()
        for c in candidates:
            if c.config and str(c.config.get("formula_id")) == str(formula_id):
                workflow = c
                break
        # 加载任务
        if workflow:
            await db.refresh(workflow, ["tasks"])

    if not workflow:
        raise HTTPException(status_code=404, detail="验证工作流不存在")

    # 构建进度响应
    tasks = sorted(workflow.tasks or [], key=lambda t: t.step_order)
    completed = sum(1 for t in tasks if t.status == TaskStatus.COMPLETED)
    failed = sum(1 for t in tasks if t.status == TaskStatus.FAILED)
    running = sum(1 for t in tasks if t.status == TaskStatus.IN_PROGRESS)
    total = len(tasks)

    # 当前执行阶段
    current_stage = None
    running_task = next((t for t in tasks if t.status == TaskStatus.IN_PROGRESS), None)
    if running_task:
        current_stage = running_task.name
    elif failed > 0:
        failed_task = next((t for t in tasks if t.status == TaskStatus.FAILED), None)
        current_stage = failed_task.name if failed_task else "error"
    elif completed == total:
        current_stage = "completed"

    progress_pct = int((completed / total) * 100) if total > 0 else 0

    # 计算当前分数
    current_score = 0
    if workflow.result:
        current_score = workflow.result.get("overall_score", 0)

    return ValidationProgressResponse(
        validation_id=validation_id,
        formula_id=formula_id,
        formula_name=workflow.name,
        workflow_id=workflow.id,
        status=workflow.status.value,
        current_stage=current_stage,
        stage_index=completed + (1 if running else 0),
        total_stages=total,
        progress_percent=progress_pct,
        current_score=current_score,
        message=f"已完成 {completed}/{total} 个验证阶段" if workflow.status == WorkflowStatus.IN_PROGRESS else
                ("验证完成，整体评分 {:.1f}".format(current_score) if workflow.status == WorkflowStatus.COMPLETED else
                 f"验证失败: {workflow.error_message}" if workflow.error_message else "验证失败"),
    )


@router.get("/{formula_id}/validation", response_model=List[FormulaValidationResponse], summary="查询配方的历史验证记录")
async def list_formula_validations(
    formula_id: int,
    limit: int = Query(10, ge=1, le=50, description="返回数量上限"),
    db: AsyncSession = Depends(get_db_session),
):
    """
    获取某配方的历史验证记录列表。
    """
    # 验证配方存在
    formula = (await db.execute(select(Formula).where(Formula.id == formula_id))).scalar_one_or_none()
    if not formula:
        raise HTTPException(status_code=404, detail=f"配方 {formula_id} 不存在")

    from app.models import Workflow

    # 查询该配方的所有验证工作流（config 可能为 JSON 而非 JSONB，用 Python 过滤）
    result = (await db.execute(
        select(Workflow)
        .where(Workflow.workflow_type == "formula_validation")
        .order_by(Workflow.created_at.desc())
        .limit(limit * 2)  # 多取一些以防过滤
    ))
    workflows = result.scalars().all()

    # Python 层过滤 formula_id
    workflows = [wf for wf in workflows if wf.config and str(wf.config.get("formula_id")) == str(formula_id)]

    responses = []
    for wf in workflows:
        if wf.result:
            r = wf.result
            responses.append(FormulaValidationResponse(
                success=True,
                validation_id=r.get("validation_id", ""),
                formula_id=r.get("formula_id", formula_id),
                formula_name=r.get("formula_name", formula.name),
                overall_score=r.get("overall_score", 0),
                outcome=r.get("outcome", "inconclusive"),
                stages=[ValidationStageResult(**s) for s in r.get("stages", [])],
                comparisons=[PredictionComparison(**c) for c in r.get("comparisons", [])],
                recommendations=r.get("recommendations", []),
                total_latency_ms=r.get("total_latency_ms", 0),
                error_message=r.get("error_message"),
            ))

    return responses


@router.post("/{formula_id}/validation/{validation_id}/retry", response_model=FormulaValidationResponse, summary="重试失败的验证阶段")
async def retry_validation(
    formula_id: int,
    validation_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
):
    """
    重新执行验证工作中失败的阶段。
    """
    from app.models import Workflow, WorkflowTask

    # 查询最新一条该配方的验证工作流
    result = (await db.execute(
        select(Workflow)
        .where(Workflow.workflow_type == "formula_validation")
        .order_by(Workflow.created_at.desc())
        .limit(20)
    ))
    candidates = result.scalars().all()
    workflow = None
    for c in candidates:
        if c.config and str(c.config.get("formula_id")) == str(formula_id):
            workflow = c
            break

    if not workflow:
        raise HTTPException(status_code=404, detail="验证工作流不存在")

    if workflow.status not in (WorkflowStatus.FAILED, WorkflowStatus.COMPLETED):
        raise HTTPException(status_code=400, detail=f"工作流状态为 {workflow.status.value}，无法重试")

    # 找出失败的阶段
    failed_tasks = [t for t in (workflow.tasks or []) if t.status == TaskStatus.FAILED]
    if not failed_tasks:
        raise HTTPException(status_code=400, detail="没有失败的阶段需要重试")

    # 重置失败任务并重试
    service = FormulaValidationService(db)
    stage_names = [t.name.lower().replace(" ", "_") for t in failed_tasks]
    config = {
        "formula_id": formula_id,
        "formula_name": workflow.config.get("formula_name", formula.name),
        "daily_dosage_g": workflow.config.get("daily_dosage_g", 10),
        "target_population": workflow.config.get("target_population", "adult"),
        "body_weight_kg": workflow.config.get("body_weight_kg", 65),
        "experiment_id": workflow.config.get("experiment_id"),
        **{k: v for k, v in workflow.config.items() if k not in ("formula_id", "formula_name", "experiment_id")},
    }

    workflow, result = await service.create_validation_workflow(
        formula_id=formula_id,
        user_id=current_user.id,
        validation_order=stage_names,
        config=config,
    )

    return FormulaValidationResponse(
        success=True,
        validation_id=result.validation_id,
        formula_id=result.formula_id,
        formula_name=result.formula_name,
        overall_score=result.overall_score,
        outcome=result.outcome.value,
        stages=[ValidationStageResult(**s.to_dict()) for s in result.stages],
        comparisons=[PredictionComparison(**c.to_dict()) for c in result.comparisons],
        recommendations=result.recommendations,
        total_latency_ms=result.total_latency_ms,
        error_message=result.error_message,
    )
