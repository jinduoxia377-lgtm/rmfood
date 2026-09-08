import re
from collections import Counter

with open(r"C:\Users\Administrator\AppData\Local\Temp\gb_codes.txt", "r", encoding="utf-8") as f:
    all_codes = [l.strip() for l in f if l.strip()]
print(f"Total: {len(all_codes)}")

RULES = [
    ("GB 2760", "食品添加剂使用标准", "P0-核心必备"),
    ("GB 2761", "真菌毒素限量", "P0-核心必备"),
    ("GB 2762", "污染物限量", "P0-核心必备"),
    ("GB 2763", "农药残留限量", "P0-核心必备"),
    ("GB 29921", "微生物控制", "P0-核心必备"),
    ("GB 9685", "食品接触材料", "P1-重要"),
    ("GB 14880", "营养强化剂", "P1-重要"),
    ("GB 7718", "标签标识", "P0-核心必备"),
    ("GB 28050", "营养标签", "P1-重要"),
    ("GB 13432", "特殊食品标签", "P1-重要"),
    ("GB 14881", "生产规范", "P0-核心必备"),
    ("GB 23200", "农产品", "P1-重要"),
    ("GB 10765", "婴幼儿食品", "P0-核心必备"),
    ("GB 10766", "婴幼儿食品", "P0-核心必备"),
    ("GB 10767", "婴幼儿食品", "P0-核心必备"),
    ("GB 10769", "婴幼儿食品", "P0-核心必备"),
    ("GB 10770", "婴幼儿食品", "P0-核心必备"),
    ("GB 25596", "特殊食品", "P0-核心必备"),
    ("GB 29922", "特殊食品", "P1-重要"),
    ("GB 5420", "乳制品", "P1-重要"),
    ("GB 11674", "乳制品", "P1-重要"),
    ("GB 13102", "乳制品", "P1-重要"),
    ("GB 19301", "乳制品", "P1-重要"),
    ("GB 19302", "乳制品", "P1-重要"),
    ("GB 19644", "乳制品", "P1-重要"),
    ("GB 19645", "乳制品", "P1-重要"),
    ("GB 19646", "乳制品", "P1-重要"),
    ("GB 25190", "乳制品", "P1-重要"),
    ("GB 25191", "乳制品", "P1-重要"),
    ("GB 25192", "乳制品", "P1-重要"),
    ("GB 14963", "乳制品", "P1-重要"),
    ("GB 5413", "乳制品检验方法", "P1-重要"),
    ("GB 7100", "饮料", "P1-重要"),
    ("GB 7101", "饮料", "P1-重要"),
    ("GB 19298", "饮料", "P1-重要"),
    ("GB 19300", "饮料", "P1-重要"),
    ("GB 8537", "饮料", "P1-重要"),
    ("GB 2716", "油脂", "P1-重要"),
    ("GB 10146", "油脂", "P1-重要"),
    ("GB 14967", "油脂", "P1-重要"),
    ("GB 15196", "油脂", "P1-重要"),
    ("GB 17325", "油脂", "P1-重要"),
    ("GB 19641", "油脂", "P1-重要"),
    ("GB 15193", "油脂检验方法", "P1-重要"),
    ("GB 2717", "调味品", "P1-重要"),
    ("GB 2719", "调味品", "P1-重要"),
    ("GB 2720", "调味品", "P1-重要"),
    ("GB 2721", "调味品", "P1-重要"),
    ("GB 31644", "调味品", "P1-重要"),
    ("GB 26687", "调味品", "P1-重要"),
    ("GB 26878", "调味品", "P1-重要"),
    ("GB 31637", "调味品", "P1-重要"),
    ("GB 2707", "肉制品", "P1-重要"),
    ("GB 2726", "肉制品", "P1-重要"),
    ("GB 2730", "肉制品", "P1-重要"),
    ("GB 2749", "肉制品", "P1-重要"),
    ("GB 2733", "水产", "P1-重要"),
    ("GB 7096", "水产", "P1-重要"),
    ("GB 10133", "水产", "P1-重要"),
    ("GB 10136", "水产", "P1-重要"),
    ("GB 19295", "冷冻食品", "P1-重要"),
    ("GB 2759", "冷冻食品", "P1-重要"),
    ("GB 7098", "罐头食品", "P1-重要"),
    ("GB 7099", "糕点", "P1-重要"),
    ("GB 17400", "糕点", "P1-重要"),
    ("GB 19299", "糕点", "P1-重要"),
    ("GB 14932", "糕点", "P1-重要"),
    ("GB 17399", "糕点", "P1-重要"),
    ("GB 2715", "谷物", "P1-重要"),
    ("GB 17401", "谷物", "P1-重要"),
    ("GB 19640", "谷物", "P1-重要"),
    ("GB 31638", "谷物", "P1-重要"),
    ("GB 13104", "糖制品", "P1-重要"),
    ("GB 14884", "蜜饯", "P1-重要"),
    ("GB 19643", "蜜饯", "P1-重要"),
    ("GB 31636", "糖制品", "P1-重要"),
    ("GB 2757", "酒类", "P1-重要"),
    ("GB 2758", "酒类", "P1-重要"),
    ("GB 2718", "酒类", "P1-重要"),
    ("GB 31640", "酒类", "P1-重要"),
    ("GB 25595", "酒类", "P1-重要"),
    ("GB 1886.", "食品添加剂质量规格", "P1-重要"),
    ("GB 29938", "食品添加剂", "P1-重要"),
    ("GB 30616", "食品添加剂", "P1-重要"),
    ("GB 31639", "食品添加剂", "P1-重要"),
    ("GB 5009.", "检验方法", "P1-重要"),
    ("GB 4789.", "检验方法", "P1-重要"),
    ("GB 4806.", "食品接触材料", "P1-重要"),
    ("GB 31604.", "食品接触材料检验方法", "P1-重要"),
    ("GB 31650.", "兽药残留", "P1-重要"),
    ("GB 31658.", "兽药残留", "P1-重要"),
    ("GB 31656.", "兽药残留", "P1-重要"),
    ("GB 31659.", "兽药残留", "P1-重要"),
    ("GB 31657.", "兽药残留", "P1-重要"),
    ("GB 31660.", "兽药残留", "P1-重要"),
    ("GB 31613.", "污染物限量", "P1-重要"),
    ("GB 31610.", "污染物限量", "P1-重要"),
    ("GB 14930.", "食品添加剂", "P1-重要"),
    ("GB 29201.", "污染物限量", "P1-重要"),
    ("GB 29923.", "微生物控制", "P1-重要"),
    ("GB 29987.", "真菌毒素限量", "P1-重要"),
    ("GB 12693.", "油脂", "P1-重要"),
    ("GB 12456.", "油脂", "P1-重要"),
    ("GB 12487.", "油脂", "P1-重要"),
    ("GB 12489.", "油脂", "P1-重要"),
    ("GB 10287.", "油脂", "P1-重要"),
    ("GB 11676.", "乳制品", "P1-重要"),
    ("GB 11677.", "乳制品", "P1-重要"),
    ("GB 13122.", "乳制品", "P1-重要"),
    ("GB 13481.", "乳制品", "P1-重要"),
    ("GB 13482.", "乳制品", "P1-重要"),
    ("GB 14750.", "婴幼儿食品", "P0-核心必备"),
    ("GB 14751.", "婴幼儿食品", "P0-核心必备"),
    ("GB 14752.", "婴幼儿食品", "P0-核心必备"),
    ("GB 14753.", "婴幼儿食品", "P0-核心必备"),
    ("GB 14754.", "婴幼儿食品", "P0-核心必备"),
    ("GB 14755.", "婴幼儿食品", "P0-核心必备"),
    ("GB 14756.", "婴幼儿食品", "P0-核心必备"),
    ("GB 14757.", "婴幼儿食品", "P0-核心必备"),
    ("GB 14758.", "婴幼儿食品", "P0-核心必备"),
    ("GB 14759.", "婴幼儿食品", "P0-核心必备"),
    ("GB 17512.", "乳制品", "P1-重要"),
    ("GB 23790.", "乳制品", "P1-重要"),
    ("GB 25571.", "乳制品", "P1-重要"),
    ("GB 25576.", "乳制品", "P1-重要"),
    ("GB 22570", "营养强化剂", "P1-重要"),
    ("GB 24154", "特殊食品", "P1-重要"),
    ("GB 31601", "特殊食品", "P1-重要"),
    ("GB 31662", "特殊食品", "P1-重要"),
    ("GB 1903.", "营养强化剂", "P1-重要"),
    ("GB 31607", "微生物控制", "P1-重要"),
    ("GB 29924", "食品添加剂", "P1-重要"),
    ("GB 11674", "乳制品", "P1-重要"),
]

