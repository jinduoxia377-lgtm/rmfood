# -*- coding: utf-8 -*-
import re

path = "D:/RMFOODFP/backend/app/api/terminology.py"
with open(path, "rb") as f:
    raw = f.read()

# Remove BOM
if raw.startswith(b"\xef\xbb\xbf"):
    raw = raw[3:]

content = raw.decode("utf-8")

# Fix broken patterns
replacements = [
    # Broken count assignments
    (r"total_terms = result = await db\.execute\(select\(Term\)\); result\.scalar_one\(\)",
     r"result = await db.execute(select(func.count(Term.id))); total_terms = result.scalar_one()"),
    (r"total_variants = result = await db\.execute\(select\(TermVariant\)\); result\.scalar_one\(\)",
     r"result = await db.execute(select(func.count(TermVariant.id))); total_variants = result.scalar_one()"),
    (r"total_categories = result = await db\.execute\(select\(TermCategory\)\); result\.scalar_one\(\)",
     r"result = await db.execute(select(func.count(TermCategory.id))); total_categories = result.scalar_one()"),
    # Broken category query in loop
    (r"categories = result = await db\.execute\(select\(TermCategory\)\.where\(Term\.category_id == cat\.id\)\); result\.scalar_one\(\)",
     r"result = await db.execute(select(TermCategory).where(TermCategory.id == cat.id)); cat_obj = result.scalar_one_or_none()"),
]

for old, new in replacements:
    content = re.sub(old, new, content)

with open(path, "wb") as f:
    f.write(content.encode("utf-8"))

import ast
ast.parse(content)
print("OK: terminology.py fixed")
