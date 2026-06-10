import re

with open('D:/RMFOOD配方平台/backend/gen_expand_herbs.py', 'r', encoding='utf-8') as f:
    content = f.read()

calls = re.findall(r'add_herb\(', content)
print(f'Total add_herb calls: {len(calls)}')

# Find lines with unquoted target_count
lines = content.split('\n')
bad_lines = []
for i, line in enumerate(lines, 1):
    if 'target_count' in line:
        # Check if target_count is properly quoted
        if '"target_count"' not in line and "'target_count'" not in line:
            stripped = line.strip()[:120]
            bad_lines.append((i, stripped))

print(f'\nLines with unquoted target_count: {len(bad_lines)}')
for ln, txt in bad_lines[:30]:
    print(f'  Line {ln}: {txt}')

# Also check for other common issues
print(f'\n--- Summary ---')
print(f'Total lines: {len(lines)}')
print(f'Section markers: {len(re.findall(r"#+ ====", content))}')
