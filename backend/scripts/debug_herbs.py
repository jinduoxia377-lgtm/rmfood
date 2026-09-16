"""Debug food-homology endpoint."""
import json
import sys
import inspect
sys.path.insert(0, r'D:\RMFOODFP\backend')

from app.api.db_modules import herbs
src = inspect.getsource(herbs.get_food_homology_herbs)

print("=== Loaded function keys check ===")
key_count = src.count('"announcement_source"')
print(f"announcement_source occurrences: {key_count}")
print(f"flavor_cn occurrences: {src.count('\"flavor_cn\"')}")
print(f"version occurrences: {src.count('\"version\"')}")

# Find return block
idx = src.find('return {')
block = src[idx:idx+2000]
print("\n=== Return block keys ===")
for line in block.split('\n'):
    if '"' in line and ':' in line and 'for h' not in line:
        print(line.strip())

print("\n=== Now testing actual API ===")
import asyncio
import httpx

async def test():
    async with httpx.AsyncClient() as c:
        r = await c.get("http://localhost:8000/api/v1/databases/herbs/food-homology?page_size=1")
        d = r.json()
        keys = list(d['items'][0].keys())
        print(f"API response keys ({len(keys)}): {keys}")
        print(f"has announcement_source: {'announcement_source' in keys}")
        print(f"has flavor_cn: {'flavor_cn' in keys}")
        print(f"version: {d.get('version')}")

asyncio.run(test())
