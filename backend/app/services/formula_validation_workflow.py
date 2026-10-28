"""
配方在线验证工作流服务

功能：
- 一键触发配方全流程在线验证（无需人工多次干预）
- 验证流水线：安全性检查 → 兼容性检测 → 功效预测 → 稳定性预测 → 风味评分
- 自动生成关联实验记录，支持实验值回填对比
- WebSocket 实时进度推送
- 验证结果对比分析（预测值 vs 实测值）
"""
from __future__ import annotations

import logging
import time
from dataclasses import dataclass, field
from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.realtime.websocket_manager import MessageType, WSMessage, get_ws_manager
from app.models import (
    Experiment,
    Formula,
    TaskStatus,
    Workflow,
    WorkflowStatus,
    WorkflowTask,
    formula_ingredients,
)

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════
# 辅助函数
# ═══════════════════════════════════════════════════════════

async def _get_formula_ingredients_async(db, formula_id: int) -> List[Dict[str, Any]]:
    """从 junction 表查询配方成分及百分比"""
    result = await db.execute(
        select(formula_ingredients.c.ingredient_id, formula_ingredients.c.percentage,
               formula_ingredients.c.amount, formula_ingredients.c.unit)
        .where(formula_ingredients.c.formula_id == formula_id)
        .order_by(formula_ingredients.c.sort_order)
    )
    rows = result.fetchall()
    # 批量获取 ingredient 名称
    ids = [r[0] for r in rows]
    if not ids:
        return []
    from sqlalchemy import text as sql_text
    # 构建动态 IN 子句
    placeholders = ",".join(f":id{i}" for i in range(len(ids)))
    params = {f"id{i}": int(id_) for i, id_ in enumerate(ids)}
    name_result = await db.execute(sql_text(f"SELECT id, name FROM ingredients WHERE id IN ({placeholders})").bindparams(**params))
    name_map = {r[0]: r[1] for r in name_result.fetchall()}
    return [
        {"name": name_map.get(r[0], f"ingredient_{r[0]}"),
         "percentage": float(r[1]) if r[1] is not None else 0.0,
         "amount": float(r[2]) if r[2] is not None else 0.0,
         "unit": r[3] or "g"}
        for r in rows
    ]


# ═══════════════════════════════════════════════════════════
# 枚举定义
# ═══════════════════════════════════════════════════════════

class ValidationStage(str, Enum):
    """验证阶段"""
    SAFETY_CHECK = "safety_check"
    COMPATIBILITY_CHECK = "compatibility_check"
    EFFICACY_PREDICTION = "efficacy_prediction"
    STABILITY_PREDICTION = "stability_prediction"
    TASTE_PREDICTION = "taste_prediction"
    SYNERGY_ANALYSIS = "synergy_analysis"
    DATA_COMPARISON = "data_comparison"
    FINAL_REPORT = "final_report"


class ValidationOutcome(str, Enum):
    """验证结论"""
    PASSED = "passed"
    CONDITIONAL = "conditional"
    FAILED = "failed"
    INCONCLUSIVE = "inconclusive"


# ═══════════════════════════════════════════════════════════
# 数据模型
# ═══════════════════════════════════════════════════════════

@dataclass
class StageResult:
    """单阶段验证结果"""
    stage: ValidationStage
    success: bool
    score: float = 0.0  # 0-100
    passed: bool = False
    details: Dict[str, Any] = field(default_factory=dict)
    warnings: List[str] = field(default_factory=list)
    errors: List[str] = field(default_factory=list)
    error: str = ""  # 简要错误描述
    latency_ms: float = 0.0
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        return {
            "stage": self.stage.value,
            "success": self.success,
            "score": round(self.score, 2),
            "passed": self.passed,
            "details": self.details,
            "warnings": self.warnings,
            "errors": self.errors,
            "error": self.error,
            "latency_ms": round(self.latency_ms, 1),
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }


@dataclass
class ComparisonPoint:
    """预测值 vs 实验值对比数据点"""
    parameter: str
    unit: str
    predicted_value: float
    predicted_range: tuple
    measured_value: Optional[float] = None
    measured_range: Optional[tuple] = None
    deviation_percent: float = 0.0
    within_tolerance: bool = True
    confidence: str = "medium"

    def to_dict(self) -> dict:
        return {
            "parameter": self.parameter,
            "unit": self.unit,
            "predicted_value": round(self.predicted_value, 4),
            "predicted_range": [round(self.predicted_range[0], 4), round(self.predicted_range[1], 4)],
            "measured_value": round(self.measured_value, 4) if self.measured_value is not None else None,
            "measured_range": [round(self.measured_range[0], 4), round(self.measured_range[1], 4)] if self.measured_range else None,
            "deviation_percent": round(self.deviation_percent, 2),
            "within_tolerance": self.within_tolerance,
            "confidence": self.confidence,
        }


@dataclass
class FormulaValidationResult:
    """配方完整验证结果"""
    formula_id: int
    formula_name: str
    validation_id: str
    overall_score: float = 0.0
    outcome: ValidationOutcome = ValidationOutcome.INCONCLUSIVE
    stages: List[StageResult] = field(default_factory=list)
    comparisons: List[ComparisonPoint] = field(default_factory=list)
    summary: Dict[str, Any] = field(default_factory=dict)
    recommendations: List[str] = field(default_factory=list)
    validated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    error_message: Optional[str] = None

    @property
    def stage_scores(self) -> Dict[str, float]:
        return {s.stage.value: s.score for s in self.stages if s.success}

    @property
    def failed_stages(self) -> List[str]:
        return [s.stage.value for s in self.stages if not s.passed and s.success]

    @property
    def total_latency_ms(self) -> float:
        return sum(s.latency_ms for s in self.stages)

    def to_dict(self) -> dict:
        return {
            "validation_id": self.validation_id,
            "formula_id": self.formula_id,
            "formula_name": self.formula_name,
            "overall_score": round(self.overall_score, 2),
            "outcome": self.outcome.value,
            "stages": [s.to_dict() for s in self.stages],
            "comparisons": [c.to_dict() for c in self.comparisons],
            "summary": self.summary,
            "recommendations": self.recommendations,
            "validated_at": self.validated_at.isoformat(),
            "total_latency_ms": round(self.total_latency_ms, 1),
            "error_message": self.error_message,
            "failed_stages": self.failed_stages,
        }


