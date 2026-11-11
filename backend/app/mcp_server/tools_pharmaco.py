"""RMFOODFP MCP 服务器 —— 药理参数只读工具组（TCMSP 网络**只读**。

- ``get_herb_pk`` 药代动力学(PK)：F(生物利用度)/ka/Vd/CL/t_lag
- ``get_herb_pd`` 药效动力学(PD)：E_max/EC50/Hill/efficacy_scores

数据来源与**降级策略（与 tools.py / tools_p1.py 的关键差异）**：
1. 优先走真实 DB：``app.models.herb_pharmaco_params.TCMHerbPK / TCMHerbPD``
   （tcm_herbs_pk / tcm_herbs_pd），经 db.py 的 ``db_session`` 查询。
2. **不做 sample 兜底、绝不编造数值**。PK/PD 参数（F/EC50 等）若伪造会直接
   误导下游，故本模块遵循"宁缺毋滥"：
   - DB 查无该药材 → 返回明确的"暂无该药材药理参数数据（覆盖有限）"，不填 sample 数值。
   - DB 不可用/超时 → 返回"药理参数查询暂不可用"，同样不填数值。
   这与 search_herbs 的静态示例兜底**有意不同**——字典表可示例兜底，药理参数不可。

溯源诚实性（本模块核心要求）：
- PK/PD 参数**大多为 model_derived 推导值**（F ← TCMSP 实测 OB%；ka/Vd/CL ←
  logP/TPSA 分子描述子 + 经典 PK 估算公式；EC50 ← 主成分描述子 + 药理惯例；
  Hill ← 典型默认 1.5）。真实行自带 ``source``（逐参数标注 DB_real /
  model_derived / model_default）与 ``confidence``（0~1）字段。
- 本工具**原样呈现 source / confidence / derived_from**，并在渲染中释义
  model_derived / model_default 含义，明确"非实测、勿当实测数据使用"。
- 全库覆盖极有限（tcm_herbs_pk / tcm_herbs_pd 各仅个位数条记录），渲染中显式提示。

多租户：TCMHerbPK/PD 为全局药材药理字典（无租户字段），不做租户过滤，注释说明。

安全边界：只读参考数据展示（带 source/confidence），**不是诊断/处方建议**。

只读约束：本模块所有函数只做 SELECT，无任何 INSERT/UPDATE/DELETE。
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any

logger = logging.getLogger("rmfood.mcp_server.tools_pharmaco")

# 与 tools.py / tools_p1.py 一致的真实库查询超时（秒）
DB_TIMEOUT_S = 3.0

# ── 药理参数工具 JSON Schema ─────────────────────────────────────────

TOOL_DEFINITIONS_PHARMACO: list[dict[str, Any]] = [
    {
        "name": "get_herb_pk",
        "title": "药材药代动力学参数(PK)",
        "description": (
            "查询 TCM 药材的药代动力学(PK)参数：F(生物利用度)/ka(吸收速率)/Vd(分布容积)/"
            "CL(清除率)/t_lag(吸收滞后)，每项附数据溯源(source)与置信度(confidence)。"
            "注意：除 F 多来自 TCMSP 实测 OB% 外，ka/Vd/CL/t_lag 多为 model_derived 推导值"
            "（分子描述子 + 经典 PK 估算公式），**非实测**；全库覆盖极有限（仅少数药材有记录）。"
            "输入 herb_name_cn（如 茯苓）或 herb_id。只读参考数据，非诊疗依据。"
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "herb_name_cn": {"type": "string", "description": "药材中文名，如 茯苓 / 黄芪（与 herb_id 二选一）"},
                "herb_id": {"type": "integer", "description": "药材 ID（与 herb_name_cn 二选一，优先）"},
            },
            "required": [],
        },
    },
    {
        "name": "get_herb_pd",
        "title": "药材药效动力学参数(PD)",
        "description": (
            "查询 TCM 药材的药效动力学(PD)参数：E_max(最大效应)/EC50(半效浓度)/Hill(陡峭度)/"
            "efficacy_scores(药效评分)，每项附数据溯源(source)与置信度(confidence)。"
            "注意：E_max 多来自 DB 药效评分，EC50 为 model_derived 推导、Hill 为 model_default 默认值，"
            "**非实测**；全库覆盖极有限。输入 herb_name_cn 或 herb_id。只读参考数据，非诊疗依据。"
        ),
        "inputSchema": {
            "type": "object",
            "properties": {
                "herb_name_cn": {"type": "string", "description": "药材中文名，如 茯苓 / 黄芪（与 herb_id 二选一）"},
                "herb_id": {"type": "integer", "description": "药材 ID（与 herb_name_cn 二选一，优先）"},
            },
            "required": [],
        },
    },
]

_TOOL_NAMES_PHARMACO = {t["name"] for t in TOOL_DEFINITIONS_PHARMACO}

# 覆盖有限提示（诚实：不硬编码具体药材名，避免数据演进后过时）
_COVERAGE_NOTE = "⚠ 覆盖有限：TCMSP 药理参数稀缺，全库仅个位数药材有 PK/PD 记录；未收录的药材会返回“暂无数据”。"
_DISCLAIMER = "参考数据，非诊疗依据。source 标注 model_derived/model_default 者为推导/默认值，非实测，勿当实测数据使用。"


# ── 真实数据访问（查无 / 异常均不编造）──────────────────────────────

async def _try_real_get_herb_pk(
    herb_name_cn: str | None, herb_id: int | None,
) -> dict | None:
    """查 TCMHerbPK（tcm_herbs_pk）。返回：
    - None                ：DB 异常（触发上层"查询暂不可用"诚实提示）
    - {"error": ...}      ：DB 正常但查无该药材（触发"暂无数据"诚实提示，不编造）
    - {完整记录, _source} ：查到真实行
    全局表，无租户字段，不做租户过滤。
    """
    try:
        from sqlalchemy import select

        from app.mcp_server.db import db_session
        from app.models.herb_pharmaco_params import TCMHerbPK

        async with db_session() as db:
            stmt = select(TCMHerbPK)
            if herb_id is not None:
                stmt = stmt.where(TCMHerbPK.herb_id == herb_id)
            elif herb_name_cn:
                stmt = stmt.where(TCMHerbPK.herb_name_cn == herb_name_cn)
            else:
                return {"error": "必须提供 herb_name_cn 或 herb_id", "_source": "validation"}

            row = (await db.execute(stmt)).scalars().first()
            if not row:
                return {"error": f"暂无该药材的 PK 参数数据: {herb_name_cn or herb_id}", "_source": "db"}

            return {
                "herb_id": row.herb_id,
                "herb_name_cn": row.herb_name_cn,
                "F": row.F,
                "F_source": getattr(row, "F_source", None),
                "ka": row.ka,
                "Vd": row.Vd,
                "CL": row.CL,
                "t_lag": row.t_lag,
                "source": getattr(row, "source", None),
                "confidence": row.confidence,
                "derived_from": getattr(row, "derived_from", None),
                "_source": "db",
            }
    except Exception as exc:  # noqa: BLE001 - DB 不可用→诚实"暂不可用"，不编造
        logger.info("get_herb_pk 走真实库失败: %s", exc)
        return None


async def _try_real_get_herb_pd(
    herb_name_cn: str | None, herb_id: int | None,
) -> dict | None:
    """查 TCMHerbPD（tcm_herbs_pd）。返回语义同 _try_real_get_herb_pk。"""
    try:
        from sqlalchemy import select

        from app.mcp_server.db import db_session
        from app.models.herb_pharmaco_params import TCMHerbPD

        async with db_session() as db:
            stmt = select(TCMHerbPD)
            if herb_id is not None:
                stmt = stmt.where(TCMHerbPD.herb_id == herb_id)
            elif herb_name_cn:
                stmt = stmt.where(TCMHerbPD.herb_name_cn == herb_name_cn)
            else:
                return {"error": "必须提供 herb_name_cn 或 herb_id", "_source": "validation"}

            row = (await db.execute(stmt)).scalars().first()
            if not row:
                return {"error": f"暂无该药材的 PD 参数数据: {herb_name_cn or herb_id}", "_source": "db"}

            return {
                "herb_id": row.herb_id,
                "herb_name_cn": row.herb_name_cn,
                "E_max": row.E_max,
                "E_max_source": getattr(row, "E_max_source", None),
                "EC50": row.EC50,
                "Hill": row.Hill,
                "efficacy_scores": row.efficacy_scores or {},
                "source": getattr(row, "source", None),
                "confidence": row.confidence,
                "derived_from": getattr(row, "derived_from", None),
                "_source": "db",
            }
    except Exception as exc:  # noqa: BLE001
        logger.info("get_herb_pd 走真实库失败: %s", exc)
        return None


# ── 渲染（显式标注 source / confidence）─────────────────────────────

def _num(v: Any, unit: str = "") -> str:
    return f"{v}{unit}" if v is not None else "无数据"


def _fmt_pk(r: dict) -> str:
    lines = [
        f"{r['herb_name_cn']}（herb_id={r['herb_id']}）药代动力学(PK)参数 · 一室模型",
        f"  F     生物利用度    : {_num(r.get('F'))}    [F_source: {r.get('F_source') or '未标注'}]",
        f"  ka    吸收速率常数 : {_num(r.get('ka'), ' h⁻¹')}",
        f"  Vd    分布容积      : {_num(r.get('Vd'), ' L/kg')}",
        f"  CL    清除率        : {_num(r.get('CL'), ' L/h/kg')}",
        f"  t_lag 吸收滞后     : {_num(r.get('t_lag'), ' h')}",
        f"各参数来源(source): {r.get('source') or '未标注'}",
        f"置信度(confidence): {r.get('confidence')} （1.0=实测 / 0=推测）",
    ]
    if r.get("derived_from"):
        lines.append(f"推导依据(derived_from): {str(r['derived_from'])[:180]}")
    lines.append(f"说明: {_DISCLAIMER}")
    lines.append(_COVERAGE_NOTE)
    lines.append(f"(source={r.get('_source')})")
    return "\n".join(lines)


def _fmt_pd(r: dict) -> str:
    lines = [
        f"{r['herb_name_cn']}（herb_id={r['herb_id']}）药效动力学(PD)参数 · Sigmoid Emax",
        f"  E_max 最大效应   : {_num(r.get('E_max'))}    [E_max_source: {r.get('E_max_source') or '未标注'}]",
        f"  EC50  半效浓度   : {_num(r.get('EC50'), ' μg/mL')}",
        f"  Hill  陡峭度     : {_num(r.get('Hill'))}",
    ]
    scores = r.get("efficacy_scores") or {}
    if scores:
        joined = " | ".join(f"{k} {v}" for k, v in scores.items())
        lines.append(f"  药效评分(efficacy_scores): {joined}")
    lines.append(f"各参数来源(source): {r.get('source') or '未标注'}")
    lines.append(f"置信度(confidence): {r.get('confidence')} （1.0=实测 / 0=推测）")
    if r.get("derived_from"):
        lines.append(f"推导依据(derived_from): {str(r['derived_from'])[:180]}")
    lines.append(f"说明: {_DISCLAIMER}")
    lines.append(_COVERAGE_NOTE)
    lines.append(f"(source={r.get('_source')})")
    return "\n".join(lines)


# ── 药理参数工具执行入口 ─────────────────────────────────────────────

async def call_tool_pharmaco(name: str, args: dict, tenant_id: int | None = None) -> dict:
    """执行药理参数只读工具，返回 MCP content 结构。

    与 tools.call_tool / tools_p1.call_tool_p1 同签名；由接线方（tools/server）
    转发未命中的 name 进来。tenant_id 对 PK/PD 全局表无意义（无租户字段），忽略。

    降级策略（宁缺毋滥）：
    - 真实行 → 渲染 + source/confidence
    - 查无该药材（{"error":...}）→ 诚实"暂无数据"，**不填 sample 数值**
    - DB 异常/超时（None）→ 诚实"查询暂不可用"，**不填 sample 数值**
    """
    herb_name_cn = str(args.get("herb_name_cn") or "").strip() or None
    raw_id = args.get("herb_id")
    herb_id: int | None
    try:
        herb_id = int(raw_id) if raw_id is not None else None
    except (TypeError, ValueError):
        herb_id = None

    if name not in _TOOL_NAMES_PHARMACO:
        raise KeyError(name)
    if herb_id is None and not herb_name_cn:
        return {"content": [{"type": "text", "text": "必须提供 herb_name_cn 或 herb_id"}], "isError": True}

    if name == "get_herb_pk":
        try:
            real = await asyncio.wait_for(
                _try_real_get_herb_pk(herb_name_cn, herb_id), timeout=DB_TIMEOUT_S
            )
        except asyncio.TimeoutError:
            real = None
        if real is None:
            text = "药理参数查询暂不可用（数据库连接失败/超时）。为避免误导，不返回任何推测数值。\n参考数据，非诊疗依据。"
            return {"content": [{"type": "text", "text": text}], "isError": True}
        if "error" in real:
            text = (
                f"{real['error']}\n{_COVERAGE_NOTE}\n为避免误导，未返回任何替代/推测数值。\n参考数据，非诊疗依据。"
            )
            return {"content": [{"type": "text", "text": text}]}
        return {"content": [{"type": "text", "text": _fmt_pk(real)}]}

    if name == "get_herb_pd":
        try:
            real = await asyncio.wait_for(
                _try_real_get_herb_pd(herb_name_cn, herb_id), timeout=DB_TIMEOUT_S
            )
        except asyncio.TimeoutError:
            real = None
        if real is None:
            text = "药理参数查询暂不可用（数据库连接失败/超时）。为避免误导，不返回任何推测数值。\n参考数据，非诊疗依据。"
            return {"content": [{"type": "text", "text": text}], "isError": True}
        if "error" in real:
            text = (
                f"{real['error']}\n{_COVERAGE_NOTE}\n为避免误导，未返回任何替代/推测数值。\n参考数据，非诊疗依据。"
            )
            return {"content": [{"type": "text", "text": text}]}
        return {"content": [{"type": "text", "text": _fmt_pd(real)}]}

    # 理论不可达（前面已 KeyError）
    raise KeyError(name)
