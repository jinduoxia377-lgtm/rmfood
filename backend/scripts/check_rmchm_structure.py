"""
检查RMCHM数据结构
"""
import json

with open('D:/RMFOODFP/data/rmchm/rmchm_merged_herbs_v311.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

print(f"总药材数: {len(data)}")

# 统计
has_compounds = 0
has_targets = 0
has_diseases = 0
total_compounds = 0

for h in data:
    if h.get('compounds'):
        has_compounds += 1
        total_compounds += len(h['compounds'])
    if h.get('targets'):
        has_targets += 1
    if h.get('diseases'):
        has_diseases += 1

print(f"有化合物的药材: {has_compounds} (共{total_compounds}条化合物)")
print(f"有靶点的药材: {has_targets}")
print(f"有疾病的药材: {has_diseases}")

# 示例数据
for h in data[:3]:
    print(f"\n=== {h.get('name_cn')} ===")
    print(f"  compounds: {len(h.get('compounds', []))}")
    print(f"  targets: {len(h.get('targets', []))}")
    print(f"  diseases: {len(h.get('diseases', []))}")
    if h.get('compounds'):
        print(f"  化合物示例: {h['compounds'][0]}")
