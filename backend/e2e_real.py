import asyncio, json, sys, urllib.request, urllib.error, http.cookiejar
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://127.0.0.1:8000/api/v1"
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

def req(method, path, body=None, form=False):
    url = BASE + path
    data = None
    headers = {}
    if body is not None:
        if form:
            data = "&".join(f"{k}={v}" for k, v in body.items()).encode()
            headers["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            data = json.dumps(body).encode()
            headers["Content-Type"] = "application/json"
    r = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        resp = opener.open(r, timeout=30)
        return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"__http__": e.code, "body": e.read().decode()[:200]}

# 1. 登录
login = req("POST", "/auth/oauth2/token", {"grant_type":"password","username":"admin","password":"admin123"}, form=True)
print("login:", "OK" if "access_token" in login else login)
tk = login.get("access_token")

def authed(method, path, body=None, form=False):
    # CSRF prime
    r = urllib.request.Request(BASE + "/health", method="GET")
    try: opener.open(r, timeout=5)
    except: pass
    csrf = ""
    for c in cj:
        if c.name == "csrf_token": csrf = c.value
    h = {"Authorization": f"Bearer {tk}"}
    if csrf: h["X-CSRF-Token"] = csrf
    url = BASE + path
    data = None
    if body is not None:
        if form:
            data = "&".join(f"{k}={v}" for k, v in body.items()).encode()
            h["Content-Type"] = "application/x-www-form-urlencoded"
        else:
            data = json.dumps(body).encode()
            h["Content-Type"] = "application/json"
    r2 = urllib.request.Request(url, data=data, method=method, headers=h)
    try:
        resp = opener.open(r2, timeout=30)
        return json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return {"__http__": e.code, "body": e.read().decode()[:300]}

# 2. 重置 exp16 → 重新走完整流程
# 先查 16 状态
exp = authed("GET", "/experiments/16")
print("exp16 状态:", exp.get("status") if isinstance(exp,dict) else exp, "validation_status:", exp.get("validation_status") if isinstance(exp,dict) else "-")

# 如果未开始，start
if isinstance(exp, dict) and exp.get("status") == "not_started":
    st = authed("POST", "/experiments/16/start", {})
    print("start:", st.get("status") if isinstance(st,dict) else st)

# 3. validate
val = authed("POST", "/formulas/14/validate", {"experiment_id":16, "daily_dosage_g":10.0, "body_weight_kg":65.0})
if "__http__" in val:
    print("validate fail:", val)
    sys.exit(1)
vuuid = val.get("validation_result", {}).get("uuid") or val.get("uuid") or val.get("result_id")
print("validate result:", json.dumps({k:v for k,v in (val.get("validation_result") or val).items() if k in ("status","overall_score","overall_si","passed","db_hit_ingredients","db_miss_ingredients","source","details")}, ensure_ascii=False)[:400])

# 4. 直接读各阶段 details 看新表是否生效
vr = val.get("validation_result") or {}
for stage in ("efficacy","stability","taste","synergy"):
    s = vr.get(stage) or {}
    det = s.get("details") or {}
    print(f"  [{stage}] score={s.get('score')} passed={s.get('passed')}")
    print(f"    source={det.get('source','?')[:80]}")
    if stage=="synergy":
        print(f"    overall_si={det.get('overall_si')} pairs={det.get('pairs_with_db_data')}/{det.get('total_pairs')}")
        print(f"    pair_coefficients={det.get('pair_coefficients')[:4]}")
    if stage=="efficacy":
        print(f"    db_hit={det.get('db_hit_ingredients')} db_miss={det.get('db_miss_ingredients')}")
    if stage=="stability":
        print(f"    shelf_life={det.get('shelf_life_months')} k_avg={det.get('avg_degradation_rate')} db_hit={det.get('db_hit_ingredients')}")
    if stage=="taste":
        print(f"    acceptability={det.get('acceptability')} db_hit={det.get('db_hit_ingredients')}")
