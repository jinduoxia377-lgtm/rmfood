#!/usr/bin/env python3
"""Fix Invalid time value errors in FormulaDetailPage and related components"""
import re, os

SRC = r"D:\RMFOODFP\frontend\src"
changes = []

# ═══════════════════════════════════════════════════════════════
# 1. FormulaDetailPage.tsx — 安全日期格式化
# ═══════════════════════════════════════════════════════════════
fp1 = os.path.join(SRC, "pages/formula/FormulaDetailPage.tsx")
c1 = open(fp1, encoding="utf-8").read()
nc1 = c1

# Add import for formatDate after the existing imports block
import_marker = "import { logger } from'@/utils/safeLogger';"
if "import { formatDate" not in c1:
    nc1 = c1.replace(import_marker, import_marker + "\nimport { formatDate } from'@/lib/utils';")
    changes.append("FormulaDetailPage: added formatDate import")

# L1226: new Date(formula.createdAt).toLocaleDateString('zh-CN')
nc1 = nc1.replace(
    "new Date(formula.createdAt).toLocaleDateString('zh-CN')",
    "formatDate(formula.createdAt, 'zh-CN', { year:'numeric', month:'2-digit', day:'2-digit' })"
)

# L1446: new Date(formula.createdAt).toLocaleString('zh-CN')
nc1 = nc1.replace(
    "new Date(formula.createdAt).toLocaleString('zh-CN')",
    "formatDate(formula.createdAt)"
)

# L1452: new Date(formula.updatedAt).toLocaleString('zh-CN')
nc1 = nc1.replace(
    "new Date(formula.updatedAt).toLocaleString('zh-CN')",
    "formatDate(formula.updatedAt)"
)

# L1848: new Date(v.created_at).toLocaleString('zh-CN')
nc1 = nc1.replace(
    "new Date(v.created_at).toLocaleString('zh-CN')",
    "formatDate(v.created_at)"
)

# L2578: new Date(v.created_at).toLocaleDateString('zh-CN')
nc1 = nc1.replace(
    "new Date(v.created_at).toLocaleDateString('zh-CN')",
    "formatDate(v.created_at, 'zh-CN', { year:'numeric', month:'2-digit', day:'2-digit' })"
)

if nc1 != c1:
    open(fp1, "w", encoding="utf-8").write(nc1)
    print(f"  OK  FormulaDetailPage.tsx\t {len(changes)} changes")
else:
    print("  SKIP FormulaDetailPage.tsx")

# ═══════════════════════════════════════════════════════════════
# 2. ActivityTimeline.tsx — 安全日期格式化
# ═══════════════════════════════════════════════════════════════
fp2 = os.path.join(SRC, "pages/formula/components/ActivityTimeline.tsx")
c2 = open(fp2, encoding="utf-8").read()
nc2 = c2

# Add import
if "import { cn } from'@/lib/utils'" in c2 and "formatDate" not in c2:
    nc2 = c2.replace(
        "import { cn } from'@/lib/utils'",
        "import { cn, formatDate } from'@/lib/utils'"
    )
    changes.append("ActivityTimeline: added formatDate import")

# L84: new Date(activity.timestamp).toLocaleDateString(...)
nc2 = nc2.replace(
    """new Date(activity.timestamp).toLocaleDateString('zh-CN', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })""",
    """formatDate(activity.timestamp, 'zh-CN', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })"""
)

# L112: const created = new Date(formula.created_at)
nc2 = nc2.replace(
    "const created = new Date(formula.created_at)",
    "const created = new Date(formatDate(formula.created_at) !== '-' ? formula.created_at : Date.now())"
)
# This is wrong approach - need a better fix for generateMockTimeline
# Revert and use proper approach:
nc2 = c2  # reset

# Better approach for ActivityTimeline: fix generateMockTimeline to use safe dates
nc2 = c2

# Add import
if "import { cn } from'@/lib/utils'" in nc2 and "formatDate" not in nc2:
    nc2 = nc2.replace(
        "import { cn } from'@/lib/utils'",
        "import { cn, formatDate } from'@/lib/utils'"
    )

