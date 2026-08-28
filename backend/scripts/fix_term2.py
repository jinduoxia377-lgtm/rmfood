import re
path = "D:/RMFOODFP/backend/app/api/terminology.py"
with open(path, "r", encoding="utf-8") as f:
    content = f.read()

def repl(m):
    model = m.group(1)
    chain = m.group(2)
    method = m.group(3)
    # Parse the chain to extract filters, order_by, offset, limit
    result = f"result = await db.execute(select({model})"
    # Extract .filter(X).where(X)
    if ".filter(" in chain:
        parts = chain.split(".filter(")
        for i, part in enumerate(parts):
            if i == 0:
                continue
            clean = part.rstrip(").")
            if i == len(parts) - 1 and method == "all":
                clean = clean.replace(".all()", "")
            elif i == len(parts) - 1 and method == "first":
                clean = clean.replace(".first()", "")
            result += f".where({clean})"
    if ".order_by(" in chain:
        ob = chain.split(".order_by(")[1].rstrip(").").replace(f".{method}()", "")
        result += f".order_by({ob})"
    if ".offset(" in chain:
        off = chain.split(".offset(")[1].split(".limit(")[0].rstrip(")").strip()
        result += f".offset({off})"
    if ".limit(" in chain:
        lim = chain.split(".limit(")[1].rstrip(").").replace(f".{method}()", "").strip()
        result += f".limit({lim})"
    result += ");"
    if method == "all":
        result += " result.scalars().all()"
    else:
        result += " result.scalar_one_or_none()"
    return result

content = re.sub(r"db\.query\((\w+)\)\.([^\.]+)\.(all|first)\(\)", repl, content)

with open(path, "w", encoding="utf-8", newline="\n") as f:
    f.write(content)
import ast
ast.parse(content)
print("OK")
