# -*- coding: utf-8 -*-
"""Step 3: real data augmentation probe.

Reality check (measured):
  DFBP (db.baderlab.org)      -> unreachable
  BIOPEP (biopep.uwm.edu.pl)  -> unreachable
  UniProt / EBI / NCBI        -> reachable

So augmentation can only use genuinely reachable sources. This script fetches
REAL food-protein sequences from UniProt (milk casein, egg ovalbumin, soy glycinin,
whey beta-lactoglobulin) and reports what could be derived. It does NOT fabricate
activity labels: sequences are real, hydrolysis rules are real biochemistry,
but any activity annotation would need a real source, so none is invented.
"""
import json
import sys
import urllib.parse
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

UNIPROT = "https://rest.uniprot.org/uniprotkb/search"

TARGETS = [
    ("牛奶 β-酪蛋白", "P02666", "Bos taurus"),
    ("牛奶 α-s1-酪蛋白", "P02662", "Bos taurus"),
    ("牛奶 κ-酪蛋白", "P02668", "Bos taurus"),
    ("乳清 β-乳球蛋白", "P02754", "Bos taurus"),
    ("鸡蛋卵白蛋白", "P01012", "Gallus gallus"),
    ("大豆大豆球蛋白", "P04776", "Glycine max"),
]


def fetch(accession, organism):
    q = "accession:%s" % accession
    url = UNIPROT + "?" + urllib.parse.urlencode({
        "query": q,
        "fields": "accession,protein_name,sequence,organism_name",
        "format": "json",
        "size": "1",
    })
        "fields": "accession,protein_name,sequence,organism_name",
        "format": "json",
        "size": "1",
    })
    req = urllib.request.Request(url, headers={"User-Agent": "RMFOODFP-research/1.0"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return json.loads(r.read())


print("=" * 72)
print("STEP 3 PROBE: reachable real sources for augmentation")
print("=" * 72)
for label, acc, org in TARGETS:
    try:
        d = fetch(acc, org)
        results = d.get("results", [])
        if not results:
            print("  %-18s %-10s -> no hit" % (label, acc))
            continue
        rec = results[0]
        seq = rec.get("sequence", {}).get("value", "")
        name = ""
        try:
            name = rec["proteinDescription"]["recommendedName"]["fullName"]["value"]
        except Exception:
            pass
        print("  %-18s %-10s len=%-4d %s" % (label, acc, len(seq), name[:40]))
    except Exception as e:
        detail = ""
        if hasattr(e, "code"):
            detail = " code=%s" % e.code
            try:
                detail += " body=" + e.read().decode("utf-8", "replace")[:200]
            except Exception:
                pass
        print("  %-18s %-10s -> ERROR %s%s" % (label, acc, type(e).__name__, detail))