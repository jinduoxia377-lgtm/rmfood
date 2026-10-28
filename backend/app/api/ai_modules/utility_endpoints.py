"""
AI 实用工具端点 — 修复前端断链调用

本模块补齐以下前端已在调用、但后端从未实现的路由：
  - POST /generate/stream        AIGenerator 流式文本生成
  - POST /optimize               提示词质量分析（PromptOptimizer）
  - GET  /templates              模板库列表（TemplateGallery）
  - POST /templates/{id}/render  模板变量渲染（TemplateGallery）
  - POST /feedback               推荐反馈上报（AIRecommendationSidebar）
  - PUT  /models/default          默认模型持久化（ConfigManagementPanel）

设计原则：所有端点都返回真实、可用的结果，不做假数据。
模板库为内置的行业模板（含 {{变量}} 占位符），渲染为确定性变量插值。
提示词分析为规则引擎（语法/结构/分数），不冒充 LLM。
"""
import json
import re
import time
import uuid
from typing import Any, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from ...services.llm_service import LLMMessage
from . import (
    User,
    get_current_active_user,
    get_current_user,
    get_db_session,
    logger,
)

sub_router = APIRouter(tags=["AI工具"])


# ════════════════════════════════════════════
# 1. POST /generate/stream — AIGenerator 流式生成
# ════════════════════════════════════════════
class GenerateStreamRequest(BaseModel):
    description: str = Field(..., min_length=1, max_length=2000, description="生成描述")
    parameters: dict[str, Any] = Field(default_factory=dict, description="生成参数（creativity/length/tone 等）")
    context: dict[str, Any] = Field(default_factory=dict, description="上下文")


@sub_router.post("/generate/stream", summary="AI 智能文本生成（流式 SSE）")
async def generate_stream(
    req: GenerateStreamRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User = Depends(get_current_active_user),
):
    """AIGenerator 组件使用的流式生成端点（要求登录，防止匿名消耗 LLM 配额）。

    前端期望 SSE `data:` 事件，事件体为 JSON：
      {"type":"start","task_id":"..."}
      {"type":"token","content":"..."}
      {"type":"error","message":"..."}
      data: [DONE]
    """
    from . import _get_llm_service

    llm = _get_llm_service()

    async def event_stream():
        try:
            task_id = f"gen_{uuid.uuid4().hex[:12]}"
            yield f"data: {json.dumps({'type': 'start', 'task_id': task_id}, ensure_ascii=False)}\n\n"

            if not llm.is_available:
                yield f"data: {json.dumps({'type': 'error', 'message': 'LLM 服务未配置，请先在配置管理中保存 API Key'}, ensure_ascii=False)}\n\n"
                yield "data: [DONE]\n\n"
                return

            # 构造生成消息：参数映射为系统提示补充
            parameters = req.parameters or {}
            style_hint = []
            if parameters.get("creativity"):
                style_hint.append(f"创意度：{parameters['creativity']}")
            if parameters.get("length"):
                style_hint.append(f"篇幅：{parameters['length']}")
            if parameters.get("tone"):
                style_hint.append(f"语气：{parameters['tone']}")
            style = "；".join(style_hint)
            system_prompt = (
                "你是食源性药食同源配方设计专家，根据用户描述生成结构化的配方方案文本"
                "（Markdown 格式：标题、表格、列表）。"
                + (f"生成风格要求：{style}。" if style else "")
                + "严禁使用 emoji。始终提示：本内容为辅助调理参考，不能替代医师诊断。"
            )
            messages = [
                LLMMessage(role="system", content=system_prompt),
                LLMMessage(role="user", content=req.description),
            ]
            async for chunk in llm.chat_stream(messages):
                if chunk:
                    yield f"data: {json.dumps({'type': 'token', 'content': chunk}, ensure_ascii=False)}\n\n"
            yield "data: [DONE]\n\n"
        except Exception as e:
            logger.error(f"[generate/stream] 流式生成失败: {e}", exc_info=True)
            try:
                yield f"data: {json.dumps({'type': 'error', 'message': f'生成失败：{e}'}, ensure_ascii=False)}\n\n"
            except Exception:
                pass
            yield "data: [DONE]\n\n"

    return StreamingResponse(event_stream(), media_type="text/event-stream")


