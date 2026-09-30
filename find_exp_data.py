import json, urllib.request
spec = json.load(urllib.request.urlopen("http://localhost:8000/openapi.json", timeout=10))
print("experiment data endpoints:")
for p in spec["paths"]:
    if "data" in p and "experiment" in p.lower():
        print(" ", p, list(spec["paths"][p].keys()))
