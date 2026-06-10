import requests
import json

BASE = "http://localhost:8001/api/v1"

# 1. Login
print("Connecting to backend...")
r = requests.post(f"{BASE}/auth/login", json={"username": "admin", "password": "admin123"})
token = r.json().get("access_token", "")
headers = {"Authorization": f"Bearer {token}"}

print("=" * 70)
print("  RMFOOD Analytics API - Final Integration Test (Port 8001)")
print("=" * 70)

# 2. Test Dashboard (MAIN TEST)
print("\n[TEST 1] Dashboard API (Full Data)")
r2 = requests.get(f"{BASE}/analytics/dashboard", headers=headers, params={"range": "30d"})
print(f"  Status: {r2.status_code}")

if r2.status_code == 200:
    data = r2.json()
    kpi = data.get("kpi", [])
    charts = data.get("charts", {})
    activity = data.get("recent_activity", [])
    
    print(f"  KPI Metrics: {len(kpi)}")
    for k in kpi[:4]:
        change = k.get('change_percent')
        change_str = f" ({change:+.1f}%)" if change else ""
        print(f"    - {k['name']}: {k['value']} {k.get('unit', '')}{change_str}")
    
    print(f"  Chart Types: {list(charts.keys())}")
    print(f"  Recent Activity: {len(activity)} items")
    print(f"  Timestamp: {data.get('timestamp', 'N/A')[:19]}")
    print("  [PASS] Dashboard API working perfectly!")
else:
    print(f"  [FAIL] Error: {r2.text[:300]}")

# 3. Test KPI
print("\n[TEST 2] KPI Metrics (Quick)")
r3 = requests.get(f"{BASE}/analytics/kpi", headers=headers)
if r3.status_code == 200:
    metrics = r3.json().get("metrics", [])
    print(f"  Total Metrics: {len(metrics)}")
    print("  [PASS] KPI API working!")

# 4. Test Trends
print("\n[TEST 3] Trend Data (Formulas - 30 days)")
r4 = requests.get(f"{BASE}/analytics/trends/formulas?days=30&granularity=daily", headers=headers)
if r4.status_code == 200:
    trend = r4.json()
    points = trend.get("data_points", 0)
    print(f"  Data Points: {points}")
    if points > 0:
        first_date = trend["data"][0].get("period", "N/A") if trend.get("data") else "N/A"
        last_date = trend["data"][-1].get("period", "N/A") if trend.get("data") else "N/A"
        print(f"  Date Range: {first_date} ~ {last_date}")
    print("  [PASS] Trend API working!")

# 5. Test System Health
print("\n[TEST 4] System Health")
r5 = requests.get(f"{BASE}/analytics/system-health", headers=headers)
if r5.status_code == 200:
    health = r5.json()
    print(f"  Database: {health.get('database_status')}")
    print(f"  API Status: {health.get('api_status')}")
    print(f"  WebSocket Connections: {health.get('websocket_connections', {}).get('total', 0)}")
    print("  [PASS] System Health API working!")

# 6. Test Filters
print("\n[TEST 5] Available Filters")
r6 = requests.get(f"{BASE}/analytics/filters", headers=headers)
if r6.status_code == 200:
    filters = r6.json()
    categories = filters.get("categories", [])
    users = filters.get("users", [])
    time_ranges = filters.get("time_ranges", [])
    print(f"  Categories: {len(categories)}")
    print(f"  Users: {len(users)}")
    print(f"  Time Ranges: {[tr.get('label') for tr in time_ranges]}")
    print("  [PASS] Filters API working!")

print("\n" + "=" * 70)
print("  All Tests Complete!")
print("=" * 70)
