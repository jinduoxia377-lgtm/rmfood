import re
import sys

file_path = r'D:\RMFOODFP\miniprogram\pages\profile\index\index.js'
with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# 替换可选链语法
# obj?.prop -> obj && obj.prop
content = re.sub(r'(\w+)\??\.(\w+)', r'\1 && \1.\2', content)

# obj?.prop?.method() -> obj && obj.prop && obj.prop.method()
content = re.sub(r'(\w+\.\w+)\??\.(\w+)', r'\1 && \1.\2', content)

with open(file_path, 'w', encoding='utf-8') as f:
    f.write(content)

print(f'Fixed: D:\RMFOODFP\miniprogram\pages\profile\index\index.js')