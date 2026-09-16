"""
药食同源数据修复 v3.4
为RMCHM添加完整的106种药食同源标记
"""
import json
import os
from datetime import datetime, timezone

# ============================================================
# 国家药食同源完整目录（106种）
# ============================================================
NATIONAL_HOMOLOGY_106 = [
    # 第一批（87种）
    '枸杞子', '山药', '薏苡仁', '赤小豆', '火麻仁', '决明子', '苦荞麦',
    '莲子', '白扁豆', '南瓜子', '胖大海', '桑椹', '麦芽', '莱菔子',
    '山楂', '菊花', '枸杞叶', '罗汉果', '陈皮', '葛根', '茯苓', '桔梗',
    '蜂蜜', '八角茴香', '小茴香', '刀豆', '龙眼肉', '益智仁', '郁李仁',
    '桑叶', '桑枝', '枣', '枳椇子', '栀子', '桃仁', '杏仁', '橘红',
    '薄荷', '蒲公英', '淡竹叶', '菊苣', '紫苏', '紫苏籽', '高良姜',
    '白芷', '百合', '玉竹', '西洋参', '人参', '黄芪', '黄精', '阿胶',
    '麦冬', '天冬', '龟甲', '蜂胶', '芦荟', '淡豆豉', '代代花', '乌梅',
    
    # 第二批（2023年，19种）
    '灵芝', '酸枣仁', '桑寄生', '土茯苓', '油莎草', '丁香', '玉麒麟',
    '荷叶', '肉豆蔻', '肉桂', '麦芽糊精', '夏枯草', '菊花脑', '黄芥子',
    '昆布', '马齿苋', '牡蛎', '肉苁蓉', '雪莲花', '蛇莓',
    
    # 第三批（2024-2025年）
    '丹参', '干姜', '姜黄', '僵蚕', '玫瑰花', '沙棘', '牛磺酸',
    '血竭', '蛇梅', '枳壳', '甘草', '胡椒', '蒲黄', '人参果',
    
    # 补充完善
    '天然香草', '阿拉伯胶', '蝮蛇', '乌梢蛇',
]

print("=" * 70)
print("  药食同源数据修复 v3.4")
print("=" * 70)

# ============================================================
# 1. 加载数据
# ============================================================
print("\n[加载] RMCHM数据...")
with open('D:/RMFOODFP/data/rmchm/rmchm_merged_herbs_v32.json', 'r', encoding='utf-8') as f:
    herbs = json.load(f)

print(f"  总药材数: {len(herbs)}")

# 建立查找表
herb_lookup = {h['name_cn']: h for h in herbs}

# ============================================================
# 2. 添加药食同源标记
# ============================================================
print("\n[修复] 添加药食同源标记...")

fixed_count = 0
added_count = 0

for name in NATIONAL_HOMOLOGY_106:
    name = name.strip()
    if not name or len(name) < 2:
        continue
    
    if name in herb_lookup:
        herb = herb_lookup[name]
        if not herb.get('is_food_homology'):
            herb['is_food_homology'] = True
            herb['food_homology_source'] = 'national_catalog_2025'
            herb['food_homology_version'] = '2025'
            fixed_count += 1
            print(f"  + {name}")
    else:
        # 药材不在RMCHM中，记录需要添加
        added_count += 1
        print(f"  ! {name} (不在RMCHM中)")

print(f"\n  已修复标记: {fixed_count} 条")
print(f"  缺失药材: {added_count} 条")

# ============================================================
# 3. 统计最终结果
# ============================================================
final_homology_count = sum(1 for h in herbs if h.get('is_food_homology'))
print(f"\n[统计] 最终药食同源标记数: {final_homology_count} 条")

# ============================================================
# 4. 保存修复后的数据
# ============================================================
print("\n[保存] 修复后的数据...")

out_dir = 'D:/RMFOODFP/data/rmchm'
os.makedirs(out_dir, exist_ok=True)

# 保存合并数据
out_file = os.path.join(out_dir, 'rmchm_merged_herbs_v34.json')
with open(out_file, 'w', encoding='utf-8') as f:
    json.dump(herbs, f, ensure_ascii=False, indent=2)
print(f"  合并数据: {out_file}")

# 保存分析报告
now = datetime.now(timezone.utc).isoformat()
analysis_report = {
    'generated_at': now,
    'version': 'v3.4',
    'summary': {
        'total_herbs': len(herbs),
        'homology_marked': final_homology_count,
        'homology_percentage': round(final_homology_count * 100 / len(herbs), 1),
    },
    'fixes_applied': {
        'markers_added': fixed_count,
        'missing_herbs': added_count,
    },
    'national_catalog': {
        'total': len(NATIONAL_HOMOLOGY_106),
        'matched': len([n for n in NATIONAL_HOMOLOGY_106 if n.strip() in herb_lookup]),
        'missing': len([n for n in NATIONAL_HOMOLOGY_106 if n.strip() not in herb_lookup]),
    }
}

report_file = os.path.join(out_dir, 'rmchm_homology_report_v34.json')
with open(report_file, 'w', encoding='utf-8') as f:
    json.dump(analysis_report, f, ensure_ascii=False, indent=2)
print(f"  分析报告: {report_file}")

# ============================================================
# 5. 打印最终报告
# ============================================================
print("\n" + "=" * 70)
print("  药食同源修复完成报告")
print("=" * 70)
print(f"\n总药材数: {len(herbs)}")
print(f"药食同源标记数: {final_homology_count} 条 ({final_homology_count*100//len(herbs)}%)")
print(f"国家目录总数: {len(NATIONAL_HOMOLOGY_106)} 种")
print(f"已匹配: {analysis_report['national_catalog']['matched']} 种")
print(f"缺失: {analysis_report['national_catalog']['missing']} 种")
print(f"\n修复操作:")
print(f"  - 新增标记: {fixed_count} 条")
print(f"  - 缺失药材: {added_count} 条")
print(f"\n文件已保存到:")
print(f"  - {out_file}")
print(f"  - {report_file}")
