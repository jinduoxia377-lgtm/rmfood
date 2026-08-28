# -*- coding: utf-8 -*-
"""Properly convert terminology.py from sync to async SQLAlchemy"""
import re

path = 'D:/RMFOODFP/backend/app/api/terminology.py'
with open(path, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Remove BOM
content = content.lstrip('\ufeff')

# Step 1: Fix imports
content = content.replace('from sqlalchemy.orm import Session', 'from sqlalchemy.ext.asyncio import AsyncSession\nfrom sqlalchemy import select, func, delete')
content = content.replace('from .deps import get_db', 'from .deps import get_db_session')

# Step 2: Fix router prefix
content = content.replace('prefix="/api/terminology"', 'prefix="/terminology"')

# Step 3: Convert all def to async def where they use await
# Process line by line
lines = content.split('\n')
new_lines = []
i = 0
while i < len(lines):
    line = lines[i]
    # Check for function definition
    stripped = line.lstrip()
    if stripped.startswith('def ') and 'async def' not in line:
        # Collect the full function body
        indent = len(line) - len(stripped)
        func_lines = [line]
        j = i + 1
        while j < len(lines):
            next_stripped = lines[j].lstrip()
            next_indent = len(lines[j]) - len(next_stripped)
            # Stop at next top-level definition
            if next_stripped.startswith('def ') or next_stripped.startswith('async def ') or \
               (next_stripped.startswith('@') and next_indent <= indent) or \
               (next_stripped and next_indent <= indent and not lines[j].startswith(' ' * (indent + 1)) and not lines[j].startswith('\t')):
                break
            func_lines.append(lines[j])
            j += 1
        func_text = '\n'.join(func_lines)
        # Check if function uses await
        if 'await ' in func_text:
            # Replace def with async def in first line only
            new_lines.append(func_lines[0].replace('def ', 'async def ', 1))
            new_lines.extend(func_lines[1:])
        else:
            new_lines.extend(func_lines)
        i = j
    else:
        new_lines.append(line)
        i += 1

content = '\n'.join(new_lines)

# Step 4: Replace db.query() patterns properly
def replace_query_match(m):
    model = m.group(1)
    chain = m.group(2)
    method = m.group(3)
    result = f'result = await db.execute(select({model})'
    # Parse chain for filters, order_by, offset, limit
    parts = chain
    # Extract filter conditions
    if '.filter(' in parts:
        filter_parts = parts.split('.filter(')
        for fp in filter_parts[1:]:
            cond = fp.split('.')[0].rstrip(')')
            result += f'.where({cond})'
    if '.order_by(' in parts:
        ob = parts.split('.order_by(')[1].split('.')[0].rstrip(')')
        result += f'.order_by({ob})'
    if '.offset(' in parts:
        off = parts.split('.offset(')[1].split('.')[0].rstrip(')')
        result += f'.offset({off})'
    if '.limit(' in parts:
        lim = parts.split('.limit(')[1].split('.')[0].rstrip(')')
        result += f'.limit({lim})'
    result += ');'
    if method == 'all':
        result += ' result.scalars().all()'
    elif method == 'first':
        result += ' result.scalar_one_or_none()'
    elif method == 'count':
        result += ' result.scalar_one()'
    elif method == 'delete':
        result += ' result.rowcount'
    return result

content = re.sub(r'db\.query\((\w+)\)\.(.+?)\.(all|first|count|delete)\(\)', replace_query_match, content, flags=re.DOTALL)

# Step 5: Fix standalone query = db.query(Model)
content = re.sub(r'(\w+) = db\.query\((\w+)\)', r'\1 = select(\2)', content)

# Step 6: Ensure Session type hints are updated
content = content.replace('db: Session = Depends(get_db)', 'db: AsyncSession = Depends(get_db_session)')
content = content.replace('db: Session', 'db: AsyncSession')

with open(path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

import ast
with open(path, 'r', encoding='utf-8') as f:
    ast.parse(f.read())
print('OK: terminology.py converted to async, syntax valid')
