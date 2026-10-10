#!/usr/bin/env python3
"""A-46：修标题跳级（h1 之后直接 h3 / h4）。

这 4 个页面有且仅有一个 h1、且完全没有 h2，紧随其后的小节标题是 h3/h4。
把这些 h3/h4 提到 h2 即可补上断层。

视觉上不会有任何变化：Tailwind preflight 已经把 h1~h6 的字号/字重全部清零，
这些标题的字号都由显式的 text-xs / text-sm 工具类决定，与标签名无关。
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
FILES = [
    "src/pages/experiment/ExperimentDetailPage.tsx",
    "src/pages/experiment/ExperimentSharePage.tsx",
    "src/pages/ingredient/IngredientAnalysisPage.tsx",
    "src/pages/test/SliderDiagnosticPage.tsx",
]

failed = False
for rel in FILES:
    p = ROOT / rel
    src = p.read_text(encoding="utf-8")
    lv = sorted({int(m) for m in re.findall(r"<h([1-6])\b", src)})
    if 1 not in lv or 2 in lv:
        print(f"!! {rel}: 标题层级 {lv} 不符合预期（需含 h1 且不含 h2）-> 跳过")
        failed = True
        continue
    n3 = len(re.findall(r"<h3\b", src))
    n4 = len(re.findall(r"<h4\b", src))
    src = re.sub(r"<h3\b", "<h2", src)
    src = re.sub(r"</h3>", "</h2>", src)
    src = re.sub(r"<h4\b", "<h2", src)
    src = re.sub(r"</h4>", "</h2>", src)
    p.write_text(src, encoding="utf-8")
    print(f"ok {rel}: h3×{n3} + h4×{n4} -> h2 （原层级 {lv}）")

sys.exit(1 if failed else 0)
