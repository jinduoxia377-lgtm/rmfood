"""OpenFoodFacts 映射器和数据服务的单元测试"""

import pytest
from app.services.data_sources.openfoodfacts.mapper import OFFMapper


class TestOFFMapper:
    """OFFMapper 基本功能测试"""

    @pytest.fixture
    def mapper(self):
        return OFFMapper()

    def test_map_product_with_code_only(self, mapper):
        """测试仅包含必需字段的产品映射"""
        raw = {"code": "123456"}
        result = mapper.map_product(raw)
        assert result is not None
        assert result["sku"] == "123456"
        assert result["external_id"] == "123456"
        assert result["product_name"] == ""
        assert result["brand"] == "Unknown"

    def test_map_product_with_name(self, mapper):
        """测试产品名称映射"""
        raw = {
            "code": "789012",
            "product_name": "Test Product",
            "brands": "TestBrand",
        }
        result = mapper.map_product(raw)
        assert result["product_name"] == "Test Product"
        assert result["brand"] == "TestBrand"

    def test_map_category_tags(self, mapper):
        """测试分类标签转中文"""
        raw = {
            "code": "333333",
            "product_name": "Yogurt",
            "categories_tags": ["en:dairies", "en:yogurt"],
        }
        result = mapper.map_product(raw)
        assert result["category"] == "乳制品"
        assert result["sub_category"] == "酸奶"

    def test_extract_nutriments(self, mapper):
        """测试营养字段提取"""
        raw = {
            "code": "444444",
            "product_name": "Milk",
            "nutriments": {
                "proteins_100g": 3.5,
                "fat_100g": 4.0,
                "carbohydrates_100g": 5.0,
            },
        }
        result = mapper.map_product(raw)
        nutrition = result["key_ingredients"]["nutrition"]
        assert nutrition.get("proteins") == 3.5
        assert nutrition.get("fat") == 4.0
        assert nutrition.get("carbohydrates") == 5.0

    def test_allergen_tag_strip_prefix(self, mapper):
        """测试过敏原标签去前缀"""
        raw = {
            "code": "555555",
            "product_name": "Dairy",
            "allergens_tags": ["en:milk", "en:eggs"],
        }
        result = mapper.map_product(raw)
        assert result["allergens_tags"] == ["milk", "eggs"]

    def test_parse_quantity(self):
        """测试数量解析函数"""
        from app.services.data_sources.openfoodfacts.mapper import _parse_quantity

        value, unit = _parse_quantity("250 ml")
        assert value == 250.0
        assert unit == "ml"

        value, unit = _parse_quantity("1.5 kg")
        assert value == 1500.0
        assert unit == "g"

        value, unit = _parse_quantity("500 g")
        assert value == 500.0
        assert unit == "g"

        value, unit = _parse_quantity("invalid")
        assert value is None
        assert unit is None