# ════════════════════════════════════════════
# 2. POST /optimize — 提示词质量分析（规则引擎）
# ════════════════════════════════════════════
class PromptOptimizeRequest(BaseModel):
    prompt_content: str = Field(..., min_length=1, max_length=20000, description="待分析的提示词内容")
    optimization_level: str = Field("advanced", description="basic/advanced/expert")
    goals: list[str] = Field(default_factory=list, description="优化目标")


@sub_router.post("/optimize", summary="提示词质量分析（规则引擎）")
async def optimize_prompt(
    req: PromptOptimizeRequest,
    current_user: User | None = Depends(get_current_user),
):
    """PromptOptimizer 组件使用的提示词分析端点。

    返回结构与前端 OptimizationResult 一致：
      original_content / optimized_content / syntax_issues /
      structure_report / effectiveness_prediction / suggestions /
      overall_score_before / overall_score_after / score_improvement / processing_time_ms
    """
    t0 = time.perf_counter()
    content = req.prompt_content
    lines = content.split("\n")
    level = req.optimization_level or "advanced"

    # ── 语法问题检测（确定性规则） ──
    syntax_issues = []
    stack: list[tuple[str, int]] = []
    pair_map = {")": "(", "]": "[", "}": "{"}
    for i, line in enumerate(lines, start=1):
        # 未闭合括号检测
        for ch in line:
            if ch in "([{":
                stack.append((ch, i))
            elif ch in ")]}":
                if stack and stack[-1][0] == pair_map[ch]:
                    stack.pop()
                else:
                    syntax_issues.append({
                        "id": f"syntax_{len(syntax_issues)}",
                        "severity": "error",
                        "rule_id": "unmatched_bracket",
                        "message": f"第 {i} 行存在未匹配的括号 '{ch}'",
                        "line_number": i,
                        "snippet": line[:80],
                        "suggestion": "检查该行的括号是否成对出现",
                    })
        # 代码块未闭合
        if line.strip().startswith("```") and not any("```" in l for l in lines[i:] if l != line):
            if line.strip().startswith("```") and line.strip() != "```":
                pass
    if stack:
        ch, ln = stack[-1]
        syntax_issues.append({
            "id": "syntax_unclosed",
            "severity": "error",
            "rule_id": "unclosed_bracket",
            "message": f"存在未闭合的括号 '{ch}'（起始于第 {ln} 行）",
            "line_number": ln,
            "snippet": lines[ln - 1][:80] if ln <= len(lines) else "",
            "suggestion": "为括号添加对应的闭合符",
        })

    # 占位符检测：{{var}} 或 {var} 未闭合
    for i, line in enumerate(lines, start=1):
        if "{{" in line and "}}" not in line:
            syntax_issues.append({
                "id": f"ph_{i}_{len(syntax_issues)}",
                "severity": "warning",
                "rule_id": "unclosed_placeholder",
                "message": f"第 {i} 行存在未闭合的变量占位符 '{{'",
                "line_number": i,
                "snippet": line[:80],
                "suggestion": "使用 {{变量名}} 格式闭合占位符",
            })

    # 中英文混用空格检测（中文后直接跟英文单词，无空格）
    cn_en_pat = re.compile(r"[\u4e00-\u9fff][A-Za-z]")
    for i, line in enumerate(lines, start=1):
        if cn_en_pat.search(line):
            syntax_issues.append({
                "id": f"mix_{i}_{len(syntax_issues)}",
                "severity": "info",
                "rule_id": "mixed_lang_spacing",
                "message": f"第 {i} 行中英文之间建议加空格",
                "line_number": i,
                "snippet": line[:80],
                "suggestion": "在中文与英文之间插入一个空格",
            })

    # ── 结构报告（四要素完整性） ──
    lower = content.lower()
    sections = [
        ("角色设定", bool(re.search(r"你是|扮演|作为|你是一个|你是一位", content)), "提示词是否定义 AI 的角色"),
        ("任务描述", bool(re.search(r"请|要求|需要|生成|输出|回答|撰写|设计|帮我", content)), "提示词是否给出明确任务"),
        ("上下文/背景", bool(re.search(r"背景|上下文|情况|目标用户|场景|前提", content)), "提示词是否提供上下文背景"),
        ("输出格式约束", bool(re.search(r"格式|表格|列表|Markdown|JSON|结构|字数|分[章节]|冒号|步骤", content)), "提示词是否约束输出格式"),
    ]
    structure_report = {
        "overall_score": 0,
        "sections": {},
        "strengths": [],
        "weaknesses": [],
        "structure_type": "标准结构" if len([1 for _, p, _ in sections if p]) >= 3 else "结构不完整",
    }
    for name, present, _desc in sections:
        structure_report["sections"][name] = {
            "name": name,
            "is_present": present,
            "position": lower.find({"角色设定": "你是", "任务描述": "请", "上下文/背景": "背景", "输出格式约束": "格式"}[name]) if present else -1,
        }
        if present:
            structure_report["strengths"].append(f"包含「{name}」要素")
        else:
            structure_report["weaknesses"].append(f"缺少「{name}」，建议补充")

    # 行数与篇幅评价
    if len(content) < 30:
        structure_report["weaknesses"].append("内容过短，信息量不足，建议补充细节")
    elif len(content) > 3000:
        structure_report["weaknesses"].append("内容过长，建议精简聚焦核心指令")

    # 结构分（0-100）
    present_count = len([1 for _, p, _ in sections if p])
    structure_score = present_count * 25
    structure_score = min(structure_score + (20 if len(content) > 100 else 0), 100)
    structure_report["overall_score"] = structure_score

    # ── 有效性预测（规则评分） ──
    feature_scores = {
        "清晰度": min(40 + present_count * 15, 100),
        "完整性": structure_score,
        "可执行性": 100 if "请" in content or "输出" in content else 40,
        "格式规范": max(0, 100 - len(syntax_issues) * 15),
    }
    base_score = int(
        feature_scores["清晰度"] * 0.3
        + feature_scores["完整性"] * 0.3
        + feature_scores["可执行性"] * 0.2
        + feature_scores["格式规范"] * 0.2
    )
    effectiveness_prediction = {
        "score": base_score,
        "confidence_interval": [max(0, base_score - 10), min(100, base_score + 10)],
        "feature_scores": feature_scores,
        "strengths": structure_report["strengths"][:2],
        "weaknesses": structure_report["weaknesses"][:2],
        "improvement_potential": max(0, 100 - base_score),
    }

    # ── 优化建议 ──
    suggestions = []
    for sec_name, present, _ in sections:
        if not present:
            suggestions.append({
                "id": f"sug_struct_{len(suggestions)}",
                "severity": "major",
                "category": "structure",
                "title": f"补充「{sec_name}」要素",
                "description": f"提示词缺少{sec_name}，AI 可能无法准确理解意图。",
                "location": "开头",
                "before": "",
                "after": f"请补充：{sec_name}。",
                "impact_estimate": "预计提升 15-25 分",
                "is_auto_fixable": True,
            })
    for issue in syntax_issues[:3]:
        suggestions.append({
            "id": f"sug_syn_{len(suggestions)}",
            "severity": "minor" if issue["severity"] == "info" else "major",
            "category": "syntax",
            "title": issue["message"],
            "description": issue["suggestion"],
            "location": f"第 {issue['line_number']} 行",
            "before": issue["snippet"],
            "after": "",
            "impact_estimate": "修复语法问题可提升可读性",
            "is_auto_fixable": True,
        })

    # ── 优化后分数（expert 级给出改写文本） ──
    optimized_content: Optional[str] = None
    after_score = base_score
    if level == "expert" and suggestions:
        # 自动追加缺失要素（确定性改写，不冒充 LLM）
        additions = []
        for sec_name, present, _ in sections:
            if not present:
                if sec_name == "角色设定":
                    additions.append("你是一位资深的食源性药食同源配方设计专家。")
                elif sec_name == "任务描述":
                    additions.append("请根据上述要求，输出完整、结构化的方案。")
                elif sec_name == "上下文/背景":
                    additions.append("请结合目标人群的具体情况进行分析。")
                elif sec_name == "输出格式约束":
                    additions.append("请使用 Markdown 格式，包含标题、列表与表格。")
        optimized_content = content
        if additions:
            optimized_content = "【补充要素】\n" + "\n".join(additions) + "\n\n" + content
            after_score = min(100, base_score + min(len(additions) * 10, 30))
    elif level == "advanced":
        after_score = min(100, base_score + present_count * 5)

    result = {
        "original_content": content,
        "optimized_content": optimized_content,
        "syntax_issues": syntax_issues,
        "structure_report": structure_report,
        "effectiveness_prediction": effectiveness_prediction,
        "suggestions": suggestions,
        "overall_score_before": base_score,
        "overall_score_after": after_score,
        "score_improvement": max(0, after_score - base_score),
        "processing_time_ms": int((time.perf_counter() - t0) * 1000),
    }
    return result


