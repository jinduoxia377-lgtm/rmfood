import json, sys, urllib.request, urllib.error, http.cookiejar
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE = "http://127.0.0.1:8000/api/v1"
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))

# prime
r = urllib.request.Request(BASE + "/health", method="GET")
resp = opener.open(r, timeout=10)
# 手动读取 Set-Cookie
set_cookie = resp.headers.get("Set-Cookie")
csrf_val = ""
if set_cookie:
    csrf_val = set_cookie.split(";")[0].split("=",1)[1]
print("csrf captured:", "OK" if csrf_val else "MISSING")

# 登录：手动把 cookie 塞进 header（绕过 Secure flag 问题）
data = "grant_type=password&username=admin&password=admin123".encode()
h = {"Content-Type":"application/x-www-form-urlencoded",
     "X-CSRF-Token": csrf_val,
     "Cookie": f"csrf_token={csrf_val}"}
r2 = urllib.request.Request(BASE + "/auth/oauth2/token", data=data, method="POST", headers=h)
try:
    resp2 = urllib.request.urlopen(r2, timeout=30)
    login = json.loads(resp2.read().decode())
    print("login OK, token len:", len(login.get("access_token","")))
except urllib.error.HTTPError as e:
    print("login fail:", e.code, e.read().decode()[:200])
    sys.exit(1)
tk = login["access_token"]

# 后续：experiments/formulas 路径豁免 CSRF，只需 JWT
def call(method, path, body=None):
    h = {"Authorization": f"Bearer {tk}"}
    data = None
    if body is not None:
        data = json.dumps(body).encode(); h["Content-Type"]="application/json"
    r = urllib.request.Request(BASE + path, data=data, method=method, headers=h)
    try:
        return json.loads(urllib.request.urlopen(r, timeout=30).read().decode())
    except urllib.error.HTTPError as e:
        return {"__http__": e.code, "body": e.read().decode()[:300]}

st = call("POST", "/experiments/16/start", {})
print("start:", st.get("status") if not "__http__" in st else st)

dp = call("POST", "/experiments/16/data", {"value":8.2,"unit":"g","note":"e2e-real-params"})
print("add data:", dp.get("id") if not "__http__" in dp else dp)

val = call("POST", "/formulas/14/validate", {"experiment_id":16,"daily_dosage_g":10.0,"body_weight_kg":65.0})
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

cp = call("POST", "/experiments/16/complete", {})
print("\ncomplete:", cp.get("status") if not "__http__" in cp else cp)
