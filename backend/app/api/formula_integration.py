"""
配方深度集成 API 路由

功能:
- 8 个 RESTful API 端点
- WebSocket 实时进度推送
- 统一错误处理与响应格式
- Swagger/OpenAPI 文档自动生成
"""

from fastapi import APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Query, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from pydantic import BaseModel, Field
from typing import List, Dict, Optional, Any
from datetime import datetime
import asyncio
import json
import logging

from .deps import get_db_session, get_current_active_user, CurrentUser, require_role
from ..models.enums import UserRole

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/v1/formula", tags=["配方深度集成"])


# ==================== Pydantic 模型 ====================

class SynergyAnalysisRequest(BaseModel):
    """协同效应分析请求"""
    ingredient_a: str = Field(..., description="成分A名称")
    ingredient_b: str = Field(..., description="成分B名称")
    context: Optional[Dict[str, Any]] = Field(default=None, description="分析上下文")


class SynergyAnalysisResponse(BaseModel):
    """协同效应分析响应"""
    success: bool
    ingredient_pair: str
    overall_si: float = Field(..., description="综合协同指数", ge=0, le=1)
    mechanisms: Dict[str, float] = Field(default_factory=dict)
    dominant_mechanism: Optional[str] = None
    confidence: float = Field(default=0.8, ge=0, le=1)
    timestamp: str


class RatioOptimizationRequest(BaseModel):
    """配比优化请求"""
    ingredients: List[Dict[str, Any]] = Field(
        ...,
        description="成分列表 [{name, min_ratio, max_ratio, cost_per_gram, ...}]"
    )
    constraints: Optional[Dict[str, Any]] = Field(
        default=None,
        description="优化约束 {target_efficacy, safety_threshold, max_cost}"
    )
    population_size: int = Field(default=100, ge=20, le=200)
    max_generations: int = Field(default=50, ge=10, le=100)


class RatioOptimizationResponse(BaseModel):
    """配比优化响应"""
    success: bool
    formula_id: str
    pareto_solutions: List[Dict[str, Any]] = Field(default_factory=list)
    best_solution: Optional[Dict[str, Any]] = None
    computation_time_ms: float
    solution_count: int
    diversity_metric: float


class CompatibilityCheckRequest(BaseModel):
    """兼容性检测请求"""
    ingredients: List[Dict[str, Any]] = Field(
        ...,
        description="成分列表 [{name, amount_mg, percentage}]"
    )
    target_population: str = Field(default="adult", description="目标人群")
    formula_id: Optional[str] = None


class CompatibilityCheckResponse(BaseModel):
    """兼容性检测响应"""
    success: bool
    overall_score: float = Field(..., ge=0, le=100)
    issues: List[Dict[str, Any]] = Field(default_factory=list)
    passed_checks: int
    total_checks: int
    recommendations: List[str] = Field(default_factory=list)
    error_count: int
    warning_count: int
    info_count: int


class EffectPredictionRequest(BaseModel):
    """效果预测请求"""
    formula_ingredients: List[Dict[str, Any]]
    body_weight_kg: float = Field(default=70.0, gt=0, le=200)
    simulation_hours: float = Field(default=24.0, ge=1, le=168)
    time_points: int = Field(default=100, ge=50, le=500)


class EffectPredictionResponse(BaseModel):
    """效果预测响应"""
    success: bool
    formula_id: str
    peak_time: float = Field(description="Tmax (小时)")
    peak_concentration: float = Field(description="Cmax (μg/mL)")
    max_effect: float = Field(ge=0, le=1, description="Emax")
    effect_duration: float = Field(description="效应持续时间 (小时)")
    optimal_window: List[float]
    visualization_data: Dict[str, Any]
    auc: float


class SafetyCheckRequest(BaseModel):
    """安全检查请求"""
    ingredients: List[Dict[str, Any]]
    daily_dosage_g: float = Field(default=10.0, gt=0)
    usage_scenario: str = Field(default="supplement")
    target_group: str = Field(default="adult")


