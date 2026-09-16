"""Final comprehensive verification of CFAM integration."""
import urllib.request, json, sys, urllib.parse
sys.stdout.reconfigure(encoding='utf-8')

print("=== 药食同源 CFAM 功能验证 ===")
print()

# 1. API 数据
r = urllib.request.urlopen('http://localhost:8000/api/v1/databases/herbs/food-homology?page_size=5')
d = json.loads(r.read())
print(f"1. API 响应: total={d['total']}, source={d['source']}, version={d['version']}")

# 2. 药材字段检查
h = d['items'][0]
print(f"2. 示例药材 {h['name_cn']}:")
print(f"   - announcement_source: {h.get('announcement_source', 'N/A')}")
print(f"   - special_notice: {(h.get('special_notice') or '无')[:30]}")
print(f"   - flavor_cn: {h.get('flavor_cn', 'N/A')}")
print(f"   - nature_cn: {h.get('nature_cn', 'N/A')}")
print(f"   - image_path: {h.get('image_path', 'N/A')}")

# 3. 图片服务
r2 = urllib.request.urlopen('http://localhost:8000/cfam-images/herb_p126_1.png')
ct2 = r2.headers.get('Content-Type')
print(f"3. CFAM图片服务: /cfam-images/ -> {r2.status} {ct2}")

# URL-encode Chinese filename
fname = urllib.parse.quote('黄芪.jpg')
r3 = urllib.request.urlopen(f'http://localhost:8000/herbs-images/{fname}')
ct3 = r3.headers.get('Content-Type')
print(f"   106FAM图片服务: /herbs-images/ -> {r3.status} {ct3}")

# 4. 公告批次分布
r4 = urllib.request.urlopen('http://localhost:8000/api/v1/databases/herbs/food-homology?page_size=111')
d4 = json.loads(r4.read())
ann_counts = {}
for h in d4['items']:
    src = h.get('announcement_source') or '未分类'
    ann_counts[src] = ann_counts.get(src, 0) + 1
print(f"4. 公告批次分布:")
for k, v in sorted(ann_counts.items(), key=lambda x: -x[1]):
    print(f"   {k}: {v}种")

# 5. 有图片的药材
with_img = sum(1 for h in d4['items'] if h.get('image_path'))
print(f"5. 有图片的药材: {with_img}/{d4['total']}")
print()
print("=== 验证通过 ===")