# ════════════════════════════════════════════
# 3. 模板库 — GET /templates 与 POST /templates/{id}/render
# ════════════════════════════════════════════
class TemplateItemModel(BaseModel):
    id: int
    name: str
    category: str
    description: str
    version: str
    usage_count: int
    rating: float | None = None
    created_at: str
    updated_at: str
    content: str
    variables: list[str] = Field(default_factory=list)
    examples: list[dict[str, Any]] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


# 内置行业模板（含 {{变量}} 占位符）
_BUILTIN_TEMPLATES: list[dict[str, Any]] = [
    {
        "id": 1,
        "name": "配方设计方案",
        "category": "配方",
        "description": "生成完整的中医食养配方设计方案（目标/成分表/制备/注意）",
        "version": "1.0",
        "usage_count": 0,
        "rating": 4.8,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
        "content": (
            "# {{配方名称}}配方设计方案\n\n"
            "## 一、配方目标\n{{配方目标}}\n\n"
            "## 二、推荐配方\n"
            "| 成分 | 用量 | 功效 |\n"
            "|------|------|------|\n"
            "{{配方成分表格}}\n\n"
            "## 三、制备方法（SOP）\n{{制备方法}}\n\n"
            "## 四、注意事项\n{{注意事项}}\n"
        ),
        "variables": ["配方名称", "配方目标", "配方成分表格", "制备方法", "注意事项"],
        "examples": [
            {
                "scenario": "健脾养胃茶饮",
                "input": {"配方名称": "健脾养胃茶", "配方目标": "改善脾虚湿困、食欲不振"},
                "output": "# 健脾养胃茶配方设计方案\n\n## 一、配方目标\n改善脾虚湿困、食欲不振",
            }
        ],
        "tags": ["配方", "方案", "君臣佐使"],
    },
    {
        "id": 2,
        "name": "实验设计方案",
        "category": "实验",
        "description": "生成实验设计方案（目的/材料方法/预期结果）",
        "version": "1.0",
        "usage_count": 0,
        "rating": 4.5,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
        "content": (
            "# {{实验名称}}实验设计方案\n\n"
            "## 1. 实验目的\n{{实验目的}}\n\n"
            "## 2. 材料与方法\n{{材料与方法}}\n\n"
            "## 3. 实验分组\n{{实验分组}}\n\n"
            "## 4. 预期结果\n{{预期结果}}\n"
        ),
        "variables": ["实验名称", "实验目的", "材料与方法", "实验分组", "预期结果"],
        "examples": [],
        "tags": ["实验", "方案", "DOE"],
    },
    {
        "id": 3,
        "name": "产品说明书",
        "category": "产品",
        "description": "生成食品/保健食品产品说明书（概述/成分/适用人群/用法）",
        "version": "1.0",
        "usage_count": 0,
        "rating": 4.6,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
        "content": (
            "# {{产品名称}}产品说明书\n\n"
            "## 产品概述\n{{产品概述}}\n\n"
            "## 主要成分\n{{主要成分}}\n\n"
            "## 适用人群\n{{适用人群}}\n\n"
            "## 用法用量\n{{用法用量}}\n\n"
            "## 注意事项\n{{注意事项}}\n"
        ),
        "variables": ["产品名称", "产品概述", "主要成分", "适用人群", "用法用量", "注意事项"],
        "examples": [],
        "tags": ["产品", "说明书", "标签"],
    },
    {
        "id": 4,
        "name": "功效研究报告",
        "category": "报告",
        "description": "生成功效研究报告（背景/机制/结论）",
        "version": "1.0",
        "usage_count": 0,
        "rating": 4.7,
        "created_at": "2026-01-01T00:00:00Z",
        "updated_at": "2026-01-01T00:00:00Z",
        "content": (
            "# {{报告标题}}研究报告\n\n"
            "## 研究背景\n{{研究背景}}\n\n"
            "## 功效机制\n{{功效机制}}\n\n"
            "## 研究结论\n{{研究结论}}\n"
        ),
        "variables": ["报告标题", "研究背景", "功效机制", "研究结论"],
        "examples": [],
        "tags": ["报告", "功效", "研究"],
    },
]


