# -*- coding: utf-8 -*-
"""
深入挖掘TCMSP数据映射关系
"""
import json
import sys
from collections import defaultdict
sys.stdout.reconfigure(encoding='utf-8')

print("=" * 70)
print("  TCMSP 数据映射深度挖掘")
print("=" * 70)

# 加载所有TCMSP数据
with open(r'D:\RMFOODFP\data\TCMSP\tcmsp_herbs.json', 'r', encoding='utf-8') as f:
    tcmsp_herbs = json.load(f)
with open(r'D:\RMFOODFP\data\TCMSP\tcmsp_ingredients.json', 'r', encoding='utf-8') as f:
    tcmsp_compounds = json.load(f)
with open(r'D:\RMFOODFP\data\TCMSP\tcmsp_targets.json', 'r', encoding='utf-8') as f:
    tcmsp_targets = json.load(f)
with open(r'D:\RMFOODFP\data\TCMSP\tcmsp_diseases.json', 'r', encoding='utf-8') as f:
    tcmsp_diseases = json.load(f)

# 加载SymMap数据
with open(r'D:\RMFOODFP\data\SymMap\symmap_herbs.json', 'r', encoding='utf-8') as f:
    symmap_herbs = json.load(f)
with open(r'D:\RMFOODFP\data\SymMap\symmap_ingredients.json', 'r', encoding='utf-8') as f:
    symmap_compounds = json.load(f)

