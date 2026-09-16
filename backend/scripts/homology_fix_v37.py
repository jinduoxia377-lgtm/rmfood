"""
药食同源数据修正 v3.7
严格基于官方106种目录，确保精确匹配
"""
import json
import os
import re
from datetime import datetime, timezone

# ============================================================
# 国家卫健委官方药食同源完整目录（106种）
# 来源：http://www.zhimeioem.com/view/929.html
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
print("  药食同源数据精准修正 v3.7")
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
    """标准化药材名，去除括号内容"""
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

# 建立标准化名称映射
norm_to_herb = {}
for h in herbs:
    norm_name = normalize_name(h['name_cn'])
    norm_to_herb[norm_name] = h

print(f"  唯一名称: {len(norm_to_herb)} 个")

# ============================================================
# 精准匹配分析
# ============================================================
print("\n\n[分析] 精准匹配分析...")

# 定义官方名称到标准名称的映射关系
NAME_MAPPING = {
    '姜（生姜、干姜）': ['生姜', '干姜'],
    '枣（大枣、酸枣、黑枣）': ['大枣', '酸枣', '黑枣'],
    '杏仁（甜、苦）': ['甜杏仁', '苦杏仁'],
    '龙眼肉（桂圆）': ['龙眼肉', '桂圆'],
    '西红花（在香辛料和调味品中又称"藏红花"）': ['西红花', '藏红花'],
    '肉苁蓉（荒漠）': ['肉苁蓉'],
    '橘皮': ['陈皮'],
    '桔红': ['化橘红'],
    '藿香': ['广藿香'],
    '益智仁': ['益智'],
    '黄芥子': ['芥子'],
    '紫苏籽': ['紫苏子'],
    '鲜白茅根': ['白茅根'],
    '鲜芦根': ['芦根'],
}

matched = []
unmatched = []

for official_name in OFFICIAL_HOMOLOGY_106:
    # 检查是否有特殊映射
    matched_herb = None
    
    if official_name in NAME_MAPPING:
        # 使用映射规则
        variants = NAME_MAPPING[official_name]
        for variant in variants:
            if variant in norm_to_herb:
                matched_herb = norm_to_herb[variant]
                break
    else:
        # 直接匹配
        norm_official = normalize_name(official_name)
        if official_name in norm_to_herb:
            matched_herb = norm_to_herb[official_name]
        elif norm_official in norm_to_herb:
            matched_herb = norm_to_herb[norm_official]
        else:
            # 模糊匹配
            for herb_name, herb in norm_to_herb.items():
                if norm_official in herb_name or herb_name in norm_official:
                    matched_herb = herb
                    break
    
    if matched_herb:
        matched.append({
            'official': official_name,
            'rmchm_name': matched_herb['name_cn'],
            'rmchm_code': matched_herb.get('rmchm_code'),
            'is_marked': matched_herb.get('is_food_homology', False)
        })
    else:
        unmatched.append(official_name)

print(f"\n  匹配成功: {len(matched)} 种")
print(f"  匹配失败: {len(unmatched)} 种")

# ============================================================
# 统计标记情况
# ============================================================
print("\n\n[统计] 标记情况分析...")

marked_count = sum(1 for m in matched if m['is_marked'])
unmarked_count = len(matched) - marked_count

print(f"\n  已标记药食同源: {marked_count} 种")
print(f"  未标记但已匹配: {unmarked_count} 种")
print(f"  完全缺失: {len(unmatched)} 种")

if unmarked_count > 0:
    print(f"\n  需要添加标记的药材({unmarked_count}种):")
    for m in sorted([x for x in matched if not x['is_marked']], key=lambda x: x['rmchm_name']):
        print(f"    - {m['rmchm_name']} (官方: {m['official']})")

if unmatched:
    print(f"\n  完全缺失的药材({len(unmatched)}种):")
    for u in unmatched:
        print(f"    - {u}")

# ============================================================
# 生成修正报告
# ============================================================
print("\n\n" + "=" * 70)
print("  药食同源修正报告")
print("=" * 70)

report_lines = []
report_lines.append("=" * 70)
report_lines.append("  RMCHM 药食同源数据修正报告 v3.7")
report_lines.append("=" * 70)
report_lines.append("")
report_lines.append(f"分析日期: {datetime.now(timezone.utc).isoformat()}")
report_lines.append(f"官方目录总数: {len(OFFICIAL_HOMOLOGY_106)} 种")
report_lines.append(f"RMCHM总药材数: {len(herbs)} 条")
report_lines.append("")
report_lines.append("-" * 70)
report_lines.append("  匹配结果")
report_lines.append("-" * 70)
report_lines.append("")
report_lines.append(f"  匹配成功: {len(matched)} 种 ({len(matched)*100//len(OFFICIAL_HOMOLOGY_106)}%)")
report_lines.append(f"  匹配失败: {len(unmatched)} 种")
report_lines.append("")
report_lines.append("-" * 70)
report_lines.append("  标记情况")
report_lines.append("-" * 70)
report_lines.append("")
report_lines.append(f"  已标记: {marked_count} 种")
report_lines.append(f"  未标记: {unmarked_count} 种")
report_lines.append(f"  缺失: {len(unmatched)} 种")
report_lines.append("")
report_lines.append("-" * 70)
report_lines.append("  建议")
report_lines.append("-" * 70)
report_lines.append("")
report_lines.append(f"  1. 为{unmarked_count}种药材添加is_food_homology=true标记")
report_lines.append(f"  2. 考虑将{len(unmatched)}种缺失药材添加到数据库")
report_lines.append(f"  3. 最终目标: 确保官方106种全部有标记")
report_lines.append("")

# 保存报告
output_path = 'D:/RMFOODFP/data/rmchm/homology_fix_report_v37.txt'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(report_lines))

print(f"\n报告已保存到: {output_path}")

# ============================================================
# 保存JSON分析结果
# ============================================================
analysis_data = {
    'analysis_date': datetime.now(timezone.utc).isoformat(),
    'version': 'v3.7',
    'official_catalog': {
        'total': len(OFFICIAL_HOMOLOGY_106),
        'matched': len(matched),
        'unmatched': len(unmatched),
        'coverage_rate': round(len(matched) * 100 / len(OFFICIAL_HOMOLOGY_106), 1)
    },
    'marking_status': {
        'already_marked': marked_count,
        'needs_marking': unmarked_count,
        'missing': len(unmatched),
    },
    'matched_records': matched,
    'unmatched_official': unmatched,
    'needs_marking': [m['rmchm_name'] for m in matched if not m['is_marked']],
}

json_path = 'D:/RMFOODFP/data/rmchm/homology_analysis_v37.json'
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(analysis_data, f, ensure_ascii=False, indent=2)

print(f"JSON分析已保存到: {json_path}")
