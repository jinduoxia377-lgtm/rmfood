"""修复 org_id -> organization_id 列名问题"""
import sys, re

# Fix organizations.py
path1 = r'D:\RMFOODFP\backend\app\api\organizations.py'
with open(path1, 'r', encoding='utf-8') as f:
    content = f.read()

original = content
content = content.replace('m.org_id', 'm.organization_id')
if content != original:
    with open(path1, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Fixed {path1}')
else:
    print(f'No changes in {path1}')

# Fix multi_tenant_service.py - only SQL column references
path2 = r'D:\RMFOODFP\backend\app\core\multi_tenant\multi_tenant_service.py'
with open(path2, 'r', encoding='utf-8') as f:
    content = f.read()

original = content
# Replace org_id column references in SQL strings only
# Pattern: WHERE org_id, SET ... org_id, INSERT ... org_id, (org_id,
replacements = [
    ('WHERE org_id', 'WHERE organization_id'),
    ('SET role = :role WHERE org_id', 'SET role = :role WHERE organization_id'),
    ('INSERT INTO organization_members (user_id, org_id', 'INSERT INTO organization_members (user_id, organization_id'),
    ('VALUES (:user_id, :org_id', 'VALUES (:user_id, :organization_id'),
    (':org_id, :role', ':organization_id, :role'),
    (':org_id) AND', ':organization_id) AND'),
    ('org_id = :org_id', 'organization_id = :org_id'),
    ('m.org_id', 'm.organization_id'),
]
for old, new in replacements:
    content = content.replace(old, new)

if content != original:
    with open(path2, 'w', encoding='utf-8') as f:
        f.write(content)
    print(f'Fixed {path2}')
else:
    print(f'No changes in {path2}')

# Verify
with open(path1, 'r', encoding='utf-8') as f:
    c1 = f.read()
with open(path2, 'r', encoding='utf-8') as f:
    c2 = f.read()

print(f'\norganizations.py org_id refs: {c1.count("org_id")}')
print(f'multi_tenant_service.py org_id refs: {c2.count("org_id")}')
