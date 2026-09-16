"""
药食同源数据深度分析 v3.5
基于国家卫健委官方106种目录（2025年）
"""
import json
import os
import re
from datetime import datetime, timezone

# ============================================================
# 国家卫健委官方药食同源目录（106种）
# 来源：http://www.zhimeioem.com/view/929.html
# ============================================================

# 第一批（2002年，卫法监发〔2002〕51号）- 87种
FIRST_BATCH = [
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
    '薏苡仁', '薤白', '覆盆子', '藿香'
]

# 第二批（2019年，2019年第8号公告）- 6种（仅作为香辛料和调味品）
SECOND_BATCH = [
    '当归', '山柰', '西红花（在香辛料和调味品中又称"藏红花"）',
    '草果', '姜黄', '荜茇'
]

# 第三批（2023年，2023年第9号公告）- 9种
THIRD_BATCH = [
    '党参', '肉苁蓉（荒漠）', '铁皮石斛', '西洋参', '黄芪', '灵芝',
    '山茱萸', '天麻', '杜仲叶'
]

# 第四批（2024年，2024年第4号公告）- 4种
FOURTH_BATCH = [
    '地黄', '麦冬', '天冬', '化橘红'
]

# 完整官方目录（106种）
OFFICIAL_HOMOLOGY_106 = FIRST_BATCH + SECOND_BATCH + THIRD_BATCH + FOURTH_BATCH

print("=" * 70)
print("  药食同源数据深度分析 v3.5")
print("  基于国家卫健委官方目录（2025年）")
print("=" * 70)

print(f"\n官方目录总数: {len(OFFICIAL_HOMOLOGY_106)} 种")
print(f"  - 第一批（2002年）: {len(FIRST_BATCH)} 种")
print(f"  - 第二批（2019年）: {len(SECOND_BATCH)} 种（仅香辛料）")
print(f"  - 第三批（2023年）: {len(THIRD_BATCH)} 种")
print(f"  - 第四批（2024年）: {len(FOURTH_BATCH)} 种")

# ============================================================
# 加载RMCHM数据
# ============================================================
print("\n\n[加载] RMCHM数据...")
with open('D:/RMFOODFP/data/rmchm/rmchm_merged_herbs_v34.json', 'r', encoding='utf-8') as f:
    herbs = json.load(f)

print(f"  总药材数: {len(herbs)}")

# 建立名称查找表
herb_lookup = {h['name_cn']: h for h in herbs}
print(f"  唯一名称: {len(herb_lookup)} 个")

# ============================================================
# 分析函数
# ============================================================
def normalize_name(name):
    """标准化药材名"""
    if not name:
        return ''
    # 去除括号及内容
    name = re.sub(r'[（(].*?[）)]', '', name)
    # 去除前缀
    name = re.sub(r'^鲜/', '', name)
    name = re.sub(r'^姜（', '姜', name)
    name = re.sub(r'^枣（', '枣', name)
    name = re.sub(r'^杏仁（', '杏仁', name)
    name = re.sub(r'\s+', '', name)
    return name.strip()

def find_match(official_name, herb_lookup):
    """在RMCHM中查找匹配的药材"""
    norm_official = normalize_name(official_name)
    
    # 精确匹配
    if official_name in herb_lookup:
        return official_name, herb_lookup[official_name]
    
    # 标准化匹配
    if norm_official in herb_lookup:
        return norm_official, herb_lookup[norm_official]
    
    # 模糊匹配
    best_match = None
    best_score = 0
    for herb_name in herb_lookup.keys():
        norm_herb = normalize_name(herb_name)
        # 简单包含匹配
        if norm_official in norm_herb or norm_herb in norm_official:
            if len(norm_official) > best_score:
                best_score = len(norm_official)
                best_match = herb_name
    
    if best_match:
        return best_match, herb_lookup[best_match]
    
    return None, None

# ============================================================
# 对比分析
# ============================================================
print("\n\n[分析] 药食同源对比分析...")

matched = []  # 已匹配的
unmatched = []  # 未匹配的
already_marked = []  # 已有标记的
needs_marking = []  # 需要添加标记的

for official_name in OFFICIAL_HOMOLOGY_106:
    match_name, herb = find_match(official_name, herb_lookup)
    
    if match_name and herb:
        matched.append({
            'official': official_name,
            'matched': match_name,
            'herb': herb
        })
        
        # 检查是否已有标记
        if herb.get('is_food_homology'):
            already_marked.append(match_name)
        else:
            needs_marking.append(match_name)
    else:
        unmatched.append(official_name)

