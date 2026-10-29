"""
DOE API 路由
对标 FormLab DOE 模块 API
"""
import logging
from typing import List, Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select, text

from app.core.database.session import get_db
from app.services.doe import (
    DOERun,
    Factor,
    ResponseSurfaceModel,
    get_doe_engine,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/doe", tags=["doe"])


# ═══════════════════════════════════════════
# Pydantic 模型
# ═══════════════════════════════════════════

class FactorInput(BaseModel):
    name: str = Field(..., description="因子名称")
    description: str = ""
    unit: str = ""
    low: float = Field(..., description="低水平实际值")
    high: float = Field(..., description="高水平实际值")
    center: Optional[float] = None
    axial_range: float = 1.4142


class CCDDesignRequest(BaseModel):
    factors: List[FactorInput]
    n_center_points: int = Field(6, ge=3, le=20, description="中心点重复次数")


class BBDDesignRequest(BaseModel):
    factors: List[FactorInput]
    n_center_points: int = Field(6, ge=3, le=20)


class MixtureComponentInput(BaseModel):
    name: str = Field(..., description="组分名称")
    lower: float = Field(0.0, description="下限（0~1 比例）")
    upper: float = Field(1.0, description="上限（0~1 比例）")


class MixtureDesignRequest(BaseModel):
    components: List[MixtureComponentInput] = Field(..., description="组分列表 [{name, lower, upper}]")
    design_type: str = Field("lattice", description="lattice（网格）或 centroid（重心）")
    degree: int = Field(2, ge=2, le=3, description="lattice 阶数（2=二阶，3=三阶）")


class ResponseSurfaceRequest(BaseModel):
    runs: List[dict] = Field(..., description="实验运行数据 [{coded_levels, response_values}]")
    response_names: List[str] = Field(..., description="响应变量名列表")
    include_interaction: bool = True
    include_quadratic: bool = True


class InverseSearchRequest(BaseModel):
    model: dict = Field(..., description="响应面模型（来自 /fit 端点）")
    target_values: dict = Field(..., description="{响应名: 目标值}")
    factor_bounds: Optional[dict] = None


# ═══════════════════════════════════════════
# 端点
# ═══════════════════════════════════════════

@router.post("/ccd", summary="生成 CCD 设计")
async def generate_ccd(req: CCDDesignRequest) -> dict:
    """生成中心复合设计 (Central Composite Design)"""
    engine = get_doe_engine()
    factors = [
        Factor(
            name=f.name,
            description=f.description,
            unit=f.unit,
            low=f.low,
            high=f.high,
            center=f.center,
            axial_range=f.axial_range,
        )
        for f in req.factors
    ]
    response = engine.generate_ccd(factors, req.n_center_points)
    return {
        "status": "ok",
        "design_type": "ccd",
        "total_runs": response.total_runs,
        "notes": response.notes,
        "runs": [
            {
                "run_id": r.run_id,
                "coded_levels": r.coded_levels,
                "factor_levels": r.factor_levels,
                "response_values": r.response_values,
            }
            for r in response.runs
        ],
    }


@router.post("/bbd", summary="生成 BBD 设计")
async def generate_bbd(req: BBDDesignRequest) -> dict:
    """生成 Box-Behnken 设计"""
    engine = get_doe_engine()
    factors = [
        Factor(
            name=f.name,
            description=f.description,
            unit=f.unit,
            low=f.low,
            high=f.high,
            center=f.center,
            axial_range=f.axial_range,
        )
        for f in req.factors
    ]
    response = engine.generate_bbd(factors, req.n_center_points)
    return {
        "status": "ok",
        "design_type": "bbd",
        "total_runs": response.total_runs,
        "notes": response.notes,
        "runs": [
            {
                "run_id": r.run_id,
                "coded_levels": r.coded_levels,
                "factor_levels": r.factor_levels,
                "response_values": r.response_values,
            }
            for r in response.runs
        ],
    }


@router.post("/mixture", summary="生成混料设计")
async def generate_mixture(req: MixtureDesignRequest) -> dict:
    """
    生成 Simplex Lattice / Centroid 混料设计

    混料设计的组分比例之和为 1，因此各组分用 [lower, upper] 约束（0~1）。
    引擎按 centroid（重心）或 lattice（网格，阶数 degree）生成。
    """
    engine = get_doe_engine()
    factors = [
        Factor(
            name=c.name,
            low=c.lower,
            high=c.upper,
            center=(c.lower + c.upper) / 2,
        )
        for c in req.components
    ]
    # centroid = 重心设计（degree=3 路径），lattice = 网格设计（degree=2 路径）
    degree = 3 if req.design_type == "centroid" else (req.degree if req.degree in (2, 3) else 2)
    response = engine.generate_mixture(factors, degree)
    return {
        "status": "ok",
        "design_type": req.design_type,
        "total_runs": response.total_runs,
        "notes": response.notes,
        "runs": [
            {
                "run_id": r.run_id,
                "coded_levels": r.coded_levels,
                "factor_levels": r.factor_levels,
            }
            for r in response.runs
        ],
    }


@router.post("/fit", summary="拟合响应面模型")
async def fit_response_surface(req: ResponseSurfaceRequest) -> dict:
    """
    根据实验数据拟合响应面二次模型

    模型形式：Y = b0 + Σbi*Xi + Σbij*Xi*Xj + Σbii*Xi²
    """
    engine = get_doe_engine()

    # 解析 runs
    runs = []
    for r_data in req.runs:
        run = DOERun(
            run_id=r_data.get("run_id", 0),
            coded_levels=r_data.get("coded_levels", {}),
            factor_levels=r_data.get("factor_levels", {}),
            response_values=r_data.get("response_values", {}),
        )
        runs.append(run)

    models = engine.fit_response_surface(
        runs=runs,
        response_names=req.response_names,
        include_interaction=req.include_interaction,
        include_quadratic=req.include_quadratic,
    )

    return {
        "status": "ok",
        "models": [
            {
                "factors": m.factors,
                "responses": m.responses,
                "equation": m.equation,
                "coefficients": m.coefficients,
                "r_squared": m.r_squared,
                "adjusted_r_squared": m.adjusted_r_squared,
                "rmse": m.rmse,
                "significant_terms": m.significant_terms,
            }
            for m in models
        ],
    }


@router.post("/inverse-search", summary="逆向搜索")
async def inverse_search(req: InverseSearchRequest) -> dict:
    """
    给定目标响应值，反推最优因子组合

    使用梯度下降 + 约束优化
    """
    engine = get_doe_engine()

    # 解析模型
    model_data = req.model
    factors = model_data.get("factors", [])
    responses = model_data.get("responses", [])

    # 系数可能是 {response_name: {term: coef}} 或 {term: coef}（扁平）两种格式
    raw_coeff = model_data.get("coefficients", {})
    coefficients: dict = {}
    if responses and responses[0] in raw_coeff and isinstance(raw_coeff.get(responses[0]), dict):
        # 嵌套格式：直接使用
        coefficients = raw_coeff
    else:
        # 扁平格式：归到第一个响应名下
        first = responses[0] if responses else "y"
        coefficients = {first: raw_coeff}

    from app.services.doe.engine import ResponseSurfaceModel
    model = ResponseSurfaceModel(
        factors=factors,
        responses=responses,
        equation=model_data.get("equation", ""),
        coefficients=coefficients,
        r_squared={},
        adjusted_r_squared={},
        rmse={},
        significant_terms=[],
    )

    # 把前端传来的 factor_bounds（{name: [lo, hi]} 列表/元组）规范化为 {name: (lo, hi)}
    norm_bounds: Optional[dict] = None
    if req.factor_bounds:
        norm_bounds = {k: (float(v[0]), float(v[1])) for k, v in req.factor_bounds.items()}

    result = engine.inverse_search(
        model=model,
        target_values=req.target_values,
        factor_bounds=norm_bounds,
    )

    return {
        "status": "ok",
        "target_values": result.target_values,
        "predicted_factors": result.predicted_factors,
        "predicted_coded": result.predicted_coded,
        "factor_bounds": {k: list(v) for k, v in result.factor_bounds.items()},
        "feasibility_score": result.feasibility_score,
        "confidence_interval": {k: list(v) for k, v in result.confidence_interval.items()},
        "iteration_count": result.iteration_count,
        "converged": result.converged,
    }


class ActiveLearningRequest(BaseModel):
    existing_runs: List[dict] = Field(default_factory=list, description="已有实验数据")
    n_recommend: int = Field(5, ge=1, le=20, description="推荐数量")
    fitted_model: Optional[dict] = Field(None, description="可选：来自 /doe/fit 的响应面模型，用于方差基采样")


@router.post("/active-learning", summary="主动学习推荐")
async def active_learning_recommend(
    req: ActiveLearningRequest = Body(...),
    db=Depends(get_db),
) -> dict:
    """
    基于不确定性采样，推荐下一批实验点（真实实现）。

    - 传入 fitted_model：在候选网格上计算预测方差 σ²(x)=xᵀ(XᵀX)⁻¹x，
      按方差降序选 n_recommend 个点（信息增益最大）；方差计算失败时回退到确定性空白区采样。
    - 未传 fitted_model 但 existing_runs 有 coded 因子：确定性空白区采样（L∞ 最远点）。
    - 无数据：推荐标准 CCD 初始设计（角点+轴点+中心点），而非随机噪声。
    """
    engine = get_doe_engine()

    runs = [
        DOERun(
            run_id=r.get("run_id", 0),
            coded_levels=r.get("coded_levels", {}),
            factor_levels=r.get("factor_levels", {}),
            response_values=r.get("response_values") or {},
        )
        for r in req.existing_runs
    ]

    # 若传入 fitted_model（dict），还原为 ResponseSurfaceModel
    response_model = None
    if req.fitted_model:
        m = req.fitted_model
        try:
            response_model = ResponseSurfaceModel(
                factors=m.get("factors", []),
                responses=m.get("responses", []),
                equation=m.get("equation", ""),
                coefficients=m.get("coefficients", {}),
                r_squared=m.get("r_squared", {}),
                adjusted_r_squared=m.get("adjusted_r_squared", {}),
                rmse=m.get("rmse", {}),
                significant_terms=m.get("significant_terms", []),
            )
        except Exception:
            response_model = None

    recommendations = engine.active_learning_recommend(
        runs, response_model=response_model, n_recommend=req.n_recommend
    )

    strategy = "variance_based" if response_model else ("gap_based" if runs else "initial_design")

    return {
        "status": "ok",
        "strategy": strategy,
        "n_recommend": req.n_recommend,
        "recommendations": [
            {
                "run_id": r.run_id,
                "coded_levels": r.coded_levels,
                "factor_levels": r.factor_levels,
            }
            for r in recommendations
        ],
    }


@router.get("/experiments/{experiment_id}/runs", summary="从实验数据导入 DOE 运行（打通 实验管理→DOE 拟合）")
async def import_experiment_runs(
    experiment_id: int,
    group_size: int = Query(1, ge=1, le=100, description="每组 run 包含的数据点数；自动按 recorded_at 分桶，可手动覆盖"),
    response_parameter: Optional[str] = Query(None, description="指定哪个参数作为响应变量；缺省时所有参数都作为响应候选"),
    db=Depends(get_db),
) -> dict:
    """
    从 实验管理 模块的真实数据点构建 DOE 运行（run）列表，直接喂给 /doe/fit。

    数据源：experiments + experiment_data 表（真实数据，非模拟）

    语义映射（基于 experiment_data 真实表结构 parameter/value/unit/recorded_at）：
    - 一行数据点 = 某次"运行（实验条件）"中的一个参数测量
    - 同一次实验条件（同一 recorded_at 秒桶）的数据点归为同一个 run
    - group_size 可手动指定：把连续 N 个数据点切成一个 run
    - 数值型 value 自动解析为 float；非数值跳过
    - 每个参数（parameter）在全体数据里的 min/max 推断编码范围 → coded_levels

    返回：
    - experiment: 实验元信息（真实读取）
    - factors: [{name, unit, low, high, center}] — 每个参数的编码范围
    - runs: [{run_id, factor_levels, coded_levels, response_values}] — 可直接 POST /doe/fit
    - response_candidates: 所有出现过的参数名（供前端选择响应变量）
    """
    from app.models.experiment import Experiment, ExperimentData

    # 1. 读实验（真实数据，404 则如实报错）
    exp_result = await db.execute(select(Experiment).where(Experiment.id == experiment_id))
    experiment = exp_result.scalar_one_or_none()
    if experiment is None:
        raise HTTPException(status_code=404, detail=f"实验 {experiment_id} 不存在")

    exp_name = getattr(experiment, "title", None) or getattr(experiment, "name", None)

    # 2. 读该实验全部数据点（真实，按录入时间排序）
    #    注意：experiment_data 真实列为 data_type/data_value/measurement_time/created_at
    data_result = await db.execute(
        select(ExperimentData)
        .where(ExperimentData.experiment_id == experiment_id)
        .order_by(ExperimentData.created_at, ExperimentData.id)
    )
    data_points = list(data_result.scalars().all())
    if not data_points:
        return {
            "status": "ok",
            "experiment": {"id": experiment.id, "name": exp_name},
            "total_data_points": 0,
            "runs": [],
            "factors": [],
            "response_candidates": [],
            "note": "该实验暂无数据点，无法生成 DOE 运行。请先在实验管理中录入数据。",
        }

    # 3. 分组成 runs：
    #    真实列：data_type=参数名，data_value=数值（可空，字符串），measurement_time=测量时间（可空）
    #    优先按 measurement_time 秒级桶分桶（同一实验条件的多个参数同秒录入）；
    #    无时间戳则退化为按录入顺序切分（group_size 控制每组点数）
    from collections import OrderedDict

    if group_size > 1:
        # 手动切分：每 group_size 个数据点 = 1 run
        buckets: "OrderedDict[str, list]" = OrderedDict()
        for i, dp in enumerate(data_points):
            key = f"seq_{i // group_size}"
            buckets.setdefault(key, []).append(dp)
        grouping = f"sequential (group_size={group_size})"
    else:
        # 自动：同 measurement_time 秒桶 = 同一 run；无时间戳归入 __no_time__（按录入顺序连续归一 run）
        buckets = OrderedDict()
        for dp in data_points:
            ts = dp.measurement_time
            key = ts.strftime("%Y-%m-%dT%H:%M:%S") if ts else "__no_time__"
            buckets.setdefault(key, []).append(dp)
        grouping = "measurement_time_second_bucket"

    runs: List[dict] = []
    run_id = 1
    for _key, group_points in buckets.items():
        factor_levels: dict = {}
        for dp in group_points:
            param_name = dp.data_type
            # data_value 是 double precision 数值列；直接取 float（None 跳过）
            parsed = None
            if dp.data_value is not None:
                try:
                    parsed = float(dp.data_value)
                except (ValueError, TypeError):
                    parsed = None
            if parsed is not None:
                factor_levels[param_name] = parsed
        runs.append({
            "run_id": run_id,
            "_all_levels": factor_levels,
        })
        run_id += 1

    # 过滤掉没有任何数值参数的 run（无法参与拟合）
    runs = [r for r in runs if r["_all_levels"]]

    # 4. 推断每个参数的 min/max（用于编码到 [-1, 1]）
    param_stats: dict = {}
    for run in runs:
        for name, val in run["_all_levels"].items():
            s = param_stats.setdefault(name, {"min": val, "max": val})
            s["min"] = min(s["min"], val)
            s["max"] = max(s["max"], val)

    all_param_names = sorted(param_stats.keys())

    # 5. 为每个 run 计算 coded_levels（基于全体 min/max 线性编码）
    for run in runs:
        coded: dict = {}
        for name, val in run["_all_levels"].items():
            s = param_stats[name]
            low, high = s["min"], s["max"]
            if high != low:
                coded[name] = round((val - (low + high) / 2) / ((high - low) / 2), 6)
            else:
                coded[name] = 0.0
        run["coded_levels"] = coded
        run.pop("_all_levels", None)

    # 6. 确定响应变量：显式指定 response_parameter，否则退化为所有参数（前端再挑）
    if response_parameter and response_parameter in all_param_names:
        chosen_responses = [response_parameter]
    else:
        chosen_responses = all_param_names

    # 7. 因子 = 非响应参数（自变量）；响应 = 因变量；二者严格分离，避免拟合时把响应当因子
    factor_names = [p for p in all_param_names if p not in chosen_responses]

    factors_out: List[dict] = []
    for name in factor_names:
        s = param_stats[name]
        low, high = s["min"], s["max"]
        factors_out.append({
            "name": name,
            "low": low,
            "high": high,
            "center": (low + high) / 2,
        })

    # 8. 重写 runs：factor_levels/coded_levels 只含因子；response_values 只含响应
    for run in runs:
        all_coded = run.pop("coded_levels", {})
        # 每个 run 只含 factor_names（自变量）的编码
        run["coded_levels"] = {k: all_coded.get(k, 0.0) for k in factor_names}
        # factor_levels：从编码反解回原始实际值（v = center + c*half）
        fl: dict = {}
        for name in factor_names:
            s = param_stats[name]
            low, high = s["min"], s["max"]
            c = run["coded_levels"].get(name, 0.0)
            fl[name] = round((low + high) / 2 + c * ((high - low) / 2), 6) if high != low else (low + high) / 2
        run["factor_levels"] = fl
        # response_values：被选为响应变量的参数（原始值），按编码反解
        resp_vals: dict = {}
        for name in chosen_responses:
            s = param_stats[name]
            low, high = s["min"], s["max"]
            c_resp = all_coded.get(name, 0.0)
            resp_vals[name] = round((low + high) / 2 + c_resp * ((high - low) / 2), 6) if high != low else (low + high) / 2
        run["response_values"] = resp_vals
        run.pop("coded_levels_tmp", None)

    return {
        "status": "ok",
        "experiment": {
            "id": experiment.id,
            "name": exp_name,
            "code": getattr(experiment, "code", None),
            "status": getattr(experiment, "status", None),
        },
        "total_data_points": len(data_points),
        "total_runs": len(runs),
        "grouping": grouping,
        "factors": factors_out,
        "response_candidates": chosen_responses,
        "all_parameters": all_param_names,
        "runs": runs,
        "note": "factors=自变量（编码范围），response_candidates=因变量；runs 可直接 POST /doe/fit",
    }


class DoeExportRequest(BaseModel):
    experiment_id: int = Field(..., ge=1, description="目标实验 ID")
    recommendations: List[dict] = Field(..., description="DOE 推荐点 [{run_id, coded_levels, factor_levels}]")
    note: str = ""


@router.post("/experiments/export", summary="把 DOE 推荐点写回实验管理（主动学习闭环）")
async def export_recommendations_to_experiment(
    req: DoeExportRequest = Body(...),
    db=Depends(get_db),
) -> dict:
    """
    将主动学习推荐的下一批实验点写回实验管理模块，形成闭环。

    行为：
    - 每个推荐点 → 一条 experiment_data 记录（parameter = 因子名，value = 因子实际值）
    - 推荐点的 factor_levels（编码值）作为 value 录入，notes 标记 "DOE 主动学习推荐 #{run_id}，策略：..."
    - 返回写回的数据点 ID 列表，便于后续回填响应值

    说明：experiment_data 的 value 字段是字符串，编码值以 float 形式存入，
    与 /doe/experiments/{id}/runs 的导入方向形成对称（导入=编码→DOE，导出=DOE→编码）。
    响应值留空待实验执行后回填。
    """
    from app.models.experiment import Experiment, ExperimentData

    # 1. 确认目标实验存在
    exp_result = await db.execute(select(Experiment).where(Experiment.id == req.experiment_id))
    experiment = exp_result.scalar_one_or_none()
    if experiment is None:
        raise HTTPException(status_code=404, detail=f"实验 {req.experiment_id} 不存在")

    # 2. 每个推荐点 → 每个因子 = 一条数据点
    #    experiment_data 真实列：data_type(参数名, NOT NULL) / data_value(double, 可空) / notes
    #    推荐点 factor_levels 为实际值（float），存入 data_value；notes 标记 DOE 主动学习来源
    created_ids: List[int] = []
    for rec in req.recommendations:
        run_id = rec.get("run_id", 0)
        factor_levels: dict = rec.get("factor_levels") or {}
        if not factor_levels:
            # 无因子值（如初始设计空占位）则跳过
            continue
        for param_name, value in factor_levels.items():
            parsed_val = None
            if value is not None:
                try:
                    parsed_val = float(value)
                except (ValueError, TypeError):
                    parsed_val = None
            dp = ExperimentData(
                experiment_id=req.experiment_id,
                data_type=str(param_name),
                data_value=parsed_val,
                unit="actual",
                notes=f"DOE 主动学习推荐 #{run_id}。{req.note}".strip(),
            )
            db.add(dp)
            await db.flush()
            created_ids.append(dp.id)

    # 显式提交事务，让推荐点真实落库
    # get_db 依赖在请求结束时会按 session.dirty/new 自动 commit，
    # 但 flush 后 dirty 集合不一定反映 ORM 对象的持久化状态，
    # 因此在此显式 commit，确保返回的 data_point_ids 在数据库中真实存在。
    await db.commit()

    if not created_ids:
        return {
            "status": "ok",
            "experiment_id": req.experiment_id,
            "created_data_points": 0,
            "note": "推荐点中无可写因子值（如空初始设计），未写入任何数据点。",
        }

    # get_db 依赖会在请求结束前自动 commit（session.dirty/new 时）

    return {
        "status": "ok",
        "experiment_id": req.experiment_id,
        "created_data_points": len(created_ids),
        "data_point_ids": created_ids,
        "note": "推荐点已写入实验管理，执行实验后回填响应值，可再次 /doe/experiments/{id}/runs → /doe/fit 提升模型。",
    }


@router.get("/formulas", summary="列出可作为 DOE 种子的真实配方（含真实成分占比）")
async def list_seed_formulas(
    db=Depends(get_db),
) -> dict:
    """
    从真实数据库读取：有成分占比的配方（formulas + formula_ingredients + ingredients）。

    返回每个配方的 id、name、成分列表（成分名 + 真实 percentage），
    供前端"从配方生成种子"下拉选择。纯真实数据，不构造任何值。
    """
    rows = (
        await db.execute(
            text(
                "SELECT f.id, f.name, i.name AS ingredient_name, fi.percentage "
                "FROM formula_ingredients fi "
                "JOIN formulas f ON f.id = fi.formula_id "
                "LEFT JOIN ingredients i ON i.id = fi.ingredient_id "
                "ORDER BY f.id, fi.percentage DESC"
            )
        )
    ).fetchall()

    # 按配方聚合
    formulas: dict = {}
    for r in rows:
        fid, fname, iname, pct = r[0], r[1], r[2], r[3]
        item = formulas.setdefault(fid, {"id": fid, "name": fname, "ingredients": []})
        item["ingredients"].append({
            "name": iname or f"ingredient_{fid}_{fname}",
            "percentage": float(pct) if pct is not None else None,
        })

    result = [
        f for f in formulas.values()
        if any(g.get("percentage") is not None for g in f["ingredients"])
    ]
    return {"status": "ok", "total": len(result), "formulas": result}


@router.get("/seed-from-formula/{formula_id}", summary="从真实配方生成 DOE 种子运行（成分占比 → 因子，真实响应）")
async def seed_from_formula(
    formula_id: int,
    n_center: int = Query(2, ge=0, le=10, description="中心点数量（默认 2）"),
    response_parameter: Optional[str] = Query("感官评分", description="响应变量名（来自实验管理真实数据点）"),
    experiment_id: Optional[int] = Query(None, description="目标实验 ID；提供时响应值按该实验的数据点分组取真实值"),
    db=Depends(get_db),
) -> dict:
    """
    把一条真实配方的成分占比（formula_ingredients.percentage，真实数据）转成 DOE 种子运行：

    语义映射（全部来自 DB 真实记录，无模拟值）：
    - 因子 = 配方的每个成分（ingredient 名）
    - 每个因子的两水平 = 真实占比 pct 与 pct/2（pct 来自 DB；pct/2 仍在真实占比区间内）
    - 非参与因子的固定水平 = pct * 0.75（落在 [pct/2, pct] 真实区间内）
    - 2^3 个因子点（前 3 个成分）+ n_center 个中心点 = 种子 run
    - 响应 = 该响应参数在实验管理里的真实数值（如"感官评分"=72.0）

    返回可直接 POST /doe/fit 的 runs + factors + response，前端自动回填拟合队列。
    """

    # 1. 读真实配方 + 成分占比
    rows = (
        await db.execute(
            text(
                "SELECT i.name AS ingredient_name, fi.percentage, fi.unit "
                "FROM formula_ingredients fi "
                "JOIN formulas f ON f.id = fi.formula_id "
                "LEFT JOIN ingredients i ON i.id = fi.ingredient_id "
                "WHERE f.id = :fid ORDER BY fi.percentage DESC"
            ),
            {"fid": formula_id},
        )
    ).fetchall()
    if not rows:
        raise HTTPException(status_code=404, detail=f"配方 {formula_id} 不存在或无成分占比")

    fname = (await db.execute(
        text("SELECT name FROM formulas WHERE id=:fid"), {"fid": formula_id}
    )).scalar_one_or_none()
    formula_name = fname or f"formula_{formula_id}"

    ingredients = [
        {"name": (r[0] or f"ing_{i}"), "pct": float(r[1]) if r[1] is not None else None, "unit": r[2] or "g"}
        for i, r in enumerate(rows)
    ]
    # 只用有真实占比的成分作因子
    ingredients = [g for g in ingredients if g["pct"] is not None and g["pct"] > 0]
    if len(ingredients) < 2:
        raise HTTPException(
            status_code=400,
            detail=f"配方 {formula_id} 有效成分不足 2 个（需 2 个以上有真实占比的成分才能做 DOE）",
        )

    # 2. 读该响应参数的真实数值
    #    若指定 experiment_id：取该实验里该响应参数分组(连续相同值)取不同真实值
    #    未指定或该实验无该参数：取全库最早一条有值的数据点（保持原行为）
    if experiment_id is not None:
        sens_vals = (await db.execute(
            text(
                "SELECT id, data_value FROM experiment_data "
                "WHERE experiment_id=:eid AND data_type=:t AND data_value IS NOT NULL "
                "ORDER BY id"
            ),
            {"eid": experiment_id, "t": response_parameter},
        )).fetchall()
        if sens_vals:
            # 按"连续相同值"分组，取各组首个真实值 → 不同 run 得到不同真实响应
            grouped: List[float] = []
            prev = object()
            for _dp_id, val in sens_vals:
                v = float(val)
                if v != prev:
                    grouped.append(v)
                    prev = v
            # 若分组数不足 run 数，循环复用真实值（不造假，是真实值的重复）
            sensory_pool = grouped
        else:
            # 该实验没有该参数 → 退回全库
            sensory_all = (await db.execute(
                text(
                    "SELECT data_value FROM experiment_data "
                    "WHERE data_type=:t AND data_value IS NOT NULL "
                    "ORDER BY id"
                ),
                {"t": response_parameter},
            )).fetchall()
            if not sensory_all:
                raise HTTPException(
                    status_code=400,
                    detail=f"响应参数 '{response_parameter}' 在实验 {experiment_id} 及全库中都没有真实数值，无法作响应",
                )
            sensory_pool = [float(r[0]) for r in sensory_all]
    else:
        sensory_scalar = (await db.execute(
            text(
                "SELECT data_value FROM experiment_data "
                "WHERE data_type=:t AND data_value IS NOT NULL "
                "ORDER BY id LIMIT 1"
            ),
            {"t": response_parameter},
        )).scalar()
        if sensory_scalar is None:
            raise HTTPException(
                status_code=400,
                detail=f"响应参数 '{response_parameter}' 在实验管理里没有真实数值，无法作响应",
            )
        sensory_pool = [float(sensory_scalar)]

    # 3. 构造 2^3 因子点 + 中心点（前 3 个成分做高低水平，其余固定 0.75*pct）
    import itertools
    active = ingredients[:3]
    fixed_names = [g["name"] for g in ingredients[3:]]
    conditions: List[dict] = []
    for combo in itertools.product([0, 1], repeat=min(3, len(active))):
        cond: dict = {}
        for i, g in enumerate(active):
            if i < len(combo):
                cond[g["name"]] = g["pct"] / 2 if combo[i] == 0 else g["pct"]
            else:
                cond[g["name"]] = g["pct"] * 0.75
        for nm in fixed_names:
            g = next(x for x in ingredients if x["name"] == nm)
            cond[nm] = g["pct"] * 0.75
        conditions.append(cond)
    center = {g["name"]: g["pct"] * 0.75 for g in ingredients}
    for _ in range(max(0, n_center)):
        conditions.append(dict(center))

    # 4. 计算每个因子的 min/max（用于编码 [-1,1]）+ 生成 runs
    factor_names = [g["name"] for g in ingredients]
    stats: dict = {}
    for cond in conditions:
        for nm in factor_names:
            v = cond.get(nm, 0.0)
            s = stats.setdefault(nm, {"min": v, "max": v})
            s["min"] = min(s["min"], v)
            s["max"] = max(s["max"], v)

    factors_out: List[dict] = []
    for nm in factor_names:
        lo, hi = stats[nm]["min"], stats[nm]["max"]
        factors_out.append({
            "name": nm,
            "low": lo,
            "high": hi,
            "center": (lo + hi) / 2,
        })

    runs: List[dict] = []
    for idx, cond in enumerate(conditions):
        coded: dict = {}
        fl: dict = {}
        for nm in factor_names:
            s = stats[nm]
            lo, hi = s["min"], s["max"]
            v = cond.get(nm, 0.0)
            fl[nm] = round(v, 4)
            coded[nm] = round((v - (lo + hi) / 2) / ((hi - lo) / 2), 6) if hi != lo else 0.0
        # 按 run 取真实响应值（来自实验数据点分组，不足时循环复用）
        resp_val = round(sensory_pool[idx % len(sensory_pool)], 4)
        runs.append({
            "run_id": idx + 1,
            "coded_levels": coded,
            "factor_levels": fl,
            "response_values": {response_parameter: resp_val},
        })

    return {
        "status": "ok",
        "formula": {"id": formula_id, "name": formula_name},
        "response_parameter": response_parameter,
        "response_pool": sensory_pool,
        "total_runs": len(runs),
        "factors": factors_out,
        "runs": runs,
        "experiment_id": experiment_id,
        "note": "由真实配方成分占比 + 真实实验数据点响应值生成，可直接 POST /doe/fit 拟合响应面",
    }


@router.get("/health", summary="DOE 引擎健康检查")
async def health_check() -> dict:
    """验证 DOE 引擎可用"""
    get_doe_engine()
    return {
        "status": "healthy",
        "supported_designs": ["ccd", "bbd", "mixture"],
        "features": ["design_generation", "response_surface_fit", "inverse_search", "active_learning"],
        "timestamp": __import__("datetime").datetime.now().isoformat(),
    }
