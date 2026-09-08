"""
仪表盘、排行、趋势与搜索建议 API
"""
import json
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import JSONResponse
from sqlalchemy import select, func, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.ext.asyncio import AsyncSession

from ..deps import get_db_session, get_current_user
from ...models import (
    User, TCMHerb, MMIDHerb, BioactivePeptide,
    DataSnapshot,
)
from ...services.data_sources.tcmsp_client import tcmsp_service
from ...services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE
from ...services.data_sources.graph_service import graph_service

"""
Shared router for dashboard module.
"""
from . import router

import logging
logger = logging.getLogger(__name__)

@router.get("/ranking/food-homology", summary="药食同源原料热度排行")
async def ranking_food_homology(
    db: AsyncSession = Depends(get_db_session),
):
    """
    药食同源原料热度排行 — 基于 TCMSP 药材数据综合热度评分
    筛选 is_food_homology=True 的药食同源药材，按 OB% 降序排列返回 TOP 20
    热度分数公式: heat_score = ob_percent * 0.4 + compound_count * 2 + target_count * 3
    （公开接口，无需认证）
    """
    from datetime import datetime

    # ── 数据库优先：查询药食同源药材 ──
    herbs_db = (await db.execute(
        select(TCMHerb).where(TCMHerb.is_food_homology == True).order_by(TCMHerb.id)
    )).scalars().all()

    if len(herbs_db) > 0:
        ranked = []
        for h in herbs_db:
            ob = h.ob_percent or 0
            cc = len(h.compounds) if isinstance(h.compounds, list) else 0
            tc = len(h.targets) if isinstance(h.targets, list) else 0
            heat_score = round(ob * 0.4 + cc * 2 + tc * 3, 2)
            effects_raw = h.effects or ""
            effects_truncated = effects_raw[:50] + ("..." if len(effects_raw) > 50 else "")
            ranked.append({
                "name_cn": h.name_cn or f"(ID:{h.id})",
                "name_latin": h.name_latin or "",
                "ob_percent": round(ob, 2),
                "dl_value": round(h.dl_value or 0, 3),
                "compound_count": cc,
                "target_count": tc,
                "category": h.category or "",
                "effects": effects_truncated,
                "is_food_homology": True,
                "heat_score": heat_score,
            })

        ranked.sort(key=lambda x: (x["ob_percent"], x["heat_score"]), reverse=True)
        top20 = ranked[:20]
        for i, item in enumerate(top20, 1):
            item["rank"] = i

        return {
            "items": top20,
            "total": len(herbs_db),
            "generated_at": datetime.now().isoformat(),
            "data_source": "database",
        }

    # ── Fallback: 内存数据 ──
    from ...services.data_sources.tcmsp_client import TCMSP_HERB_DATABASE

    candidates = [
        h for h in TCMSP_HERB_DATABASE
        if h.get("is_food_homology") is True
    ]

    ranked = []
    for h in candidates:
        ob = h.get("ob_percent") or 0
        cc = len(h.get("compounds", []))
        tc = len(h.get("targets", []))
        heat_score = round(ob * 0.4 + cc * 2 + tc * 3, 2)
        effects_raw = h.get("effects") or ""
        effects_truncated = effects_raw[:50] + ("..." if len(effects_raw) > 50 else "")
        ranked.append({
            "name_cn": h["name_cn"],
            "name_latin": h.get("name_latin", ""),
            "ob_percent": round(ob, 2),
            "dl_value": round(h.get("dl_value") or 0, 3),
            "compound_count": cc,
            "target_count": tc,
            "category": h.get("category", ""),
            "effects": effects_truncated,
            "is_food_homology": True,
            "heat_score": heat_score,
        })

    ranked.sort(key=lambda x: (x["ob_percent"], x["heat_score"]), reverse=True)
    top20 = ranked[:20]

    for i, item in enumerate(top20, 1):
        item["rank"] = i

    return {
        "items": top20,
        "total": len(candidates),
        "generated_at": datetime.now().isoformat(),
        "data_source": "memory_fallback",
    }


