"""OpenFoodFacts 数据映射器

将 OFF API 原始响应转换为 RMFOORM 统一产品格式。

对标 OFF 官方 Product Schema:
https://world.openfoodfacts.org/api/v2
"""

import logging
import re
from typing import Any, Optional

logger = logging.getLogger(__name__)

# 核心营养素字段列表（per 100g）
CORE_NUTRIENTS = [
    "energy-kcal", "proteins", "fat", "carbohydrates",
    "sugars", "fiber", "sodium", "salt", "saturated-fat",
    "added-sugars",
]

# OFF 分类标签 -> 中文名称映射
CATEGORY_NAME_MAP: dict[str, str] = {
    "en:beverages": "饮料", "en:soft-drinks": "软饮料", "en:juices": "果汁",
    "en:fruit-juices": "果汁", "en:tea": "茶饮料", "en:coffee": "咖啡饮料",
    "en:energy-drinks": "能量饮料", "en:water": "饮用水",
    "en:mineral-water": "矿泉水", "en:sparkling-water": "气泡水",
    "en:dairies": "乳制品", "en:fermented-foods": "发酵食品",
    "en:fermented-milk-products": "发酵乳制品", "en:cheeses": "奶酪",
    "en:yogurt": "酸奶", "en:plant-based-milk": "植物奶",
    "en:almond-milk": "杏仁奶", "en:soy-milk": "豆奶", "en:oat-milk": "燕麦奶",
    "en:breakfast-cereals": "早餐谷物", "en:bread": "面包",
    "en:pasta": "意面", "en:rice": "米饭",
    "en:snacks": "零食", "en:nuts": "坚果", "en:seeds": "种子",
    "en:chocolate": "巧克力", "en:candy": "糖果", "en:ice-cream": "冰淇淋",
    "en:fruits": "水果", "en:vegetables": "蔬菜",
    "en:dried-fruits": "果干", "en:canned-fruits": "罐头水果",
    "en:canned-vegetables": "罐头蔬菜",
    "en:meat": "肉类", "en:poultry": "禽类", "en:beef": "牛肉",
    "en:pork": "猪肉", "en:sausages": "香肠",
    "en:fish": "鱼类", "en:seafood": "海鲜", "en:shrimp": "虾",
    "en:condiments": "调味品", "en:sauces": "酱料",
    "en:honey": "蜂蜜", "en:jam": "果酱",
    "en:dietetic-foods": "保健食品", "en:supplements": "营养补充剂",
    "en:vitamins": "维生素", "en:probiotics": "益生菌",
    "en:vegan": "纯素食品", "en:organic": "有机食品",
    "en:baby-food": "婴幼儿食品", "en:frozen-meals": "冷冻餐",
}


def _strip_en_prefix(tag: str) -> str:
    """去掉 'en:' 前缀"""
    return tag[3:] if tag.startswith("en:") else tag


def _parse_quantity(qty_str: str) -> tuple[Optional[float], Optional[str]]:
    """解析 quantity 字符串，返回 (数值, 单位)"""
    if not qty_str:
        return None, None
    m = re.match(r"(\d+(?:\.\d+)?)\s*(ml|g|kg|mg|l|oz|lb|pack|box|can|bottle|piece)?", qty_str.strip(), re.IGNORECASE)
    if m:
        value = float(m.group(1))
        unit = (m.group(2) or "").lower()
        if unit == "kg":
            return value * 1000, "g"
        if unit == "mg":
            return value / 1000, "g"
        if unit == "l":
            return value * 1000, "ml"
        return value, unit or None
    return None, None


