"""通用扫描：找出所有模型构造调用中传入非法列名/只读 property 的位置。

对比 SQLAlchemy 模型的真实列 + property 集合，静态检查 AST 里的 kwarg。
"""
import ast
import importlib
import inspect
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from sqlalchemy.orm import DeclarativeBase

ROOT = Path(__file__).resolve().parent.parent / "app"

# 收集所有已注册模型：类名 -> (真实列集合, property 名称集合)
models = {}
try:
    from app.core.database import Base
    from sqlalchemy import inspect as sa_inspect
    import app.models  # noqa: F401  触发全部模型注册

    for name, obj in vars(importlib.import_module("app.models")).items():
        if inspect.isclass(obj) and issubclass(obj, Base) and hasattr(obj, "__table__"):
            # 用 mapper 的 Python 属性名（而非 DB 列名）做比对：
            # 例如 Notification.metadata_ 映射到 DB 列 "metadata"，
            # 构造时合法 kwarg 是 metadata_ 而非 metadata。
            mapper = sa_inspect(obj)
            valid = {attr.key for attr in mapper.attrs if hasattr(attr, "columns")}
            props = {n for n, v in vars(obj).items() if isinstance(v, property)}
            models[name] = (valid, props)
except Exception as e:
    print("模型加载失败:", type(e).__name__, e)
    raise SystemExit(1)

print(f"已加载模型: {len(models)} 个")

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
        if name not in models:
            continue
        checked += 1
        cols, props = models[name]
        kwargs = {kw.arg for kw in node.keywords if kw.arg}
        bad = kwargs - cols
        if bad:
            rel = py.relative_to(ROOT.parent)
            problems.append((str(rel), node.lineno, name, sorted(bad), sorted(set(bad) & props)))

print(f"扫描到模型构造调用点: {checked} 个")
if problems:
    print(f"\n发现 {len(problems)} 处非法 kwarg:")
    for path, line, model, bad, prop_hits in problems:
        extra = f"  <-- 只读 property: {prop_hits}" if prop_hits else ""
        print(f"  {path}:{line}  {model}({bad}){extra}")
else:
    print("全部模型构造调用点列名合法 ✅")