@dataclass
class ValidationProgress:
    """验证进度信息（用于 WebSocket 推送）"""
    validation_id: str
    formula_id: int
    formula_name: str
    current_stage: str
    stage_index: int
    total_stages: int
    stage_status: str  # running / success / failed
    progress_percent: int
    current_score: float
    message: str

    def to_ws_message(self) -> WSMessage:
        return WSMessage(
            type=MessageType.VALIDATION_PROGRESS,
            data={
                "validation_id": self.validation_id,
                "formula_id": self.formula_id,
                "formula_name": self.formula_name,
                "current_stage": self.current_stage,
                "stage_index": self.stage_index,
                "total_stages": self.total_stages,
                "stage_status": self.stage_status,
                "progress_percent": self.progress_percent,
                "current_score": round(self.current_score, 2),
                "message": self.message,
                "timestamp": datetime.now(timezone.utc).isoformat(),
            },
        )


# ═══════════════════════════════════════════════════════════
# 验证执行器（各阶段）
# ═══════════════════════════════════════════════════════════

class BaseValidationExecutor:
    """验证阶段执行器基类"""

    stage: ValidationStage = ValidationStage.FINAL_REPORT
    description: str = ""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def execute(self, formula: Formula, context: Dict[str, Any]) -> StageResult:
        raise NotImplementedError


class SafetyCheckExecutor(BaseValidationExecutor):
    """阶段1：安全性检查"""

    stage = ValidationStage.SAFETY_CHECK
    description = "安全性检查 — 依据 GB 16740 / ADI / UL 阈值"

    async def execute(self, formula: Formula, context: Dict[str, Any]) -> StageResult:
        start = time.time()
        result = StageResult(stage=self.stage, success=True, started_at=datetime.now(timezone.utc))

        try:
            from app.services.formula.safety_alert_system import SafetyAlertSystem
            system = SafetyAlertSystem()

            # 从 junction 表获取成分数据（含百分比）
            ingredients = await _get_formula_ingredients_async(self.db, formula.id)
            for ing_data in ingredients:
                ing_data["amount_mg"] = ing_data["amount"] * 1000

            # check_formula_safety 是同步方法，直接调用
            safety_result = system.check_formula_safety(
                ingredients=ingredients,
                daily_dosage_g=context.get("daily_dosage_g", 10),
                target_group=context.get("target_population", "adult"),
            )

            alerts = safety_result.alerts if hasattr(safety_result, 'alerts') else []
            critical_count = sum(1 for a in alerts if hasattr(a, 'alert_level') and a.alert_level.value == "critical")
            warning_count = sum(1 for a in alerts if hasattr(a, 'alert_level') and a.alert_level.value == "warning")
            risk_score = safety_result.overall_risk_score if hasattr(safety_result, 'overall_risk_score') else 0
            is_safe = safety_result.is_safe if hasattr(safety_result, 'is_safe') else False
            # 反向映射：risk_score 越小越安全 → 转换为 0-100 分数
            score = max(0, 100 - risk_score * 10)

            result.success = critical_count == 0
            result.passed = critical_count == 0 and warning_count <= 2
            result.score = score
            result.details = {
                "risk_score": risk_score,
                "critical_count": critical_count,
                "warning_count": warning_count,
                "is_safe": is_safe,
            }
            result.warnings = [getattr(a, 'message', '') for a in alerts if hasattr(a, 'alert_level') and a.alert_level.value == "warning"]
            result.errors = [getattr(a, 'message', '') for a in alerts if hasattr(a, 'alert_level') and a.alert_level.value == "critical"]

        except Exception as e:
            logger.error(f"安全性检查失败: {e}", exc_info=True)
            result.success = False
            result.error = str(e)

        result.latency_ms = (time.time() - start) * 1000
        result.completed_at = datetime.now(timezone.utc)
        return result


class CompatibilityCheckExecutor(BaseValidationExecutor):
    """阶段2：兼容性检测"""

    stage = ValidationStage.COMPATIBILITY_CHECK
    description = "兼容性检测 — 4层架构成分相互作用分析"

    async def execute(self, formula: Formula, context: Dict[str, Any]) -> StageResult:
        start = time.time()
        result = StageResult(stage=self.stage, success=True, started_at=datetime.now(timezone.utc))

        try:
            from app.services.formula.compatibility_checker import CompatibilityChecker
            checker = CompatibilityChecker()

            # 从 junction 表获取成分数据（含百分比）
            ingredients = await _get_formula_ingredients_async(self.db, formula.id)
            for ing_data in ingredients:
                ing_data["amount_mg"] = ing_data["amount"] * 1000

            report = checker.check_compatibility(ingredients, formula_id=str(formula.id))

            result.success = True
            result.passed = report.error_count == 0
            result.score = report.overall_score
            result.details = {
                "passed_checks": report.passed_checks,
                "total_checks": report.total_checks,
                "error_count": report.error_count,
                "issue_count": len(report.issues),
            }
            result.warnings = [i.description for i in report.issues if i.level.value == "warning"]
            result.errors = [i.description for i in report.issues if i.level.value == "error"]

        except Exception as e:
            logger.error(f"兼容性检测失败: {e}", exc_info=True)
            result.success = False
            result.error = str(e)

        result.latency_ms = (time.time() - start) * 1000
        result.completed_at = datetime.now(timezone.utc)
        return result


