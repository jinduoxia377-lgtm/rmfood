"""术语数据库初始化脚本
用于初始化1000+专业术语数据（中药、多肽、食品法规）
"""
import sys
import os

# 添加项目路径
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.core.config import settings
from app.models.terminology import Term, TermCategory, TermNormalizationRule
from app.services.terminology_data import TCM_TERMS, PEPTIDE_TERMS, FOOD_REGULATION_TERMS, TCM_EXPANDED, PEPTIDE_EXPANDED
from app.services.terminology_expansion import TCM_HERBS_EXPANSION, TCM_FORMULAS_EXPANSION, FOOD_REGULATION_EXPANSION, PEPTIDE_EXPANSION
from app.services.terminology_supplement import TCM_SUPPLEMENT, PEPTIDE_SUPPLEMENT, FOOD_REGULATION_SUPPLEMENT, TCM_FORMULAS_EXTENSION
from app.services.terminology_final import TCM_HERBS_FINAL, FOOD_REGULATION_FINAL, PEPTIDE_FINAL

# 创建数据库连接（使用同步引擎）
db_url = settings.database_url
if 'aiosqlite' in db_url:
    db_url = db_url.replace('+aiosqlite', '')
engine = create_engine(db_url)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def init_categories(db):
    """初始化术语分类"""
    categories = [
        # 中药领域
        {"name": "中医基础理论", "name_en": "TCM Fundamentals", "level": 1, "sort_order": 10},
        {"name": "中药分类", "name_en": "TCM Categories", "level": 1, "sort_order": 20},
        {"name": "中药药性", "name_en": "TCM Properties", "level": 1, "sort_order": 30},
        {"name": "药食同源", "name_en": "Medicinal and Edible", "level": 1, "sort_order": 40},
        {"name": "中药方剂", "name_en": "TCM Formulas", "level": 1, "sort_order": 50},
        {"name": "中药功效", "name_en": "TCM Effects", "level": 1, "sort_order": 60},
        {"name": "中药材", "name_en": "TCM Herbs", "level": 1, "sort_order": 70},
        
        # 多肽领域
        {"name": "多肽基础", "name_en": "Peptide Basics", "level": 1, "sort_order": 100},
        {"name": "多肽化学", "name_en": "Peptide Chemistry", "level": 1, "sort_order": 110},
        {"name": "多肽生物活性", "name_en": "Peptide Bioactivity", "level": 1, "sort_order": 120},
        {"name": "多肽分析", "name_en": "Peptide Analysis", "level": 1, "sort_order": 130},
        {"name": "食源多肽", "name_en": "Food-derived Peptides", "level": 1, "sort_order": 140},
        {"name": "多肽制备", "name_en": "Peptide Preparation", "level": 1, "sort_order": 150},
        {"name": "氨基酸缩写", "name_en": "Amino Acid Abbreviations", "level": 1, "sort_order": 160},
        {"name": "多肽结构", "name_en": "Peptide Structure", "level": 1, "sort_order": 170},
        {"name": "多肽功能", "name_en": "Peptide Function", "level": 1, "sort_order": 180},
        
        # 食品法规领域
        {"name": "食品安全基础", "name_en": "Food Safety Basics", "level": 1, "sort_order": 200},
        {"name": "食品法规", "name_en": "Food Regulations", "level": 1, "sort_order": 210},
        {"name": "食品添加剂", "name_en": "Food Additives", "level": 1, "sort_order": 220},
        {"name": "食品标准", "name_en": "Food Standards", "level": 1, "sort_order": 230},
        {"name": "食品检测", "name_en": "Food Testing", "level": 1, "sort_order": 240},
        {"name": "食品营养", "name_en": "Food Nutrition", "level": 1, "sort_order": 250},
        {"name": "食品生产", "name_en": "Food Production", "level": 1, "sort_order": 260},
        {"name": "食品包装", "name_en": "Food Packaging", "level": 1, "sort_order": 270},
        {"name": "食品流通", "name_en": "Food Distribution", "level": 1, "sort_order": 280},
        {"name": "食品监管", "name_en": "Food Supervision", "level": 1, "sort_order": 290},
    ]
    
    category_map = {}
    for cat in categories:
        existing = db.query(TermCategory).filter(TermCategory.name == cat['name']).first()
        if existing:
            category_map[cat['name']] = existing.id
        else:
            new_cat = TermCategory(**cat)
            db.add(new_cat)
            db.flush()
            category_map[cat['name']] = new_cat.id
    
    db.commit()
    print(f"✅ 初始化分类完成，共 {len(category_map)} 个分类")
    return category_map


