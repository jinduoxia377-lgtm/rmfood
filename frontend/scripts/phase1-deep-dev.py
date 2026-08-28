#!/usr/bin/env python3
"""Phase 1: Deep development - FormulaDetailPage line-based edits"""
import os

SRC = r"D:\RMFOODFP\frontend\src"
FP = os.path.join(SRC, "pages/formula/FormulaDetailPage.tsx")
lines = open(FP, encoding="utf-8").readlines()
total = len(lines)
changes = []

# ═══════════════════════════════════════════════════════════════
# Change 1: Insert ingredientDetails useMemo after line 302
# ═══════════════════════════════════════════════════════════════
INSERT_AFTER_LINE = 302  # 0-indexed: line 302 is index 301
ingredient_details_code = [
    "\n",
    "  // ── 成分详情数据（中国药典/中华本草）──\n",
    "  const ingredientDetails = useMemo(() => {\n",
    "    const db: Record<string, { nature?: string; flavor?: string; meridian?: string; chemistry?: string; pharmacology?: string; precautions?: string }> = {\n",
    "      '枸杞': { nature: '平', flavor: '甘', meridian: '肝、肾经', chemistry: '多糖、胡萝卜素、锌', pharmacology: '免疫调节、抗氧化', precautions: '外感发热者慎用' },\n",
    "      '山药': { nature: '平', flavor: '甘', meridian: '脾、肺、肾经', chemistry: '薯蓣皂苷、多糖', pharmacology: '健脾益胃、降血糖', precautions: '便秘者慎用' },\n",
    "      '黄芪': { nature: '微温', flavor: '甘', meridian: '肺、脾经', chemistry: '黄芪多糖、皂苷', pharmacology: '补气固表、利尿', precautions: '阴虚火旺者慎用' },\n",
    "      '党参': { nature: '平', flavor: '甘', meridian: '脾、肺经', chemistry: '党参多糖、皂苷', pharmacology: '补中益气、健脾', precautions: '实证热证慎用' },\n",
    "      '当归': { nature: '温', flavor: '甘、辛', meridian: '肝、心、脾经', chemistry: '阿魏酸、挥发油', pharmacology: '补血活血、调经', precautions: '湿盛中满者慎用' },\n",
    "      '川芎': { nature: '温', flavor: '辛', meridian: '肝、胆、心包经', chemistry: '川芎嗪、挥发油', pharmacology: '活血行气、祛风止痛', precautions: '孕妇慎用' },\n",
    "      '白术': { nature: '温', flavor: '苦、甘', meridian: '脾、胃经', chemistry: '白术多糖、苍术酮', pharmacology: '健脾益气、燥湿利水', precautions: '阴虚内热者慎用' },\n",
    "      '甘草': { nature: '平', flavor: '甘', meridian: '心、肺、脾、胃经', chemistry: '甘草酸、甘草黄酮', pharmacology: '补脾益气、清热解毒', precautions: '湿盛胀满者慎用' },\n",
    "      '茯苓': { nature: '平', flavor: '甘、淡', meridian: '心、脾、肾经', chemistry: '茯苓多糖、三萜', pharmacology: '利水渗湿、健脾宁心', precautions: '肾虚小便多者慎用' },\n",
    "      '红枣': { nature: '温', flavor: '甘', meridian: '脾、胃经', chemistry: '环磷酸腺苷、维生素C', pharmacology: '补中益气、养血安神', precautions: '湿盛脘腹胀满者慎用' },\n",
    "    };\n",
    "    const result: Record<string, typeof db[keyof typeof db]> = {};\n",
    "    ingredientList.forEach(ing => {\n",
    "      result[ing.name] = db[ing.name] || { nature: '-', flavor: '-', meridian: '-', chemistry: '-', pharmacology: '-', precautions: '-' };\n",
    "    });\n",
    "    return result;\n",
    "  }, [ingredientList]);\n",
]
lines = lines[:INSERT_AFTER_LINE] + ingredient_details_code + lines[INSERT_AFTER_LINE:]
changes.append(f"1. ingredientDetails added (after line 302, now {len(lines)} lines)")

# ═══════════════════════════════════════════════════════════════
# Change 2: Update loadRecommendations try block (was lines 440-443, now shifted)
# ═══════════════════════════════════════════════════════════════
# Find the line with "import('@/api/formula').then"
target_idx = None
for i, line in enumerate(lines):
    if "import('@/api/formula').then((m) =>" in line:
        target_idx = i
        break

