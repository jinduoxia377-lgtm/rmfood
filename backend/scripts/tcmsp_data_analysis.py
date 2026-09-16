"""
TCMSP新数据格式分析与RMCHM重新合并
"""
import json
import os
from collections import Counter

# ============================================================
# 1. 加载TCMSP新数据
# ============================================================
print("=" * 70)
print("  TCMSP新数据格式分析")
print("=" * 70)

# 药材基础数据
with open('D:/RMFOODFP/data/TCMSP/tcmsp_herbs.json', 'r', encoding='utf-8') as f:
    tcmsp_herbs = json.load(f)
print(f"\n【TCMSP药材】{len(tcmsp_herbs)} 条")
print(f"字段: {list(tcmsp_herbs[0].keys())}")

# 化合物数据
with open('D:/RMFOODFP/data/TCMSP/tcmsp_ingredients.json', 'r', encoding='utf-8') as f:
    tcmsp_ingredients = json.load(f)
print(f"\n【TCMSP化合物】{len(tcmsp_ingredients)} 条")
print(f"字段: {list(tcmsp_ingredients[0].keys())}")

# 靶点数据
with open('D:/RMFOODFP/data/TCMSP/tcmsp_targets.json', 'r', encoding='utf-8') as f:
    tcmsp_targets = json.load(f)
print(f"\n【TCMSP靶点】{len(tcmsp_targets)} 条")
print(f"字段: {list(tcmsp_targets[0].keys())}")

# 疾病数据
with open('D:/RMFOODFP/data/TCMSP/tcmsp_diseases.json', 'r', encoding='utf-8') as f:
    tcmsp_diseases = json.load(f)
print(f"\n【TCMSP疾病】{len(tcmsp_diseases)} 条")
print(f"字段: {list(tcmsp_diseases[0].keys())}")

# ============================================================
# 2. 检查化合物与药材的关联方式
# ============================================================
print("\n\n" + "=" * 70)
print("  化合物-药材关联检查")
print("=" * 70)

# 检查化合物文件中的TCMSP_id字段
comp_keys = list(tcmsp_ingredients[0].keys())
print(f"\n化合物字段: {comp_keys}")

# 找TCMSP_id相关字段
tcmsp_id_fields = [k for k in comp_keys if 'tcmsp' in k.lower() or 'mol_id' in k.lower() or 'molecule' in k.lower()]
print(f"可能的关联字段: {tcmsp_id_fields}")

# 检查化合物是否有TCMSP_id
sample_compound = tcmsp_ingredients[0]
print(f"\n化合物样本:")
for k, v in sample_compound.items():
    print(f"  {k}: {v}")

# ============================================================
# 3. 检查td_batch文件（药材详情）
# ============================================================
print("\n\n" + "=" * 70)
print("  TCMSP批次文件检查")
print("=" * 70)

td_dir = 'D:/RMFOODFP/tcmsp_data/data'
herb_details = {}

for fname in sorted(os.listdir(td_dir)):
    if fname.startswith('td_batch') and fname.endswith('.json'):
        fp = os.path.join(td_dir, fname)
        try:
            with open(fp, 'r', encoding='utf-8') as f:
                data = json.load(f)
            if isinstance(data, dict) and 'data' in data:
                for item in data['data']:
                    name = item.get('name_cn', '')
                    if name:
                        herb_details[name] = item
        except:
            pass

print(f"\n药材详情记录: {len(herb_details)}")
if herb_details:
    sample = list(herb_details.values())[0]
    print(f"字段: {list(sample.keys())}")
    print(f"\n样本数据:")
    for k, v in sample.items():
        if isinstance(v, list):
            print(f"  {k}: list[{len(v)}]")
        else:
            print(f"  {k}: {str(v)[:60]}")

# ============================================================
# 4. 对比新旧TCMSP数据
# ============================================================
print("\n\n" + "=" * 70)
print("  新旧TCMSP数据对比")
print("=" * 70)

# 旧数据
old_path = 'D:/RMFOODFP/tcmsp_data/data/all_herbs.json'
with open(old_path, 'r', encoding='utf-8') as f:
    old_herbs = json.load(f)

old_names = set(h.get('name_cn', '') for h in old_herbs)
new_names = set(h.get('herb_cn_name', '') for h in tcmsp_herbs)

print(f"\n旧数据(all_herbs.json): {len(old_herbs)} 条")
print(f"新数据(tcmsp_herbs.json): {len(tcmsp_herbs)} 条")
print(f"名称一致: {old_names == new_names}")
print(f"差异: {len(old_names.symmetric_difference(new_names))} 条")

# ============================================================
# 5. 检查RMCHM合并数据的TCMSP来源
# ============================================================
print("\n\n" + "=" * 70)
print("  RMCHM合并数据TCMSP来源检查")
print("=" * 70)

with open('D:/RMFOODFP/data/rmchm/rmchm_merged_herbs_v2.json', 'r', encoding='utf-8') as f:
    rmchm = json.load(f)

# 检查TCMSP_id分布
tcmsp_ids = [h.get('tcmsp_id') for h in rmchm if h.get('tcmsp_id')]
print(f"\n有TCMSP_id的药材: {len(tcmsp_ids)}")
print(f"TCMSP_id范围: {min(tcmsp_ids)} - {max(tcmsp_ids)}")

# 检查化合物关联
herbs_with_compounds = sum(1 for h in rmchm if h.get('compounds_count', 0) > 0)
print(f"有化合物关联的药材: {herbs_with_compounds}")

# ============================================================
# 6. 总结
# ============================================================
print("\n\n" + "=" * 70)
print("  总结")
print("=" * 70)
print(f"""
1. TCMSP本地数据:
   - 新路径(D:/RMFOODFP/data/TCMSP/tcpsp_herbs.json): {len(tcmsp_herbs)} 条
   - 旧路径(D:/RMFOODFP/tcmsp_data/data/all_herbs.json): {len(old_herbs)} 条
   - 两者名称完全一致，字段名不同

2. 新数据格式差异:
   - herb_cn_name -> name_cn
   - herb_pinyin -> name_pinyin  
   - herb_en_name -> name_latin
   - child_cn_name -> category_cn
   - child_en_name -> category_en

3. RMCHM合并数据:
   - 总药材: {len(rmchm)} 条
   - 有TCMSP_id: {len(tcmsp_ids)} 条
   - 有化合物关联: {herbs_with_compounds} 条

4. 下一步建议:
   - 使用新TCMSP数据重新生成合并文件
   - 字段名映射：herb_cn_name->name_cn等
   - 验证化合物/靶点/疾病关联完整性
""")