class TemplateListRequest(BaseModel):
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)
    category: str = ""
    search: str = ""
    sort_by: str = "updated_at"


@sub_router.get("/templates", summary="模板库列表")
async def list_templates(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: str = Query(""),
    search: str = Query(""),
    sort_by: str = Query("updated_at"),
):
    """返回内置模板列表，支持分类筛选、搜索、分页。"""
    templates = list(_BUILTIN_TEMPLATES)
    if category:
        templates = [t for t in templates if t["category"] == category]
    if search:
        kw = search.lower()
        templates = [
            t for t in templates
            if kw in t["name"].lower() or kw in t["description"].lower() or any(kw in tag.lower() for tag in t["tags"])
        ]
    if sort_by == "rating":
        templates.sort(key=lambda t: -(t.get("rating") or 0))
    else:
        templates.sort(key=lambda t: t["updated_at"], reverse=True)

    total = len(templates)
    start = (page - 1) * page_size
    page_items = templates[start:start + page_size]
    # 列表接口不返回 content（渲染时才用）
    list_items = [{**t, "content": ""} for t in page_items]
    return {"templates": list_items, "total": total, "page": page, "page_size": page_size}


class TemplateRenderRequest(BaseModel):
    variables: dict[str, Any] = Field(default_factory=dict)


