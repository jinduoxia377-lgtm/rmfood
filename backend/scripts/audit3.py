# -*- coding: utf-8 -*-
"""核查 /generate/variants 422 根因 + /optimize/custom 缺参契约"""
import json, urllib.request, urllib.parse

BASE = "http://localhost:8000/api/v1"

def post(path, body=None, params=None):
    url = BASE + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    data = json.dumps(body).encode() if body else None
    req = urllib.request.Request(url, data=data, method="POST",
                                 headers={"Content-Type": "application/json"} if data else {})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

# variants 带 variant_type
s, d = post("/ai/peptide/advanced/generate/variants",
             {"template_sequence": "VLGYT", "variant_type": "point", "num_variants": 3})
print(f"variants(with variant_type) [{s}]")
if s == 200:
    data = d.get("data", {})
    print(f"  data keys={sorted(data.keys())}")
    v0 = (data.get("variants") or [{}])[0]
    print(f"  variant[0]={json.dumps(v0, ensure_ascii=False)[:400]}")
else:
    print(f"  error={json.dumps(d, ensure_ascii=False)[:500]}")

# optimize/custom 完整参数
s, d = post("/ai/peptide/advanced/optimize/custom",
            {"seed_sequence": "VLGYT", "objective_weights": {"ACE_inhibitory": 0.7, "antioxidant": 0.3},
             "iterations": 5, "population_size": 5})
print(f"\noptimize/custom(full) [{s}]")
if s == 200:
    data = d.get("data", d)
    print(f"  keys={sorted(data.keys()) if isinstance(data, dict) else type(data)}")
    print(f"  {json.dumps(data, ensure_ascii=False)[:500]}")
else:
    print(f"  error={json.dumps(d, ensure_ascii=False)[:300]}")
