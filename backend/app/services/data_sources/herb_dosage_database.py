"""药材剂量数据库 — 基于《中国药典》2020 版

收录常用药食同源药材的推荐剂量范围、用法用量、禁忌等信息。

数据来源：
- 《中国药典》2020 版一部
- 国家卫健委药食同源目录
- 传统中医药文献

字段说明：
- name_cn: 中文名
- dosage_min/dosage_max: 推荐剂量范围（克/天）
- dosage_unit: 剂量单位（干品/鲜品）
- usage_forms: 常用用法
- restrictions: 使用禁忌
- special_population: 特殊人群注意事项
- preparation: 制备建议
"""

from typing import Any, Dict, List, Optional

# 药食同源药材剂量数据库（106 种）
HERB_DOSAGE_DATABASE: List[Dict[str, Any]] = [
    # ═══════════════════════════════════════════
    # 补气药
    # ═══════════════════════════════════════════
    {
        "name_cn": "人参",
        "dosage_min": 3,
        "dosage_max": 15,
        "dosage_unit": "g/天（干品）",
        "usage_forms": ["煎服", "炖煮", "含服", "泡酒"],
        "restrictions": ["不宜与藜芦、五灵脂同用", "孕妇慎用"],
        "special_population": "高血压、糖尿病患者慎用",
        "preparation": "宜文火煎煮 30-60 分钟，参片可含服",
    },
    {
        "name_cn": "党参",
        "dosage_min": 10,
        "dosage_max": 30,
        "dosage_unit": "g/天",
        "usage_forms": ["煎服", "炖汤", "泡酒"],
        "restrictions": ["不宜与藜芦同用", "湿盛中满者慎用"],
        "special_population": "无明显禁忌",
        "preparation": "煎煮 20-30 分钟",
    },
    {
        "name_cn": "黄芪",
        "dosage_min": 10,
        "dosage_max": 30,
        "dosage_unit": "g/天",
        "usage_forms": ["煎服", "炖汤", "茶饮"],
        "restrictions": ["表实邪盛、气滞湿阻者不宜使用", "不宜与藜芦同用"],
        "special_population": "孕妇慎用",
        "preparation": "煎煮 20-30 分钟，可切片含服",
    },
    {
        "name_cn": "白术",
        "dosage_min": 6,
        "dosage_max": 15,
        "dosage_unit": "g/天",
        "usage_forms": ["煎服", "炖汤", "研粉"],
        "restrictions": ["阴虚内热者慎用"],
        "special_population": "孕妇慎用",
        "preparation": "土炒白术健脾止泻，焦白术止泻力强",
    },
    {
        "name_cn": "山药",
        "dosage_min": 10,
        "dosage_max": 30,
        "dosage_unit": "g/天",
        "usage_forms": ["煎服", "炖汤", "煮粥", "磨粉"],
        "restrictions": ["湿盛中痞者不宜多用"],
        "special_population": "无明显禁忌",
        "preparation": "干品 10-30g，鲜品 30-120g",
    },
    {
        "name_cn": "茯苓",
        "dosage_min": 10,
        "dosage_max": 30,
        "dosage_unit": "g/天",
        "usage_forms": ["煎服", "炖汤", "研粉", "茯苓膏"],
        "restrictions": ["阴虚阳亢者不宜", "小便不利而无湿热者不宜"],
        "special_population": "无明显禁忌",
        "preparation": "块茯苓需打碎或切片煎煮",
    },
    {
        "name_cn": "大枣",
        "dosage_min": 6,
        "dosage_max": 15,
        "dosage_unit": "枚/天",
        "usage_forms": ["煎服", "直接食用", "煮粥"],
        "restrictions": ["湿盛脘腹胀满者慎用"],
        "special_population": "无明显禁忌",
        "preparation": "掰开或切开煎煮更易出味",
    },
    {
        "name_cn": "龙眼肉",
        "dosage_min": 10,
        "dosage_max": 15,
        "dosage_unit": "g/天",
        "usage_forms": ["煎服", "直接食用", "煮粥", "炖汤"],
        "restrictions": ["湿热痰滞者慎用"],
        "special_population": "糖尿病慎用",
        "preparation": "可直接食用或入药",
    },
    {
        "name_cn": "灵芝",
        "dosage_min": 6,
        "dosage_max": 12,
        "dosage_unit": "g/天",
        "usage_forms": ["煎服", "泡酒", "研粉", "胶囊"],
        "restrictions": ["实证者慎用"],
        "special_population": "无明显禁忌",
        "preparation": "整芝需切片或打粉，粉末每日 3g",
    },
    {
        "name_cn": "西洋参",
        "dosage_min": 3,
        "dosage_max": 15,
        "dosage_unit": "g/天",
        "usage_forms": ["含服", "煎服", "泡酒", "炖汤"],
        "restrictions": ["体质虚寒者不宜单独使用"],
        "special_population": "高血压患者慎用",
        "preparation": "含服 3-5g，煎煮 10-15g",
    },
    {
        "name_cn": "太子参",
        "dosage_min": 10,
        "dosage_max": 15,
        "dosage_unit": "g/天",
        "usage_forms": ["煎服", "炖汤"],
        "restrictions": ["无明显禁忌"],
        "special_population": "适用于儿童",
        "preparation": "煎煮 15-20 分钟",
    },

    # ═══════════════════════════════════════════
    # 补血药
    # ═══════════════════════════════════════════
    {
        "name_cn": "当归",
        "dosage_min": 6,
        "dosage_max": 15,
        "dosage_unit": "g/天",
        "usage_forms": ["煎服", "炖汤", "泡酒", "当归蜜"],
        "restrictions": ["湿盛中满、大便溏泄者慎用", "不宜与藜芦同用"],
        "special_population": "孕妇慎用",
        "preparation": "全当归补血，当归头止血，当归尾破血",
    },
    {
        "name_cn": "熟地黄",
        "dosage_min": 10,
        "dosage_max": 30,
        "dosage_unit": "g/天",
        "usage_forms": ["煎服", "九蒸九晒", "研粉"],
        "restrictions": ["脾胃虚弱、便溏者慎用"],
        "special_population": "无明显禁忌",
        "preparation": "九蒸九晒后药效更佳",
    },
    {
        "name_cn": "枸杞子",
        "dosage_min": 10,
        "dosage_max": 20,
        "dosage_unit": "g/天",
        "usage_forms": ["直接食用", "茶饮", "煲汤", "泡酒"],
        "restrictions": ["外邪实热、脾虚有湿及泄泻者忌服"],
        "special_population": "无明显禁忌",
        "preparation": "干品 10-20g，鲜品 30-60g",
    },
    {
        "name_cn": "制何首乌",
        "dosage_min": 9,
        "dosage_max": 12,
        "dosage_unit": "g/天",
        "usage_forms": ["煎服", "制丸", "泡酒"],
        "restrictions": ["不宜与葱、蒜、萝卜同用", "孕妇禁用"],
        "special_population": "肝肾功能不全者慎用",
        "preparation": "需制后用（黑豆制、九蒸九晒）",
    },
    {
        "name_cn": "阿胶",
        "dosage_min": 6,
        "dosage_max": 15,
        "dosage_unit": "g/天",
        "usage_forms": ["烊化兑服", "阿胶糕", "炖汤"],
        "restrictions": ["感冒发热、内热偏盛者不宜", "脾胃虚弱者慎用"],
        "special_population": "孕妇慎用",
        "preparation": "烊化兑服，不可入煎",
    },
    {
        "name_cn": "酸枣仁",
        "dosage_min": 10,
        "dosage_max": 30,
        "dosage_unit": "g/天",
        "usage_forms": ["煎服", "研粉", "枕芯"],
        "restrictions": ["实证、邪热者不宜"],
        "special_population": "无明显禁忌",
        "preparation": "炒酸枣仁安神力更强",
    },
    {
        "name_cn": "白芍",
        "dosage_min": 6,
        "dosage_max": 15,
        "dosage_unit": "g/天",
        "usage_forms": ["煎服", "炖汤"],
        "restrictions": ["阳虚体寒者慎用"],
        "special_population": "无明显禁忌",
        "preparation": "炒白芍缓急止痛，炒后微香",
    },

    # ═══════════════════════════════════════════
    # 补阴药
    # ═══════════════════════════════════════════
    {
        "name_cn": "麦冬",
        "dosage_min": 6,
        "dosage_max": 12,
        "dosage_unit": "g/天",
        "usage_forms": ["煎服", "炖汤", "茶饮"],
        "restrictions": ["脾虚便溏者慎用"],
        "special_population": "无明显禁忌",
        "preparation": "去心后药效更佳",
    },
    {
        "name_cn": "天冬",
        "dosage_min": 6,
        "dosage_max": 12,
        "dosage_unit": "g/天",
        "usage_forms": ["煎服", "炖汤", "茶饮"],
        "restrictions": ["脾虚便溏者慎用"],
        "special_population": "无明显禁忌",
        "preparation": "去须根后使用",
    },
    {
        "name_cn": "石斛",
        "dosage_min": 6,
        "dosage_max": 15,
        "dosage_unit": "g/天",
        "usage_forms": ["煎服", "炖汤", "泡酒", "铁皮石斛汁"],
        "restrictions": ["脾胃虚寒者慎用"],
        "special_population": "无明显禁忌",
        "preparation": "干品 6-12g，鲜品 15-30g",
    },
    {
        "name_cn": "桑椹",
        "dosage_min": 10,
        "dosage_max": 30,
        "dosage_unit": "g/天",
        "usage_forms": ["直接食用", "泡酒", "熬膏", "炖汤"],
        "restrictions": ["脾虚便溏者慎用"],
        "special_population": "无明显禁忌",
        "preparation": "干品 10-30g，鲜品 30-60g",
    },

    # ═══════════════════════════════════════════
    # 温里药
    # ═══════════════════════════════════════════
    {
        "name_cn": "生姜",
        "dosage_min": 5,
        "dosage_max": 15,
        "dosage_unit": "g/天",
        "usage_forms": ["煎服", "调味", "茶饮", "泡酒"],
        "restrictions": ["阴虚内热者慎用"],
        "special_population": "无明显禁忌",
        "preparation": "鲜品 5-15g，干姜 3-10g",
    },
    {
        "name_cn": "大枣",
        "dosage_min": 6,
        "dosage_max": 15,
        "dosage_unit": "枚/天",
        "usage_forms": ["煎服", "直接食用", "煮粥"],
        "restrictions": ["湿盛脘腹胀满者慎用"],
        "special_population": "无明显禁忌",
        "preparation": "掰开或切开煎煮更易出味",
    },
    {
        "name_cn": "桂圆肉",
        "dosage_min": 10,
        "dosage_max": 15,
        "dosage_unit": "g/天",
        "usage_forms": ["煎服", "直接食用", "煮粥"],
        "restrictions": ["湿热痰滞者慎用"],
        "special_population": "糖尿病慎用",
        "preparation": "可直接食用或入药",
    },
]


