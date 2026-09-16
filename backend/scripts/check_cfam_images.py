"""Check CFAM JSON image paths."""
import json, sys
sys.stdout.reconfigure(encoding='utf-8')

with open(r'D:\RMFOODFP\data\CFAM\cfam_merged.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

herbs = data.get('all_herbs', [])
with_img = [h for h in herbs if h.get('image_path')]
print(f'Herbs with image_path in JSON: {len(with_img)}')
for h in with_img:
    print(f"  {h['name']}: pdf_page={h.get('pdf_page')}, image_path={h.get('image_path')}")

# Also check all unique image_path patterns
all_paths = set(h.get('image_path') for h in herbs if h.get('image_path'))
print(f'\nUnique image paths: {sorted(all_paths)}')
