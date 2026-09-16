"""
药食同源数据精准分析 v3.6
严格基于官方106种目录，避免重复计数
"""
import json
import os
import re
from datetime import datetime, timezone

# ============================================================
# 官方药食同源完整目录（106种）
# 来源：国家卫健委官方公告
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

print("=" * 70)
print("  药食同源数据精准分析 v3.6")
print("=" * 70)
print(f"\n官方目录总数: {len(OFFICIAL_HOMOLOGY_106)} 种")

# ============================================================
# 加载RMCHM数据
# ============================================================
print("\n[加载] RMCHM数据...")
with open('D:/RMFOODFP/data/rmchm/rmchm_merged_herbs_v35.json', 'r', encoding='utf-8') as f:
    herbs = json.load(f)

print(f"  总药材数: {len(herbs)}")

# 建立名称查找表（标准化）
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

herb_lookup = {h['name_cn']: h for h in herbs}
norm_lookup = {normalize_name(h['name_cn']): h['name_cn'] for h in herbs}

print(f"  唯一名称: {len(herb_lookup)} 个")

# ============================================================
# 精准匹配分析
# ============================================================
print("\n\n[分析] 药食同源精准匹配...")

# 定义匹配规则（处理别名和变体）
MATCH_RULES = {
    '姜（生姜、干姜）': ['生姜', '干姜'],
    '枣（大枣、酸枣、黑枣）': ['大枣', '酸枣', '黑枣'],
    '杏仁（甜、苦）': ['甜杏仁', '苦杏仁'],
    '龙眼肉（桂圆）': ['龙眼肉', '桂圆'],
    '西红花（在香辛料和调味品中又称"藏红花"）': ['西红花', '藏红花'],
    '肉苁蓉（荒漠）': ['肉苁蓉'],
    '橘皮': ['陈皮'],
    '桔红': ['化橘红', '桔红'],
}

# 分析每个官方药材
matched_records = []  # 匹配的药材记录
unmatched_official = []  # 未匹配到的官方药材

for official_name in OFFICIAL_HOMOLOGY_106:
    norm_official = normalize_name(official_name)
    
    # 检查是否有特殊匹配规则
    matched_herb = None
    
    if official_name in MATCH_RULES:
        # 使用匹配规则
        variants = MATCH_RULES[official_name]
        for variant in variants:
            if variant in herb_lookup:
                matched_herb = herb_lookup[variant]
                break
    else:
        # 直接匹配
        if official_name in herb_lookup:
            matched_herb = herb_lookup[official_name]
        elif norm_official in herb_lookup:
            matched_herb = herb_lookup[norm_official]
        else:
            # 模糊匹配
            for herb_name in herb_lookup.keys():
                norm_herb = normalize_name(herb_name)
                if norm_official == norm_herb or norm_official in norm_herb:
                    matched_herb = herb_lookup[herb_name]
                    break
    
    if matched_herb:
        matched_records.append({
            'official': official_name,
            'rmchm_name': matched_herb['name_cn'],
            'rmchm_code': matched_herb.get('rmchm_code'),
            'already_marked': matched_herb.get('is_food_homology', False)
        })
    else:
        unmatched_official.append(official_name)

print(f"\n  成功匹配: {len(matched_records)} 种")
print(f"  未匹配: {len(unmatched_official)} 种")

# ============================================================
# 统计已标记情况
# ============================================================
print("\n\n[统计] 标记情况分析...")

# 统计已标记的药材
marked_records = [r for r in matched_records if r['already_marked']]
unmarked_records = [r for r in matched_records if not r['already_marked']]

print(f"\n  已标记: {len(marked_records)} 种")
print(f"  未标记: {len(unmarked_records)} 种")

# 显示未标记的药材
if unmarked_records:
    print(f"\n  需要添加标记的药材({len(unmarked_records)}种):")
    for r in sorted(unmarked_records, key=lambda x: x['rmchm_name']):
        print(f"    - {r['rmchm_name']} (官方: {r['official']})")

# ============================================================
# 精准统计
# ============================================================
print("\n\n" + "=" * 70)
print("  精准统计结果")
print("=" * 70)

# 核心指标
total_official = len(OFFICIAL_HOMOLOGY_106)
total_matched = len(matched_records)
total_marked = len(marked_records)
total_unmarked = len(unmarked_records)
total_missing = len(unmatched_official)

print(f"\n  官方目录总数: {total_official} 种")
print(f"  在RMCHM中匹配: {total_matched} 种 ({total_matched*100//total_official}%)")
print(f"  已标记药食同源: {total_marked} 种")
print(f"  需添加标记: {total_unmarked} 种")
print(f"  完全缺失: {total_missing} 种")
print(f"\n  覆盖率: {total_matched*100//total_official}%")

# ============================================================
# 保存精准分析报告
# ============================================================
analysis_report = {
    'analysis_date': datetime.now(timezone.utc).isoformat(),
    'version': 'v3.6',
    'official_catalog': {
        'total': total_official,
        'matched': total_matched,
        'coverage_rate': round(total_matched * 100 / total_official, 1),
    },
    'marking_status': {
        'already_marked': total_marked,
        'needs_marking': total_unmarked,
        'missing': total_missing,
    },
    'matched_records': matched_records,
    'unmatched_official': unmatched_official,
    'needs_marking': [r['rmchm_name'] for r in unmarked_records],
}

out_path = 'D:/RMFOODFP/data/rmchm/homology_analysis_precise_v36.json'
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(analysis_report, f, ensure_ascii=False, indent=2)

print(f"\n详细分析报告已保存到: {out_path}")
