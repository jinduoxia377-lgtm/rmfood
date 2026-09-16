"""Final verification of all fixes."""
import urllib.request, json, sys, urllib.parse, os
sys.stdout.reconfigure(encoding='utf-8')

BASE = 'http://localhost:8000'
errors = []

# 1. API pagination (page_size=100 should work)
try:
    r = urllib.request.urlopen(f'{BASE}/api/v1/databases/herbs/food-homology?page_size=100&page=1')
    d = json.loads(r.read())
    print(f"1. API page_size=100: OK ({len(d['items'])} items)")
except Exception as e:
    errors.append(f"API pagination: {e}")
    print(f"1. API page_size=100: FAIL - {e}")

# 2. CFAM images
cfam_dir = r'D:\RMFOODFP\data\CFAM\images'
r = urllib.request.urlopen(f'{BASE}/api/v1/databases/herbs/food-homology?page_size=100')
d = json.loads(r.read())
cfam_ok = cfam_fail = 0
for h in d['items']:
    ip = h.get('image_path')
    if not ip or not ip.startswith('cfam/'):
        continue
    fname = ip.replace('cfam/', '')
    url = f'{BASE}/cfam-images/{fname}'
    if os.path.exists(os.path.join(cfam_dir, fname)):
        try:
            urllib.request.urlopen(url, timeout=5)
            cfam_ok += 1
        except:
            cfam_fail += 1
            errors.append(f"CFAM image 404: {fname}")
    else:
        cfam_fail += 1
        errors.append(f"CFAM image missing on disk: {fname}")

# Page 2
r2 = urllib.request.urlopen(f'{BASE}/api/v1/databases/herbs/food-homology?page_size=100&page=2')
d2 = json.loads(r2.read())
for h in d2['items']:
    ip = h.get('image_path')
    if not ip or not ip.startswith('cfam/'):
        continue
    fname = ip.replace('cfam/', '')
    url = f'{BASE}/cfam-images/{fname}'
    if os.path.exists(os.path.join(cfam_dir, fname)):
        try:
            urllib.request.urlopen(url, timeout=5)
            cfam_ok += 1
        except:
            cfam_fail += 1
    else:
        cfam_fail += 1

print(f"2. CFAM images: {cfam_ok} OK, {cfam_fail} FAIL")

# 3. 106FAM images
fam_dir = r'D:\RMFOODFP\data\106FAM'
fam_ok = fam_fail = 0
all_items = d['items'] + d2['items']
for h in all_items:
    ip = h.get('image_path')
    if not ip or not ip.startswith('homology/'):
        continue
    fname = ip.replace('homology/', '')
    encoded = urllib.parse.quote(fname)
    url = f'{BASE}/herbs-images/{encoded}'
    if os.path.exists(os.path.join(fam_dir, fname)):
        try:
            urllib.request.urlopen(url, timeout=5)
            fam_ok += 1
        except:
            fam_fail += 1
            errors.append(f"106FAM image 404: {fname}")
    else:
        fam_fail += 1
        errors.append(f"106FAM image missing: {h['name_cn']} -> {fname}")

print(f"3. 106FAM images: {fam_ok} OK, {fam_fail} FAIL")

# 4. Frontend
try:
    r = urllib.request.urlopen('http://localhost:3000/databases')
    print(f"4. Frontend: OK ({r.status})")
except Exception as e:
    errors.append(f"Frontend: {e}")
    print(f"4. Frontend: FAIL - {e}")

print(f"\n{'='*40}")
if errors:
    print(f"ERRORS ({len(errors)}):")
    for e in errors[:10]:
        print(f"  - {e}")
else:
    print("ALL CHECKS PASSED!")
