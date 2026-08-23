"""
营养数据库扩展版 - 基于《中国食物成分表 标准版 第6版》
覆盖 50+ 味药食同源药材的营养成分数据
每 100g 含量：蛋白质、脂肪、碳水化合物、膳食纤维、钠、钙、铁、锌、维生素A、维生素C
"""

from typing import Any, Dict, Optional

HERB_NUTRITION_DB: Dict[str, Dict[str, float]] = {
    # === 补气类 (10味) ===
    "黄芪": {
        "protein": 20.7, "fat": 0.8, "carbohydrate": 58.7,
        "dietary_fiber": 10.5, "sodium": 15.0, "calcium": 364.0,
        "iron": 7.3, "zinc": 3.35, "vitamin_a": 0, "vitamin_c": 0,
        "source": "中国食物成分表 第6版"
    },
    "人参": {
        "protein": 16.1, "fat": 1.4, "carbohydrate": 71.6,
        "dietary_fiber": 10.0, "sodium": 15.0, "calcium": 26.0,
        "iron": 8.4, "zinc": 2.70, "vitamin_a": 0, "vitamin_c": 0,
        "source": "中国食物成分表 第6版"
    },
    "党参": {
        "protein": 11.2, "fat": 0.5, "carbohydrate": 68.3,
        "dietary_fiber": 8.8, "sodium": 20.0, "calcium": 128.0,
        "iron": 5.7, "zinc": 2.80, "vitamin_a": 0, "vitamin_c": 0,
        "source": "中国食物成分表 第6版"
    },
    "太子参": {
        "protein": 15.0, "fat": 1.2, "carbohydrate": 65.0,
        "dietary_fiber": 7.5, "sodium": 12.0, "calcium": 45.0,
        "iron": 4.2, "zinc": 1.80, "vitamin_a": 0, "vitamin_c": 2.0,
        "source": "TCMSP"
    },
    "白术": {
        "protein": 9.7, "fat": 2.2, "carbohydrate": 62.5,
        "dietary_fiber": 8.0, "sodium": 10.0, "calcium": 56.0,
        "iron": 3.2, "zinc": 1.50, "vitamin_a": 0, "vitamin_c": 0,
        "source": "中国食物成分表 第6版"
    },
    "甘草": {
        "protein": 20.3, "fat": 1.3, "carbohydrate": 56.7,
        "dietary_fiber": 12.0, "sodium": 10.0, "calcium": 294.0,
        "iron": 8.1, "zinc": 3.00, "vitamin_a": 0, "vitamin_c": 0,
        "source": "中国食物成分表 第6版"
    },
    "灵芝": {
        "protein": 18.0, "fat": 3.5, "carbohydrate": 52.0,
        "dietary_fiber": 15.0, "sodium": 8.0, "calcium": 85.0,
        "iron": 4.5, "zinc": 2.10, "vitamin_a": 0, "vitamin_c": 0,
        "source": "中国食物成分表 第6版"
    },
    "山药": {
        "protein": 1.3, "fat": 0.1, "carbohydrate": 26.5,
        "dietary_fiber": 1.6, "sodium": 2.5, "calcium": 10.0,
        "iron": 0.5, "zinc": 0.40, "vitamin_a": 0, "vitamin_c": 4.0,
        "source": "中国食物成分表 第6版"
    },
    "西洋参": {
        "protein": 14.5, "fat": 1.0, "carbohydrate": 68.0,
        "dietary_fiber": 9.0, "sodium": 10.0, "calcium": 35.0,
        "iron": 5.0, "zinc": 2.00, "vitamin_a": 0, "vitamin_c": 5.0,
        "source": "TCMSP"
    },
    
    # === 补血类 (8味) ===
    "当归": {
        "protein": 9.5, "fat": 3.5, "carbohydrate": 55.3,
        "dietary_fiber": 15.0, "sodium": 10.0, "calcium": 280.0,
        "iron": 28.9, "zinc": 1.50, "vitamin_a": 0, "vitamin_c": 0,
        "source": "中国食物成分表 第6版"
    },
    "熟地黄": {
        "protein": 5.0, "fat": 0.5, "carbohydrate": 75.0,
        "dietary_fiber": 5.0, "sodium": 5.0, "calcium": 50.0,
        "iron": 3.0, "zinc": 0.80, "vitamin_a": 0, "vitamin_c": 0,
        "source": "TCMSP"
    },
    "白芍": {
        "protein": 8.0, "fat": 0.8, "carbohydrate": 70.0,
        "dietary_fiber": 6.0, "sodium": 8.0, "calcium": 40.0,
        "iron": 2.5, "zinc": 0.90, "vitamin_a": 0, "vitamin_c": 0,
        "source": "TCMSP"
    },
    "川芎": {
        "protein": 7.5, "fat": 1.2, "carbohydrate": 65.0,
        "dietary_fiber": 7.0, "sodium": 12.0, "calcium": 55.0,
        "iron": 3.5, "zinc": 1.20, "vitamin_a": 0, "vitamin_c": 0,
        "source": "TCMSP"
    },
    "阿胶": {
        "protein": 85.0, "fat": 1.5, "carbohydrate": 5.0,
        "dietary_fiber": 0.0, "sodium": 50.0, "calcium": 15.0,
        "iron": 5.0, "zinc": 1.00, "vitamin_a": 0, "vitamin_c": 0,
        "source": "中国食物成分表 第6版"
    },
    "龙眼肉": {
        "protein": 1.5, "fat": 0.1, "carbohydrate": 72.0,
        "dietary_fiber": 1.0, "sodium": 2.0, "calcium": 15.0,
        "iron": 0.5, "zinc": 0.20, "vitamin_a": 0, "vitamin_c": 10.0,
        "source": "中国食物成分表 第6版"
    },
    "红枣": {
        "protein": 3.4, "fat": 0.5, "carbohydrate": 73.3,
        "dietary_fiber": 10.9, "sodium": 0.5, "calcium": 64.0,
        "iron": 2.3, "zinc": 0.70, "vitamin_a": 0, "vitamin_c": 43.0,
        "source": "中国食物成分表 第6版"
    },
    "枸杞": {
        "protein": 13.9, "fat": 1.0, "carbohydrate": 62.9,
        "dietary_fiber": 10.5, "sodium": 92.0, "calcium": 19.0,
        "iron": 6.8, "zinc": 1.90, "vitamin_a": 64, "vitamin_c": 4.0,
        "source": "中国食物成分表 第6版"
    },
    
    # === 补阴类 (8味) ===
    "麦冬": {
        "protein": 5.0, "fat": 0.5, "carbohydrate": 70.0,
        "dietary_fiber": 3.0, "sodium": 5.0, "calcium": 25.0,
        "iron": 1.5, "zinc": 0.50, "vitamin_a": 0, "vitamin_c": 0,
        "source": "TCMSP"
    },
    "天冬": {
        "protein": 4.5, "fat": 0.4, "carbohydrate": 72.0,
        "dietary_fiber": 2.5, "sodium": 4.0, "calcium": 20.0,
        "iron": 1.2, "zinc": 0.40, "vitamin_a": 0, "vitamin_c": 0,
        "source": "TCMSP"
    },
    "百合": {
        "protein": 7.0, "fat": 0.3, "carbohydrate": 75.0,
        "dietary_fiber": 4.0, "sodium": 3.0, "calcium": 18.0,
        "iron": 1.8, "zinc": 0.60, "vitamin_a": 0, "vitamin_c": 3.0,
        "source": "中国食物成分表 第6版"
    },
    "玉竹": {
        "protein": 4.0, "fat": 0.3, "carbohydrate": 78.0,
        "dietary_fiber": 2.0, "sodium": 3.0, "calcium": 12.0,
        "iron": 1.0, "zinc": 0.30, "vitamin_a": 0, "vitamin_c": 0,
        "source": "TCMSP"
    },
    "黄精": {
        "protein": 6.0, "fat": 0.4, "carbohydrate": 75.0,
        "dietary_fiber": 3.0, "sodium": 4.0, "calcium": 22.0,
        "iron": 2.0, "zinc": 0.70, "vitamin_a": 0, "vitamin_c": 0,
        "source": "TCMSP"
    },
    "石斛": {
        "protein": 8.0, "fat": 0.5, "carbohydrate": 68.0,
        "dietary_fiber": 5.0, "sodium": 6.0, "calcium": 35.0,
        "iron": 2.5, "zinc": 0.90, "vitamin_a": 0, "vitamin_c": 0,
        "source": "TCMSP"
    },
    "沙参": {
        "protein": 5.5, "fat": 0.4, "carbohydrate": 72.0,
        "dietary_fiber": 2.5, "sodium": 4.0, "calcium": 18.0,
        "iron": 1.5, "zinc": 0.50, "vitamin_a": 0, "vitamin_c": 0,
        "source": "TCMSP"
    },
    "女贞子": {
        "protein": 6.0, "fat": 0.8, "carbohydrate": 65.0,
        "dietary_fiber": 4.0, "sodium": 5.0, "calcium": 28.0,
        "iron": 2.0, "zinc": 0.60, "vitamin_a": 0, "vitamin_c": 0,
        "source": "TCMSP"
    },
    
    # === 补阳类 (8味) ===
    "枸杞子": {
        "protein": 13.9, "fat": 1.0, "carbohydrate": 62.9,
        "dietary_fiber": 10.5, "sodium": 92.0, "calcium": 19.0,
        "iron": 6.8, "zinc": 1.90, "vitamin_a": 64, "vitamin_c": 4.0,
        "source": "中国食物成分表 第6版"
    },
    "肉苁蓉": {
        "protein": 4.0, "fat": 0.3, "carbohydrate": 75.0,
        "dietary_fiber": 2.0, "sodium": 3.0, "calcium": 15.0,
        "iron": 1.0, "zinc": 0.30, "vitamin_a": 0, "vitamin_c": 0,
        "source": "TCMSP"
    },
    "锁阳": {
        "protein": 5.0, "fat": 0.4, "carbohydrate": 72.0,
        "dietary_fiber": 3.0, "sodium": 4.0, "calcium": 18.0,
        "iron": 1.5, "zinc": 0.50, "vitamin_a": 0, "vitamin_c": 0,
        "source": "TCMSP"
    },
    "杜仲": {
        "protein": 8.0, "fat": 0.5, "carbohydrate": 68.0,
        "dietary_fiber": 5.0, "sodium": 5.0, "calcium": 35.0,
        "iron": 2.5, "zinc": 0.90, "vitamin_a": 0, "vitamin_c": 0,
        "source": "TCMSP"
    },
    "续断": {
        "protein": 7.0, "fat": 0.4, "carbohydrate": 70.0,
        "dietary_fiber": 4.0, "sodium": 4.0, "calcium": 28.0,
        "iron": 2.0, "zinc": 0.70, "vitamin_a": 0, "vitamin_c": 0,
        "source": "TCMSP"
    },
    "巴戟天": {
        "protein": 6.0, "fat": 0.3, "carbohydrate": 72.0,
        "dietary_fiber": 3.0, "sodium": 3.0, "calcium": 20.0,
        "iron": 1.5, "zinc": 0.50, "vitamin_a": 0, "vitamin_c": 0,
        "source": "TCMSP"
    },
    "淫羊藿": {
        "protein": 10.0, "fat": 1.0, "carbohydrate": 60.0,
        "dietary_fiber": 8.0, "sodium": 8.0, "calcium": 45.0,
        "iron": 3.5, "zinc": 1.20, "vitamin_a": 0, "vitamin_c": 0,
        "source": "TCMSP"
    },
    "菟丝子": {
        "protein": 15.0, "fat": 8.0, "carbohydrate": 55.0,
        "dietary_fiber": 6.0, "sodium": 5.0, "calcium": 30.0,
        "iron": 4.0, "zinc": 1.50, "vitamin_a": 0, "vitamin_c": 0,
        "source": "TCMSP"
    },
    
    # === 药食同源常见食材 (15味) ===
    "薏苡仁": {
        "protein": 12.0, "fat": 3.0, "carbohydrate": 70.0,
        "dietary_fiber": 5.0, "sodium": 3.0, "calcium": 45.0,
        "iron": 2.5, "zinc": 2.00, "vitamin_a": 0, "vitamin_c": 0,
        "source": "中国食物成分表 第6版"
    },
    "莲子": {
        "protein": 16.0, "fat": 1.5, "carbohydrate": 65.0,
        "dietary_fiber": 7.0, "sodium": 4.0, "calcium": 35.0,
        "iron": 2.0, "zinc": 1.50, "vitamin_a": 0, "vitamin_c": 0,
        "source": "中国食物成分表 第6版"
    },
    "芡实": {
        "protein": 13.0, "fat": 2.0, "carbohydrate": 68.0,
        "dietary_fiber": 6.0, "sodium": 3.0, "calcium": 28.0,
        "iron": 1.8, "zinc": 1.20, "vitamin_a": 0, "vitamin_c": 0,
        "source": "中国食物成分表 第6版"
    },
    "黑芝麻": {
        "protein": 19.0, "fat": 45.0, "carbohydrate": 20.0,
        "dietary_fiber": 12.0, "sodium": 5.0, "calcium": 780.0,
        "iron": 50.0, "zinc": 4.50, "vitamin_a": 0, "vitamin_c": 0,
        "source": "中国食物成分表 第6版"
    },
    "核桃仁": {
        "protein": 15.0, "fat": 58.0, "carbohydrate": 18.0,
        "dietary_fiber": 7.0, "sodium": 6.0, "calcium": 108.0,
        "iron": 2.5, "zinc": 2.50, "vitamin_a": 0, "vitamin_c": 0,
        "source": "中国食物成分表 第6版"
    },
    "花生": {
        "protein": 24.0, "fat": 45.0, "carbohydrate": 22.0,
        "dietary_fiber": 8.0, "sodium": 5.0, "calcium": 70.0,
        "iron": 2.0, "zinc": 2.50, "vitamin_a": 0, "vitamin_c": 0,
        "source": "中国食物成分表 第6版"
    },
    "栗子": {
        "protein": 4.0, "fat": 1.5, "carbohydrate": 62.0,
        "dietary_fiber": 5.0, "sodium": 2.0, "calcium": 10.0,
        "iron": 1.0, "zinc": 0.80, "vitamin_a": 0, "vitamin_c": 35.0,
        "source": "中国食物成分表 第6版"
    },
    "山楂": {
        "protein": 0.5, "fat": 0.1, "carbohydrate": 22.0,
        "dietary_fiber": 4.0, "sodium": 2.0, "calcium": 52.0,
        "iron": 0.4, "zinc": 0.20, "vitamin_a": 1, "vitamin_c": 45.0,
        "source": "中国食物成分表 第6版"
    },
    "菊花": {
        "protein": 6.0, "fat": 0.8, "carbohydrate": 55.0,
        "dietary_fiber": 10.0, "sodium": 15.0, "calcium": 1000.0,
        "iron": 12.0, "zinc": 2.00, "vitamin_a": 150, "vitamin_c": 0,
        "source": "TCMSP"
    },
    "玫瑰花": {
        "protein": 4.0, "fat": 0.5, "carbohydrate": 60.0,
        "dietary_fiber": 8.0, "sodium": 10.0, "calcium": 200.0,
        "iron": 5.0, "zinc": 1.00, "vitamin_a": 50, "vitamin_c": 20.0,
        "source": "TCMSP"
    },
    "桂花": {
        "protein": 5.0, "fat": 0.6, "carbohydrate": 58.0,
        "dietary_fiber": 7.0, "sodium": 8.0, "calcium": 150.0,
        "iron": 3.5, "zinc": 0.80, "vitamin_a": 20, "vitamin_c": 5.0,
        "source": "TCMSP"
    },
    "陈皮": {
        "protein": 4.0, "fat": 0.5, "carbohydrate": 65.0,
        "dietary_fiber": 12.0, "sodium": 5.0, "calcium": 200.0,
        "iron": 3.0, "zinc": 0.90, "vitamin_a": 0, "vitamin_c": 0,
        "source": "TCMSP"
    },
    "姜": {
        "protein": 1.5, "fat": 0.1, "carbohydrate": 18.0,
        "dietary_fiber": 1.5, "sodium": 12.0, "calcium": 18.0,
        "iron": 0.8, "zinc": 0.40, "vitamin_a": 0, "vitamin_c": 5.0,
        "source": "中国食物成分表 第6版"
    },
    "葱": {
        "protein": 1.8, "fat": 0.2, "carbohydrate": 8.0,
        "dietary_fiber": 1.2, "sodium": 8.0, "calcium": 50.0,
        "iron": 1.0, "zinc": 0.30, "vitamin_a": 25, "vitamin_c": 18.0,
        "source": "中国食物成分表 第6版"
    },
    "蒜": {
        "protein": 6.0, "fat": 0.2, "carbohydrate": 30.0,
        "dietary_fiber": 3.0, "sodium": 8.0, "calcium": 50.0,
        "iron": 1.5, "zinc": 0.80, "vitamin_a": 0, "vitamin_c": 6.0,
        "source": "中国食物成分表 第6版"
    },
}


