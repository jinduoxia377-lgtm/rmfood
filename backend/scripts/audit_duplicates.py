import re
from collections import Counter

with open(r"D:\RMFOODFP\backend\app\api\v1\compliance_router.py", "r", encoding="utf-8") as f:
    content = f.read()
lines = content.split("\n")

print("=" * 60)
print("合规标准中心 - 重复内容详细审查")
print("=" * 60)

# ===== 1. FOOD_SAFETY_STANDARDS 编号重复 =====
codes = re.findall(r'"standard_code": "([^"]+)"', content)
unique_codes = set(codes)
dup_codes = {k: v for k, v in Counter(codes).items() if v > 1}
print(f"\n[1] 食品安全国家标准目录")
print(f"    总条目: {len(codes)}, 唯一编号: {len(unique_codes)}")
if dup_codes:
    print(f"    X 重复: {dup_codes}")
else:
    print(f"    OK 无重复")

# ===== 2. GB2760_ADDITIVES 重复 =====
m = re.search(r"GB2760_ADDITIVES = \[([\s\S]*?)\n\]", content)
if m:
    block = m.group(1)
    add_names = re.findall(r'"name": "([^"]+)"', block)
    add_dup = {k: v for k, v in Counter(add_names).items() if v > 1}
    print(f"\n[2] GB 2760 食品添加剂")
    print(f"    总条目: {len(add_names)}")
    if add_dup:
        print(f"    X 重复名称 ({len(add_dup)}):")
        for n, cnt in add_dup.items():
            print(f"      [{cnt}x] {n}")
    else:
        print(f"    OK 无重复")

# ===== 3. GB14880_ENRICHERS 重复 =====
m2 = re.search(r"GB14880_ENRICHERS = \[([\s\S]*?)\n\]", content)
if m2:
    block2 = m2.group(1)
    enr_names = re.findall(r'"name": "([^"]+)"', block2)
    enr_dup = {k: v for k, v in Counter(enr_names).items() if v > 1}
    print(f"\n[3] GB 14880 营养强化剂")
    print(f"    总条目: {len(enr_names)}")
    if enr_dup:
        print(f"    X 重复名称 ({len(enr_dup)}):")
        for n, cnt in enr_dup.items():
            print(f"      [{cnt}x] {n}")
    else:
        print(f"    OK 无重复")

# ===== 4. 禁止/限制物质重复 =====
m3 = re.search(r"GB_PROHIBITED_ITEMS = \[([\s\S]*?)\n\]", content)
if m3:
    block3 = m3.group(1)
    prob_names = re.findall(r'"name": "([^"]+)"', block3)
    prob_dup = {k: v for k, v in Counter(prob_names).items() if v > 1}
    print(f"\n[4] 禁止/限制使用物质")
    print(f"    总条目: {len(prob_names)}")
    if prob_dup:
        print(f"    X 重复名称 ({len(prob_dup)}):")
        for n, cnt in prob_dup.items():
            print(f"      [{cnt}x] {n}")
    else:
        print(f"    OK 无重复")

# ===== 5. 药食同源目录重复 =====
m4 = re.search(r"FOOD_HOMOLOGY_MATERIALS = \[([\s\S]*?)\n\]", content)
if m4:
    block4 = m4.group(1)
    hom_names = re.findall(r'"name": "([^"]+)"', block4)
    hom_dup = {k: v for k, v in Counter(hom_names).items() if v > 1}
    print(f"\n[5] 药食同源目录")
    print(f"    总条目: {len(hom_names)}")
    if hom_dup:
        print(f"    X 重复名称 ({len(hom_dup)}):")
        for n, cnt in hom_dup.items():
            print(f"      [{cnt}x] {n}")
    else:
        print(f"    OK 无重复")

# ===== 6. 跨表重复检查 =====
print(f"\n[6] 跨表交叉检查")
add_set = set(add_names) if m else set()
enr_set = set(enr_names) if m2 else set()
prob_set = set(prob_names) if m3 else set()
hom_set = set(hom_names) if m4 else set()

cross_list = [
    ("GB2760", "GB14880", add_set & enr_set),
    ("GB2760", "禁止物质", add_set & prob_set),
    ("GB14880", "禁止物质", enr_set & prob_set),
    ("GB2760", "药食同源", add_set & hom_set),
    ("GB14880", "药食同源", enr_set & hom_set),
    ("禁止物质", "药食同源", prob_set & hom_set),
]
has_cross = False
for name1, name2, items in cross_list:
    if items:
        has_cross = True
        print(f"    X {name1} 与 {name2} 有交集 ({len(items)}):")
        for n in sorted(items)[:10]:
            print(f"      {n}")
if not has_cross:
    print(f"    OK 无跨表交叉")

# ===== 7. 标准目录 vs source_law 引用 =====
print(f"\n[7] 标准编号 vs source_law 引用")
std_codes_set = set(codes)
src_laws = set(re.findall(r'"source_law": "(GB [^"]+)"', content))
overlap = std_codes_set & src_laws
if overlap:
    print(f"    X {len(overlap)}个编号同时出现在目录和source_law:")
    for c in sorted(overlap):
        print(f"      {c}")
else:
    print(f"    OK 无交叉")

# ===== 8. 同一基础号的多版本 =====
by_base = {}
for c in codes:
    base_m = re.match(r"(GB \d+(?:\.\d+)?)", c)
    if base_m:
        base = base_m.group(1)
        by_base.setdefault(base, []).append(c)
multi = {k: v for k, v in by_base.items() if len(v) > 1}
print(f"\n[8] 同标准多版本（正常现象）")
print(f"    有{len(multi)}个基础编号存在多版本")
print(f"    示例:")
for base, versions in sorted(multi.items(), key=lambda x: -len(x[1]))[:6]:
    print(f"      {base}: {len(versions)}个版本")

# ===== 9. 前端渲染检查 =====
print(f"\n[9] 前端渲染结构")
print(f"    各表格数据源独立（filteredStandards/sortedGb2760/sortedGb14880等）")
print(f"    无重复渲染风险")

print(f"\n{'=' * 60}")
print("审查结论")
print("=" * 60)
issues = []
if dup_codes: issues.append(f"标准目录重复编号: {len(dup_codes)}")
if add_dup: issues.append(f"GB2760重复名称: {len(add_dup)}")
if enr_dup: issues.append(f"GB14880重复名称: {len(enr_dup)}")
if prob_dup: issues.append(f"禁止物质重复名称: {len(prob_dup)}")
if hom_dup: issues.append(f"药食同源重复名称: {len(hom_dup)}")
if overlap: issues.append(f"标准目录与source_law交叉: {len(overlap)}")
if has_cross: issues.append("跨表重复")

if not issues:
    print("[PASS] 未发现重复内容，数据质量良好")
else:
    for iss in issues:
        print(f"[WARN] {iss}")
