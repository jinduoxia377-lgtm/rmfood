# -*- coding: utf-8 -*-
import re

path = 'app/api/terminology.py'
with open(path, 'r', encoding='utf-8-sig') as f:
    content = f.read()

# Remove BOM if present
content = content.lstrip('\ufeff')

# Replace imports
content = content.replace('from sqlalchemy.orm import Session', 'from sqlalchemy.ext.asyncio import AsyncSession\nfrom sqlalchemy import select')
content = content.replace('from ..api.deps import get_db', 'from ..api.deps import get_db_session')

# Replace function signatures
content = re.sub(r'def (get_\w+)\(db: Session = Depends\(get_db\)\)', r'async def \1(db: AsyncSession = Depends(get_db_session))', content)
content = re.sub(r'def (\w+)\(.*?db: Session = Depends\(get_db\)', lambda m: 'async def ' + m.group(0).replace('def ', '').replace('db: Session = Depends(get_db)', 'db: AsyncSession = Depends(get_db_session)'), content, flags=re.DOTALL)

# Replace db.query patterns
content = re.sub(r'db\.query\((\w+)\)\.order_by\((\w+\.\w+)\)\.all\(\)', r'result = await db.execute(select($1).order_by($2)); result.scalars().all()', content)
content = re.sub(r'db\.query\((\w+)\)\.filter\(([^)]+)\)\.first\(\)', r'result = await db.execute(select($1).where($2)); result.scalar_one_or_none()', content)
content = re.sub(r'db\.query\((\w+)\)\.filter\(([^)]+)\)\.all\(\)', r'result = await db.execute(select($1).where($2)); result.scalars().all()', content)
content = re.sub(r'db\.query\((\w+)\)\.filter\(([^)]+)\)\.offset\(([^)]+)\)\.limit\(([^)]+)\)\.all\(\)', r'result = await db.execute(select($1).where($2).offset($3).limit($4)); result.scalars().all()', content)

# Add async to service function
content = content.replace('def get_terminology_service(db: Session = Depends(get_db))', 'async def get_terminology_service(db: AsyncSession = Depends(get_db_session))')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print('OK: terminology.py rewritten as async')
