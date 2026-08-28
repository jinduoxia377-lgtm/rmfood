# -*- coding: utf-8 -*-
with open(r'D:\RMFOODFP\frontend\src\components\layout\MainLayout.tsx', 'r', encoding='utf-8') as f:
    content = f.read()

# Add formula cases to navigation
old = "{ to:'/formulas', label:'配方管理', icon: FlaskConical },"
new = """{ to:'/formulas', label:'配方管理', icon: FlaskConical },
  { to:'/formulas/cases', label:'配方案例', icon: FileText },"""

if old in content:
    content = content.replace(old, new)
    with open(r'D:\RMFOODFP\frontend\src\components\layout\MainLayout.tsx', 'w', encoding='utf-8') as f:
        f.write(content)
    print('OK: Added nav link')
else:
    print('NOT FOUND')
    idx = content.find("label:'配方管理'")
    if idx >= 0:
        print(repr(content[idx-30:idx+80]))
