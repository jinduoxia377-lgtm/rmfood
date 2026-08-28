#!/usr/bin/env python3
"""Fix: Move all hooks from after early returns to before them in FormulaDetailPage.tsx."""
import re, os

SRC = r"D:\RMFOODFP\frontend\src"
FP = os.path.join(SRC, "pages/formula/FormulaDetailPage.tsx")
c = open(FP, encoding="utf-8").read()
lines = c.split('\n')

# ─── Step 1: Identify all hook call lines in main component body ───
HOOK_PATTERNS = [
    r'\buseState\b', r'\buseMemo\b', r'\buseCallback\b', r'\buseEffect\b',
    r'\buseRef\b', r'\buseQuery\b', r'\buseMutation\b',
    r'\buseFormula\b', r'\buseFormulaVersions\b', r'\buseSubmitFormula\b',
    r'\buseReviewFormula\b', r'\buseComplianceCheck\b',
]

hook_call_lines = []  # (line_num_0based, hook_name)
for i, line in enumerate(lines):
    for pat in HOOK_PATTERNS:
        if re.search(pat, line):
            hook_call_lines.append((i, pat.replace(r'\b', '').replace(r'\B', ''), line.strip()))
            break

print(f"Found {len(hook_call_lines)} potential hook call lines")
for ln, name, txt in hook_call_lines:
    print(f"  L{ln+1}: {name} — {txt[:70]}")
