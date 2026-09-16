"""Verify CFAM key data."""
import json
import subprocess
from collections import Counter

def fetch(path):
    r = subprocess.run(["curl.exe", "-s", f"http://localhost:8000{path}"],
                       capture_output=True, text=True, encoding='utf-8')
    return json.loads(r.stdout)

base = "/api/v1/databases/herbs/food-homology"

# Fetch all herbs (2 pages: 50 + 50 + 11)
all_herbs = []
for page in [1, 2, 3]:
    d = fetch(f"{base}?page_size=50&page={page}")
    all_herbs.extend(d.get('items', []))
    if not d.get('items'):
        break

print(f"total fetched: {len(all_herbs)}")
print(f"API version: {fetch(base + '?page_size=1').get('version')}")

# Distribution by announcement
ann_counts = Counter(h.get('announcement_source') for h in all_herbs)
print("\n=== 公告批次分布 ===")
for ann, count in sorted(ann_counts.items(), key=lambda x: -x[1]):
    label = ann if ann else "(无来源)"
    print(f"  {label}: {count}")

# Key herb checks
checks = [
    ("枸杞子", "卫法监发[2002]51号", None, None),
    ("黄芪", "卫健委公告2023年第9号", "孕妇", None),
    ("当归", "卫健委公告2019年第8号", None, "香辛料"),
    ("阿胶", "卫法监发[2002]51号", None, None),
    ("山柰", "卫健委公告2019年第8号", None, "香辛料"),
    ("铁皮石斛", "卫健委公告2023年第9号", "孕妇", None),
    ("地黄", "卫健委公告2024年第4号", "孕妇", None),
]
print("\n=== 关键药材验证 ===")
for name, exp_src, exp_notice_kw, exp_restr_kw in checks:
    h = next((x for x in all_herbs if x['name_cn'] == name), None)
    if not h:
        print(f"  [NOT FOUND] {name}")
        continue
    src = h.get('announcement_source') or ""
    notice = h.get('special_notice') or ""
    restriction = h.get('usage_restriction') or ""
    flavor = h.get('flavor_cn') or ""

    ok_src = exp_src in src
    ok_notice = exp_notice_kw is None or exp_notice_kw in notice
    ok_restr = exp_restr_kw is None or exp_restr_kw in restriction

    status = "OK" if (ok_src and ok_notice and ok_restr) else "CHECK"
    print(f"  [{status}] {name}")
    print(f"       source={src}")
    print(f"       notice={notice}")
    print(f"       restriction={restriction}")
    print(f"       flavor={flavor}")
