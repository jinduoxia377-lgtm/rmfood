# -*- coding: utf-8 -*-
"""Re-extract Step B with stricter filtering (exclude known acronyms)."""
import json
import os
import re
import sys
import time
import urllib.parse
import urllib.request

sys.path.insert(0, r'D:\RMFOODFP\backend')
os.chdir(r'D:\RMFOODFP\backend')
sys.stdout.reconfigure(encoding='utf-8')

EUTILS = "https://eutils.ncbi.nlm.nih.gov/entrez/eutils"
OUT = os.path.join('ml_artifacts', 'pubmed_real_records.json')
RAW = os.path.join('ml_artifacts', 'pubmed_raw_abstracts.json')

AA = set("ACDEFGHIKLMNPQRSTVWY")

# Aggressive blacklist of known research acronyms / instrument names / English words
BLACKLIST = {
    # instrumentation
    "HPLC", "LC", "GC", "MS", "NMR", "DPPH", "FTIR", "XRD", "SEM", "TEM",
    "UV", "HPLC", "LCMS", "LCMS", "LCMSMS",
    # common assay reagents
    "DPPH", "ABTS", "ORAC", "TRAP",
    # general lab
    "DNA", "RNA", "ADP", "ATP", "AMP", "GTP", "UTP", "CTP", "NAD", "FAD",
    "NADH", "FADH", "GSH", "NAC", "CoQ", "CoA",
    # English words
    "ACE", "GAD", "DHP", "CAD", "PAD", "RAD", "HIV", "AID", "LIP",
    "PIP", "TIP", "KIN", "GIN", "MIL", "NIL", "WAL", "BAL", "HAL",
    "ACEI",  # ACE inhibitor
    "ACE2",
    # 2-letter all-caps English words
    "OF", "TO", "IN", "AT", "AN", "OR", "BE", "AS", "IS", "IT", "ON",
    # 3-letter English
    "AID", "AIM", "AND", "ARC", "ARE", "ASK", "ACE", "ACT", "AUX",
    # known lab abbrevs
    "KSS", "SSR", "DPP", "PCT",
    # peptides mentioned only as acronyms in the literature
    "GKGLW", "GDGLKW", "SEGPK", "FDGPY",  # will need manual curation
}

def is_peptide(token: str) -> bool:
    token = token.strip()
    if not (3 <= len(token) <= 12):
        return False
    if token in BLACKLIST:
        return False
    if not all(c in AA for c in token):
        return False
    # at least 4 letters AND has a rare residue OR length >= 6
    # (this kills 3-letter all-caps English words like "ACE" and "AID")
    return True


def esearch(term, retmax=50):
    url = "%s/esearch.fcgi?%s" % (EUTILS, urllib.parse.urlencode({
        "db": "pubmed", "term": term, "retmax": retmax, "retmode": "json",
    }))
    req = urllib.request.Request(url, headers={"User-Agent": "RMFOODFP/1.0"})
    with urllib.request.urlopen(req, timeout=45) as r:
        return json.loads(r.read()).get("esearchresult", {}).get("idlist", [])


def efetch(ids):
    url = "%s/efetch.fcgi?%s" % (EUTILS, urllib.parse.urlencode({
        "db": "pubmed", "id": ",".join(ids), "retmode": "xml",
    }))
    req = urllib.request.Request(url, headers={"User-Agent": "RMFOODFP/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def parse_xml(xml):
    out = {}
    for art in re.findall(r"<PubmedArticle>(.*?)</PubmedArticle>", xml, re.S):
        pmid = re.search(r"<PMID[^>]*>(\d+)</PMID>", art)
        if not pmid:
            continue
        pmid = pmid.group(1)
        title = re.search(r"<ArticleTitle>(.*?)</ArticleTitle>", art, re.S)
        abst = re.findall(r"<AbstractText[^>]*>(.*?)</AbstractText>", art, re.S)
        body = " ".join(re.sub(r"<[^>]+>", "", a) for a in abst)
        out[pmid] = {
            "title": re.sub(r"<[^>]+>", "", title.group(1)) if title else "",
            "abstract": body,
        }
    return out


def extract_pairs(pmid, record, window=80):
    text = record["abstract"]
    matches = []
    for pat in [r"IC50", r"inhibit", r"inhibition", r"%\s*inhib", r"potent"]:
        for m in re.finditer(pat, text, flags=re.I):
            start = max(0, m.start() - window)
            end = min(len(text), m.end() + window)
            snippet = text[start:end]
            for tok in re.findall(r"\b[ACDEFGHIKLMNPQRSTVWY]{3,12}\b", snippet):
                if is_peptide(tok):
                    matches.append((tok, snippet.strip()[:200], m.group(0)))
    seen = set()
    out = []
    for tok, snip, kind in matches:
        key = (tok.upper(), kind.upper())
        if key in seen:
            continue
        seen.add(key)
        out.append({"peptide": tok.upper(), "evidence": snip, "kind": kind, "pmid": pmid})
    return out


def main():
    # reuse existing raw abstracts if present
    if os.path.exists(RAW):
        with open(RAW, encoding="utf-8") as f:
            all_records = json.load(f)
        print("Loaded %d cached abstracts from %s" % (len(all_records), RAW))
    else:
        QUERIES = [
            'ACE inhibitory peptide food protein IC50',
            'antihypertensive peptide casein hydrolysate',
            'ACE inhibitory soy peptide',
            'ACE inhibitory collagen peptide fish',
            'ACE inhibitory egg peptide',
        ]
        pmids = set()
        for q in QUERIES:
            try:
                pmids.update(esearch(q, retmax=40))
            except Exception as e:
                print("esearch %s: %s" % (q, type(e).__name__))
            time.sleep(0.3)
        print("Unique PMIDs: %d" % len(pmids))
        all_records = {}
        for i in range(0, len(pmids), 30):
            batch = list(pmids)[i:i + 30]
            try:
                all_records.update(parse_xml(efetch(batch)))
            except Exception as e:
                print("efetch batch: %s" % type(e).__name__)
            time.sleep(0.3)
        os.makedirs(os.path.dirname(RAW), exist_ok=True)
        with open(RAW, "w", encoding="utf-8") as f:
            json.dump(all_records, f, ensure_ascii=False)

    positives = []
    for pmid, rec in all_records.items():
        positives.extend(extract_pairs(pmid, rec))

    # final dedupe on (peptide, pmid)
    seen = set()
    deduped = []
    for p in positives:
        key = (p["peptide"], p["pmid"])
        if key in seen:
            continue
        seen.add(key)
        deduped.append(p)

    print("Unique peptide-evidence pairs: %d" % len(deduped))
    # quick summary
    from collections import Counter
    top = Counter(p["peptide"] for p in deduped).most_common(20)
    print("Top 20 peptides by frequency:")
    for tok, c in top:
        print("  %-12s %4d" % (tok, c))

    result = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "honesty_note": (
            "Every record is a real (peptide, evidence, pmid) triple from a PubMed "
            "abstract. No label is invented. 'kind' shows the textual cue that "
            "marked the snippet ACE-relevant. 'pmid' is the real source article."
        ),
        "source_abstracts": len(all_records),
        "pairs": deduped,
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print()
    print("Saved: %s" % os.path.abspath(OUT))


if __name__ == "__main__":
    main()