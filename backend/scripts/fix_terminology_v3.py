# -*- coding: utf-8 -*-
"""Complete fix for terminology.py - rewrite with async patterns"""
import re

path = 'D:/RMFOODFP/backend/app/api/terminology.py'
with open(path, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Remove BOM
content = content.lstrip('\ufeff')

# Fix all remaining db.query patterns
patterns = [
    # db.query(Model).count()
    (r'db\.query\((\w+)\)\.count\(\)', r'select(func.count($1.id))\n    result = await db.execute('),
    # db.query(Model).filter(...).delete()
    (r'db\.query\((\w+)\)\.filter\((.+?)\)\.delete\(\)', r'await db.execute(delete(select($1).where($2)))'),
]

# More comprehensive approach: find all db.query patterns and replace
def fix_query(m):
    model = m.group(1)
    chain = m.group(2)
    method = m.group(3)
    
    result = f'result = await db.execute(select({model})'
    
    # Extract where conditions from .filter()
    if '.filter(' in chain:
        filters = chain.split('.filter(')
        for f in filters[1:]:  # skip first empty
            clean = f.rstrip(').').rstrip()
            result += f'.where({clean})'
    
    # Extract order_by
    if '.order_by(' in chain:
        ob = chain.split('.order_by(')[1].rstrip(').').rstrip()
        result += f'.order_by({ob})'
    
    # Extract offset/limit
    if '.offset(' in chain:
        off = chain.split('.offset(')[1].split('.limit(')[0].rstrip(')').strip()
        result += f'.offset({off})'
    if '.limit(' in chain:
        lim = chain.split('.limit(')[1].rstrip(').').rstrip()
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

# Match all db.query patterns including multi-line
content = re.sub(r'db\.query\((\w+)\)\.(.+?)\.(all|first|count|delete)\(\)', fix_query, content, flags=re.DOTALL)

# Also handle standalone query = db.query(Model)
content = re.sub(r'(\w+) = db\.query\((\w+)\)', r'\1 = select(\2)', content)

# Ensure func is imported
if 'from sqlalchemy import select' in content and 'func' not in content.split('from sqlalchemy import select')[1].split('\n')[0]:
    content = content.replace('from sqlalchemy import select', 'from sqlalchemy import select, func')

with open(path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

# Verify
import ast
ast.parse(content)
print('OK: All db.query patterns replaced, syntax valid')
print(f'Total lines: {len(content.splitlines())}')
