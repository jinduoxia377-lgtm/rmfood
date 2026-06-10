"""术语数据库测试脚本"""
import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.terminology import Term, TermCategory, TermNormalizationRule
from app.services.terminology_service import TerminologyService
from app.services.term_normalization_pipeline import ComprehensiveTermPipeline

# 创建数据库连接
db_url = settings.database_url
if 'aiosqlite' in db_url:
    db_url = db_url.replace('+aiosqlite', '')
engine = create_engine(db_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def test_database_counts():
    """测试数据库数据量"""
    db = SessionLocal()
    
    print("📊 数据库统计信息:")
    cat_count = db.query(TermCategory).count()
    term_count = db.query(Term).count()
    rule_count = db.query(TermNormalizationRule).count()
    
    print(f"  - 术语分类: {cat_count} 个")
    print(f"  - 专业术语: {term_count} 条")
    print(f"  - 标准化规则: {rule_count} 条")
    
    # 按分类统计
    print("\n📈 各分类术语数量:")
    categories = db.query(TermCategory).all()
    for cat in categories:
        count = db.query(Term).filter(Term.category_id == cat.id).count()
        if count > 0:
            print(f"  - {cat.name}: {count} 条")
    
    db.close()
    return term_count

def test_validation():
    """测试术语验证功能"""
    db = SessionLocal()
    service = TerminologyService(db)
    
    print("\n🔍 术语验证测试:")
    
    # 测试精确匹配
    test_terms = [
        ("黄芪", True, "精确匹配"),
        ("黄茋", True, "错别字修正"),
        ("党参", True, "精确匹配"),
        ("党生", True, "错别字修正"),
        ("多肽", True, "精确匹配"),
        ("多太", True, "错别字修正"),
        ("食品添加剂", True, "精确匹配"),
        ("食品添剂", True, "错别字修正"),
        ("人参", True, "中药术语"),
        ("Glycine", True, "氨基酸缩写"),
        ("GLY", True, "氨基酸缩写"),
        ("未知术语xyz123", False, "无效术语"),
    ]
    
    for term, expected_valid, desc in test_terms:
        result = service.validate_term(term)
        status = "✅" if result.is_valid == expected_valid else "❌"
        print(f"  {status} {term} -> {result.suggested_term or result.matched_term} (预期: {'有效' if expected_valid else '无效'}, {desc})")
    
    db.close()

def test_normalization():
    """测试术语标准化管道"""
    pipeline = ComprehensiveTermPipeline()
    
    print("\n🧹 术语标准化测试:")
    
    test_cases = [
        ("  黄芪  ", "黄芪", "去除空格"),
        ("《黄芪》", "黄芪", "去除书名号"),
        ("黄 芪", "黄芪", "去除中间空格"),
        ("黄茋", "黄芪", "错别字修正"),
        ("党生", "党参", "错别字修正"),
        ("  多 太  ", "多肽", "综合处理"),
    ]
    
    for input_term, expected, desc in test_cases:
        result = pipeline.process(input_term)
        status = "✅" if result == expected else "❌"
        print(f"  {status} '{input_term}' -> '{result}' ({desc})")

if __name__ == "__main__":
    print("=" * 60)
    print("专业术语数据库测试")
    print("=" * 60)
    
    term_count = test_database_counts()
    
    if term_count > 0:
        test_validation()
        test_normalization()
    
    print("\n" + "=" * 60)
    print("测试完成！")
    print("=" * 60)