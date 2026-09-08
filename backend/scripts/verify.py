import re
import json
from collections import Counter

with open(r"D:\RMFOODFP\backend\app\api\v1\compliance_router.py", "r", encoding="utf-8") as f:
    content = f.read()

# Count entries
codes = re.findall(r'"standard_code": "([^"]+)"', content)
print(f"Total standard_code entries: {len(codes)}")
print(f"Unique codes: {len(set(codes))}")
print(f"First 5: {codes[:5]}")

# Count categories
cats = re.findall(r'"category": "([^"]+)"', content)
for c, n in sorted(Counter(cats).items(), key=lambda x: -x[1])[:15]:
    print(f"  {c}: {n}")

# Check total lines
lines = content.split('\n')
print(f"Total lines in file: {len(lines)}")

# Verify JSON is valid by checking structure
opens = content.count('{')
closes = content.count('}')
print(f"Opening braces: {opens}, Closing braces: {closes}")
