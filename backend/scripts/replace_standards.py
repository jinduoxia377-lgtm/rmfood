"""
将生成的1724项标准数据替换到compliance_router.py
"""
import re

# Read the generated standards
with open(r"C:\Users\Administrator\AppData\Local\Temp\standards_output.py", "r", encoding="utf-8") as f:
    new_standards = f.read()

# Read the current compliance_router.py
with open(r"D:\RMFOODFP\backend\app\api\v1\compliance_router.py", "r", encoding="utf-8") as f:
    content = f.read()

# Find and replace FOOD_SAFETY_STANDARDS block
# Pattern: from FOOD_SAFETY_STANDARDS = [ to the closing ] on its own line
pattern = r'FOOD_SAFETY_STANDARDS\s*=\s*\[[\s\S]*?\n\]\s*\n'

if re.search(pattern, content):
    new_content = re.sub(pattern, new_standards + "\n", content)
    with open(r"D:\RMFOODFP\backend\app\api\v1\compliance_router.py", "w", encoding="utf-8") as f:
        f.write(new_content)
    print("Replaced FOOD_SAFETY_STANDARDS successfully")
else:
    print("Pattern not found!")
    # Try to find the start
    idx = content.find("FOOD_SAFETY_STANDARDS")
    print(f"FOOD_SAFETY_STANDARDS found at index: {idx}")
    print("Context:", content[idx:idx+200])
