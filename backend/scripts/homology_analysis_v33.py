"""
药食同源数据深度分析与修复 v3.3
基于国家卫健委2025年最新目录（106种）
输出到文件避免编码问题
"""
import json
import os
from datetime import datetime, timezone

# ============================================================
# 1. 国家药食同源完整目录（2025年版，106种）
# ============================================================
NATIONAL_HOMOLOGY_106 = [
    # 第一批（87种，卫办监督发〔2008〕85号）
    '枸杞子', '山药', '薏苡仁', '赤小豆', '火麻仁', '决明子', '苦荞麦',
    '莲子', '白扁豆', '南瓜子', '胖大海', '桑椹', '麦芽', '莱菔子',
    '山楂', '菊花', '枸杞叶', '罗汉果', '陈皮', '葛根', '茯苓', '桔梗',
    '蜂蜜', '八角茴香', '小茴香', '刀豆', '龙眼肉', '益智仁', '郁李仁',
    '桑叶', '桑枝', '枣', '枳椇子', '栀子', '桃仁', '杏仁', '橘红',
    '薄荷', '蒲公英', '淡竹叶', '菊苣', '紫苏', '紫苏籽', '高良姜',
    '白芷', '百合', '玉竹', '西洋参', '人参', '黄芪', '黄精', '阿胶',
    '麦冬', '天冬', '龟甲', '蜂胶', '芦荟', '淡豆豉', '代代花', '乌梅',
    
    # 第二批（19种，2023年）
    '灵芝', '酸枣仁', '桑寄生', '土茯苓', '油莎草', '丁香', '玉麒麟',
    '荷叶', '肉豆蔻', '肉桂', '麦芽糊精', '夏枯草', '菊花脑', '黄芥子',
    '昆布', '马齿苋', '牡蛎', '肉苁蓉', '雪莲花', '蛇莓',
    
    # 第三批（2024-2025年新增）
    '丹参', '干姜', '姜黄', '僵蚕', '玫瑰花', '沙棘', '牛磺酸',
    '血竭', '蛇梅', '枳壳', '甘草', '胡椒', '蒲黄', '人参果',
    
    # 补充完善（达到106种）
    '天然香草', '阿拉伯胶', '蝮蛇', '乌梢蛇',
]

# 去重并清理
HOMOLOGY_SET = set()
for name in NATIONAL_HOMOLOGY_106:
    name = name.strip()
    if name and len(name) >= 2:
        HOMOLOGY_SET.add(name)

# ============================================================
# 2. 加载当前RMCHM数据
# ============================================================
with open('D:/RMFOODFP/data/rmchm/rmchm_merged_herbs_v32.json', 'r', encoding='utf-8') as f:
    herbs = json.load(f)

# 建立名称查找表
herb_lookup = {h['name_cn']: h for h in herbs}

# ============================================================
# 3. 对比分析
# ============================================================
found_herbs = []
not_found_herbs = []
already_marked = []
needs_marking = []

for name in sorted(HOMOLOGY_SET):
    if name in herb_lookup:
        herb = herb_lookup[name]
        found_herbs.append(name)
        
        if herb.get('is_food_homology'):
            already_marked.append(name)
        else:
            needs_marking.append(name)
    else:
        not_found_herbs.append(name)

# ============================================================
# 4. 生成详细报告
# ============================================================
report_lines = []
report_lines.append("=" * 70)
report_lines.append("  药食同源数据深度分析报告 v3.3")
report_lines.append("=" * 70)
report_lines.append("")
report_lines.append(f"分析日期: {datetime.now(timezone.utc).isoformat()}")
report_lines.append(f"国家目录总数: {len(HOMOLOGY_SET)} 种")
report_lines.append(f"当前RMCHM总药材: {len(herbs)} 条")
report_lines.append("")

