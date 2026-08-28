# -*- coding: utf-8 -*-
"""Minimal fix: convert terminology.py to async with proper handling"""
import re

path = 'D:/RMFOODFP/backend/app/api/terminology.py'
with open(path, 'r', encoding='utf-8-sig') as f:
    content = f.read()

content = content.lstrip('\ufeff')

# 1. Fix imports - add select, func, delete; change Session->AsyncSession
content = content.replace(
    'from sqlalchemy.orm import Session',
    'from sqlalchemy.ext.asyncio import AsyncSession\nfrom sqlalchemy import select, func, delete'
)
content = content.replace('from .deps import get_db', 'from .deps import get_db_session')

# 2. Fix router prefix
content = content.replace('prefix="/api/terminology"', 'prefix="/terminology"')

# 3. Replace all db.query() calls with async equivalents
# We need to handle each pattern carefully
replacements = [
    # Simple patterns
    (r'db\.query\((\w+)\)\.order_by\(([^)]+)\)\.all\(\)',
     r'result = await db.execute(select(\1).order_by(\2)); result.scalars().all()'),
    (r'db\.query\((\w+)\)\.filter\((.+?)\)\.first\(\)',
     r'result = await db.execute(select(\1).where(\2)); result.scalar_one_or_none()'),
    (r'db\.query\((\w+)\)\.filter\((.+?)\)\.all\(\)',
     r'result = await db.execute(select(\1).where(\2)); result.scalars().all()'),
    (r'db\.query\((\w+)\)\.filter\((.+?)\)\.count\(\)',
     r'result = await db.execute(select(func.count(\1.id)).where(\2)); result.scalar_one()'),
    (r'db\.query\((\w+)\)\.filter\((.+?)\)\.offset\((.+?)\)\.limit\((.+?)\)\.all\(\)',
     r'result = await db.execute(select(\1).where(\2).offset(\3).limit(\4)); result.scalars().all()'),
    (r'db\.query\((\w+)\)\.filter\((.+?)\)\.offset\((.+?)\)\.limit\((.+?)\)\.first\(\)',
     r'result = await db.execute(select(\1).where(\2).offset(\3).limit(\4)); result.scalar_one_or_none()'),
    # Standalone query assignment
    (r'(\w+) = db\.query\((\w+)\)', r'\1 = select(\2)'),
    # db.query(Model).filter(...).delete()
    (r'db\.query\((\w+)\)\.filter\((.+?)\)\.delete\(\)',
     r'await db.execute(delete(select(\1).where(\2)))'),
]

for old, new in replacements:
    content = re.sub(old, new, content)

# 4. Convert sync def to async def for functions containing await
lines = content.split('\n')
new_lines = []
for i, line in enumerate(lines):
    stripped = line.lstrip()
    # Check if this is a non-async def
    if re.match(r'^def \w+', line) and 'async def' not in line:
        # Look ahead to see if function contains await
        # Collect function body
        body_lines = []
        j = i + 1
        base_indent = len(line) - len(stripped)
        while j < len(lines):
            nl = lines[j]
            ns = nl.lstrip()
            ni = len(nl) - len(ns)
            if ns and ni <= base_indent and not nl.startswith(' ' * (base_indent + 1)):
                break
            body_lines.append(nl)
            j += 1
        body_text = '\n'.join(body_lines)
        if 'await ' in body_text:
            # Convert to async
            new_lines.append(line.replace('def ', 'async def ', 1))
        else:
            new_lines.append(line)
    else:
        new_lines.append(line)

content = '\n'.join(new_lines)

# 5. Fix type hints
content = content.replace('db: Session = Depends(get_db)', 'db: AsyncSession = Depends(get_db_session)')
content = re.sub(r'db: Session\b', 'db: AsyncSession', content)

with open(path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

# Verify
import ast
with open(path, 'r', encoding='utf-8') as f:
    ast.parse(f.read())
print('OK: terminology.py async conversion complete')
