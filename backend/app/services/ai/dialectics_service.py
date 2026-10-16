"""
辨证引擎服务 — 配方设计智能核心

将 AI 对话/Agent 中的「辨证」从硬编码关键词查表升级为：
- 真实 LLM 辨证（结合 RAG 检索知识）
- 证据分级引用（标准/临床/动物/体外/计算预测）
- 急重症自动拒绝（建议就医）
- LLM 不可用时降级到规则引擎（明确标注）

法律边界：
- 输出定位为「体质倾向/传统食用习惯/现代研究参考」，
  不构成诊断、治疗建议，不针对疾病声称疗效。
"""
from __future__ import annotations

import json
import logging
import re
from typing import Any, Dict, List, Optional

logger = logging.getLogger(__name__)

# ── 急重症关键词（命中即建议就医，不生成配方） ──
URGENT_KEYWORDS: List[str] = [
    "胸痛", "心前区压榨", "呼吸困难", "喘不过气", "剧烈腹痛", "呕血", "黑便",
    "昏迷", "意识模糊", "抽搐", "持续高热", "高烧不退", "言语不清",
    "一侧肢体无力", "口角歪斜", "急性中毒", "自杀", "割腕", "大出血",
    "血糖骤升", "酮症", "剧烈头痛伴呕吐",
]

# ── 规则引擎降级案例（LLM 不可用时使用） ──
_RULE_CASES: List[Dict[str, Any]] = [
    {
        "keywords": ("高血糖", "血糖", "消渴"),
        "constitution": "气阴两虚、燥热内蕴",
        "syndrome": "常见口干多饮、乏力、易饥、舌红少津等表现。",
        "goals": ["辅助调节餐后血糖波动", "益气养阴、健脾固本", "兼顾抗氧化、保护胰岛β细胞功能"],
        "cautions": ["脾胃虚寒者不宜久服寒凉之品", "正在使用降糖药物者，食疗不可替代药物"],
    },
    {
        "keywords": ("高血压", "血压"),
        "constitution": "肝肾阴虚、肝阳上亢",
        "syndrome": "常见头晕耳鸣、急躁易怒、腰膝酸软等表现。",
        "goals": ["平肝潜阳、滋养肝肾", "改善血管内皮功能", "减少钠负荷"],
        "cautions": ["正在服用降压药者不可自行停药", "头晕剧烈或伴恶心呕吐应及时就医"],
    },
    {
        "keywords": ("失眠", "睡眠", "助眠"),
        "constitution": "心脾两虚、阴虚火旺",
        "syndrome": "常见入睡困难、多梦易醒、心悸健忘等表现。",
        "goals": ["养心安神、滋阴清热", "调节神经递质平衡", "改善日间精力与认知功能"],
        "cautions": ["长期严重失眠建议就医排查", "睡前避免咖啡因与剧烈运动"],
    },
    {
        "keywords": ("尿酸", "痛风"),
        "constitution": "湿热内蕴、脾肾亏虚",
        "syndrome": "常见关节肿痛、口苦黏腻、尿黄等表现。",
        "goals": ["清热利湿、通络止痛", "减少尿酸生成", "促进尿酸排泄"],
        "cautions": ["急性痛风发作期应就医规范治疗", "高嘌呤饮食需严格控制"],
    },
    {
        "keywords": ("减肥", "肥胖"),
        "constitution": "痰湿体质、脾虚湿盛",
        "syndrome": "常见体胖乏力、腹部肥满、口中黏腻等表现。",
        "goals": ["健脾利湿、化痰降浊", "调节肠道菌群", "增强饱腹感"],
        "cautions": ["科学减重需结合饮食与运动", "病理性肥胖应就医评估"],
    },
]

# 证据分级说明
EVIDENCE_LEVELS = ["国家标准/权威目录", "临床研究", "动物实验", "体外研究", "计算预测"]


def _rule_based_analyze(query: str) -> Dict[str, Any]:
    """规则引擎降级：基于关键词查表"""
    for case in _RULE_CASES:
        if any(k in query for k in case["keywords"]):
            return {
                "engine": "rule_engine_fallback",
                "urgent": False,
                "constitution_tendency": case["constitution"],
                "syndrome_points": case["syndrome"],
                "regulation_goals": list(case["goals"]),
                "evidence": [
                    {
                        "claim": "以下调理方向基于传统中医食疗经验整理，需结合现代研究进一步验证。",
                        "level": "传统经验整理",
                        "source": "内置规则知识库（降级）",
                    }
                ],
                "cautions": list(case["cautions"]),
                "referral_message": "",
            }
    return {
        "engine": "rule_engine_fallback",
        "urgent": False,
        "constitution_tendency": "暂无法从描述中明确辨识，建议提供更多症状细节。",
        "syndrome_points": "未命中内置辨证知识，输出为通用调理方向。",
        "regulation_goals": ["均衡饮食，规律作息", "适度运动", "结合个人体质选择食材"],
        "evidence": [
            {
                "claim": "通用健康生活方式建议。",
                "level": "国家标准/权威目录",
                "source": "《中国居民膳食指南》",
            }
        ],
        "cautions": ["本建议为辅助调理，不能替代医师诊断与治疗"],
        "referral_message": "",
    }


async def _retrieve_rag(query: str, top_k: int = 3) -> List[Dict[str, str]]:
    """检索 RAG 知识库（失败时静默返回空列表）"""
    try:
        from app.services.ai.rag.rag_service import rag_service

        result = await rag_service.augment_query(query, top_k=top_k)
        chunks = []
        for c in result.chunks:
            chunks.append({
                "content": c.chunk.content[:500],
                "source": c.chunk.metadata.get("source", "unknown"),
            })
        return chunks
    except Exception as e:
        logger.warning(f"[Dialectics] RAG 检索不可用: {e}")
        return []


