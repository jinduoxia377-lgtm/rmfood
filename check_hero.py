import os

base = r'D:\RMFOODFP\frontend\src'
path = os.path.join(base, 'pages/landing/sections/Hero.tsx')

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Print lines around 940-950
print("=== Hero.tsx around L940 ===")
for i in range(936, min(952, len(lines))):
    print(f"L{i+1}: {lines[i].rstrip()}")
