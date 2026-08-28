# -*- coding: utf-8 -*-
"""Fix all sync functions that use await in terminology.py"""
import re

path = 'D:/RMFOODFP/backend/app/api/terminology.py'
with open(path, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Remove BOM
content = content.lstrip('\ufeff')

# Find all function definitions and check if they contain await
lines = content.split('\n')
new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    # Check if this is a function definition (not async)
    stripped = line.lstrip()
    if stripped.startswith('def ') and 'async def' not in line:
        # Look ahead to see if this function contains 'await'
        # Scan forward until we find the next top-level def or decorator
        j = i + 1
        func_body = []
        indent_level = len(line) - len(stripped)
        while j < len(lines):
            next_line = lines[j]
            next_stripped = next_line.lstrip()
            # Check if we've hit another top-level definition
            if next_stripped.startswith('def ') or next_stripped.startswith('async def ') or \
               (next_stripped.startswith('@') and not next_line.startswith(' ' * (indent_level + 1))):
                break
            func_body.append(next_line)
            j += 1
        # Check if function body contains 'await'
        func_text = '\n'.join(func_body)
        if 'await ' in func_text:
            # Convert to async
            new_lines.append(line.replace('def ', 'async def ', 1))
        else:
            new_lines.append(line)
    else:
        new_lines.append(line)
    i += 1

content = '\n'.join(new_lines)

# Also fix remaining db.query patterns that weren't caught
# Handle standalone query = db.query(Model)
content = re.sub(r'(\w+) = db\.query\((\w+)\)', r'\1 = select(\2)', content)
# Handle db.query(Model).filter(...).count()
content = re.sub(
    r'db\.query\((\w+)\)\.filter\((.+?)\)\.count\(\)',
    r'result = await db.execute(select(func.count($1.id)).where($2)); result.scalar_one()',
    content
)
# Handle db.query(Model).filter(...).delete()  
content = re.sub(
    r'db\.query\((\w+)\)\.filter\((.+?)\)\.delete\(\)',
    r'await db.execute(delete(select($1).where($2)))',
    content
)

with open(path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

import ast
ast.parse(content)
print('OK: All functions converted to async, syntax valid')
