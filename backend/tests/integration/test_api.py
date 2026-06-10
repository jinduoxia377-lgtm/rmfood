"""Phase 2 API 端到端测试"""
import requests
import json

BASE = "http://localhost:8000"
results = []

def log(msg):
    results.append(msg)
    print(msg)

# Login
r = requests.post(f"{BASE}/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
login_data = r.json()
token = login_data["access_token"]
h = {"Authorization": f"Bearer {token}"}
log(f"Login: {r.status_code} OK, token_type={login_data.get('token_type')}")
# Decode the token to check payload
import base64
payload_part = token.split('.')[1]
payload_part += '=' * (4 - len(payload_part) % 4)
payload_json = base64.urlsafe_b64decode(payload_part)
log(f"Token payload: {payload_json}")

# AI Models Status
r = requests.get(f"{BASE}/api/v1/ai/models/status", headers=h)
log(f"AI Models Status: {r.status_code}")

# AI Generate
r = requests.post(f"{BASE}/api/v1/ai/generate", headers=h, json={"target_effects": ["降血压", "抗氧化"]}, timeout=30)
log(f"AI Generate: {r.status_code} - {r.text[:300]}")

# AI Safety Check
r = requests.post(f"{BASE}/api/v1/ai/safety-check", headers=h, json={"ingredient_names": ["人参", "黄芪", "藜芦"]})
log(f"Safety Check: {r.status_code} - {r.text[:300]}")

# AI Synergy Analysis
r = requests.post(f"{BASE}/api/v1/ai/synergy-analysis", headers=h, json={"herb_names": ["黄芪", "党参", "枸杞子"]})
log(f"Synergy Analysis: {r.status_code} - {r.text[:300]}")

# Database - Herbs
r = requests.get(f"{BASE}/api/v1/databases/herbs", headers=h, params={"keyword": ""})
log(f"Herbs Search: {r.status_code} - {r.text[:300]}")

# Database - Peptides
r = requests.get(f"{BASE}/api/v1/databases/peptides", headers=h, params={"keyword": ""})
log(f"Peptides Search: {r.status_code} - {r.text[:300]}")

# Knowledge Graph
r = requests.get(f"{BASE}/api/v1/databases/knowledge-graph/search", headers=h, params={"keyword": "黄芪"})
log(f"KG Search: {r.status_code} - {r.text[:300]}")

# Snapshots
r = requests.get(f"{BASE}/api/v1/databases/snapshots", headers=h)
log(f"Snapshots: {r.status_code} - {r.text[:300]}")

# Notifications
r = requests.get(f"{BASE}/api/v1/notifications", headers=h)
log(f"Notifications: {r.status_code} - {r.text[:300]}")

# Admin Users
r = requests.get(f"{BASE}/api/v1/admin/users", headers=h)
log(f"Admin Users: {r.status_code} - {r.text[:300]}")

with open("test_results.txt", "w", encoding="utf-8") as f:
    f.write("\n".join(results))

log("\nResults written to test_results.txt")