print(f"\n  已匹配: {len(matched)} 种")
print(f"  未匹配: {len(unmatched)} 种")
print(f"    - 已有标记: {len(already_marked)} 种")
print(f"    - 需要标记: {len(needs_marking)} 种")

# ============================================================
# 详细报告
# ============================================================
print("\n\n" + "=" * 70)
print("  详细分析报告")
print("=" * 70)

# 第一批
print("\n【第一批（2002年，87种）】")
first_matched = [m for m in matched if m['official'] in FIRST_BATCH]
first_unmatched = [n for n in FIRST_BATCH if n not in [m['official'] for m in matched]]
print(f"  已匹配: {len(first_matched)} 种")
print(f"  未匹配: {len(first_unmatched)} 种")
if first_unmatched:
    print(f"  缺失: {first_unmatched}")

# 第二批
print("\n【第二批（2019年，6种，仅香辛料）】")
second_matched = [m for m in matched if m['official'] in SECOND_BATCH]
second_unmatched = [n for n in SECOND_BATCH if n not in [m['official'] for m in matched]]
print(f"  已匹配: {len(second_matched)} 种")
print(f"  未匹配: {len(second_unmatched)} 种")

# 第三批
print("\n【第三批（2023年，9种）】")
third_matched = [m for m in matched if m['official'] in THIRD_BATCH]
third_unmatched = [n for n in THIRD_BATCH if n not in [m['official'] for m in matched]]
print(f"  已匹配: {len(third_matched)} 种")
print(f"  未匹配: {len(third_unmatched)} 种")
if third_unmatched:
    print(f"  缺失: {third_unmatched}")

# 第四批
print("\n【第四批（2024年，4种）】")
fourth_matched = [m for m in matched if m['official'] in FOURTH_BATCH]
fourth_unmatched = [n for n in FOURTH_BATCH if n not in [m['official'] for m in matched]]
print(f"  已匹配: {len(fourth_matched)} 种")
print(f"  未匹配: {len(fourth_unmatched)} 种")
if fourth_unmatched:
    print(f"  缺失: {fourth_unmatched}")

# ============================================================
# 统计汇总
# ============================================================
print("\n\n" + "=" * 70)
print("  汇总统计")
print("=" * 70)

current_homology_count = sum(1 for h in herbs if h.get('is_food_homology'))
print(f"\n  当前药食同源标记数: {current_homology_count} 条")
print(f"  官方目录总数: {len(OFFICIAL_HOMOLOGY_106)} 种")
print(f"  已匹配官方目录: {len(matched)} 种")
print(f"  未匹配官方目录: {len(unmatched)} 种")
print(f"  需要添加标记: {len(needs_marking)} 种")

print(f"\n  匹配率: {len(matched)*100//len(OFFICIAL_HOMOLOGY_106)}%")
print(f"  覆盖率: {len(matched)*100//len(herbs)}%")

# ============================================================
# 保存分析报告
# ============================================================
analysis_report = {
    'analysis_date': datetime.now(timezone.utc).isoformat(),
    'version': 'v3.5',
    'official_catalog': {
        'total': len(OFFICIAL_HOMOLOGY_106),
        'batches': {
            'first': {'count': len(FIRST_BATCH), 'list': FIRST_BATCH},
            'second': {'count': len(SECOND_BATCH), 'list': SECOND_BATCH, 'note': '仅香辛料'},
            'third': {'count': len(THIRD_BATCH), 'list': THIRD_BATCH},
            'fourth': {'count': len(FOURTH_BATCH), 'list': FOURTH_BATCH},
        }
    },
    'current_status': {
        'total_herbs': len(herbs),
        'current_homology_count': current_homology_count,
    },
    'gap_analysis': {
        'matched': len(matched),
        'unmatched': len(unmatched),
        'needs_marking': len(needs_marking),
        'already_marked': len(already_marked),
    },
    'matched_herbs': [m['matched'] for m in matched],
    'unmatched_herbs': unmatched,
    'needs_marking': needs_marking,
    'already_marked': already_marked,
}

out_path = 'D:/RMFOODFP/data/rmchm/homology_analysis_v35.json'
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(analysis_report, f, ensure_ascii=False, indent=2)

print(f"\n详细分析报告已保存到: {out_path}")
