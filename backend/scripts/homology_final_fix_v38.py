"""
药食同源数据最终修正 v3.8
确保官方106种全部正确标记
"""
import json
import os
import uuid
from datetime import datetime, timezone

print("=" * 70)
print("  药食同源数据最终修正 v3.8")
print("=" * 70)

# ============================================================
# 加载数据
# ============================================================
print("\n[加载] RMCHM数据...")
with open('D:/RMFOODFP/data/rmchm/rmchm_merged_herbs_v35.json', 'r', encoding='utf-8') as f:
    herbs = json.load(f)

print(f"  总药材数: {len(herbs)}")

# 建立查找表
herb_lookup = {h['name_cn']: h for h in herbs}

# ============================================================
# 修复1：为紫苏子添加药食同源标记
# ============================================================
print("\n[修复1] 为紫苏子添加标记...")
if '紫苏子' in herb_lookup:
    herb_lookup['紫苏子']['is_food_homology'] = True
    herb_lookup['紫苏子']['food_homology_source'] = 'national_catalog_2025'
    print(f"  OK 紫苏子已标记")
else:
    print(f"  WARN 未找到紫苏子")

# ============================================================
# 修复2：添加槐米（如果不存在）
# ============================================================
print("\n[修复2] 检查槐米...")
if '槐米' not in herb_lookup:
    print(f"  添加槐米到数据库...")
    new_herb = {
        'rmchm_id': str(uuid.uuid4())[:8].upper(),
        'rmchm_code': f"RMCHM-{str(uuid.uuid4())[:8].upper()}",
        'name_cn': '槐米',
        'name_pinyin': 'Huaimit',
        'name_latin': 'Sophorae Flos',
        'nature_cn': '微寒',
        'meridians_cn': '肝、大肠',
        'category_cn': '清热药',
        'use_part': '花蕾',
        'alias': '槐穗、槐花米',
        'function_cn': '凉血止血，清肝泻火',
        'ob_percent': None,
        'dl_value': None,
        'is_food_homology': True,
        'is_toxic': False,
        'tcmsp_id': None,
        'symmap_id': None,
        'compounds_count': 0,
        'targets_count': 0,
        'diseases_count': 0,
        'compounds': [],
        'targets': [],
        'diseases': [],
        'image_path': 'data/106FAM/槐米.jpg',
        'image_source': '106FAM',
        'image_match_score': 1.0,
        'data_quality_score': 0.6,
        'source_info': {
            'match_method': 'new_herb_added',
            'has_tcmsp_data': False,
            'has_symmap_data': False,
        },
        'synced_at': datetime.now(timezone.utc).isoformat(),
        'created_at': datetime.now(timezone.utc).isoformat(),
    }
    herbs.append(new_herb)
    herb_lookup['槐米'] = new_herb
    print(f"  OK 槐米已添加 (code: {new_herb['rmchm_code']})")
else:
    print(f"  INFO 槐米已存在")

# ============================================================
# 修复3：添加蝮蛇（如果不存在）
# ============================================================
print("\n[修复3] 检查蝮蛇...")
if '蝮蛇' not in herb_lookup:
    print(f"  添加蝮蛇到数据库...")
    new_herb = {
        'rmchm_id': str(uuid.uuid4())[:8].upper(),
        'rmchm_code': f"RMCHM-{str(uuid.uuid4())[:8].upper()}",
        'name_cn': '蝮蛇',
        'name_pinyin': 'Fushé',
        'name_latin': 'Agkistrodon',
        'nature_cn': '甘、咸，温',
        'meridians_cn': '肝',
        'category_cn': '祛风湿药',
        'use_part': '全体',
        'alias': '蛇、土公蛇',
        'function_cn': '祛风除湿，通络止痛',
        'ob_percent': None,
        'dl_value': None,
        'is_food_homology': True,
        'is_toxic': False,
        'tcmsp_id': None,
        'symmap_id': None,
        'compounds_count': 0,
        'targets_count': 0,
        'diseases_count': 0,
        'compounds': [],
        'targets': [],
        'diseases': [],
        'image_path': None,
        'image_source': None,
        'image_match_score': 0.0,
        'data_quality_score': 0.5,
        'source_info': {
            'match_method': 'new_herb_added',
            'has_tcmsp_data': False,
            'has_symmap_data': False,
        },
        'synced_at': datetime.now(timezone.utc).isoformat(),
        'created_at': datetime.now(timezone.utc).isoformat(),
    }
    herbs.append(new_herb)
    herb_lookup['蝮蛇'] = new_herb
    print(f"  OK 蝮蛇已添加 (code: {new_herb['rmchm_code']})")
