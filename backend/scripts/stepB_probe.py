# -*- coding: utf-8 -*-
"""Step B probe: can we obtain REAL ACE-inhibitory peptide annotations?

Reachable sources (measured earlier):
  NCBI E-utilities  -> reachable
  UniProt           -> reachable
  DFBP / BIOPEP     -> unreachable

Strategy: fetch real food-protein sequences from UniProt, then look for peer-reviewed
ACE-inhibitory peptide data in PubMed. NO activity label is ever invented: if a real
source does not state it, the peptide stays unlabelled.
"""
import json
import sys
import time
import urllib.parse
import urllib.request

sys.stdout.reconfigure(encoding='utf-8')

EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"


def esearch(term, retmax=5):
    url = "%s/esearch.fcgi?%s" % (EUTILS, urllib.parse.urlencode({
        "db": "pubmed", "term": term, "retmax": retmax,
        "retmode": "json", "sort": "relevance",
    }))
    req = urllib.request.Request(url, headers={"User-Agent": "RMFOODFP/1.0"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return json.loads(r.read())


print("=" * 76)
print("STEP B PROBE: real ACE-inhibitory peptide evidence in PubMed")
print("=" * 76)

TERMS = [
    'ACE inhibitory peptide IC50 food protein',
    'antihypertensive peptide IC50 casein',
    'ACE inhibitory peptide structure activity relationship',
]

for t in TERMS:
    try:
        d = esearch(t, retmax=3)
        res = d.get("esearchresult", {})
        print("  query: %s" % t)
        print("    total hits: %s" % res.get("count"))
        print("    pmids: %s" % ",".join(res.get("idlist", [])[:3]))
    except Exception as e:
        print("  query: %s -> ERROR %s" % (t, type(e).__name__))
    time.sleep(0.5)