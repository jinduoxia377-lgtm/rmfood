"""OpenFoodFacts 映射器和数据服务的集成测试"""

import pytest
from app.services.data_sources.openfoodfacts.mapper import OFFMapper, _parse_quantity


class TestOFFMapperIntegration:
    """OFFMapper 端到端映射测试"""

    @pytest.fixture
    def mapper(self):
        return OFFMapper()

    def test_map_complete_product(self, mapper):
        """测试完整产品数据的映射"""
        raw = {
            "code": "5000159103625",
            "product_name": "Yaourt Nature",
            "product_name_en": "Natural Yogurt",
            "brands": "Yoplait",
            "categories_tags": ["en:dairies", "en:fermented-milk-products", "en:yogurt"],
            "quantity": "125 g",
            "ingredients_text": "Lait pasteurise, Ferments lactiques",
            "nutriments": {
                "proteins_100g": 4.0,
                "fat_100g": 3.2,
                "carbohydrates_100g": 4.6,
                "sugars_100g": 4.6,
            },
            "allergens_tags": ["en:milk"],
            "additives_tags": [],
            "ecoscore_grade": "a",
            "image_front_url": "https://images.openfoodfacts.org/images/products/500/015/910/3625/front_en.123.400.jpg",
            "stores": "Carrefour, Leclerc",
            "nova_group": 3,
            "nutrition_grades": "b",
            "completeness": 0.9,
        }
        result = mapper.map_product(raw)

        assert result is not None
        assert result["sku"] == "5000159103625"
        assert result["product_name"] == "Yaourt Nature"
        assert result["brand"] == "Yoplait"
        assert result["category"] == "乳制品"
        assert result["sub_category"] == "发酵乳制品"
        assert result["allergens_tags"] == ["milk"]
        assert result["additives_tags"] == []
        assert result["ecoscore_grade"] == "a"
        assert "Carrefour" in result["sales_channels"]
        assert "Leclerc" in result["sales_channels"]
        assert result["key_ingredients"]["nutrition"]["proteins"] == 4.0
        assert result["key_ingredients"]["nova_group"] == 3
        assert result["key_ingredients"]["nutrition_grade"] == "b"
        assert result["data_quality"] == 0.9

    def test_map_product_with_chinese_name(self, mapper):
        """测试中文产品名称优先级"""
        raw = {
            "code": "123456",
            "product_name_zh": "胶原蛋白肽口服液",
            "product_name_en": "Collagen Peptide Drink",
            "product_name": "Produit Collagene",
            "brands": "BrandX",
            "categories_tags": [],
            "nutriments": {},
        }
        result = mapper.map_product(raw)
        assert result is not None
        assert result["product_name"] == "胶原蛋白肽口服液"

    def test_map_empty_product_returns_none(self, mapper):
        """测试空产品返回 None"""
        assert mapper.map_product({}) is None
        assert mapper.map_product(None) is None

    def test_parse_quantity_ml(self):
        """测试容量解析"""
        value, unit = _parse_quantity("500 ml")
        assert value == 500.0
        assert unit == "ml"

    def test_parse_quantity_kg_to_g(self):
        """测试千克转克"""
        value, unit = _parse_quantity("1.5 kg")
        assert value == 1500.0
        assert unit == "g"

    def test_batch_mapping(self, mapper):
        """测试批量映射"""
        raw_list = [
            {"code": "111", "product_name": "Product A", "brands": "BrandA", "categories_tags": [], "nutriments": {}},
            {},  # invalid
            None,  # invalid
            {"code": "222", "product_name": "Product B", "brands": "BrandB", "categories_tags": [], "nutriments": {}},
        ]
        results = mapper.map_products(raw_list)
        assert len(results) == 2
        assert results[0]["sku"] == "111"
        assert results[1]["sku"] == "222"
