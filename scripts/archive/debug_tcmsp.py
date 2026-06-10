"""Debug: check if TCMSP has embedded data in HTML source"""
import requests
import re
import json

url = 'https://www.tcmsp-e.com/browse.php?qc=herbs'
r = requests.get(url, timeout=30, headers={'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'})

html = r.text

# Check for various data patterns
lines = []
lines.append(f"Length: {len(html)}")

# 1. Look for JSON arrays
json_patterns = [
    r'var\s+\w*\s*=\s*\[',
    r'var\s+data\s*=',
    r'JSON\.parse',
    r'\[\{.*?"name"',
    r'"herb_id"',
    r'"herb_name"',
    r'"herb_en"',
]

for pat in json_patterns:
    matches = re.findall(pat, html)
    lines.append(f"Pattern '{pat[:30]}': {len(matches)} matches")

# 2. Look for AJAX/API calls in scripts
api_patterns = [
    r'(?:fetch|ajax|axios|get|post)\s*\(',
    r'\.php\?',
    r'api[/_]',
    r'data.*?url',
]
for pat in api_patterns:
    matches = re.findall(pat, html, re.IGNORECASE)
    if matches:
        lines.append(f"\nAPI pattern '{pat[:20]}': {matches[:5]}")

# 3. Look for the actual herb data pattern
# Search around "Aidicha" context
idx = html.find("Aidicha")
if idx > 0:
    snippet = html[max(0,idx-200):idx+200]
    lines.append(f"\nAround 'Aidicha' (pos {idx}):\n{snippet}")

# 4. Check for DataTable or similar JS library usage
for lib in ['DataTable', 'dataTables', 'datatable', 'jqGrid', 'DataTables']:
    if lib in html:
        lines.append(f"Found JS library: {lib}")

# 5. Look for script tags with data
scripts = re.findall(r'<script[^>]*>(.*?)</script>', html, re.DOTALL)
lines.append(f"\nScript tags: {len(scripts)}")
for i, s in enumerate(scripts):
    if len(s) > 50:
        # Show first 200 chars of each substantial script
        lines.append(f"\nScript[{i}] ({len(s)} chars): {s[:300]}...")

with open('debug_output.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(lines))
print("Done")