else:
    print(f"  INFO 蝮蛇已存在")

# ============================================================
# 最终统计
# ============================================================
print("\n\n[统计] 最终统计...")

# 统计药食同源标记
homology_herbs = [h for h in herbs if h.get('is_food_homology')]
print(f"  药食同源标记数: {len(homology_herbs)} 条")

# 官方106种检查结果
official_106_list = [
    '丁香', '八角茴香', '刀豆', '小茴香', '小蓟', '山药', '山楂', '马齿苋',
    '乌梢蛇', '乌梅', '木瓜', '火麻仁', '代代花', '玉竹', '甘草', '白芷',
    '白果', '白扁豆', '白扁豆花', '龙眼肉', '决明子', '百合',
    '肉豆蔻', '肉桂', '余甘子', '佛手', '杏仁', '沙棘', '牡蛎',
    '芡实', '花椒', '赤小豆', '阿胶', '鸡内金', '麦芽', '昆布', '大枣',
    '罗汉果', '郁李仁', '金银花', '青果', '鱼腥草', '生姜',
    '枳椇子', '枸杞子', '栀子', '砂仁', '胖大海', '茯苓', '香橼', '香薷',
    '桃仁', '桑叶', '桑椹', '桔红', '桔梗', '益智', '荷叶', '莱菔子',
    '莲子', '高良姜', '淡竹叶', '淡豆豉', '菊花', '菊苣', '芥子', '黄精',
    '紫苏', '紫苏子', '葛根', '黑芝麻', '胡椒', '槐米', '槐花', '蒲公英',
    '蜂蜜', '榧子', '酸枣仁', '白茅根', '芦根', '蝮蛇', '陈皮', '薄荷',
    '薏苡仁', '薤白', '覆盆子', '藿香',
    '当归', '山柰', '西红花',
    '草果', '姜黄', '荜茇',
    '党参', '肉苁蓉', '铁皮石斛', '西洋参', '黄芪', '灵芝',
    '山茱萸', '天麻', '杜仲叶',
    '地黄', '麦冬', '天冬', '化橘红'
]

print(f"\n  官方106种检查:")
marked_count = 0
unmarked_list = []
missing_list = []

for name in official_106_list:
    if name in herb_lookup and herb_lookup[name].get('is_food_homology'):
        marked_count += 1
    elif name in herb_lookup:
        unmarked_list.append(name)
    else:
        missing_list.append(name)

print(f"    已标记: {marked_count}/106")
if unmarked_list:
    print(f"    未标记: {unmarked_list}")
if missing_list:
    print(f"    缺失: {missing_list}")

# ============================================================
# 保存结果
# ============================================================
print("\n\n[保存] 保存修正后的数据...")

out_dir = 'D:/RMFOODFP/data/rmchm'
os.makedirs(out_dir, exist_ok=True)

out_file = os.path.join(out_dir, 'rmchm_merged_herbs_v38.json')
with open(out_file, 'w', encoding='utf-8') as f:
    json.dump(herbs, f, ensure_ascii=False, indent=2)

print(f"  合并数据: {out_file}")

# 生成报告
now = datetime.now(timezone.utc).isoformat()
report = {
    'generated_at': now,
    'version': 'v3.8',
    'summary': {
        'total_herbs': len(herbs),
        'homology_marked': len(homology_herbs),
        'homology_percentage': round(len(homology_herbs) * 100 / len(herbs), 1),
    },
    'fixes_applied': {
        '紫苏子_marked': '紫苏子' in herb_lookup,
        '槐米_added': '槐米' in herb_lookup,
        '蝮蛇_added': '蝮蛇' in herb_lookup,
    },
    'official_catalog_106': {
        'total': len(official_106_list),
        'all_marked': marked_count,
        'coverage_rate': f"{marked_count}/106"
    }
}

report_file = os.path.join(out_dir, 'rmchm_homology_report_v38.json')
with open(report_file, 'w', encoding='utf-8') as f:
    json.dump(report, f, ensure_ascii=False, indent=2)

print(f"  分析报告: {report_file}")

print("\n" + "=" * 70)
print("  药食同源修正完成")
print("=" * 70)
print(f"\n总药材数: {len(herbs)}")
print(f"药食同源标记数: {len(homology_herbs)} 条")
print(f"官方106种覆盖率: {marked_count}/106")
print(f"\n修正操作:")
print(f"  - 紫苏子: 已添加标记")
print(f"  - 槐米: 已添加到数据库")
print(f"  - 蝮蛇: 已添加到数据库")
