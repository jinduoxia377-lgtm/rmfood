"""
RMCHM 数据去重与呈现分析 v3
检查名称重复、繁简差异、ID冲突，以及新数据呈现结构
"""
import json
import re
from collections import Counter

with open('D:/RMFOODFP/data/rmchm/rmchm_merged_herbs_v2.json', 'r', encoding='utf-8') as f:
    herbs = json.load(f)

output = []
output.append("=" * 70)
output.append("  RMCHM 数据去重与呈现分析报告")
output.append("=" * 70)

# ============================================================
# 第一部分：重复检查
# ============================================================
output.append("")
output.append("【第一部分：重复检查】")
output.append("-" * 70)

# 1. 中文名称重复
names = [h['name_cn'] for h in herbs]
name_counts = Counter(names)
duplicates = {k:v for k,v in name_counts.items() if v > 1}
output.append(f"\n1. 中文名称重复检查:")
output.append(f"   总记录数: {len(herbs)}")
output.append(f"   唯一名称: {len(set(names))}")
if duplicates:
    output.append(f"   重复名称数: {len(duplicates)}")
    for name, count in sorted(duplicates.items()):
        output.append(f"     ['{name}'] 出现 {count} 次")
else:
    output.append(f"   无重复名称 [OK]")

# 2. 简繁差异检查
trad_chars = set('臺鐘餘裡麵鬥聽葉權歸髮鬚體裏藥薑蘭龜劉龐萧藝蘆蘩蒼蕭')
tradic_found = []
for h in herbs:
    if any(c in trad_chars for c in h['name_cn']):
        tradic_found.append(h['name_cn'])
output.append(f"\n2. 繁简差异检查:")
output.append(f"   发现繁体名称: {len(tradic_found)} 个")
for n in tradic_found[:10]:
    output.append(f"     '{n}'")
if not tradic_found:
    output.append(f"   无繁体名称 [OK]")

# 3. 同义名称检查（标准化后比较）
def normalize_name(name):
    name = re.sub(r'[（(].*?[）)]', '', name)
    name = re.sub(r'^鲜/', '', name)
    name = re.sub(r'[、,\s]+', '', name)
    return name.strip()

normalized = [normalize_name(h['name_cn']) for h in herbs]
norm_counts = Counter(normalized)
norm_dups = {k:v for k,v in norm_counts.items() if v > 1 and k}
output.append(f"\n3. 标准化后名称重复检查（去除括号/前缀）:")
output.append(f"   标准化后重复数: {len(norm_dups)}")
if norm_dups:
    for name, count in sorted(norm_dups.items())[:15]:
        # 找出对应的原始名称
        orig_names = [h['name_cn'] for h in herbs if normalize_name(h['name_cn']) == name]
        output.append(f"     '{name}' -> 原始名: {orig_names}")

# 4. TCMSP ID重复
tcmsp_ids = [h.get('tcmsp_id') for h in herbs if h.get('tcmsp_id')]
tcmsp_counts = Counter(tcmsp_ids)
tcmsp_dups = {k:v for k,v in tcmsp_counts.items() if v > 1}
output.append(f"\n4. TCMSP ID重复检查:")
output.append(f"   重复ID数: {len(tcmsp_dups)}")
if tcmsp_dups:
    for tid, cnt in sorted(tcmsp_dups.items())[:10]:
        output.append(f"     ID={tid}: {cnt}次")
else:
    output.append(f"   无重复 [OK]")

# 5. SymMap ID重复
symmap_ids = [h.get('symmap_id') for h in herbs if h.get('symmap_id')]
symmap_counts = Counter(symmap_ids)
symmap_dups = {k:v for k,v in symmap_counts.items() if v > 1}
output.append(f"\n5. SymMap ID重复检查:")
output.append(f"   重复ID数: {len(symmap_dups)}")
if symmap_dups:
    for sid, cnt in sorted(symmap_dups.items())[:10]:
        output.append(f"     ID={sid}: {cnt}次")
else:
    output.append(f"   无重复 [OK]")

# 6. 拉丁名重复
latins = [h.get('name_latin','') for h in herbs if h.get('name_latin')]
latin_counts = Counter(latins)
latin_dups = {k:v for k,v in latin_counts.items() if v > 1}
output.append(f"\n6. 拉丁名重复检查:")
output.append(f"   重复拉丁名数: {len(latin_dups)}")
if latin_dups:
    for ln, cnt in sorted(latin_dups.items())[:10]:
        output.append(f"     '{ln}': {cnt}次")
else:
    output.append(f"   无重复 [OK]")

# ============================================================
# 第二部分：新数据呈现分析
# ============================================================
output.append("")
output.append("=" * 70)
output.append("  【第二部分：RMCHM合并后数据呈现分析】")
output.append("=" * 70)

