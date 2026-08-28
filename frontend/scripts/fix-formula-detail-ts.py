#!/usr/bin/env python3
"""Fix TypeScript errors in FormulaDetailPage: add null checks for formula in callbacks."""
import os, re

SRC = r"D:\RMFOODFP\frontend\src"
FP = os.path.join(SRC, "pages/formula/FormulaDetailPage.tsx")
c = open(FP, encoding="utf-8").read()
nc = c
total = 0

# Fix 1: startEditing callback - add null guard
old1 = """const startEditing = useCallback(() => {
 setEditedData({
 name: formula.name,"""
new1 = """const startEditing = useCallback(() => {
 if (!formula) return;
 setEditedData({
 name: formula.name,"""
if old1 in nc:
    nc = nc.replace(old1, new1)
    total += 1
    print("  OK  startEditing: added null guard")
else:
    print("  SKIP startEditing: pattern not found")

# Fix 2: saveEditedData - add null guard at the start
old2 = """const saveEditedData = useCallback(async () => {
 const nameErrors = validateFormulaName(editedData.name ||'');"""
new2 = """const saveEditedData = useCallback(async () => {
 if (!formula) return;
 const nameErrors = validateFormulaName(editedData.name ||'');"""
if old2 in nc:
    nc = nc.replace(old2, new2)
    total += 1
    print("  OK  saveEditedData: added null guard")
else:
    print("  SKIP saveEditedData: pattern not found")

# Fix 3: loadRecommendations - already has null guard for targetEffects but formula could be null
# The existing guard is: if (!formula.targetEffects || ...)
# This already handles formula being null via optional chaining, but TS still complains
# Add explicit null check at start
old3 = """const loadRecommendations = useCallback(async () => {
 if (!formula.targetEffects || formula.targetEffects.length === 0) {"""
new3 = """const loadRecommendations = useCallback(async () => {
 if (!formula) return;
 if (!formula.targetEffects || formula.targetEffects.length === 0) {"""
if old3 in nc:
    nc = nc.replace(old3, new3)
    total += 1
    print("  OK  loadRecommendations: added null guard")
else:
    print("  SKIP loadRecommendations: pattern not found")

# Fix 4: runAllAnalyses - add null guard
old4 = """const runAllAnalyses = useCallback(async () => {
 if (!formula || !ingredientList.length) return;"""
# This one already has a guard, check if there are still issues
# The issue might be at other lines. Let's just check the error lines.
print("  INFO  Checking other formula references...")

if nc != c:
    open(FP, "w", encoding="utf-8").write(nc)
    print(f"\n  Written {total} fixes")
else:
    print("  No changes made")

# Also verify formula.id usage in saveEditedData
print("\n  Verification:")
for line_no, line_text in enumerate(c.split('\n'), 1):
    if 'formula.id' in line_text or 'formula.targetEffects' in line_text:
        if line_no in [349, 384, 429, 437]:  # The problematic lines
            print(f"    L{line_no}: {line_text.strip()[:80]}")