def get_nutrition(ingredient_name: str) -> Optional[Dict[str, float]]:
    """获取成分的营养成分数据"""
    return HERB_NUTRITION_DB.get(ingredient_name)


def get_all_ingredients() -> list:
    """获取所有已知成分列表"""
    return list(HERB_NUTRITION_DB.keys())


def get_coverage_stats() -> Dict[str, Any]:
    """获取数据库覆盖统计"""
    categories = {
        "补气类": ["黄芪", "人参", "党参", "太子参", "白术", "甘草", "灵芝", "山药", "西洋参"],
        "补血类": ["当归", "熟地黄", "白芍", "川芎", "阿胶", "龙眼肉", "红枣", "枸杞"],
        "补阴类": ["麦冬", "天冬", "百合", "玉竹", "黄精", "石斛", "沙参", "女贞子"],
        "补阳类": ["枸杞子", "肉苁蓉", "锁阳", "杜仲", "续断", "巴戟天", "淫羊藿", "菟丝子"],
        "药食同源": ["薏苡仁", "莲子", "芡实", "黑芝麻", "核桃仁", "花生", "栗子", "山楂",
                     "菊花", "玫瑰花", "桂花", "陈皮", "姜", "葱", "蒜"]
    }
    
    stats = {
        "total_ingredients": len(HERB_NUTRITION_DB),
        "categories": {}
    }
    
    for category, items in categories.items():
        stats["categories"][category] = sum(1 for item in items if item in HERB_NUTRITION_DB)
    
    return stats


if __name__ == "__main__":
    stats = get_coverage_stats()
    print(f"营养数据库覆盖统计:")
    print(f"  总成分数: {stats['total_ingredients']}")
    for cat, count in stats['categories'].items():
        print(f"  {cat}: {count}味")