class EfficacyPredictionExecutor(BaseValidationExecutor):
    """阶段3：功效预测（PK/PD）"""

    stage = ValidationStage.EFFICACY_PREDICTION
    description = "功效预测 — PopPK/PD 模型模拟"

    async def execute(self, formula: Formula, context: Dict[str, Any]) -> StageResult:
        start = time.time()
        result = StageResult(stage=self.stage, success=True, started_at=datetime.now(timezone.utc))

        try:
            from app.services.formula.effect_simulator import EffectSimulator
            from app.services.formula.herb_real_data import HerbRealDataService
            simulator = EffectSimulator()

            # 从 junction 表获取成分数据（含百分比）
            ingredients = await _get_formula_ingredients_async(self.db, formula.id)
            for ing_data in ingredients:
                ing_data["amount_mg"] = ing_data["amount"] * 1000

            # ── 注入 DB 真实 PK/PD/剂量数据（替代内置占位参数）────
            # - PK.F/ka/Vd/CL/t_lag ← tcm_herbs_pk 表（F 真实 OB%；ka/Vd/CL 模型推导已落库）
            # - PD.E_max/EC50/Hill ← tcm_herbs_pd 表（E_max 真实评分；EC50 模型推导已落库）
            # - 剂量 ← herb_food_herbs.max_dosage（DB 真实最大日用量）
            # 缺失字段回退 tcm_herbs/tcm_compounds 直读或内置默认并标注来源。
            rds = HerbRealDataService(self.db)
            herb_names = [ing["name"] for ing in ingredients if ing.get("name")]
            db_profiles = await rds.get_herb_profiles(herb_names)
            db_overrides = {
                name: {k: p[k] for k in ("pk", "pd", "dosage") if p.get(k)}
                for name, p in db_profiles.items()
            }

            prediction = simulator.predict_effect(
                formula_ingredients=ingredients,
                formula_id=str(formula.id),
                body_weight_kg=context.get("body_weight_kg", 65),
                simulation_hours=context.get("simulation_hours", 24),
                db_overrides=db_overrides,
            )

            result.success = True
            result.passed = prediction.max_effect >= 0.3  # 最低有效阈值
            result.score = prediction.max_effect * 100
            result.details = {
                "peak_time_h": round(prediction.peak_time, 2),
                "peak_concentration_mg_ml": round(prediction.peak_concentration, 4),
                "max_effect": round(prediction.max_effect, 4),
                "effect_duration_h": round(prediction.effect_duration, 2),
                "auc": round(prediction.auc, 2),
                "optimal_window": list(prediction.optimal_window),
                "db_hit_ingredients": len(db_overrides),
                "db_miss_ingredients": len(herb_names) - len(db_overrides),
                "source": "PK: tcm_herbs_pk (F=TCMSP_OB%真实, ka/Vd/CL=模型推导已落库); "
                          "PD: tcm_herbs_pd (E_max=efficacy_scores真实, EC50=模型推导已落库); "
                          "剂量: herb_food_herbs.max_dosage (DB 真实)",
            }

        except Exception as e:
            logger.error(f"功效预测失败: {e}", exc_info=True)
            result.success = False
            result.error = str(e)

        result.latency_ms = (time.time() - start) * 1000
        result.completed_at = datetime.now(timezone.utc)
        return result


class StabilityPredictionExecutor(BaseValidationExecutor):
    """阶段4：稳定性预测"""

    stage = ValidationStage.STABILITY_PREDICTION
    description = "稳定性预测 — 货架期与降解速率模拟"

    async def execute(self, formula: Formula, context: Dict[str, Any]) -> StageResult:
        start = time.time()
        result = StageResult(stage=self.stage, success=True, started_at=datetime.now(timezone.utc))

        try:
            # ── 使用 DB 真实稳定性数据（stability_data 表，Arrhenius 降解速率）──
            # 此前用 STABILITY_DATABASE 硬编码 + 未知成分 min_shelf_life=999999 占位。
            # 现改为：读 stability_data 表的真实 degradation_rate / shelf_life_months
            # （由 hf_enriched_herbs 的 TCMSP 成分 logp + Arrhenius 模型推导并落库）。
            # 无 stability_data 行的成分标注无数据，不计入（不伪造）。
            from app.services.formula.herb_real_data import HerbRealDataService
            rds = HerbRealDataService(self.db)
            ingredients = await _get_formula_ingredients_async(self.db, formula.id)
            herb_names = [ing["name"] for ing in ingredients if ing.get("name")]
            db_profiles = await rds.get_herb_profiles(herb_names)

            risk_factors = []
            hit_count, miss_count = 0, 0
            shelf_lives = []
            degradation_rates = []

            for ing in ingredients:
                name = ing.get("name", "")
                percentage = ing.get("percentage", 0)
                prof = db_profiles.get(name)
                stab = (prof or {}).get("stability")
                if not stab:
                    miss_count += 1
                    risk_factors.append({
                        "type": "no_stability_data",
                        "severity": 0.2,
                        "description": f"{name} 无稳定性数据（stability_data 表无行）",
                    })
                    continue
                hit_count += 1
                shelf = stab.get("shelf_life_months")
                dr = stab.get("degradation_rate")
                if shelf is not None:
                    shelf_lives.append(shelf)
                if dr is not None:
                    degradation_rates.append(dr)
                # 高风险判据：货架期 < 12 月 或 降解速率 > 0.05
                if (shelf is not None and shelf < 12.0) or (dr is not None and dr > 0.05):
                    risk_factors.append({
                        "type": "degradation_risk",
                        "severity": 0.4 if (shelf is not None and shelf < 6.0) else 0.25,
                        "description": f"{name} 货架期={shelf}月, 降解速率={dr}, 脂溶成分多",
                    })
                # 脂溶性风险
                logp_max = stab.get("logp_max")
                if logp_max is not None and logp_max > 5.0:
                    risk_factors.append({
                        "type": "lipophilicity_risk",
                        "severity": 0.3,
                        "description": f"{name} 最高成分 logp={logp_max}，易氧化",
                    })

            # 货架期取各成分最短值（保守）；无数据给 12 月下限
            predicted_shelf_life = min(shelf_lives) if shelf_lives else 12.0
            avg_degradation = (sum(degradation_rates) / len(degradation_rates)) if degradation_rates else 0.0

            # 评分：基于货架期（≥24月=100, 12-24月=80, 6-12月=60, <6月=40）
            if predicted_shelf_life >= 24:
                shelf_score = 100
            elif predicted_shelf_life >= 12:
                shelf_score = 80
            elif predicted_shelf_life >= 6:
                shelf_score = 60
            else:
                shelf_score = 40
            risk_penalty = min(40, sum(r["severity"] for r in risk_factors) * 30)
            score = max(0, shelf_score - risk_penalty)

            result.success = True
            result.passed = score >= 60
            result.score = score
            result.details = {
                "shelf_life_months": round(predicted_shelf_life, 1),
                "avg_degradation_rate": round(avg_degradation, 5),
                "shelf_score": shelf_score,
                "risk_factors_count": len(risk_factors),
                "risk_factors": risk_factors[:5],
                "db_hit_ingredients": hit_count,
                "db_miss_ingredients": miss_count,
                "source": "stability_data 表（TCMSP logp + Arrhenius 推导的真实降解速率/货架期），无数据成分不计入",
            }

        except Exception as e:
            logger.error(f"稳定性预测失败: {e}", exc_info=True)
            result.success = False
            result.error = str(e)

        result.latency_ms = (time.time() - start) * 1000
        result.completed_at = datetime.now(timezone.utc)
        return result


