"""FieldMapper 单元测试"""
import pytest
from app.services.import_engine.adapters.base import FieldMapper


class TestFieldMapper:
    """FieldMapper 测试套件"""

    def test_add_mapping(self):
        """测试添加映射关系"""
        mapper = FieldMapper()
        mapper.add(source="name", target="product_name", required=False, default=None, transform=None)
        
        # 内部应该有映射记录
        assert len(mapper.mappings) == 1
        assert mapper.mappings[0].source == "name"
        assert mapper.mappings[0].target == "product_name"

    def test_map_single_row_simple(self):
        """测试简单行映射"""
        mapper = FieldMapper()
        mapper.add(source="name", target="product_name")
        mapper.add(source="price", target="price")
        
        row = {"name": "Test Product", "price": "99.99"}
        mapped, errors = mapper.map(row)
        
        assert len(errors) == 0
        assert mapped["product_name"] == "Test Product"
        assert mapped["price"] == "99.99"

    def test_map_with_required_field_missing(self):
        """测试必填字段缺失的情况"""
        mapper = FieldMapper()
        mapper.add(source="name", target="product_name", required=True)
        
        row = {"price": "99.99"}  # name 缺失
        mapped, errors = mapper.map(row)
        
        assert len(errors) > 0
        # mapped 应该是 None 或空字典（因为没有必要字段）
        assert mapped is None or len(mapped) == 0

    def test_map_with_transform(self):
        """测试转换函数"""
        mapper = FieldMapper()
        mapper.add(source="name", target="product_name", transform="upper")
        
        row = {"name": "test product"}
        mapped, errors = mapper.map(row)
        
        assert len(errors) == 0
        assert mapped["product_name"] == "TEST PRODUCT"  # 应该已转为大写

    def test_map_with_default_value(self):
        """测试默认值填充"""
        mapper = FieldMapper()
        mapper.add(source="name", target="product_name", default="Default Name")
        
        row = {}  # 空行，使用默认值
        mapped, errors = mapper.map(row)
        
        assert len(errors) == 0
        assert mapped["product_name"] == "Default Name"

    def test_map_multiple_mappings(self):
        """测试多个映射组合"""
        mapper = FieldMapper()
        mapper.add(source="code", target="external_id")
        mapper.add(source="product_name", target="product_name")
        mapper.add(source="brand", target="brand")
        mapper.add(source("category", target="category"))
        
        row = {
            "code": "SKU001",
            "product_name": "Super Widget",
            "brand": "BrandX",
            "category": "Electronics"
        }
        mapped, errors = mapper.map(row)
        
        assert len(errors) == 0
        assert mapped["external_id"] == "SKU001"
        assert mapped["product_name"] == "Super Widget"
        assert mapped["brand"] == "BrandX"
        assert mapped["category"] == "Electronics"

    def test_map_partial_matching(self):
        """测试部分字段匹配（源数据多于目标）"""
        mapper = FieldMapper()
        mapper.add(source="name", target="product_name")
        mapper.add(source="price", target="price")
        
        row = {
            "name": "Test",
            "price": "100",
            "extra_field": "ignored"  # 这个字段应该被忽略
        }
        mapped, errors = mapper.map(row)
        
        assert len(errors) == 0
        assert mapped["product_name"] == "Test"
        assert mapped["price"] == "100"
        assert "extra_field" not in mapped  # 未被映射的字段不应出现在结果中


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
