import requests
BASE = "http://localhost:8000/api/v1"
r = requests.post(f"{BASE}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=10)
tok = r.json().get("access_token")
s = requests.Session()
s.headers["Authorization"] = f"Bearer {tok}"
s.get(f"{BASE}/experiments", timeout=10)
csrf = s.cookies.get("csrf_token")
print("csrf:", csrf)
h = {"X-CSRF-Token": csrf} if csrf else {}
# 1) GET list
rg = s.get(f"{BASE}/experiments", headers=h, timeout=15)
print("GET list:", rg.status_code, rg.text[:200])
# 2) POST create
body = {"title": "DBG-POST", "code": "EXP-DEBUG-002"}
rp = s.post(f"{BASE}/experiments", json=body, headers=h, timeout=20)
print("POST create:", rp.status_code, rp.text[:400])
# 3) POST add data
body2 = {"parameter": "factor_A", "value": "1.0", "unit": "coded"}
rp2 = s.post(f"{BASE}/experiments/1/data", json=body2, headers=h, timeout=20)
print("POST data:", rp2.status_code, rp2.text[:400])
# 4) GET doe runs
rd = s.get(f"{BASE}/doe/experiments/1/runs", headers=h, timeout=15)
print("GET doe runs:", rd.status_code, rd.text[:400])