class TastePredictionExecutor(BaseValidationExecutor):
    """阶段5：风味评分"""

    stage = ValidationStage.TASTE_PREDICTION
    description = "风味评分 — 感官特性预测"

    async def execute(self, formula: Formula, context: Dict[str, Any]) -> StageResult:
        start = time.time()
        result = StageResult(stage=self.stage, success=True, started_at=datetime.now(timezone.utc))

        try:
            # ── 优先使用 DB 真实风味数据（mmid_herbs.flavor）─────
            # 此前用 TASTE_DATABASE 代码内硬编码 + 未知成分默认 0.2，导致
            # 风味恒 8 分失真。现改为：先查 DB，命中的成分用真实五味，
            # 未命中成分不再伪造默认 0.2，而是标注"无数据"。
            from app.services.formula.herb_real_data import HerbRealDataService
            rds = HerbRealDataService(self.db)
            ingredients = await _get_formula_ingredients_async(self.db, formula.id)
            herb_names = [ing["name"] for ing in ingredients if ing.get("name")]
            db_profiles = await rds.get_herb_profiles(herb_names)

            # 按成分百分比加权，仅对 DB 命中的成分累加（未命中跳过，不伪造）
            total_pct = sum(ing.get("percentage", 0) for ing in ingredients) or 100.0
            dims = {"sweet": 0.0, "bitter": 0.0, "sour": 0.0, "astringent": 0.0, "umami": 0.0}
            hit_count, miss_count = 0, 0
            for ing in ingredients:
                name = ing.get("name", "")
                pct = ing.get("percentage", 0) / 100.0
                prof = db_profiles.get(name)
                if not prof or not prof.get("taste"):
                    miss_count += 1
                    continue
                hit_count += 1
                taste_dims = prof["taste"]["dims"]
                for d in dims:
                    dims[d] += taste_dims.get(d, 0.0) * pct

            # 归一化
            for d in dims:
                dims[d] = min(1.0, round(dims[d], 4))

            # 接受度计算（与 TastePredictor.acceptability 公式一致）
            acceptability = max(0.0, min(1.0,
                dims["umami"] * 0.3 +
                dims["sweet"] * 0.25 -
                dims["bitter"] * 0.25 -
                dims["astringent"] * 0.2 -
                max(0.0, dims["sour"] - 0.3) * 0.1
            ))
            score = acceptability * 100
            result.success = True
            result.passed = score >= 50
            result.score = score
            result.details = {
                "overall_score": round(score, 2),
                "sweetness": dims["sweet"],
                "bitterness": dims["bitter"],
                "sourness": dims["sour"],
                "umami": dims["umami"],
                "astringency": dims["astringent"],
                "db_hit_ingredients": hit_count,
                "db_miss_ingredients": miss_count,
                "source": "mmid_herbs.flavor (DB 真实五味)，未命中成分不计入（不伪造）",
            }

        except Exception as e:
            logger.error(f"风味预测失败: {e}", exc_info=True)
            result.success = False
            result.error = str(e)

        result.latency_ms = (time.time() - start) * 1000
        result.completed_at = datetime.now(timezone.utc)
        return result


class SynergyAnalysisExecutor(BaseValidationExecutor):
    """阶段6：协同效应分析"""

    stage = ValidationStage.SYNERGY_ANALYSIS
    description = "协同效应分析 — 网络药理学预测"

    async def execute(self, formula: Formula, context: Dict[str, Any]) -> StageResult:
        start = time.time()
        result = StageResult(stage=self.stage, success=True, started_at=datetime.now(timezone.utc))

        try:
            # ── 使用 DB 真实协同数据（synergy_interactions 表，TCMSP 靶点 Jaccard）──
            # 此前 SynergyEngine 无系数 → overall_si=0.5 中性占位。
            # 现改为：从 synergy_interactions 表读真实协同系数（每对药材的
            # network_pharmacology 靶点 Jaccard 重叠度），配方内每对取系数；
            # 无 DB 系数时不再给 0.5 中性分，而是 0。
            from app.services.formula.herb_real_data import HerbRealDataService
            rds = HerbRealDataService(self.db)
            ingredients = await _get_formula_ingredients_async(self.db, formula.id)
            ingredient_names = [ing["name"] for ing in ingredients if ing.get("name")]
            db_profiles = await rds.get_herb_profiles(ingredient_names)

            # 配方内每对成分，取 synergy_interactions 的真实系数（若存在）
            total_pairs = len(ingredient_names) * (len(ingredient_names) - 1) // 2
            pair_coefficients = []
            pair_details = []
            for i, name_a in enumerate(ingredient_names):
                for name_b in ingredient_names[i + 1:]:
                    prof_a = (db_profiles.get(name_a) or {}).get("synergy") or {}
                    pairs_a = prof_a.get("pairs") or []
                    si = None
                    for p in pairs_a:
                        if p.get("partner") == name_b:
                            si = p.get("si")
                            break
                    if si is None:
                        # 双向查（b 的 pairs 里可能有 a）
                        prof_b = (db_profiles.get(name_b) or {}).get("synergy") or {}
                        for p in (prof_b.get("pairs") or []):
                            if p.get("partner") == name_a:
                                si = p.get("si")
                                break
                    if si is not None:
                        pair_coefficients.append(si)
                        pair_details.append(f"{name_a}↔{name_b}={si}")
                    else:
                        pair_coefficients.append(0.0)
                        pair_details.append(f"{name_a}↔{name_b}=0(无DB系数)")

            # 综合协同指数 = 所有配对系数的均值（真实计算，无数据=0 而非 0.5）
            overall_si = sum(pair_coefficients) / len(pair_coefficients) if pair_coefficients else 0.0
            with_data = len([c for c in pair_coefficients if c > 0])

            result.success = True
            result.passed = overall_si >= 0.3
            result.score = overall_si * 100
            result.details = {
                "overall_si": round(overall_si, 4),
                "pair_coefficients": pair_details,
                "pairs_with_db_data": with_data,
                "total_pairs": total_pairs,
                "db_evidence_only": True,
                "source": "synergy_interactions (TCMSP 靶点 Jaccard 真实计算，无数据=0 而非占位 0.5)",
            }

        except Exception as e:
            logger.error(f"协同效应分析失败: {e}", exc_info=True)
            result.success = False
            result.error = str(e)

        result.latency_ms = (time.time() - start) * 1000
        result.completed_at = datetime.now(timezone.utc)
        return result


