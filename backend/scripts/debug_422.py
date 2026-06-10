"""调试 422 错误 — 获取 activity-types 的实际响应"""
import urllib.request
import json

url = "http://localhost:8001/api/v1/databases/peptides/activity-types"
req = urllib.request.Request(url)
try:
    r = urllib.request.urlopen(req)
    print(f"Status: {r.status}")
    print(r.read().decode()[:500])
except urllib.error.HTTPError as e:
    print(f"Status: {e.code}")
    body = e.read().decode()
    print(f"Body: {body[:500]}")
