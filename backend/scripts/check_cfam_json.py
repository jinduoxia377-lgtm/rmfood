"""Check pdf_page and image_path mapping in CFAM JSON."""
import json

with open(r'D:\RMFOODFP\data\CFAM\cfam_merged.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

herbs = data.get('all_herbs', [])
# Find herbs with pdf_page info
print(f'Total herbs: {len(herbs)}')
with_page = [h for h in herbs if h.get('pdf_page')]
print(f'Herbs with pdf_page: {len(with_page)}')

# Show sample
for h in with_page[:10]:
    print(f"  {h['name']}: pdf_page={h.get('pdf_page')}, image_path={h.get('image_path')}")

# Check CFAM images directory
import os
cfam_img_dir = r'D:\RMFOODFP\data\CFAM\images'
files = os.listdir(cfam_img_dir)
print(f'\nCFAM images count: {len(files)}')
# Show first 15
for f in sorted(files)[:15]:
    print(f'  {f}')