# 加载RMCHM数据
with open(r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v312.json', 'r', encoding='utf-8') as f:
    rmchm_data = json.load(f)

print(f"\n数据源统计:")
print(f"  TCMSP herbs: {len(tcmsp_herbs)}")
print(f"  TCMSP compounds: {len(tcmsp_compounds)}")
print(f"  TCMSP targets: {len(tcmsp_targets)}")
print(f"  TCMSP diseases: {len(tcmsp_diseases)}")
print(f"  SymMap herbs: {len(symmap_herbs)}")
print(f"  SymMap compounds: {len(symmap_compounds)}")
print(f"  RMCHM herbs: {len(rmchm_data)}")

# ==================== 分析TCMSP数据结构 ====================
print("\n" + "=" * 70)
print("  TCMSP 数据结构分析")
print("=" * 70)

# 检查TCMSP化合物字段
print(f"\nTCMSP化合物字段: {list(tcmsp_compounds[0].keys())}")

# 检查是否有隐含的herb引用
compound_keys = set()
for c in tcmsp_compounds:
    compound_keys.update(c.keys())
print(f"所有化合物字段: {sorted(compound_keys)}")

# 检查TCMSP herbs字段
print(f"\nTCMSP草药字段: {list(tcmsp_herbs[0].keys())}")

# ==================== 分析SymMap数据结构 ====================
print("\n" + "=" * 70)
print("  SymMap 数据结构分析")
print("=" * 70)

# 检查SymMap化合物字段
print(f"\nSymMap化合物字段: {list(symmap_compounds[0].keys())}")

# 分析SymMap化合物的TCMSP_id分布
tcmsp_id_dist = defaultdict(int)
for c in symmap_compounds:
    tid = c.get('TCMSP_id', '')
    if tid:
        tcmsp_id_dist[str(tid)] += 1

print(f"\nSymMap化合物按TCMSP_id分布:")
print(f"  唯一TCMSP_id数量: {len(tcmsp_id_dist)}")
print(f"  有TCMSP_id的化合物: {sum(tcmsp_id_dist.values())}")
print(f"  平均每TCMSP_id关联化合物: {sum(tcmsp_id_dist.values())/len(tcmsp_id_dist):.1f}")

# 显示Top 10
top_tcmsp_ids = sorted(tcmsp_id_dist.items(), key=lambda x: -x[1])[:10]
print(f"\nTop 10 TCMSP_id化合物数量:")
for tid, cnt in top_tcmsp_ids:
    print(f"  {tid}: {cnt} 化合物")

# ==================== 建立映射关系 ====================
print("\n" + "=" * 70)
print("  建立数据映射关系")
print("=" * 70)

# 1. SymMap herb -> TCMSP_id mapping
symmap_herb_tcmsp = {}
for h in symmap_herbs:
    hid = str(h.get('Herb_id', ''))
    tcmsp = h.get('TCMSP_id', '')
    if hid and tcmsp:
        symmap_herb_tcmsp[hid] = str(tcmsp)

print(f"\nSymMap herb->TCMSP_id映射: {len(symmap_herb_tcmsp)}")

# 2. TCMSP herb name -> ID mapping (using herb_cn_name as key)
tcmsp_herb_by_name = {h['herb_cn_name']: h for h in tcmsp_herbs}
print(f"TCMSP herb by name: {len(tcmsp_herb_by_name)}")

# 3. RMCHM herb -> TCMSP_id mapping
rmchm_tcmsp_map = {}
for d in rmchm_data:
    tcmsp_id = d.get('tcmsp_id')
    if tcmsp_id:
        rmchm_tcmsp_map[str(tcmsp_id)] = d

print(f"RMCHM herb->TCMSP_id: {len(rmchm_tcmsp_map)}")

# ==================== 化合物映射策略 ====================
print("\n" + "=" * 70)
print("  化合物映射策略分析")
print("=" * 70)

# 策略1: 通过SymMap化合物链接
# SymMap化合物有TCMSP_id，这个ID对应TCMSP的MOL_ID
# 需要找到TCMSP化合物对应的herb

# 检查TCMSP化合物MOL_ID格式
mol_ids = set(c.get('MOL_ID', '') for c in tcmsp_compounds)
print(f"\nTCMSP MOL_ID范围: {min(mol_ids) if mol_ids else 'N/A'} - {max(mol_ids) if mol_ids else 'N/A'}")

# 检查SymMap化合物的TCMSP_id是否与TCMSP MOL_ID匹配
symmap_tcmsp_ids = set(str(c.get('TCMSP_id', '')) for c in symmap_compounds if c.get('TCMSP_id'))
print(f"SymMap TCMSP_id样本: {list(symmap_tcmsp_ids)[:5]}")
print(f"与TCMSP MOL_ID匹配: {symmap_tcmsp_ids & mol_ids}")

# 关键发现：TCMSP化合物没有herb_id，但SymMap化合物通过TCMSP_id链接到TCMSP
# 需要找到TCMSP herb -> compound的映射

# 检查是否有其他方式获取映射
# TCMSP网站可能有每个herb页面的化合物列表
print("\n分析结论:")
print("  1. TCMSP化合物JSON无herb_id字段")
print("  2. SymMap化合物通过TCMSP_id链接到TCMSP化合物")
print("  3. 需要外部数据或API获取TCMSP herb-compound映射")
print("  4. 当前可用数据无法直接建立完整映射")

# ==================== 可行方案 ====================
print("\n" + "=" * 70)
print("  可行方案")
print("=" * 70)

# 方案1: 使用SymMap化合物数据作为替代
# SymMap化合物有26,035条，且通过TCMSP_id关联
# 可以为有symmap_id的药材分配化合物

symmap_compound_by_tcmsp_mol = defaultdict(list)
for c in symmap_compounds:
    tid = c.get('TCMSP_id', '')
    if tid:
        symmap_compound_by_tcmsp_mol[str(tid)].append(c)

print(f"\n方案1: SymMap化合物映射")
print(f"  可通过TCMSP_id获取化合物的药材数: {len(symmap_compound_by_tcmsp_mol)}")

# 计算可以补充的化合物数据
can_enrich = 0
for d in rmchm_data:
    tcmsp_id = str(d.get('tcmsp_id', ''))
    if tcmsp_id and tcmsp_id in symmap_compound_by_tcmsp_mol:
        can_enrich += 1

print(f"  可补充化合物的药材数: {can_enrich}")

# 方案2: 为现有化合物数据补充详细字段
print(f"\n方案2: 丰富现有化合物数据")
print(f"  当前有化合物的药材: {sum(1 for d in rmchm_data if d.get('compounds'))}")
print(f"  可以尝试补充分子式、CAS等字段")

print("\n" + "=" * 70)
print("  执行建议")
print("=" * 70)
print("""
基于数据分析，提出以下执行建议：

1. 【立即执行】使用SymMap化合物数据
   - 通过TCMSP_id关联SymMap化合物
   - 为药材补充化合物列表和分子信息
   
2. 【短期行动】补充传统属性
   - UsePart: 从SMHB获取279条
   - Alias: 从SMHB获取32条
   - 图片: 106FAM已匹配137张

3. 【中期行动】建立完整映射
   - 调用TCMSP官方API获取herb-compound映射
   - 或使用网络爬虫从TCMSP网站提取
   - 或对接其他中药数据库（如HERB、ETCM）

4. 【长期行动】构建知识图谱
   - 整合TCMSP、SymMap、PubMed等多源数据
   - 建立药材-化合物-靶点-疾病完整链路
   - 实现数据自动更新和质量管理
""")
