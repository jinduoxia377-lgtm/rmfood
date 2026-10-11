import json, sys, urllib.request, urllib.error, http.cookiejar
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://127.0.0.1:8000/api/v1"
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
csrf = ""

# 先不带 token 访问 health 触发 CSRF cookie 下发
r = urllib.request.Request(BASE + "/health", method="GET")
try: opener.open(r, timeout=5)
except: pass
for c in cj:
    if c.name.lower() in ("csrf_token","csrf"): csrf = c.value
print("prime csrf:", "OK" if csrf else "MISSING")

def do(method, path, body=None, form=False, need_csrf=True):
    global csrf
    url = BASE + path
    data, headers = None, {}
    if body is not None:
        if form:
            data = "&".join(f"{k}={v}" for k,v in body.items()).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
    if csrf and need_csrf: headers["X-CSRF-Token"] = csrf
    r = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        return json.loads(opener.open(r, timeout=30).read().decode())
    except urllib.error.HTTPError as e:
        return {"__http__": e.code, "body": e.read().decode()[:200]}

login = do("POST", "/auth/oauth2/token", {"grant_type":"password","username":"admin","password":"admin123"}, form=True, need_csrf=True)
if "__http__" in login:
    print("登录失败:", login); sys.exit(1)
tk = login["access_token"]
print("login OK")

def authed(method, path, body=None, form=False):
    global csrf
    url = BASE + path
    data, headers = None, {"Authorization": f"Bearer {tk}"}
    if csrf: headers["X-CSRF-Token"] = csrf
    if body is not None:
        if form:
            data = "&".join(f"{k}={v}" for k,v in body.items()).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
    r = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        return json.loads(opener.open(r, timeout=30).read().decode())
    except urllib.error.HTTPError as e:
        return {"__http__": e.code, "body": e.read().decode()[:300]}

cur = authed("GET", "/experiments/16")
print("exp16:", cur.get("status") if not "__http__" in cur else cur)

st = authed("POST", "/experiments/16/start", {})
print("start:", st.get("status") if not "__http__" in st else st)

dp = authed("POST", "/experiments/16/data", {"value": 8.2, "unit": "g", "note": "e2e-real-params"})
print("add data:", dp.get("id") if not "__http__" in dp else dp)

val = authed("POST", "/formulas/14/validate", {"experiment_id":16, "daily_dosage_g":10.0, "body_weight_kg":65.0})
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

cp = authed("POST", "/experiments/16/complete", {})
print("\ncomplete:", cp.get("status") if not "__http__" in cp else cp)
