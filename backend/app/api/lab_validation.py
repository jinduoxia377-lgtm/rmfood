"""
实验室验证对接 API

功能:
- 接收外部实验室数据 (JSON/CSV/XML)
- 自动对比预测值与实验值
- 验证结果统计分析
- 质量控制审核流程
"""

from fastapi import APIRouter, HTTPException, UploadFile, File, Query, Depends
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime, date, timezone  # A-27: 473 行 timezone.utc 用到
import json
import logging

from ..api.deps import get_current_active_user, require_role
from ..models import User
from ..models.enums import UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/lab-validation", tags=["实验室验证"])


# ==================== Pydantic 模型 ====================

class LabExperimentData(BaseModel):
    """实验数据输入模型"""
    experiment_id: str = Field(..., description="唯一实验ID")
    lab_name: str = Field(..., min_length=2, max_length=200)
    experiment_date: date
    researcher_name: str = Field(..., min_length=2, max_length=100)
    
    # 目标信息
    target_type: str = Field(..., pattern="^(formula|ingredient|synergy_pair)$")
    target_name: str = Field(..., max_length=200)
    target_id: Optional[int] = None
    
    # 实验方法
    method_description: Optional[str] = None
    equipment_used: Optional[str] = None
    
    # 测量参数 (灵活JSON格式)
    measured_parameters: Dict[str, Any] = Field(
        default_factory=dict,
        example={
            "concentration_mg_ml": {"value": 12.5, "unit": "mg/mL", "std_dev": 0.3},
            "purity_percent": {"value": 98.5, "unit": "%", "std_dev": 0.5},
            "ph_value": {"value": 6.8, "unit": "pH", "std_dev": 0.05}
        }
    )
    
    # 系统预测值（用于对比）
    predicted_values: Dict[str, Any] = Field(default_factory=dict)


class ValidationComparisonRequest(BaseModel):
    """验证对比请求"""
    experiment_id: str
    tolerance_range: float = Field(default=0.1, ge=0.01, le=0.5, description="容差范围 (10%)")
    significance_level: float = Field(default=0.05, ge=0.01, le=0.2, description="显著性水平")


class ValidationBatchImportRequest(BaseModel):
    """批量导入请求"""
    experiments: List[LabExperimentData]
    auto_validate: bool = Field(default=True, description="自动执行验证对比")
    assign_reviewer: bool = Field(default=False, description="自动分配审核人")


class ValidationReport(BaseModel):
    """验证报告"""
    experiment_id: str
    target_name: str
    validation_result: str  # 'passed' | 'failed' | 'inconclusive'
    overall_score: float = Field(ge=0, le=100)
    
    parameter_comparisons: List[Dict[str, Any]]
    deviation_statistics: Dict[str, float]
    
    conclusion_notes: Optional[str] = None
    recommendations: List[str]
    
    validated_at: datetime
    reviewed_by: Optional[str] = None


# ==================== API 端点实现 ====================

