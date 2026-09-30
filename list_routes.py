import json
import urllib.request

r = urllib.request.urlopen("http://localhost:8000/openapi.json", timeout=10)
spec = json.load(r)
paths = spec.get("paths", {})
print("total route paths:", len(paths))
for p in sorted(paths):
    print(p, "->", [m.upper() for m in paths[p]])
