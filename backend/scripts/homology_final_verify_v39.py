"""
药食同源最终验证报告 v3.9
精确统计官方106种覆盖情况
"""
import json
from datetime import datetime, timezone

print("=" * 70)
print("  药食同源最终验证报告 v3.9")
print("=" * 70)

# ============================================================
# 加载数据
# ============================================================
with open('D:/RMFOODFP/data/rmchm/rmchm_merged_herbs_v38.json', 'r', encoding='utf-8') as f:
    herbs = json.load(f)

print(f"\n总药材数: {len(herbs)}")

# 建立查找表
herb_lookup = {h['name_cn']: h for h in herbs}

# 官方106种完整列表（使用标准名称）
OFFICIAL_106 = [
    # 第一批87种
    '丁香', '八角茴香', '刀豆', '小茴香', '小蓟', '山药', '山楂', '马齿苋',
    '乌梢蛇', '乌梅', '木瓜', '火麻仁', '代代花', '玉竹', '甘草', '白芷',
    '白果', '白扁豆', '白扁豆花', '龙眼肉', '决明子', '百合',
    '肉豆蔻', '肉桂', '余甘子', '佛手', '甜杏仁', '沙棘', '牡蛎',
    '芡实', '花椒', '赤小豆', '阿胶', '鸡内金', '麦芽', '昆布', '大枣',
    '罗汉果', '郁李仁', '金银花', '青果', '鱼腥草', '生姜',
    '枳椇子', '枸杞子', '栀子', '砂仁', '胖大海', '茯苓', '香橼', '香薷',
    '桃仁', '桑叶', '桑椹', '桔梗', '桔梗', '益智', '荷叶', '莱菔子',
    '莲子', '高良姜', '淡竹叶', '淡豆豉', '菊花', '菊苣', '黄芥子', '黄精',
    '紫苏', '紫苏子', '葛根', '黑芝麻', '黑胡椒', '槐米', '槐花', '蒲公英',
    '蜂蜜', '榧子', '酸枣仁', '白茅根', '芦根', '蝮蛇', '陈皮', '薄荷',
    '薏苡仁', '薤白', '覆盆子', '藿香',
    # 第二批6种
    '当归', '山柰', '西红花', '草果', '姜黄', '荜茇',
    # 第三批9种
    '党参', '肉苁蓉', '铁皮石斛', '西洋参', '黄芪', '灵芝',
    '山茱萸', '天麻', '杜仲叶',
    # 第四批4种
    '地黄', '麦冬', '天冬', '化橘红'
]

# 名称映射（官方名称 -> RMCHM名称）
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
    '龙眼肉（桂圆）': '龙眼肉',
    '肉苁蓉（荒漠）': '肉苁蓉',
    '西红花（在香辛料和调味品中又称"藏红花"）': '西红花',
}

print("\n[验证] 官方106种覆盖情况...")

marked = []
unmarked = []
missing = []

for official_name in OFFICIAL_106:
    # 检查直接匹配
    if official_name in herb_lookup:
        herb = herb_lookup[official_name]
        if herb.get('is_food_homology'):
            marked.append(official_name)
        else:
            unmarked.append(official_name)
    # 检查映射匹配
    elif official_name in NAME_MAPPING:
        rmchm_name = NAME_MAPPING[official_name]
        if rmchm_name in herb_lookup:
            herb = herb_lookup[rmchm_name]
            if herb.get('is_food_homology'):
                marked.append(f"{official_name} -> {rmchm_name}")
            else:
                unmarked.append(f"{official_name} -> {rmchm_name}")
        else:
            missing.append(official_name)
    else:
        missing.append(official_name)

print(f"\n  已标记: {len(marked)}/106")
print(f"  未标记: {len(unmarked)}")
print(f"  缺失: {len(missing)}")

if unmarked:
    print(f"\n  未标记的药材:")
    for u in unmarked:
        print(f"    - {u}")

if missing:
    print(f"\n  缺失的药材:")
    for m in missing:
        print(f"    - {m}")

# ============================================================
# 最终统计
# ============================================================
print("\n\n" + "=" * 70)
print("  最终统计")
print("=" * 70)

total_homology = sum(1 for h in herbs if h.get('is_food_homology'))

print(f"\n  总药材数: {len(herbs)}")
print(f"  药食同源标记总数: {total_homology} 条")
print(f"  官方106种已标记: {len(marked)} 种")
print(f"  覆盖率: {len(marked)*100//106}%")

# ============================================================
# 保存报告
# ============================================================
report = {
    'analysis_date': datetime.now(timezone.utc).isoformat(),
    'version': 'v3.9',
    'summary': {
        'total_herbs': len(herbs),
        'homology_total': total_homology,
        'official_106_marked': len(marked),
        'official_106_unmarked': len(unmarked),
        'official_106_missing': len(missing),
        'coverage_rate': f"{len(marked)}/106 ({len(marked)*100//106}%)"
    },
    'marked_list': marked,
    'unmarked_list': unmarked,
    'missing_list': missing,
}

out_path = 'D:/RMFOODFP/data/rmchm/homology_final_report_v39.json'
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(report, f, ensure_ascii=False, indent=2)

print(f"\n详细报告已保存到: {out_path}")
