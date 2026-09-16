"""Comprehensive image debug."""
import urllib.request, json, sys, urllib.parse, os
sys.stdout.reconfigure(encoding='utf-8')

BASE = 'http://localhost:8000'

# 1. Check what image_path values exist
r = urllib.request.urlopen(f'{BASE}/api/v1/databases/herbs/food-homology?page_size=24')
d = json.loads(r.read())
print("=== DB image_path values (first 24) ===")
for h in d['items']:
    ip = h.get('image_path')
    print(f"  {h['name_cn']}: {ip}")

# 2. Test each URL pattern that the frontend would generate
print("\n=== Frontend image URL tests ===")
for h in d['items']:
    ip = h.get('image_path')
    if not ip:
        print(f"  {h['name_cn']}: no image")
        continue
    if ip.startswith('cfam/'):
        url = f'{BASE}/cfam-images/{ip}'
    else:
        url = f'{BASE}/herbs-images/{urllib.parse.quote(ip.replace("homology/", ""))}'
    try:
        req = urllib.request.Request(url, method='HEAD')
        resp = urllib.request.urlopen(req, timeout=5)
        print(f"  OK  {h['name_cn']}: {resp.status}")
    except Exception as e:
        err = str(e).split('\n')[0]
        print(f"  FAIL {h['name_cn']}: {err}")

# 3. Check what files actually exist on disk
print("\n=== Disk file checks ===")
homology_dir = r'D:\RMFOODFP\data\106FAM'
cfam_dir = r'D:\RMFOODFP\data\CFAM\images'

for h in d['items'][:5]:
    ip = h.get('image_path')
    if not ip:
        continue
    if ip.startswith('cfam/'):
        fname = ip.replace('cfam/', '')
        path = os.path.join(cfam_dir, fname)
    else:
        fname = ip.replace('homology/', '')
        path = os.path.join(homology_dir, fname)
    exists = os.path.exists(path)
    print(f"  {h['name_cn']}: {path} -> {'EXISTS' if exists else 'MISSING'}")

# 4. Check static mount
print("\n=== Static mount test ===")
for path, expected in [
    ('/cfam-images/herb_p126_1.png', 'CFAM'),
    ('/herbs-images/阿胶.jpg', '106FAM'),
    ('/herbs-images/八角茴香.jpg', '106FAM'),
]:
    try:
        req = urllib.request.Request(f'{BASE}{path}', method='HEAD')
        resp = urllib.request.urlopen(req, timeout=5)
        print(f"  OK {path}: {resp.status}")
    except Exception as e:
        print(f"  FAIL {path}: {str(e).split(chr(10))[0]}")
