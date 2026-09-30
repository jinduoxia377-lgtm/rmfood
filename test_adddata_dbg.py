"""Diagnose why POST /experiments/{id}/data fails."""
import requests

BASE = "http://localhost:8000/api/v1"
r = requests.post(f"{BASE}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=10)
tok = r.json().get("access_token")
s = requests.Session()
s.headers["Authorization"] = f"Bearer {tok}"
s.get(f"{BASE}/experiments", timeout=10)
csrf = s.cookies.get("csrf_token")
h = {"X-CSRF-Token": csrf} if csrf else {}

# list experiments to get a real id
rg = s.get(f"{BASE}/experiments", headers=h, timeout=15)
print("list:", rg.status_code)
items = rg.json().get("items", [])
if items:
    eid = items[0]["id"]
    print(f"using experiment {eid} status={items[0].get('status')}")
    # start it
    rs = s.post(f"{BASE}/experiments/{eid}/start", headers=h, timeout=15)
    print("start:", rs.status_code, rs.text[:200])
    # try add data
    rp = s.post(f"{BASE}/experiments/{eid}/data", params={"parameter": "factor_A", "value": 1.0, "unit": "coded"}, headers=h, timeout=15)
    print("add data:", rp.status_code, rp.text[:300])
else:
    print("no experiments found (all deleted?)")
