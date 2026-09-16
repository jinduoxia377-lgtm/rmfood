"""
深入分析td_batch数据结构
"""
import json
import os

td_dir = 'D:/RMFOODFP/tcmsp_data/data'

# 读取一个批次文件
fp = os.path.join(td_dir, 'td_batch_000_009.json')
with open(fp, 'r', encoding='utf-8') as f:
    data = json.load(f)

print("=" * 70)
print("  TCMSP td_batch 数据结构深度分析")
print("=" * 70)

print(f"\n文件结构:")
print(f"  类型: {type(data).__name__}")
if isinstance(data, dict):
    print(f"  Keys: {list(data.keys())}")
    if 'data' in data:
        print(f"  data length: {len(data['data'])}")
        print(f"  data type: {type(data['data']).__name__}")

# 检查第一条记录
if isinstance(data, dict) and 'data' in data:
    first_item = data['data'][0]
    print(f"\n第一条记录完整结构:")
    for k, v in first_item.items():
        if isinstance(v, list):
            print(f"  {k}: list[{len(v)}]")
            if v and isinstance(v[0], dict):
                print(f"    元素字段: {list(v[0].keys())[:8]}")
                print(f"    首元素: {json.dumps(v[0], ensure_ascii=False)[:100]}")
        elif isinstance(v, dict):
            print(f"  {k}: dict({len(v)} keys)")
        else:
            print(f"  {k}: {str(v)[:80]}")

# 检查化合物关联
print(f"\n\n化合物关联检查:")
compound_count = 0
for item in data['data']:
    compounds = item.get('compounds', [])
    if isinstance(compounds, list) and len(compounds) > 0:
        compound_count += 1
        print(f"  {item.get('name_cn', '?')}: {len(compounds)} compounds")
        if compound_count >= 5:
            break

if compound_count == 0:
    print("  没有找到含化合物的记录")
    # 检查所有字段
    print(f"\n所有记录字段名:")
    all_keys = set()
    for item in data['data']:
        all_keys.update(item.keys())
    print(f"  {sorted(all_keys)}")
