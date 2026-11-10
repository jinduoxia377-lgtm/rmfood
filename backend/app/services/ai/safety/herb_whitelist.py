"""药材白名单三级分级 — 配方生成阶段1 治本（S1-1）

把散落各处的药材分级收敛为**唯一权威三级白名单**，替代历史 mock 字典
（ai_models/formula_gpt.py:_FOOD_HOMOLOGY_HERBS，含受保护物种"虫草"）。

三级定义（对齐国家监管 + docs/reviews/配方生成功能审计与开发方案.md L185-201）：
  L1 食品级      = 国家卫健委「按照传统既是食品又是中药材的物质目录」106 种（2024 版）。
                   可作普通食疗原料，每味带目录日限量（mg/日）。
  L2 新食品原料级 = 卫健委批准的新食品原料/新资源食品（如蛹虫草、广东虫草子实体）。
                   带批准公告号 + 不适宜人群；**默认不进通用配方**，须显式人群适配才可用。
  L3 禁用/限制级  = 受保护野生物种 / 贵重药材 / 毒性 / 保健食品专用 → 硬黑名单，任何路径不可生成。

权威源（均为运行时可加载的单一事实源，非 mock）：
  L1 名单  : app.services.data_sources.tcmsp_client.FOOD_HOMOLOGY_CATALOG（106 种）
  L1 限量  : app.services.compliance.formula_compliance.FOOD_HERB_MAX_DOSAGE（106 条，mg/日）
  L3 名单  : app.services.ai.safety.safety_gate.PROHIBITED_HERBS
  L2 名单  : 本模块内置（蛹虫草/广东虫草系，带公告号；来源 label_check_service 备案表）

★ 诚实边界 ★：L1 日限量来自 formula_compliance.FOOD_HERB_MAX_DOSAGE（106 条齐全）。
个别药材若目录未给限量，本模块**不编造**，`daily_limit_mg` 记为 None 并在选用时回落到
保守默认（由调用方 clamp 逻辑处理）。

★ 与阶段0 的关系 ★：阶段0（commit 0705b77）把蛹虫草/广东虫草一并从严放 L3。
阶段1 在此建立 L2 分级后，L2 **默认仍不进通用兜底配方**（须显式人群适配），
因此兜底池 `_FALLBACK_HERB_POOL` 仅从 L1 取——行为与阶段0 一致，不放松安全。
"""
from __future__ import annotations

from dataclasses import dataclass
from typing import Dict, List, Optional

from .safety_gate import PROHIBITED_HERBS


@dataclass(frozen=True)
class HerbWhitelistEntry:
    """单个白名单条目"""
    name: str
    tier: int                          # 1 / 2 / 3
    is_food_homology: bool             # 是否 106 种药食同源目录内
    daily_limit_mg: Optional[float]    # 目录日限量（mg/日）；L2/未知为 None
    approval_no: Optional[str] = None  # L2 卫健委批准公告号
    unsuitable_groups: Optional[str] = None  # L2 不适宜人群
    note: str = ""


def _build_l1() -> Dict[str, HerbWhitelistEntry]:
    """L1 食品级：从 tcmsp_client 目录 + formula_compliance 限量动态构建。"""
    from app.services.compliance.formula_compliance import FOOD_HERB_MAX_DOSAGE
    from app.services.data_sources.tcmsp_client import FOOD_HOMOLOGY_CATALOG

    out: Dict[str, HerbWhitelistEntry] = {}
    for name in FOOD_HOMOLOGY_CATALOG:
        limit = FOOD_HERB_MAX_DOSAGE.get(name)
        out[name] = HerbWhitelistEntry(
            name=name,
            tier=1,
            is_food_homology=True,
            daily_limit_mg=float(limit) if limit is not None else None,
            note="国家卫健委药食同源目录(106种,2024版)",
        )
    return out


def _build_l2() -> Dict[str, HerbWhitelistEntry]:
    """L2 新食品原料级：卫健委批准新食品原料（默认不进通用配方）。

    数据源：label_check_service 备案表（蛹虫草/广东虫草子实体带公告号）。
    阶段0 从严将其放 L3；阶段1 建立分级后归位 L2，但默认不进通用兜底池。
    """
    entries = [
        HerbWhitelistEntry(
            name="蛹虫草", tier=2, is_food_homology=False, daily_limit_mg=None,
            approval_no="2009年第3号公告",
            unsuitable_groups="婴幼儿、儿童、食用真菌过敏者",
            note="卫健委批准新食品原料（人工培养蛹虫草子实体），非野生冬虫夏草",
        ),
        HerbWhitelistEntry(
            name="广东虫草子实体", tier=2, is_food_homology=False, daily_limit_mg=None,
            approval_no="2013年第7号公告",
            unsuitable_groups="按公告要求执行",
            note="卫健委批准新食品原料",
        ),
    ]
    return {e.name: e for e in entries}


def _build_l3() -> Dict[str, HerbWhitelistEntry]:
    """L3 禁用/限制级：受保护物种等，任何路径不可生成。"""
    out: Dict[str, HerbWhitelistEntry] = {}
    for name in PROHIBITED_HERBS:
        out[name] = HerbWhitelistEntry(
            name=name, tier=3, is_food_homology=False, daily_limit_mg=None,
            note="受保护野生物种/非药食同源目录物质，禁止作为食疗原料",
        )
    return out


# 模块级单例（进程内构建一次；L1 106 种 + L2 + L3）
L1_FOOD_GRADE: Dict[str, HerbWhitelistEntry] = _build_l1()
L2_NEW_FOOD: Dict[str, HerbWhitelistEntry] = _build_l2()
L3_PROHIBITED: Dict[str, HerbWhitelistEntry] = _build_l3()

ALL_ENTRIES: Dict[str, HerbWhitelistEntry] = {**L1_FOOD_GRADE, **L2_NEW_FOOD, **L3_PROHIBITED}


def get_entry(name: str) -> Optional[HerbWhitelistEntry]:
    """查单味药材的白名单条目（任意级）。"""
    return ALL_ENTRIES.get(name)


def get_tier(name: str) -> Optional[int]:
    """返回药材所在级别（1/2/3），未知为 None。"""
    e = ALL_ENTRIES.get(name)
    return e.tier if e else None


def is_food_grade(name: str) -> bool:
    """是否 L1 食品级（106 目录内，可作普通食疗原料）。"""
    return name in L1_FOOD_GRADE


def l1_names() -> List[str]:
    """L1 食品级全部药材名（106 种）。"""
    return list(L1_FOOD_GRADE.keys())


def daily_limit_mg(name: str) -> Optional[float]:
    """L1 药材的目录日限量（mg/日）；非 L1 或无数据为 None（不编造）。"""
    e = L1_FOOD_GRADE.get(name)
    return e.daily_limit_mg if e else None


def l1_default_pool() -> List[str]:
    """兜底池安全默认子集：L1 中常见、限量明确的药食同源药材。

    供 _FALLBACK_HERB_POOL 动态取药（替代硬编码列表）。仅返回 L1 且有明确
    日限量的药材，确保每味都可被 clamp_dosage_to_catalog 约束。
    """
    return [n for n, e in L1_FOOD_GRADE.items() if e.daily_limit_mg is not None]
