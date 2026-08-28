#!/usr/bin/env python3
"""Fix CommentItem.tsx remaining Date calls and also fix ActivityTimeline L112-113"""
import os

SRC = r"D:\RMFOODFP\frontend\src"

# ─── CommentItem.tsx ───
fp = os.path.join(SRC, "pages/formula/components/CommentItem.tsx")
c = open(fp, encoding="utf-8").read()
nc = c

# Fix comment.created_at date display (lines 83-90)
old1 = """  <span className="text-xs text-neutral-400">
  {new Date(comment.created_at).toLocaleDateString('zh-CN', {
  month:'short',
  day:'numeric',
  hour:'2-digit',
  minute:'2-digit',
  })}
  </span>"""
new1 = """  <span className="text-xs text-text-disabled">
  {formatDate(comment.created_at, 'zh-CN', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
  </span>"""
if old1 in nc:
    nc = nc.replace(old1, new1)
    print("  OK  CommentItem: comment.created_at fixed")
else:
    print("  SKIP CommentItem: comment.created_at pattern not found (may already be fixed)")

# Fix reply.created_at date display (lines 148-155)
old2 = """  <span className="text-[10px] text-neutral-400">
  {new Date(reply.created_at).toLocaleDateString('zh-CN', {
  month:'short',
  day:'numeric',
  hour:'2-digit',
  minute:'2-digit',
  })}
  </span>"""
new2 = """  <span className="text-[10px] text-text-disabled">
  {formatDate(reply.created_at, 'zh-CN', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
  </span>"""
if old2 in nc:
    nc = nc.replace(old2, new2)
    print("  OK  CommentItem: reply.created_at fixed")
else:
    print("  SKIP CommentItem: reply.created_at pattern not found")

if nc != c:
    open(fp, "w", encoding="utf-8").write(nc)
else:
    print("  SKIP CommentItem: no changes")

# ─── ActivityTimeline.tsx — fix L112-113 generateMockTimeline safe dates ───
fp2 = os.path.join(SRC, "pages/formula/components/ActivityTimeline.tsx")
c2 = open(fp2, encoding="utf-8").read()
nc2 = c2

# The current fix is overly complex; simplify to use safe fallback
old3 = """const _createdRaw = formatDate(formula.created_at); const created = new Date(_createdRaw !== '-' ? formula.created_at : Date.now())"""
new3 = """const created = new Date(formula.created_at || Date.now())"""
nc2 = nc2.replace(old3, new3)

old4 = """const _updatedRaw = formatDate(formula.updated_at); const updated = new Date(_updatedRaw !== '-' ? formula.updated_at : Date.now())"""
new4 = """const updated = new Date(formula.updated_at || Date.now())"""
nc2 = nc2.replace(old4, new4)

if nc2 != c2:
    open(fp2, "w", encoding="utf-8").write(nc2)
    print("  OK  ActivityTimeline: simplified generated dates")
else:
    print("  SKIP ActivityTimeline: no changes")

print("\n=== Done ===")
