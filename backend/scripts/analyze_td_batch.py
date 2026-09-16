"""
TCMSP td_batch文件详细分析 - 获取药材-化合物-靶点-疾病完整关联
"""
import json
import os
from collections import defaultdict

td_dir = 'D:/RMFOODFP/tcmsp_data/data'
herb_data = {}

print("=" * 70)
print("  TCMSP td_batch 文件详细分析")
print("=" * 70)

# 读取所有批次文件
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
                        herb_data[name] = item
        except Exception as e:
            pass

print(f"\n药材详情记录数: {len(herb_data)}")

# 分析数据结构
if herb_data:
    sample = list(herb_data.values())[0]
    print(f"\n样本数据字段:")
    for k, v in sample.items():
        if isinstance(v, list):
            print(f"  {k}: list[{len(v)}]")
        elif isinstance(v, dict):
            print(f"  {k}: dict")
        else:
            print(f"  {k}: {str(v)[:60]}")

# 统计化合物/靶点/疾病数量
total_compounds = 0
total_targets = 0
total_diseases = 0

for name, data in herb_data.items():
    compounds = data.get('compounds', [])
    targets = data.get('targets', [])
    diseases = data.get('diseases', [])
    total_compounds += len(compounds)
    total_targets += len(targets)
    total_diseases += len(diseases)

print(f"\n关联数据统计:")
print(f"  化合物总数: {total_compounds:,}")
print(f"  靶点总数: {total_targets:,}")
print(f"  疾病总数: {total_diseases:,}")

# 检查化合物字段
print(f"\n化合物字段示例（第一条记录）:")
if herb_data:
    first_name = list(herb_data.keys())[0]
    first_item = herb_data[first_name]
    compounds = first_item.get('compounds', [])
    if compounds:
        print(f"  化合物字段: {list(compounds[0].keys()) if isinstance(compounds[0], dict) else 'not dict'}")
        print(f"  首条化合物: {compounds[0] if isinstance(compounds[0], str) else compounds[0]}")

# 检查是否有OB/DL字段
has_ob = False
has_dl = False
for name, data in herb_data.items():
    obs = data.get('ob_percent', [])
    dls = data.get('dl_value', [])
    if obs or dls:
        has_ob = True
        has_dl = True
        break

print(f"\nOB%/DL字段: ob={'有' if has_ob else '无'}, dl={'有' if has_dl else '无'}")

# 保存分析结果
analysis = {
    'total_herbs': len(herb_data),
    'total_compounds': total_compounds,
    'total_targets': total_targets,
    'total_diseases': total_diseases,
    'sample_herb': first_name if herb_data else None,
    'sample_compound_fields': list(compounds[0].keys()) if compounds and isinstance(compounds[0], dict) else [],
}

out_path = 'D:/RMFOODFP/data/rmchm/tcmsp_td_batch_analysis.json'
with open(out_path, 'w', encoding='utf-8') as f:
    json.dump(analysis, f, ensure_ascii=False, indent=2)
print(f"\n分析结果已保存到: {out_path}")
