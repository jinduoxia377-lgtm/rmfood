"""药材命名规范化（canonical name mapping）— L0 准入前置

★ 背景（2026-11-09 命名规范化改造）★
L0 准入过滤（safety_gate.check_herb_admission）用 `name_cn` **精确匹配**
`formula_compliance.FOOD_HERB_MAX_DOSAGE`（106 种药食同源目录，键为药典正名）。
但 GA 药材库的 `name_cn` 常用俗名/异名（大枣/桑葚/陈皮/枸杞…），
精确匹配失败 → 大枣等真药食同源药材被误剔除（连翘/人参等非目录药应被剔）。

★ 解决 ★
在 L0 准入前先做 canonical 归一：俗名/异名 → 106 目录药典正名。
归一**优先复用**项目既有正名映射 `_canonical_tcm_name`（formula_intelligence，
覆盖十八反/十九畏别名），再叠加本模块 `CANONICAL_NAME_MAP`（药食同源目录常用异名，
来源：compliance_tool._build_food_herb_limits.alias_limits + label_check_service
+ rag_service 别名表 + 106 目录键名人工核对）。

★ 铁律：虫草歧义按最严处置 ★
"虫草"归一为"冬虫夏草"（=受保护物种=PROHIBITED_HERBS 黑名单），
绝不归一为可用名（如蛹虫草）。归一后再过 check_herb_admission，
虫草系一律准入失败，与阶段0 从严策略一致。

@version 1.0.0
"""
from __future__ import annotations

import logging
from typing import Optional

logger = logging.getLogger(__name__)


# ════════════════════════════════════════════════════════════════
# 药食同源目录常用异名 → 106 目录药典正名
# ════════════════════════════════════════════════════════════════
# 仅收录「俗名/异名 → FOOD_HERB_MAX_DOSAGE 精确键」的映射；
# 本身已是目录正名的（如 山楂/黄芪/党参/茯苓）无需收录，归一返回自身。
# 来源核对（2026-11-09）：
#   - compliance_tool.py alias_limits：红枣→枣、枸杞→枸杞子、桂圆→龙眼肉、
#     陈皮→橘皮、桑葚→桑椹
#   - label_check_service / rag_service 别名表：枸杞↔枸杞子、大枣↔红枣↔枣、
#     陈皮↔橘皮、桑葚↔桑椹
#   - 106 目录键名（formula_compliance.FOOD_HERB_MAX_DOSAGE）：枣、枸杞子、
#     橘皮、桑椹、龙眼肉、姜、薏苡仁…
CANONICAL_NAME_MAP: dict[str, str] = {
    # ── 枣类（106 正名「枣」）──
    "大枣": "枣",
    "红枣": "枣",
    "枣": "枣",          # 显式收录，读代码清晰
    "干枣": "枣",
    "南枣": "枣",
    # ── 枸杞（106 正名「枸杞子」）──
    "枸杞": "枸杞子",
    "枸杞子": "枸杞子",
    "枸杞果": "枸杞子",
    "宁夏枸杞": "枸杞子",
    # ── 陈皮（106 正名「橘皮」）──
    "陈皮": "橘皮",
    "橘皮": "橘皮",
    "广陈皮": "橘皮",
    "新会陈皮": "橘皮",
    # ── 桑椹（106 正名「桑椹」）──
    "桑葚": "桑椹",
    "桑椹": "桑椹",
    "桑葚子": "桑椹",
    "黑桑葚": "桑椹",
    # ── 龙眼肉（106 正名「龙眼肉」）──
    "桂圆": "龙眼肉",
    "桂圆肉": "龙眼肉",
    "龙眼": "龙眼肉",
    "龙眼肉": "龙眼肉",
    # ── 姜（106 正名「姜」）──
    "生姜": "姜",
    "姜": "姜",
    "干姜": "姜",        # 注：干姜药性更强，目录限量从严按「姜」
    # ── 薏苡仁 ──
    "薏米": "薏苡仁",
    "薏苡仁": "薏苡仁",
    "苡仁": "薏苡仁",
    # ── 砂仁（106 正名「砂仁」）──
    "砂仁": "砂仁",
    # ── 罗汉果 / 胖大海 / 其它（部分为显式收录便于阅读）──
    "罗汉果": "罗汉果",
    # ── 虫草歧义：最严处置（=受保护物种=黑名单）──
    # 绝不归一为可用名（蛹虫草等），统一归一到「冬虫夏草」，
    # 让 check_herb_admission 的 PROHIBITED_HERBS 一拦到底。
    "虫草": "冬虫夏草",
    "冬虫草": "冬虫夏草",
    "西藏虫草": "冬虫夏草",
}