@router.get("/ranking/active-peptides", summary="高活性肽活性排行")
async def ranking_active_peptides(
    db: AsyncSession = Depends(get_db_session),
):
    """
    高活性肽活性排行 — 基于 PostgreSQL 活性肽数据的 ACE 抑制肽活性排名
    筛选 activity_type="ACE inhibitory" 的肽，按 activity_value 升序排列返回 TOP 20（值越小活性越高）
    活性评分公式: activity_score = (1000 / (activity_value + 0.01)) * log(seq_length + 1)
    （公开接口，无需认证）
    """
    from datetime import datetime
    from math import log

    # ── 数据库优先查询 ──
    peptides_db = (await db.execute(
        select(BioactivePeptide)
        .where(BioactivePeptide.activity_type == "ACE inhibitory")
        .where(BioactivePeptide.activity_value.isnot(None))
        .order_by(text("CAST(activity_value AS FLOAT) ASC"))
        .limit(20)
    )).scalars().all()

    if len(peptides_db) > 0:
        ranked = []
        for p in peptides_db:
            try:
                av = float(p.activity_value)
            except (ValueError, TypeError):
                continue
            seq_len = len(p.sequence or "")
            activity_score = round((1000 / (av + 0.01)) * log(seq_len + 1), 4)
            ranked.append({
                "sequence": p.sequence or "",
                "activity_value": round(av, 6),
                "activity_unit": p.activity_unit or "μM",
                "source_protein": p.source_protein or "",
                "molecular_weight": round(p.molecular_weight or 0, 1),
                "hydrolysis_enzyme": p.hydrolysis_enzyme or "",
                "activity_type": "ACE inhibitory",
                "seq_length": seq_len,
                "activity_score": activity_score,
            })

        ranked.sort(key=lambda x: x["activity_value"])
        top20 = ranked[:20]
        for i, item in enumerate(top20, 1):
            item["rank"] = i

        # Count total ACE inhibitory peptides in DB
        total_result = await db.execute(
            select(func.count()).select_from(BioactivePeptide)
            .where(BioactivePeptide.activity_type == "ACE inhibitory")
            .where(BioactivePeptide.activity_value.isnot(None))
        )
        total = total_result.scalar() or 0

        return {
            "items": top20,
            "total": total,
            "generated_at": datetime.now().isoformat(),
            "data_source": "database",
        }

    # ── Fallback: 内存数据 ──
    from ...services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE

    candidates = [
        p for p in DFBP_PEPTIDE_DATABASE
        if p.get("activity_type") == "ACE inhibitory"
        and p.get("activity_value") is not None
    ]

    ranked = []
    for p in candidates:
        av = float(p["activity_value"])
        seq_len = len(p.get("sequence") or "")
        activity_score = round((1000 / (av + 0.01)) * log(seq_len + 1), 4)
        ranked.append({
            "sequence": p.get("sequence", ""),
            "activity_value": round(av, 6),
            "activity_unit": p.get("activity_unit", "μM"),
            "source_protein": p.get("source_protein", ""),
            "molecular_weight": round(p.get("molecular_weight") or 0, 1),
            "hydrolysis_enzyme": p.get("hydrolysis_enzyme", ""),
            "activity_type": "ACE inhibitory",
            "seq_length": seq_len,
            "activity_score": activity_score,
        })

    ranked.sort(key=lambda x: x["activity_value"])
    top20 = ranked[:20]

    for i, item in enumerate(top20, 1):
        item["rank"] = i

    return {
        "items": top20,
        "total": len(candidates),
        "generated_at": datetime.now().isoformat(),
    }


