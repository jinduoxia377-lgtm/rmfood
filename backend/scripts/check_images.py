"""Check actual image paths in DB and fix image serving."""
import urllib.request, json, sys
sys.stdout.reconfigure(encoding='utf-8')

# Check image_path values from API
r = urllib.request.urlopen('http://localhost:8000/api/v1/databases/herbs/food-homology?page_size=10')
d = json.loads(r.read())
print(f"Total herbs: {d['total']}")
for h in d['items']:
    print(f"  {h['name_cn']}: image_path={h.get('image_path')}, image_source={h.get('image_source')}")

# Check image-map
r2 = urllib.request.urlopen('http://localhost:8000/api/v1/herbs/image-map')
d2 = json.loads(r2.read())
print(f"\nImage map total: {d2.get('total')}")
print(f"Image map keys sample: {list(d2.get('mapping', {}).keys())[:5]}")
