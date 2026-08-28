#!/usr/bin/env python3
"""
Fix FormulaDetailPage: Move all hooks from after early returns to before them.
The component has hooks at L364-L1068 after early returns at L324-L345.
We need to move those hooks before the early returns.
"""
import re, os

SRC = r"D:\RMFOODFP\frontend\src"
FP = os.path.join(SRC, "pages/formula/FormulaDetailPage.tsx")
c = open(FP, encoding="utf-8").read()
lines = c.split('\n')

# ─── Step 1: Find exact boundaries ───
# Early returns end at line 345 (0-indexed: 344)
# The "事件处理函数" comment starts at line 347 (0-indexed: 346)
# JSX return starts at line 1083 (0-indexed: 1082)

EARLY_RETURN_END = 345  # 0-indexed line AFTER "}" of !formula early return
JSX_RETURN_LINE = 1082  # 0-indexed line with "  return ("

# ─── Step 2: Identify hook call start lines in the problem zone ───
HOOK_START_PATTERNS = [
    r'\buseState\b', r'\buseMemo\b', r'\buseCallback\b', r'\buseEffect\b',
    r'\buseRef\b', r'\buseQuery\b', r'\buseMutation\b',
    r'\buseFormula\b', r'\buseFormulaVersions\b', r'\buseSubmitFormula\b',
    r'\buseReviewFormula\b',
]

# We need to find multi-line hook calls. Strategy:
# Find lines that START a hook call, then find where each hook ends (matching parens).
def find_hook_ranges(start_line, end_line):
    """Find ranges of lines that contain hook calls."""
    ranges = []
    i = start_line
    while i < end_line:
        line = lines[i]
        is_hook = False
        hook_name = ''
        for pat in HOOK_START_PATTERNS:
            if re.search(pat, line):
                # Extract hook name
                m = re.search(r'\b(use\w+)\b', line)
                if m:
                    hook_name = m.group(1)
                is_hook = True
                break
        
        if is_hook:
            # Find the end of this hook call by counting parens
            start = i
            paren_depth = 0
            found_open = False
            j = i
            while j < len(lines):
                for ch in lines[j]:
                    if ch == '(':
                        paren_depth += 1
                        found_open = True
                    elif ch == ')':
                        paren_depth -= 1
                if found_open and paren_depth == 0:
                    ranges.append((start, j))
                    break
                j += 1
            i = j + 1 if j < len(lines) else j
        else:
            i += 1
    return ranges

# Get all hook ranges in the problem zone (346 to 1082)
hook_ranges = find_hook_ranges(EARLY_RETURN_END, JSX_RETURN_LINE)
print(f"Found {len(hook_ranges)} hook ranges in lines {EARLY_RETURN_END+1}-{JSX_RETURN_LINE+1}")
for start, end in hook_ranges:
    print(f"  L{start+1}-L{end+1}: {lines[start][:70]}")

# ─── Step 3: Also get the non-hook code in between ───
# We need to preserve non-hook code (regular functions, etc.)
non_hook_lines = []
hook_blocks = []
i = EARLY_RETURN_END
while i < JSX_RETURN_LINE:
    line = lines[i]
    is_hook_start = False
    for pat in HOOK_START_PATTERNS:
        if re.search(pat, line):
            is_hook_start = True
            break
    
    if is_hook_start:
        # Find the full hook range
        paren_depth = 0
        found_open = False
        end_i = i
        while end_i < len(lines):
            for ch in lines[end_i]:
                if ch == '(':
                    paren_depth += 1
                    found_open = True
                elif ch == ')':
                    paren_depth -= 1
            if found_open and paren_depth == 0:
                break
            end_i += 1
        hook_blocks.append((i, end_i))
        i = end_i + 1
    else:
        # Regular code line - skip it (we'll keep it where it is for now)
        i += 1

print(f"\nHook blocks to move: {len(hook_blocks)}")
for start, end in hook_blocks:
    print(f"  L{start+1}-L{end+1}")

# ─── Step 4: Build new file ───
# Structure:
# [0..321] : Everything up to and including the useEffect at L320 (before early returns)
# [hooks from problem zone] : All hook calls
# [322..344] : Early returns
# [346..1081 without hooks] : Regular code (callbacks, helpers, render functions)
# [1082+] : JSX return and everything after

# Let's be more precise: move hooks to right after line 321 (after the last pre-return hook)
# and before line 322 (the "Early Returns" comment)

# Pre-hook zone: lines 0-321 (indices)
# Hook zone: the hooks we found
# Post-hook zone: lines 346-1081 without hooks

pre_zone = lines[:322]  # lines 0-321
post_hook_zone_start = 346  # line 347 (after early returns comment)
post_hook_zone_end = JSX_RETURN_LINE  # line 1082 (before "return (")

# Extract non-hook lines from post-zone
non_hook_lines = []
i = post_hook_zone_start
while i < post_hook_zone_end:
    line = lines[i]
    is_hook = False
    for pat in HOOK_START_PATTERNS:
        if re.search(pat, line):
            is_hook = True
            break
    if is_hook:
        # Skip this hook (we'll add it to the hook zone)
        paren_depth = 0
        found_open = False
        j = i
        while j < len(lines):
            for ch in lines[j]:
                if ch == '(':
                    paren_depth += 1
                    found_open = True
                elif ch == ')':
                    paren_depth -= 1
            if found_open and paren_depth == 0:
                break
            j += 1
        i = j + 1
    else:
        non_hook_lines.append(line)
        i += 1

# Build hook zone text
hook_zone_text = []
for start, end in hook_blocks:
    hook_zone_text.extend(lines[start:end+1])
    hook_zone_text.append('')  # blank line separator

# Build non-hook zone text (preserve original but remove hook lines)
non_hook_text = []
for line in non_hook_lines:
    non_hook_text.append(line)

# Now reconstruct:
# 1. Pre-zone (0-321)
# 2. Hook zone (all hooks)
# 3. Early returns (322-345)  
# 4. Non-hook post-zone (regular functions)
# 5. JSX return and rest (1082+)

new_lines = pre_zone.copy()
new_lines.append('')
new_lines.append('// ── Hooks（编辑/分析/导出等回调）──')
new_lines.extend(hook_zone_text)
new_lines.append('')
new_lines.extend(lines[322:346])  # Early returns section
new_lines.append('')
new_lines.append('// ── 事件处理函数 ──')
new_lines.extend(non_hook_text)
new_lines.append('')
new_lines.extend(lines[JSX_RETURN_LINE:])  # JSX return and rest

new_content = '\n'.join(new_lines)
open(FP, "w", encoding="utf-8").write(new_content)
print(f"\n  OK  FormulaDetailPage.tsx rebuilt")
print(f"  Old lines: {len(lines)}, New lines: {len(new_lines)}")
