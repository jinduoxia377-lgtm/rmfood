"""Smoke test after backend restart."""
import urllib.request, json, sys, urllib.parse
sys.stdout.reconfigure(encoding='utf-8')

print("=== 服务状态检查 ===")

# 1. Backend health
r = urllib.request.urlopen('http://localhost:8000/health')
print(f"1. Backend health: {r.status}")

# 2. CFAM API (page_size=24 should work)
r = urllib.request.urlopen('http://localhost:8000/api/v1/databases/herbs/food-homology?page_size=24&page=1')
d = json.loads(r.read())
print(f"2. CFAM API: total={d['total']}, source={d['source']}, version={d['version']}")
h = d['items'][0]
print(f"   Sample: {h['name_cn']} src={h.get('announcement_source','')[:20]} img={h.get('image_path')}")

# 3. CFAM images
r2 = urllib.request.urlopen('http://localhost:8000/cfam-images/herb_p126_1.png')
print(f"3. CFAM images: {r2.status} {r2.headers.get('Content-Type')}")

# 4. 106FAM images
fname = urllib.parse.quote('阿胶.jpg')
r3 = urllib.request.urlopen(f'http://localhost:8000/herbs-images/{fname}')
print(f"   106FAM images: {r3.status} {r3.headers.get('Content-Type')}")

# 5. Frontend
r4 = urllib.request.urlopen('http://localhost:3000/databases')
print(f"4. Frontend /databases: {r4.status}")

print("\n=== All OK ===")
