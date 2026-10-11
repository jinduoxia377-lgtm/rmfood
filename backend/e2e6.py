import json, sys, urllib.request, urllib.error, http.cookiejar
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://127.0.0.1:8000/api/v1"
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
tk = ""
csrf = ""

def raw(method, path, data, headers, form=False):
    url = BASE + path
    if data is not None and not form:
        data = json.dumps(data).encode(); headers.setdefault("Content-Type","application/json")
    r = urllib.request.Request(url, data=data, method=method, headers=headers)
    try:
        resp = opener.open(r, timeout=30)
        return resp, json.loads(resp.read().decode())
    except urllib.error.HTTPError as e:
        return None, {"__http__": e.code, "body": e.read().decode()[:300]}

# 1. prime: GET health → cookie csrf_token
resp, _ = raw("GET", "/health", None, {})
for c in cj:
    if c.name.lower()=="csrf_token": csrf = c.value
print("csrf primed:", "OK" if csrf else "MISSING")

# 2. login: form POST with cookie + X-CSRF-Token header
data = "grant_type=password&username=admin&password=admin123".encode()
h = {"Content-Type":"application/x-www-form-urlencoded","X-CSRF-Token":csrf}
resp, login = raw("POST", "/auth/oauth2/token", data, h, form=True)
if "__http__" in login:
    print("login fail:", login); sys.exit(1)
tk = login["access_token"]
print("login OK")

def authed(method, path, data, form=False):
    h = {"Authorization": f"Bearer {tk}"}
    return raw(method, path, data, h, form=form)

# 3. start
resp, st = authed("POST", "/experiments/16/start", {})
print("start:", st.get("status") if not "__http__" in st else st)

# 4. add data point
resp, dp = authed("POST", "/experiments/16/data", {"value":8.2,"unit":"g","note":"e2e-real-params"})
print("add data:", dp.get("id") if not "__http__" in dp else dp)

# 5. validate
resp, val = authed("POST", "/formulas/14/validate", {"experiment_id":16,"daily_dosage_g":10.0,"body_weight_kg":65.0})
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

# 6. complete
resp, cp = authed("POST", "/experiments/16/complete", {})
print("\ncomplete:", cp.get("status") if not "__http__" in cp else cp)