def init_terms(db, category_map):
    """初始化术语数据"""
    all_terms = []
    
    # 添加中药术语
    for term in TCM_TERMS:
        cat_id = category_map.get(term['category'])
        if cat_id:
            all_terms.append({**term, 'category_id': cat_id})
    
    # 添加多肽术语
    for term in PEPTIDE_TERMS:
        cat_id = category_map.get(term['category'])
        if cat_id:
            all_terms.append({**term, 'category_id': cat_id})
    
    # 添加食品法规术语
    for term in FOOD_REGULATION_TERMS:
        cat_id = category_map.get(term['category'])
        if cat_id:
            all_terms.append({**term, 'category_id': cat_id})
    
    # 添加扩展中药术语
    for term in TCM_EXPANDED:
        cat_id = category_map.get(term['category'])
        if cat_id:
            all_terms.append({**term, 'category_id': cat_id})
    
    # 添加扩展多肽术语
    for term in PEPTIDE_EXPANDED:
        cat_id = category_map.get(term['category'])
        if cat_id:
            all_terms.append({**term, 'category_id': cat_id})
    
    # 添加中药材扩展数据
    for term in TCM_HERBS_EXPANSION:
        cat_id = category_map.get(term['category'])
        if cat_id:
            all_terms.append({**term, 'category_id': cat_id})
    
    # 添加中药方剂扩展数据
    for term in TCM_FORMULAS_EXPANSION:
        cat_id = category_map.get(term['category'])
        if cat_id:
            all_terms.append({**term, 'category_id': cat_id})
    
    # 添加食品法规扩展数据
    for term in FOOD_REGULATION_EXPANSION:
        cat_id = category_map.get(term['category'])
        if cat_id:
            all_terms.append({**term, 'category_id': cat_id})
    
    # 添加中药补充数据
    for term in TCM_SUPPLEMENT:
        cat_id = category_map.get(term['category'])
        if cat_id:
            all_terms.append({**term, 'category_id': cat_id})
    
    # 添加多肽补充数据
    for term in PEPTIDE_SUPPLEMENT:
        cat_id = category_map.get(term['category'])
        if cat_id:
            all_terms.append({**term, 'category_id': cat_id})
    
    # 添加食品法规补充数据
    for term in FOOD_REGULATION_SUPPLEMENT:
        cat_id = category_map.get(term['category'])
        if cat_id:
            all_terms.append({**term, 'category_id': cat_id})
    
    # 添加中药方剂扩展数据
    for term in TCM_FORMULAS_EXTENSION:
        cat_id = category_map.get(term['category'])
        if cat_id:
            all_terms.append({**term, 'category_id': cat_id})
    
    # 添加中药最终补充数据
    for term in TCM_HERBS_FINAL:
        cat_id = category_map.get(term['category'])
        if cat_id:
            all_terms.append({**term, 'category_id': cat_id})
    
    # 添加食品法规最终补充数据
    for term in FOOD_REGULATION_FINAL:
        cat_id = category_map.get(term['category'])
        if cat_id:
            all_terms.append({**term, 'category_id': cat_id})
    
    # 添加多肽最终补充数据
    for term in PEPTIDE_FINAL:
        cat_id = category_map.get(term['category'])
        if cat_id:
            all_terms.append({**term, 'category_id': cat_id})
    
    # 统计各分类术语数量
    cat_term_count = {}
    for term in all_terms:
        cat_name = term.get('category')
        cat_term_count[cat_name] = cat_term_count.get(cat_name, 0) + 1
    
    print(f"📊 读取到 {len(all_terms)} 条术语数据")
    
    # 插入术语
    inserted_count = 0
    skipped_count = 0
    for term in all_terms:
        # 检查是否已存在
        existing = db.query(Term).filter(Term.term == term['term']).first()
        if existing:
            skipped_count += 1
            continue
        
        # 构建术语对象
        term_data = {
            'term': term['term'],
            'term_en': term.get('term_en'),
            'pinyin': term.get('pinyin'),
            'pinyin_abbr': term.get('pinyin_abbr'),
            'abbreviation': term.get('abbreviation'),
            'definition': term['definition'],
            'definition_en': term.get('definition_en'),
            'category_id': term['category_id'],
            'subcategory': term.get('subcategory'),
            'unit': term.get('unit'),
            'examples': term.get('examples'),
            'synonyms': term.get('synonyms'),
            'related_terms': term.get('related_terms'),
            'source': term.get('source'),
            'is_standard': term.get('is_standard', True),
            'confidence': term.get('confidence', 1.0),
            'frequency': term.get('frequency', 0),
        }
        
        new_term = Term(**term_data)
        db.add(new_term)
        inserted_count += 1
        
        # 每100条提交一次
        if inserted_count % 100 == 0:
            db.commit()
            print(f"已插入 {inserted_count} 条术语...")
    
    db.commit()
    
    print(f"✅ 初始化术语完成，共 {inserted_count} 条（跳过重复 {skipped_count} 条）")
    print("各分类术语数量:")
    for cat_name, count in sorted(cat_term_count.items(), key=lambda x: -x[1]):
        print(f"  - {cat_name}: {count} 条")
    
    return inserted_count


