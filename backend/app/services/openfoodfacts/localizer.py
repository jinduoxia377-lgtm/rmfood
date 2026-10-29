"""
OFF 数据中文本地化

将 OFF 英文分类/标签映射为中国食品标准分类。
"""
import json
import logging
import os
from typing import Dict, List, Optional

from .config import OFFConfig

logger = logging.getLogger(__name__)

# 默认分类映射表 (OFF categories_tags → 中文)
DEFAULT_CATEGORY_MAP = {
    # 饮料类
    "beverages": "饮料",
    "soft-drinks": "软饮料",
    "juices": "果汁",
    "fruit-juices": "果汁",
    "vegetable-juices": "蔬菜汁",
    "carbonated-drinks": "碳酸饮料",
    "tea": "茶饮料",
    "coffee": "咖啡饮料",
    "energy-drinks": "能量饮料",
    "sport-drinks": "运动饮料",
    "water": "饮用水",
    "mineral-water": "矿泉水",
    "sparkling-water": "气泡水",
    "milk": "乳制品",
    "dairy-products": "乳制品",
    "yogurt": "酸奶",
    "plant-based-milk": "植物奶",
    "almond-milk": "杏仁奶",
    "soy-milk": "豆奶",
    "oat-milk": "燕麦奶",

    # 谷物类
    "breakfast-cereals": "早餐谷物",
    "cereal-grains": "谷物",
    "bread": "面包",
    "pastries": "糕点",
    "cakes": "蛋糕",
    "cookies": "饼干",
    "crackers": "薄脆饼干",
    "pasta": "意面",
    "rice": "米饭",

    # 零食类
    "snacks": "零食",
    "chips": "薯片",
    "nuts": "坚果",
    "seeds": "种子",
    "popcorn": "爆米花",
    "chocolate": "巧克力",
    "candy": "糖果",
    "gum": "口香糖",
    "ice-cream": "冰淇淋",
    "frozen-desserts": "冷冻甜点",

    # 蔬果类
    "fruits": "水果",
    "vegetables": "蔬菜",
    "dried-fruits": "果干",
    "dried-vegetables": "蔬干",
    "canned-fruits": "罐头水果",
    "canned-vegetables": "罐头蔬菜",
    "salads": "沙拉",
    "hummus": "鹰嘴豆泥",

    # 肉类
    "meat": "肉类",
    "poultry": "禽类",
    "beef": "牛肉",
    "pork": "猪肉",
    "lamb": "羊肉",
    "sausages": "香肠",
    "deli-meat": "熟食肉",
    "bacon": "培根",

    # 水产
    "fish": "鱼类",
    "seafood": "海鲜",
    "shrimp": "虾",
    "crab": "蟹",
    "canned-fish": "罐装鱼类",

    # 调味
    "condiments": "调味品",
    "sauces": "酱料",
    "dressings": "沙拉酱",
    "mustard": "芥末",
    "ketchup": "番茄酱",
    "soy-sauce": "酱油",
    "vinegar": "醋",
    "honey": "蜂蜜",
    "jam": "果酱",
    "nut-butter": "坚果酱",

    # 其他
    "baby-food": "婴幼儿食品",
    "dietetic-foods": "保健食品",
    "weight-management": "体重管理",
    "supplements": "营养补充剂",
    "protein-supplements": "蛋白补充剂",
    "vitamins": "维生素",
    "minerals": "矿物质",
    "probiotics": "益生菌",
    "soups": "汤类",
    "stock": "高汤",
    "ready-meals": "即食餐",
    "frozen-meals": "冷冻餐",
    "pizza": "披萨",
    "frozen-vegetables": "冷冻蔬菜",
    "frozen-fruits": "冷冻水果",
    "tofu": "豆腐",
    "tempeh": "天贝",
    "seitan": "面筋",
    "vegan": "纯素食品",
    "vegetarian": "素食",
    "organic": "有机食品",
}

