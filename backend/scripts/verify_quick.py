"""Quick verification."""
import urllib.request, json, sys, urllib.parse
sys.stdout.reconfigure(encoding='utf-8')
BASE = 'http://localhost:8000'

# 1. API
r = urllib.request.urlopen(f'{BASE}/api/v1/databases/herbs/food-homology?page_size=100&page=1')
d = json.loads(r.read())
print(f"API: {len(d['items'])} items, total={d['total']}")

# 2. CFAM images (sample)
for fname in ['herb_p126_1.png', 'herb_p402_1.png', 'herb_p227_1.png']:
    try:
        r = urllib.request.urlopen(f'{BASE}/cfam-images/{fname}', timeout=5)
        print(f"CFAM {fname}: OK")
    except Exception as e:
        print(f"CFAM {fname}: FAIL - {str(e)[:50]}")

# 3. 106FAM images
for name in ['阿胶.jpg', '白扁豆.jpg', '八角.jpg']:
    encoded = urllib.parse.quote(name)
    try:
        r = urllib.request.urlopen(f'{BASE}/herbs-images/{encoded}', timeout=5)
        print(f"106FAM {name}: OK")
    except Exception as e:
        print(f"106FAM {name}: FAIL - {str(e)[:50]}")

# 4. Frontend
try:
    r = urllib.request.urlopen('http://localhost:3000/databases', timeout=5)
    print(f"Frontend: OK ({r.status})")
except Exception as e:
    print(f"Frontend: FAIL - {e}")

print("Done")
