"""
补全白扁豆花药材数据
"""
import json
import os
import uuid
from datetime import datetime, timezone

print("=" * 70)
print("  补全白扁豆花药材数据")
print("=" * 70)

# ============================================================
# 加载现有数据
# ============================================================
print("\n[加载] RMCHM数据...")
with open('D:/RMFOODFP/data/rmchm/rmchm_merged_herbs_v310.json', 'r', encoding='utf-8') as f:
    herbs = json.load(f)

print(f"  总药材数: {len(herbs)}")

# 建立查找表
herb_lookup = {h['name_cn']: h for h in herbs}

# ============================================================
# 检查是否已存在
# ============================================================
print("\n[检查] 查找白扁豆花...")
if '白扁豆花' in herb_lookup:
    print(f"  INFO 白扁豆花已存在")
    herb = herb_lookup['白扁豆花']
    print(f"    RMCHM编码: {herb.get('rmchm_code')}")
    print(f"    药食同源标记: {herb.get('is_food_homology', False)}")
    
    # 确保已标记
    if not herb.get('is_food_homology'):
        herb['is_food_homology'] = True
        herb['food_homology_source'] = 'national_catalog_2025'
        print(f"    -> 已添加药食同源标记")
    
    # 保存并退出
    out_file = 'D:/RMFOODFP/data/rmchm/rmchm_merged_herbs_v311.json'
    with open(out_file, 'w', encoding='utf-8') as f:
        json.dump(herbs, f, ensure_ascii=False, indent=2)
    print(f"\n  数据已保存到: {out_file}")
    exit(0)

print(f"  WARN 白扁豆花不存在，准备添加...")

# ============================================================
# 创建白扁豆花数据
# ============================================================
print("\n[创建] 白扁豆花完整数据...")

now = datetime.now(timezone.utc).isoformat()

white_bean_flower = {
    'rmchm_id': str(uuid.uuid4())[:8].upper(),
    'rmchm_code': f"RMCHM-{str(uuid.uuid4())[:8].upper()}",
    'name_cn': '白扁豆花',
    'name_pinyin': 'Baibian Douhua',
    'name_latin': 'Dolichos Lablab Flos',
    'name_eng': 'Lablab Flower',
    'nature_cn': '甘，平',
    'nature_eng': 'Sweet, Neutral',
    'meridians_cn': '脾、胃',
    'meridians_eng': 'Spleen, Stomach',
    'category_cn': '理气药',
    'category_eng': 'Qi Regulating Drugs',
    'use_part': '花',
    'alias': '扁豆花、白豆花',
    'function_cn': '和中益气，和胃醒脾，止泻痢',
    'effects_cn': '健脾和胃，消暑解毒',
    'ob_percent': None,
    'dl_value': None,
    'is_food_homology': True,
    'is_toxic': False,
    'tcmsp_id': None,
    'symmap_id': None,
    'tcmid_id': None,
    'tcmid2_id': None,
    'herbdb_id': None,
    'compounds_count': 0,
    'targets_count': 0,
    'diseases_count': 0,
    'compounds': [],
    'targets': [],
    'diseases': [],
    'image_path': 'data/106FAM/白扁豆.jpg',  # 暂时使用白扁豆图片
    'image_source': '106FAM',
    'image_match_score': 0.0,
    'data_quality_score': 0.7,
    'source_info': {
        'match_method': 'new_herb_added',
        'has_tcmsp_data': False,
        'has_symmap_data': False,
        'food_homology_batch': 'first',
        'food_homology_announcement': '卫法监发〔2002〕51号',
    },
    'synced_at': now,
    'created_at': now,
    'note': '国家药食同源目录第一批（2002年）收录，暂无TCMSP/SymMap关联数据'
}

print(f"  名称: {white_bean_flower['name_cn']}")
print(f"  拼音: {white_bean_flower['name_pinyin']}")
print(f"  拉丁名: {white_bean_flower['name_latin']}")
print(f"  四气: {white_bean_flower['nature_cn']}")
print(f"  归经: {white_bean_flower['meridians_cn']}")
print(f"  功效: {white_bean_flower['function_cn']}")
print(f"  药食同源: {white_bean_flower['is_food_homology']}")
print(f"  RMCHM编码: {white_bean_flower['rmchm_code']}")

# ============================================================
# 添加到数据库
# ============================================================
print("\n[添加] 添加到RMCHM数据库...")
herbs.append(white_bean_flower)
herb_lookup['白扁豆花'] = white_bean_flower

print(f"  OK 已添加")

# ============================================================
# 更新图片映射
# ============================================================
print("\n[更新] 图片映射...")
image_mapping_path = 'D:/RMFOODFP/data/rmchm/rmchm_image_mapping_v32.json'
if os.path.exists(image_mapping_path):
    with open(image_mapping_path, 'r', encoding='utf-8') as f:
        image_mapping = json.load(f)
    
    # 添加白扁豆花映射（暂时使用白扁豆图片）
    if '白扁豆花' not in image_mapping:
        image_mapping['白扁豆花'] = '白扁豆.jpg'
        print(f"  OK 图片映射已添加: 白扁豆花 -> 白扁豆.jpg")
    
    # 保存
    with open(image_mapping_path, 'w', encoding='utf-8') as f:
        json.dump(image_mapping, f, ensure_ascii=False, indent=2)
