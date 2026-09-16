"""Precise image URL debugging."""
import urllib.request, json, sys, urllib.parse, os
sys.stdout.reconfigure(encoding='utf-8')

BASE = 'http://localhost:8000'

# Get all herbs with image_path
r = urllib.request.urlopen(f'{BASE}/api/v1/databases/herbs/food-homology?page_size=100')
d = json.loads(r.read())
all_herbs = d['items']
print(f"Total herbs: {len(all_herbs)}")

# Test each unique image_path pattern
tested = {}
failures = []
for h in all_herbs:
    ip = h.get('image_path')
    if not ip:
        continue
    if ip.startswith('cfam/'):
        url = f'{BASE}/cfam-images/{ip}'
        fname = ip.replace('cfam/', '')
        disk_path = rf'D:\RMFOODFP\data\CFAM\images\{fname}'
    else:
        filename = ip.replace('homology/', '')
        url = f'{BASE}/herbs-images/{urllib.parse.quote(filename)}'
        disk_path = rf'D:\RMFOODFP\data\106FAM\{filename}'

    key = f"{h['name_cn']}|{ip}"
    exists = os.path.exists(disk_path)
    try:
        req = urllib.request.Request(url, method='HEAD')
        resp = urllib.request.urlopen(req, timeout=5)
        status = resp.status
    except Exception as e:
        status = str(e).split('\n')[0]

    if status != 200:
        failures.append((h['name_cn'], ip, url, exists, status))
    tested[key] = {'url': url, 'exists': exists, 'status': status}

print(f"\n=== FAILURES ({len(failures)}) ===")
for name, ip, url, exists, status in failures:
    print(f"  {name}: path={ip}, url={url}, disk_exists={exists}, http={status}")

# Summary
cfam_total = sum(1 for h in all_herbs if h.get('image_path', '').startswith('cfam/'))
fam_total = sum(1 for h in all_herbs if h.get('image_path', '').startswith('homology/'))
cfam_fail = sum(1 for f in failures if f[1].startswith('cfam/'))
fam_fail = sum(1 for f in failures if f[1].startswith('homology/'))
print(f"\n=== SUMMARY ===")
print(f"CFAM images: {cfam_total} total, {cfam_fail} failing")
print(f"106FAM images: {fam_total} total, {fam_fail} failing")
