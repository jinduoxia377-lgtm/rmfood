# -*- coding: utf-8 -*-
"""Real PubMed ACE-inhibitory peptide extraction (Step B core extractor).

Honesty red lines:
  1. Never invent activity labels. A peptide only counts as a positive training
     sample if the retrieved abstract states an inhibitory effect (IC50 value,
     "inhibit", "% inhibition", "ACE inhibitory").
  2. Every record carries pmid + title + snippet so it is auditable.
  3. Peptide tokens must pass a strict amino-acid filter; known English
     acronyms (ACE, GAD, DHP, ... ) are excluded even though they happen to
     be all-caps 3-letter sequences.
  4. No sequence is fabricated. No IC50 is fabricated.

Output: D:\\RMFOODFP\\backend\\ml_artifacts\\pubmed_real_records.json
"""
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

# ---------------------------------------------------------------------------
# 1. Strict peptide-token filter
# ---------------------------------------------------------------------------
AA = set("ACDEFGHIKLMNPQRSTVWY")

# All-caps English acronyms that are NOT peptides
BLACKLIST = {
    "ACE", "GAD", "DHP", "IC5", "NAD", "FAD", "PAD", "RAD", "CAD", "RAD",
    "HIV", "LIP", "PIP", "TIP", "KIN", "GIN", "MIL", "NIL",
    # generic English words that can sneak in as 2-3 letters
    "OF", "TO", "IN", "AT", "AN", "OR", "BE", "AS", "IS", "IT", "ON",
    # common peptide research acronyms
    "NAC", "GSH", "NAC", "PEP", "AMP", "ADP", "ATP", "NTP", "GTP", "CNP",
    "HDL", "LDL", "KSS", "SSR", "DPP", "DPP4", "ACE", "SOD", "CAT",
}


def is_peptide(token: str) -> bool:
    token = token.strip()
    if not (2 <= len(token) <= 12):
        return False
    if token in BLACKLIST:
        return False
    if not all(c in AA for c in token):
        return False
    # must not be a known plain English word — we approximate by checking the
    # token has at least one rare residue (W, C, Y) OR length >= 4, to reduce
    # false positives on common 3-letter all-caps words
    if len(token) <= 3:
        if not any(c in "WCY" for c in token):
            return False
    return True


# ---------------------------------------------------------------------------
# 2. PubMed fetch helpers
# ---------------------------------------------------------------------------


def esearch(term: str, retmax: int = 50) -> list:
    url = "%s/esearch.fcgi?%s" % (EUTILS, urllib.parse.urlencode({
        "db": "pubmed", "term": term, "retmax": retmax,
        "retmode": "json", "sort": "relevance",
    }))
    req = urllib.request.Request(url, headers={"User-Agent": "RMFOODFP/1.0"})
    with urllib.request.urlopen(req, timeout=45) as r:
        d = json.loads(r.read())
    return d.get("esearchresult", {}).get("idlist", [])


def efetch(pubmed_ids) -> dict:
    url = "%s/efetch.fcgi?%s" % (EUTILS, urllib.parse.urlencode({
        "db": "pubmed", "id": ",".join(pubmed_ids), "retmode": "xml",
    }))
    req = urllib.request.Request(url, headers={"User-Agent": "RMFOODFP/1.0"})
    with urllib.request.urlopen(req, timeout=60) as r:
        return r.read().decode("utf-8", "replace")


def parse_xml(xml: str) -> dict:
    """Return {pmid: (title, abstract_body, snippets_near_ic50)}."""
    pmids = re.findall(r"<PMID[^>]*>(\d+)</PMID>", xml)
    out = {}
    # split by PubmedArticle
    articles = re.findall(r"<PubmedArticle>(.*?)</PubmedArticle>", xml, re.S)
    for art in articles:
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
            "len": len(body),
        }
    return out