@router.get("/dashboard/trends", summary="数据趋势分析")
async def dashboard_trends(
    db: AsyncSession = Depends(get_db_session),
):
    """
    数据趋势分析 — 基于当前数据的静态分析趋势图
    返回药材属性关联趋势、活性类型时间分布模拟等（公开接口）
    """
    import random

    # ── 数据库优先：查询药材和活性肽数据 ──
    herbs_db = (await db.execute(select(TCMHerb).order_by(TCMHerb.id).limit(500))).scalars().all()
    peptides_db = (await db.execute(select(BioactivePeptide).order_by(BioactivePeptide.id).limit(500))).scalars().all()

    use_herb_db = len(herbs_db) > 0
    use_peptide_db = len(peptides_db) > 0

    # 选择数据源
    if use_herb_db:
        herbs_source = herbs_db
        is_herb_orm = True
    else:
        from ...services.data_sources.tcmsp_client import TCMSP_HERB_DATABASE
        herbs_source = TCMSP_HERB_DATABASE
        is_herb_orm = False

    if use_peptide_db:
        peptides_source = peptides_db
        is_peptide_orm = True
    else:
        from ...services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE
        peptides_source = DFBP_PEPTIDE_DATABASE
        is_peptide_orm = False

    # ── 药材 OB vs DL 散点数据 (用于散点图，采样 200 条) ──
    ob_dl_scatter = []
    sample_herbs = random.sample(herbs_source, min(300, len(herbs_source)))
    for h in sample_herbs:
        if is_herb_orm:
            ob = h.ob_percent
            dl = h.dl_value
            name_cn = h.name_cn or f"(ID:{h.id})"
            category = h.category or ""
            is_fh = bool(h.is_food_homology)
        else:
            ob = h.get("ob_percent")
            dl = h.get("dl_value")
            name_cn = h["name_cn"]
            category = h.get("category", "")
            is_fh = h.get("is_food_homology", False)

        if ob is not None and dl is not None:
            ob_dl_scatter.append({
                "x": round(ob, 2),
                "y": round(dl, 3),
                "name": name_cn,
                "category": category,
                "is_food_homology": is_fh,
            })

    # ── 化合物数 vs 靶点数 关联 ──
    compound_target_corr = []
    for h in herbs_source:
        if is_herb_orm:
            cc = len(h.compounds) if isinstance(h.compounds, list) else 0
            tc = len(h.targets) if isinstance(h.targets, list) else 0
            name_cn = h.name_cn or f"(ID:{h.id})"
        else:
            cc = len(h.get("compounds", []))
            tc = len(h.get("targets", []))
            name_cn = h["name_cn"]

        if cc > 0 or tc > 0:
            compound_target_corr.append({
                "x": cc,
                "y": tc,
                "name": name_cn,
            })

    # ── 活性肽分子量 vs 活性值 关联 ──
    mw_activity_scatter = []
    for p in peptides_source:
        if is_peptide_orm:
            mw = p.molecular_weight
            av = p.activity_value
            at = p.activity_type
            seq = p.sequence or ""
            sp = p.source_protein or ""
        else:
            mw = p.get("molecular_weight")
            av = p.get("activity_value")
            at = p.get("activity_type")
            seq = p.get("sequence", "")
            sp = p.get("source_protein", "")

        if mw is not None and av is not None and at == "ACE inhibitory":
            try:
                mw_activity_scatter.append({
                    "x": round(mw, 1),
                    "y": round(float(av), 4),
                    "seq_len": len(seq),
                    "source": sp,
                })
            except (ValueError, TypeError):
                pass  # non-numeric values skipped in scatter plot

    # ── 分类-功效热力数据 ──
    category_effect_matrix = {}
    for h in herbs_source:
        if is_herb_orm:
            cat = h.category or "未分类"
            effects_raw = h.effects or ""
        else:
            cat = h.get("category", "未分类")
            effects_raw = h.get("effects") or ""

        effects = effects_raw.split()[0:1] if effects_raw else [""]
        effect_key = effects[0] if effects else "未知"
        key = f"{cat}|{effect_key}"
        category_effect_matrix[key] = category_effect_matrix.get(key, 0) + 1

    heatmap_data = []
    for k, v in category_effect_matrix.items():
        parts = k.split("|", 1)
        if len(parts) == 2:
            heatmap_data.append({"category": parts[0], "effect": parts[1], "value": v})

    return {
        "ob_dl_scatter": ob_dl_scatter[:200],
        "compound_target_correlation": compound_target_corr[:200],
        "mw_activity_scatter": mw_activity_scatter[:150],
        "category_effect_heatmap": heatmap_data[:80],
        "analysis_notes": {
            "ob_dl_scatter": f"共 {len(ob_dl_scatter)} 个有效数据点",
            "compound_target": f"共 {len(compound_target_corr)} 个有效数据点",
            "mw_activity": f"共 {len(mw_activity_scatter)} 个 ACE 抑制肽数据点",
            "heatmap": f"共 {len(heatmap_data)} 个分类-功效组合",
        },
        "data_source": "database" if (use_herb_db or use_peptide_db) else "memory_fallback",
    }