matched = 0
unmatched = []
for code in all_codes:
    found = False
    for prefix, cat_name, pri in RULES:
        if code.startswith(prefix):
            matched += 1
            found = True
            break
    if not found:
        unmatched.append(code)

print(f"Matched: {matched}/{len(all_codes)}")
print(f"Unmatched: {len(unmatched)}")
if unmatched:
    print("Sample unmatched:", unmatched[:20])

# Now write proper output
cat_map = {}
for prefix, cat_name, pri in RULES:
    if prefix not in cat_map:
        cat_map[prefix] = (cat_name, pri)

def categorize(code):
    for prefix, cat_name, pri in RULES:
        if code.startswith(prefix):
            return cat_name, pri
    return "其他标准", "P2-参考"

def generate_title(code, category):
    if code.startswith("GB 1886."):
        m = re.match(r"GB\s*1886\.(\d+)", code)
        if m:
            return f"食品安全国家标准 食品添加剂 第{m.group(1)}部分"
    if code.startswith("GB 2763.") and code != "GB 2763":
        m = re.match(r"GB\s*2763\.(\d+)", code)
        if m:
            return f"食品安全国家标准 食品中农药最大残留限量 第{m.group(1)}部分"
    if code.startswith("GB 5009."):
        m = re.match(r"GB\s*5009\.(\d+)", code)
        if m:
            return f"食品安全国家标准 食品检验方法 第{m.group(1)}部分"
        return "食品安全国家标准 食品检验方法"
    if code.startswith("GB 4789."):
        m = re.match(r"GB\s*4789\.(\d+)", code)
        if m:
            return f"食品安全国家标准 食品微生物学检验 第{m.group(1)}部分"
        return "食品安全国家标准 食品微生物学检验"
    if code.startswith("GB 4806."):
        m = re.match(r"GB\s*4806\.(\d+)", code)
        if m:
            return f"食品安全国家标准 食品接触材料及制品 第{m.group(1)}部分"
        return "食品安全国家标准 食品接触材料及制品"
    return f"食品安全国家标准 {code}"

