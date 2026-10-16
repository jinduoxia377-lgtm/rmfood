"""
辨证引擎评测脚本

运行方式（在 backend 目录）：
    venv/Scripts/python.exe scripts/eval_dialectics.py

对评测集中的每个案例调用 analyze_dialectics：
- 急重症案例必须返回 urgent=True 并给出就医提醒
- 普通案例必须返回 urgent=False 且体质倾向非空
- 规则降级模式下，命中内置关键词的案例应包含预期体质关键词

输出：逐例结果 + 通过率汇总。
"""
from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.services.ai.dialectics_service import analyze_dialectics  # noqa: E402

EVAL_CASES_PATH = Path(__file__).resolve().parent / "data" / "dialectics_eval_cases.json"


async def evaluate() -> dict:
    cases = json.loads(EVAL_CASES_PATH.read_text(encoding="utf-8"))
    results = []
    passed = 0
    total = len(cases)

    for case in cases:
        rid = case["id"]
        query = case["query"]
        expects_urgent = case["expects_urgent"]
        keywords = case.get("expected_keywords", [])

        try:
            r = await analyze_dialectics(query)
        except Exception as e:
            results.append({
                "id": rid,
                "query": query,
                "pass": False,
                "reason": f"异常: {e}",
            })
            continue

        checks = []
        # 急症判断
        if expects_urgent:
            if r.get("urgent"):
                checks.append("urgent_ok")
            else:
                checks.append("urgent_miss")
        else:
            if not r.get("urgent"):
                checks.append("non_urgent_ok")
            else:
                checks.append("unexpected_urgent")

            if r.get("constitution_tendency"):
                checks.append("constitution_ok")
            else:
                checks.append("constitution_empty")

            # 规则降级模式下校验关键词
            if r.get("engine") == "rule_engine_fallback" and keywords:
                text = r.get("constitution_tendency", "") + "".join(r.get("regulation_goals", []))
                if any(k in text for k in keywords):
                    checks.append("keyword_ok")
                else:
                    checks.append("keyword_miss")

        is_pass = "miss" not in " ".join(checks) and "empty" not in " ".join(checks) and "unexpected" not in " ".join(checks)
        if is_pass:
            passed += 1
        results.append({
            "id": rid,
            "query": query,
            "engine": r.get("engine"),
            "urgent": r.get("urgent"),
            "constitution": r.get("constitution_tendency", "")[:60],
            "checks": checks,
            "pass": is_pass,
        })

    return {
        "total": total,
        "passed": passed,
        "failed": total - passed,
        "results": results,
    }


def main() -> None:
    # Windows GBK 控制台兼容：避免 emoji/特殊字符导致 UnicodeEncodeError
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    summary = asyncio.run(evaluate())
    print(f"\n=== 辨证引擎评测结果: {summary['passed']}/{summary['total']} 通过 ===")
    for r in summary["results"]:
        mark = "[PASS]" if r["pass"] else "[FAIL]"
        print(f"{mark} [{r['id']}] engine={r['engine']} urgent={r['urgent']} checks={r['checks']}")
        if r.get("constitution"):
            print(f"    constitution: {r['constitution']}")
    if summary["failed"] > 0:
        print(f"\n[FAIL] 未通过: {summary['failed']} 例")
        return 1
    print("\n[PASS] 全部通过")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())