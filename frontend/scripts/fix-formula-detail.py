#!/usr/bin/env python3
"""Fix FormulaDetailPage broken lines 406-417 and update loadRecommendations"""
import os

SRC = r"D:\RMFOODFP\frontend\src"
FP = os.path.join(SRC, "pages/formula/FormulaDetailPage.tsx")
lines = open(FP, encoding="utf-8").readlines()

# Fix 1: Replace broken recommendation call in saveEditedData (lines 407-412, 0-indexed)
# Find the broken section
for i, line in enumerate(lines):
    if 'formulaApi.recommendations(formula.id' in line:
        # Remove lines i-1 through i+4 (try { ... setRecommendations)
        new_save = [
            "  await import('@/api/formula').then((m) => m.formulaApi.patch(formula.id, changedFields));\n",
            "  qc.invalidateQueries({ queryKey: ['formula', formulaId] });\n",
            "  addToast({ type:'success', message:'配方信息已更新' });\n",
            "  setIsEditing(false);\n",
            "  setEditErrors({});\n",
        ]
        start = i - 1  # 'try {' line
        end = i + 5    # after setRecommendations
        print(f"Fix 1: Replacing lines {start+1}-{end} with {len(new_save)} lines")
        lines = lines[:start] + new_save + lines[end:]
        break

# Fix 2: Update loadRecommendations to use formulaApi directly
for i, line in enumerate(lines):
    if 'import(\'@/api/formula\').then((m) =>' in line and i > 450:
        new_try = [
            "  const data = await formulaApi.recommendations(formula.targetEffects as string[], { based_on_formula_id: formula.id });\n",
            "  setRecommendations(data || []);\n",
        ]
        end_idx = i
        for j in range(i, min(i+5, len(lines))):
            if lines[j].strip() == ');':
                end_idx = j + 1
                break
        print(f"Fix 2: Replacing lines {i+1}-{end_idx} with {len(new_try)} lines")
        lines = lines[:i] + new_try + lines[end_idx:]
        break

open(FP, "w", encoding="utf-8").write("".join(lines))
print(f"Done. Total lines: {len(lines)}")