def init_normalization_rules(db):
    """初始化标准化规则"""
    rules = [
        # 中药术语标准化规则
        {
            'pattern': r'[\u3000　]',
            'replacement': '',
            'rule_type': 'regex',
            'priority': 10,
            'description': '去除全角空格'
        },
        {
            'pattern': r'[《》【】()（）]',
            'replacement': '',
            'rule_type': 'regex',
            'priority': 20,
            'description': '去除书名号和括号'
        },
        {
            'pattern': r'\s+',
            'replacement': '',
            'rule_type': 'regex',
            'priority': 30,
            'description': '去除多余空格'
        },
        # 常见错别字修正
        {
            'pattern': '黄茋',
            'replacement': '黄芪',
            'rule_type': 'exact',
            'priority': 50,
            'description': '修正黄芪常见错别字'
        },
        {
            'pattern': '党生',
            'replacement': '党参',
            'rule_type': 'exact',
            'priority': 50,
            'description': '修正党参常见错别字'
        },
        {
            'pattern': '白勺',
            'replacement': '白芍',
            'rule_type': 'exact',
            'priority': 50,
            'description': '修正白芍常见错别字'
        },
        {
            'pattern': '伏苓',
            'replacement': '茯苓',
            'rule_type': 'exact',
            'priority': 50,
            'description': '修正茯苓常见错别字'
        },
        {
            'pattern': '多太',
            'replacement': '多肽',
            'rule_type': 'exact',
            'priority': 50,
            'description': '修正多肽常见错别字'
        },
        {
            'pattern': '食品添剂',
            'replacement': '食品添加剂',
            'rule_type': 'exact',
            'priority': 50,
            'description': '修正食品添加剂常见错别字'
        },
    ]
    
    for rule in rules:
        existing = db.query(TermNormalizationRule).filter(
            TermNormalizationRule.pattern == rule['pattern']
        ).first()
        if existing:
            continue
        
        new_rule = TermNormalizationRule(**rule)
        db.add(new_rule)
    
    db.commit()
    print(f"✅ 初始化标准化规则完成，共 {len(rules)} 条")


def main():
    """主入口"""
    print("=" * 60)
    print("专业术语数据库初始化脚本")
    print("=" * 60)
    
    db = SessionLocal()
    
    try:
        print("\n1. 初始化术语分类...")
        category_map = init_categories(db)
        
        print("\n2. 初始化术语数据...")
        term_count = init_terms(db, category_map)
        
        print("\n3. 初始化标准化规则...")
        init_normalization_rules(db)
        
        print("\n" + "=" * 60)
        print(f"初始化完成！共导入 {term_count} 条专业术语")
        print("=" * 60)
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ 初始化失败: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()


if __name__ == "__main__":
    main()
