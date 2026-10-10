#!/usr/bin/env python3
"""A-45：把路由页的页头 h2 提升为 h1（WCAG 1.3.1 / 2.4.6，每页应有且仅一个 h1）。

判定依据：这些页面用的是同一套页头组件签名
    <h2 className="text-xl font-semibold leading-snug tracking-tight ...">
在 ui-sweep 标出的 22 个「缺 h1」路由页里，有 12 页各自恰好命中一次 ——
可以机械替换，不会误伤同页里其它作为小节标题的 h2。

开标签与闭合标签必须成对改，否则 tsc 会报 TS17002（未闭合的标签）。
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent

SIG = r'<h2 (className="text-xl font-semibold leading-snug tracking-tight[\s\S]*?</h2>)'
FILES = [
    "src/pages/academic/AcademicReportPage.tsx",
    "src/pages/ai/AIAssistantPage.tsx",
    "src/pages/batch/BatchDetailPage.tsx",
    "src/pages/batch/TracePage.tsx",
    "src/pages/compliance/ComplianceCheckPage.tsx",
    "src/pages/documents/DocumentExtractPage.tsx",
    "src/pages/experiment/DoePage.tsx",
    "src/pages/labels/LabelGeneratorPage.tsx",
    "src/pages/peptide-structure/PeptideStructurePage.tsx",
    "src/pages/regulations/RegulationsPage.tsx",
    "src/pages/stability/StabilityPage.tsx",
    "src/pages/workflow/WorkflowPage.tsx",
]

failed = False
for rel in FILES:
    p = ROOT / rel
    src = p.read_text(encoding="utf-8")
    matches = list(re.finditer(SIG, src))
    if len(matches) != 1:
        print(f"!! {rel}: 期望 1 处页头，实际 {len(matches)} 处 -> 跳过（需人工判断）")
        failed = True
        continue
    m = matches[0]
    inner = m.group(1)
    if "</h2>" not in inner:
        print(f"!! {rel}: 未找到配对闭合标签 -> 跳过")
        failed = True
        continue
    new_inner = inner[: inner.rfind("</h2>")] + "</h1>"
    src = src[: m.start()] + "<h1 " + new_inner + src[m.end():]
    p.write_text(src, encoding="utf-8")
    print(f"ok {rel}: h2 -> h1")

sys.exit(1 if failed else 0)