class DataComparisonExecutor(BaseValidationExecutor):
    """阶段7：实验数据对比"""

    stage = ValidationStage.DATA_COMPARISON
    description = "实验数据对比 — 预测值 vs 实测值"

    async def execute(self, formula: Formula, context: Dict[str, Any]) -> StageResult:
        start = time.time()
        result = StageResult(stage=self.stage, success=True, started_at=datetime.now(timezone.utc))

        try:
            experiment_id = context.get("experiment_id")
            if not experiment_id:
                result.success = False
                result.error = "未提供关联实验 ID，跳过对比阶段"
                result.latency_ms = (time.time() - start) * 1000
                return result

            # 获取实验数据点
            # 使用 selectinload 预取 data_points，避免在 async 上下文中触发
            # ORM 同步懒加载（会抛 MissingGreenlet / "greenlet_spawn has not
            # been called"）。此前实测该懒加载导致 data_comparison 阶段失败，
            # 进而 comparisons 恒为 0（"预测值 vs 实测值" 对比无数据）。
            exp_result = await self.db.execute(
                select(Experiment)
                .options(selectinload(Experiment.data_points))
                .where(Experiment.id == experiment_id)
            )
            experiment = exp_result.scalar_one_or_none()
            if not experiment:
                result.success = False
                result.error = f"关联实验 {experiment_id} 不存在"
                result.latency_ms = (time.time() - start) * 1000
                return result

            # 对比逻辑由调用方在 ValidationService 中统一处理
            result.success = True
            result.passed = True
            result.details = {
                "experiment_id": experiment_id,
                "experiment_title": experiment.title,
                "data_points_count": len(experiment.data_points) if experiment.data_points else 0,
            }

        except Exception as e:
            logger.error(f"数据对比失败: {e}", exc_info=True)
            result.success = False
            result.error = str(e)

        result.latency_ms = (time.time() - start) * 1000
        result.completed_at = datetime.now(timezone.utc)
        return result


# ═══════════════════════════════════════════════════════════
# 主验证服务
# ═══════════════════════════════════════════════════════════

# 验证阶段执行器注册表
_EXECUTORS = {
    ValidationStage.SAFETY_CHECK: SafetyCheckExecutor,
    ValidationStage.COMPATIBILITY_CHECK: CompatibilityCheckExecutor,
    ValidationStage.EFFICACY_PREDICTION: EfficacyPredictionExecutor,
    ValidationStage.STABILITY_PREDICTION: StabilityPredictionExecutor,
    ValidationStage.TASTE_PREDICTION: TastePredictionExecutor,
    ValidationStage.SYNERGY_ANALYSIS: SynergyAnalysisExecutor,
    ValidationStage.DATA_COMPARISON: DataComparisonExecutor,
}

# 默认验证阶段顺序
DEFAULT_VALIDATION_ORDER = [
    ValidationStage.SAFETY_CHECK,
    ValidationStage.COMPATIBILITY_CHECK,
    ValidationStage.EFFICACY_PREDICTION,
    ValidationStage.STABILITY_PREDICTION,
    ValidationStage.TASTE_PREDICTION,
    ValidationStage.SYNERGY_ANALYSIS,
    ValidationStage.DATA_COMPARISON,
]


