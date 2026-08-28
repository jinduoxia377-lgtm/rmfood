#!/usr/bin/env python3
"""Fix remaining new Date() calls in CommentItem.tsx using regex"""
import re, os

SRC = r"D:\RMFOODFP\frontend\src"
fp = os.path.join(SRC, "pages/formula/components/CommentItem.tsx")
c = open(fp, encoding="utf-8").read()
nc = c

# Fix comment.created_at: multi-line new Date(...) → formatDate(...)
pattern1 = re.compile(
    r'<span className="text-xs text-neutral-400">\s*\n\s*\{new Date\(comment\.created_at\)\.toLocaleDateString\([^)]+\)\}\s*\n\s*</span>',
    re.DOTALL
)
m1 = pattern1.search(nc)
if m1:
    nc = nc[:m1.start()] + '  <span className="text-xs text-text-disabled">\n  {formatDate(comment.created_at, \'zh-CN\', { month:\'short\', day:\'numeric\', hour:\'2-digit\', minute:\'2-digit\' })}\n  </span>' + nc[m1.end():]
    print("  OK  CommentItem: comment.created_at fixed")
else:
    print("  SKIP comment.created_at")

# Fix reply.created_at
pattern2 = re.compile(
    r'<span className="text-\[10px\] text-neutral-400">\s*\n\s*\{new Date\(reply\.created_at\)\.toLocaleDateString\([^)]+\)\}\s*\n\s*</span>',
    re.DOTALL
)
m2 = pattern2.search(nc)
if m2:
    nc = nc[:m2.start()] + '  <span className="text-[10px] text-text-disabled">\n  {formatDate(reply.created_at, \'zh-CN\', { month:\'short\', day:\'numeric\', hour:\'2-digit\', minute:\'2-digit\' })}\n  </span>' + nc[m2.end():]
    print("  OK  CommentItem: reply.created_at fixed")
else:
    print("  SKIP reply.created_at")

if nc != c:
    open(fp, "w", encoding="utf-8").write(nc)
    print("  File written")
else:
    print("  No changes")