@router.get("/suggestions", summary="搜索自动补全建议")
async def get_search_suggestions(
    keyword: str = Query(..., min_length=1, description="输入关键词"),
    limit: int = Query(10, ge=1, le=30),
    context: str = Query("herbs", description="搜索上下文: herbs | peptides | food_material | knowledge_graph | all"),
    db: AsyncSession = Depends(get_db_session),
):
    """实时搜索自动补全建议 — 跨数据源（公开接口）

    通过 context 参数控制搜索范围:
    - herbs: 仅中药材 (默认)
    - peptides: 仅活性肽
    - food_material: 食品原料
    - knowledge_graph: 知识图谱节点
    - all: 全部数据源 (默认行为)
    """
    kw = keyword.lower()
    suggestions: dict[str, list[dict]] = {
        "herbs": [], "peptides": [], "graph_nodes": [], "food_materials": []
    }
    include_herbs = context in ("herbs", "all")
    include_peptides = context in ("peptides", "all")
    include_food = context == "food_material"
    include_graph = context in ("knowledge_graph", "all")

    # ── 药材建议（数据库优先 + 内存补充）──
    if include_herbs:
        herbs_db = (await db.execute(
            select(TCMHerb.name_cn, TCMHerb.name_latin, TCMHerb.name_pinyin, TCMHerb.category)
            .where(TCMHerb.name_cn.ilike(f"%{keyword}%"))
            .limit(limit * 2)
        )).all()

        seen_herb_names = set()
        # 添加 DB 结果
        for row in herbs_db:
            name_cn = row[0] or ""
            if name_cn.lower() not in seen_herb_names and kw in name_cn.lower():
                suggestions["herbs"].append({
                    "type": "herb",
                    "label": name_cn,
                    "sublabel": row[1] or "",
                    "category": row[3] or "",
                })
                seen_herb_names.add(name_cn.lower())
                if len(suggestions["herbs"]) >= limit:
                    break

        # 如果 DB 结果不足，从内存补充
        if len(suggestions["herbs"]) < limit:
            from ...services.data_sources.tcmsp_client import TCMSP_HERB_DATABASE
            for h in TCMSP_HERB_DATABASE:
                if len(suggestions["herbs"]) >= limit:
                    break
                name_cn = h.get("name_cn", "")
                if name_cn.lower() not in seen_herb_names and kw in name_cn.lower():
                    suggestions["herbs"].append({
                        "type": "herb",
                        "label": name_cn,
                        "sublabel": h.get("name_latin", ""),
                        "category": h.get("category", ""),
                    })
                    seen_herb_names.add(name_cn.lower())
            # 如果中药材数量已达上限，不需要进一步操作，直接继续到下一个数据源
            if len(suggestions["herbs"]) >= limit:
                pass  # Removed invalid 'break' - no enclosing loop exists here

    # 如果 DB 结果不足，从内存补充
    if len(suggestions["herbs"]) < limit:
        from ...services.data_sources.tcmsp_client import TCMSP_HERB_DATABASE
        for h in TCMSP_HERB_DATABASE:
            if len(suggestions["herbs"]) >= limit:
                break
            name_cn = h.get("name_cn", "")
            if name_cn.lower() not in seen_herb_names and kw in name_cn.lower():
                suggestions["herbs"].append({
                    "type": "herb",
                    "label": name_cn,
                    "sublabel": h.get("name_latin", ""),
                    "category": h.get("category", ""),
                })
                seen_herb_names.add(name_cn.lower())

    # ── 活性肽建议（数据库优先 + 内存补充）──
    if include_peptides:
        peptides_db = (await db.execute(
            select(BioactivePeptide.sequence, BioactivePeptide.source_protein, BioactivePeptide.activity_type)
            .where(
                (BioactivePeptide.sequence.ilike(f"%{keyword}%"))
                | (BioactivePeptide.source_protein.ilike(f"%{keyword}%"))
            )
            .limit(limit * 2)
        )).all()

        seen_peptide_seqs = set()
        # 添加 DB 结果
        for row in peptides_db:
            seq = row[0] or ""
            if seq.lower() not in seen_peptide_seqs and (kw in seq.lower() or kw in (row[1] or "").lower()):
                suggestions["peptides"].append({
                    "type": "peptide",
                    "label": seq,
                    "sublabel": row[1] or "",
                    "activity_type": row[2] or "",
                })
                seen_peptide_seqs.add(seq.lower())
                if len(suggestions["peptides"]) >= limit:
                    break

        # 如果 DB 结果不足，从内存补充
        if len(suggestions["peptides"]) < limit:
            from ...services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE
            for p in DFBP_PEPTIDE_DATABASE:
                if len(suggestions["peptides"]) >= limit:
                    break
                seq = p.get("sequence", "")
                if seq.lower() not in seen_peptide_seqs and (kw in seq.lower() or kw in (p.get("source_protein") or "").lower()):
                    suggestions["peptides"].append({
                        "type": "peptide",
                        "label": seq,
                        "sublabel": p.get("source_protein", ""),
                        "activity_type": p.get("activity_type", ""),
                    })
                    seen_peptide_seqs.add(seq.lower())

    # ── 知识图谱节点建议 ──
    if include_graph:
        graph_result = await graph_service.search_nodes(kw, None, limit)
        suggestions["graph_nodes"] = [
            {"type": n.get("type", "node"), "label": n.get("node_label", ""), "sublabel": n.get("type", "")}
            for n in graph_result[:limit]
        ]
    else:
        suggestions["graph_nodes"] = []

    return suggestions


