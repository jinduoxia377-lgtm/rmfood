# -*- coding: utf-8 -*-
"""Inspect strict extraction results: classify each token as real-peptide / acronym / ambiguous."""
import json
import os
import sys

sys.path.insert(0, r'D:\RMFOODFP\backend')
os.chdir(r'D:\RMFOODFP\backend')
sys.stdout.reconfigure(encoding='utf-8')

with open('ml_artifacts/pubmed_real_records.json', encoding='utf-8') as f:
    data = json.load(f)

# Curated taxonomy of what we know
REAL_PEPTIDES = {
    "VPP", "IPP", "QIGLF", "IRW", "SGID", "GIF", "VRP",  # confirmed ACE-IH
    "VLGYT", "VLTS", "VPWV", "VPYV", "IPL", "IPLG", "IPF",
    "VVW", "IVW", "VYW", "IWH", "IWHHT", "IWHH", "IWHHH",
    "GKGLW", "GDGLKW", "SEGPK", "FDGPY", "SPIH", "SPH",
}
KNOWN_ACRO = {
    # instrumentation / lab
    "MALDI", "PAGE", "SDS", "HPLC", "LCMS", "GCMS", "LC",
    # English all-caps words that happen to be AA
    "RAS", "SPI", "PEP", "LKY", "VRY", "GIF", "VRP", "SGID",
    # English
    "QSAR", "SPH", "IRW", "SGID", "GIF",
}
# RAS = renin-angiotensin system, not a peptide. VPP/IPP = real dipeptides.
# SPI = not a peptide. LKY/VRY = single-letter 3-mer ambiguous.

peptides = set()
kinds = set()
for p in data["pairs"]:
    peptides.add(p["peptide"])
    kinds.add(p["kind"])

print("=" * 70)
print("STEP B — CLASSIFICATION")
print("=" * 70)
print("total pairs: %d" % len(data["pairs"]))
print("unique peptides: %d" % len(peptides))
print("kinds: %s" % sorted(kinds))
print()
print("  real peptide (confirmed):  %d" % len(REAL_PEPTIDES & peptides))
print("  known acronym (exclude):    %d" % len(KNOWN_ACRO & peptides))
print("  ambiguous (need review):    %d" % len(peptides - REAL_PEPTIDES - KNOWN_ACRO))
print()
print("Real peptides found:")
for p in sorted(REAL_PEPTIDES & peptides):
    print("  ", p)
print()
print("Known acronyms (will be excluded from training set):")
for p in sorted(KNOWN_ACRO & peptides):
    print("  ", p)
print()
print("Ambiguous — manual review required:")
for p in sorted(peptides - REAL_PEPTIDES - KNOWN_ACRO):
    print("  ", p)