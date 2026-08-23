#!/usr/bin/env python3
"""
遗传算法数据层补全脚本
为 _EFFICACY_TO_HERBS 添加缺失的疗效类别映射
"""
import asyncio
import sys
sys.path.insert(0, '.')

from app.services.ai.algorithms.bayesian_formula_optimizer import _EFFICACY_TO_HERBS, _BUILTIN_HERBS

# ═══════════════════════════════════════════════════════════════
# 需要添加的疗效类别映射（基于 12 个配方的 target_effects）
# ═══════════════════════════════════════════════════════════════

ADDITIONAL_EFFICACY_MAPPINGS = {
    # 补气养血相关
    "补气养血": ["hq", "ds", "dg", "gz", "bq", "fp", "rs", "cs"],
    "补肾益气": ["hq", "ds", "gz", "rs", "fz", "bq", "fp", "cs"],
    "温阳固精": ["fz", "rs", "hq", "ds", "gz", "cs"],
    "强筋健骨": ["hq", "ds", "rs", "gz", "bq"],

    # 清热解毒相关
    "消肿止痛": ["cyh", "jgh", "cs", "fz", "gq"],
    "凉血利咽": ["cyh", "jgh", "gq", "fp"],

    # 活血化瘀相关
    "通经止痛": ["cs", "dg", "fz", "hq", "ds"],
    "消肿生肌": ["cs", "fz", "gq", "cyh"],

    # 健脾养胃相关
    "益气生津": ["ds", "hq", "gz", "rs", "fp"],
    "消食导滞": ["cx", "fp", "bq", "ds", "hq"],

    # 滋阴润肺相关
    "清热生津": ["gz", "cyh", "jgh", "fp", "ds"],

    # 安神助眠相关
    "养心安神": ["fp", "gz", "ds", "hq", "gq"],
    "健脾安神": ["fp", "bq", "ds", "gz", "hq"],
    "健脾补血": ["ds", "hq", "dg", "gz", "bq"],
    "健脾养血": ["ds", "hq", "dg", "bq", "fp"],

    # 疏肝理气相关
    "理气宽中": ["cx", "cs", "ds", "hq", "bq"],
    "理气和中": ["cx", "ds", "hq", "fp", "bq"],
    "疏肝解郁": ["cs", "cx", "ds", "hq", "gz"],

    # 祛风除湿相关
    "散寒温经": ["fz", "cs", "hq", "ds", "cx"],
    "通络止痛": ["cs", "fz", "dg", "hq", "ds"],

    # 化痰止咳相关
    "燥湿化痰": ["cx", "fp", "bq", "ds", "gq"],
    "止咳平喘": ["gq", "cx", "fp", "ds", "hq"],
    "止咳化痰": ["gq", "cx", "fp", "ds", "hq"],

    # 其他
    "健脾止泻": ["fp", "bq", "ds", "hq", "cx"],
    "健脾和胃": ["fp", "bq", "ds", "cx", "hq"],
    "调经止带": ["dg", "cs", "hq", "ds", "gz"],
    "行气止痛": ["cs", "cx", "fz", "dg", "hq"],
    "回阳救逆": ["fz", "rs", "ds", "hq", "gq"],
}

def main():
    print("=" * 60)
    print("遗传算法数据层补全")
    print("=" * 60)

    # 检查缺失的疗效类别
    missing = []
    for efficacy in ADDITIONAL_EFFICACY_MAPPINGS.keys():
        if efficacy not in _EFFICACY_TO_HERBS:
            missing.append(efficacy)

    print(f"\n当前疗效类别数: {len(_EFFICACY_TO_HERBS)}")
    print(f"缺失的疗效类别数: {len(missing)}")

    if missing:
        print("\n将添加以下疗效类别:")
        for eff in missing:
            herbs = ADDITIONAL_EFFICACY_MAPPINGS[eff]
            print(f"  - {eff}: {len(herbs)} 味药材 ({', '.join(herbs)})")

        # 添加映射
        for efficacy, herbs in ADDITIONAL_EFFICACY_MAPPINGS.items():
            if efficacy not in _EFFICACY_TO_HERBS:
                _EFFICACY_TO_HERBS[efficacy] = herbs

        print(f"\n✅ 已添加 {len(missing)} 个疗效类别")
        print(f"当前疗效类别总数: {len(_EFFICACY_TO_HERBS)}")

        # 验证
        print("\n验证新增的疗效类别:")
        for eff in ["补气养血", "补肾益气", "健脾养胃", "活血化瘀"]:
            if eff in _EFFICACY_TO_HERBS:
                print(f"  ✓ {eff}: {_EFFICACY_TO_HERBS[eff]}")
            else:
                print(f"  ✗ {eff}: 未找到")
    else:
        print("\n✅ 所有疗效类别已存在")

    # 显示预设场景建议
    print("\n" + "=" * 60)
    print("建议的预设场景配置:")
    print("=" * 60)

    presets = {
        "balanced": {
            "name": "平衡型配方",
            "objectives": [
                {"key": "efficacy", "weight": 0.25},
                {"key": "safety", "weight": 0.25},
                {"key": "taste", "weight": 0.15},
                {"key": "cost_efficiency", "weight": 0.15},
                {"key": "synergy", "weight": 0.15},
                {"key": "stability", "weight": 0.05},
            ]
        },
        "efficacy_first": {
            "name": "功效优先",
            "objectives": [
                {"key": "efficacy", "weight": 0.40},
                {"key": "safety", "weight": 0.25},
                {"key": "synergy", "weight": 0.20},
                {"key": "taste", "weight": 0.08},
                {"key": "cost_efficiency", "weight": 0.07},
                {"key": "stability", "weight": 0.00},
            ]
        },
        "safety_first": {
            "name": "安全优先",
            "objectives": [
                {"key": "safety", "weight": 0.40},
                {"key": "efficacy", "weight": 0.25},
                {"key": "stability", "weight": 0.15},
                {"key": "synergy", "weight": 0.10},
                {"key": "taste", "weight": 0.05},
                {"key": "cost_efficiency", "weight": 0.05},
            ]
        },
        "cost_first": {
            "name": "成本优先",
            "objectives": [
                {"key": "cost_efficiency", "weight": 0.35},
                {"key": "efficacy", "weight": 0.25},
                {"key": "safety", "weight": 0.20},
                {"key": "synergy", "weight": 0.10},
                {"key": "taste", "weight": 0.05},
                {"key": "stability", "weight": 0.05},
            ]
        },
        "synergy_focused": {
            "name": "协同效应优先",
            "objectives": [
                {"key": "synergy", "weight": 0.35},
                {"key": "efficacy", "weight": 0.25},
                {"key": "safety", "weight": 0.20},
                {"key": "stability", "weight": 0.10},
                {"key": "taste", "weight": 0.05},
                {"key": "cost_efficiency", "weight": 0.05},
            ]
        },
        "comprehensive": {
            "name": "综合优化",
            "objectives": [
                {"key": "efficacy", "weight": 0.30},
                {"key": "safety", "weight": 0.25},
                {"key": "synergy", "weight": 0.15},
                {"key": "taste", "weight": 0.10},
                {"key": "cost_efficiency", "weight": 0.10},
                {"key": "stability", "weight": 0.10},
            ]
        },
    }

    for name, config in presets.items():
        print(f"\n{name}:")
        for obj in config["objectives"]:
            print(f"  {obj['key']}: {obj['weight']:.2f}")

    print("\n" + "=" * 60)

if __name__ == "__main__":
    main()
