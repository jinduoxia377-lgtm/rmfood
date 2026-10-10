#!/usr/bin/env python3
"""A-48 验收：确认 /analytics/kpi 与 /analytics/anomalies 不再 500。"""
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi.testclient import TestClient  # noqa: E402
from app.main import app  # noqa: E402

c = TestClient(app)
r = c.post("/api/v1/auth/login", json={"username": "admin", "password": "admin123"})
tok = (r.json() or {}).get("access_token") or ""
H = {"Authorization": f"Bearer {tok}"} if tok else {}
print(f"login={r.status_code}")

for p in ("/api/v1/analytics/kpi",
          "/api/v1/analytics/anomalies",
          "/api/v1/analytics/dashboard",
          "/api/v1/analytics/system-health",
          "/api/v1/ai/debug/llm-test"):
    resp = c.get(p, headers=H, timeout=120)
    ok = "OK " if resp.status_code < 400 else "FAIL"
    tail = ""
    if resp.status_code >= 400:
        try:
            tail = str(resp.json().get("detail", ""))[:90]
        except Exception:
            tail = resp.text[:90]
    print(f"{ok} {resp.status_code}  {p}  {tail}")
