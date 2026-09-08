"""直接测试登录 API — 排查 401 原因"""
import urllib.request
import json

BASE = "http://localhost:8001"

# 测试 1: 正确密码 (来自 .env)
print("=== Test 1: admin / admin@RMfood2024! ===")
req = urllib.request.Request(
    f"{BASE}/api/v1/auth/login",
    data=json.dumps({"username": "admin", "password": "admin@RMfood2024!"}).encode(),
    headers={"Content-Type": "application/json"},
)
try:
    resp = json.loads(urllib.request.urlopen(req).read().decode())
    print(f"✅ 成功! token前20位: {resp['access_token'][:20]}")
except urllib.error.HTTPError as e:
    print(f"❌ {e.code}: {e.read().decode()[:300]}")

# 测试 2: 登录页显示的默认密码
print("\n=== Test 2: admin / admin123 ===")
req = urllib.request.Request(
    f"{BASE}/api/v1/auth/login",
    data=json.dumps({"username": "admin", "password": "admin123"}).encode(),
    headers={"Content-Type": "application/json"},
)
try:
    resp = json.loads(urllib.request.urlopen(req).read().decode())
    print(f"✅ 成功!")
except urllib.error.HTTPError as e:
    body = e.read().decode()
    print(f"❌ {e.code}: {body[:200]}")

# 测试 3: 检查用户表中的 password_hash 长度
print("\n=== Test 3: 检查数据库中的密码哈希 ===")
import asyncio, asyncpg
from scripts.db_utils import get_asyncpg_dsn
async def check():
    conn = await asyncpg.connect(get_asyncpg_dsn())
    row = await conn.fetchrow("SELECT username, length(hashed_password) as hash_len, left(hashed_password, 30) as hash_prefix FROM users WHERE username='admin'")
    if row:
        print(f"  username={row['username']}")
        print(f"  hash_len={row['hash_len']}")
        print(f"  hash_prefix={row['hash_prefix']}...")
    await conn.close()
asyncio.run(check())