# 剂型关键词
FORMULATION_KEYWORDS = {
    "drink": "饮料",
    "beverage": "饮料",
    "juice": "果汁",
    "tablet": "片剂",
    "capsule": "胶囊",
    "powder": "粉剂",
    "bar": "棒状",
    "gummy": "软糖",
    "liquid": "口服液",
    "cream": "乳霜",
    "paste": "膏状",
    "oil": "油剂",
    "pill": "丸剂",
    "spray": "喷雾",
    "drop": "滴剂",
    "candy": "糖果",
    "chocolate": "巧克力",
    "cookie": "饼干",
    "bread": "面包",
    "soup": "汤类",
    "cereal": "谷物",
    "yogurt": "酸奶",
    "milk": "乳制品",
    "cheese": "奶酪",
    "snack": "零食",
    "protein": "蛋白饮品",
    "smoothie": "冰沙",
    "tea": "茶",
    "coffee": "咖啡",
    "water": "饮用水",
}


class OFFLocalizer:
    """OFF 数据中文本地化"""

    def __init__(self, category_map: Dict[str, str] = None):
        self.category_map = category_map or DEFAULT_CATEGORY_MAP.copy()
        self._load_custom_map()

    def _load_custom_map(self):
        """尝试从 category_map.json 加载自定义映射"""
        map_path = os.path.join(
            os.path.dirname(__file__), "category_map.json"
        )
        if os.path.exists(map_path):
            try:
                with open(map_path, "r", encoding="utf-8") as f:
                    custom = json.load(f)
                self.category_map.update(custom)
                logger.info(f"[Localizer] 加载自定义分类映射: {len(custom)} 条")
            except Exception as e:
                logger.warning(f"[Localizer] 加载自定义映射失败: {e}")

    def map_category_to_chinese(self, off_tag: str) -> str:
        """
        将 OFF 分类标签映射为中文

        Args:
            off_tag: 如 "beverages", "en:fruit-juices"

        Returns:
            中文分类，找不到则返回原始标签
        """
        if not off_tag:
            return "其他"

        # 清理前缀 (如 "en:fruit-juices" → "fruit-juices")
        tag = off_tag.split(":")[-1].lower().strip()
        tag = tag.replace("_", "-")

        # 精确匹配
        if tag in self.category_map:
            return self.category_map[tag]

        # 部分匹配
        for key, value in self.category_map.items():
            if key in tag or tag in key:
                return value

        # 回退: 将 hyphen 转中文
        return tag.replace("-", " ").title() or "其他"

    def derive_formulation_type(self, categories_tags: List[str]) -> Optional[str]:
        """
        从分类标签推导剂型

        Args:
            categories_tags: OFF categories_tags 列表

        Returns:
            中文剂型或 None
        """
        if not categories_tags:
            return None

        tags_str = " ".join(categories_tags).lower()

        for keyword, cn_type in FORMULATION_KEYWORDS.items():
            if keyword in tags_str:
                return cn_type

        return None

    def is_china_available(self, countries_str: str) -> bool:
        """
        判断产品是否在中国销售

        Args:
            countries_str: OFF countries 字段值

        Returns:
            True if 中国相关产品
        """
        if not countries_str:
            return False

        countries_lower = countries_str.lower()
        keywords = OFFConfig.CHINA_COUNTRY_KEYWORDS

        for kw in keywords:
            if kw.lower() in countries_lower:
                return True

        return False

    def translate_product_name(self, name: str, lang: str = None) -> str:
        """
        产品名称翻译 (占位实现)

        Phase 1: 接受英文/原文，标记需要翻译
        Phase 2: 集成 LLM 翻译

        Args:
            name: 原始产品名称
            lang: 期望目标语言

        Returns:
            翻译后的名称 (目前返回原文)
        """
        if not name:
            return ""

        # Phase 1: 如果已有中文名直接使用
        if any('一' <= c <= '鿿' for c in name):
            return name

        # Phase 2: 标记需要翻译
        # TODO: 集成 LLM 翻译
        return name

    def get_chinese_nutrition_labels(self) -> Dict[str, str]:
        """
        获取中国 GB 28050 营养标签名称

        Returns:
            {OFF字段名: 中文标签名}
        """
        return {
            "energy_kj": "能量",
            "proteins_g": "蛋白质",
            "fats_g": "脂肪",
            "carbs_g": "碳水化合物",
            "sugars_g": "糖",
            "fiber_g": "膳食纤维",
            "sodium_mg": "钠",
            "salt_g": "盐",
            "saturated_fat_g": "饱和脂肪酸",
        }
