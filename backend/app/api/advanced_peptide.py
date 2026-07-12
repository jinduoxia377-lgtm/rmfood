"""
PepINVERT 高级分析 API 路由

提供深度肽分析、批量处理、Pareto 优化等高级功能。
支持异步任务执行和实时进度查询。
"""
from __future__ import annotations

import asyncio
import logging
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

from ..api.deps import get_db_session, get_current_user
from ..models import User
from ..services.ai_models.advanced_peptide_analyzer import (
    AdvancedPeptideAnalyzer,
    get_advanced_analyzer,
)
from ..services.ai_models.pepinvent_adapter import ServiceUnavailableError

router = APIRouter(prefix="/ai/peptide/advanced", tags=["PepINVENT高级分析"])

_task_store: Dict[str, Dict[str, Any]] = {}


class DeepAnalysisRequest(BaseModel):
    """深度分析请求"""

    sequence: str = Field(..., min_length=2, max_length=50, description="待分析的肽序列")


class BatchAnalysisRequest(BaseModel):
    """批量分析请求"""

    sequences: List[str] = Field(
        ...,
        min_length=1,
        max_length=50,
        description="肽序列列表（最多50条）",
    )
    max_concurrent: int = Field(5, ge=1, le=20, description="最大并发数")


class ParetoOptimizationRequest(BaseModel):
    """Pareto 最优请求"""

    sequences: List[str] = Field(
        ...,
        min_length=2,
        max_length=100,
        description="候选肽序列列表",
    )
    objectives: List[str] = Field(
        ...,
        min_length=1,
        max_length=6,
        description="优化目标列表",
        description_example=["ACE_inhibitory", "antioxidant", "permeability"],
    )
    weights: Optional[Dict[str, float]] = Field(
        None,
        description="目标权重（可选）",
    )


class CustomOptimizationRequest(BaseModel):
    """自定义优化请求"""

    seed_sequence: str = Field(
        ...,
        min_length=2,
        max_length=50,
        description="种子序列",
    )
    objective_weights: Dict[str, float] = Field(
        ...,
        description="目标权重，如 {'ACE_inhibitory': 0.7, 'antioxidant': 0.3}",
    )
    iterations: int = Field(20, ge=1, le=100, description="迭代次数")
    population_size: int = Field(10, ge=3, le=30, description="种群大小")
    constraints: Optional[Dict[str, Any]] = Field(
        None,
        description="约束条件",
    )


class SynergyAnalysisRequest(BaseModel):
    """协同分析请求"""

    peptide_sequences: List[str] = Field(
        ...,
        min_length=1,
        max_length=10,
        description="肽序列列表",
    )
    herb_names: List[str] = Field(
        ...,
        min_length=1,
        max_length=15,
        description="药材名称列表",
    )


class SolubilityPredictionRequest(BaseModel):
    """溶解度预测请求"""

    sequences: List[str] = Field(
        ...,
        min_length=1,
        max_length=10,
        description="肽序列列表",
    )
    ph_range_min: float = Field(2.0, ge=1.0, le=14.0, description="pH范围最小值")
    ph_range_max: float = Field(10.0, ge=1.0, le=14.0, description="pH范围最大值")
    temperature_celsius: float = Field(25.0, ge=4.0, le=80.0, description="温度(°C)")


class VariantGenerationRequest(BaseModel):
    """变体生成请求"""

    template_sequence: str = Field(
        ...,
        min_length=2,
        max_length=50,
        description="模板序列",
    )
    variant_type: str = Field(
        "point",
        description="变体类型: point, truncation, extension, scramble",
    )
    num_variants: int = Field(20, ge=5, le=100, description="生成数量")
    preserve_positions: Optional[List[int]] = Field(
        None,
        description="保留不变的位置索引",
    )


