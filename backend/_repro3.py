import os, sys, traceback, logging
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
logging.basicConfig(level=logging.DEBUG)
from fastapi.testclient import TestClient
from app.main import app
c = TestClient(app)
r = c.post('/api/v1/auth/login', json={'username':'admin','password':'admin123'})
print('login', r.status_code)
tok = r.json().get('access_token')
r2 = c.get('/api/v1/users?page=1&page_size=5', headers={'Authorization': f'Bearer {tok}'})
print('users', r2.status_code, r2.text[:300])
