# -*- coding: utf-8 -*-
import re

# Fix ExperimentNewPage.tsx
path = 'D:/RMFOODFP/frontend/src/pages/experiment/ExperimentNewPage.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Check for common syntax issues
lines = content.split('\n')
print(f"总行数: {len(lines)}")
print(f"第468行: {lines[467] if len(lines) > 467 else 'N/A'}")
print(f"第469行: {lines[468] if len(lines) > 468 else 'N/A'}")

# Look for unmatched brackets/braces
open_braces = content.count('{')
close_braces = content.count('}')
open_parens = content.count('(')
close_parens = content.count(')')
open_brackets = content.count('[')
close_brackets = content.count(']')

print(f"\n括号统计:")
print(f"  {{ : {open_braces}, }} : {close_braces}")
print(f"  ( : {open_parens}, ) : {close_parens}")
print(f"  [ : {open_brackets}, ] : {close_brackets}")
