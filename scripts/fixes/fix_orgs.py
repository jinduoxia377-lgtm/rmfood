import sys
sys.stdout.reconfigure(encoding='utf-8')

path = r'D:\RMFOODFP\backend\app\api\organizations.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

# Replace all current_user["..."] and current_user['...'] with current_user.*
import re
content = re.sub(r'current_user\["([^"]+)"\]', r'current_user.\1', content)
content = re.sub(r"current_user\('([^']+)'\)", r'current_user.\1', content)

with open(path, 'w', encoding='utf-8') as f:
    f.write(content)

# Verify
with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()
remaining = sum(1 for l in lines if 'current_user[' in l)
print(f'Remaining current_user[ references: {remaining}')
# Show any remaining
for i, l in enumerate(lines):
    if 'current_user[' in l:
        print(f'  Line {i+1}: {l.rstrip()[:100]}')
