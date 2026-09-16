"""
药食同源标记修复 v3.5
基于国家卫健委官方106种目录
"""
import json
import os
import re
from datetime import datetime, timezone

# ============================================================
# 官方药食同源目录（106种）
# ============================================================
OFFICIAL_HOMOLOGY_106 = [
    # 第一批（87种）
    '丁香', '八角茴香', '刀豆', '小茴香', '小蓟', '山药', '山楂', '马齿苋',
    '乌梢蛇', '乌梅', '木瓜', '火麻仁', '代代花', '玉竹', '甘草', '白芷',
    '白果', '白扁豆', '白扁豆花', '龙眼肉（桂圆）', '决明子', '百合',
    '肉豆蔻', '肉桂', '余甘子', '佛手', '杏仁（甜、苦）', '沙棘', '牡蛎',
    '芡实', '花椒', '赤小豆', '阿胶', '鸡内金', '麦芽', '昆布', '枣（大枣、酸枣、黑枣）',
    '罗汉果', '郁李仁', '金银花', '青果', '鱼腥草', '姜（生姜、干姜）',
    '枳椇子', '枸杞子', '栀子', '砂仁', '胖大海', '茯苓', '香橼', '香薷',
    '桃仁', '桑叶', '桑椹', '桔红', '桔梗', '益智仁', '荷叶', '莱菔子',
    '莲子', '高良姜', '淡竹叶', '淡豆豉', '菊花', '菊苣', '黄芥子', '黄精',
    '紫苏', '紫苏籽', '葛根', '黑芝麻', '黑胡椒', '槐米', '槐花', '蒲公英',
    '蜂蜜', '榧子', '酸枣仁', '鲜白茅根', '鲜芦根', '蝮蛇', '橘皮', '薄荷',
    '薏苡仁', '薤白', '覆盆子', '藿香',
    # 第二批（6种，仅香辛料）
    '当归', '山柰', '西红花（在香辛料和调味品中又称"藏红花"）',
    '草果', '姜黄', '荜茇',
    # 第三批（9种）
    '党参', '肉苁蓉（荒漠）', '铁皮石斛', '西洋参', '黄芪', '灵芝',
    '山茱萸', '天麻', '杜仲叶',
    # 第四批（4种）
    '地黄', '麦冬', '天冬', '化橘红'
]

def normalize_name(name):
    """标准化药材名"""
    if not name:
        return ''
    name = re.sub(r'[（(].*?[）)]', '', name)
    name = re.sub(r'^鲜/', '', name)
    name = re.sub(r'^姜（', '姜', name)
    name = re.sub(r'^枣（', '枣', name)
    name = re.sub(r'^杏仁（', '杏仁', name)
    name = re.sub(r'\s+', '', name)
    return name.strip()

print("=" * 70)
print("  药食同源标记修复 v3.5")
print("=" * 70)

# 加载数据
print("\n[加载] RMCHM数据...")
with open('D:/RMFOODFP/data/rmchm/rmchm_merged_herbs_v34.json', 'r', encoding='utf-8') as f:
    herbs = json.load(f)

print(f"  总药材数: {len(herbs)}")

# 建立查找表
herb_lookup = {h['name_cn']: h for h in herbs}

# 统计当前标记
current_marked = sum(1 for h in herbs if h.get('is_food_homology'))
print(f"  当前药食同源标记: {current_marked} 条")

# ============================================================
# 修复标记
# ============================================================
print("\n[修复] 添加药食同源标记...")

fixed_count = 0
added_count = 0
skipped_count = 0

for official_name in OFFICIAL_HOMOLOGY_106:
    # 标准化官方名称
    norm_official = normalize_name(official_name)
    
    # 尝试匹配
    matched_herb = None
    
    # 1. 精确匹配
    if official_name in herb_lookup:
        matched_herb = herb_lookup[official_name]
    # 2. 标准化匹配
    elif norm_official in herb_lookup:
        matched_herb = herb_lookup[norm_official]
    # 3. 模糊匹配
    else:
        for herb_name, herb in herb_lookup.items():
            norm_herb = normalize_name(herb_name)
            # 检查是否包含关键部分
            if norm_official in norm_herb or norm_herb in norm_official:
                if len(norm_official) >= 2:
                    matched_herb = herb
                    break
    
    if matched_herb:
        # 检查是否已有标记
        if not matched_herb.get('is_food_homology'):
            matched_herb['is_food_homology'] = True
            matched_herb['food_homology_source'] = 'national_catalog_2025'
            matched_herb['food_homology_batch'] = 'first' if official_name in OFFICIAL_HOMOLOGY_106[:87] else 'second' if official_name in OFFICIAL_HOMOLOGY_106[87:93] else 'third' if official_name in OFFICIAL_HOMOLOGY_106[93:102] else 'fourth'
            fixed_count += 1
            print(f"  + {matched_herb['name_cn']}")
        else:
            skipped_count += 1
    else:
        # 未找到匹配
        added_count += 1
        print(f"  ! {official_name} (未找到匹配)")

print(f"\n  已修复标记: {fixed_count} 条")
print(f"  已有标记: {skipped_count} 条")
print(f"  未找到匹配: {added_count} 种")

# ============================================================
# 保存结果
# ============================================================
print("\n[保存] 修复后的数据...")

out_dir = 'D:/RMFOODFP/data/rmchm'
os.makedirs(out_dir, exist_ok=True)

out_file = os.path.join(out_dir, 'rmchm_merged_herbs_v35.json')
with open(out_file, 'w', encoding='utf-8') as f:
    json.dump(herbs, f, ensure_ascii=False, indent=2)

print(f"  合并数据: {out_file}")

# 统计最终结果
final_homology_count = sum(1 for h in herbs if h.get('is_food_homology'))
print(f"\n[统计] 最终药食同源标记数: {final_homology_count} 条")

# 生成报告
now = datetime.now(timezone.utc).isoformat()
report = {
    'generated_at': now,
    'version': 'v3.5',
    'summary': {
        'total_herbs': len(herbs),
        'homology_marked': final_homology_count,
        'homology_percentage': round(final_homology_count * 100 / len(herbs), 1),
    },
    'official_catalog': {
        'total': len(OFFICIAL_HOMOLOGY_106),
        'matched': len(OFFICIAL_HOMOLOGY_106) - added_count,
        'coverage_rate': round((len(OFFICIAL_HOMOLOGY_106) - added_count) * 100 / len(OFFICIAL_HOMOLOGY_106), 1),
    },
    'fixes_applied': {
        'markers_added': fixed_count,
        'already_marked': skipped_count,
        'missing_herbs': added_count,
    }
}

report_file = os.path.join(out_dir, 'rmchm_homology_report_v35.json')
with open(report_file, 'w', encoding='utf-8') as f:
    json.dump(report, f, ensure_ascii=False, indent=2)

print(f"  分析报告: {report_file}")

print("\n" + "=" * 70)
print("  药食同源修复完成")
print("=" * 70)
print(f"\n总药材数: {len(herbs)}")
print(f"药食同源标记数: {final_homology_count} 条 ({final_homology_count*100//len(herbs)}%)")
print(f"官方目录总数: {len(OFFICIAL_HOMOLOGY_106)} 种")
print(f"已匹配: {len(OFFICIAL_HOMOLOGY_106) - added_count} 种")
print(f"未匹配: {added_count} 种")
print(f"\n修复操作:")
print(f"  - 新增标记: {fixed_count} 条")
print(f"  - 已有标记: {skipped_count} 条")
print(f"  - 缺失药材: {added_count} 种")