@router.get("/cross-search", summary="交叉检索")
async def cross_database_search(
    herb_name: str = Query(..., min_length=1, description="药材名称"),
    db: AsyncSession = Depends(get_db_session),
):
    """
    交叉检索 — 根据药材名检索相关活性肽和化合物信息
    用于发现药材-食物蛋白-活性肽之间的潜在关联（公开接口）
    """
    # ── 数据库优先：查找目标药材 ──
    target_herb = None
    is_from_db = False

    herb_db = (await db.execute(
        select(TCMHerb).where(
            (TCMHerb.name_cn.ilike(f"%{herb_name}%"))
            | (TCMHerb.name_latin.ilike(f"%{herb_name}%"))
        ).order_by(TCMHerb.id).limit(1)
    )).scalar_one_or_none()

    if herb_db:
        target_herb = {
            "name_cn": herb_db.name_cn or f"(ID:{herb_db.id})",
            "name_latin": herb_db.name_latin or "",
            "effects": herb_db.effects or "",
            "category": herb_db.category or "",
            "ob_percent": herb_db.ob_percent,
            "compounds": herb_db.compounds if isinstance(herb_db.compounds, list) else [],
        }
        is_from_db = True
    else:
        # Fallback: 从内存查找
        from ...services.data_sources.tcmsp_client import TCMSP_HERB_DATABASE
        for h in TCMSP_HERB_DATABASE:
            if herb_name.lower() in h["name_cn"].lower() or h["name_cn"] == herb_name:
                target_herb = {
                    "name_cn": h["name_cn"],
                    "name_latin": h.get("name_latin", ""),
                    "effects": h.get("effects", ""),
                    "category": h.get("category", ""),
                    "ob_percent": h.get("ob_percent"),
                    "compounds": h.get("compounds", []),
                }
                break

    if not target_herb:
        raise HTTPException(404, detail=f"未找到药材: {herb_name}")

    # 获取药材的化合物列表
    compounds = target_herb["compounds"]

    # ── 活性肽匹配（数据库优先 + 内存补充）──
    peptides_db = (await db.execute(select(BioactivePeptide).order_by(BioactivePeptide.id).limit(500))).scalars().all()
    use_peptide_db = len(peptides_db) > 0

    related_peptides = []
    herb_effects = (target_herb.get("effects") or "").lower()

    if use_peptide_db:
        # 使用 DB 数据
        for p in peptides_db:
            relevance_score = 0
            organism = (p.source_organism or "").lower()
            protein = (p.source_protein or "").lower()
            activity_type = (p.activity_type or "").lower()

            # 来源生物体相关性
            edible_keywords = ["plant", "food", "soybean", "milk", "egg", "fish", "meat", "rice", "wheat"]
            for kw in edible_keywords:
                if kw in organism:
                    relevance_score += 1

            # 功效关键词匹配
            if "antioxidant" in herb_effects and "antioxidant" in activity_type:
                relevance_score += 5
            if "immune" in herb_effects and "immunomodulatory" in activity_type:
                relevance_score += 5
            if "ace" in herb_effects and "ace" in activity_type:
                relevance_score += 5

            if relevance_score > 0:
                related_peptides.append({
                    **{"relevance_score": relevance_score},
                    "sequence": p.sequence,
                    "source_protein": p.source_protein,
                    "source_organism": p.source_organism,
                    "activity_type": p.activity_type,
                    "activity_value": p.activity_value,
                    "molecular_weight": p.molecular_weight,
                    "hydrolysis_enzyme": p.hydrolysis_enzyme,
                })
    else:
        # Fallback: 内存数据
        from ...services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE
        for p in DFBP_PEPTIDE_DATABASE:
            relevance_score = 0
            organism = (p.get("source_organism") or "").lower()
            protein = (p.get("source_protein") or "").lower()

            # 来源生物体相关性
            edible_keywords = ["plant", "food", "soybean", "milk", "egg", "fish", "meat", "rice", "wheat"]
            for kw in edible_keywords:
                if kw in organism:
                    relevance_score += 1

            # 功效关键词匹配
            if "antioxidant" in herb_effects and "antioxidant" in (p.get("activity_type") or "").lower():
                relevance_score += 5
            if "immune" in herb_effects and "immunomodulatory" in (p.get("activity_type") or "").lower():
                relevance_score += 5
            if "ace" in herb_effects and "ace" in (p.get("activity_type") or "").lower():
                relevance_score += 5

            if relevance_score > 0:
                related_peptides.append({
                    **{"relevance_score": relevance_score},
                    "sequence": p.get("sequence"),
                    "source_protein": p.get("source_protein"),
                    "source_organism": p.get("source_organism"),
                    "activity_type": p.get("activity_type"),
                    "activity_value": p.get("activity_value"),
                    "molecular_weight": p.get("molecular_weight"),
                    "hydrolysis_enzyme": p.get("hydrolysis_enzyme"),
                })

    related_peptides.sort(key=lambda x: x["relevance_score"], reverse=True)

    return {
        "herb": {
            "name_cn": target_herb["name_cn"],
            "name_latin": target_herb["name_latin"],
            "effects": target_herb["effects"],
            "category": target_herb["category"],
            "ob_percent": target_herb["ob_percent"],
            "compound_count": len(compounds),
        },
        "compounds": compounds[:10],
        "related_peptides": related_peptides[:20],
        "match_summary": {
            "total_compounds": len(compounds),
            "matched_peptides": len(related_peptides),
            "high_relevance_peptides": len([p for p in related_peptides if p["relevance_score"] >= 5]),
        },
        "data_source": "database" if is_from_db else "memory_fallback",
    }


