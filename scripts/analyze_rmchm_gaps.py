# -*- coding: utf-8 -*-
import json
import os
from collections import defaultdict

print("=" * 70)
print("  RMCHM Database Gap Analysis Tool")
print("=" * 70)

# Load RMCHM merged data
with open(r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v311.json', 'r', encoding='utf-8') as f:
    rmchm_data = json.load(f)

# Load TCMSP data
with open(r'D:\RMFOODFP\data\TCMSP\tcmsp_herbs.json', 'r', encoding='utf-8') as f:
    tcmsp_herbs = json.load(f)
with open(r'D:\RMFOODFP\data\TCMSP\tcmsp_ingredients.json', 'r', encoding='utf-8') as f:
    tcmsp_compounds = json.load(f)
with open(r'D:\RMFOODFP\data\TCMSP\tcmsp_targets.json', 'r', encoding='utf-8') as f:
    tcmsp_targets = json.load(f)
with open(r'D:\RMFOODFP\data\TCMSP\tcmsp_diseases.json', 'r', encoding='utf-8') as f:
    tcmsp_diseases = json.load(f)

# Load SymMap data
with open(r'D:\RMFOODFP\data\SymMap\symmap_herbs.json', 'r', encoding='utf-8') as f:
    symmap_herbs = json.load(f)
with open(r'D:\RMFOODFP\data\SymMap\symmap_ingredients.json', 'r', encoding='utf-8') as f:
    symmap_compounds = json.load(f)
with open(r'D:\RMFOODFP\data\SymMap\symmap_targets.json', 'r', encoding='utf-8') as f:
    symmap_targets = json.load(f)
with open(r'D:\RMFOODFP\data\SymMap\symmap_mm_symptoms.json', 'r', encoding='utf-8') as f:
    symmap_diseases = json.load(f)
with open(r'D:\RMFOODFP\data\SymMap\symmap_syndromes.json', 'r', encoding='utf-8') as f:
    symmap_syndromes = json.load(f)

total = len(rmchm_data)
print(f"\nRMCHM total herbs: {total}")
print(f"TCMSP herbs: {len(tcmsp_herbs)}")
print(f"SymMap herbs: {len(symmap_herbs)}")

# ============================================================================
# 1. FIELD COMPLETENESS ANALYSIS
# ============================================================================
print("\n" + "=" * 70)
print("  1. FIELD COMPLETENESS ANALYSIS")
print("=" * 70)

fields_analysis = {
    'name_cn': [], 'name_pinyin': [], 'name_latin': [], 'name_eng': [],
    'nature_cn': [], 'nature_eng': [],
    'meridians_cn': [], 'meridians_eng': [],
    'category_cn': [], 'category_eng': [],
    'use_part': [], 'alias': [], 'function_cn': [],
    'ob_percent': [], 'dl_value': [],
    'is_food_homology': [], 'is_toxic': [],
    'tcmsp_id': [], 'symmap_id': [],
    'compounds_count': [], 'targets_count': [], 'diseases_count': [],
    'image_path': [], 'image_source': [],
}

for d in rmchm_data:
    for field in fields_analysis:
        val = d.get(field)
        if val is None or val == '' or val == [] or val == {}:
            fields_analysis[field].append(d.get('name_cn', 'UNKNOWN'))

for field, missing_names in fields_analysis.items():
    count = len(missing_names)
    coverage = (total - count) / total * 100
    status = "OK" if coverage >= 95 else ("WARN" if coverage >= 50 else "CRITICAL")
    print(f"  [{status}] {field:20s}: missing={count:4d}/{total}, coverage={coverage:5.1f}%")
    if count > 0 and count <= 10:
        for n in missing_names[:5]:
            print(f"         - {n}")

# ============================================================================
# 2. SUB-DATA COMPLETENESS
# ============================================================================
print("\n" + "=" * 70)
print("  2. SUB-DATA (COMPOUNDS/TARGETS/DISEASES) COMPLETENESS")
print("=" * 70)

for sub in ['compounds', 'targets', 'diseases']:
    has_data = [d for d in rmchm_data if isinstance(d.get(sub), list) and len(d[sub]) > 0]
    no_data = [d for d in rmchm_data if not (isinstance(d.get(sub), list) and len(d[sub]) > 0)]
    count = len(no_data)
    coverage = len(has_data) / total * 100
    status = "OK" if coverage >= 95 else ("WARN" if coverage >= 50 else "CRITICAL")
    print(f"  [{status}] {sub:15s}: missing={count:4d}/{total}, coverage={coverage:5.1f}%")
    if count > 0 and count <= 15:
        for d in no_data[:10]:
            print(f"         - {d.get('name_cn', 'UNKNOWN')} (tcmsp_id={d.get('tcmsp_id')}, symmap_id={d.get('symmap_id')})")

# ============================================================================
# 3. TOXICITY DATA GAP (is_toxic is 0% covered!)
# ============================================================================
print("\n" + "=" * 70)
print("  3. TOXICITY DATA GAP ANALYSIS")
print("=" * 70)

# Check TCMSP herbs for toxicity info
print("TCMSP herb fields:", list(tcmsp_herbs[0].keys()) if tcmsp_herbs else [])
# Check SymMap herbs for toxicity info
print("SymMap herb fields:", list(symmap_herbs[0].keys()) if symmap_herbs else [])

# The TCSP doesn't have toxicity field directly; need to check ingredients or other sources
# Check if any TCMSP/ingredient data has toxicity info
if tcmsp_compounds:
    print("TCMSP compound fields:", list(tcmsp_compounds[0].keys()))
if symmap_compounds:
    print("SymMap compound fields:", list(symmap_compounds[0].keys()))

# ============================================================================
# 4. ENGLISH NAME GAP
# ============================================================================
print("\n" + "=" * 70)
print("  4. ENGLISH NAME GAP ANALYSIS")
print("=" * 70)

# SymMap has English names
symmap_name_map = {str(h.get('Herb_id', '')): h.get('English_name', '') for h in symmap_herbs if h.get('English_name')}
print(f"SymMap herb_id -> English_name mappings: {len(symmap_name_map)}")

# TCMSP has herb_en_name
tcmsp_name_map = {str(h.get('herb_cn_name', '')): h.get('herb_en_name', '') for h in tcmsp_herbs if h.get('herb_en_name')}
print(f"TCMSP herb_cn_name -> herb_en_name mappings: {len(tcmsp_name_map)}")

# Find herbs in RMCHM that have symmap_id but no name_eng
no_eng_with_symmap = [d for d in rmchm_data if not d.get('name_eng') and d.get('symmap_id')]
print(f"\nHerbs with symmap_id but no name_eng: {len(no_eng_with_symmap)}")
for d in no_eng_with_symmap[:10]:
    sid = str(d.get('symmap_id'))
    eng = symmap_name_map.get(sid, 'NOT FOUND')
    print(f"  - {d['name_cn']} (symmap_id={sid}) -> English: '{eng}'")

# ============================================================================
# 5. USE_PART GAP ANALYSIS
# ============================================================================
print("\n" + "=" * 70)
print("  5. USE_PART GAP ANALYSIS")
print("=" * 70)
no_usepart = [d for d in rmchm_data if not d.get('use_part')]
print(f"Herbs without use_part: {len(no_usepart)}/{total}")
if no_usepart[:5]:
    for d in no_usepart[:5]:
        print(f"  - {d['name_cn']} (symmap_id={d.get('symmap_id')}, tcmsp_id={d.get('tcmsp_id')})")

# ============================================================================
# 6. IMAGE GAP ANALYSIS
# ============================================================================
print("\n" + "=" * 70)
print("  6. IMAGE RESOURCE GAP ANALYSIS")
print("=" * 70)

no_image = [d for d in rmchm_data if not d.get('image_path')]
print(f"Herbs without image: {len(no_image)}/{total}")

# Check 106FAM images available
fam_dir = r'D:\RMFOODFP\data\106FAM'
if os.path.exists(fam_dir):
    fam_images = os.listdir(fam_dir)
    fam_count = len([f for f in fam_images if f.endswith('.jpg') or f.endswith('.png')])
    print(f"106FAM directory images: {fam_count}")
else:
    print("106FAM directory not found")

# ============================================================================
# 7. ALIAS GAP ANALYSIS
# ============================================================================
print("\n" + "=" * 70)
print("  7. ALIAS GAP ANALYSIS")
print("=" * 70)
no_alias = [d for d in rmchm_data if not d.get('alias')]
print(f"Herbs without alias: {len(no_alias)}/{total}")

# ============================================================================
# 8. FOOD-HOMOLOGY MARKER GAP
# ============================================================================
print("\n" + "=" * 70)
print("  8. FOOD-HOMOLOGY MARKER GAP")
print("=" * 70)
food_homology_count = sum(1 for d in rmchm_data if d.get('is_food_homology') == True)
print(f"Herbs marked as food-homology: {food_homology_count}/{total}")

# TCMSP has specific food-homology data - check ingredients
print(f"\nTCMSP has {len(tcmsp_compounds)} compounds, check for food-homology markers...")

# ============================================================================
# 9. MERGE GAP: TCMSP herbs WITHOUT SymMap data
# ============================================================================
print("\n" + "=" * 70)
print("  9. SOURCE OVERLAP ANALYSIS")
print("=" * 70)

# Herbs with TCMSP but no SymMap
has_tcmsp_only = [d for d in rmchm_data if d.get('tcmsp_id') and not d.get('symmap_id')]
has_symmap_only = [d for d in rmchm_data if d.get('symmap_id') and not d.get('tcmsp_id')]
has_both = [d for d in rmchm_data if d.get('tcmsp_id') and d.get('symmap_id')]
has_neither = [d for d in rmchm_data if not d.get('tcmsp_id') and not d.get('symmap_id')]

print(f"TCMSP only: {len(has_tcmsp_only)}")
print(f"SymMap only: {len(has_symmap_only)}")
print(f"Both sources: {len(has_both)}")
print(f"Neither source: {len(has_neither)}")

if has_neither:
    print(f"\nHerbs with NO source data (first 10):")
    for d in has_neither[:10]:
        print(f"  - {d['name_cn']} (pinyin={d.get('name_pinyin')}, latin={d.get('name_latin', '')[:50]})")

# ============================================================================
# 10. TCMSP COMPOUNDS WITHOUT HERB MAPPING
# ============================================================================
print("\n" + "=" * 70)
print("  10. TCMSP COMPOUND-HERB MAPPING ANALYSIS")
print("=" * 70)

# TCMSP compounds have herb_id field
herb_compound_count = defaultdict(int)
for c in tcmsp_compounds:
    hid = c.get('herb_id', c.get('Herb_ID', ''))
    if hid:
        herb_compound_count[str(hid)] += 1

print(f"TCMSP herbs with compound data: {len(herb_compound_count)}")
print(f"TCMSP total compounds: {len(tcmsp_compounds)}")

# SymMap compounds via TCMSP_id
symmap_herb_compound_count = defaultdict(int)
for c in symmap_compounds:
    tid = c.get('TCMSP_id', '')
    if tid:
        symmap_herb_compound_count[str(tid)] += 1
print(f"\nSymMap compounds via TCMSP_id: {len(symmap_herb_compound_count)} herbs")
print(f"Total SymMap compounds with TCMSP_id: {sum(symmap_herb_compound_count.values())}")

# ============================================================================
# SUMMARY
# ============================================================================
print("\n" + "=" * 70)
print("  SUMMARY: CRITICAL DATA GAPS")
print("=" * 70)
print("""
P0 (Critical - 0% coverage):
  - is_toxic: 0% (NO toxicity data at all)
  - name_eng: 0.3% (Almost no English names)

P1 (High Priority - <40% coverage):
  - image_path: 15.3% (Only 109 of 714 have images)
  - use_part: 39.2% (434 herbs missing medicinal part)
  - alias: 5.0% (678 herbs missing aliases)
  - is_food_homology: 17.8% (587 herbs missing food-homology marker)

P2 (Medium Priority - 50-70% coverage):
  - ob_percent/dl_value: 69.7%
  - targets_count: 62.5%
  - diseases_count: 68.2%
  - compounds_count: 69.7%

P3 (Lower Priority - 70-95% coverage):
  - meridians_cn/eng: ~92%
  - tcmsp_id: 70.9%
""")
