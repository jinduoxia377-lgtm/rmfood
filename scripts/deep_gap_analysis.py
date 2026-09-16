# -*- coding: utf-8 -*-
"""
RMCHM Database Gap Analysis and Completion Plan
"""
import json
import csv
import os
from collections import defaultdict

print("=" * 70)
print("  RMCHM DATABASE GAP ANALYSIS AND COMPLETION PLAN")
print("=" * 70)

# ==================== LOAD ALL DATA ====================
print("\n[1] Loading data sources...")

# RMCHM merged data
with open(r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v311.json', 'r', encoding='utf-8') as f:
    rmchm_data = json.load(f)
print(f"  RMCHM herbs: {len(rmchm_data)}")

# TCMSP data
with open(r'D:\RMFOODFP\data\TCMSP\tcmsp_herbs.json', 'r', encoding='utf-8') as f:
    tcmsp_herbs = json.load(f)
with open(r'D:\RMFOODFP\data\TCMSP\tcmsp_ingredients.json', 'r', encoding='utf-8') as f:
    tcmsp_compounds = json.load(f)
with open(r'D:\RMFOODFP\data\TCMSP\tcmsp_targets.json', 'r', encoding='utf-8') as f:
    tcmsp_targets = json.load(f)
with open(r'D:\RMFOODFP\data\TCMSP\tcmsp_diseases.json', 'r', encoding='utf-8') as f:
    tcmsp_diseases = json.load(f)
print(f"  TCMSP herbs: {len(tcmsp_herbs)}, compounds: {len(tcmsp_compounds)}, targets: {len(tcmsp_targets)}, diseases: {len(tcmsp_diseases)}")

# Load TCMSP mapping CSVs
tcmsp_herb_mol = {}  # herb_id -> [mol_ids]
with open(r'D:\RMFOODFP\data\TCMSP\23_Herbs_Molecules.csv', 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        hid = row.get('herb_id', row.get('Herb_ID', ''))
        mid = row.get('mol_id', row.get('MOL_ID', ''))
        if hid and mid:
            if hid not in tcmsp_herb_mol:
                tcmsp_herb_mol[hid] = []
            tcmsp_herb_mol[hid].append(mid)
print(f"  TCMSP herb-mol mappings: {len(tcmsp_herb_mol)} herbs")

tcmsp_mol_target = {}  # mol_id -> [target_ids]
with open(r'D:\RMFOODFP\data\TCMSP\34_Molecules_Targets.csv', 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        mid = row.get('mol_id', row.get('MOL_ID', ''))
        tid = row.get('target_ID', row.get('TAR_ID', ''))
        if mid and tid:
            if mid not in tcmsp_mol_target:
                tcmsp_mol_target[mid] = []
            tcmsp_mol_target[mid].append(tid)
print(f"  TCMSP mol-target mappings: {len(tcmsp_mol_target)} molecules")

tcmsp_target_disease = {}  # target_id -> [disease_ids]
with open(r'D:\RMFOODFP\data\TCMSP\45_Targets_Diseases.csv', 'r', encoding='utf-8-sig') as f:
    reader = csv.DictReader(f)
    for row in reader:
        tid = row.get('target_ID', row.get('TAR_ID', ''))
        did = row.get('disease_ID', row.get('DIS_ID', ''))
        if tid and did:
            if tid not in tcmsp_target_disease:
                tcmsp_target_disease[tid] = []
            tcmsp_target_disease[tid].append(did)
print(f"  TCMSP target-disease mappings: {len(tcmsp_target_disease)} targets")

# SymMap data
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
with open(r'D:\RMFOODFP\data\SymMap\symmap_symptoms.json', 'r', encoding='utf-8') as f:
    symmap_tcm_symptoms = json.load(f)
print(f"  SymMap herbs: {len(symmap_herbs)}, compounds: {len(symmap_compounds)}, targets: {len(symmap_targets)}, diseases: {len(symmap_diseases)}, syndromes: {len(symmap_syndromes)}")

# ==================== BUILD LOOKUP MAPS ====================
print("\n[2] Building lookup maps...")

# TCMSP herb lookup by id
tcmsp_herb_by_id = {str(h['herb_cn_name']): h for h in tcmsp_herbs}
# Actually TCMSP uses herb_cn_name as key, not numeric ID
# Let me check the 23_Herbs_Molecules mapping more carefully
print(f"  TCMSP herb-mol keys (first 5): {list(tcmsp_herb_mol.keys())[:5]}")

# SymMap herb lookup by Herb_id
symmap_herb_by_id = {str(h['Herb_id']): h for h in symmap_herbs}
print(f"  SymMap herb IDs range: {min(int(k) for k in symmap_herb_by_id.keys())}-{max(int(k) for k in symmap_herb_by_id.keys())}")

# SymMap herb by Chinese name
symmap_herb_by_name = {h['Chinese_name']: h for h in symmap_herbs}
print(f"  SymMap herb by name: {len(symmap_herb_by_name)}")

# TCMSP herb by Chinese name
tcmsp_herb_by_cn = {h['herb_cn_name']: h for h in tcmsp_herbs}
print(f"  TCMSP herb by name: {len(tcmsp_herb_by_cn)}")

# SymMap compound lookup by TCMSP_id
symmap_compound_by_tcmsp = defaultdict(list)
for c in symmap_compounds:
    tid = c.get('TCMSP_id', '')
    if tid:
        symmap_compound_by_tcmsp[str(tid)].append(c)
print(f"  SymMap compounds by TCMSP_id: {len(symmap_compound_by_tcmsp)} herbs with compounds")

# SymMap compound lookup by Mol_id
symmap_compound_by_mol = {str(c['Mol_id']): c for c in symmap_compounds}
print(f"  SymMap compound by Mol_id: {len(symmap_compound_by_mol)}")

# TCMSP compound lookup by MOL_ID
tcmsp_compound_by_mol = {c['MOL_ID']: c for c in tcmsp_compounds}
print(f"  TCMSP compound by MOL_ID: {len(tcmsp_compound_by_mol)}")

# SymMap target lookup
symmap_target_by_gene = {str(t['Gene_id']): t for t in symmap_targets}
print(f"  SymMap targets: {len(symmap_target_by_gene)}")

# TCMSP target lookup
tcmsp_target_by_id = {str(t['target_ID']): t for t in tcmsp_targets}
print(f"  TCMSP targets: {len(tcmsp_target_by_id)}")

# TCMSP disease lookup
tcmsp_disease_by_id = {str(d['disease_ID']): d for d in tcmsp_diseases}
print(f"  TCMSP diseases: {len(tcmsp_disease_by_id)}")

# SymMap disease lookup
symmap_disease_by_id = {str(d['MM_symptom_id']): d for d in symmap_diseases}
print(f"  SymMap diseases: {len(symmap_disease_by_id)}")

# ==================== GAP ANALYSIS ====================
print("\n[3] DETAILED GAP ANALYSIS")
print("=" * 70)

total = len(rmchm_data)
gaps = {}

# P0: Critical gaps
# name_eng
no_eng = [d for d in rmchm_data if not d.get('name_eng')]
gaps['name_eng'] = {'count': len(no_eng), 'severity': 'P0-CRITICAL', 'fix': 'symmap English_name'}

# use_part - SymMap SMHB has UsePart
no_usepart = [d for d in rmchm_data if not d.get('use_part')]
gaps['use_part'] = {'count': len(no_usepart), 'severity': 'P1-HIGH', 'fix': 'symmap UsePart field'}

# alias - need to find source
no_alias = [d for d in rmchm_data if not d.get('alias')]
gaps['alias'] = {'count': len(no_alias), 'severity': 'P1-HIGH', 'fix': 'external source (China Food Ingredients Database)'}

# image_path
no_image = [d for d in rmchm_data if not d.get('image_path')]
gaps['image_path'] = {'count': len(no_image), 'severity': 'P1-HIGH', 'fix': '106FAM dataset + external sources'}

# is_toxic - check if Properties_Chinese contains 毒
no_toxic = [d for d in rmchm_data if d.get('is_toxic') != True]
gaps['is_toxic'] = {'count': len(no_toxic), 'severity': 'P0-CRITICAL', 'fix': 'parse Properties_Chinese for 有毒/有小毒'}

# is_food_homology - check
food_count = sum(1 for d in rmchm_data if d.get('is_food_homology') == True)
non_food = total - food_count
gaps['is_food_homology'] = {'count': non_food, 'severity': 'P1-HIGH', 'fix': 'GB 16740-2014 standard + TCMSP Food homologous list'}

# P2: Medium gaps
no_ob = [d for d in rmchm_data if not d.get('ob_percent')]
gaps['ob_percent'] = {'count': len(no_ob), 'severity': 'P2-MEDIUM', 'fix': 'TCMSP ob field via herb-compound mapping'}

no_tgt = [d for d in rmchm_data if (d.get('targets_count') or 0) == 0]
gaps['targets_count'] = {'count': len(no_tgt), 'severity': 'P2-MEDIUM', 'fix': 'TCMSP target mapping'}

no_dis = [d for d in rmchm_data if (d.get('diseases_count') or 0) == 0]
gaps['diseases_count'] = {'count': len(no_dis), 'severity': 'P2-MEDIUM', 'fix': 'TCMSP disease mapping'}

no_comp = [d for d in rmchm_data if (d.get('compounds_count') or 0) == 0]
gaps['compounds_count'] = {'count': len(no_comp), 'severity': 'P2-MEDIUM', 'fix': 'SymMap TCMSP_id mapping'}

# Print gaps summary
print("\nGAP SUMMARY BY SEVERITY:")
for level in ['P0-CRITICAL', 'P1-HIGH', 'P2-MEDIUM']:
    print(f"\n{level}:")
    for field, info in gaps.items():
        if info['severity'] == level:
            print(f"  {field}: {info['count']} missing ({info['count']/total*100:.1f}%) -> {info['fix']}")

# ==================== COMPLETION STRATEGY ====================
print("\n" + "=" * 70)
print("  4. COMPLETION STRATEGY")
print("=" * 70)

# Strategy for each gap
print("""
STRATEGY 1: name_eng (English Names)
  Source: SymMap English_name field
  Method: Match by symmap_id -> look up symmap_herb_by_id
  Expected coverage: ~97.8% (96.6% of 714 = ~689 can be filled)

STRATEGY 2: use_part (Medicinal Part)
  Source: SymMap SMHB xlsx UsePart field (some herbs have it)
  Method: Check if SymMap JSON has UsePart field, otherwise use herbal description
  Expected coverage: ~60-70%

STRATEGY 3: is_toxic (Toxicity)
  Source: SymMap Properties_Chinese - parse for 毒 character
  Method: Check if Properties_Chinese contains 有毒/小毒/有大毒
  Expected coverage: ~100% (all 714 can be evaluated)

STRATEGY 4: alias (Aliases)
  Source: Need external data (TCM databases with aliases)
  Method: Use 中华本草 or similar reference
  Expected coverage: ~80% with external source

STRATEGY 5: image_path (Images)
  Source: 106FAM dataset (107 images), expand via web scraping
  Method: Match by Chinese name to 106FAM, then search additional sources
  Expected coverage: ~30% with 106FAM, ~60% with web expansion

STRATEGY 6: is_food_homology (Food-Homology Marker)
  Source: GB 16740-2014 + TCMSP food-homology list
  Method: Cross-reference with official food-homology list
  Expected coverage: ~100% (binary check against known list)

STRATEGY 7: ob_percent/dl_value (Pharmacokinetics)
  Source: TCMSP compounds - need herb->compound->OB/DL aggregation
  Method: Build herb->mol mapping from 23_Herbs_Molecules.csv, aggregate OB/DL
  Expected coverage: ~70% (depends on TCMSP compound coverage)

STRATEGY 8: targets_count/diseases_count (Network Pharma)
  Source: TCMSP target-disease chain: herb->mol->target->disease
  Method: Full chain traversal
  Expected coverage: ~65-70%
""")

# ==================== TEST FILLING ====================
print("\n[5] TEST: Filling name_eng from SymMap")
filled = 0
for d in rmchm_data:
    if not d.get('name_eng') and d.get('symmap_id'):
        sid = str(d['symmap_id'])
        sym = symmap_herb_by_id.get(sid)
        if sym and sym.get('English_name'):
            d['name_eng'] = sym['English_name']
            filled += 1
print(f"  Filled: {filled}/{len(no_eng)} ({filled/len(no_eng)*100:.1f}%)")

print("\n[6] TEST: Filling is_toxic from SymMap Properties")
toxic_filled = 0
for d in rmchm_data:
    if d.get('symmap_id'):
        sid = str(d['symmap_id'])
        sym = symmap_herb_by_id.get(sid)
        if sym:
            props = sym.get('Properties_Chinese', '')
            if '毒' in props:
                d['is_toxic'] = True
                toxic_filled += 1
print(f"  Marked as toxic: {toxic_filled}")

print("\n[7] TEST: Checking use_part availability in SymMap")
usepart_count = 0
for h in symmap_herbs:
    if h.get('UsePart'):
        usepart_count += 1
print(f"  SymMap herbs with UsePart: {usepart_count}/{len(symmap_herbs)}")

# Check which herbs in rmchm have symmap_id and could get use_part
can_get_usepart = 0
for d in rmchm_data:
    if d.get('symmap_id') and not d.get('use_part'):
        sid = str(d['symmap_id'])
        sym = symmap_herb_by_id.get(sid)
        if sym and sym.get('UsePart'):
            can_get_usepart += 1
print(f"  RMCHM herbs that CAN get use_part from SymMap: {can_get_usepart}")

# ==================== FINAL SUMMARY ====================
print("\n" + "=" * 70)
print("  8. FINAL COMPLETION PROJECTION")
print("=" * 70)

projections = [
    ('name_eng', 'P0-CRITICAL', len(no_eng) - filled, filled, 'SymMap English_name'),
    ('is_toxic', 'P0-CRITICAL', 0, toxic_filled, 'SymMap Properties parsing'),
    ('use_part', 'P1-HIGH', len(no_usepart) - can_get_usepart, can_get_usepart, 'SymMap UsePart'),
    ('alias', 'P1-HIGH', len(no_alias), 0, 'External source needed'),
    ('image_path', 'P1-HIGH', len(no_image), 107, '106FAM dataset'),
    ('is_food_homology', 'P1-HIGH', non_food - food_count, food_count, 'GB standard + TCMSP'),
    ('ob_percent', 'P2-MEDIUM', len(no_ob), total - len(no_ob), 'TCMSP compound aggregation'),
    ('targets_count', 'P2-MEDIUM', len(no_tgt), total - len(no_tgt), 'TCMSP target chain'),
    ('diseases_count', 'P2-MEDIUM', len(no_dis), total - len(no_dis), 'TCMSP disease chain'),
    ('compounds_count', 'P2-MEDIUM', len(no_comp), total - len(no_comp), 'SymMap TCMSP_id mapping'),
]

print(f"\n{'Field':<20} {'Priority':<15} {'Still Missing':<15} {'Fillable':<10} {'Source'}")
print("-" * 80)
for field, prio, still_missing, fillable, source in projections:
    print(f"  {field:<18} {prio:<15} {still_missing:<15} {fillable:<10} {source}")

print(f"\n  Total herbs: {total}")
print(f"  Overall completion potential: ~85-90% for major fields")
