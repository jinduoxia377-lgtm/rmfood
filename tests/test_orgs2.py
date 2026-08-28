import requests
import json
import sys
sys.stdout.reconfigure(encoding='utf-8')

base = 'http://localhost:8000'

# Login
r = requests.post(f'{base}/api/v1/auth/login', json={'username': 'admin', 'password': 'admin123'})
token = r.json()['access_token']
headers = {'Authorization': f'Bearer {token}'}

# Test orgs multiple times
for i in range(5):
    try:
        r = requests.get(f'{base}/api/v1/organizations', headers=headers, timeout=15)
        print(f'Request {i+1}: status={r.status_code}', end='')
        if r.status_code == 200:
            data = r.json()
            print(f' orgs={len(data.get("organizations", []))}')
        else:
            print(f' error={r.text[:200]}')
    except Exception as e:
        print(f'Request {i+1}: ERROR {e}')

# Test other endpoints
for ep in ['/api/v1/organizations/trash', '/api/v1/organizations/1', '/api/v1/health']:
    try:
        r = requests.get(f'{base}{ep}', headers=headers, timeout=10)
        print(f'{ep}: status={r.status_code} body={r.text[:100]}')
    except Exception as e:
        print(f'{ep}: ERROR {e}')
