import os

base = r'D:\RMFOODFP\frontend\src'
path = os.path.join(base, 'components/ai/features/components/PromptLibrary.tsx')

with open(path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Print lines 218-240
for i in range(218, min(240, len(lines))):
    print(f"L{i+1}: {lines[i].rstrip()}")
