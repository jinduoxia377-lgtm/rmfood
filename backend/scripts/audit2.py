# -*- coding: utf-8 -*-
"""核查 /generate/variants 与 /deep 的真实契约"""
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

# variants 缺 template_sequence
s, d = post("/ai/peptide/advanced/generate/variants", {"template_sequence": "VLGYT", "num_variants": 3})
print(f"variants [{s}]")
data = d.get("data", {})
print(f"  data keys={sorted(data.keys())}")
v0 = (data.get("variants") or [{}])[0]
print(f"  variant[0]={json.dumps(v0, ensure_ascii=False)[:400]}")

# deep 完整结构
s, d = post("/ai/peptide/advanced/analyze/deep", {"sequence": "VLGYT"})
print(f"\ndeep [{s}]")
data = d.get("data", {})
print(f"  data keys={sorted(data.keys())}")
for k, v in data.items():
    if isinstance(v, dict):
        print(f"  {k} keys={sorted(v.keys())}")
    elif isinstance(v, list) and v and isinstance(v[0], dict):
        print(f"  {k}[0] keys={sorted(v[0].keys())}")