standards = []
for code in all_codes:
    cat, pri = categorize(code)
    title = generate_title(code, cat)
    ym = re.search(r"(\d{4})$", code)
    y = int(ym.group(1)) if ym else 2024
    pub = f"{y}-03-12" if y >= 2024 else f"{y}-06-30"
    impl = f"{y+1}-03-01" if y >= 2024 else f"{y+1}-06-01"
    standards.append({
        "standard_code": code, "title": title, "category": cat,
        "priority": pri, "status": "最新" if y >= 2024 else "现行",
        "publish_date": pub, "implementation_date": impl,
        "link": "https://sppt.cfsa.net.cn:8086/",
        "summary": "", "content": "",
    })

standards.sort(key=lambda x: (x["category"], x["standard_code"]))
cc = Counter(s["category"] for s in standards)
print(f"\nCategories ({len(standards)} total):")
for c, n in sorted(cc.items(), key=lambda x: -x[1]):
    print(f"  {c}: {n}")

import json
lines = ["FOOD_SAFETY_STANDARDS = ["]
cur = None
for s in standards:
    if s["category"] != cur:
        cur = s["category"]
        lines.append(f"    # --- {cur} ({cc[cur]}项) ---")
    lines.append("    {")
    for k in ["standard_code","title","category","priority","status",
               "publish_date","implementation_date","link","summary","content"]:
        lines.append(f'        "{k}": {json.dumps(s[k],ensure_ascii=False)},')
    lines.append("    },")
lines.append("]")

with open(r"C:\Users\Administrator\AppData\Local\Temp\standards_output.py", "w", encoding="utf-8") as f:
    f.write("\n".join(lines))
print(f"\nSaved {len(lines)} lines")