async def _llm_analyze(query: str, rag_chunks: List[Dict[str, str]]) -> Dict[str, Any]:
    """调用 LLM 进行辨证分析（结构化 JSON 输出）"""
    from app.services.llm_service import LLMMessage, llm_service

    if not llm_service.is_available:
        raise RuntimeError("LLM 服务未配置")

    rag_text = ""
    if rag_chunks:
        rag_text = "\n".join(
            f"- [{c['source']}] {c['content']}" for c in rag_chunks[:3]
        )

    system_prompt = (
        "你是一位严谨的药食同源调理顾问，擅长中医体质辨识与现代营养学的交叉分析。\n"
        "你的输出必须遵守以下边界：\n"
        "1. 只描述「体质倾向」「传统食用习惯」「现代研究提示」，不作出疾病诊断，不宣称治疗功效。\n"
        "2. 涉及功效描述时，必须区分证据等级（国家标准/临床研究/动物实验/体外研究/计算预测）。\n"
        "3. 始终强调：本建议为辅助调理，不能替代医师诊断与治疗。\n"
        "关于 urgent 字段的严格判定规则：\n"
        "- 只有出现胸痛、呼吸困难、意识模糊、昏迷、大出血、剧烈腹痛、持续高热不退等急性危重表现时，才将 urgent 置为 true。\n"
        "- 普通慢性调理问题（如血压偏高、血糖偏高、失眠、疲劳、肥胖、尿酸偏高、关节酸胀等）一律 urgent=false，正常给出调理建议。\n"
        "请严格输出 JSON 对象，不要包含额外文字。字段：\n"
        "{\n"
        '  "constitution_tendency": "体质倾向一句话描述",\n'
        '  "syndrome_points": "辨证要点简述",\n'
        '  "regulation_goals": ["调理方向1", "调理方向2", "调理方向3"],\n'
        '  "evidence": [{"claim": "结论", "level": "证据等级", "source": "来源"}],\n'
        '  "cautions": ["注意事项1", "注意事项2"],\n'
        '  "urgent": false\n'
        "}"
    )

    user_prompt = f"用户描述：{query}"
    if rag_text:
        user_prompt += f"\n\n可参考的知识片段（仅作参考，需甄别）：\n{rag_text}"

    messages = [
        LLMMessage(role="system", content=system_prompt),
        LLMMessage(role="user", content=user_prompt),
    ]

    resp = await llm_service.chat(
        messages,
        response_format={"type": "json_object"},
        temperature=0.3,
    )

    content = resp.content or ""
    # 鲁棒 JSON 提取
    match = re.search(r"\{.*\}", content, re.S)
    if not match:
        raise ValueError("LLM 输出缺少 JSON 对象")
    parsed = json.loads(match.group(0))

    return {
        "engine": "llm_rag",
        "urgent": bool(parsed.get("urgent", False)),
        "constitution_tendency": str(parsed.get("constitution_tendency", "")).strip() or "（未提供）",
        "syndrome_points": str(parsed.get("syndrome_points", "")).strip(),
        "regulation_goals": [str(g).strip() for g in parsed.get("regulation_goals", []) if str(g).strip()],
        "evidence": [
            {
                "claim": str(e.get("claim", "")).strip(),
                "level": str(e.get("level", "")).strip() or "计算预测",
                "source": str(e.get("source", "")).strip(),
            }
            for e in parsed.get("evidence", [])
            if isinstance(e, dict) and str(e.get("claim", "")).strip()
        ],
        "cautions": [str(c).strip() for c in parsed.get("cautions", []) if str(c).strip()],
        "referral_message": (
            "您的描述包含可能属于急重症的表现，请立即就医，不要依赖食疗调理。"
            if parsed.get("urgent")
            else ""
        ),
    }


async def analyze_dialectics(query: str) -> Dict[str, Any]:
    """
    辨证分析统一入口。

    优先级：
    1. 急重症关键词 → urgent_referral（不调用 LLM）
    2. LLM + RAG → llm_rag
    3. 规则引擎 → rule_engine_fallback（明确标注降级）
    """
    query = (query or "").strip()
    if not query:
        query = "用户未提供具体描述"

    # 1. 急重症拒绝
    for kw in URGENT_KEYWORDS:
        if kw in query:
            return {
                "engine": "urgent_referral",
                "urgent": True,
                "constitution_tendency": "",
                "syndrome_points": "",
                "regulation_goals": [],
                "evidence": [],
                "cautions": [],
                "referral_message": (
                    f"您的描述包含「{kw}」等可能属于急重症的表现，请立即就医，"
                    f"不要依赖食疗调理。本建议为辅助调理，不能替代医师诊断与治疗。"
                ),
            }

    # 2. LLM + RAG
    try:
        rag_chunks = await _retrieve_rag(query)
        result = await _llm_analyze(query, rag_chunks)
        logger.info(f"[Dialectics] LLM+RAG 辨证完成 engine=llm_rag urgent={result['urgent']}")
        return result
    except Exception as e:
        logger.warning(f"[Dialectics] LLM 辨证不可用，降级规则引擎: {e}")

    # 3. 规则引擎降级
    result = _rule_based_analyze(query)
    logger.info(f"[Dialectics] 规则引擎降级输出 engine=rule_engine_fallback")
    return result