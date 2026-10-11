# -*- coding: utf-8 -*-
"""Step C-1: audit the 505 PubMed positives for duplication / over-counting.

Checks:
  1. How many PubMed (seq, pmid) pairs collapse to a single sequence?
     (the same peptide cited in N papers = 1 real sequence, not N samples)
  2. How many of those sequences ALSO appear in the DFBP real 400?
     (overlap would mean double-counting across the two sources)
  3. Length distribution (short vs long) to quantify the 'short-peptide bias'
  4. Unique-cue coverage: how many distinct PMIDs actually back the set?

Result: an honest count of REAL DISTINCT sequences, not raw pair count.
"""
import json
import os
import sys
from collections import Counter

sys.path.insert(0, r'D:\RMFOODFP\backend')
os.chdir(r'D:\RMFOODFP\backend')
sys.stdout.reconfigure(encoding='utf-8')

PUB = "ml_artifacts/ace_real_peptides_final.json"

with open(PUB, encoding="utf-8") as f:
    data = json.load(f)

pairs = data["pairs"]

print("=" * 72)
print("STEP C-1: AUDIT of 505 PubMed positives")
print("=" * 72)

# raw pair stats
print("  raw (seq,pmid) pairs       :", len(pairs))
print("  unique sequences           :", data.get("unique_sequences"))
print("  unique PMIDs cited         :", data.get("unique_pmids"))
print()

# 1. duplication: same seq in many pmids
seq_to_pmids = {}
for p in pairs:
    seq_to_pmids.setdefault(p["seq"], set()).add(p["pmid"])

multi = {s: ps for s, ps in seq_to_pmids.items() if len(ps) >= 2}
print("  sequences cited in >=2 PMIDs: %d" % len(multi))
top_dup = sorted(multi.items(), key=lambda x: -len(x[1]))[:15]
print("  top over-cited sequences:")
for s, ps in top_dup:
    print("    %-12s -> %d pmids" % (s, len(ps)))

# 2. overlap with DFBP real 400
from app.services.peptide_analyzer.real_ml_trainer import _load_real_training_set
dfbp_real = _load_real_training_set("ACE inhibitory", real_only=True, include_pubmed=False)
dfbp_seqs = {r["sequence"] for r in dfbp_real}
print()
print("  DFBP real 400 sequences    :", len(dfbp_seqs))
overlap = set(seq_to_pmids) & dfbp_seqs
print("  PubMed seqs ALSO in DFBP   :", len(overlap))
for s in sorted(overlap)[:20]:
    print("    ", s)

# 3. length distribution
lens = Counter(len(s) for s in seq_to_pmids)
print()
print("  length distribution (unique pubmed sequences):")
for L in sorted(lens):
    bar = "#" * min(lens[L], 60)
    print("    len=%-2d %4d  %s" % (L, lens[L], bar))

short = sum(c for L, c in lens.items() if L <= 5)
long_ = sum(c for L, c in lens.items() if L >= 8)
print()
print("  <=5 aa (short)  : %d (%.0f%%)" % (short, 100.0 * short / max(len(seq_to_pmids), 1)))
print("  6-7 aa (mid)    : %d (%.0f%%)" % (sum(c for L, c in lens.items() if 6 <= L <= 7),
                                            100.0 * sum(c for L, c in lens.items() if 6 <= L <= 7) / max(len(seq_to_pmids), 1)))
print("  >=8 aa (long)   : %d (%.0f%%)" % (long_, 100.0 * long_ / max(len(seq_to_pmids), 1)))

# 4. net distinct-sequence count after deduping vs DFBP
net_distinct = len(seq_to_pmids)  # pubmed-unique sequences
print()
print("  NET DISTINCT positives when merged (dedup on sequence):")
print("    pubmed-unique :", net_distinct)
print("    overlap w/ DFBP:", len(overlap))
print("    DFBP-only     :", len(dfbp_seqs - set(seq_to_pmids)))
print("    merged distinct :", len(set(seq_to_pmids) | dfbp_seqs))
