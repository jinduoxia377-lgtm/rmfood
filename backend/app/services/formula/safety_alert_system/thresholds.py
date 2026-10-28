"""
SafetyAlertSystem - 内置阈值数据库

包含 50+ 种常见成分的 ADI/UL 阈值数据，覆盖:
- 多肽类成分
- 多糖类成分
- 皂苷类成分
- 黄酮类成分
- 生物碱类成分
- 维生素类成分
- 矿物质类成分
- 其他功能性成分
"""

from typing import Any, Dict

# 常见药材 → 标志性活性成分 别名映射
# 使 raw herb 名称能命中其活性成分阈值（如 黄芪 → 黄芪多糖/黄芪甲苷）
HERB_ALIAS_MAP: Dict[str, str] = {
    "黄芪": "黄芪多糖",
    "黄芪提取物": "黄芪多糖",
    "人参": "人参皂苷",
    "红参": "人参皂苷",
    "西洋参": "西洋参皂苷",
    "枸杞": "枸杞多糖",
    "枸杞子": "枸杞多糖",
    "灵芝": "灵芝多糖",
    "灵芝孢子粉": "灵芝多糖",
    "茯苓": "茯苓多糖",
    "香菇": "香菇多糖",
    "银耳": "银耳多糖",
    "海带": "海带多糖",
    "山楂": "山楂黄酮",
    "葛根": "葛根黄酮",
    "银杏": "银杏黄酮",
    "银杏叶": "银杏黄酮",
    "陈皮": "陈皮黄酮",
    "姜黄": "姜黄素",
    "三七": "三七皂苷",
    "绞股蓝": "绞股蓝皂苷",
    "苦参": "苦参碱",
    "大豆": "大豆异黄酮",
    "大豆提取物": "大豆异黄酮",
    "绿茶": "茶多酚",
    "茶叶提取物": "茶多酚",
    "番茄": "番茄红素",
    "番茄提取物": "番茄红素",
    "玉米": "玉米低聚肽",
    "胶原蛋白": "胶原蛋白肽",
    "鱼胶原蛋白": "鱼胶原蛋白肽",
    "乳清蛋白": "乳清蛋白肽",
    "螺旋藻": "螺旋藻",
    "蜂胶": "蜂胶",
    "蜂王浆": "蜂王浆",
}