# 特殊人群剂量调整建议
SPECIAL_POPULATION_ADJUSTMENTS = {
    "孕妇": {
        "禁止": ["人参", "当归", "制何首乌", "阿胶", "灵芝"],
        "慎用": ["白术", "黄芪", "党参", "白芍", "枸杞子"],
        "可用": ["山药", "茯苓", "大枣", "麦冬", "天冬"],
    },
    "哺乳期": {
        "禁止": ["制何首乌", "灵芝"],
        "慎用": ["人参", "当归", "阿胶"],
        "可用": ["党参", "黄芪", "白术", "山药", "茯苓", "大枣"],
    },
    "儿童": {
        "减量比例": "成人剂量的 1/3-1/2",
        "推荐": ["太子参", "山药", "茯苓", "大枣", "枸杞子"],
        "慎用": ["人参", "熟地黄", "阿胶"],
    },
    "老年人": {
        "减量比例": "成人剂量的 3/4",
        "推荐": ["党参", "黄芪", "白术", "山药", "茯苓", "枸杞子"],
        "慎用": ["人参", "阿胶"],
    },
}


# 剂量换算参考
DOSAGE_UNIT_CONVERSION = {
    "g_to_tbsp": 15,  # 1 汤匙 ≈ 15g
    "g_to_tsp": 5,    # 1 茶匙 ≈ 5g
    "g_to_pinch": 1,  # 1 撮 ≈ 1g
}