output.append("""
RMCHM 合并后每条药材记录包含以下核心数据字段：

┌─────────────────────────────────────────────────────────────────┐
│  一、基础信息层（用户最直观感知）                                 │
├─────────────────────────────────────────────────────────────────┤
│  rmchm_code      唯一编码（RMCHM-XXXXXXXX）                      │
│  name_cn         中文名（标准名称）                              │
│  name_pinyin     拼音                                           │
│  name_latin      拉丁学名                                       │
│  name_eng        英文名                                         │
│  image_path      图片路径（107张，100%匹配）                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  二、传统中医属性层（SymMap独有，TCMSP无此维度）                  │
├─────────────────────────────────────────────────────────────────┤
│  nature_cn       四气（寒热温凉平）  覆盖率97.7%                 │
│  nature_eng      四气（英文）                                      │
│  meridians_cn    归经（脏腑经络）    覆盖率92.1%                 │
│  meridians_eng   归经（英文）                                      │
│  category_cn     分类（解表药/清热药等）                           │
│  category_eng    分类（英文）                                     │
│  use_part        药用部位                                          │
│  alias           别名                                             │
│  function_cn     功效原文                                         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  三、现代药理学层（TCMSP独有，SymMap无此维度）                    │
├─────────────────────────────────────────────────────────────────┤
│  ob_percent      口服生物利用度（OB%） 71.2%覆盖                 │
│  dl_value        类药性值（DL）                                   │
│  is_food_homology 药食同源标记（42条）                           │
│  is_toxic        毒性标记                                        │
│  compounds_count 化合物数量（平均48.8个/药材）                   │
│  targets_count   靶点数量（平均172个/药材）                      │
│  diseases_count  疾病数量（平均225个/药材）                      │
│  compounds       化合物列表（含分子式、OB%、DL值）               │
│  targets         靶点列表（含Gene symbol、Protein name）         │
│  diseases        疾病列表（含ICD编码、疾病名称）                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  四、多源ID交叉引用层                                            │
├─────────────────────────────────────────────────────────────────┤
│  tcmsp_id        TCMSP内部ID                                     │
│  symmap_id       SymMap内部ID                                    │
│  tcmid_id        TCMID交叉引用                                   │
│  tcmid2_id       TCM-ID交叉引用                                  │
│  herbdb_id       HERBDB交叉引用                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  五、数据质量层                                                  │
├─────────────────────────────────────────────────────────────────┤
│  data_quality_score  综合评分（0-1）                             │
│  source_info         数据来源信息（匹配方式、数据完整性）           │
│  image_match_score   图片匹配相似度                              │
│  synced_at           最后同步时间                                │
└─────────────────────────────────────────────────────────────────┘
""")

# 数据统计
output.append("")
output.append("=" * 70)
output.append("  【第三部分：数据质量统计】")
output.append("=" * 70)

total = len(herbs)
with_nature = sum(1 for h in herbs if h.get('nature_cn'))
with_meridians = sum(1 for h in herbs if h.get('meridians_cn'))
with_ob = sum(1 for h in herbs if h.get('ob_percent') is not None)
with_compounds = sum(1 for h in herbs if h.get('compounds_count', 0) > 0)
with_targets = sum(1 for h in herbs if h.get('targets_count', 0) > 0)
with_diseases = sum(1 for h in herbs if h.get('diseases_count', 0) > 0)
with_image = sum(1 for h in herbs if h.get('image_path'))
food_homology = sum(1 for h in herbs if h.get('is_food_homology'))
has_all_sources = sum(1 for h in herbs if h.get('has_tcmsp_data') and h.get('has_symmap_data'))

output.append(f"""
| 指标项 | 数值 | 覆盖率 |
|--------|------|--------|
| 总药材数 | {total} | 100% |
| 四气数据 | {with_nature} | {with_nature*100//total}% |
| 归经数据 | {with_meridians} | {with_meridians*100//total}% |
| OB%数据 | {with_ob} | {with_ob*100//total}% |
| 化合物关联 | {with_compounds} | {with_compounds*100//total}% |
| 靶点关联 | {with_targets} | {with_targets*100//total}% |
| 疾病关联 | {with_diseases} | {with_diseases*100//total}% |
| 图片资源 | {with_image} | {with_image*100//total}% |
| 药食同源 | {food_homology} | {food_homology*100//total}% |
| 双源数据 | {has_all_sources} | {has_all_sources*100//total}% |
""")

# 化合物/靶点/疾病总量
total_compounds = sum(h.get('compounds_count', 0) for h in herbs)
total_targets = sum(h.get('targets_count', 0) for h in herbs)
total_diseases = sum(h.get('diseases_count', 0) for h in herbs)

output.append(f"""
关联数据总量:
  化合物总数: {total_compounds:,}
  靶点总数:   {total_targets:,}
  疾病总数:   {total_diseases:,}
  平均每药材: {total_compounds//total} 化合物 / {total_targets//total} 靶点 / {total_diseases//total} 疾病
""")

# 输出
out_path = 'D:/RMFOODFP/data/rmchm/rmchm_analysis_report.txt'
with open(out_path, 'w', encoding='utf-8') as f:
    f.write('\n'.join(output))

print(f"Report written to: {out_path}")
print(f"\nKey findings:")
print(f"  Total records: {total}")
print(f"  Unique names: {len(set(names))}")
print(f"  Duplicate names: {len(duplicates)}")
print(f"  Traditional chars: {len(tradic_found)}")
print(f"  Normalized dups: {len(norm_dups)}")
print(f"  TCMSP ID dups: {len(tcmsp_dups)}")
print(f"  SymMap ID dups: {len(symmap_dups)}")
