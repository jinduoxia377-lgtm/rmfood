import requests
import json

BASE = "http://localhost:8001/api/v1"

# Login
r = requests.post(f"{BASE}/auth/login", json={"username": "admin", "password": "admin123"})
token = r.json().get("access_token", "")
headers = {"Authorization": f"Bearer {token}"}

print("Testing Dashboard with detailed error info...")
r2 = requests.get(f"{BASE}/analytics/dashboard", headers=headers)
print(f"Status: {r2.status_code}")

if r2.status_code != 200:
    error_detail = r2.json().get("detail", "No detail")
    print(f"\nFull Error:\n{error_detail}")
    print("\n" + "="*70)
    
    # Test each sub-component individually to isolate the problem
    print("Testing individual components...\n")
    
    print("[A] Testing KPI only:")
    r3 = requests.get(f"{BASE}/analytics/kpi", headers=headers)
    print(f"  Status: {r3.status_code} - {'OK' if r3.status_code == 200 else r3.text[:100]}")
    
    print("[B] Testing System Health only:")
    r4 = requests.get(f"{BASE}/analytics/system-health", headers=headers)
    print(f"  Status: {r4.status_code} - {'OK' if r4.status_code == 200 else r4.text[:100]}")
    
    print("[C] Testing Filters only:")
    r5 = requests.get(f"{BASE}/analytics/filters", headers=headers)
    print(f"  Status: {r5.status_code} - {'OK' if r5.status_code == 200 else r5.text[:100]}")
else:
    data = r2.json()
    print("SUCCESS! Dashboard loaded.")
    print(f"KPI Count: {len(data.get('kpi', []))}")
