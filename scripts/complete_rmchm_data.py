# -*- coding: utf-8 -*-
"""
RMCHM Database Data Completion Script - Final Version
"""
import json
import os
import re
from collections import defaultdict
from datetime import datetime

print("=" * 70)
print("  RMCHM DATABASE DATA COMPLETION EXECUTION")
print("=" * 70)

# ==================== LOAD DATA ====================
print("\n[1] Loading data sources...")

with open(r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v311.json', 'r', encoding='utf-8') as f:
    rmchm_data = json.load(f)

with open(r'D:\RMFOODFP\data\TCMSP\tcmsp_herbs.json', 'r', encoding='utf-8') as f:
    tcmsp_herbs = json.load(f)
with open(r'D:\RMFOODFP\data\TCMSP\tcmsp_ingredients.json', 'r', encoding='utf-8') as f:
    tcmsp_compounds = json.load(f)
with open(r'D:\RMFOODFP\data\TCMSP\tcmsp_targets.json', 'r', encoding='utf-8') as f:
    tcmsp_targets = json.load(f)
with open(r'D:\RMFOODFP\data\TCMSP\tcmsp_diseases.json', 'r', encoding='utf-8') as f:
    tcmsp_diseases = json.load(f)

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

# Load SymMap SMHB xlsx
import openpyxl
wb = openpyxl.load_workbook(r'D:\RMFOODFP\data\SymMap\SymMap v2.0, SMHB file.xlsx', read_only=True)
ws = wb.active
smhb_rows = list(ws.iter_rows(values_only=True))
wb.close()
smhb_header = smhb_rows[0]
smhb_by_id = {}
for row in smhb_rows[1:]:
    d = dict(zip(smhb_header, row))
    if d.get('Herb_id'):
        smhb_by_id[str(d['Herb_id'])] = d

# Build lookup maps
symmap_herb_by_id = {str(h['Herb_id']): h for h in symmap_herbs}
tcmsp_compound_by_mol = {c['MOL_ID']: c for c in tcmsp_compounds}
tcmsp_target_by_id = {str(t['target_ID']): t for t in tcmsp_targets}
tcmsp_disease_by_id = {str(d['disease_ID']): d for d in tcmsp_diseases}
symmap_disease_by_id = {str(d['MM_symptom_id']): d for d in symmap_diseases}
symmap_target_by_gene = {str(t['Gene_id']): t for t in symmap_targets}

# SymMap compound by TCMSP MOL_ID
symmap_compound_by_tcmsp_mol = defaultdict(list)
for c in symmap_compounds:
    tid = c.get('TCMSP_id', '')
    if tid:
        symmap_compound_by_tcmsp_mol[str(tid)].append(c)

# TCMSP herb-compound mapping from HTML
print("\n[2] Parsing TCMSP HTML for herb-compound mapping...")
tcmsp_herb_mol = defaultdict(set)
html_file = r'D:\RMFOODFP\data\TCMSP\data_ingredients.html'
if os.path.exists(html_file):
    with open(html_file, 'r', encoding='utf-8') as f:
        content = f.read()
    # Extract herb-mol pairs from table rows
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', content, re.DOTALL)
    for row in rows[:1000]:  # Limit to first 1000 rows
        herb_match = re.search(r'herb_id["\s:]+(\d+)', row)
        mol_match = re.search(r'mol_id["\s:]+(MOL\d+)', row)
        if herb_match and mol_match:
            tcmsp_herb_mol[herb_match.group(1)].add(mol_match.group(2))
    print(f"  TCMSP herb-mol pairs found: {sum(len(v) for v in tcmsp_herb_mol.values())}")

# Load 106FAM image mapping
fam_dir = r'D:\RMFOODFP\data\106FAM'
fam_images = {}
if os.path.exists(fam_dir):
    for f in os.listdir(fam_dir):
        if f.endswith('.jpg') or f.endswith('.png'):
            name = f.replace('.jpg', '').replace('.png', '')
            fam_images[name] = f'data/106FAM/{f}'

# Save before snapshot
before_data = json.loads(json.dumps(rmchm_data))

total = len(rmchm_data)
now = datetime.utcnow().isoformat() + 'Z'
fix_stats = defaultdict(int)

# ==================== PERFORM FIXES ====================
print("\n[3] Applying data completions...")

# --- FIX 1: name_eng from SymMap ---
fixed = 0
for d in rmchm_data:
    if not d.get('name_eng') and d.get('symmap_id'):
        sid = str(d['symmap_id'])
        sym = symmap_herb_by_id.get(sid)
        if sym and sym.get('English_name'):
            d['name_eng'] = sym['English_name']
            fixed += 1
            fix_stats['name_eng'] += 1
print(f"  [FIX1] name_eng: +{fixed} records")

# --- FIX 2: is_toxic from SymMap Properties_Chinese ---
fixed = 0
for d in rmchm_data:
    sid = str(d.get('symmap_id', ''))
    if sid and sid in symmap_herb_by_id:
        sym = symmap_herb_by_id[sid]
        props = sym.get('Properties_Chinese', '')
        if '毒' in props:
            d['is_toxic'] = True
            fixed += 1
            fix_stats['is_toxic'] += 1
print(f"  [FIX2] is_toxic: +{fixed} toxic herbs identified")

# --- FIX 3: use_part from SymMap SMHB ---
fixed = 0
for d in rmchm_data:
    if not d.get('use_part') and d.get('symmap_id'):
        sid = str(d['symmap_id'])
        if sid in smhb_by_id:
            sm = smhb_by_id[sid]
            if sm.get('UsePart'):
                d['use_part'] = sm['UsePart']
                fixed += 1
                fix_stats['use_part'] += 1
print(f"  [FIX3] use_part: +{fixed} records")

# --- FIX 4: alias from SymMap SMHB ---
fixed = 0
for d in rmchm_data:
    if not d.get('alias') and d.get('symmap_id'):
        sid = str(d['symmap_id'])
        if sid in smhb_by_id:
            sm = smhb_by_id[sid]
            if sm.get('Alias'):
                d['alias'] = sm['Alias']
                fixed += 1
                fix_stats['alias'] += 1
print(f"  [FIX4] alias: +{fixed} records")

# --- FIX 5: image_path from 106FAM ---
fixed = 0
for d in rmchm_data:
    if not d.get('image_path'):
        cn = d.get('name_cn', '')
        if cn in fam_images:
            d['image_path'] = fam_images[cn]
            d['image_source'] = '106FAM'
            fixed += 1
            fix_stats['image_path'] += 1
print(f"  [FIX5] image_path: +{fixed} records")

# --- FIX 6: Enrich compound/target/disease data ---
print("\n  [FIX6] Enriching network pharmacology data...")

# For herbs with tcmsp_id, get compounds from SymMap via TCMSP MOL_ID
for d in rmchm_data:
    tcmsp_hid = str(d.get('tcmsp_id', ''))
    symmap_hid = str(d.get('symmap_id', ''))
    
    # Get compounds for this herb
    if not d.get('compounds') or len(d.get('compounds', [])) == 0:
        compounds = []
        # Try SymMap compounds via TCMSP_id mapping
        if symmap_hid and symmap_hid in symmap_herb_by_id:
            # Use TCMSP herb ID to look up compounds
            if tcmsp_hid and tcmsp_hid in tcmsp_herb_mol:
                for mol_id in tcmsp_herb_mol[tcmsp_hid]:
                    if mol_id in tcmsp_compound_by_mol:
                        compounds.append(tcmsp_compound_by_mol[mol_id])
        d['compounds'] = compounds
        d['compounds_count'] = len(compounds)
    
    # Get targets for this herb
    if not d.get('targets') or len(d.get('targets', [])) == 0:
        targets = []
        if tcmsp_hid and tcmsp_hid in tcmsp_herb_mol:
            for mol_id in tcmsp_herb_mol[tcmsp_hid]:
                # Find targets for this compound
                # TCMSP uses mol_id to target mapping via 34_Molecules_Targets
                # For now, use SymMap target data
                pass
        d['targets'] = targets
        d['targets_count'] = len(targets)
    
    # Get diseases for this herb
    if not d.get('diseases') or len(d.get('diseases', [])) == 0:
        diseases = []
        d['diseases'] = diseases
        d['diseases_count'] = len(diseases)

# --- FIX 7: Update data_quality_score ---
for d in rmchm_data:
    score = 0.0
    # name fields
    if d.get('name_eng'): score += 0.05
    # traditional attributes
    if d.get('use_part'): score += 0.1
    if d.get('alias'): score += 0.05
    # pharmacology
    if d.get('is_toxic'): score += 0.05
    if d.get('ob_percent'): score += 0.1
    # data richness
    if isinstance(d.get('compounds'), list) and len(d['compounds']) > 0:
        score += 0.2
    if isinstance(d.get('targets'), list) and len(d['targets']) > 0:
        score += 0.2
    if isinstance(d.get('diseases'), list) and len(d['diseases']) > 0:
        score += 0.15
    # image
    if d.get('image_path'): score += 0.1
    d['data_quality_score'] = round(min(score, 1.0), 2)
    d['synced_at'] = now

# ==================== SAVE RESULTS ====================
print("\n[4] Saving results...")

output_path = r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v312.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(rmchm_data, f, ensure_ascii=False, indent=2)
print(f"  Saved: {output_path}")

# ==================== GENERATE REPORT ====================
print("\n[5] Generating completion report...")

def count_missing(data, field):
    if isinstance(data[0].get(field), list):
        return sum(1 for d in data if not d.get(field) or len(d[field]) == 0)
    return sum(1 for d in data if not d.get(field))

report = []
report.append("=" * 70)
report.append("  RMCHM DATABASE COMPLETION REPORT")
report.append("=" * 70)
report.append(f"\nGenerated: {now}")
report.append(f"Total herbs: {total}")
report.append(f"Output file: {output_path}")

report.append("\n" + "-" * 70)
report.append("  COMPLETION RESULTS BY FIELD")
report.append("-" * 70)

fields_report = [
    ('name_eng', 'English Name'),
    ('use_part', 'Medicinal Part (UsePart)'),
    ('alias', 'Alias'),
    ('is_toxic', 'Toxicity Marker'),
    ('image_path', 'Image Resource'),
    ('ob_percent', 'OB% (Pharmacokinetics)'),
    ('compounds', 'Compound Data'),
    ('targets', 'Target Data'),
    ('diseases', 'Disease Data'),
]

report.append(f"\n{'Field':<20} {'Missing':>10} {'Coverage':>10} {'Status':>10}")
report.append("-" * 55)

for field, label in fields_report:
    missing = count_missing(rmchm_data, field)
    filled = total - missing
    pct = filled / total * 100
    if pct >= 90:
        status = "EXCELLENT"
    elif pct >= 70:
        status = "GOOD"
    elif pct >= 50:
        status = "FAIR"
    else:
        status = "NEEDS_WORK"
    report.append(f"  {label:<18} {missing:>10} {pct:>9.1f}% {status:>10}")

report.append("\n" + "-" * 70)
report.append("  FIX STATISTICS")
report.append("-" * 70)

for k, v in sorted(fix_stats.items(), key=lambda x: -x[1]):
    report.append(f"  {k}: +{v} records filled")

report.append("\n" + "-" * 70)
report.append("  REMAINING GAPS")
report.append("-" * 70)

# Identify remaining gaps
no_eng = [d['name_cn'] for d in rmchm_data if not d.get('name_eng')]
no_up = [d['name_cn'] for d in rmchm_data if not d.get('use_part')]
no_al = [d['name_cn'] for d in rmchm_data if not d.get('alias')]
no_img = [d['name_cn'] for d in rmchm_data if not d.get('image_path')]

report.append(f"\n  name_eng still missing: {len(no_eng)} herbs")
report.append(f"  use_part still missing: {len(no_up)} herbs")
report.append(f"  alias still missing: {len(no_al)} herbs")
report.append(f"  image_path still missing: {len(no_img)} herbs")

if no_eng:
    report.append(f"  Sample missing name_eng: {no_eng[:5]}")
if no_up:
    report.append(f"  Sample missing use_part: {no_up[:5]}")

report.append("\n" + "=" * 70)
report.append("  END OF REPORT")
report.append("=" * 70)

report_text = "\n".join(report)
print(report_text)

# Save report
report_path = r'D:\RMFOODFP\data\rmchm\rmchm_completion_report_v312.txt'
with open(report_path, 'w', encoding='utf-8') as f:
    f.write(report_text)
print(f"\n  Report saved: {report_path}")
