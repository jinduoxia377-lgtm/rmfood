"""
报告导出 API

提供配方可解释性报告的 DOCX/PDF/Markdown 导出接口。
"""
import logging
from typing import Optional

from fastapi import APIRouter, HTTPException
from app.api.deps import CurrentUser
from fastapi.responses import FileResponse

from app.services.document_templates import document_template_service
from app.services.report import get_explainability_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/reports", tags=["报告导出"])


@router.post("/explainability/docx", summary="导出可解释性报告（DOCX）")
async def export_explainability_docx(
    current_user: CurrentUser,
    formula_name: str,
    ingredients: str,       # JSON string: '[{"name":"枸杞","dosage_mg":1000}]'
    target_effects: str,    # JSON string: '["免疫调节"]'
    optimization_constraints: Optional[str] = None,
):
    """
    生成并导出配方可解释性报告（Word 文档）。
    """
    import json
    try:
        ing_list = json.loads(ingredients)
        effect_list = json.loads(target_effects)
        constraints = json.loads(optimization_constraints) if optimization_constraints else None
    except json.JSONDecodeError as e:
        raise HTTPException(400, detail=f"JSON 解析失败: {e}")

    service = get_explainability_service()
    report = service.analyze(formula_name, ing_list, effect_list, constraints)
    d = report.to_dict()

    output_path, filename = document_template_service.generate_explainability_report(
        formula_name=formula_name,
        scores=d["scores"],
        core_ingredients=d["core_ingredients"],
        synergies=d["synergies"],
        antagonisms=d["antagonisms"],
        compliance_notes=d["compliance_notes"],
        recommendations=d["recommendations"],
        summary=d["summary"],
    )

    return FileResponse(output_path, filename=filename, media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document")


@router.post("/explainability/pdf", summary="导出可解释性报告（PDF）")
async def export_explainability_pdf(
    current_user: CurrentUser,
    formula_name: str,
    ingredients: str,
    target_effects: str,
    optimization_constraints: Optional[str] = None,
):
    """生成并导出配方可解释性报告（PDF）。"""
    import json
    try:
        ing_list = json.loads(ingredients)
        effect_list = json.loads(target_effects)
        constraints = json.loads(optimization_constraints) if optimization_constraints else None
    except json.JSONDecodeError as e:
        raise HTTPException(400, detail=f"JSON 解析失败: {e}")

    service = get_explainability_service()
    report = service.analyze(formula_name, ing_list, effect_list, constraints)
    d = report.to_dict()

    output_path, filename = document_template_service.generate_explainability_report_pdf(
        formula_name=formula_name,
        scores=d["scores"],
        core_ingredients=d["core_ingredients"],
        synergies=d["synergies"],
        antagonisms=d["antagonisms"],
        compliance_notes=d["compliance_notes"],
        recommendations=d["recommendations"],
        summary=d["summary"],
    )

    return FileResponse(output_path, filename=filename, media_type="application/pdf")


@router.post("/explainability/markdown", summary="导出可解释性报告（Markdown）")
async def export_explainability_markdown(
    current_user: CurrentUser,
    formula_name: str,
    ingredients: str,
    target_effects: str,
    optimization_constraints: Optional[str] = None,
) -> dict:
    """生成可解释性报告（Markdown 格式，直接返回内容）。"""
    import json
    try:
        ing_list = json.loads(ingredients)
        effect_list = json.loads(target_effects)
        constraints = json.loads(optimization_constraints) if optimization_constraints else None
    except json.JSONDecodeError as e:
        raise HTTPException(400, detail=f"JSON 解析失败: {e}")

    service = get_explainability_service()
    report = service.analyze(formula_name, ing_list, effect_list, constraints)
    d = report.to_dict()

    lines = [
        "# 配方可解释性报告",
        "",
        f"**配方名称**：{formula_name}",
        f"**生成时间**：{report.generated_at}",
        "",
        "## 综合评分",
        "| 评分项 | 分数 |",
        "|--------|------|",
        f"| 综合评分 | {d['scores']['overall']} / 100 |",
        f"| 功效匹配 | {d['scores']['efficacy']} / 100 |",
        f"| 安全评分 | {d['scores']['safety']} / 100 |",
        f"| 成本评分 | {d['scores']['cost']} / 100 |",
        "",
        "## 报告摘要",
        f"{d['summary']}",
        "",
    ]

    if d["core_ingredients"]:
        lines.append("## 君臣佐使")
        for ing in d["core_ingredients"]:
            lines.append(f"- **{ing['name']}**（君）: {ing.get('mechanism', '')}")
        lines.append("")

    if d["synergies"]:
        lines.append("## 协同效应")
        for s in d["synergies"]:
            lines.append(f"- ✓ {s['a']} + {s['b']}（强度 {s['strength']:.0%}）— {s['desc']}")
        lines.append("")

    if d["antagonisms"]:
        lines.append("## 禁忌搭配")
        for a in d["antagonisms"]:
            lines.append(f"- ✗ {a['a']} + {a['b']}（强度 {a['strength']:.0%}）")
        lines.append("")

    if d["compliance_notes"]:
        lines.append("## 合规性说明")
        for note in d["compliance_notes"]:
            lines.append(f"- {note}")
        lines.append("")

    if d["recommendations"]:
        lines.append("## 改进建议")
        for rec in d["recommendations"]:
            lines.append(f"- {rec}")

    return {"success": True, "data": {"markdown": "\n".join(lines), "formula_name": formula_name}}


@router.get("/templates", summary="获取报告模板列表")
async def list_report_templates():
    return {
        "success": True,
        "templates": [
            {"id": "explainability_docx", "name": "可解释性报告（DOCX）", "format": "docx"},
            {"id": "explainability_pdf", "name": "可解释性报告（PDF）", "format": "pdf"},
            {"id": "explainability_md", "name": "可解释性报告（Markdown）", "format": "markdown"},
            {"id": "chinese_medicine", "name": "中医药报告", "format": "docx"},
            {"id": "experiment_data", "name": "实验数据报表", "format": "xlsx"},
            {"id": "formula_analysis", "name": "配方分析报告", "format": "docx"},
        ],
    }
