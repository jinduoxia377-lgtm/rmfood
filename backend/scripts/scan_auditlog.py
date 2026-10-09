"""静态扫描：找出所有 AuditLog(...) 调用中传入非法列名的位置。

真实列: action/created_at/details/id/ip_address/request_id/
        resource_id/resource_type/user_agent/user_id
"""
import ast
from pathlib import Path

REAL_COLS = {
    "action", "created_at", "details", "id", "ip_address",
    "request_id", "resource_id", "resource_type", "user_agent", "user_id",
}
# property 别名（只读，不能当 kwarg 传）
BAD_ALIASES = {"entity_type", "entity_id"}

ROOT = Path(__file__).resolve().parent.parent / "app"
problems = []
checked = 0

for py in ROOT.rglob("*.py"):
    try:
        tree = ast.parse(py.read_text(encoding="utf-8"))
    except Exception:
        continue
    for node in ast.walk(tree):
        if not isinstance(node, ast.Call):
            continue
        fn = node.func
        name = getattr(fn, "id", None) or getattr(fn, "attr", None)
        if name != "AuditLog":
            continue
        checked += 1
        kwargs = {kw.arg for kw in node.keywords if kw.arg}
        bad = kwargs - REAL_COLS
        if bad:
            rel = py.relative_to(ROOT.parent)
            problems.append((str(rel), node.lineno, sorted(bad)))

print(f"扫描到 AuditLog(...) 调用点: {checked} 个")
if problems:
    print(f"\n发现 {len(problems)} 处非法列名:")
    for path, line, bad in problems:
        tag = "  <-- property 别名!" if (set(bad) & BAD_ALIASES) else ""
        print(f"  {path}:{line}  非法列: {bad}{tag}")
else:
    print("全部调用点列名合法 ✅")
