"""Final validation script for DFBP_PEPTIDE_DATABASE"""
import sys
sys.path.insert(0, "D:/RMFOOD配方平台/backend")

from app.services.data_sources.dfbp_client import DFBP_PEPTIDE_DATABASE
import collections

print(f'Total peptides: {len(DFBP_PEPTIDE_DATABASE)}')
acts = collections.Counter(p['activity_type'] for p in DFBP_PEPTIDE_DATABASE)
print()
for a, c in acts.most_common():
    print(f'  {a}: {c}')

# Verify >= 7100
print(f'\nTotal: {len(DFBP_PEPTIDE_DATABASE)}')
if len(DFBP_PEPTIDE_DATABASE) >= 7100:
    print('PASS: Total >= 7100')
else:
    print('FAIL: Total < 7100')

# Check sequence uniqueness
seqs = [p['sequence'] for p in DFBP_PEPTIDE_DATABASE]
unique = set(seqs)
print(f'Unique sequences: {len(unique)} / {len(seqs)}')
if len(unique) == len(seqs):
    print('PASS: All sequences unique')
else:
    print(f'WARNING: {len(seqs) - len(unique)} duplicates')
