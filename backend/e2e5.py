import json, sys, urllib.request, urllib.error, http.cookiejar
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://127.0.0.1:8000/api/v1"
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
tk = ""

def do(method, path, body=None, form=False, authed=False):
    global tk
    url = BASE + path
    data, headers = None, {}
    if body is not None:
        if form:
            data = "&".join(f"{k}={v}" for k,v in body.items()).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
    if authed and tk: headers["Authorization"] = f"Bearer {tk}"
    r = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        return json.loads(opener.open(r, timeout=30).read().decode())
    except urllib.error.HTTPError as e:
        return {"__http__": e.code, "body": e.read().decode()[:300]}

# 1. 登录（/auth/oauth2/token 不在 skip_paths，需 cookie+header 双提交）
r = urllib.request.Request(BASE + "/health", method="GET")
try: opener.open(r, timeout=5)
except: pass
csrf = next((c.value for c in cj if c.name.lower()=="csrf_token"), "")
print("csrf primed:", "OK" if csrf else "MISSING")

login = do("POST", "/auth/oauth2/token", {"grant_type":"password","username":"admin","password":"admin123"}, form=True)
if csrf:
    login = do("POST", "/auth/oauth2/token", {"grant_type":"password","username":"admin","password":"admin123"}, form=True)
# 登录走 skip_paths 才豁免；实际 /auth/oauth2/token 不在 skip_paths 列表里，
# 但 cookie+header 都带 csrf 应通过
if "__http__" in login:
    # 重新 prime（cookie 可能换了）
    r = urllib.request.Request(BASE + "/health", method="GET")
    try: opener.open(r, timeout=5)
    except: pass
    csrf = next((c.value for c in cj if c.name.lower()=="csrf_token"), "")
    login = do("POST", "/auth/oauth2/token", {"grant_type":"password","username":"admin","password":"admin123"}, form=True)
    if csrf:
        pass
if "__http__" in login:
    print("登录失败:", login); sys.exit(1)
tk = login["access_token"]
print("login OK")

# 2. start（/experiments/* 豁免 CSRF，只带 JWT）
st = do("POST", "/experiments/16/start", {}, authed=True)
print("start:", st.get("status") if not "__http__" in st else st)

# 3. 加数据点
dp = do("POST", "/experiments/16/data", {"value": 8.2, "unit": "g", "note": "e2e-real-params"}, authed=True)
print("add data:", dp.get("id") if not "__http__" in dp else dp)

# 4. validate（/formulas/* 豁免 CSRF）
val = do("POST", "/formulas/14/validate", {"experiment_id":16, "daily_dosage_g":10.0, "body_weight_kg":65.0}, authed=True)
if "__http__" in val:
    print("validate fail:", val); sys.exit(1)
vr = val.get("validation_result") or val
print("\n=== validate ===")
print("status:", vr.get("status"), "overall_score:", vr.get("overall_score"))
for stage in ("efficacy","stability","taste","synergy"):
    s = vr.get(stage) or {}
    det = s.get("details") or {}
    print(f"[{stage}] score={s.get('score')} passed={s.get('passed')}")
    print(f"   source={str(det.get('source','?'))[:90]}")
    if stage=="synergy":
        print(f"   overall_si={det.get('overall_si')} pairs_with_db={det.get('pairs_with_db_data')}/{det.get('total_pairs')}")
        print(f"   pairs={det.get('pair_coefficients')}")
    if stage=="efficacy":
        print(f"   db_hit={det.get('db_hit_ingredients')} db_miss={det.get('db_miss_ingredients')}")
    if stage=="stability":
        print(f"   shelf={det.get('shelf_life_months')} k_avg={det.get('avg_degradation_rate')} hit={det.get('db_hit_ingredients')}")
    if stage=="taste":
        print(f"   acceptability={det.get('acceptability')} hit={det.get('db_hit_ingredients')}")

# 5. complete
cp = do("POST", "/experiments/16/complete", {}, authed=True)
print("\ncomplete:", cp.get("status") if not "__http__" in cp else cp)