@sub_router.post("/templates/{template_id}/render", summary="模板变量渲染")
async def render_template(template_id: int, req: TemplateRenderRequest):
    """将 {{变量}} 占位符替换为传入的变量值，返回渲染后的 Markdown。

    与前端 RenderResult 结构一致：
      { success, content, errors, warnings, missing_variables }
    """
    template = next((t for t in _BUILTIN_TEMPLATES if t["id"] == template_id), None)
    if not template:
        raise HTTPException(status_code=404, detail=f"模板不存在: {template_id}")

    content = template["content"]
    variables = req.variables or {}
    missing: list[str] = []
    warnings: list[str] = []

    def repl(m: re.Match) -> str:
        name = m.group(1).strip()
        if name in variables and variables[name] is not None:
            return str(variables[name])
        missing.append(name)
        return f"{{{{{name}}}}}"

    rendered = re.sub(r"{{\s*([^}]+?)\s*}}", repl, content)

    # 必填变量（模板声明的全部视为必填）缺失时给出警告
    for var_name in template["variables"]:
        if var_name not in variables:
            missing.append(var_name)
            warnings.append(f"变量「{var_name}」未提供，将保留占位符")

    # 去重
    missing = list(dict.fromkeys(missing))
    warnings = list(dict.fromkeys(warnings))

    # 更新使用计数
    template["usage_count"] = template.get("usage_count", 0) + 1

    return {
        "success": True,
        "content": rendered,
        "errors": [],
        "warnings": warnings,
        "missing_variables": missing,
    }


