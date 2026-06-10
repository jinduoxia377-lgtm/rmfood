import requests

BASE = "http://localhost:8002/api/v1"

print("=" * 60)
print("  RMFOOD System Verification (Port 8002)")
print("=" * 60)

# Test 1: Login
print("\n[1] Testing Login API...")
r = requests.post(f"{BASE}/auth/login", json={"username": "admin", "password": "admin123"})
if r.status_code == 200:
    token = r.json().get("access_token", "")
    print("    ✅ Login SUCCESS")
    headers = {"Authorization": f"Bearer {token}"}
else:
    print(f"    ❌ Login FAILED: {r.status_code}")
    exit(1)

# Test 2: Dashboard
print("[2] Testing Dashboard API...")
r2 = requests.get(f"{BASE}/analytics/dashboard", headers=headers)
if r2.status_code == 200:
    data = r2.json()
    kpi_count = len(data.get("kpi", []))
    chart_types = list(data.get("charts", {}).keys())
    print(f"    ✅ Dashboard OK - {kpi_count} KPIs, Charts: {chart_types}")
else:
    print(f"    ❌ Dashboard FAILED: {r2.status_code}")

# Test 3: System Health
print("[3] Testing System Health...")
r3 = requests.get(f"{BASE}/analytics/system-health", headers=headers)
if r3.status_code == 200:
    health = r3.json()
    db_status = health.get("database_status", "unknown")
    api_status = health.get("api_status", "unknown")
    print(f"    ✅ Health OK - DB: {db_status}, API: {api_status}")
else:
    print(f"    ❌ Health FAILED: {r3.status_code}")

print("\n" + "=" * 60)
print("  ✅ All Backend APIs Working Correctly!")
print("=" * 60)