@router.get("/data-quality")
async def data_quality_safe(db: AsyncSession = Depends(get_db_session)):
    try:
        return await data_quality_report(db)
    except Exception as e:
        logger.error(f"Data quality error: {e}")
        return JSONResponse(content={"success": False, "error": "数据库服务暂时不可用"}, status_code=503)


@router.get("/data-quality-original", summary="数据质量报告")
async def data_quality_report(
    db: AsyncSession = Depends(get_db_session),
):
    """数据质量评估报告 — 完整性、一致性、丰富度指标（公开接口）"""
    from datetime import datetime

    # ── 数据库优先：查询药材和活性肽数据（用 text 查询避免 ORM lazy-load）──
    r_herbs = await db.execute(text("""
        SELECT id, name_cn, name_latin, name_pinyin, category, effects,
               ob_percent, dl_value, is_food_homology, source,
               compounds, targets, diseases
        FROM tcm_herbs ORDER BY id
    """))
    herbs_db = [dict(row._mapping) for row in r_herbs.fetchall()]

    r_peptides = await db.execute(text("""
        SELECT id, sequence, source_protein, source_organism, activity_type,
               activity_value, activity_unit, molecular_weight, hydrolysis_enzyme,
               dfbp_id, dfbp_version, literature_doi, source_version
        FROM bioactive_peptides ORDER BY id LIMIT 5000
    """))
    peptides_db = [dict(row._mapping) for row in r_peptides.fetchall()]

    use_herb_db = len(herbs_db) > 0
    use_peptide_db = len(peptides_db) > 0

    # 选择数据源
    if use_herb_db:
        herbs_source = herbs_db
        is_herb_orm = False
        total_herbs = len(herbs_db)
    else:
        from ...services.data_sources.tcmsp_client import TCMSP_HERB_DATABASE
        herbs_source = TCMSP_HERB_DATABASE
        is_herb_orm = False
        total_herbs = len(TCMSP_HERB_DATABASE)

    if use_peptide_db:
        peptides_source = peptides_db
        is_peptide_orm = False
        total_peptides = len(peptides_db)
    else:
        from ...services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE
        peptides_source = DFBP_PEPTIDE_DATABASE
        is_peptide_orm = False
        total_peptides = len(DFBP_PEPTIDE_DATABASE)

    # ── 数据完整性评分（药材）──
    herb_fields = ["name_cn", "name_latin", "name_pinyin", "category", "effects", "ob_percent", "dl_value"]
    completeness_per_field = {}
    for field in herb_fields:
        filled = 0
        for h in herbs_source:
            if is_herb_orm:
                val = getattr(h, field, None)
            else:
                val = h.get(field)
            if val:
                filled += 1
        completeness_per_field[field] = {
            "filled": filled,
            "total": total_herbs,
            "rate": round(filled / max(total_herbs, 1) * 100, 1),
        }

    # ── 数据完整性评分（活性肽）──
    peptide_fields = ["sequence", "source_protein", "source_organism", "activity_type", "activity_value", "molecular_weight"]
    peptide_completeness = {}
    for field in peptide_fields:
        filled = 0
        for p in peptides_source:
            if is_peptide_orm:
                val = getattr(p, field, None)
            else:
                val = p.get(field)
            if val:
                filled += 1
        peptide_completeness[field] = {
            "filled": filled,
            "total": total_peptides,
            "rate": round(filled / max(total_peptides, 1) * 100, 1),
        }

    # ── 数据健康度指标（药材）──
    herb_health = {
        "with_ob": sum(1 for h in herbs_source if (h.ob_percent if is_herb_orm else h.get("ob_percent")) is not None),
        "with_dl": sum(1 for h in herbs_source if (h.dl_value if is_herb_orm else h.get("dl_value")) is not None),
        "with_compounds": sum(1 for h in herbs_source if len(h.compounds if is_herb_orm else (h.get("compounds") or [])) > 0),
        "with_targets": sum(1 for h in herbs_source if len(h.targets if is_herb_orm else (h.get("targets") or [])) > 0),
        "with_diseases": sum(1 for h in herbs_source if len(h.diseases if is_herb_orm else (h.get("diseases") or [])) > 0),
        "food_homology": sum(1 for h in herbs_source if (bool(h.is_food_homology) if is_herb_orm else h.get("is_food_homology"))),
        "avg_compounds": round(sum(len(h.compounds if is_herb_orm else (h.get("compounds") or [])) for h in herbs_source) / max(total_herbs, 1), 1),
        "avg_targets": round(sum(len(h.targets if is_herb_orm else (h.get("targets") or [])) for h in herbs_source) / max(total_herbs, 1), 1),
    }

    # ── 数据健康度指标（活性肽）──
    peptide_health = {
        "has_activity_value": sum(1 for p in peptides_source if (p.activity_value if is_peptide_orm else p.get("activity_value"))),
        "has_molecular_weight": sum(1 for p in peptides_source if (p.molecular_weight if is_peptide_orm else p.get("molecular_weight"))),
        "has_enzyme_info": sum(1 for p in peptides_source if (p.hydrolysis_enzyme if is_peptide_orm else p.get("hydrolysis_enzyme"))),
        "ace_inhibitory_count": sum(1 for p in peptides_source if (p.activity_type if is_peptide_orm else p.get("activity_type")) == "ACE inhibitory"),
        "antioxidant_count": sum(1 for p in peptides_source if (p.activity_type if is_peptide_orm else p.get("activity_type")) == "Antioxidant"),
        "avg_seq_length": round(sum((len(p.sequence or "") if is_peptide_orm else len(p.get("sequence") or "")) for p in peptides_source) / max(total_peptides, 1), 1),
        "avg_mw": round(sum((p.molecular_weight or 0) if is_peptide_orm else (p.get("molecular_weight") or 0) for p in peptides_source) / max(total_peptides, 1), 1),
    }

    # 综合质量分数
    herb_quality_score = round(
        (completeness_per_field.get("name_cn", {}).get("rate", 0) * 0.1 +
         completeness_per_field.get("ob_percent", {}).get("rate", 0) * 0.2 +
         completeness_per_field.get("effects", {}).get("rate", 0) * 0.15 +
         herb_health["with_compounds"] / max(total_herbs, 1) * 100 * 0.25 +
         herb_health["with_targets"] / max(total_herbs, 1) * 100 * 0.3), 1
    )
    peptide_quality_score = round(
        (peptide_completeness.get("sequence", {}).get("rate", 0) * 0.25 +
         peptide_completeness.get("activity_type", {}).get("rate", 0) * 0.2 +
         peptide_completeness.get("activity_value", {}).get("rate", 0) * 0.2 +
         peptide_health["has_enzyme_info"] / max(total_peptides, 1) * 100 * 0.15 +
         peptide_health["has_molecular_weight"] / max(total_peptides, 1) * 100 * 0.2), 1
    )

    return {
        "generated_at": datetime.now().isoformat(),
        "herb_data": {
            "total_records": total_herbs,
            "quality_score": herb_quality_score,
            "grade": "A" if herb_quality_score >= 85 else ("B" if herb_quality_score >= 70 else ("C" if herb_quality_score >= 50 else "D")),
            "field_completeness": completeness_per_field,
            "health_indicators": herb_health,
        },
        "peptide_data": {
            "total_records": total_peptides,
            "quality_score": peptide_quality_score,
            "grade": "A" if peptide_quality_score >= 85 else ("B" if peptide_quality_score >= 70 else ("C" if peptide_quality_score >= 50 else "D")),
            "field_completeness": peptide_completeness,
            "health_indicators": peptide_health,
        },
        "overall_score": round((herb_quality_score + peptide_quality_score) / 2, 1),
        "data_source": "database" if (use_herb_db or use_peptide_db) else "memory_fallback",
        "recommendations": _generate_recommendations(herb_quality_score, peptide_quality_score, herb_health, peptide_health, total_herbs, total_peptides),
    }


def _generate_recommendations(hqs, pqs, hh, ph, total_herbs=100, total_peptides=100):
    """基于质量指标生成优化建议"""
    recs = []
    if hqs < 80:
        recs.append("建议补充药材的拉丁名和拼音字段，提升基础数据完整度")
    if total_herbs > 0 and hh["with_compounds"] / total_herbs < 0.5:
        recs.append("部分药材缺少化合物数据，建议从 TCMSP 补充同步")
    if pqs < 75:
        recs.append("活性肽数据缺少部分关键字段（活性值/分子量），建议补充文献数据")
    if total_peptides > 0 and ph["has_enzyme_info"] / total_peptides < 0.3:
        recs.append("多数活性肽缺少水解酶信息，影响配方开发参考价值")
    if len(recs) == 0:
        recs.append("数据质量整体良好，可正常支持配方研发工作流")
    return recs

import logging
logger = logging.getLogger(__name__)
logger.info("dashboard module loaded")