class FormulaValidationService:
    """
    配方在线验证服务

    提供一键触发配方全流程验证的能力，无需人工多次干预。
    每个阶段独立执行，失败不阻塞后续阶段（可配置）。
    """

    def __init__(self, db: AsyncSession):
        self.db = db

    # ── 创建工作流并触发验证 ─────────────────────────────────

    async def create_validation_workflow(
        self,
        formula_id: int,
        user_id: int,
        experiment_id: Optional[int] = None,
        validation_order: Optional[List[str]] = None,
        parallel: bool = False,
        config: Optional[Dict[str, Any]] = None,
    ) -> tuple[Workflow, FormulaValidationResult]:
        """
        创建验证工作流并开始执行。

        Returns:
            (workflow, result) — workflow 为 DB 中的工作流记录；
            result 为最终验证结果（运行中时包含部分结果）。
        """
        config = config or {}
        stages = [ValidationStage(s) for s in (validation_order or DEFAULT_VALIDATION_ORDER)]

        # 1. 创建 Workflow 记录
        workflow = Workflow(
            name=f"配方验证-{config.get('formula_name', formula_id)}",
            workflow_type="formula_validation",
            description=f"配方 #{formula_id} 在线验证工作流",
            config={
                "formula_id": formula_id,
                "experiment_id": experiment_id,
                "validation_stages": [s.value for s in stages],
                "parallel": parallel,
                "daily_dosage_g": config.get("daily_dosage_g", 10),
                "target_population": config.get("target_population", "adult"),
                "body_weight_kg": config.get("body_weight_kg", 65),
                "storage_temp_c": config.get("storage_temp_c", 25),
                "storage_humidity": config.get("storage_humidity", 60),
            },
            creator_id=user_id,
            status=WorkflowStatus.PENDING,
        )
        self.db.add(workflow)
        await self.db.flush()

        # 2. 创建 WorkflowTask 节点
        validation_id = f"val-{formula_id}-{int(time.time())}"
        for i, stage in enumerate(stages, start=1):
            task = WorkflowTask(
                workflow_id=workflow.id,
                step_order=i,
                name=stage.value.replace("_", " ").title(),
                task_type=f"validation_{stage.value}",
                input_data={"validation_id": validation_id, "formula_id": formula_id, "experiment_id": experiment_id},
                status=TaskStatus.PENDING,
            )
            self.db.add(task)

        await self.db.flush()
        await self.db.commit()

        # 3. 异步执行验证管线（使用独立会话，避免请求会话关闭后失效）
        try:
            import asyncio as _asyncio
            loop = _asyncio.get_running_loop()
            logger.info("[Pipeline] Creating background task on loop %s", loop)
            # NOTE: 不在这里创建后台任务，由调用方（API）负责执行管线
            # task = loop.create_task(self._run_validation_pipeline_async(workflow.id, validation_id, stages, experiment_id, config))
            # task.add_done_callback(lambda t: logger.info("[Pipeline] Task done: cancelled=%s exception=%s", t.cancelled(), t.exception() if t.done() and t.exception() else None))
            logger.info("[Pipeline] 后台任务已跳过，由API同步等待")
        except Exception as e:
            logger.error("[Pipeline] Failed to create background task: %s", e, exc_info=True)
            raise

        # 4. 返回初始结果
        init_result = FormulaValidationResult(
            formula_id=formula_id,
            formula_name=config.get("formula_name", f"配方#{formula_id}"),
            validation_id=validation_id,
        )
        return workflow, init_result

    # ── 核心验证管线 ────────────────────────────────────────

    async def _run_validation_pipeline_async(
        self,
        workflow_id: int,
        validation_id: str,
        stages: List[ValidationStage],
        experiment_id: Optional[int],
        config: Dict[str, Any],
    ):
        """异步执行验证管线（使用独立数据库会话）"""
        import logging
        logger = logging.getLogger(__name__)
        logger.info("[PipelineAsync] 后台验证任务启动: workflow_id=%s validation_id=%s", workflow_id, validation_id)
        try:
            from app.core.database.session import get_session_factory
            async with get_session_factory()() as db:
                service = FormulaValidationService(db)
                await service._run_validation_pipeline(workflow_id, validation_id, stages, experiment_id, config)
                logger.info("[PipelineAsync] 后台验证任务完成: workflow_id=%s", workflow_id)
        except Exception as e:
            logger.error("[PipelineAsync] 后台验证任务异常: %s", e, exc_info=True)

    async def _run_validation_pipeline(
        self,
        workflow_id: int,
        validation_id: str,
        stages: List[ValidationStage],
        experiment_id: Optional[int],
        config: Dict[str, Any],
    ):
        """执行完整验证管线（异步后台任务）"""
        from app.models import Workflow, WorkflowTask

        result = FormulaValidationResult(
            formula_id=config.get("formula_id"),
            formula_name=config.get("formula_name", f"配方#{config.get('formula_id')}"),
            validation_id=validation_id,
        )

        try:
            # 加载配方（包含 ingredients）
            formula = (await self.db.execute(
                select(Formula)
                .where(Formula.id == config["formula_id"])
                .options(selectinload(Formula.ingredients))
            )).scalar_one_or_none()
            if not formula:
                raise ValueError(f"配方 {config['formula_id']} 不存在")

            # 更新工作流状态
            await self.db.execute(
                update(Workflow).where(Workflow.id == workflow_id).values(status=WorkflowStatus.IN_PROGRESS)
            )
            await self.db.commit()

            total = len(stages)
            formula_context = {
                "daily_dosage_g": config.get("daily_dosage_g", 10),
                "target_population": config.get("target_population", "adult"),
                "body_weight_kg": config.get("body_weight_kg", 65),
                "simulation_hours": config.get("simulation_hours", 24),
                "storage_temp_c": config.get("storage_temp_c", 25),
                "storage_humidity": config.get("storage_humidity", 60),
                "experiment_id": experiment_id,
            }

            # 构建共享上下文（供后续阶段使用）
            shared_context: Dict[str, Any] = {"safety_result": None, "compat_result": None}

            # 逐个执行阶段
            for idx, stage in enumerate(stages):
                executor_cls = _EXECUTORS.get(stage)
                if not executor_cls:
                    logger.warning("未知验证阶段: %s", stage.value)
                    continue

                # 推送进度
                progress = ValidationProgress(
                    validation_id=validation_id,
                    formula_id=config["formula_id"],
                    formula_name=result.formula_name,
                    current_stage=stage.value,
                    stage_index=idx + 1,
                    total_stages=total,
                    stage_status="running",
                    progress_percent=int((idx / total) * 100),
                    current_score=result.overall_score,
                    message=f"开始执行: {executor_cls.description}",
                )
                await self._push_progress(progress)

                # 更新任务状态为 running
                task = (await self.db.execute(
                    select(WorkflowTask)
                    .where(WorkflowTask.workflow_id == workflow_id, WorkflowTask.step_order == idx + 1)
                )).scalar_one_or_none()
                if task:
                    task.status = TaskStatus.IN_PROGRESS
                    task.started_at = datetime.now(timezone.utc)
                    await self.db.commit()

                # 执行
                executor = executor_cls(self.db)
                stage_result = await executor.execute(formula, formula_context)

                # 记录共享上下文
                if stage == ValidationStage.SAFETY_CHECK:
                    shared_context["safety_result"] = stage_result
                elif stage == ValidationStage.COMPATIBILITY_CHECK:
                    shared_context["compat_result"] = stage_result

                # 如果失败但允许继续，记录警告但不中断
                if not stage_result.success:
                    logger.warning("验证阶段 %s 失败: %s", stage.value, stage_result.error)

                result.stages.append(stage_result)

                # 更新任务状态
                if task:
                    task.status = TaskStatus.COMPLETED if stage_result.success else TaskStatus.FAILED
                    task.output_data = stage_result.to_dict()
                    task.error_message = stage_result.error
                    task.completed_at = stage_result.completed_at
                    task.duration_ms = int(stage_result.latency_ms)
                    await self.db.commit()

                # 推送完成进度
                progress.stage_status = "success" if stage_result.success else "failed"
                progress.message = f"完成: {stage.value.replace('_', ' ')}"
                await self._push_progress(progress)

            # ── 综合评估 ──────────────────────────────────────────
            await self._compute_overall_result(result, shared_context, experiment_id)

            # ── 数据对比（如果有实验数据）─────────────────────────
            if experiment_id:
                comparisons = await self._compare_predictions_with_experiment(
                    result, experiment_id, config
                )
                result.comparisons = comparisons

            # ── 生成建议 ──────────────────────────────────────────
            result.recommendations = self._generate_recommendations(result)

            # ── 更新工作流最终状态 ────────────────────────────────
            await self.db.execute(
                update(Workflow).where(Workflow.id == workflow_id).values({
                    "status": WorkflowStatus.COMPLETED,
                    "result": result.to_dict(),
                    "updated_at": datetime.now(timezone.utc),
                })
            )
            await self.db.commit()

            # ── 最终进度推送 ──────────────────────────────────────
            final_progress = ValidationProgress(
                validation_id=validation_id,
                formula_id=config["formula_id"],
                formula_name=result.formula_name,
                current_stage="completed",
                stage_index=total,
                total_stages=total,
                stage_status="success",
                progress_percent=100,
                current_score=result.overall_score,
                message=f"验证完成，整体评分 {result.overall_score:.1f}，结论: {result.outcome.value}",
            )
            await self._push_progress(final_progress)

            # 如有关联实验，自动更新实验状态
            if experiment_id:
                await self._update_experiment_validation_result(experiment_id, result)

        except Exception as e:
            logger.error("验证管线异常: %s", e, exc_info=True)
            result.error_message = str(e)
            result.outcome = ValidationOutcome.FAILED

            try:
                await self.db.execute(
                    update(Workflow).where(Workflow.id == workflow_id).values({
                        "status": WorkflowStatus.FAILED,
                        "error_message": str(e),
                        "updated_at": datetime.now(timezone.utc),
                    })
                )
                await self.db.commit()
            except Exception:
                pass

            failed_progress = ValidationProgress(
                validation_id=validation_id,
                formula_id=config.get("formula_id", 0),
                formula_name=result.formula_name,
                current_stage="error",
                stage_index=len(stages),
                total_stages=len(stages),
                stage_status="failed",
                progress_percent=100,
                current_score=0,
                message=f"验证失败: {e}",
            )
            await self._push_progress(failed_progress)

    # ── 综合评估 ──────────────────────────────────────────────

    async def _compute_overall_result(
        self,
        result: FormulaValidationResult,
        shared_context: Dict[str, Any],
        experiment_id: Optional[int],
    ):
        """综合各阶段评分，计算总体分数和结论"""
        scores = [s.score for s in result.stages if s.success]
        if not scores:
            result.overall_score = 0
            result.outcome = ValidationOutcome.FAILED
            return

        # 加权平均（安全 × 0.25，兼容 × 0.20，功效 × 0.20，稳定 × 0.15，风味 × 0.10，协同 × 0.10）
        weights = {
            ValidationStage.SAFETY_CHECK: 0.25,
            ValidationStage.COMPATIBILITY_CHECK: 0.20,
            ValidationStage.EFFICACY_PREDICTION: 0.20,
            ValidationStage.STABILITY_PREDICTION: 0.15,
            ValidationStage.TASTE_PREDICTION: 0.10,
            ValidationStage.SYNERGY_ANALYSIS: 0.10,
        }

        weighted_sum = 0.0
        weight_total = 0.0
        for stage in result.stages:
            if stage.success and stage.stage in weights:
                weighted_sum += stage.score * weights[stage.stage]
                weight_total += weights[stage.stage]

        result.overall_score = weighted_sum / weight_total if weight_total > 0 else 0

        # 判定结论
        failed_critical = [s for s in result.stages if not s.passed and s.success]
        if any(not s.passed for s in result.stages if s.stage in (ValidationStage.SAFETY_CHECK, ValidationStage.COMPATIBILITY_CHECK)):
            result.outcome = ValidationOutcome.FAILED
        elif len(failed_critical) >= 2:
            result.outcome = ValidationOutcome.CONDITIONAL
        elif result.overall_score >= 70:
            result.outcome = ValidationOutcome.PASSED
        else:
            result.outcome = ValidationOutcome.CONDITIONAL

        result.summary = {
            "weighted_score": round(result.overall_score, 2),
            "stages_passed": sum(1 for s in result.stages if s.passed),
            "stages_total": len(result.stages),
            "outcome": result.outcome.value,
        }

    # ── 预测值与实验值对比 ───────────────────────────────────

    async def _compare_predictions_with_experiment(
        self,
        result: FormulaValidationResult,
        experiment_id: int,
        config: Dict[str, Any],
    ) -> List[ComparisonPoint]:
        """将各阶段预测值与实验数据点进行对比"""
        from app.models import ExperimentData

        comparisons: List[ComparisonPoint] = []

        # 收集各阶段的预测关键指标
        prediction_map: Dict[str, Dict[str, Any]] = {}
        for stage in result.stages:
            if stage.stage in prediction_map:
                continue
            d = stage.details
            if d:
                prediction_map[stage.stage.value] = d

        # 获取实验数据点
        exp_data_result = await self.db.execute(
            select(ExperimentData).where(ExperimentData.experiment_id == experiment_id)
        )
        data_points = exp_data_result.scalars().all()

        # 建立参数名映射
        # key 同时匹配：英文键（如 risk_score）与中文参数名片段（如"毒性""降解"），
        # 数据点来自实验记录，参数名多为中文（如"25℃加速降解率""感官评分"），
        # 此前仅英文匹配导致 comparisons 恒为空——真实对比永远出不来。
        param_mapping = {
            "risk_score": ("safety_risk_score", "分", "safety_check", "risk_score"),
            "毒性": ("safety_risk_score", "分", "safety_check", "risk_score"),
            "overall_score": ("compatibility_score", "分", "compatibility_check", "overall_score"),
            "兼容": ("compatibility_score", "分", "compatibility_check", "overall_score"),
            "max_effect": ("efficacy_max_effect", "比例", "efficacy_prediction", "max_effect"),
            "消化率": ("efficacy_max_effect", "比例", "efficacy_prediction", "max_effect"),
            "排空": ("efficacy_peak_time", "h", "efficacy_prediction", "peak_time_h"),
            "功效": ("efficacy_max_effect", "比例", "efficacy_prediction", "max_effect"),
            "shelf_life_months": ("shelf_life_months", "月", "stability_prediction", "shelf_life_months"),
            "货架": ("shelf_life_months", "月", "stability_prediction", "shelf_life_months"),
            "降解": ("degradation_rate", "每月", "stability_prediction", "degradation_rate"),
            "稳定性": ("degradation_rate", "每月", "stability_prediction", "degradation_rate"),
            "overall_score": ("taste_overall_score", "分", "taste_prediction", "overall_score"),
            "口感": ("taste_overall_score", "分", "taste_prediction", "overall_score"),
            "感官": ("taste_overall_score", "分", "taste_prediction", "overall_score"),
            "overall_si": ("synergy_index", "SI", "synergy_analysis", "overall_si"),
            "协同": ("synergy_index", "SI", "synergy_analysis", "overall_si"),
        }

        # 规范化预测 details 中的数值（dict 拆分键，如 peak_time_h 直接存在）
        for stage in result.stages:
            d = stage.details or {}
            if d:
                prediction_map[stage.stage.value] = d

        for dp in data_points:
            param_name = dp.parameter
            try:
                measured_val = float(dp.value) if dp.value is not None else None
            except (ValueError, TypeError):
                continue

            # 尝试匹配预测参数
            for key, (label, unit, stage_name, pred_key) in param_mapping.items():
                if key in param_name.lower() or param_name.lower() in key:
                    pred_data = prediction_map.get(stage_name, {})
                    pred_val = pred_data.get(pred_key)
                    if pred_val is not None and measured_val is not None:
                        deviation = abs(measured_val - pred_val) / max(pred_val, 0.001) * 100
                        comparisons.append(ComparisonPoint(
                            parameter=param_name,
                            unit=unit,
                            predicted_value=pred_val,
                            predicted_range=(pred_val * 0.8, pred_val * 1.2),
                            measured_value=measured_val,
                            deviation_percent=deviation,
                            within_tolerance=deviation <= 20,
                        ))
                    break

        return comparisons

    # ── 推荐生成 ──────────────────────────────────────────────

    def _generate_recommendations(self, result: FormulaValidationResult) -> List[str]:
        """根据验证结果生成改进建议"""
        recs: List[str] = []

        for stage in result.stages:
            if stage.stage == ValidationStage.SAFETY_CHECK and not stage.passed:
                recs.append("⚠️ 安全性检查未通过，请检查各成分用量是否超出 GB 16740 限量标准")
            elif stage.stage == ValidationStage.SAFETY_CHECK and stage.warnings:
                recs.append(f"📋 安全性提示：{'; '.join(stage.warnings[:3])}")

            if stage.stage == ValidationStage.COMPATIBILITY_CHECK and not stage.passed:
                recs.append("⚠️ 兼容性检测发现问题，存在成分相互作用风险，建议重新调整配方")
            elif stage.stage == ValidationStage.COMPATIBILITY_CHECK and stage.warnings:
                recs.append(f"📋 兼容性提示：{'; '.join(stage.warnings[:3])}")

            if stage.stage == ValidationStage.EFFICACY_PREDICTION and not stage.passed:
                recs.append("📉 功效预测低于阈值，建议增加君药剂量或调整配伍结构")

            if stage.stage == ValidationStage.STABILITY_PREDICTION and not stage.passed:
                recs.append("⏱️ 货架期预测不足12个月，建议优化包覆工艺或添加抗氧化剂")

            if stage.stage == ValidationStage.TASTE_PREDICTION and not stage.passed:
                recs.append("👅 风味评分偏低，建议调整甜味剂配比或使用矫味技术")

        # 总体结论
        if result.outcome == ValidationOutcome.PASSED:
            recs.insert(0, f"✅ 配方综合评分 {result.overall_score:.1f}，通过在线验证，建议进入小试验证阶段")
        elif result.outcome == ValidationOutcome.CONDITIONAL:
            recs.insert(0, f"⚡ 配方综合评分 {result.overall_score:.1f}，有条件通过，建议针对以下问题优化后复测")
        elif result.outcome == ValidationOutcome.FAILED:
            recs.insert(0, f"❌ 配方综合评分 {result.overall_score:.1f}，未通过验证，需重大调整后重新验证")

        return recs

    # ── 实验状态更新 ─────────────────────────────────────────

    async def _update_experiment_validation_result(
        self,
        experiment_id: int,
        result: FormulaValidationResult,
    ):
        """将验证结果写入关联实验"""
        from app.models import Experiment
        try:
            exp = (await self.db.execute(
                select(Experiment).where(Experiment.id == experiment_id)
            )).scalar_one_or_none()
            if exp:
                if not exp.results:
                    exp.results = {}
                exp.results["validation_id"] = result.validation_id
                exp.results["overall_score"] = result.overall_score
                exp.results["outcome"] = result.outcome.value
                exp.results["stage_results"] = [s.to_dict() for s in result.stages]
                exp.results["comparison_count"] = len(result.comparisons)
                exp.results["validated_at"] = result.validated_at.isoformat()
                await self.db.commit()
                logger.info("实验 %d 验证结果已写入", experiment_id)
        except Exception as e:
            logger.warning("写入实验验证结果失败: %s", e)

    # ── WebSocket 进度推送 ───────────────────────────────────

    async def _push_progress(self, progress: ValidationProgress):
        """推送进度到 WebSocket"""
        try:
            ws_mgr = get_ws_manager()
            # to_ws_message() 已构造 WSMessage 对象；broadcast_all 接受
            # WSMessage | Dict。此前调用不存在的 broadcast() 且把对象 json.dumps
            # 成字符串，导致进度推送全部失败（"no attribute 'broadcast'"）。
            msg = progress.to_ws_message()
            await ws_mgr.broadcast_all(msg)
        except Exception as e:
            logger.warning("WebSocket 推送失败: %s", e)

    # ── 查询接口 ─────────────────────────────────────────────

    async def get_validation_result(self, validation_id: str) -> Optional[FormulaValidationResult]:
        """根据 validation_id 查询验证结果"""
        from app.models import Workflow
        workflow = (await self.db.execute(
            select(Workflow).where(Workflow.config["formula_id"].as_string() == validation_id.split("-")[1])
        )).scalar_one_or_none()
        if workflow and workflow.result:
            return FormulaValidationResult(**workflow.result)
        return None


# 全局服务实例（延迟初始化）
_validation_service: Optional[FormulaValidationService] = None


def get_validation_service(db: AsyncSession) -> FormulaValidationService:
    return FormulaValidationService(db)
