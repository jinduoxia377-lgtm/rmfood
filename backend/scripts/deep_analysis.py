# -*- coding: utf-8 -*-
path = 'D:/RMFOODFP/frontend/src/pages/experiment/ExperimentNewPage.tsx'
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Total lines: {len(lines)}")
print()
print("Lines 460-475:")
for i in range(459, min(475, len(lines))):
    print(f"{i+1}: {repr(lines[i])}")

# Check for any syntax issues
print()
print("Checking for potential issues...")
for i, line in enumerate(lines, 1):
    # Check for unmatched braces
    if '{' in line and '}' not in line and not line.strip().startswith('//'):
        # Could be a multi-line construct, skip
        pass
    # Check for JSX issues
    if i > 450 and '</' in line and not line.strip().startswith('/*'):
        print(f"Line {i}: {line.rstrip()[:60]}")