# Fix L84
nc2 = nc2.replace(
    """new Date(activity.timestamp).toLocaleDateString('zh-CN', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })""",
    """formatDate(activity.timestamp, 'zh-CN', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })"""
)

# Fix L112: const created = new Date(formula.created_at)
# Use a safe fallback
nc2 = nc2.replace(
    "const created = new Date(formula.created_at)",
    "const _createdRaw = formatDate(formula.created_at); const created = new Date(_createdRaw !== '-' ? formula.created_at : Date.now())"
)
nc2 = nc2.replace(
    "const updated = new Date(formula.updated_at)",
    "const _updatedRaw = formatDate(formula.updated_at); const updated = new Date(_updatedRaw !== '-' ? formula.updated_at : Date.now())"
)

if nc2 != c2:
    open(fp2, "w", encoding="utf-8").write(nc2)
    print(f"  OK  ActivityTimeline.tsx\t (+2)")
else:
    print("  SKIP ActivityTimeline.tsx")

# ═══════════════════════════════════════════════════════════════
# 3. FormulaQuickView.tsx — 安全日期格式化
# ═══════════════════════════════════════════════════════════════
fp3 = os.path.join(SRC, "pages/formula/components/FormulaQuickView.tsx")
c3 = open(fp3, encoding="utf-8").read()
nc3 = c3

# Add import
if "from'@/lib/utils'" in c3 and "formatDate" not in c3:
    nc3 = re.sub(
        r"from'@/lib/utils'",
        "from'@/lib/utils'; import { formatDate } from'@/lib/utils'",
        nc3
    )
    # deduplicate
    nc3 = nc3.replace(
        "from'@/lib/utils'; import { formatDate } from'@/lib/utils'",
        "from'@/lib/utils'"
    )
    # better: just add after the import line
    lines = nc3.split('\n')
    new_lines = []
    added = False
    for line in lines:
        new_lines.append(line)
        if "from'@/lib/utils'" in line and not added:
            new_lines.append("import { formatDate } from'@/lib/utils'")
            added = True
    nc3 = '\n'.join(new_lines)

# L222: new Date(formula.createdAt).toLocaleDateString('zh-CN')
nc3 = nc3.replace(
    "new Date(formula.createdAt).toLocaleDateString('zh-CN')",
    "formatDate(formula.createdAt, 'zh-CN', { year:'numeric', month:'2-digit', day:'2-digit' })"
)

if nc3 != c3:
    open(fp3, "w", encoding="utf-8").write(nc3)
    print(f"  OK  FormulaQuickView.tsx\t (+1)")
else:
    print("  SKIP FormulaQuickView.tsx")

# ═══════════════════════════════════════════════════════════════
# 4. CommentItem.tsx — 安全日期格式化
# ═══════════════════════════════════════════════════════════════
fp4 = os.path.join(SRC, "pages/formula/components/CommentItem.tsx")
c4 = open(fp4, encoding="utf-8").read()
nc4 = c4

# Add import
if "from'@/lib/utils'" in c4 and "formatDate" not in c4:
    lines = c4.split('\n')
    new_lines = []
    added = False
    for line in lines:
        new_lines.append(line)
        if "from'@/lib/utils'" in line and not added:
            new_lines.append("import { formatDate } from'@/lib/utils'")
            added = True
    nc4 = '\n'.join(new_lines)

# L83: new Date(comment.created_at).toLocaleDateString(...)
nc4 = nc4.replace(
    """new Date(comment.created_at).toLocaleDateString('zh-CN', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })""",
    """formatDate(comment.created_at, 'zh-CN', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })"""
)

# Also fix L148
nc4 = nc4.replace(
    """new Date(reply.created_at).toLocaleDateString('zh-CN', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })""",
    """formatDate(reply.created_at, 'zh-CN', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })"""
)

if nc4 != c4:
    open(fp4, "w", encoding="utf-8").write(nc4)
    print(f"  OK  CommentItem.tsx\t (+2)")
else:
    print("  SKIP CommentItem.tsx")

print("\n=== Done ===")
