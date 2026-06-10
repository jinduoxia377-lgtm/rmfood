"""
PepINVENT 肽设计 API 路由

提供肽序列生成、优化、采样和状态查询的 RESTful 接口。
所有端点需要用户认证。

端点概览:
- POST /ai/peptide/generate - 基于功效目标生成肽候选
- POST /ai/peptide/optimize - 使用 RL 优化肽序列
- POST /ai/peptide/sample - 探索性多样化采样
- GET /ai/peptide/status - 查看服务状态
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

from ..api.deps import get_db_session, get_current_user
from ..models import User
from ..services.ai_models.pepinvent_service import (
    PepinventService,
    get_pepinvent_service,
    ServiceUnavailableError,
)

router = APIRouter(prefix="/ai/peptide", tags=["PepINVENT肽设计"])


class PeptideGenerateRequest(BaseModel):
    """肽生成请求"""

    target_effects: List[str] = Field(
        ...,
        min_length=1,
        max_length=5,
        description="目标功效列表，如 ['ACE抑制', '抗氧化']",
    )
    max_candidates: int = Field(
        5,
        ge=1,
        le=50,
        description="最大候选数量 (1-50)",
    )
    constraints: Optional[Dict[str, Any]] = Field(
        None,
        description="约束条件，可包含：min_length, max_length, exclude_sequences 等",
    )


class PeptideOptimizeRequest(BaseModel):
    """肽优化请求"""

    seed_sequence: str = Field(
        ...,
        min_length=2,
        max_length=50,
        description="种子肽序列（2-50个氨基酸）",
    )
    optimization_goals: Dict[str, float] = Field(
        ...,
        description="优化目标及权重，如 {'ACE_inhibitory': 0.6, 'permeability': 0.4}",
    )
    iterations: int = Field(
        10,
        ge=1,
        le=100,
        description="RL 迭代次数 (1-100)",
    )


class PeptideSampleRequest(BaseModel):
    """探索性采样请求"""

    sample_size: int = Field(
        20,
        ge=1,
        le=100,
        description="采样数量 (1-100)",
    )
    temperature: Optional[float] = Field(
        None,
        ge=0.1,
        le=5.0,
        description="采样温度（越高越随机）",
    )
    top_k: Optional[int] = Field(
        None,
        ge=1,
        le=200,
        description="Top-K 采样参数",
    )
    diversity_metric: str = Field(
        "tanimoto",
        description="多样性度量方法：tanimoto, jaccard, overlap",
    )


@router.post("/generate", summary="基于功效生成肽候选")
async def generate_peptides(
    req: PeptideGenerateRequest,
    db=Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    基于目标功效使用 PepINVERT 生成肽候选序列。

    **功能说明**:
    - 将业务功效（如"ACE抑制"、"抗氧化"）映射为分子级优化目标
    - 从预训练的生成模型中采样多样化的肽序列
    - 计算每个肽的理化性质和活性预测得分
    - 返回按综合评分排序的结果

    **支持的功效**:
    - ACE抑制 / 降血压 → ACE_inhibitory 目标
    - 抗氧化 → antioxidant 目标
    - DPP-IV抑制 / 降血糖 → DPP_IV_inhibitory 目标
    - 渗透性 / 膜渗透 → permeability 目标

    **返回示例**:
    ```json
    {
      "peptides": [
        {
          "sequence": "VLGYT",
          "molecular_weight": 563.64,
          "logp": -0.4,
          "activity_scores": {"ACE_inhibitory": 0.75},
          "composite_score": 0.78
        }
      ],
      "total": 5,
      "diversity_metrics": {...}
    }
    ```
    """
    try:
        service = get_pepinvent_service()
        response = await service.generate_peptides(
            target_effects=req.target_effects,
            constraints=req.constraints,
            max_candidates=req.max_candidates,
        )

        return {
            "success": True,
            "data": {
                "peptides": response.peptides,
                "total": response.total,
                "generation_method": response.generation_method,
                "target_effects": response.target_effects,
                "diversity_metrics": response.diversity_metrics,
                "generated_at": response.generated_at,
                "processing_time_ms": response.processing_time_ms,
            },
        }

    except ValueError as e:
        logger.warning(f"参数验证失败: {e}")
        raise HTTPException(status_code=422, detail=str(e))
    except ServiceUnavailableError as e:
        logger.error(f"PepINVERT 服务不可用: {e}")
        raise HTTPException(
            status_code=503,
            detail={
                "error": "PepINVERT 服务暂时不可用",
                "message": str(e),
                "missing_dependencies": e.missing_deps,
                "suggestion": "请检查依赖安装或稍后重试。当前将回退到规则引擎模式。",
            },
        )
    except Exception as e:
        logger.error(f"肽生成失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"肽生成服务异常: {str(e)}")


@router.post("/optimize", summary="使用 RL 优化肽序列")
async def optimize_peptide(
    req: PeptideOptimizeRequest,
    db=Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    使用强化学习（RL）优化给定的肽序列。

    **功能说明**:
    - 基于种子序列进行多轮迭代优化
    - 支持多目标同时优化（加权组合）
    - 返回优化后的变体及其改进幅度

    **支持的优化目标**:
    - `ACE_inhibitory`: ACE 抑制活性（降血压）
    - `antioxidant`: 抗氧化活性
    - `DPP_IV_inhibitory`: DPP-IV 抑制活性（降血糖）
    - `permeability`: 细胞膜渗透性
    - `stability`: 结构稳定性
    - `solubility`: 水溶性

    **权重约束**:
    - 所有权重必须 > 0 且 ≤ 1.0
    - 权重总和应接近 1.0

    **返回示例**:
    ```json
    {
      "optimized_peptides": [
        {
          "sequence": "VLGFYT",
          "scores": {"ACE_inhibitory": 0.85},
          "weighted_score": 0.85,
          "improvement_over_seed": 0.15,
          "iteration_improved": 5
        }
      ]
    }
    ```
    """
    try:
        service = get_pepinvent_service()
        response = await service.optimize_peptide(
            seed_sequence=req.seed_sequence,
            optimization_goals=req.optimization_goals,
            iterations=req.iterations,
        )

        return {
            "success": True,
            "data": {
                "optimized_peptides": response.optimized_peptides,
                "total": response.total,
                "optimization_goals": response.optimization_goals,
                "seed_count": response.seed_count,
                "iterations_performed": response.iterations_performed,
                "generated_at": response.generated_at,
                "processing_time_ms": response.processing_time_ms,
            },
        }

    except ValueError as e:
        logger.warning(f"参数验证失败: {e}")
        raise HTTPException(status_code=422, detail=str(e))
    except ServiceUnavailableError as e:
        logger.error(f"PepINVERT 服务不可用: {e}")
        raise HTTPException(status_code=503, detail=f"服务不可用: {str(e)}")
    except Exception as e:
        logger.error(f"RL 优化失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"优化服务异常: {str(e)}")


@router.post("/sample", summary="探索性多样化采样")
async def sample_diverse_peptides(
    req: PeptideSampleRequest,
    db=Depends(get_db_session),
    current_user: User = Depends(get_current_user),
):
    """
    执行探索性采样以获取高多样性的肽集合。

    **功能说明**:
    - 从预训练模型中大量采样
    - 使用贪心算法选择最大化多样性的子集
    - 提供详细的多样性指标分析

    **参数说明**:
    - `temperature`: 控制采样随机性（越高越创新）
    - `top_k`: 限制每步采样的候选数
    - `diversity_metric`: 相似度计算方法

    **返回示例**:
    ```json
    {
      "peptides": [...],
      "total": 20,
      "diversity_metrics": {
        "diversity_score": 0.85,
        "unique_count": 20,
        "average_similarity": 0.25
      }
    }
    ```
    """
    try:
        service = get_pepinvent_service()
        response = await service.sample_diverse_peptides(
            sample_size=req.sample_size,
            temperature=req.temperature,
            top_k=req.top_k,
            diversity_metric=req.diversity_metric,
        )

        return {
            "success": True,
            "data": {
                "peptides": response.peptides,
                "total": response.total,
                "diversity_metrics": response.diversity_metrics,
                "sampling_parameters": response.sampling_parameters,
                "generated_at": response.generated_at,
                "processing_time_ms": response.processing_time_ms,
            },
        }

    except ValueError as e:
        logger.warning(f"参数验证失败: {e}")
        raise HTTPException(status_code=422, detail=str(e))
    except ServiceUnavailableError as e:
        logger.error(f"PepINVERT 服务不可用: {e}")
        raise HTTPException(status_code=503, detail=f"服务不可用: {str(e)}")
    except Exception as e:
        logger.error(f"探索性采样失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"采样服务异常: {str(e)}")


@router.get("/status", summary="查看 PepINVERT 服务状态")
async def get_pepinvent_status(
    current_user: User = Depends(get_current_user),
):
    """
    查看 PepINVERT 服务的运行状态和配置信息。

    **返回内容**:
    - 服务是否可用
    - 是否处于模拟模式
    - 依赖库状态
    - 当前配置参数
    - 缓存统计
    """
    try:
        service = get_pepinvent_service()
        status = service.get_service_status()

        return {
            "service_name": status["service_name"],
            "version": status["version"],
            "available": status["adapter_status"]["available"],
            "initialized": status["adapter_status"]["initialized"],
            "simulation_mode": status["adapter_status"]["simulation_mode"],
            "device": status["adapter_status"]["device"],
            "dependencies": status["adapter_status"]["dependencies"],
            "config": status["adapter_status"]["config"],
            "cache_stats": status["cache_stats"],
        }

    except Exception as e:
        logger.error(f"获取状态失败: {e}", exc_info=True)
        return {
            "error": f"无法获取服务状态: {str(e)}",
            "available": False,
            "simulation_mode": True,
        }


@router.delete("/cache", summary="清除缓存")
async def clear_cache(
    current_user: User = Depends(get_current_user),
):
    """清除 PepINVERT 服务的响应缓存"""
    try:
        service = get_pepinvent_service()
        service.clear_cache()
        return {"success": True, "message": "缓存已清除"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"清除缓存失败: {str(e)}")
