import json, sys, urllib.request, urllib.error
sys.stdout.reconfigure(encoding="utf-8", errors="replace")
BASE = "http://127.0.0.1:8000/api/v1"
import http.cookiejar
cj = http.cookiejar.CookieJar()
opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
r = urllib.request.Request(BASE + "/health", method="GET")
resp = opener.open(r, timeout=10)
sc = resp.headers.get("Set-Cookie")
csrf = sc.split(";")[0].split("=",1)[1] if sc else ""
data = "grant_type=password&username=admin&password=admin123".encode()
h = {"Content-Type":"application/x-www-form-urlencoded","X-CSRF-Token":csrf,"Cookie":f"csrf_token={csrf}"}
r2 = urllib.request.Request(BASE + "/auth/oauth2/token", data=data, method="POST", headers=h)
login = json.loads(urllib.request.urlopen(r2, timeout=30).read().decode())
tk = login["access_token"]

def call(p, body):
    h = {"Authorization": f"Bearer {tk}","X-CSRF-Token":csrf,"Cookie":f"csrf_token={csrf}","Content-Type":"application/json"}
    rr = urllib.request.Request(BASE + p, data=json.dumps(body).encode(), method="POST", headers=h)
    try:
        resp = urllib.request.urlopen(rr, timeout=90)
        return resp.status, resp.read().decode()
    except urllib.error.HTTPError as e:
        return e.code, e.read().decode()

for p, body in [("/ai/analyze/formula", {"formula_id":14}),
                ("/ai/analyze/experiment", {"experiment_id":16})]:
    st, out = call(p, body)
    print(f"[{st}] {p}: {out[:200]}")
