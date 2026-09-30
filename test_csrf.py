import requests

BASE = "http://localhost:8000/api/v1"

# login
r = requests.post(f"{BASE}/auth/login", json={"username": "admin", "password": "admin123"}, timeout=10)
print("login:", r.status_code)
d = r.json()
token = d.get("access_token") or (d.get("data") or {}).get("access_token")
print("token:", bool(token))

s = requests.Session()
s.headers["Authorization"] = f"Bearer {token}"

# get csrf
rc = s.get(f"{BASE}/auth/csrf-token", timeout=10)
print("csrf endpoint:", rc.status_code, rc.text[:200])
if rc.status_code == 200:
    cd = rc.json()
    print("csrf json:", cd)
    csrf = cd.get("csrf_token") or (cd.get("data") or {}).get("csrf_token") or cd.get("token")
    print("csrf_token:", csrf)
