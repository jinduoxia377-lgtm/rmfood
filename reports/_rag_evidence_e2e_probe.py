# -*- coding: utf-8 -*-
"""配方生成 rag_evidence 服务级 HTTP 实测（对运行中 :8000 后端）"""
import json, sys, time
sys.stdout.reconfigure(encoding="utf-8")
import requests

BASE = "http://127.0.0.1:8000"
R = {"base": BASE, "steps": {}}

def hdr(s):
    c = s.cookies.get("csrf_token", "") or ""
    return {"X-CSRF-Token": c} if c else {}

def main():
    s = requests.Session()
    r = s.get(BASE + "/api/v1", timeout=20)
    R["steps"]["api_v1"] = r.status_code
    # login
    r = s.post(BASE + "/api/v1/auth/login", json={"username": "admin", "password": "admin123"},
               headers=hdr(s), timeout=30)
    R["steps"]["login"] = r.status_code
    tok = ""
    try:
        tok = r.json().get("access_token", "")
    except Exception:
        pass
    R["steps"]["token_prefix"] = tok[:12] if tok else "NONE"
    if r.status_code != 200 or not tok:
        R["steps"]["login_body"] = r.text[:200]
        print(json.dumps(R, ensure_ascii=False, indent=2)); return
    auth = {"Authorization": f"Bearer {tok}", **hdr(s)}
    # generate 增强免疫
    payload = {"target_effects": ["增强免疫"], "use_llm": False, "constraints": {"max_candidates": 5}}
    r = s.post(BASE + "/api/v1/ai/generate", json=payload, headers=auth, timeout=180)
    R["steps"]["generate_immune_status"] = r.status_code
    try:
        j = r.json()
        cands = j.get("candidates", [])
        R["steps"]["generate_immune_total"] = j.get("total", len(cands))
        R["steps"]["generate_immune_candidate_count"] = len(cands)
        if cands:
            c0 = cands[0]
            R["steps"]["candidate0_keys"] = sorted(c0.keys())
            R["steps"]["candidate0_score"] = c0.get("score")
            R["steps"]["candidate0_safety_passed"] = c0.get("safety_passed")
            R["steps"]["candidate0_herb_combo"] = c0.get("herb_combination")
            R["steps"]["candidate0_safety_score"] = c0.get("safety_score")
        re_ = j.get("rag_evidence")
        R["steps"]["rag_evidence"] = re_
        R["steps"]["rag_evidence_keys"] = sorted(re_.keys()) if isinstance(re_, dict) else None
        # 响应级 vs 候选级透传一致性
        cand_re = cands[0].get("rag_evidence") if cands else None
        R["steps"]["candidate0_rag_evidence_passthrough"] = cand_re
        R["steps"]["rag_evidence_matches_candidate"] = (re_ == cand_re) if re_ is not None and cand_re is not None else None
    except Exception as e:
        R["steps"]["generate_immune_body"] = r.text[:300]
    print(json.dumps(R, ensure_ascii=False, indent=2))

if __name__ == "__main__":
    main()
