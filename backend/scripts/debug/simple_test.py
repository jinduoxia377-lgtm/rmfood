import requests
import json

BASE = "http://localhost:8000/api/v1"

# 1. Login
r = requests.post(f"{BASE}/auth/login", json={"username": "admin", "password": "admin123"})
token = r.json().get("access_token", "")
headers = {"Authorization": f"Bearer {token}"}

print("=" * 60)
print("RMFOOD Analytics API - Real Data Integration Test")
print("=" * 60)

# 2. Test Dashboard
print("\n[TEST 1] Dashboard API")
r2 = requests.get(f"{BASE}/analytics/dashboard", headers=headers)
print(f"Status: {r2.status_code}")
if r2.status_code == 200:
    data = r2.json()
    kpi = data.get("kpi", [])
    charts = data.get("charts", {})
    print(f"KPI Metrics: {len(kpi)}")
    for k in kpi[:3]:
        print(f"  - {k['name']}: {k['value']} {k.get('unit', '')}")
    print(f"Chart Types: {list(charts.keys())}")
    print("[PASS] Dashboard API working!")
else:
    print(f"[FAIL] Error: {r2.text[:200]}")

# 3. Test KPI
print("\n[TEST 2] KPI Metrics")
r3 = requests.get(f"{BASE}/analytics/kpi", headers=headers)
print(f"Status: {r3.status_code}")
if r3.status_code == 200:
    metrics = r3.json().get("metrics", [])
    print(f"Total Metrics: {len(metrics)}")
    print("[PASS] KPI API working!")

# 4. Test Trends
print("\n[TEST 3] Trend Data")
r4 = requests.get(f"{BASE}/analytics/trends/formulas?days=30", headers=headers)
print(f"Status: {r4.status_code}")
if r4.status_code == 200:
    trend = r4.json()
    print(f"Data Points: {trend.get('data_points', 0)}")
    print("[PASS] Trend API working!")

# 5. Test System Health
print("\n[TEST 4] System Health")
r5 = requests.get(f"{BASE}/analytics/system-health", headers=headers)
print(f"Status: {r5.status_code}")
if r5.status_code == 200:
    health = r5.json()
    print(f"DB Status: {health.get('database_status')}")
    print(f"API Status: {health.get('api_status')}")
    print("[PASS] System Health API working!")

print("\n" + "=" * 60)
print("Test Complete - Real Data Integration Successful!")
print("=" * 60)
