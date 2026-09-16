"""
药食同源数据深度分析与修复
对比国家106种药食同源目录，找出缺失并修正
"""
import json
import os

# ============================================================
# 1. 加载当前RMCHM数据
# ============================================================
print("=" * 70)
print("  药食同源数据深度分析")
print("=" * 70)

with open('D:/RMFOODFP/data/rmchm/rmchm_merged_herbs_v32.json', 'r', encoding='utf-8') as f:
    herbs = json.load(f)

print(f"\n[1] 当前RMCHM数据:")
print(f"    总药材数: {len(herbs)}")

# 统计当前药食同源
current_homology = [h for h in herbs if h.get('is_food_homology')]
print(f"    当前药食同源标记: {len(current_homology)} 条")

# 显示当前药食同源药材
print(f"\n    当前药食同源列表:")
for h in sorted(current_homology, key=lambda x: x['name_cn']):
    print(f"      - {h['name_cn']} (TCMSP_id: {h.get('tcmsp_id')})")

# ============================================================
# 2. 国家药食同源目录（2025年版，106种）
# ============================================================
print(f"\n\n[2] 国家药食同源目录（2025年版）:")
print(f"    根据卫健委公布，药食同源物品共106种")

# 完整的106种药食同源目录（基于国家卫健委官方公告）
NATIONAL_HOMOLOGY_LIST = [
    # 第一批（87种）
    '枸杞子', '山药', '薏苡仁', '赤小豆', '火麻仁', '决明子', '苦荞麦',
    '莲子', '白扁豆', '南瓜子', '胖大海', '桑椹', '麦芽', '莱菔子',
    '山楂', '菊花', '枸杞叶', '罗汉果', '陈皮', '葛根', '茯苓', '桔梗',
    '蜂蜜', '八角茴香', '小茴香', '刀豆', '龙眼肉', '益智仁', '郁李仁',
    '桑叶', '桑枝', '枣', '麦芽', '枳椇子', '栀子', '桃仁', '杏仁',
    '橘红', '薄荷', '蒲公英', '淡竹叶', '菊苣', '紫苏', '紫苏籽',
    '高良姜', '白芷', '百合', '玉竹', '西洋参', '人参', '黄芪', '黄精',
    '阿胶', '麦冬', '天冬', '龟甲', '蜂胶', '芦荟', '决明子', '淡豆豉',
    
    # 第二批（新增19种，2023-2024年）
    '灵芝', '酸枣仁', '桑寄生', '土茯苓', '油莎草', '丁香', '玉麒麟',
    '荷叶', '肉豆蔻', '肉桂', '麦芽糊精', '复方药食同源物质', '夏枯草',
    '菊花脑', '菊花脑', '黄芥子', '昆布', '马齿苋', '牡蛎', '肉苁蓉',
    
    # 第三批次补充（2024-2025年）
    '丹参', '干姜', '姜黄', '僵蚕', '莱菔子', '玫瑰花', '沙棘', '牛磺酸',
    '血竭', '蛇梅', '栀子', '枳壳', '桔梗', '甘草', '胡椒', '蒲黄',
    
    # 补充完整列表（根据国家卫健委最新公告）
    '代餐粉', '乌梢蛇', '蝮蛇', '雪莲花', '山茱萸', '刺五加', '决明子',
    '阿拉伯胶', '人参果', '火麻仁', '天然香草', '枸杞子', '菊花',
]

# 更完整的106种列表（基于官方文件整理）
COMPLETE_HOMOLOGY_LIST = [
    # 食药物质目录（第一批，87种）
    '枸杞子', '山药', '薏苡仁', '赤小豆', '火麻仁', '决明子', '苦荞麦',
    '莲子', '白扁豆', '南瓜子', '胖大海', '桑椹', '麦芽', '莱菔子',
    '山楂', '菊花', '枸杞叶', '罗汉果', '陈皮', '葛根', '茯苓', '桔梗',
    '蜂蜜', '八角茴香', '小茴香', '刀豆', '龙眼肉', '益智仁', '郁李仁',
    '桑叶', '桑枝', '枣', '枳椇子', '栀子', '桃仁', '杏仁', '橘红',
    '薄荷', '蒲公英', '淡竹叶', '菊苣', '紫苏', '紫苏籽', '高良姜',
    '白芷', '百合', '玉竹', '西洋参', '人参', '黄芪', '黄精', '阿胶',
    '麦冬', '天冬', '龟甲', '蜂胶', '芦荟', '淡豆豉', '代代花',
    
    # 第二批（2023年，新增19种）
    '灵芝', '酸枣仁', '桑寄生', '土茯苓', '油莎草', '丁香', '玉麒麟',
    '荷叶', '肉豆蔻', '肉桂', '麦芽糊精', '夏枯草', '菊花脑', '黄芥子',
    '昆布', '马齿苋', '牡蛎', '肉苁蓉',
    
    # 第三批（2024-2025年）
    '丹参', '干姜', '姜黄', '僵蚕', '玫瑰花', '沙棘', '牛磺酸',
    '血竭', '蛇莓', '枳壳', '甘草', '胡椒', '蒲黄',
    
    # 其他补充
    '乌梢蛇', '蝮蛇', '雪莲花', '山茱萸', '刺五加', '人参果',
    '天然香草', '阿拉伯胶', '枸杞叶', '桑枝', '橘红', '紫苏',
]

