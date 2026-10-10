# -*- coding: utf-8 -*-
"""深度核查：实测所有端点契约 + 比对前端字段使用，输出问题清单"""
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

def get(path, params=None):
    url = BASE + path
    if params:
        url += "?" + urllib.parse.urlencode(params)
    try:
        with urllib.request.urlopen(url, timeout=30) as r:
            return r.status, json.loads(r.read())
    except urllib.error.HTTPError as e:
        return e.code, json.loads(e.read())

report = []

# 1. /analyze 完整字段
s, d = post("/peptide-structure/analyze", {"sequence": "VLGYT"})
report.append(f"/analyze [{s}] keys={sorted(d.keys())}")
report.append(f"  safety keys={sorted(d.get('safety', {}).keys())}")
report.append(f"  taste keys={sorted(d.get('taste', {}).keys()) if isinstance(d.get('taste'), dict) else d.get('taste')}")
report.append(f"  dpp4_inhibition={json.dumps(d.get('dpp4_inhibition'), ensure_ascii=False)[:200]}")
report.append(f"  source={json.dumps(d.get('source'), ensure_ascii=False)[:200]}")

# 2. deep 分析完整结构
s, d = post("/ai/peptide/advanced/analyze/deep", {"sequence": "VLGYT"})
report.append(f"\n/deep [{s}] keys={sorted(d.keys())}")
report.append(f"  result keys={sorted((d.get('result') or {}).keys())}")

# 3. batch-analyze 真实结构
s, d = post("/peptide-structure/batch-analyze", {"sequences": ["VLGYT", "RPYPIP"]})
report.append(f"\n/batch-analyze [{s}] keys={sorted(d.keys())}")
if "results" in d:
    r0 = d["results"][0]
    report.append(f"  results[0] keys={sorted(r0.keys())}")

# 4. pareto 完整
s, d = post("/ai/peptide/advanced/optimize/pareto", {
    "sequences": ["VLGYT", "RPYPIP"], "objectives": ["ACE_inhibitory", "antioxidant"]})
report.append(f"\n/pareto [{s}] keys={sorted(d.keys()) if isinstance(d, dict) else type(d)}")
report.append(f"  全量: {json.dumps(d, ensure_ascii=False)[:400]}")

# 5. synergy 完整
s, d = post("/ai/peptide/advanced/analyze/synergy", {"peptide_sequences": ["VLGYT"], "herb_names": ["黄芪", "人参"]})
report.append(f"\n/synergy [{s}] keys={sorted(d.keys()) if isinstance(d, dict) else type(d)}")
data = d.get("data", d)
report.append(f"  data keys={sorted(data.keys()) if isinstance(data, dict) else type(data)}")
tm = data.get("top_combinations")
report.append(f"  top_combinations[0]={json.dumps(tm[0] if tm else {}, ensure_ascii=False)}")
recs = data.get("recommendations")
report.append(f"  recommendations sample={json.dumps((recs or [])[:2], ensure_ascii=False)[:200]}")

# 6. solubility 完整
s, d = post("/ai/peptide/advanced/predict/solubility", {"sequences": ["VLGYT"]})
data = d.get("data", d)
p0 = (data.get("predictions") or [{}])[0]
report.append(f"\n/solubility [{s}] prediction[0] keys={sorted(p0.keys())}")
report.append(f"  prediction[0]={json.dumps(p0, ensure_ascii=False)[:400]}")

# 7. variants 完整
s, d = post("/ai/peptide/advanced/generate/variants", {"template_sequence": "VLGYT", "num_variants": 3})
data = d.get("data", d)
v0 = (data.get("variants") or [{}])[0]
report.append(f"\n/variants [{s}] variant[0] keys={sorted(v0.keys())}")
report.append(f"  variant[0]={json.dumps(v0, ensure_ascii=False)[:400]}")

# 8. optimize/custom 真实契约
s, d = post("/ai/peptide/advanced/optimize/custom", {"seed_sequence": "VLGYT"})
report.append(f"\n/optimize/custom [{s}] = {json.dumps(d, ensure_ascii=False)[:300]}")

# 9. capabilities
s, d = get("/ai/peptide/advanced/capabilities")
report.append(f"\n/capabilities [{s}] = {json.dumps(d, ensure_ascii=False)[:300]}")

# 10. history + statistics
s, d = get("/peptide-structure/history", {"page": 1, "page_size": 3})
report.append(f"\n/history [{s}] keys={sorted(d.keys()) if isinstance(d, dict) else type(d)}")
report.append(f"  items[0] keys={sorted((d.get('items') or [{}])[0].keys())}")
s, d = get("/peptide-structure/history/statistics")
report.append(f"/history/statistics [{s}] keys={sorted(d.keys()) if isinstance(d, dict) else type(d)}")

# 11. database/search 完整
s, d = get("/peptide-structure/database/search", {"page": 1, "page_size": 2})
report.append(f"\n/database/search [{s}] keys={sorted(d.keys()) if isinstance(d, dict) else type(d)}")
items = d.get("items") or d.get("records") or []
if items:
    report.append(f"  item[0] keys={sorted(items[0].keys())}")
    report.append(f"  item[0]={json.dumps(items[0], ensure_ascii=False)[:300]}")

# 12. database/statistics
s, d = get("/peptide-structure/database/statistics")
report.append(f"\n/database/statistics [{s}] = {json.dumps(d, ensure_ascii=False)[:400]}")

# 13. compare 用的 /analyze 字段核对（前端使用 r.safety.food_score 等）
# 14. smiles-to-3d（GET 端点）
s, d = get("/peptide-structure/smiles-to-3d", {"smiles": "CCN"})
report.append(f"\n/smiles-to-3d [{s}] keys={sorted(d.keys()) if isinstance(d, dict) else type(d)}")

print("\n".join(report))
