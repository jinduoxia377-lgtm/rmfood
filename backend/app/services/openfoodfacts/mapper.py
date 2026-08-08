"""
Open Food Facts → RMFOOD 字段映射器

将 OFF 原始产品数据转换为 retail_products 表所需的格式。
"""
import logging
import re
from typing import Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)


class OFFMapper:
    """OFF 数据 → retail_products 字段映射"""

    # Nutriments 提取字段 (per 100g)
    NUTRITION_FIELDS = {
        "energy-kj_100g": "energy_kj",
        "energy-kcal_100g": "energy_kcal",
        "proteins_100g": "proteins_g",
        "fat_100g": "fats_g",
        "saturated-fat_100g": "saturated_fat_g",
        "carbohydrates_100g": "carbs_g",
        "sugars_100g": "sugars_g",
        "fiber_100g": "fiber_g",
        "sodium_100g": "sodium_mg",
        "salt_100g": "salt_g",
        "cholesterol_100g": "cholesterol_mg",
        "trans-fat_100g": "trans_fat_g",
        "monounsaturated-fat_100g": "mono_unsat_fat_g",
        "polyunsaturated-fat_100g": "poly_unsat_fat_g",
        "vitamin_a_100g": "vitamin_a_iu",
        "vitamin_c_100g": "vitamin_c_mg",
        "vitamin_e_100g": "vitamin_e_mg",
        "vitamin_d_100g": "vitamin_d_mcg",
        "vitamin_d3_100g": "vitamin_d3_mcg",
        "vitamin_b12_100g": "vitamin_b12_mcg",
        "calcium_100g": "calcium_mg",
        "iron_100g": "iron_mg",
        "potassium_100g": "potassium_mg",
        "zinc_100g": "zinc_mg",
        "caffeine_100g": "caffeine_mg",
        "taurine_100g": "taurine_mg",
        "omega-3-fats_100g": "omega3_fats_g",
        "omega-6-fats_100g": "omega6_fats_g",
        "phg": "egcg_mg",
        "serving-size": "serving_size",
    }

    # 剂型关键词映射
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

    def map_product(self, raw_off: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        将 OFF 原始产品数据映射为 retail_products 行数据

        Args:
            raw_off: OFF 原始产品 JSON

        Returns:
            映射后的 dict，校验失败返回 None
        """
        # ── 必填字段校验 ──
        barcode = raw_off.get("code") or raw_off.get("product_id")
        product_name = raw_off.get("product_name") or raw_off.get("generic_name")

        if not barcode or not product_name:
            logger.debug(f"[Mapper] 跳过无条码/名称的产品: {raw_off.get('product_name', 'UNKNOWN')}")
            return None

        # ── 品牌 ──
        brands = raw_off.get("brands", "")
        brand = self._extract_first_brand(brands)

        # ── 分类 ──
        categories_tags = raw_off.get("categories_tags", [])
        if isinstance(categories_tags, str):
            categories_tags = [t.strip() for t in categories_tags.split(",")]

        category = self._derive_category(categories_tags)
        sub_category = self._derive_sub_category(categories_tags)
        product_line = " / ".join(categories_tags[:3]) if categories_tags else None
        formulation_type = self._derive_formulation_type(categories_tags)

        # ── 配料 ──
        full_ingredients = raw_off.get("ingredients_text") or raw_off.get("ingredients_text_zh")

        # ── 营养成分 ──
        nutriments = raw_off.get("nutriments", {})
        key_ingredients = self._extract_nutriments(nutriments)

        # ── 数量解析 ──
        quantity = raw_off.get("quantity", "")
        volume_ml, weight_g = self._parse_quantity(quantity)

        # ── 图片 ──
        image_urls = self._extract_images(raw_off)

        # ── 国家/销售区域 ──
        countries = raw_off.get("countries", "")
        countries_tags = raw_off.get("countries_tags", [])
        if isinstance(countries_tags, str):
            countries_tags = [c.strip() for c in countries_tags.split(",")]

        # ── 时间戳 ──
        last_modified_t = raw_off.get("last_modified_t")
        crawl_timestamp = self._parse_timestamp(last_modified_t)

        # ── 数据质量评分 ──
        data_quality = self._calculate_quality(raw_off, {
            "product_name": bool(product_name),
            "brand": bool(brand),
            "category": bool(category),
            "ingredients": bool(full_ingredients),
            "nutriments": bool(nutriments),
            "images": bool(image_urls),
        })

        # ── 过敏原/添加剂/生态评分 ──
        allergens_tags = raw_off.get("allergens_tags") or []
        if isinstance(allergens_tags, str):
            allergens_tags = [t.strip() for t in allergens_tags.split(",")]
        additives_tags = raw_off.get("additives_tags") or []
        if isinstance(additives_tags, str):
            additives_tags = [t.strip() for t in additives_tags.split(",")]
        ecoscore_grade = raw_off.get("ecoscore_grade")
        traces_tags = raw_off.get("traces_tags") or []
        if isinstance(traces_tags, str):
            traces_tags = [t.strip() for t in traces_tags.split(",")]
        contaminants = raw_off.get("contaminants_tags") or []
        if isinstance(contaminants, str):
            contaminants = [t.strip() for t in contaminants.split(",")]

        return {
            "external_id": str(barcode).strip(),
            "sku": str(barcode).strip(),
            "brand": brand or "Unknown",
            "product_name": str(product_name).strip(),
            "product_line": product_line,
            "category": category,
            "sub_category": sub_category,
            "formulation_type": formulation_type,
            "effects": self._extract_effects(raw_off),
            "target_population": [],
            "full_ingredients": full_ingredients,
            "key_ingredients": key_ingredients,
            "price": None,
            "currency": "CNY",
            "package_size": quantity or None,
            "volume_ml": volume_ml,
            "weight_g": weight_g,
            "sales_channels": raw_off.get("stores_tags") or [],
            "avg_rating": None,
            "review_count": None,
            "monthly_sales": None,
            "image_urls": image_urls,
            "reg_type": None,
            "approved_region": None,
            "allergens_tags": allergens_tags,
            "additives_tags": additives_tags,
            "ecoscore_grade": str(ecoscore_grade) if ecoscore_grade else None,
            "traces_tags": traces_tags,
            "contaminants": contaminants,
            "source": "openfoodfacts",
            "crawl_timestamp": crawl_timestamp,
            "data_quality": data_quality,
        }

    # ── 私有方法 ──

    def _extract_first_brand(self, brands_str: str) -> Optional[str]:
        """提取第一个品牌名"""
        if not brands_str:
            return None
        brands = [b.strip() for b in brands_str.split(",")]
        return brands[0] if brands[0] else None

    def _derive_category(self, categories_tags: list) -> Optional[str]:
        """从 categories_tags 推导主分类"""
        if not categories_tags:
            return None
        # 取第一级分类 (去掉 "en:" 前缀)
        top = categories_tags[0]
        top = re.sub(r"^en:", "", top)
        top = top.replace("-", " ").title()
        return top

    def _derive_sub_category(self, categories_tags: list) -> Optional[str]:
        """推导子分类"""
        if len(categories_tags) < 2:
            return None
        sub = categories_tags[1]
        sub = re.sub(r"^en:", "", sub)
        sub = sub.replace("-", " ").title()
        return sub

    def _derive_formulation_type(self, categories_tags: list) -> Optional[str]:
        """从分类推导剂型"""
        tags_str = " ".join(categories_tags).lower()
        for keyword, cn_type in self.FORMULATION_KEYWORDS.items():
            if keyword in tags_str:
                return cn_type
        return None

    def _extract_nutriments(self, nutriments: dict) -> Dict[str, Any]:
        """从 nutriments 提取关键营养成分"""
        if not nutriments:
            return {}

        result = {}
        for off_key, rm_key in self.NUTRITION_FIELDS.items():
            val = nutriments.get(off_key)
            if val is not None and val > 0:
                result[rm_key] = round(float(val), 4)

        # Nutri-Score
        nutri_score = nutriments.get("nutrition-score-fr") or nutriments.get("nutrition_grade_fr")
        if nutri_score:
            result["nutri_score"] = str(nutri_score).upper()

        # NOVA Group
        nova = nutriments.get("nova-group") or nutriments.get("nova_group")
        if nova:
            result["nova_group"] = int(nova)

        # Additives count
        additives_n = nutriments.get("additives_n")
        if additives_n:
            result["additives_count"] = int(additives_n)

        return result

    def _extract_images(self, raw_off: dict) -> list:
        """提取产品图片 URL"""
        urls = []
        for prefix in ["image_front", "image_ingredients", "image_nutrition", "image_packaging"]:
            url = raw_off.get(f"{prefix}_url") or raw_off.get(f"{prefix}")
            if url:
                # OFF 图片 URL 可能有多个尺寸 (_small, _front 等)
                url = url.strip()
                if url.startswith("//"):
                    url = "https:" + url
                urls.append(url)
        return urls[:5]  # 最多 5 张

    def _extract_effects(self, raw_off: dict) -> list:
        """从 labels/tags 推导功效标签"""
        effects = []

        labels_tags = raw_off.get("labels_tags", [])
        if isinstance(labels_tags, str):
            labels_tags = [l.strip() for l in labels_tags.split(",")]

        effect_mapping = {
            "no-added-sugar": "低糖",
            "sugar-free": "无糖",
            "low-fat": "低脂",
            "fat-free": "无脂",
            "high-fibre": "高纤维",
            "fibre-rich": "富含纤维",
            "high-protein": "高蛋白",
            "protein-rich": "富含蛋白",
            "organic": "有机",
            "vegan": "纯素",
            "vegetarian": "素食",
            "gluten-free": "无麸质",
            "fortified": "强化营养",
            "enriched": "营养强化",
            "probiotic": "益生菌",
            "prebiotic": "益生元",
        }

        for tag in labels_tags:
            tag_lower = tag.lower().replace("-", "_")
            if tag_lower in effect_mapping:
                effects.append(effect_mapping[tag_lower])

        return effects[:10]

    def _parse_timestamp(self, ts) -> Optional[str]:
        """解析 UNIX 时间戳为 ISO 字符串"""
        if not ts:
            return None
        try:
            from datetime import datetime, timezone
            dt = datetime.fromtimestamp(int(ts), tz=timezone.utc)
            return dt.isoformat()
        except (ValueError, TypeError, OSError):
            return None

    def _derive_approved_region(self, countries_str: str) -> Optional[str]:
        """从 countries 字段推导批准地区"""
        if not countries_str:
            return None
        countries_lower = countries_str.lower()
        if "china" in countries_lower or "chinese" in countries_lower:
            return "中国大陆"
        if "hong kong" in countries_lower:
            return "香港"
        if "taiwan" in countries_lower:
            return "台湾"
        if "macau" in countries_lower:
            return "澳门"
        return None

    def _calculate_quality(self, raw_off: dict, field_checks: dict) -> float:
        """
        计算数据质量评分 (0.0 - 1.0)

        基于关键字段的存在性和完整性。
        """
        total_checks = len(field_checks)
        if total_checks == 0:
            return 0.0

        passed = sum(1 for v in field_checks.values() if v)

        # 额外加分: nutriments 字段数量
        nutriments = raw_off.get("nutriments", {})
        if nutriments:
            try:
                nutrient_count = sum(1 for v in nutriments.values() if v is not None and float(v) > 0)
                if nutrient_count > 5:
                    passed += 1  # 营养数据完整加分
            except (TypeError, ValueError):
                pass  # nutriments 数据格式异常，跳过

        score = passed / total_checks
        return round(min(score, 1.0), 2)

    @staticmethod
    def _parse_quantity(qty_str: str) -> Tuple[Optional[float], Optional[float]]:
        """解析产品数量描述"""
        if not qty_str:
            return None, None

        vol_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:ml|milliliter|liter)", qty_str, re.I)
        weight_match = re.search(r"(\d+(?:\.\d+)?)\s*g(?:ram)?(?:s)?\b", qty_str, re.I)

        volume = float(vol_match.group(1)) if vol_match else None
        weight = float(weight_match.group(1)) if weight_match else None

        # 处理 "30 x 10ml"
        mult_match = re.search(r"(\d+)\s*x\s*(\d+(?:\.\d+)?)\s*(ml|g)", qty_str, re.I)
        if mult_match:
            multiplier = float(mult_match.group(1))
            amount = float(mult_match.group(2))
            unit = mult_match.group(3).lower()
            if unit in ("ml", "milliliter"):
                volume = amount * multiplier
            elif unit == "g":
                weight = amount * multiplier

        return volume, weight
