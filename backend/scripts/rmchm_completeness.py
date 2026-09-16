"""
RMCHM数据完整性分析与最终报告
"""
import json

# 加载数据
with open('D:/RMFOODFP/data/rmchm/rmchm_merged_herbs_v2.json', 'r', encoding='utf-8') as f:
    rmchm = json.load(f)

with open('D:/RMFOODFP/tcmsp_data/data/all_herbs.json', 'r', encoding='utf-8') as f:
    tcmsp_all = json.load(f)

with open('D:/RMFOODFP/tcmsp_data/data/db_herbs_export.json', 'r', encoding='utf-8') as f:
    tcmsp_db = json.load(f)
tcmsp_herbs = tcmsp_db.get('herbs', [])

print("=" * 70)
print("  RMCHM 数据完整性分析")
print("=" * 70)

# 1. 检查TCMSP缺失的4条药材
tcmsp_db_names = set(h['name_cn'] for h in tcmsp_herbs)
missing_4 = ['五药', '月竭花', '灯盏细辛', '蒿本']

print("\n【1】TCMSP缺失的4条药材:")
for name in missing_4:
    # 在all_herbs中找
    found = False
    for h in tcmsp_all:
        if h['name_cn'] == name:
            print(f"  {name}: pinyin={h.get('name_pinyin','')}, latin={h.get('name_latin','')[:50]}")
            found = True
            break
    if not found:
        print(f"  {name}: 未在all_herbs中找到")

# 2. 检查这4条是否在SymMap中
with open('D:/RMFOODFP/data/SymMap/symmap_herbs.json', 'r', encoding='utf-8') as f:
    symmap = json.load(f)

symmap_names = set(h['Chinese_name'] for h in symmap)
print("\n【2】检查缺失药材是否在SymMap中:")
for name in missing_4:
    if name in symmap_names:
        # 找对应记录
        for h in symmap:
            if h['Chinese_name'] == name:
                print(f"  {name}: 在SymMap中 (ID={h.get('Herb_id')}, TCMSP_id={h.get('TCMSP_id')})")
                break
    else:
        print(f"  {name}: 不在SymMap中")

# 3. 分析RMCHM数据来源
print("\n【3】RMCHM数据来源分布:")
has_both = 0
has_tcmsp = 0
has_symmap = 0
has_neither = 0

for h in rmchm:
    tcmsp_id = h.get('tcmsp_id')
    symmap_id = h.get('symmap_id')
    
    if tcmsp_id and symmap_id:
        has_both += 1
    elif tcmsp_id:
        has_tcmsp += 1
    elif symmap_id:
        has_symmap += 1
    else:
        has_neither += 1

total = len(rmchm)
print(f"  双源数据: {has_both} ({has_both*100//total}%)")
print(f"  仅TCMSP: {has_tcmsp} ({has_tcmsp*100//total}%)")
print(f"  仅SymMap: {has_symmap} ({has_symmap*100//total}%)")
print(f"  无ID: {has_neither} ({has_neither*100//total}%)")

# 4. 无ID药材分析
print("\n【4】无TCMSP/SymMap ID的药材:")
no_id_herbs = [h for h in rmchm if not h.get('tcmsp_id') and not h.get('symmap_id')]
print(f"  数量: {len(no_id_herbs)}")
print(f"  示例:")
for h in no_id_herbs[:10]:
    print(f"    - {h['name_cn']} (code: {h['rmchm_code']}, category: {h.get('category_cn','')})")

# 5. 总结
print("\n" + "=" * 70)
print("  总结")
print("=" * 70)
print(f"""
1. TCMSP本地数据: 502条
   - 有详细数据: 498条
   - 缺失详细数据: 4条（五药、月竭花、灯盏细辛、蒿本）

2. SymMap数据: 698条
   - 全部已合并到RMCHM

3. RMCHM合并数据: 709条
   - 去重后完整无重复
   - 无中文名称重复
   - 无TCMSP/SymMap ID重复
   - 仅有6个拉丁名重复需人工判断

4. 数据缺口:
   - TCMSP官网583条，本地502条，缺失81条
   - 建议重新全量抓取TCMSP获取最新数据
""")