class OFFMapper:
    """OpenFoodFacts -> RMFOORM 产品数据映射器"""

    def map_product(self, raw: dict[str, Any]) -> Optional[dict[str, Any]]:
        """将单个 OFF 产品原始数据映射为 RMFOORM 统一格式。"""
        if not raw or not isinstance(raw, dict):
            return None

        product_code = raw.get("code")
        if not product_code:
            return None

        # 产品名称（优先中文 > 原始名称 > 英文）
        product_name = (
            raw.get("product_name_zh")
            or raw.get("product_name")
            or raw.get("product_name_en")
            or ""
        )

        brand = raw.get("brands") or "Unknown"

        # 分类
        categories_tags = raw.get("categories_tags") or []
        category_cn = self._resolve_category(categories_tags, level=0)
        sub_category_cn = self._resolve_category(categories_tags, level=1)

        package_size = raw.get("quantity")
        volume_ml = None
        weight_g = None
        if package_size:
            vol, _ = _parse_quantity(package_size)
            if vol is not None:
                volume_ml = vol

        # 完整成分表
        full_ingredients = (
            raw.get("ingredients_text_zh")
            or raw.get("ingredients_text_en")
            or raw.get("ingredients_text")
        )

        # 营养成分
        key_ingredients = self._extract_nutriments(raw.get("nutriments", {}))

        # 食品安全
        allergens = [_strip_en_prefix(t) for t in (raw.get("allergens_tags") or [])]
        additives = [_strip_en_prefix(t) for t in (raw.get("additives_tags") or [])]
        traces = [_strip_en_prefix(t) for t in (raw.get("traces_tags") or [])]

        ecoscore_grade = raw.get("ecoscore_grade")

        # 图片
        image_urls = self._collect_images(raw)

        # 销售渠道
        sales_channels = [
            s.strip() for s in (raw.get("stores") or "").split(",") if s.strip()
        ]

        # NOVA 分组
        nova_group = raw.get("nova_group")
        if nova_group:
            key_ingredients["nova_group"] = int(nova_group)

        # 营养等级
        nutriscore = raw.get("nutriscore_grade") or raw.get("nutrition_grades")
        if nutriscore:
            key_ingredients["nutrition_grade"] = nutriscore

        # 标签
        labels = [l.strip() for l in (raw.get("labels") or "").split(",") if l.strip()]
        if labels:
            key_ingredients["labels"] = labels

        # 销售地区
        countries = [c.strip() for c in (raw.get("countries") or "").split(",") if c.strip()]
        if countries:
            key_ingredients["countries"] = countries

        serving_size = raw.get("serving_size")
        if serving_size:
            key_ingredients["serving_size"] = serving_size

        completeness = raw.get("completeness")
        data_quality = float(completeness) if completeness else 0.5

        return {
            "external_id": str(product_code),
            "sku": str(product_code),
            "brand": brand,
            "product_name": product_name,
            "product_line": None,
            "category": category_cn or None,
            "sub_category": sub_category_cn or None,
            "formulation_type": None,
            "effects": [],
            "target_population": [],
            "full_ingredients": full_ingredients,
            "key_ingredients": key_ingredients,
            "price": None,
            "currency": "CNY",
            "package_size": package_size,
            "volume_ml": volume_ml,
            "weight_g": weight_g,
            "sales_channels": sales_channels,
            "avg_rating": None,
            "review_count": None,
            "monthly_sales": None,
            "image_urls": image_urls,
            "reg_number": None,
            "reg_type": None,
            "approved_region": None,
            "allergens_tags": allergens,
            "additives_tags": additives,
            "ecoscore_grade": ecoscore_grade,
            "traces_tags": traces,
            "contaminants": [],
            "source": "openfoodfacts_api",
            "data_quality": data_quality,
            "crawl_timestamp": None,
            "created_at": None,
            "updated_at": None,
        }

    def map_products(self, raw_list: list[dict[str, Any]]) -> list[dict[str, Any]]:
        """批量映射产品列表"""
        results = []
        for raw in raw_list:
            mapped = self.map_product(raw)
            if mapped:
                results.append(mapped)
        return results

    # ── 私有方法 ──

    def _resolve_category(self, tags: list[str], level: int = 0) -> Optional[str]:
        """将 OFF 分类标签解析为中文名称"""
        if level >= len(tags):
            return None
        tag = tags[level]
        name = CATEGORY_NAME_MAP.get(tag)
        if name:
            return name
        clean_tag = _strip_en_prefix(tag)
        return clean_tag.replace("-", " ").title() or None

    def _extract_nutriments(self, nutriments: dict[str, Any]) -> dict[str, Any]:
        """从 nutriments 提取核心营养素（per 100g）"""
        result: dict[str, Any] = {"nutrition": {}}
        nutr = nutriments or {}
        for nutrient in CORE_NUTRIENTS:
            key_100g = f"{nutrient}_100g"
            value = nutr.get(key_100g)
            if value is None or value == 0:
                value = nutr.get(nutrient)
            if value is not None:
                try:
                    result["nutrition"][nutrient] = float(value)
                except (ValueError, TypeError):
                    pass
        return result

    def _collect_images(self, raw: dict[str, Any]) -> list[str]:
        """收集所有产品图片 URL"""
        images: list[str] = []
        prefixes = ("front", "ingredients", "nutrition", "packaging", "other")
        for prefix in prefixes:
            url = raw.get(f"image_{prefix}_url")
            if url:
                images.append(url)
        return images[:5]