if target_idx is not None:
    # Replace lines target_idx to target_idx+3 (the try block)
    new_try_lines = [
        "  const data = await formulaApi.getAIRecommendations(formula.id, {\n",
        "   target_effects: formula.targetEffects as string[],\n",
        "   limit: 9,\n",
        "  });\n",
        "  setRecommendations(data || []);\n",
    ]
    # Find end of the old block (the closing );)
    end_idx = target_idx
    for i in range(target_idx, min(target_idx + 5, len(lines))):
        if lines[i].strip() == ");":
            end_idx = i + 1
            break
    lines = lines[:target_idx] + new_try_lines + lines[end_idx:]
    changes.append(f"2. loadRecommendations try block updated (removed {end_idx-target_idx} old lines, added 5)")
else:
    changes.append("2. SKIP - import line not found")

# ═══════════════════════════════════════════════════════════════
# Change 3: Update error toast message
# ═══════════════════════════════════════════════════════════════
for i, line in enumerate(lines):
    if "推荐数据暂不可用" in line or "加载推荐失败" in line:
        lines[i] = line.replace("加载推荐失败", "推荐数据暂不可用，请稍后重试")
        changes.append(f"3. Error toast message updated at line {i+1}")
        break

# ═══════════════════════════════════════════════════════════════
# Change 4: Enhance ingredient detail table
# ═══════════════════════════════════════════════════════════════
# Find the detail table section and replace it
detail_start = None
detail_end = None
for i, line in enumerate(lines):
    if "展开详情行" in line and "expandedIngredients.has" in lines[i+1] if i+1 < len(lines) else False:
        detail_start = i
    if detail_start is not None and "</tr>" in line and "ing.name-detail" not in line:
        # Check if this is the right closing tag
        for j in range(i-10, i):
            if "colSpan={7}" in lines[j]:
                detail_end = i + 1
                break
        if detail_end:
            break

if detail_start is not None and detail_end is not None:
    new_detail_rows = [
        '  {/* 展开详情行 */}\n',
        '  {expandedIngredients.has(ing.name) && (\n',
        '  <tr key={`${ing.name}-detail`}>\n',
        '  <td colSpan={7} className="p-4 bg-neutral-default/20">\n',
        '  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">\n',
        '  <div>\n',
        '  <p className="text-text-disabled mb-1">性味</p>\n',
        '  <p className="text-text-secondary">{ingredientDetails[ing.name]?.nature || \'-\'} · {ingredientDetails[ing.name]?.flavor || \'-\'}</p>\n',
        '  </div>\n',
        '  <div>\n',
        '  <p className="text-text-disabled mb-1">归经</p>\n',
        '  <p className="text-text-secondary">{ingredientDetails[ing.name]?.meridian || \'-\'}</p>\n',
        '  </div>\n',
        '  <div>\n',
        '  <p className="text-text-disabled mb-1">化学成分</p>\n',
        '  <p className="text-text-secondary">{ingredientDetails[ing.name]?.chemistry || \'-\'}</p>\n',
        '  </div>\n',
        '  <div>\n',
        '  <p className="text-text-disabled mb-1">药理作用</p>\n',
        '  <p className="text-text-secondary">{ingredientDetails[ing.name]?.pharmacology || \'-\'}</p>\n',
        '  </div>\n',
        '  <div className="col-span-2">\n',
        '  <p className="text-text-disabled mb-1">注意事项</p>\n',
        '  <p className="text-text-secondary">{ingredientDetails[ing.name]?.precautions || \'-\'}</p>\n',
        '  </div>\n',
        '  </div>\n',
        '  </td>\n',
        '  </tr>\n',
        '  )}\n',
    ]
    lines = lines[:detail_start] + new_detail_rows + lines[detail_end:]
    changes.append(f"4. Ingredient detail table enhanced (replaced lines {detail_start+1}-{detail_end})")
else:
    changes.append(f"4. SKIP - detail table not found (start={detail_start}, end={detail_end})")
    # Debug: find the section
    for i, line in enumerate(lines):
        if "bg-slate-50/50/30" in line:
            changes.append(f"   Found bg-slate at line {i+1}: {repr(line[:60])}")
            # Show context
            for j in range(max(0,i-3), min(len(lines),i+20)):
                changes.append(f"   L{j+1}: {repr(lines[j][:70])}")
            break

# ═══════════════════════════════════════════════════════════════
# Write back
# ═══════════════════════════════════════════════════════════════
open(FP, "w", encoding="utf-8").write("".join(lines))
print(f"Final file: {len(lines)} lines (was {total})")
for ch in changes:
    print(f"  {ch}")