class SafetyCheckResponse(BaseModel):
    """安全检查响应"""
    is_safe: bool
    overall_risk_score: float = Field(ge=0, le=100)
    alerts: List[Dict[str, Any]]
    checked_parameters: int
    blocked_by_critical: bool
    recommendations: List[str]


class DeepGenerationRequest(BaseModel):
    """增强配方生成请求"""
    ingredients: List[Dict[str, Any]]
    mode: str = Field(default="deep_integration", pattern="^(standard|deep_integration)$")
    target_efficacy: float = Field(default=0.75, ge=0, le=1)
    safety_priority: bool = True
    cost_constraint: Optional[float] = None
    target_population: str = "adult"
    use_caching: bool = True


class DeepGenerationResponse(BaseModel):
    """增强配方生成响应"""
    success: bool
    formula_id: str
    optimized_ratios: Dict[str, float]
    synergy_summary: Optional[Dict[str, Any]] = None
    optimization_summary: Optional[Dict[str, Any]] = None
    compatibility_summary: Optional[Dict[str, Any]] = None
    effect_prediction_summary: Optional[Dict[str, Any]] = None
    safety_check_summary: Optional[Dict[str, Any]] = None
    recommendations: List[str]
    generation_time_ms: float
    mode_used: str
    cache_hit: bool


# ==================== WebSocket 连接管理器 ====================

class ConnectionManager:
    """WebSocket 连接管理器"""
    
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
    
    async def connect(self, websocket: WebSocket, client_id: str):
        await websocket.accept()
        self.active_connections[client_id] = websocket
        logger.info(f"WebSocket 连接建立: {client_id}")
    
    def disconnect(self, client_id: str):
        if client_id in self.active_connections:
            del self.active_connections[client_id]
            logger.info(f"WebSocket 断开连接: {client_id}")
    
    async def send_personal_message(self, message: dict, client_id: str):
        if client_id in self.active_connections:
            try:
                await self.active_connections[client_id].send_json(message)
            except Exception as e:
                logger.error(f"发送消息失败 ({client_id}): {e}")
    
    async def broadcast(self, message: dict):
        for connection in list(self.active_connections.values()):
            try:
                await connection.send_json(message)
            except Exception as e:
                logger.error(f"广播消息失败: {e}")


manager = ConnectionManager()


# ==================== API 端点实现 ====================

