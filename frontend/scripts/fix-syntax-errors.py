#!/usr/bin/env python3
"""Fix FormulaDetailPage syntax errors from previous edits"""
import os

SRC = r"D:\RMFOODFP\frontend\src"
FP = os.path.join(SRC, "pages/formula/FormulaDetailPage.tsx")
lines = open(FP, encoding="utf-8").readlines()

# Fix 1: Lines 406-416 - missing try { and duplicate block
# Current state:
# L406: setIsSaving(true);
# L407:   await import...  (missing try {)
# L408-411: qc.invalidateQueries... setEditErrors
# L412-416: DUPLICATE of lines 407-411
# Need: add try { before L407, remove L412-416
new_block = [
    "  setIsSaving(true);\n",
    "  try {\n",
    "  await import('@/api/formula').then((m) => m.formulaApi.patch(formula.id, changedFields));\n",
    "  qc.invalidateQueries({ queryKey: ['formula', formulaId] });\n",
    "  addToast({ type:'success', message:'配方信息已更新' });\n",
    "  setIsEditing(false);\n",
    "  setEditErrors({});\n",
]
# Find and replace lines 406-416 (0-indexed: 405-415)
# First, let's find the exact range
for i, line in enumerate(lines):
    if 'setIsSaving(true)' in line and i > 400 and i < 410:
        print(f"Found setIsSaving at line {i+1}")
        # Check what's next
        for j in range(i, min(i+15, len(lines))):
            print(f"  L{j+1}: {lines[j][:60]}")
        # Replace lines i to i+11 (the broken block)
        # The correct block should be 7 lines, replacing 11 lines
        lines = lines[:i] + new_block + lines[i+11:]
        print(f"Fix 1 applied: replaced lines {i+1}-{i+11} with {len(new_block)} lines")
        break

# Fix 2: Lines 465-467 - duplicate setRecommendations
for i, line in enumerate(lines):
    if 'setRecommendations(data || [])' in line and i > 460:
        print(f"Found duplicate setRecommendations at line {i+1}")
        # Remove the next line which is the old setRecommendations(data)
        if i+1 < len(lines) and 'setRecommendations(data)' in lines[i+1]:
            print(f"  Removing duplicate at line {i+2}")
            lines = lines[:i+1] + lines[i+2:]
            print("Fix 2 applied")
        break

open(FP, "w", encoding="utf-8").write("".join(lines))
print(f"Done. Total lines: {len(lines)}")
