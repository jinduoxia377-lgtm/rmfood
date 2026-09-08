import re
from collections import Counter

with open(r"D:\RMFOODFP\backend\app\api\v1\compliance_router.py", "r", encoding="utf-8") as f:
    content = f.read()

print("=" * 60)
print("审查：合规标准中心重复内容")
print("=" * 60)

# 1. FOOD_SAFETY_STANDARDS 标准列表
codes = re.findall(r'"standard_code": "([^"]+)"', content)
print(f"\n【1】食品安全国家标准目录")
print(f"  总条目: {len(codes)}, 唯一编号: {len(set(codes))}")
dupes = {k: v for k, v in Counter(codes).items() if v > 1}
if dupes:
    print(f"  ⚠ 重复编号 ({len(dupes)}):")
    for code, cnt in sorted(dupes.items(), key=lambda x: -x[1]):
        print(f"    {code}: {cnt}次")
else:
    print("  ✓ 无重复编号")

# 2. GB2760 添加剂
additive_names = re.findall(r'"name": "([^"]+)".*?"source_law": "GB 2760[^"]*"', content, re.DOTALL)
print(f"\n【2】GB 2760 食品添加剂")
print(f"  总条目: {len(additive_names)}")
add_dupes = {k: v for k, v in Counter(additive_names).items() if v > 1}
if add_dupes:
    print(f"  ⚠ 重复名称 ({len(add_dupes)}):")
    for n, cnt in sorted(add_dupes.items(), key=lambda x: -x[1])[:15]:
        print(f"    [{cnt}x] {n}")
else:
    print("  ✓ 无重复名称")

# 3. GB14880 营养强化剂
enricher_names = re.findall(r'"name": "([^"]+)".*?"source_law": "GB 14880[^"]*"', content, re.DOTALL)
print(f"\n【3】GB 14880 营养强化剂")
print(f"  总条目: {len(enricher_names)}")
enr_dupes = {k: v for k, v in Counter(enricher_names).items() if v > 1}
if enr_dupes:
    print(f"  ⚠ 重复名称 ({len(enr_dupes)}):")
    for n, cnt in sorted(enr_dupes.items(), key=lambda x: -x[1])[:15]:
        print(f"    [{cnt}x] {n}")
else:
    print("  ✓ 无重复名称")

# 4. 禁止使用物质
prohibited_names = re.findall(r'"name": "([^"]+)".*?"source_law": "GB[^"]*"', content, re.DOTALL)
print(f"\n【4】禁止使用物质（药食同源禁限用）")
print(f"  总条目: {len(prohibited_names)}")
prob_dupes = {k: v for k, v in Counter(prohibited_names).items() if v > 1}
if prob_dupes:
    print(f"  ⚠ 重复名称 ({len(prob_dupes)}):")
    for n, cnt in sorted(prob_dupes.items(), key=lambda x: -x[1])[:15]:
        print(f"    [{cnt}x] {n}")
else:
    print("  ✓ 无重复名称")

# 5. 药食同源目录
homology_names = re.findall(r'"name": "([^"]+)"', content)
# Exclude the ones we already checked
print(f"\n【5】药食同源目录")
print(f"  总条目: {len(homology_names)}")

# 6. 跨表重复：同一名称出现在不同列表中
all_names_by_table = {}
for section in ["FOOD_HOMOLOGY_MATERIALS", "GB2760", "GB14880", "PROHIBITED"]:
    all_names_by_table[section] = set()

# Check cross-table duplicates
print(f"\n【6】跨表重复检查")
print("  检查各数据表之间是否存在同名/同编号内容...")

# Extract name+source pairs for cross-check
gb2760_set = set(additive_names)
gb14880_set = set(enricher_names)
homology_set = set(homology_names)

cross_dupes = gb2760_set & gb14880_set
if cross_dupes:
    print(f"  ⚠ GB2760与GB14880有交集 ({len(cross_dupes)}):")
    for n in list(cross_dupes)[:10]:
        print(f"    {n}")

# Check if any standard code appears in both FOOD_SAFETY_STANDARDS and as a source_law reference
standards_codes = set(codes)
source_laws = set(re.findall(r'"source_law": "(GB [^"]+)"', content))
overlap = standards_codes & source_laws
if overlap:
    print(f"  ℹ 标准编号同时出现在目录和source_law中 ({len(overlap)}):")
    for c in sorted(list(overlap))[:10]:
        print(f"    {c}")

print(f"\n{'=' * 60}")
print("审查完毕")
print("=" * 60)