else:
    print(f"  WARN 图片映射文件不存在")

# ============================================================
# 保存结果
# ============================================================
print("\n[保存] 保存修正后的数据...")

out_dir = 'D:/RMFOODFP/data/rmchm'
os.makedirs(out_dir, exist_ok=True)

out_file = os.path.join(out_dir, 'rmchm_merged_herbs_v311.json')
with open(out_file, 'w', encoding='utf-8') as f:
    json.dump(herbs, f, ensure_ascii=False, indent=2)

print(f"  合并数据: {out_file}")

# 生成报告
now = datetime.now(timezone.utc).isoformat()
report = {
    'generated_at': now,
    'version': 'v3.11',
    'summary': {
        'total_herbs': len(herbs),
        'homology_marked': sum(1 for h in herbs if h.get('is_food_homology')),
        'white_bean_flower_added': True,
    },
    'new_herb': {
        'name_cn': '白扁豆花',
        'rmchm_code': white_bean_flower['rmchm_code'],
        'name_latin': white_bean_flower['name_latin'],
        'nature_cn': white_bean_flower['nature_cn'],
        'meridians_cn': white_bean_flower['meridians_cn'],
        'function_cn': white_bean_flower['function_cn'],
        'is_food_homology': white_bean_flower['is_food_homology'],
        'food_homology_batch': 'first (2002)',
    }
}

report_file = os.path.join(out_dir, 'rmchm_homology_report_v311.json')
with open(report_file, 'w', encoding='utf-8') as f:
    json.dump(report, f, ensure_ascii=False, indent=2)

print(f"  分析报告: {report_file}")

# ============================================================
# 最终验证
# ============================================================
print("\n\n" + "=" * 70)
print("  最终验证")
print("=" * 70)

# 验证官方106种覆盖情况
OFFICIAL_106 = [
    '丁香', '八角茴香', '刀豆', '小茴香', '小蓟', '山药', '山楂', '马齿苋',
    '乌梢蛇', '乌梅', '木瓜', '火麻仁', '代代花', '玉竹', '甘草', '白芷',
    '白果', '白扁豆', '白扁豆花', '龙眼肉', '决明子', '百合',
    '肉豆蔻', '肉桂', '余甘子', '佛手', '杏仁', '沙棘', '牡蛎',
    '芡实', '花椒', '赤小豆', '阿胶', '鸡内金', '麦芽', '昆布', '大枣',
    '罗汉果', '郁李仁', '金银花', '青果', '鱼腥草', '生姜',
    '枳椇子', '枸杞子', '栀子', '砂仁', '胖大海', '茯苓', '香橼', '香薷',
    '桃仁', '桑叶', '桑椹', '桔梗', '桔梗', '益智', '荷叶', '莱菔子',
    '莲子', '高良姜', '淡竹叶', '淡豆豉', '菊花', '菊苣', '黄芥子', '黄精',
    '紫苏', '紫苏子', '葛根', '黑芝麻', '黑胡椒', '槐米', '槐花', '蒲公英',
    '蜂蜜', '榧子', '酸枣仁', '白茅根', '芦根', '蝮蛇', '陈皮', '薄荷',
    '薏苡仁', '薤白', '覆盆子', '藿香',
    '当归', '山柰', '西红花', '草果', '姜黄', '荜茇',
    '党参', '肉苁蓉', '铁皮石斛', '西洋参', '黄芪', '灵芝',
    '山茱萸', '天麻', '杜仲叶',
    '地黄', '麦冬', '天冬', '化橘红'
]

NAME_MAPPING = {
    '杏仁': '苦杏仁',
    '枣': '大枣',
    '姜': '生姜',
    '橘皮': '陈皮',
    '桔红': '化橘红',
    '藿香': '广藿香',
    '鲜白茅根': '白茅根',
    '鲜芦根': '芦根',
    '黄芥子': '芥子',
    '黑胡椒': '胡椒',
    '益智仁': '益智',
    '紫苏籽': '紫苏子',
}

herb_lookup = {h['name_cn']: h for h in herbs}
marked = 0
missing = []

for official_name in OFFICIAL_106:
    found = False
    if official_name in herb_lookup:
        if herb_lookup[official_name].get('is_food_homology'):
            marked += 1
            found = True
    
    if not found and official_name in NAME_MAPPING:
        rmchm_name = NAME_MAPPING[official_name]
        if rmchm_name in herb_lookup:
            if herb_lookup[rmchm_name].get('is_food_homology'):
                marked += 1
                found = True
    
    if not found:
        missing.append(official_name)

print(f"\n  官方106种覆盖验证:")
print(f"    已标记: {marked}/106")
print(f"    缺失: {len(missing)}")

if missing:
    print(f"    缺失列表: {missing}")
else:
    print(f"    ✅ 官方106种全部覆盖！")

print(f"\n  总药材数: {len(herbs)}")
print(f"  药食同源标记数: {sum(1 for h in herbs if h.get('is_food_homology'))}")

print("\n" + "=" * 70)
print("  白扁豆花数据补全完成")
print("=" * 70)