BUILT_IN_THRESHOLDS: Dict[str, Dict[str, Any]] = {
    # ════════════════════════════════════════════════════════
    # 多肽类成分
    # ════════════════════════════════════════════════════════

    "大豆肽": {
        "adi": 5000,              # mg/day (GRAS 认定)
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "FDA GRAS",
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.7,
            "elderly": 0.9,
        },
    },

    "胶原蛋白肽": {
        "adi": 10000,             # mg/day (EFSA)
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "EFSA 2014",
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.8,
            "elderly": 1.0,
        },
    },

    "乳清蛋白肽": {
        "adi": 8000,              # mg/day
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "WHO/FAO",
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.8,
            "elderly": 0.9,
        },
    },

    "鱼胶原蛋白肽": {
        "adi": 10000,             # mg/day
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "EFSA 2014",
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.8,
            "elderly": 1.0,
        },
    },

    "玉米低聚肽": {
        "adi": 3000,              # mg/day
        "ul": 6000,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "中国营养学会",
        "special_groups": {
            "pregnant": 0.9,
            "children": 0.7,
            "elderly": 0.9,
        },
    },

    # ════════════════════════════════════════════════════════
    # 多糖类成分
    # ════════════════════════════════════════════════════════

    "黄芪多糖": {
        "adi": 2000,              # mg/day
        "ul": 5000,
        "soft_limit_pct": 75,
        "hard_limit_pct": 100,
        "source": "药典委员会",
        "special_groups": {
            "pregnant": 0.5,
            "children": 0.5,
            "elderly": 0.8,
        },
    },

    "枸杞多糖": {
        "adi": 1500,              # mg/day
        "ul": 3000,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "中国药典",
        "special_groups": {
            "pregnant": 0.7,
            "children": 0.7,
            "elderly": 0.9,
        },
    },

    "香菇多糖": {
        "adi": 800,               # mg/day
        "ul": 2000,
        "soft_limit_pct": 70,
        "hard_limit_pct": 100,
        "source": "JECFA",
        "special_groups": {
            "pregnant": 0.5,
            "children": 0.5,
            "elderly": 0.8,
        },
    },

    "灵芝多糖": {
        "adi": 1500,              # mg/day
        "ul": 3000,
        "soft_limit_pct": 75,
        "hard_limit_pct": 100,
        "source": "保健食品原料目录",
        "special_groups": {
            "pregnant": 0.5,
            "children": 0.6,
            "elderly": 0.9,
        },
    },

    "茯苓多糖": {
        "adi": 2000,              # mg/day
        "ul": 4000,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "中国药典",
        "special_groups": {
            "pregnant": 0.8,
            "children": 0.7,
            "elderly": 0.9,
        },
    },

    "海带多糖": {
        "adi": 500,               # mg/day
        "ul": 1500,
        "soft_limit_pct": 70,
        "hard_limit_pct": 100,
        "source": "GB 14880",
        "special_groups": {
            "pregnant": 0.6,
            "children": 0.5,
            "elderly": 0.8,
        },
    },

    "银耳多糖": {
        "adi": 3000,              # mg/day
        "ul": 6000,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "中国营养学会",
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.8,
            "elderly": 1.0,
        },
    },

    # ════════════════════════════════════════════════════════
    # 皂苷类成分
    # ════════════════════════════════════════════════════════

    "人参皂苷": {
        "adi": 300,               # mg/day
        "ul": 3000,
        "soft_limit_pct": 70,
        "hard_limit_pct": 100,
        "source": "药典委员会",
        "special_groups": {
            "pregnant": 0.3,
            "children": 0.3,
            "elderly": 0.7,
        },
    },

    "绞股蓝皂苷": {
        "adi": 200,               # mg/day
        "ul": 1000,
        "soft_limit_pct": 70,
        "hard_limit_pct": 100,
        "source": "保健食品原料目录",
        "special_groups": {
            "pregnant": 0.3,
            "children": 0.3,
            "elderly": 0.7,
        },
    },

    "三七皂苷": {
        "adi": 400,               # mg/day
        "ul": 2000,
        "soft_limit_pct": 70,
        "hard_limit_pct": 100,
        "source": "中国药典",
        "special_groups": {
            "pregnant": 0.3,
            "children": 0.3,
            "elderly": 0.7,
        },
    },

    "西洋参皂苷": {
        "adi": 250,               # mg/day
        "ul": 1500,
        "soft_limit_pct": 70,
        "hard_limit_pct": 100,
        "source": "USP",
        "special_groups": {
            "pregnant": 0.3,
            "children": 0.3,
            "elderly": 0.8,
        },
    },

    "黄芪甲苷": {
        "adi": 150,               # mg/day
        "ul": 800,
        "soft_limit_pct": 70,
        "hard_limit_pct": 100,
        "source": "药典委员会",
        "special_groups": {
            "pregnant": 0.4,
            "children": 0.4,
            "elderly": 0.8,
        },
    },

    # ════════════════════════════════════════════════════════
    # 黄酮类成分
    # ════════════════════════════════════════════════════════

    "大豆异黄酮": {
        "adi": 120,               # mg/day (EFSA)
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "EFSA 2015",
        "special_groups": {
            "pregnant": 0.5,
            "children": 0.3,
            "elderly": 0.8,
        },
    },

    "葛根黄酮": {
        "adi": 200,               # mg/day
        "ul": 1000,
        "soft_limit_pct": 75,
        "hard_limit_pct": 100,
        "source": "中国药典",
        "special_groups": {
            "pregnant": 0.5,
            "children": 0.4,
            "elderly": 0.8,
        },
    },

    "银杏黄酮": {
        "adi": 240,               # mg/day
        "ul": 480,
        "soft_limit_pct": 75,
        "hard_limit_pct": 100,
        "source": "ESCOP",
        "special_groups": {
            "pregnant": 0.3,
            "children": 0.3,
            "elderly": 0.7,
        },
    },

    "山楂黄酮": {
        "adi": 500,               # mg/day
        "ul": 2000,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "GB 16740",
        "special_groups": {
            "pregnant": 0.8,
            "children": 0.7,
            "elderly": 0.9,
        },
    },

    "陈皮黄酮": {
        "adi": 600,               # mg/day
        "ul": 2500,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "中国药典",
        "special_groups": {
            "pregnant": 0.8,
            "children": 0.7,
            "elderly": 0.9,
        },
    },

    "槲皮素": {
        "adi": 1000,              # mg/day
        "ul": 5000,
        "soft_limit_pct": 70,
        "hard_limit_pct": 100,
        "source": "EFSA",
        "special_groups": {
            "pregnant": 0.7,
            "children": 0.6,
            "elderly": 0.8,
        },
    },

    "芦丁": {
        "adi": 500,               # mg/day
        "ul": 2000,
        "soft_limit_pct": 75,
        "hard_limit_pct": 100,
        "source": "WHO",
        "special_groups": {
            "pregnant": 0.7,
            "children": 0.6,
            "elderly": 0.8,
        },
    },

    # ════════════════════════════════════════════════════════
    # 生物碱类成分
    # ════════════════════════════════════════════════════════

    "小檗碱": {
        "adi": 500,               # mg/day
        "ul": 1500,
        "soft_limit_pct": 65,
        "hard_limit_pct": 100,
        "source": "USP",
        "special_groups": {
            "pregnant": 0.3,
            "children": 0.3,
            "elderly": 0.6,
        },
    },

    "苦参碱": {
        "adi": 100,               # mg/day
        "ul": 400,
        "soft_limit_pct": 60,
        "hard_limit_pct": 100,
        "source": "中国药典",
        "special_groups": {
            "pregnant": 0.2,
            "children": 0.2,
            "elderly": 0.5,
        },
    },

    "辣椒碱": {
        "adi": 5,                 # mg/day
        "ul": 10,
        "soft_limit_pct": 60,
        "hard_limit_pct": 100,
        "source": "JECFA",
        "special_groups": {
            "pregnant": 0.3,
            "children": 0.2,
            "elderly": 0.7,
        },
    },

    "甜菜碱": {
        "adi": 3000,              # mg/day
        "ul": 9000,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "EFSA",
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.8,
            "elderly": 1.0,
        },
    },

    # ════════════════════════════════════════════════════════
    # 维生素类成分
    # ════════════════════════════════════════════════════════

    "维生素C": {
        "uli": 2000,              # mg/day (中国营养学会 DRIs 2013)
        "source": "DRIs 2013",
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "special_groups": {
            "pregnant": 1.2,
            "children": 0.5,
            "elderly": 1.0,
        },
    },

    "维生素E": {
        "uli": 700,               # mg/day (α-生育酚当量)
        "source": "DRIs 2013",
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.6,
            "elderly": 1.0,
        },
    },

    "维生素A": {
        "uli": 3000,              # μg RAE/day
        "source": "DRIs 2013",
        "soft_limit_pct": 75,
        "hard_limit_pct": 100,
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.4,
            "elderly": 0.9,
        },
    },

    "维生素B族复合": {
        "uli": None,
        "adi": 50,                # mg/day (B1+B2+B6+B12 复合)
        "source": "DRIs 2013",
        "soft_limit_pct": 90,
        "hard_limit_pct": 100,
        "special_groups": {
            "pregnant": 1.2,
            "children": 0.6,
            "elderly": 1.0,
        },
    },

    "维生素D": {
        "uli": 50,                # μg/day
        "source": "DRIs 2013",
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.5,
            "elderly": 1.0,
        },
    },

    "维生素K": {
        "uli": None,
        "adi": 200,               # μg/day
        "source": "EFSA",
        "soft_limit_pct": 85,
        "hard_limit_pct": 100,
        "special_groups": {
            "pregnant": 1.2,
            "children": 0.7,
            "elderly": 1.0,
        },
    },

    # ════════════════════════════════════════════════════════
    # 矿物质类成分
    # ════════════════════════════════════════════════════════

    "钙": {
        "uli": 2500,              # mg/day
        "source": "DRIs 2013",
        "soft_limit_pct": 85,
        "hard_limit_pct": 100,
        "special_groups": {
            "pregnant": 1.2,
            "children": 0.8,
            "elderly": 0.9,
        },
    },

    "铁": {
        "uli": 42,                # mg/day
        "source": "DRIs 2013",
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "special_groups": {
            "pregnant": 1.5,
            "children": 0.5,
            "elderly": 0.8,
        },
    },

    "锌": {
        "uli": 40,                # mg/day
        "source": "DRIs 2013",
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "special_groups": {
            "pregnant": 1.2,
            "children": 0.6,
            "elderly": 0.9,
        },
    },

    "镁": {
        "uli": 420,               # mg/day (补充剂形式)
        "source": "DRIs 2013",
        "soft_limit_pct": 85,
        "hard_limit_pct": 100,
        "special_groups": {
            "pregnant": 1.1,
            "children": 0.7,
            "elderly": 0.9,
        },
    },

    "硒": {
        "uli": 400,               # μg/day
        "source": "DRIs 2013",
        "soft_limit_pct": 75,
        "hard_limit_pct": 100,
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.5,
            "elderly": 0.9,
        },
    },

    # ════════════════════════════════════════════════════════
    # 其他功能性成分
    # ════════════════════════════════════════════════════════

    "姜黄素": {
        "adi": 3000,              # mg/day
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "JECFA/EFSA",
        "special_groups": {
            "pregnant": 0.5,
            "children": 0.5,
            "elderly": 0.8,
        },
    },

    "茶多酚": {
        "adi": 800,               # mg/day (EGCG 当量)
        "ul": 1600,
        "soft_limit_pct": 70,
        "hard_limit_pct": 100,
        "source": "EFSA",
        "special_groups": {
            "pregnant": 0.5,
            "children": 0.4,
            "elderly": 0.8,
        },
    },

    "花青素": {
        "adi": 1000,              # mg/day
        "ul": None,
        "soft_limit_pct": 85,
        "hard_limit_pct": 100,
        "source": "EFSA",
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.7,
            "elderly": 1.0,
        },
    },

    "原花青素": {
        "adi": 500,               # mg/day
        "ul": 1000,
        "soft_limit_pct": 75,
        "hard_limit_pct": 100,
        "source": "法国食品安全局",
        "special_groups": {
            "pregnant": 0.8,
            "children": 0.6,
            "elderly": 0.9,
        },
    },

    "番茄红素": {
        "adi": 15,                # mg/day
        "ul": 75,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "EFSA",
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.7,
            "elderly": 1.0,
        },
    },

    "叶黄素": {
        "adi": 20,                # mg/day
        "ul": None,
        "soft_limit_pct": 85,
        "hard_limit_pct": 100,
        "source": "EFSA",
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.7,
            "elderly": 1.0,
        },
    },

    "辅酶Q10": {
        "adi": 1200,              # mg/day
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "USP",
        "special_groups": {
            "pregnant": 0.7,
            "children": 0.5,
            "elderly": 0.9,
        },
    },

    "益生菌复合": {
        "adi": 100000000000,      # CFU/day (10^11)
        "ul": None,
        "soft_limit_pct": 90,
        "hard_limit_pct": 100,
        "source": "WHO/FAO",
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.8,
            "elderly": 1.0,
        },
    },

    "益生元(菊粉)": {
        "adi": 15000,             # mg/day
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "EFSA",
        "special_groups": {
            "pregnant": 0.9,
            "children": 0.6,
            "elderly": 0.8,
        },
    },

    "DHA藻油": {
        "adi": 1000,              # mg/day
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "EFSA/GOED",
        "special_groups": {
            "pregnant": 1.2,
            "children": 0.7,
            "elderly": 1.0,
        },
    },

    "EPA鱼油": {
        "adi": 2000,              # mg/day
        "ul": 5000,
        "soft_limit_pct": 75,
        "hard_limit_pct": 100,
        "source": "GOED/EFSA",
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.6,
            "elderly": 0.9,
        },
    },

    "乳铁蛋白": {
        "adi": 1000,              # mg/day
        "ul": 3000,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "EFSA",
        "special_groups": {
            "pregnant": 1.0,
            "children": 1.0,
            "elderly": 1.0,
        },
    },

    "免疫球蛋白IgG": {
        "adi": 500,               # mg/day
        "ul": 2000,
        "soft_limit_pct": 75,
        "hard_limit_pct": 100,
        "source": "CFDA",
        "special_groups": {
            "pregnant": 1.0,
            "children": 1.0,
            "elderly": 1.0,
        },
    },

    "褪黑素": {
        "adi": 3,                 # mg/day
        "ul": 10,
        "soft_limit_pct": 60,
        "hard_limit_pct": 100,
        "source": "GB 16740",
        "special_groups": {
            "pregnant": 0.2,
            "children": 0.2,
            "elderly": 0.8,
        },
    },

    "GABA(γ-氨基丁酸)": {
        "adi": 750,               # mg/day
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "GB 14880",
        "special_groups": {
            "pregnant": 0.5,
            "children": 0.3,
            "elderly": 0.8,
        },
    },

    "左旋肉碱": {
        "adi": 3000,              # mg/day
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "USP",
        "special_groups": {
            "pregnant": 0.7,
            "children": 0.5,
            "elderly": 0.9,
        },
    },

    "共轭亚油酸(CLA)": {
        "adi": 3500,              # mg/day
        "ul": 6000,
        "soft_limit_pct": 75,
        "hard_limit_pct": 100,
        "source": "EFSA",
        "special_groups": {
            "pregnant": 0.5,
            "children": 0.4,
            "elderly": 0.8,
        },
    },

    "大豆磷脂": {
        "adi": 10000,             # mg/day
        "ul": None,
        "soft_limit_pct": 85,
        "hard_limit_pct": 100,
        "source": "FDA GRAS",
        "special_groups": {
            "pregnant": 1.0,
            "children": 0.8,
            "elderly": 1.0,
        },
    },

    "螺旋藻": {
        "adi": 8000,              # mg/day
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "FDA GRAS",
        "special_groups": {
            "pregnant": 0.8,
            "children": 0.6,
            "elderly": 0.9,
        },
    },

    "蜂胶": {
        "adi": 1500,              # mg/day
        "ul": 4500,
        "soft_limit_pct": 70,
        "hard_limit_pct": 100,
        "source": "WHO",
        "special_groups": {
            "pregnant": 0.3,
            "children": 0.3,
            "elderly": 0.7,
        },
    },

    "蜂王浆": {
        "adi": 1000,              # mg/day
        "ul": 3000,
        "soft_limit_pct": 70,
        "hard_limit_pct": 100,
        "source": "EFSA",
        "special_groups": {
            "pregnant": 0.3,
            "children": 0.3,
            "elderly": 0.7,
        },
    },

    "花粉": {
        "adi": 5000,              # mg/day
        "ul": None,
        "soft_limit_pct": 80,
        "hard_limit_pct": 100,
        "source": "FDA GRAS",
        "special_groups": {
            "pregnant": 0.5,
            "children": 0.5,
            "elderly": 0.9,
        },
    },
}