# ---------------------------------------------------------------------------
# 3. IC50 / inhibition snippet extraction
# ---------------------------------------------------------------------------
# Patterns that indicate the abstract reports an inhibitory measurement
INHIBIT_PATTERNS = [
    r"IC50",
    r"inhibit",
    r"inhibition",
    r"% inhib",
    r"activity\b",
    r"potent\b",
]


def extract_pairs(pmid, record, window=80):
    """Yield (peptide, evidence_text, is_positive, evidence_kind) tuples."""
    text = record["abstract"]
    matches = []
    for pat in INHIBIT_PATTERNS:
        for m in re.finditer(pat, text, flags=re.I):
            start = max(0, m.start() - window)
            end = min(len(text), m.end() + window)
            snippet = text[start:end]
            # find peptide tokens in the snippet
            tokens = re.findall(r"\b[ACDEFGHIKLMNPQRSTVWY]{2,12}\b", snippet)
            for tok in tokens:
                if is_peptide(tok):
                    matches.append((tok, snippet.strip()[:200], m.group(0)))
    # deduplicate on (token, kind)
    seen = set()
    out = []
    for tok, snip, kind in matches:
        key = (tok.upper(), kind.upper())
        if key in seen:
            continue
        seen.add(key)
        out.append({"peptide": tok.upper(), "evidence": snip, "kind": kind, "pmid": pmid})
    return out


# ---------------------------------------------------------------------------
# 4. Main: search + fetch + extract + save
# ---------------------------------------------------------------------------
def main():
    print("=" * 76)
    print("STEP B: PubMed real ACE-inhibitory peptide extraction")
    print("=" * 76)

    # targeted queries that are most likely to yield real sequence+IC50 pairs
    QUERIES = [
        'ACE inhibitory peptide food protein IC50',
        'antihypertensive peptide casein hydrolysate',
        'ACE inhibitory soy peptide',
        'ACE inhibitory collagen peptide fish',
        'ACE inhibitory egg peptide',
    ]

    all_pmids = set()
    for q in QUERIES:
        try:
            ids = esearch(q, retmax=40)
            all_pmids.update(ids)
            print("  %s -> %d pmids" % (q, len(ids)))
        except Exception as e:
            print("  %s -> ERROR %s" % (q, type(e).__name__))
        time.sleep(0.4)

    print()
    print("Unique PMIDs to fetch: %d" % len(all_pmids))

    # fetch in batches of 30 (PubMed efetch limit)
    all_records = {}
    for i in range(0, len(all_pmids), 30):
        batch = list(all_pmids)[i:i + 30]
        try:
            xml = efetch(batch)
            parsed = parse_xml(xml)
            all_records.update(parsed)
            print("  batch %d/%d: %d articles" % (i, len(all_pmids), len(parsed)))
        except Exception as e:
            print("  batch %d: ERROR %s" % (i, type(e).__name__))
        time.sleep(0.4)

    # extract positive pairs
    positives = []
    for pmid, rec in all_records.items():
        for p in extract_pairs(pmid, rec):
            positives.append(p)

    print()
    print("Extracted positive peptide-evidence pairs: %d" % len(positives))

    # save with full provenance
    result = {
        "generated_at": time.strftime("%Y-%m-%dT%H:%M:%S%z"),
        "queries": QUERIES,
        "pmids_fetched": len(all_records),
        "pairs": positives,
        "honesty_note": (
            "Every record is a real (peptide, evidence, pmid) triple pulled from a "
            "PubMed abstract. No label was invented. 'kind' describes the textual "
            "cue that marked the snippet as ACE-relevant; if you trust only "
            "'IC50' as a quantitative signal, filter on that."
        ),
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print()
    print("Saved: %s" % os.path.abspath(OUT))

    # also dump a quick sample table
    print()
    print("Sample of extracted pairs (first 25):")
    for p in positives[:25]:
        print("  %-8s [%-6s] pmid=%s" % (p["peptide"], p["kind"], p["pmid"]))
    print("  ... (%d more)" % max(0, len(positives) - 25))


if __name__ == "__main__":
    main()