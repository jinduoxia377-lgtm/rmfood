"""Check the loaded food-homology function source."""
import inspect
import sys
sys.path.insert(0, r'D:\RMFOODFP\backend')

from app.api.db_modules import herbs
src = inspect.getsource(herbs.get_food_homology_herbs)

has_ann = 'announcement_source' in src
has_flavor = 'flavor_cn' in src
has_notice = 'special_notice' in src
has_restriction = 'usage_restriction' in src
has_version = '"version"' in src or "'version'" in src

print(f"has announcement_source: {has_ann}")
print(f"has flavor_cn: {has_flavor}")
print(f"has special_notice: {has_notice}")
print(f"has usage_restriction: {has_restriction}")
print(f"has version: {has_version}")

# Print the return block
idx = src.find('return {')
print("\n--- Return block ---")
print(src[idx:idx+1800])