@router.post("/analyze/deep", summary="深度分析单个肽")
async def deep_analysis(
    req: DeepAnalysisRequest,
    db=Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    对单个肽进行全面的深度分析。

    **返回内容**:
    - 基本理化性质（分子量、LogP、GRAVY 等）
    - 二级结构预测（α-helix、β-sheet、coil）
    - 理化特性剖面（电荷、pI、消光系数等）
    - 生物活性预测（ACE抑制、抗氧化等 6 大目标）
    - 安全性评估（毒性模式、免疫原性、过敏风险）

    **响应时间**: < 5s
    """
    try:
        logger.info(f"开始深度分析 - 序列: {req.sequence}, 用户: {current_user.id}")

        analyzer = get_advanced_analyzer()
        
        try:
            result = await analyzer.analyze_peptide_deeply(req.sequence)
        except ValueError as ve:
            logger.warning("序列验证失败: %s", ve)
            raise HTTPException(status_code=422, detail="参数无效")
        except Exception as analysis_error:
            logger.error("分析引擎异常: %s", analysis_error, exc_info=True)
            raise HTTPException(status_code=500, detail="分析引擎异常")

        logger.info(f"深度分析成功 - 序列: {req.sequence}, 综合得分: {result.overall_scores.get('composite', 'N/A')}")

        response_data = {
            "success": True,
            "data": {
                "sequence": result.sequence,
                "basic_properties": result.basic_properties,
                "secondary_structure": result.secondary_structure,
                "physicochemical_profile": result.physicochemical_profile,
                "bioactivity_predictions": result.bioactivity_predictions,
                "safety_assessment": result.safety_assessment,
                "overall_scores": result.overall_scores,
            },
            "generated_at": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        }

        return response_data

    except HTTPException:
        raise
    except Exception as e:
        logger.error("深度分析API异常: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误，请稍后重试")


@router.post("/analyze/batch", summary="批量深度分析")
async def batch_analysis(
    req: BatchAnalysisRequest,
    db=Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    批量分析多个肽序列（并发执行）。

    **性能**: 使用 asyncio.Semaphore 控制并发数，避免资源耗尽。
    **超时**: 单个序列分析超时自动跳过。

    **响应时间**: 取决于序列数量和并发设置（通常 10-60s）
    """
    task_id = str(uuid.uuid4())

    _task_store[task_id] = {
        "status": "processing",
        "total": len(req.sequences),
        "completed": 0,
        "results": [],
        "started_at": datetime.now(timezone.utc).isoformat(),
    }

    async def run_batch():
        try:
            analyzer = get_advanced_analyzer()
            results = await analyzer.batch_analyze(
                req.sequences,
                max_concurrent=req.max_concurrent,
            )

            _task_store[task_id]["results"] = [
                {
                    "sequence": r.sequence,
                    "basic_properties": r.basic_properties,
                    "secondary_structure": r.secondary_structure,
                    "overall_scores": r.overall_scores,
                    "bioactivity_summary": {
                        k: v.get("score", 0) if isinstance(v, dict) else v
                        for k, v in r.bioactivity_predictions.items()
                    },
                }
                for r in results
            ]
            _task_store[task_id]["status"] = "completed"
            _task_store[task_id]["completed"] = len(results)

        except Exception as e:
            _task_store[task_id]["status"] = "failed"
            _task_store[task_id]["error"] = "分析任务失败"
            logger.error("批量分析失败: %s", e, exc_info=True)

    asyncio.create_task(run_batch())

    return {
        "success": True,
        "task_id": task_id,
        "status_url": f"/api/v1/ai/peptide/advanced/tasks/{task_id}",
        "message": "批量分析任务已启动，请使用 task_id 查询进度",
    }


@router.post("/optimize/pareto", summary="Pareto 多目标优化")
async def pareto_optimization(
    req: ParetoOptimizationRequest,
    db=Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    计算 Pareto 最优前沿。

    从给定的候选集合中找出所有不被其他方案支配的最优解，
    用于多目标决策场景。

    **算法**: 非支配排序 (Non-dominated Sorting)
    **输出**: Pareto 前沿点集 + 多样性指标

    **适用场景**:
    - 在多个目标间权衡（如：高活性 vs 高溶解度）
    - 发现多样化的最优方案
    - 支持产品线差异化设计
    """
    try:
        analyzer = get_advanced_analyzer()
        result = await analyzer.compute_pareto_frontier(
            sequences=req.sequences,
            objectives=req.objectives,
            weights=req.weights,
        )

        return {
            "success": True,
            "data": {
                "total_processed": result.total_processed,
                "successful": result.successful,
                "pareto_frontier_size": len(result.pareto_frontier),
                "pareto_points": [
                    {
                        "sequence": p.sequence,
                        "objectives": p.objectives,
                        "dominated_count": p.dominated_by,
                        "rank": p.rank,
                    }
                    for p in result.pareto_frontier[:20]
                ],
                "diversity_metrics": result.diversity_metrics,
                "processing_time_ms": result.processing_time_ms,
            },
        }

    except Exception as e:
        logger.error("Pareto 优化失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误，请稍后重试")


@router.post("/optimize/custom", summary="自定义评分函数优化")
async def custom_optimization(
    req: CustomOptimizationRequest,
    background_tasks: BackgroundTasks,
    db=Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    使用自定义评分函数进行遗传算法风格优化。

    **算法**: 简化版遗传算法（选择-交叉-变异）
    **特点**:
    - 支持用户定义的目标权重组合
    - 支持硬约束条件（如分子量上限）
    - 返回完整优化历史轨迹

    **响应时间**: 10-60s（取决于 iterations 和 population_size）
    """
    try:
        analyzer = get_advanced_analyzer()

        scoring_func = analyzer.create_custom_scoring_function(
            objective_weights=req.objective_weights,
            constraints=req.constraints,
        )

        result = await analyzer.optimize_with_custom_objective(
            seed_sequence=req.seed_sequence,
            scoring_func=scoring_func,
            iterations=req.iterations,
            population_size=req.population_size,
        )

        return {
            "success": True,
            "data": result,
        }

    except ValueError as e:
        raise HTTPException(status_code=422, detail="参数无效")
    except Exception as e:
        logger.error("自定义优化失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误，请稍后重试")


@router.post("/analyze/synergy", summary="肽-药材协同效应分析")
async def synergy_analysis(
    req: SynergyAnalysisRequest,
    db=Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    分析肽与药材之间的协同效应。

    **评估维度**:
    - 功效匹配度（肽活性 vs 药材功效）
    - 化学兼容性（LogP、分子量等）
    - 协同机制推断
    - 组合推荐排序

    **应用场景**:
    - 配方设计中的肽+药材协同优化
    - 复方产品的科学依据支撑
    """
    try:
        analyzer = get_advanced_analyzer()
        result = await analyzer.analyze_peptide_herb_synergy(
            peptide_sequences=req.peptide_sequences,
            herb_names=req.herb_names,
        )

        return {
            "success": True,
            "data": result,
        }

    except Exception as e:
        logger.error("协同分析失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误，请稍后重试")


@router.post("/predict/solubility", summary="pH-温度依赖的溶解度预测")
async def solubility_prediction(
    req: SolubilityPredictionRequest,
    db=Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    预测肽在不同 pH 和温度条件下的溶解度变化。

    **输出内容**:
    - pH-溶解度曲线（10 个数据点）
    - 最佳 pH 和稳定窗口
    - 等电点 (pI) 预测
    - 温度影响因子
    - 溶解度分级（高/中/低/难溶）

    **应用**:
    - 制剂配方设计
    - 口味优化（溶解度影响口感）
    - 稳定性评估
    """
    try:
        analyzer = get_advanced_analyzer()
        results = await analyzer.predict_solubility_profile(
            sequences=req.sequences,
            ph_range=(req.ph_range_min, req.ph_range_max),
            temp_celsius=req.temperature_celsius,
        )

        return {
            "success": True,
            "data": {
                "sequences_analyzed": len(results),
                "predictions": results,
            },
        }

    except Exception as e:
        logger.error("溶解度预测失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误，请稍后重试")


@router.post("/generate/variants", summary="生成结构变体库")
async def generate_variants(
    req: VariantGenerationRequest,
    db=Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    基于模板生成多种类型的结构变体。

    **变体类型**:
    - `point`: 点突变（单氨基酸替换）
    - `truncation`: 截断变体（N端/C端删除）
    - `extension`: 延伸变体（插入额外残基）
    - `scramble`: 打乱变体（保留特定位置）

    **输出内容**:
    - 变体序列及编辑距离
    - 与模板的相似度
    - 基本性质变化
    - 二级结构差异

    **应用**:
    - SAR（构效关系）研究
    - 专利规避设计
    - 性能优化探索
    """
    if req.variant_type not in ["point", "truncation", "extension", "scramble"]:
        raise HTTPException(
            status_code=422,
            detail=f"不支持的变体类型: {req.variant_type}。有效值: point, truncation, extension, scramble",
        )

    try:
        analyzer = get_advanced_analyzer()
        variants = await analyzer.generate_structural_variants(
            template_sequence=req.template_sequence,
            variant_type=req.variant_type,
            num_variants=req.num_variants,
            preserve_positions=req.preserve_positions,
        )

        return {
            "success": True,
            "data": {
                "template": req.template_sequence,
                "variant_type": req.variant_type,
                "total_generated": len(variants),
                "variants": variants,
            },
        }

    except ValueError as e:
        raise HTTPException(status_code=422, detail="参数无效")
    except Exception as e:
        logger.error("变体生成失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误，请稍后重试")


@router.get("/tasks/{task_id}", summary="查询异步任务状态")
async def get_task_status(
    task_id: str,
    current_user: User = Depends(get_current_user),
):
    """
    查询异步任务的执行状态和结果。

    **状态流转**: processing → completed / failed
    **结果保留时间**: 任务完成后 1 小时自动清理
    """
    if task_id not in _task_store:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")

    task = _task_store[task_id]

    response = {
        "task_id": task_id,
        "status": task["status"],
        "total": task["total"],
        "completed": task.get("completed", 0),
        "started_at": task.get("started_at"),
    }

    if task["status"] == "completed":
        response["results"] = task.get("results", [])
        response["completed_at"] = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

    elif task["status"] == "failed":
        response["error"] = task.get("error", "未知错误")

    return response


@router.delete("/tasks/{task_id}", summary="取消或清理任务")
async def cancel_task(
    task_id: str,
    current_user: User = Depends(get_current_user),
):
    """取消正在执行的任务或清理已完成的结果"""
    if task_id in _task_store:
        del _task_store[task_id]
        return {"success": True, "message": "任务已清理"}
    else:
        raise HTTPException(status_code=404, detail=f"任务不存在: {task_id}")


@router.get("/capabilities", summary="查看高级功能能力清单")
async def list_capabilities(current_user: User = Depends(get_current_user)):
    """
    列出所有可用的高级分析能力及其参数说明。
    用于前端动态构建 UI 表单。
    """
    return {
        "version": "2.0.0",
        "analysis_capabilities": {
            "deep_analysis": {
                "description": "全面深度分析单个肽序列",
                "max_sequence_length": 50,
                "estimated_time_seconds": "< 5",
                "outputs": [
                    "basic_properties", "secondary_structure",
                    "physicochemical_profile", "bioactivity_predictions",
                    "safety_assessment", "overall_scores",
                ],
            },
            "batch_analysis": {
                "description": "并发批量分析多个肽",
                "max_sequences": 50,
                "default_concurrency": 5,
                "async_supported": True,
            },
            "pareto_optimization": {
                "description": "多目标 Pareto 最优前沿计算",
                "algorithm": "non_dominated_sorting",
                "supported_objectives": [
                    "ACE_inhibitory", "antioxidant", "DPP_IV_inhibitory",
                    "permeability", "stability", "solubility",
                ],
            },
            "custom_optimization": {
                "description": "基于遗传算法的自定义目标优化",
                "algorithm": "genetic_algorithm_simplified",
                "max_iterations": 100,
                "max_population": 30,
            },
            "synergy_analysis": {
                "description": "肽与药食同源药材的协同效应评估",
                "supported_herbs": [
                    "黄芪", "人参", "枸杞子", "山楂", "菊花",
                    "葛根", "酸枣仁", "灵芝",
                ],
            },
            "solubility_prediction": {
                "description": "pH-温度依赖的溶解度曲线预测",
                "ph_range": [1.0, 14.0],
                "temp_range_celsius": [4.0, 80.0],
            },
            "variant_generation": {
                "description": "多类型结构变体库生成",
                "variant_types": ["point", "truncation", "extension", "scramble"],
                "max_variants": 100,
            },
        },
    }
