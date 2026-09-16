"""Quick targeted image debug - just the failing ones."""
import urllib.request, json, sys, urllib.parse, os
sys.stdout.reconfigure(encoding='utf-8')

BASE = 'http://localhost:8000'

# Get herbs
r = urllib.request.urlopen(f'{BASE}/api/v1/databases/herbs/food-homology?page_size=100')
d = json.loads(r.read())

# Test only CFAM images (the ones that were failing)
cfam_dir = r'D:\RMFOODFP\data\CFAM\images'
fam_dir = r'D:\RMFOODFP\data\106FAM'

cfam_failures = []
fam_failures = []

for h in d['items']:
    ip = h.get('image_path')
    if not ip:
        continue

    if ip.startswith('cfam/'):
        fname = ip.replace('cfam/', '')
        url = f'{BASE}/cfam-images/{fname}'
        disk = os.path.join(cfam_dir, fname)
        label = 'CFAM'
    else:
        filename = ip.replace('homology/', '')
        encoded = urllib.parse.quote(filename)
        url = f'{BASE}/herbs-images/{encoded}'
        disk = os.path.join(fam_dir, filename)
        label = '106FAM'

    exists = os.path.exists(disk)
    try:
        req = urllib.request.Request(url, method='HEAD')
        resp = urllib.request.urlopen(req, timeout=5)
        status = resp.status
    except Exception as e:
        status = f'ERROR: {str(e).split(chr(10))[0][:60]}'

    if status != 200:
        if label == 'CFAM':
            cfam_failures.append((h['name_cn'], ip, fname, exists, status))
        else:
            fam_failures.append((h['name_cn'], ip, filename, exists, status))

print(f"=== CFAM failures ({len(cfam_failures)}) ===")
for name, ip, fname, exists, status in cfam_failures:
    print(f"  {name}: file={fname}, disk={exists}, url_status={status}")

print(f"\n=== 106FAM failures ({len(fam_failures)}) ===")
for name, ip, fname, exists, status in fam_failures:
    print(f"  {name}: file={fname}, disk={exists}, url_status={status}")

# Also check: how many total with images vs failing
cfam_total = sum(1 for h in d['items'] if h.get('image_path','').startswith('cfam/'))
fam_total = sum(1 for h in d['items'] if h.get('image_path','').startswith('homology/'))
print(f"\nCFAM: {cfam_total} total, {len(cfam_failures)} failures")
print(f"106FAM: {fam_total} total, {len(fam_failures)} failures")
