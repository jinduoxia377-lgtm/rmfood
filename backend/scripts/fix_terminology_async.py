# -*- coding: utf-8 -*-
"""Fix terminology.py: convert sync SQLAlchemy to async - correct version"""
import re

path = 'D:/RMFOODFP/backend/app/api/terminology.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Fix imports
content = content.replace('from sqlalchemy.orm import Session', 'from sqlalchemy.ext.asyncio import AsyncSession\nfrom sqlalchemy import select')
content = content.replace('from .deps import get_db', 'from .deps import get_db_session')

# 2. Fix router prefix
content = content.replace('prefix="/api/terminology"', 'prefix="/terminology"')

# 3. Fix function signatures
def fix_sig(line):
    m = re.match(r'^(\s*)def (\w+)\((.*)\)(.*)', line)
    if m:
        indent, name, params, rest = m.groups()
        params = params.replace('db: Session = Depends(get_db)', 'db: AsyncSession = Depends(get_db_session)')
        params = params.replace('db: Session', 'db: AsyncSession')
        return f'{indent}async def {name}({params}){rest}'
    return line

lines = content.split('\n')
new_lines = [fix_sig(l) for l in lines]
content = '\n'.join(new_lines)

# 4. Replace db.query() patterns using a function to capture properly
def replace_query(m):
    model = m.group(1)
    rest = m.group(2)
    if '.order_by(' in rest and '.all()' in rest:
        order_part = rest.split('.order_by(')[1].replace('.all()', '')
        return f'result = await db.execute(select({model}).order_by({order_part})); result.scalars().all()'
    elif '.filter(' in rest:
        filter_part = rest.split('.filter(')[1]
        if '.first()' in filter_part:
            where_expr = filter_part.replace('.first()', '')
            return f'result = await db.execute(select({model}).where({where_expr})); result.scalar_one_or_none()'
        elif '.all()' in filter_part:
            where_expr = filter_part.replace('.all()', '')
            return f'result = await db.execute(select({model}).where({where_expr})); result.scalars().all()'
        elif '.offset(' in filter_part:
            # Handle offset/limit
            parts = filter_part
            if '.offset(' in parts and '.limit(' in parts and '.all()' in parts:
                before_offset = parts.split('.offset(')[0]
                where_expr = before_offset.replace('.filter(', '').rstrip(')')
                after_offset = parts.split('.offset(')[1]
                offset_val = after_offset.split('.limit(')[0].rstrip(')')
                limit_val = after_offset.split('.limit(')[1].replace('.all()', '').rstrip(')')
                return f'result = await db.execute(select({model}).where({where_expr}).offset({offset_val}).limit({limit_val})); result.scalars().all()'
            elif '.offset(' in parts and '.limit(' in parts and '.first()' in parts:
                before_offset = parts.split('.offset(')[0]
                where_expr = before_offset.replace('.filter(', '').rstrip(')')
                after_offset = parts.split('.offset(')[1]
                offset_val = after_offset.split('.limit(')[0].rstrip(')')
                limit_val = after_offset.split('.limit(')[1].replace('.first()', '').rstrip(')')
                return f'result = await db.execute(select({model}).where({where_expr}).offset({offset_val}).limit({limit_val})); result.scalar_one_or_none()'
    return m.group(0)

# Match db.query(Model).filter(...).all() etc
content = re.sub(r'db\.query\((\w+)\)\.(.+?)\.(all|first)\(\)', replace_query, content)

with open(path, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)

# Verify syntax
with open(path, 'r', encoding='utf-8') as f:
    ast_content = f.read()
import ast
ast.parse(ast_content)
print('OK: terminology.py converted to async successfully')
