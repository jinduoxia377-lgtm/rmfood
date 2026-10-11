import os, sys, json, re
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fastapi.testclient import TestClient
from app.main import app

c = TestClient(app)
r = c.post('/api/v1/auth/login', json={'username': 'admin', 'password': 'admin123'})
tok = (r.json() or {}).get('access_token') or ''
H = {'Authorization': f'Bearer {tok}'} if tok else {}

spec = app.openapi()['paths']
bad = []
tested = 0
for path, ops in spec.items():
    if 'get' not in ops: continue
    p = re.sub(r'\{[^}]+\}', '1', path)
    if any(k in p for k in ('/health', '/metrics', '/docs', '/openapi')): continue
    tested += 1
    try:
        resp = c.get(p, headers=H, timeout=30)
    except Exception as e:
        bad.append((path, 'EXC ' + type(e).__name__)); continue
    if resp.status_code >= 500:
        bad.append((path, resp.status_code))
print('GET endpoints tested:', tested)
print('5xx:', len(bad))
for p, s in sorted(bad): print('  ', s, p)