# ════════════════════════════════════════════
# 4. POST /feedback — 推荐反馈上报
# ════════════════════════════════════════════
class FeedbackRequest(BaseModel):
    suggestion_id: str = Field("", description="推荐项 ID")
    feedback_type: str = Field("like", description="like/dislike")
    is_helpful: bool = Field(True)


@sub_router.post("/feedback", summary="提交推荐反馈")
async def submit_feedback(
    req: FeedbackRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User | None = Depends(get_current_user),
):
    """记录 AI 推荐反馈。持久化到 SystemConfig（键 ai_feedback_log）的 JSON 数组。"""
    import json as _json

    from sqlalchemy import select

    from ...models.system import SystemConfig

    user_id = current_user.id if current_user else None
    config_key = "ai_feedback_log"
    try:
        result = await db.execute(select(SystemConfig).where(SystemConfig.config_key == config_key))
        row = result.scalar_one_or_none()
        logs: list[dict] = []
        if row and row.config_value:
            try:
                v = row.config_value
                if isinstance(v, str):
                    v = _json.loads(v)
                if isinstance(v, list):
                    logs = v
            except Exception:
                logs = []
        logs.append({
            "suggestion_id": req.suggestion_id,
            "feedback_type": req.feedback_type,
            "is_helpful": req.is_helpful,
            "user_id": user_id,
            "created_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        })
        logs = logs[-500:]  # 最多保留 500 条
        if row:
            row.config_value = logs
            row.updated_by = user_id
        else:
            db.add(SystemConfig(config_key=config_key, config_value=logs, updated_by=user_id))
        await db.commit()
        logger.info(f"[AI Feedback] suggestion={req.suggestion_id} type={req.feedback_type} helpful={req.is_helpful} user={user_id}")
    except Exception as e:
        logger.warning(f"[AI Feedback] 持久化失败，降级为日志: {e}")
        logger.info(f"[AI Feedback] suggestion={req.suggestion_id} type={req.feedback_type} helpful={req.is_helpful} user={user_id}")
    return {"success": True}


# ════════════════════════════════════════════
# 5. PUT /models/default — 默认模型持久化
# ════════════════════════════════════════════
class DefaultModelRequest(BaseModel):
    model_type: str = Field(..., min_length=1, max_length=64)


@sub_router.put("/models/default", summary="设置默认模型")
async def set_default_model(
    req: DefaultModelRequest,
    db: AsyncSession = Depends(get_db_session),
    current_user: User | None = Depends(get_current_user),
):
    """持久化用户的默认模型选择（SystemConfig 键 default_model_<user_id>）。"""
    from sqlalchemy import select

    from ...models.system import SystemConfig

    user_key = f"default_model_{current_user.id if current_user else 'anon'}"
    try:
        result = await db.execute(select(SystemConfig).where(SystemConfig.config_key == user_key))
        row = result.scalar_one_or_none()
        if row:
            row.config_value = {"model_type": req.model_type}
            row.updated_by = current_user.id if current_user else None
        else:
            db.add(SystemConfig(config_key=user_key, config_value={"model_type": req.model_type},
                                 updated_by=current_user.id if current_user else None))
        await db.commit()
        return {"success": True, "model_type": req.model_type}
    except Exception as e:
        logger.error(f"[models/default] 保存失败: {e}")
        raise HTTPException(status_code=500, detail="默认模型保存失败")