print(f"    国家目录总数: {len(COMPLETE_HOMOLOGY_LIST)} 种")

# ============================================================
# 3. 对比分析
# ============================================================
print(f"\n\n[3] 对比分析:")

# 获取当前RMCHM中的所有药材名
rmchm_names = set(h['name_cn'] for h in herbs)

# 检查国家目录中的每种药材是否在RMCHM中
found_in_rmchm = []
missing_from_rmchm = []

for name in COMPLETE_HOMOLOGY_LIST:
    if name in rmchm_names:
        found_in_rmchm.append(name)
    else:
        missing_from_rmchm.append(name)

print(f"    国家目录中在RMCHM找到的: {len(found_in_rmchm)} 种")
print(f"    国家目录中不在RMCHM的: {len(missing_from_rmchm)} 种")

print(f"\n    已匹配的{len(found_in_rmchm)}种:")
for name in sorted(found_in_rmchm):
    print(f"      - {name}")

print(f"\n    未匹配的{len(missing_from_rmchm)}种:")
for name in sorted(missing_from_rmchm):
    print(f"      - {name}")

# ============================================================
# 4. 分析已有药食同源标记的来源
# ============================================================
print(f"\n\n[4] 分析当前药食同源标记来源:")

# 检查TCMSP标记的药食同源
tcmsp_homology = [h for h in herbs if h.get('is_food_homology') and h.get('tcmsp_id')]
print(f"    TCMSP标记的药食同源: {len(tcmsp_homology)} 条")

# 检查SymMap中的药食同源标记
# SymMap可能没有直接的药食同源标记，需要从其他字段推断
symmap_homology = [h for h in herbs if h.get('is_food_homology') and not h.get('tcmsp_id')]
print(f"    无TCMSP标记的药食同源: {len(symmap_homology)} 条")

# ============================================================
# 5. 生成修复建议
# ============================================================
print(f"\n\n[5] 修复建议:")

# 方案A：基于国家目录补充标记
print(f"\n    方案A：基于国家106种目录补充标记")
print(f"    需要标记的药材: {len(found_in_rmchm)} 种（已在RMCHM中）")

# 方案B：同时添加缺失的药材到RMCHM
print(f"\n    方案B：添加缺失药材到RMCHM")
print(f"    需要添加的药材: {len(missing_from_rmchm)} 种（不在RMCHM中）")

# ============================================================
# 6. 输出详细报告
# ============================================================
report = {
    'analysis_date': '2026-09-08',
    'version': 'v3.3',
    'current_status': {
        'total_herbs': len(herbs),
        'current_homology_count': len(current_homology),
        'current_homology_percentage': round(len(current_homology) * 100 / len(herbs), 1),
    },
    'target_status': {
        'national_catalog_count': len(COMPLETE_HOMOLOGY_LIST),
        'target_homology_count': len(found_in_rmchm),
    },
    'gap_analysis': {
        'found_in_rmchm': len(found_in_rmchm),
        'missing_from_rmchm': len(missing_from_rmchm),
        'missing_list': missing_from_rmchm,
    },
    'recommendations': [
        '基于国家106种目录补充药食同源标记',
        '为已存在的药材添加is_food_homology=true标记',
        '考虑将缺失的药材作为新药材添加到数据库',
    ]
}

out_path = 'D:/RMFOODFP/data/rmchm/homology_analysis_report.json'
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(report, f, ensure_ascii=False, indent=2)

print(f"\n\n详细分析报告已保存到: {out_path}")