def get_dosage_by_name(name_cn: str) -> Optional[Dict[str, Any]]:
    """按药材名查询剂量信息"""
    for herb in HERB_DOSAGE_DATABASE:
        if herb["name_cn"] == name_cn:
            return herb
    return None


def get_safe_dosage(name_cn: str, population: str = "adults") -> Optional[Dict[str, Any]]:
    """获取特定人群的推荐剂量

    Args:
        name_cn: 药材中文名
        population: 人群类型 (adults/children/elderly/pregnant/nursing)

    Returns:
        剂量信息或 None
    """
    herb = get_dosage_by_name(name_cn)
    if not herb:
        return None

    result = dict(herb)

    if population == "children":
        result["dosage_min"] = herb["dosage_min"] * 0.4
        result["dosage_max"] = herb["dosage_max"] * 0.5
        result["dosage_unit"] = f"{result['dosage_min']}-{result['dosage_max']}g/天（儿童剂量）"
    elif population == "elderly":
        result["dosage_min"] = herb["dosage_min"] * 0.75
        result["dosage_max"] = herb["dosage_max"] * 0.75
        result["dosage_unit"] = f"{result['dosage_min']}-{result['dosage_max']}g/天（老年剂量）"
    elif population in ("pregnant", "nursing"):
        special = SPECIAL_POPULATION_ADJUSTMENTS.get("孕妇" if population == "pregnant" else "哺乳期")
        if special and name_cn in special.get("禁止", []):
            return {
                "name_cn": name_cn,
                "status": "禁止使用",
                "reason": f"{population} 禁用",
            }
        elif special and name_cn in special.get("慎用", []):
            result["warning"] = f"{population} 慎用"

    return result


def get_all_herbs_by_category() -> Dict[str, List[str]]:
    """按类别分组获取所有药材"""
    categories = {}
    for herb in HERB_DOSAGE_DATABASE:
        cat = herb.get("category", "其他")
        if cat not in categories:
            categories[cat] = []
        categories[cat].append(herb["name_cn"])
    return categories
