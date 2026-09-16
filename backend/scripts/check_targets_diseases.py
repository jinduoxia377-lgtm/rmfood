"""
检查有targets/diseases的药材数据
"""
import json

with open('D:/RMFOODFP/data/rmchm/rmchm_merged_herbs_v311.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

# 找有targets和diseases的药材
for h in data:
    if h.get('targets') and len(h['targets']) > 0:
        print(f"=== {h.get('name_cn')} ===")
        print(f"targets: {len(h['targets'])}")
        print(f"示例: {json.dumps(h['targets'][0], ensure_ascii=False, indent=2)}")
        break

for h in data:
    if h.get('diseases') and len(h['diseases']) > 0:
        print(f"\n=== {h.get('name_cn')} ===")
        print(f"diseases: {len(h['diseases'])}")
        print(f"示例: {json.dumps(h['diseases'][0], ensure_ascii=False, indent=2)}")
        break

# 统计
total_targets = sum(len(h.get('targets', [])) for h in data)
total_diseases = sum(len(h.get('diseases', [])) for h in data)
print(f"\n总靶点数: {total_targets}")
print(f"总疾病数: {total_diseases}")