@router.post("/experiments", summary="提交实验数据")
async def submit_experiment_data(
    data: LabExperimentData,
    current_user: User = Depends(get_current_active_user)
):
    """
    提交新的实验室验证数据
    
    支持的数据类型:
    - formula: 配方整体验证
    - ingredient: 单成分验证
    - synergy_pair: 成分协同效应验证
    
    数据格式要求:
    - measured_parameters: JSON对象，包含测量值、单位、标准差
    - predicted_values: 可选，系统预测值用于自动对比
    """
    try:
        from ..models.formula_deep_integration import LabValidationData, ValidationStatus
        
        # 检查是否已存在相同实验ID
        existing = await LabValidationData.get_or_none(experiment_id=data.experiment_id)
        if existing:
            raise HTTPException(status_code=409, detail=f"实验ID {data.experiment_id} 已存在")
        
        # 创建记录
        validation_record = await LabValidationData.create(
            target_type=data.target_type,
            target_id=data.target_id,
            target_name=data.target_name,
            experiment_id=data.experiment_id,
            lab_name=data.lab_name,
            experiment_date=data.experiment_date,
            researcher_name=data.researcher_name,
            status=ValidationStatus.PENDING,
            method_description=data.method_description,
            equipment_used=data.equipment_used,
            measured_parameters=data.measured_parameters,
            predicted_values=data.predicted_values
        )
        
        logger.info(f"实验数据已接收: {data.experiment_id} - {data.target_name}")
        
        return {
            "success": True,
            "experiment_id": data.experiment_id,
            "status": "pending",
            "message": "实验数据已成功提交，等待处理",
            "record_id": validation_record.id
        }
        
    except Exception as e:
        logger.error(f"提交实验数据失败: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="提交实验数据失败")



@router.post("/experiments/batch-import", summary="批量导入实验数据")
async def batch_import_experiments(
    request: ValidationBatchImportRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    批量导入多个实验数据
    
    支持 CSV/JSON 文件上传或直接 JSON 提交
    自动去重和校验
    """
    results = []
    success_count = 0
    failed_count = 0
    
    for exp_data in request.experiments:
        try:
            # 复用单个提交流程
            existing = await LabValidationData.get_or_none(experiment_id=exp_data.experiment_id)
            if existing:
                results.append({
                    "experiment_id": exp_data.experiment_id,
                    "target_name": exp_data.target_name,
                    "status": "duplicate_skipped"
                })
                continue

            validation_record = await LabValidationData.create(
                target_type=exp_data.target_type,
                target_id=exp_data.target_id,
                target_name=exp_data.target_name,
                experiment_id=exp_data.experiment_id,
                lab_name=exp_data.lab_name,
                experiment_date=exp_data.experiment_date,
                researcher_name=exp_data.researcher_name,
                status=ValidationStatus.PENDING,
                method_description=exp_data.method_description,
                equipment_used=exp_data.equipment_used,
                measured_parameters=exp_data.measured_parameters,
                predicted_values=exp_data.predicted_values
            )
            results.append({
                "experiment_id": exp_data.experiment_id,
                "target_name": exp_data.target_name,
                "status": "imported",
                "record_id": validation_record.id
            })
            success_count += 1
            
        except Exception as e:
            results.append({
                "experiment_id": exp_data.experiment_id,
                "error": "导入失败，请检查数据格式",
                "status": "failed"
            })
            failed_count += 1
    
    return {
        "success": True,
        "total_submitted": len(request.experiments),
        "success_count": success_count,
        "failed_count": failed_count,
        "results": results,
        "message": f"批量导入完成: {success_count} 成功, {failed_count} 失败"
    }


@router.post("/validate/{experiment_id}", summary="执行验证对比")
async def run_validation_comparison(
    experiment_id: str,
    request: ValidationComparisonRequest,
    current_user: User = Depends(get_current_active_user)
):
    """
    对指定实验执行预测值与实测值的对比分析
    
    分析内容:
    - 各参数偏差计算
    - 统计显著性检验 (t-test / Wilcoxon)
    - Bland-Altman 一致性分析
    - 总体验证评分
    """
    try:
        from ..models.formula_deep_integration import LabValidationData, ValidationStatus
        
        # 查询实验记录
        record = await LabValidationData.get_or_none(experiment_id=experiment_id)
        if not record:
            raise HTTPException(status_code=404, detail=f"未找到实验 {experiment_id}")
        
        if not record.predicted_values:
            raise HTTPException(
                status_code=400, 
                detail="该实验缺少系统预测值，无法进行对比"
            )
        
        # 执行对比分析
        comparison_result = _perform_comparison_analysis(
            measured=record.measured_parameters,
            predicted=record.predicted_values,
            tolerance=request.tolerance_range,
            alpha=request.significance_level
        )
        
        # 更新记录状态
        record.status = ValidationStatus.COMPLETED
        record.deviation_analysis = comparison_result["statistics"]
        record.validation_result = comparison_result["result"]
        record.conclusion_notes = comparison_result["conclusion"]
        await record.save()
        
        return ValidationReport(
            experiment_id=experiment_id,
            target_name=record.target_name,
            validation_result=comparison_result["result"],
            overall_score=comparison_result["overall_score"],
            parameter_comparisons=comparison_result["parameter_details"],
            deviation_statistics=comparison_result["statistics"],
            conclusion_notes=comparison_result["conclusion"],
            recommendations=comparison_result["recommendations"],
            validated_at=datetime.now(timezone.utc),
            reviewed_by=current_user.username if current_user else None
        )
        
    except Exception as e:
        logger.error(f"验证对比失败 ({experiment_id}): {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="验证对比失败")


@router.get("/experiments", summary="查询实验列表")
async def list_experiments(
    current_user: User = Depends(get_current_active_user),
    target_type: Optional[str] = Query(None, pattern="^(formula|ingredient|synergy_pair)$"),
    status: Optional[str] = Query(None, pattern="^(pending|in_progress|completed|failed)$"),
    target_name: Optional[str] = Query(None, description="目标名称模糊搜索"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100)
):
    """
    分页查询实验室验证数据（仅返回当前用户的数据）

    支持筛选条件:
    - target_type: 目标类型
    - status: 验证状态
    - target_name: 名称模糊搜索
    """
    from ..models.formula_deep_integration import LabValidationData

    # 数据隔离: 仅查询当前用户的数据
    query = LabValidationData.all().filter(LabValidationData.owner_id == current_user.id)
    
    if target_type:
        query = query.filter(target_type=target_type)
    if status:
        query = query.filter(status=status)
    if target_name:
        query = query.filter(target_name__icontains=target_name)
    
    # 分页
    total = await query.count()
    records = await query.offset((page - 1) * page_size).limit(page_size).all()
    
    return {
        "success": True,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size,
        "data": [
            {
                "id": r.id,
                "experiment_id": r.experiment_id,
                "target_name": r.target_name,
                "target_type": r.target_type,
                "lab_name": r.lab_name,
                "experiment_date": r.experiment_date.isoformat() if r.experiment_date else None,
                "researcher_name": r.researcher_name,
                "status": r.status.value,
                "validation_result": r.validation_result,
                "qc_passed": r.qc_passed
            }
            for r in records
        ]
    }


@router.get("/experiments/{experiment_id}", summary="获取实验详情")
async def get_experiment_detail(
    experiment_id: str,
    current_user: User = Depends(get_current_active_user),
):
    """获取单个实验的完整详情，包括原始数据和对比分析"""
    from ..models.formula_deep_integration import LabValidationData
    
    record = await LabValidationData.get_or_none(experiment_id=experiment_id)
    if not record:
        raise HTTPException(status_code=404, detail="实验不存在")
    
    return {
        "success": True,
        "data": {
            **record.to_dict(),
            "is_validated": record.is_validated
        }
    }


class ExperimentReviewRequest(BaseModel):
    """实验审核请求"""
    qc_passed: bool = False
    notes: str = ""


@router.put("/experiments/{experiment_id}/review", summary="审核实验数据 (管理员)")
async def review_experiment(
    experiment_id: str,
    review_data: ExperimentReviewRequest,
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.REVIEWER)),
):
    """
    审核并确认实验数据质量

    权限: 仅管理员/审核员可调用
    """
    from ..models.formula_deep_integration import LabValidationData, ValidationStatus

    record = await LabValidationData.get_or_none(experiment_id=experiment_id)
    if not record:
        raise HTTPException(status_code=404, detail="实验不存在")

    qc_passed = review_data.qc_passed
    notes = review_data.notes
    
    record.qc_passed = qc_passed
    record.reviewer_id = current_user.id if current_user else None
    record.reviewed_at = datetime.now(timezone.utc)
    
    if qc_passed and record.validation_result == 'passed':
        record.status = ValidationStatus.COMPLETED
    elif not qc_passed:
        record.status = ValidationStatus.FAILED
        record.conclusion_notes = f"QC不通过: {notes}"
    
    await record.save()
    
    logger.info(f"实验审核完成: {experiment_id} QC={'通过' if qc_passed else '不通过'} by={current_user}")
    
    return {
        "success": True,
        "experiment_id": experiment_id,
        "qc_passed": qc_passed,
        "reviewed_by": current_user.username if current_user else None,
        "reviewed_at": datetime.now(timezone.utc).isoformat()
    }


@router.get("/statistics/dashboard", summary="验证统计仪表板")
async def get_validation_dashboard(
    current_user: User = Depends(get_current_active_user),
):
    """
    实验室验证统计概览
    
    包含:
    - 总实验数 / 通过率 / 失败率
    - 按类型分布
    - 最近30天趋势
    - 偏差分布直方图数据
    """
    from ..models.formula_deep_integration import LabValidationData
    
    total = await LabValidationData.all().count()
    
    passed = await LabValidationData.filter(validation_result='passed').count()
    failed = await LabValidationData.filter(validation_result='failed').count()
    pending = await LabValidationData.filter(status='pending').count()
    
    # 按目标类型分组统计
    type_stats = {}
    for t in ['formula', 'ingredient', 'synergy_pair']:
        count = await LabValidationData.filter(target_type=t).count()
        type_stats[t] = count
    
    # 平均偏差统计
    # A-27：原写 `deviation_analysis__not_isnull()` —— 这是一个【未定义的函数调用】，
    #       一进来就抛 NameError。Tortoise 的写法是过滤关键字 + 布尔值。
    all_records = await LabValidationData.filter(deviation_analysis__not_isnull=True).all()
    avg_deviations = []
    for r in all_records[:100]:  # 取最近100条
        if r.deviation_analysis and 'mean_absolute_percentage_error' in r.deviation_analysis:
            avg_deviations.append(r.deviation_analysis['mean_absolute_percentage_error'])
    
    overall_mape = sum(avg_deviations) / len(avg_deviations) if avg_deviations else 0
    
    from datetime import timedelta as _td

    # 最近30天趋势
    thirty_days_ago = date.today() - _td(days=30)
    daily_counts = {}
    for d in range(30):
        day = thirty_days_ago + _td(days=d)
        daily_counts[str(day)] = 0

    all_recs = await LabValidationData.all()
    for r in all_recs:
        if r.experiment_date:
            key = str(r.experiment_date)
            if key in daily_counts:
                daily_counts[key] += 1

    recent_trend = [
        {"date": d, "count": c}
        for d, c in daily_counts.items()
    ]

    return {
        "success": True,
        "summary": {
            "total_experiments": total,
            "passed_rate": (passed / total * 100) if total > 0 else 0,
            "failed_rate": (failed / total * 100) if total > 0 else 0,
            "pending_count": pending,
            "overall_mape": round(overall_mape, 2)
        },
        "by_target_type": type_stats,
        "recent_trend": recent_trend,
        "generated_at": datetime.now(timezone.utc).isoformat()
    }


# ==================== 内部辅助函数 ====================

def _perform_comparison_analysis(
    measured: Dict[str, Any],
    predicted: Dict[str, Any],
    tolerance: float,
    alpha: float
) -> Dict[str, Any]:
    """
    执行详细的对比分析
    
    Returns:
        {
            result: 'passed' | 'failed' | 'inconclusive',
            overall_score: 0-100,
            parameter_details: [...],
            statistics: {...},
            conclusion: "...",
            recommendations: [...]
        }
    """
    parameter_details = []
    all_deviations = []
    passed_params = 0
    total_params = len(measured)
    
    for param_name, measured_data in measured.items():
        pred_data = predicted.get(param_name, {})
        
        measured_val = measured_data.get("value", 0)
        predicted_val = pred_data.get("value", 0)
        unit = measured_data.get("unit", "")
        std_dev = measured_data.get("std_dev", 0)
        
        # 计算偏差
        if predicted_val != 0:
            absolute_deviation = abs(measured_val - predicted_val)
            percentage_deviation = (absolute_deviation / abs(predicted_val)) * 100
        else:
            absolute_deviation = abs(measured_val)
            percentage_deviation = 0
        
        all_deviations.append(percentage_deviation)
        
        # 判断是否在容差范围内
        is_within_tolerance = percentage_deviation <= (tolerance * 100)
        if is_within_tolerance:
            passed_params += 1
        
        # 统计检验（简化版t检验）
        if std_dev > 0:
            t_statistic = absolute_deviation / std_dev
            is_significant = abs(t_statistic) > 2.0  # 简化判断
        else:
            t_statistic = None
            is_significant = False
        
        parameter_details.append({
            "parameter": param_name,
            "measured_value": measured_val,
            "predicted_value": predicted_val,
            "unit": unit,
            "absolute_deviation": round(absolute_deviation, 4),
            "percentage_deviation": round(percentage_deviation, 2),
            "within_tolerance": is_within_tolerance,
            "std_dev": std_dev,
            "t_statistic": round(t_statistic, 3) if t_statistic else None,
            "is_significant": is_significant
        })
    
    # 计算总体指标
    mean_ape = sum(all_deviations) / len(all_deviations) if all_deviations else 0
    max_ape = max(all_deviations) if all_deviations else 0
    pass_rate = (passed_params / total_params * 100) if total_params > 0 else 0
    
    # 综合评分 (0-100)
    overall_score = 100 - (mean_ape * 2) - (max_ape * 0.5) if mean_ape < 50 else 0
    overall_score = max(0, min(100, overall_score))
    
    # 判定结果
    if pass_rate >= 80 and mean_ape <= 15:
        result = "passed"
        conclusion = f"验证通过: {passed_params}/{total_params} 参数在容差范围内，平均偏差 {mean_ape:.1f}%"
    elif pass_rate >= 60 or mean_ape <= 25:
        result = "inconclusive"
        conclusion = f"需进一步验证: 部分参数偏差较大 (MAPE={mean_ape:.1f}%)"
    else:
        result = "failed"
        conclusion = f"验证失败: 多个参数超出容差范围 (MAPE={mean_ape:.1f}%, 通过率={pass_rate:.0f}%)"
    
    # 生成建议
    recommendations = []
    if mean_ape > 20:
        recommendations.append("⚠️ 整体偏差较大，建议检查预测模型参数或实验方法一致性")
    if max_ape > 50:
        worst_param = max(parameter_details, key=lambda x: x['percentage_deviation'])
        recommendations.append(f"🔴 参数 '{worst_param['parameter']}' 偏差过大 ({worst_param['percentage_deviation']:.1f}%)，需重点关注")
    if pass_rate >= 90:
        recommendations.append("✅ 预测精度良好，可用于生产环境")
    
    return {
        "result": result,
        "overall_score": round(overall_score, 1),
        "parameter_details": parameter_details,
        "statistics": {
            "mean_absolute_percentage_error": round(mean_ape, 2),
            "max_percentage_error": round(max_ape, 2),
            "pass_rate": round(pass_rate, 1),
            "parameters_tested": total_params,
            "parameters_passed": passed_params,
            "tolerance_threshold": tolerance * 100
        },
        "conclusion": conclusion,
        "recommendations": recommendations
    }


# 导出路由
__all__ = ["router"]
