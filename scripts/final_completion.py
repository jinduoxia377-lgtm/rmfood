# -*- coding: utf-8 -*-
import json
import os
import openpyxl
from datetime import datetime
from collections import defaultdict

print("=" * 70)
print("  RMCHM DATABASE DATA COMPLETION - FINAL EXECUTION")
print("=" * 70)

# Load data
with open(r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v311.json', 'r', encoding='utf-8') as f:
    rmchm_data = json.load(f)

with open(r'D:\RMFOODFP\data\SymMap\symmap_herbs.json', 'r', encoding='utf-8') as f:
    symmap_herbs = json.load(f)

# Build lookup maps
symmap_by_id = {str(h['Herb_id']): h for h in symmap_herbs}
total = len(rmchm_data)
now = datetime.utcnow().isoformat() + 'Z'

print(f"\nTotal herbs: {total}")
print(f"SymMap herbs: {len(symmap_by_id)}")

# Check SMHB data availability
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

print(f"SMHB entries: {len(smhb_by_id)}")

# Check UsePart and Alias availability in SMHB
up_count = 0
al_count = 0
for r in smhb_rows[1:]:
    if isinstance(r, tuple):
        if r[11]: up_count += 1
        if r[16]: al_count += 1
    elif isinstance(r, dict):
        if r.get('UsePart'): up_count += 1
        if r.get('Alias'): al_count += 1
print(f"SMHB UsePart available: {up_count}")
print(f"SMHB Alias available: {al_count}")

# Check SymMap JSON for UsePart and Alias
sym_up = sum(1 for h in symmap_herbs if h.get('UsePart'))
sym_al = sum(1 for h in symmap_herbs if h.get('Alias'))
print(f"SymMap JSON UsePart: {sym_up}")
print(f"SymMap JSON Alias: {sym_al}")

# Check 106FAM images
fam_dir = r'D:\RMFOODFP\data\106FAM'
fam_images = {}
if os.path.exists(fam_dir):
    for f in os.listdir(fam_dir):
        if f.endswith('.jpg') or f.endswith('.png'):
            name = f.replace('.jpg', '').replace('.png', '')
            fam_images[name] = f'data/106FAM/{f}'
print(f"106FAM images: {len(fam_images)}")

# Check overlap
rmchm_names = set(d.get('name_cn', '') for d in rmchm_data)
overlap = rmchm_names & set(fam_images.keys())
print(f"Name overlap RMCHM-106FAM: {len(overlap)}")

# ==================== APPLY FIXES ====================
print("\n" + "=" * 70)
print("  APPLYING FIXES")
print("=" * 70)

fix_stats = defaultdict(int)

# FIX 1: name_eng from SymMap JSON
fixed = 0
for d in rmchm_data:
    if not d.get('name_eng') and d.get('symmap_id'):
        sym = symmap_by_id.get(str(d['symmap_id']))
        if sym and sym.get('English_name'):
            d['name_eng'] = sym['English_name']
            fixed += 1
            fix_stats['name_eng'] += 1
print(f"\n[FIX1] name_eng: +{fixed} records (coverage: {(total-fixed)/total*100:.1f}% -> {fixed/total*100:.1f}%)")

# FIX 2: is_toxic from SymMap Properties_Chinese
fixed = 0
for d in rmchm_data:
    sid = str(d.get('symmap_id', ''))
    if sid in symmap_by_id:
        props = symmap_by_id[sid].get('Properties_Chinese', '')
        if '毒' in props:
            d['is_toxic'] = True
            fixed += 1
            fix_stats['is_toxic'] += 1
print(f"[FIX2] is_toxic: +{fixed} toxic herbs identified")

# FIX 3: use_part from SymMap JSON (not SMHB)
fixed = 0
for d in rmchm_data:
    if not d.get('use_part') and d.get('symmap_id'):
        sym = symmap_by_id.get(str(d['symmap_id']))
        if sym and sym.get('UsePart'):
            d['use_part'] = sym['UsePart']
            fixed += 1
            fix_stats['use_part'] += 1
print(f"[FIX3] use_part: +{fixed} records")

# FIX 4: alias from SymMap JSON (not SMHB)
fixed = 0
for d in rmchm_data:
    if not d.get('alias') and d.get('symmap_id'):
        sym = symmap_by_id.get(str(d['symmap_id']))
        if sym and sym.get('Alias'):
            d['alias'] = sym['Alias']
            fixed += 1
            fix_stats['alias'] += 1
print(f"[FIX4] alias: +{fixed} records")

# FIX 5: image_path from 106FAM
fixed = 0
for d in rmchm_data:
    if not d.get('image_path'):
        cn = d.get('name_cn', '')
        if cn in fam_images:
            d['image_path'] = fam_images[cn]
            d['image_source'] = '106FAM'
            fixed += 1
            fix_stats['image_path'] += 1
print(f"[FIX5] image_path: +{fixed} records")

# Save results
output_path = r'D:\RMFOODFP\data\rmchm\rmchm_merged_herbs_v312.json'
with open(output_path, 'w', encoding='utf-8') as f:
    json.dump(rmchm_data, f, ensure_ascii=False, indent=2)
print(f"\nSaved: {output_path}")

# ==================== GENERATE REPORT ====================
print("\n" + "=" * 70)
print("  COMPLETION REPORT")
print("=" * 70)

def count_missing(data, field):
    if isinstance(data[0].get(field), list):
        return sum(1 for d in data if not d.get(field) or len(d[field]) == 0)
    return sum(1 for d in data if not d.get(field))

report_lines = []
report_lines.append("=" * 70)
report_lines.append("  RMCHM DATABASE COMPLETION REPORT v312")
report_lines.append("=" * 70)
report_lines.append(f"\nGenerated: {now}")
report_lines.append(f"Total herbs: {total}")
report_lines.append(f"Output: {output_path}")

report_lines.append("\n" + "-" * 70)
report_lines.append("  DATA QUALITY BY FIELD")
report_lines.append("-" * 70)
report_lines.append(f"\n{'Field':<20} {'Missing':>10} {'Coverage':>10} {'Status':>12}")
report_lines.append("-" * 55)

fields_report = [
    ('name_eng', 'English Name'),
    ('use_part', 'Medicinal Part'),
    ('alias', 'Alias'),
    ('is_toxic', 'Toxicity'),
    ('image_path', 'Image'),
    ('ob_percent', 'OB%'),
    ('compounds', 'Compounds'),
    ('targets', 'Targets'),
    ('diseases', 'Diseases'),
]

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
    report_lines.append(f"  {label:<18} {missing:>10} {pct:6.1f}% {status:>12}")

report_lines.append("\n" + "-" * 70)
report_lines.append("  FIX STATISTICS")
report_lines.append("-" * 70)
for k, v in sorted(fix_stats.items(), key=lambda x: -x[1]):
    report_lines.append(f"  {k}: +{v} records")

# Show toxic herbs sample
toxic_herbs = [d['name_cn'] for d in rmchm_data if d.get('is_toxic')]
report_lines.append(f"\n  Toxic herbs identified: {len(toxic_herbs)}")
report_lines.append(f"  Sample: {toxic_herbs[:10]}")

# Show remaining gaps
no_eng = [d['name_cn'] for d in rmchm_data if not d.get('name_eng')]
no_up = [d['name_cn'] for d in rmchm_data if not d.get('use_part')]
no_al = [d['name_cn'] for d in rmchm_data if not d.get('alias')]
no_img = [d['name_cn'] for d in rmchm_data if not d.get('image_path')]

report_lines.append("\n" + "-" * 70)
report_lines.append("  REMAINING GAPS")
report_lines.append("-" * 70)
report_lines.append(f"  name_eng: {len(no_eng)} herbs still missing")
report_lines.append(f"  use_part: {len(no_up)} herbs still missing")
report_lines.append(f"  alias: {len(no_al)} herbs still missing")
report_lines.append(f"  image_path: {len(no_img)} herbs still missing")

if no_eng:
    report_lines.append(f"  Sample missing name_eng: {no_eng[:5]}")
if no_up:
    report_lines.append(f"  Sample missing use_part: {no_up[:5]}")

report_lines.append("\n" + "=" * 70)
report_lines.append("  END OF REPORT")
report_lines.append("=" * 70)

report_text = "\n".join(report_lines)
print(report_text)

# Save report
report_path = r'D:\RMFOODFP\data\rmchm\rmchm_completion_report_v312.txt'
with open(report_path, 'w', encoding='utf-8') as f:
    f.write(report_text)
print(f"\nReport saved: {report_path}")
