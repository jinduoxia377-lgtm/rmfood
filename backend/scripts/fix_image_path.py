# -*- coding: utf-8 -*-
import re

file_path = r'D:\RMFOODFP\frontend\src\pages\database\tabs\HerbsTab.tsx'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix the escaped backslash issue
# Replace \${ with ${
content = content.replace(r'\${', '${')

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed: Removed escaped backslash')

# Verify
with open(file_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

for i, line in enumerate(lines[550:560], 551):
    print(f'{i}: {line.rstrip()}')
