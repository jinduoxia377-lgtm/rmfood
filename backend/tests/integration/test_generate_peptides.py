"""Test script for generate_peptides.py"""
import sys
sys.path.insert(0, "D:/RMFOOD配方平台/backend")

from app.services.data_sources.generate_peptides import GENERATED_PEPTIDES
import collections

print(f'Total generated: {len(GENERATED_PEPTIDES)}')
acts = collections.Counter(p['activity_type'] for p in GENERATED_PEPTIDES)
for a, c in acts.most_common():
    print(f'  {a}: {c}')

print('\nSample entries:')
for p in GENERATED_PEPTIDES[:3]:
    print(f'  {p}')

first = GENERATED_PEPTIDES[0]
last = GENERATED_PEPTIDES[-1]
print(f'\nFirst dfbp_id: {first["dfbp_id"]}')
print(f'Last dfbp_id: {last["dfbp_id"]}')

# Verify sequence uniqueness
sequences = [p["sequence"] for p in GENERATED_PEPTIDES]
unique_seqs = set(sequences)
print(f'Unique sequences: {len(unique_seqs)} / {len(sequences)}')
if len(sequences) != len(unique_seqs):
    dupes = len(sequences) - len(unique_seqs)
    print(f'  WARNING: {dupes} duplicate sequences!')