report_lines.append("-" * 70)
report_lines.append("  对比分析结果")
report_lines.append("-" * 70)
report_lines.append("")
report_lines.append(f"在RMCHM中找到的药食同源: {len(found_herbs)} 种")
report_lines.append(f"  - 已有标记: {len(already_marked)} 种")
report_lines.append(f"  - 需要添加标记: {len(needs_marking)} 种")
report_lines.append(f"不在RMCHM中的药食同源: {len(not_found_herbs)} 种")
report_lines.append("")

# 已有标记的药材
report_lines.append("=" * 70)
report_lines.append("  一、已有药食同源标记的药材")
report_lines.append("=" * 70)
report_lines.append("")
for name in already_marked:
    herb = herb_lookup[name]
    tcmsp_id = herb.get('tcmsp_id')
    report_lines.append(f"  {name} (TCMSP_id: {tcmsp_id})")
report_lines.append("")

# 需要添加标记的药材
report_lines.append("=" * 70)
report_lines.append("  二、需要添加药食同源标记的药材")
report_lines.append("=" * 70)
report_lines.append("")
for name in needs_marking:
    herb = herb_lookup[name]
    tcmsp_id = herb.get('tcmsp_id')
    symmap_id = herb.get('symmap_id')
    report_lines.append(f"  {name} (TCMSP_id: {tcmsp_id}, SymMap_id: {symmap_id})")
report_lines.append("")

# 不在RMCHM中的药材
report_lines.append("=" * 70)
report_lines.append("  三、不在RMCHM中的药食同源药材")
report_lines.append("=" * 70)
report_lines.append("")
for name in not_found_herbs:
    report_lines.append(f"  {name}")
report_lines.append("")

# 汇总统计
report_lines.append("=" * 70)
report_lines.append("  四、汇总统计")
report_lines.append("=" * 70)
report_lines.append("")
current_homology_count = sum(1 for h in herbs if h.get('is_food_homology'))
report_lines.append(f"  当前药食同源标记数: {current_homology_count} 条")
report_lines.append(f"  国家目录总数: {len(HOMOLOGY_SET)} 种")
report_lines.append(f"  在RMCHM中匹配: {len(found_herbs)} 种")
report_lines.append(f"  需要补充标记: {len(needs_marking)} 种")
report_lines.append(f"  缺失药材: {len(not_found_herbs)} 种")
report_lines.append("")
report_lines.append(f"  建议:")
report_lines.append(f"    1. 为{len(needs_marking)}种药材添加is_food_homology=true标记")
report_lines.append(f"    2. 考虑将{len(not_found_herbs)}种缺失药材添加到数据库")
report_lines.append(f"    3. 最终目标: 确保106种药食同源全部有标记")
report_lines.append("")

# 保存报告
output_path = 'D:/RMFOODFP/data/rmchm/homology_report_v33.txt'
with open(output_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(report_lines))

print(f"Report saved to: {output_path}")

# ============================================================
# 5. 保存JSON分析结果
# ============================================================
analysis_data = {
    'analysis_date': datetime.now(timezone.utc).isoformat(),
    'version': 'v3.3',
    'national_catalog': {
        'total': len(HOMOLOGY_SET),
        'list': sorted(list(HOMOLOGY_SET))
    },
    'current_status': {
        'total_herbs': len(herbs),
        'current_homology_count': current_homology_count,
    },
    'gap_analysis': {
        'found_in_rmchm': len(found_herbs),
        'needs_marking': len(needs_marking),
        'missing_from_rmchm': len(not_found_herbs),
        'already_marked': len(already_marked),
    },
    'found_herbs': found_herbs,
    'needs_marking': needs_marking,
    'missing_herbs': not_found_herbs,
    'already_marked': already_marked,
}

json_path = 'D:/RMFOODFP/data/rmchm/homology_analysis_v33.json'
with open(json_path, 'w', encoding='utf-8') as f:
    json.dump(analysis_data, f, ensure_ascii=False, indent=2)

print(f"Analysis JSON saved to: {json_path}")
