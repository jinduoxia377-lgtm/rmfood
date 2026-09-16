"""
药食同源最终完善 v3.10
确保官方106种100%覆盖
"""
import json
import os
from datetime import datetime, timezone

print("=" * 70)
print("  药食同源最终完善 v3.10")
print("=" * 70)

# ============================================================
# 加载数据
# ============================================================
print("\n[加载] RMCHM数据...")
with open('D:/RMFOODFP/data/rmchm/rmchm_merged_herbs_v38.json', 'r', encoding='utf-8') as f:
    herbs = json.load(f)

print(f"  总药材数: {len(herbs)}")

# 建立查找表
herb_lookup = {h['name_cn']: h for h in herbs}

# ============================================================
# 修复缺失的2种
# ============================================================
print("\n[修复1] 检查白扁豆花...")
if '白扁豆花' in herb_lookup:
    herb = herb_lookup['白扁豆花']
    if not herb.get('is_food_homology'):
        herb['is_food_homology'] = True
        herb['food_homology_source'] = 'national_catalog_2025'
        print(f"  OK 白扁豆花已标记")
    else:
        print(f"  INFO 白扁豆花已有标记")
else:
    print(f"  WARN 未找到白扁豆花")

print("\n[修复2] 检查杏仁...")
if '甜杏仁' in herb_lookup:
    herb = herb_lookup['甜杏仁']
    if not herb.get('is_food_homology'):
        herb['is_food_homology'] = True
        herb['food_homology_source'] = 'national_catalog_2025'
        print(f"  OK 甜杏仁已标记")
    else:
        print(f"  INFO 甜杏仁已有标记")
elif '苦杏仁' in herb_lookup:
    herb = herb_lookup['苦杏仁']
    if not herb.get('is_food_homology'):
        herb['is_food_homology'] = True
        herb['food_homology_source'] = 'national_catalog_2025'
        print(f"  OK 苦杏仁已标记")
    else:
        print(f"  INFO 苦杏仁已有标记")
    print(f"  NOTE 官方目录'杏仁（甜、苦）'映射到苦杏仁")
else:
    print(f"  WARN 未找到杏仁类药材")

# ============================================================
# 最终验证
# ============================================================
print("\n\n[验证] 最终验证...")

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

marked = 0
unmarked = 0
missing = 0

for official_name in OFFICIAL_106:
    found = False
    if official_name in herb_lookup:
        herb = herb_lookup[official_name]
        if herb.get('is_food_homology'):
            marked += 1
            found = True
        else:
            unmarked += 1
            found = True
    
    if not found and official_name in NAME_MAPPING:
        rmchm_name = NAME_MAPPING[official_name]
        if rmchm_name in herb_lookup:
            herb = herb_lookup[rmchm_name]
            if herb.get('is_food_homology'):
                marked += 1
            else:
                unmarked += 1
    
    if not found:
        missing += 1

print(f"\n  官方106种:")
print(f"    已标记: {marked}/106")
print(f"    未标记: {unmarked}")
print(f"    缺失: {missing}")

# ============================================================
# 保存结果
# ============================================================
print("\n\n[保存] 保存修正后的数据...")

out_dir = 'D:/RMFOODFP/data/rmchm'
os.makedirs(out_dir, exist_ok=True)

out_file = os.path.join(out_dir, 'rmchm_merged_herbs_v310.json')
with open(out_file, 'w', encoding='utf-8') as f:
    json.dump(herbs, f, ensure_ascii=False, indent=2)

print(f"  合并数据: {out_file}")

# 生成报告
now = datetime.now(timezone.utc).isoformat()
report = {
    'generated_at': now,
    'version': 'v3.10',
    'summary': {
        'total_herbs': len(herbs),
        'homology_marked': sum(1 for h in herbs if h.get('is_food_homology')),
        'official_106_covered': marked,
        'coverage_rate': f"{marked}/106"
    },
    'fixes_applied': {
        '白扁豆花_marked': '白扁豆花' in herb_lookup,
        '杏仁_marked': '苦杏仁' in herb_lookup or '甜杏仁' in herb_lookup,
    }
}

report_file = os.path.join(out_dir, 'rmchm_homology_report_v310.json')
with open(report_file, 'w', encoding='utf-8') as f:
    json.dump(report, f, ensure_ascii=False, indent=2)

print(f"  分析报告: {report_file}")

print("\n" + "=" * 70)
print("  药食同源完善完成")
print("=" * 70)
print(f"\n总药材数: {len(herbs)}")
print(f"药食同源标记数: {report['summary']['homology_marked']} 条")
print(f"官方106种覆盖率: {marked}/106 ({marked*100//106}%)")
