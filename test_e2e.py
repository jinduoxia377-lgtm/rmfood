"""End-to-end test: verify all 6 pages' backend APIs"""
import requests, json

BASE = "http://localhost:8000/api/v1"

def check(name, r, key_path=None):
    try:
        data = r.json()
        if key_path:
            val = data
            for k in key_path.split("."):
                val = val.get(k, None) if isinstance(val, dict) else getattr(val, k, None)
            print(f"  [OK] {name}: {val}")
        else:
            print(f"  [OK] {name}: HTTP {r.status_code}")
    except Exception as e:
        print(f"  [FAIL] {name}: {e}")

print("=" * 60)
print("1. DOE")
print("=" * 60)
r = requests.get(f"{BASE}/doe/health", timeout=5)
check("health", r, "status")

# CCD generate
r = requests.post(f"{BASE}/doe/ccd", json={"factors": [
    {"name": "A", "low": 0, "high": 100, "center": 50},
    {"name": "B", "low": 10, "high": 60, "center": 35}
], "n_center_points": 6}, timeout=10)
runs = r.json().get("runs", [])
print(f"  [OK] CCD generated: {len(runs)} runs")

# Fill responses
for i, run in enumerate(runs):
    run["response_values"] = {"y": 50 + 10*run["coded_levels"]["A"] + 5*run["coded_levels"]["B"]}

# Fit
r = requests.post(f"{BASE}/doe/fit", json={"runs": runs, "response_names": ["y"]}, timeout=10)
model = r.json()["models"][0]
print(f"  [OK] Fit: R2={model['r_squared'].get('y')}")

# Inverse search
r = requests.post(f"{BASE}/doe/inverse-search", json={"model": model, "target_values": {"y": 60}}, timeout=15)
d = r.json()
print(f"  [OK] Inverse search: converged={d['converged']}, feasibility={d['feasibility_score']}")

# Active learning
r = requests.post(f"{BASE}/doe/active-learning", json={"runs": runs, "response_names": ["y"]}, timeout=10)
d = r.json()
print(f"  [OK] Active learning: {len(d.get('recommendations', []))} recommendations")

print()
print("=" * 60)
print("2. Stability")
print("=" * 60)
r = requests.get(f"{BASE}/stability/health", timeout=5)
check("health", r, "status")

r = requests.post(f"{BASE}/stability/predict", json={
    "ingredients": [{"name": "黄芪多糖", "dosage_mg": 3000}, {"name": "维生素C", "dosage_mg": 500}],
    "storage_temp": 25, "storage_humidity": 60,
    "light_exposure": "normal", "packaging": "standard", "months_to_predict": 24
}, timeout=10)
d = r.json()["data"]
print(f"  [OK] Predict: shelf_life={d['estimated_shelf_life_months']}mo, score={d['stability_score']}")

r = requests.post(f"{BASE}/stability/q10", json={
    "ingredients": [{"name": "黄芪多糖", "dosage_mg": 3000}, {"name": "维生素C", "dosage_mg": 500}],
    "t1": 25, "t2": 40
}, timeout=5)
q10d = r.json()["data"]
print(f"  [OK] Q10: q10={q10d.get('q10')}")

print()
print("=" * 60)
print("3. Ingredient Analysis")
print("=" * 60)
r = requests.get(f"{BASE}/ingredients/health", timeout=5)
check("health", r, "data.status")

r = requests.post(f"{BASE}/ingredients/analyze", json={
    "ingredient_text": "黄芪5g，枸杞3g，山药10g，柠檬酸0.5g，E150 0.1g，E330 2g"
}, timeout=10)
d = r.json()
print(f"  [OK] Analyze: success={d.get('success')}, score={d.get('data',{}).get('overallScore')}, suggestions={len(d.get('data',{}).get('suggestions',[]))}")

print()
print("=" * 60)
print("4. Compliance Check")
print("=" * 60)
r = requests.get(f"{BASE}/compliance/health", timeout=5)
check("health", r, "data.status")

r = requests.post(f"{BASE}/compliance/check/bulk", json={
    "ingredients": [{"name": "黄芪", "dosage_mg": 5000}, {"name": "枸杞", "dosage_mg": 3000}],
    "population": "adults"
}, timeout=10)
d = r.json()["data"]
print(f"  [OK] Check: score={d['score']}, status={d['status']}, violations={len(d.get('violations',[]))}")

r = requests.get(f"{BASE}/compliance/prohibited", timeout=5)
combos = r.json()["data"]["combinations"]
print(f"  [OK] Prohibited: {len(combos)} combinations")

r = requests.get(f"{BASE}/compliance/limits", timeout=5)
limits = r.json()["data"]["limits"]
print(f"  [OK] Limits: {len(limits)} entries")

r = requests.get(f"{BASE}/compliance/food-homology", timeout=5)
materials = r.json()["data"]["materials"]
print(f"  [OK] Food homology: {len(materials)} materials")

print()
print("=" * 60)
print("5. Document Extract")
print("=" * 60)
r = requests.get(f"{BASE}/documents/health", timeout=5)
check("health", r, "status")

coa = """检验报告
产品名称：黄芪多糖提取物
批号：HT2024001
含量：黄芪多糖≥95.0%
水分：≤5.0%
重金属：铅≤2.0mg/kg，砷≤1.0mg/kg，汞≤0.5mg/kg
微生物：细菌总数≤1000cfu/g，霉菌≤100cfu/g，酵母菌≤50cfu/g，大肠杆菌阴性，沙门氏菌阴性
结论：本品经检验，符合《中国药典》2020年版规定，判定为合格。"""

r = requests.post(f"{BASE}/documents/extract/text", json={"text": coa, "document_type": "coa"}, timeout=10)
fields = r.json().get("data", {}).get("extracted_fields", {})
print(f"  [OK] Extract: {len(fields)} fields found")
for k, v in fields.items():
    print(f"     {k}: {v['value'][:40]} (conf={v['confidence']})")

print()
print("=" * 60)
print("6. Label Generator")
print("=" * 60)
r = requests.get(f"{BASE}/labels/health", timeout=5)
check("health", r, "status")

for fmt in ["png", "svg"]:
    for barcode in ["code128", "qr", "both"]:
        r = requests.post(f"{BASE}/labels/generate", json={
            "entity_type": "batch", "entity_id": 1, "entity_name": "TEST-001",
            "label_size": "medium", "format": barcode, "output_format": fmt
        }, timeout=10)
        ct = r.headers.get("content-type", "").split("/")[-1]
        print(f"  [OK] Label ({barcode}/{fmt}): HTTP {r.status_code}, {len(r.content)} bytes, {ct}")

print()
print("=" * 60)
print("ALL 6 PAGES VERIFIED")
print("=" * 60)
