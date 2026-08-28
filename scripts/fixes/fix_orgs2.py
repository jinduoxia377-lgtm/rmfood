import sys
sys.stdout.reconfigure(encoding='utf-8')
import re

path = r'D:\RMFOODFP\backend\app\api\organizations.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Fix current_user.get("id") -> current_user.id
content = content.replace('current_user.get("id")', 'current_user.id')

# Fix current_user['id'] -> current_user.id (including in f-strings)
content = content.replace("current_user['id']", 'current_user.id')

# Verify
remaining = content.count("current_user[")
print(f'Remaining current_user[ references: {remaining}')

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

print('Fixed all current_user dict accesses')