# 虫草系歧义名集合 — canonicalize_herb_name 最高优先级强制归一到「冬虫夏草」。
# 说明：任何虫草相关叫法（无论是否为卫健委批准的新食品原料如蛹虫草）
# 一律从严按「冬虫夏草」（受保护物种）处置，进入 PROHIBITED_HERBS 黑名单，
# 由 check_herb_admission 第 1 关拒绝。阶段1 待 L0 建立 L2 新食品原料分级后再评估放开。
_CORDYCEPS_AMBIGUOUS: frozenset[str] = frozenset({
    "虫草",
    "冬虫草",
    "西藏虫草",
    "冬虫夏草",
})


def canonicalize_herb_name(name: str) -> str:
    """将药材名归一为 106 目录（FOOD_HERB_MAX_DOSAGE）口径的正名。

    归一优先级：
      1. formula_intelligence._canonical_tcm_name（项目既有正名映射，
         覆盖十八反/十九畏别名，如 丹参/紫丹参→丹参）
      2. 本模块 CANONICAL_NAME_MAP（药食同源目录常用异名，如 大枣→枣）
      3. 原名返回（本身已是正名或无映射）

    ★ 虫草歧义铁律 ★：CANONICAL_NAME_MAP 在第 2 优先级把"虫草"归一为
    "冬虫夏草"（黑名单），确保最严处置，不会被上游别名覆盖为可用名。

    Args:
        name: 原始药材名（可含俗名/异名/炮制品名）

    Returns:
        归一后的药材名（用于 check_herb_admission 精确匹配 106 目录）
    """
    if not name:
        return ""
    key = str(name).strip()
    if not key:
        return ""

    # ★ 虫草歧义铁律：最严处置，优先级最高 ★
    # 无论上游别名表怎么归一，凡命中虫草系歧义名，一律强制归一到
    # 「冬虫夏草」（=受保护物种=PROHIBITED_HERBS 黑名单），
    # 绝不归一为可用名（如蛹虫草/广东虫草）。让 check_herb_admission
    # 的黑名单一拦到底，与阶段0 从严策略一致。
    if key in _CORDYCEPS_AMBIGUOUS:
        return "冬虫夏草"

    # 1. 项目既有正名映射（十八反/十九畏别名表）
    canon = _existing_canonical_tcm_name(key)

    # 2. 药食同源目录常用异名映射（优先级高于第 1 步的结果，
    #    因为目录异名表更贴合 FOOD_HERB_MAX_DOSAGE 键名）
    canon = CANONICAL_NAME_MAP.get(canon, canon)

    return canon


def _existing_canonical_tcm_name(name: str) -> str:
    """安全调用 formula_intelligence._canonical_tcm_name（延迟导入避免循环依赖）。

    若该函数不可用，返回原名（防御性降级，不阻塞 L0 过滤）。
    """
    try:
        from app.services.ai.formula_intelligence import _canonical_tcm_name
        return _canonical_tcm_name(name)
    except Exception as e:  # pragma: no cover - 防御性
        logger.debug(f"[canonical_names] _canonical_tcm_name 不可用，跳过: {e}")
        return name


def canonicalize_optional(name: Optional[str]) -> str:
    """canonicalize_herb_name 的 Optional 友好封装。"""
    return canonicalize_herb_name(name or "")