@router.post("/synergy/analyze", response_model=SynergyAnalysisResponse, summary="分析成分协同效应")
async def analyze_synergy(
    request: SynergyAnalysisRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    分析两个成分之间的协同作用机制
    
    返回 5 种协同机制的详细得分和综合协同指数 (SI):
    - Mechanism-1: 药效增强协同 (Bliss Independence)
    - Mechanism-2: 药代动力学协同 (PK Interaction)
    - Mechanism-3: 结构稳定性协同 (Gibbs 自由能)
    - Mechanism-4: 靶点通路协同 (网络药理学)
    - Mechanism-5: 感官品质协同 (味觉矩阵)
    """
    try:
        from ..services.formula.synergy_engine import SynergyEngine
        
        engine = SynergyEngine()
        report = engine.analyze_synergy(request.ingredient_a, request.ingredient_b, request.context)
        
        return SynergyAnalysisResponse(
            success=True,
            ingredient_pair=f"{request.ingredient_a} + {request.ingredient_b}",
            overall_si=report.overall_si,
            mechanisms={
                m.mechanism_type.value: m.score 
                for m in report.mechanisms
            },
            dominant_mechanism=report.dominant_mechanism.value if report.dominant_mechanism else None,
            confidence=report.confidence,
            timestamp=datetime.now().isoformat()
        )
        
    except ImportError as e:
        raise HTTPException(status_code=503, detail="协同分析模块不可用")
    except Exception as e:
        logger.error("协同分析失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误，请稍后重试")


@router.post("/ratio/optimize", response_model=RatioOptimizationResponse, summary="多目标配比优化")
async def optimize_ratio(
    request: RatioOptimizationRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    使用 NSGA-III 多目标遗传算法优化配方比例
    
    优化目标 (4 维):
    - f₁: 最大化综合功效得分
    - f₂: 最大化安全性得分
    - f₃: 最大化稳定性得分
    - f₄: 最小化成本
    
    性能保证: ≤8 成分输入 < 3 秒完成
    输出: Pareto 前沿的多个非支配解
    """
    try:
        from ..services.formula.ratio_optimizer import RatioOptimizer, Ingredient, OptimizationConfig
        
        optimizer_ingredients = [
            Ingredient(
                name=ing.get("name", ""),
                min_ratio=ing.get("min_ratio", 0.01),
                max_ratio=ing.get("max_ratio", 0.50),
                cost_per_gram=ing.get("cost_per_gram", 1.0),
                efficacy_base=ing.get("efficacy_base", 0.6),
                safety_score=ing.get("safety_score", 0.8),
                stability_score=ing.get("stability_score", 0.7),
            )
            for ing in request.ingredients
        ]
        
        config = OptimizationConfig(
            population_size=request.population_size,
            max_generations=request.max_generations,
        )
        
        optimizer = RatioOptimizer(config=config)
        frontier = optimizer.optimize_ratio(optimizer_ingredients, request.constraints)
        
        solutions_data = [
            {
                "ratios": sol.ratios,
                "objectives": sol.objectives,
                "pareto_rank": sol.pareto_rank,
                "recommendation": sol.recommendation_reason
            }
            for sol in frontier.solutions[:10]
        ]
        
        return RatioOptimizationResponse(
            success=True,
            formula_id=f"OPT-{datetime.now().strftime('%Y%m%d%H%M%S')}",
            pareto_solutions=solutions_data,
            best_solution=solutions_data[0] if solutions_data else None,
            computation_time_ms=frontier.computation_time * 1000,
            solution_count=len(frontier.solutions),
            diversity_metric=frontier.diversity_metric
        )
        
    except ImportError as e:
        raise HTTPException(status_code=503, detail="配比优化模块不可用")
    except Exception as e:
        logger.error("配比优化失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误，请稍后重试")


@router.post("/compatibility/check", response_model=CompatibilityCheckResponse, summary="检查配方兼容性")
async def check_compatibility(
    request: CompatibilityCheckRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    执行 4 层架构的配方兼容性检测
    
    检测层级:
    - Layer 1: 化学层面 (pH冲突/沉淀/氧化还原)
    - Layer 2: 药理学层面 (受体竞争/酶互作)
    - Layer 3: 营养学层面 (抗营养因子/螯合)
    - Layer 4: 法规层面 (GB标准/特殊人群限制)
    
    输出: 0-100 分数 + 详细问题列表 + 修改建议
    """
    try:
        from ..services.formula.compatibility_checker import CompatibilityChecker
        
        checker = CompatibilityChecker()
        report = checker.check_compatibility(
            ingredients=request.ingredients,
            formula_id=request.formula_id,
            target_population=request.target_population
        )
        
        issues_data = [
            {
                "level": issue.level.value,
                "category": issue.category.value,
                "description": issue.description,
                "scientific_basis": issue.scientific_basis,
                "suggestion": issue.suggestion,
                "affected_ingredients": issue.affected_ingredients,
                "severity_score": issue.severity_score
            }
            for issue in report.issues
        ]
        
        return CompatibilityCheckResponse(
            success=True,
            overall_score=report.overall_score,
            issues=issues_data,
            passed_checks=report.passed_checks,
            total_checks=report.total_checks,
            recommendations=report.recommendations,
            error_count=report.error_count,
            warning_count=report.warning_count,
            info_count=report.info_count
        )
        
    except ImportError as e:
        raise HTTPException(status_code=503, detail="兼容性检测模块不可用")
    except Exception as e:
        logger.error("兼容性检测失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误，请稍后重试")


@router.post("/effect/predict", response_model=EffectPredictionResponse, summary="预测配方效果")
async def predict_effect(
    request: EffectPredictionRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    基于 PopPK/PD 模型预测配方的时效曲线和效应曲线
    
    PK 模型: 一室模型 with first-order absorption
    PD 模型: Sigmoid Emax 模型
    
    输出:
    - C-T 曲线数据 (血浆浓度-时间)
    - E-T 曲线数据 (效应水平-时间)
    - 关键参数 (Tmax, Cmax, Emax, AUC, 效应持续时间)
    - 最佳服用时间窗口建议
    - 可视化 JSON 数据 (for Recharts/ECharts)
    """
    try:
        from ..services.formula.effect_simulator import EffectSimulator
        
        simulator = EffectSimulator()
        prediction = simulator.predict_effect(
            formula_ingredients=request.formula_ingredients,
            body_weight_kg=request.body_weight_kg,
            simulation_hours=request.simulation_hours,
            time_points=request.time_points
        )
        
        return EffectPredictionResponse(
            success=True,
            formula_id=prediction.formula_id,
            peak_time=prediction.peak_time,
            peak_concentration=prediction.peak_concentration,
            max_effect=prediction.max_effect,
            effect_duration=prediction.effect_duration,
            optimal_window=[prediction.optimal_window[0], prediction.optimal_window[1]],
            visualization_data=prediction.visualization_data,
            auc=prediction.auc
        )
        
    except ImportError as e:
        raise HTTPException(status_code=503, detail="效果预测模块不可用")
    except Exception as e:
        logger.error("效果预测失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误，请稍后重试")


@router.post("/safety/check", response_model=SafetyCheckResponse, summary="检查配方安全性")
async def check_safety(
    request: SafetyCheckRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    三级安全阈值预警系统
    
    预警级别:
    - INFO: 距阈值 <20%
    - WARNING: 超过软阈值但未达硬阈值
    - CRITICAL: 达到硬阈值 → 阻断操作
    
    支持特殊人群模式 (孕妇/儿童/老年人)
    """
    try:
        from ..services.formula.safety_alert_system import SafetyAlertSystem
        
        system = SafetyAlertSystem()
        result = system.check_formula_safety(
            formula_data={
                "ingredients": request.ingredients,
                "daily_dosage_g": request.daily_dosage_g,
                "usage_scenario": request.usage_scenario
            },
            target_group=request.target_group
        )
        
        alerts_data = [
            {
                "level": alert.level.value,
                "ingredient": alert.ingredient_name,
                "parameter": alert.parameter,
                "current_value": alert.current_value,
                "threshold_value": alert.threshold_value,
                "percentage": alert.percentage,
                "message": alert.message,
                "recommendation": alert.recommendation,
                "blocking": alert.blocking
            }
            for alert in result.alerts
        ]
        
        return SafetyCheckResponse(
            is_safe=result.is_safe,
            overall_risk_score=result.overall_risk_score,
            alerts=alerts_data,
            checked_parameters=result.checked_parameters,
            blocked_by_critical=result.blocked_by_critical,
            recommendations=result.recommendations or []
        )
        
    except ImportError as e:
        raise HTTPException(status_code=503, detail="安全检查模块不可用")
    except Exception as e:
        logger.error("安全检查失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误，请稍后重试")


@router.post("/deep-generation", response_model=DeepGenerationResponse, summary="增强配方生成 (完整管线)")
async def deep_generation(
    request: DeepGenerationRequest,
    db: AsyncSession = Depends(get_db_session),
):
    """
    执行完整的增强配方生成管线
    
    管线流程:
    1. 协同效应分析 → 2. 配比优化 → 3. 兼容性检测 → 4. 效果预测 → 5. 安全检查
    
    特性:
    - 自动降级 (某模块失败时回退到标准流程)
    - 缓存支持 (相同参数复用结果)
    - 向后兼容 (mode=standard 时使用原逻辑)
    """
    try:
        from ..services.formula.integration_service import (
            FormulaIntegrationService, 
            DeepGenerationRequest as DGRequest,
            GenerationMode
        )
        
        service = FormulaIntegrationService()
        
        dg_request = DGRequest(
            ingredients=request.ingredients,
            mode=GenerationMode.DEEP_INTEGRATION if request.mode == "deep_integration" 
                   else GenerationMode.STANDARD,
            target_efficacy=request.target_efficacy,
            safety_priority=request.safety_priority,
            cost_constraint=request.cost_constraint,
            target_population=request.target_population,
            use_caching=request.use_caching
        )
        
        response = service.orchestrate_deep_generation(dg_request)
        
        return DeepGenerationResponse(
            success=response.success,
            formula_id=response.formula_id,
            optimized_ratios=response.optimized_ratios,
            synergy_summary={
                "overall_si": response.synergy_report.overall_si if response.synergy_report else None,
                "dominant_mechanism": response.synergy_report.dominant_mechanism.value if response.synergy_report and response.synergy_report.dominant_mechanism else None
            } if response.synergy_report else None,
            optimization_summary={
                "solution_count": len(response.pareto_frontier.solutions) if response.pareto_frontier else 0,
                "computation_time": response.pareto_frontier.computation_time if response.pareto_frontier else 0,
                "diversity": response.pareto_frontier.diversity_metric if response.pareto_frontier else 0
            } if response.pareto_frontier else None,
            compatibility_summary={
                "score": response.compatibility_report.overall_score if response.compatibility_report else None,
                "issues_count": len(response.compatibility_report.issues) if response.compatibility_report else 0
            } if response.compatibility_report else None,
            effect_prediction_summary={
                "tmax": response.effect_prediction.peak_time if response.effect_prediction else None,
                "emax": response.effect_prediction.max_effect if response.effect_prediction else None,
                "duration": response.effect_prediction.effect_duration if response.effect_prediction else None
            } if response.effect_prediction else None,
            safety_check_summary={
                "is_safe": response.safety_check.is_safe if response.safety_check else None,
                "risk_score": response.safety_check.overall_risk_score if response.safety_check else None,
                "alerts_count": len(response.safety_check.alerts) if response.safety_check else 0
            } if response.safety_check else None,
            recommendations=response.recommendations,
            generation_time_ms=response.generation_time * 1000,
            mode_used=response.mode_used.value,
            cache_hit=response.cache_hit
        )
        
    except ImportError as e:
        raise HTTPException(status_code=503, detail="配方集成服务模块不可用")
    except Exception as e:
        logger.error("增强配方生成失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误，请稍后重试")


@router.get("/safety-thresholds", summary="查询安全阈值配置")
async def get_safety_thresholds():
    """
    查询当前生效的安全阈值配置
    
    包含所有内置成分的 ADI/UL/特殊人群/法规限量信息
    """
    try:
        from ..services.formula.safety_alert_system import SafetyAlertSystem
        
        system = SafetyAlertSystem()
        thresholds = system.get_all_thresholds()
        
        return {
            "success": True,
            "version": system.version,
            "last_updated": system.last_updated.isoformat() if system.last_updated else None,
            "thresholds": thresholds,
            "total_count": len(thresholds)
        }
        
    except ImportError as e:
        raise HTTPException(status_code=503, detail="安全检查模块不可用")
    except Exception as e:
        logger.error("查询安全阈值失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误，请稍后重试")


@router.put("/safety-thresholds/{ingredient_name}", summary="更新安全阈值 (管理员)")
async def update_safety_threshold(
    ingredient_name: str,
    updates: Dict[str, Any],
    current_user: CurrentUser = Depends(require_role(UserRole.ADMIN))
):
    """
    更新指定成分的安全阈值 (仅管理员可调用)

    权限要求: admin 角色

    操作日志:
    - 记录变更前后值
    - 记录操作人和时间戳
    - 更新后立即生效
    """
    
    try:
        from ..services.formula.safety_alert_system import SafetyAlertSystem
        
        system = SafetyAlertSystem()
        result = system.update_threshold(ingredient_name, updates)
        
        return {
            "success": result["success"],
            "updated_ingredient": ingredient_name,
            "changes": result.get("changes", {}),
            "effective_immediately": True,
            "version": system.version
        }
        
    except ImportError as e:
        raise HTTPException(status_code=503, detail="安全检查模块不可用")
    except Exception as e:
        logger.error("更新安全阈值失败: %s", e, exc_info=True)
        raise HTTPException(status_code=500, detail="服务器内部错误，请稍后重试")


# ==================== WebSocket 端点 ====================

@router.websocket("/ws/optimization-progress")
async def optimization_progress_websocket(websocket: WebSocket):
    """
    WebSocket 实时进度推送端点
    
    事件类型:
    - started: 开始优化
    - iteration(n): 第 n 代迭代完成
    - complete: 优化完成
    - error: 发生错误
    
    心跳机制:
    - 服务端定期发送 ping
    - 客户端需回复 pong 保持连接
    """
    client_id = f"client_{datetime.now().strftime('%Y%m%d%H%M%S%f')}"
    
    await manager.connect(websocket, client_id)
    
    try:
        # 发送欢迎消息
        await manager.send_personal_message({
            "type": "connected",
            "client_id": client_id,
            "message": "WebSocket 连接成功",
            "timestamp": datetime.now().isoformat()
        }, client_id)
        
        while True:
            # 接收客户端消息
            data = await websocket.receive_text()
            
            try:
                message = json.loads(data)
                
                if message.get("type") == "ping":
                    # 心跳响应
                    await manager.send_personal_message({
                        "type": "pong",
                        "timestamp": datetime.now().isoformat()
                    }, client_id)
                
                elif message.get("type") == "start_optimization":
                    # 启动优化任务（示例）
                    await manager.send_personal_message({
                        "type": "started",
                        "task_id": message.get("task_id"),
                        "message": "开始配比优化...",
                        "timestamp": datetime.now().isoformat()
                    }, client_id)
                    
                    # 模拟优化进度推送
                    for i in range(1, 11):
                        await asyncio.sleep(0.5)  # 模拟计算延迟
                        
                        progress_data = {
                            "type": "iteration",
                            "generation": i,
                            "total_generations": 10,
                            "progress_percent": i * 10,
                            "best_fitness": 0.9 - (i * 0.02),  # 示例数据
                            "timestamp": datetime.now().isoformat()
                        }
                        
                        await manager.send_personal_message(progress_data, client_id)
                    
                    # 完成
                    await manager.send_personal_message({
                        "type": "complete",
                        "message": "优化完成!",
                        "timestamp": datetime.now().isoformat()
                    }, client_id)
                
                else:
                    await manager.send_personal_message({
                        "type": "error",
                        "message": f"未知消息类型: {message.get('type')}",
                        "timestamp": datetime.now().isoformat()
                    }, client_id)
                    
            except json.JSONDecodeError:
                await manager.send_personal_message({
                    "type": "error",
                    "message": "无效的 JSON 格式",
                    "timestamp": datetime.now().isoformat()
                }, client_id)
    
    except WebSocketDisconnect:
        manager.disconnect(client_id)
        logger.info(f"WebSocket 客户端断开: {client_id}")
    
    except Exception as e:
        logger.error(f"WebSocket 错误 ({client_id}): {e}")
        manager.disconnect(client_id)


# ==================== 健康检查端点 ====================

@router.get("/health", tags=["系统"])
async def health_check():
    """服务健康检查端点"""
    modules_status = {}
    
    module_names = [
        ("synergy_engine", "SynergyEngine"),
        ("ratio_optimizer", "RatioOptimizer"),
        ("compatibility_checker", "CompatibilityChecker"),
        ("effect_simulator", "EffectSimulator"),
        ("safety_alert_system", "SafetyAlertSystem"),
        ("integration_service", "FormulaIntegrationService"),
    ]
    
    for import_path, class_name in module_names:
        try:
            __import__(f"app.services.formula.{import_path}")
            modules_status[class_name] = "available"
        except ImportError:
            modules_status[class_name] = "unavailable"
        except Exception:
            modules_status[class_name] = "error"
    
    all_available = all(s == "available" for s in modules_status.values())
    
    return {
        "status": "healthy" if all_available else "degraded",
        "service": "formula-deep-integration-api",
        "version": "1.0.0",
        "modules": modules_status,
        "websocket_connected": len(manager.active_connections),
        "timestamp": datetime.now().isoformat()
    }


# 导出路由供主应用注册
__all__ = ["router"]
