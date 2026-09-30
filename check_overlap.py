import json
import urllib.request

r = urllib.request.urlopen("http://localhost:8000/openapi.json", timeout=10)
spec = json.load(r)
paths = spec.get("paths", {})

# Overlap analysis: group by meaningful domain keywords
keywords = {
    "coas": "/coa",
    "experiments": "/experiments",
    "stability": "/stability",
    "formula-validation": "/formulas",
    "compliance": "/compliance",
    "ingredients": "/ingredients",
    "doe": "/doe",
    "labels": "/labels",
    "documents": "/documents",
    "ai-stability": "/ai/stability",
    "ai-safety": "/ai/safety",
    "ai-synergy": "/ai/synergy",
    "ai-taste": "/ai/taste",
    "ai-experiment-analyze": "/ai/analyze/experiment",
    "ai-formula-analyze": "/ai/analyze/formula",
}

for name, kw in keywords.items():
    matches = {p: [m.upper() for m in paths[p]] for p in paths if kw in p}
    if matches:
        print(f"\n--- {name} ({kw}) ---")
        for p in sorted(matches):
            print(f"  {p}  {matches[p]}")
    else:
        print(f"\n--- {name} ({kw}): NONE")
