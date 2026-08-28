#!/usr/bin/env python3
"""Fix remaining new Date() calls in CommentItem.tsx"""
import os

SRC = r"D:\RMFOODFP\frontend\src"
fp = os.path.join(SRC, "pages/formula/components/CommentItem.tsx")
c = open(fp, encoding="utf-8").read()

# Fix comment.created_at (line ~83-90)
old_comment = """  <span className="text-xs text-neutral-400">
  {new Date(comment.created_at).toLocaleDateString('zh-CN', {
  month:'short',
  day:'numeric',
  hour:'2-digit',
  minute:'2-digit',
  })}
  </span>"""

new_comment = """  <span className="text-xs text-text-disabled">
  {formatDate(comment.created_at, 'zh-CN', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
  </span>"""

# Fix reply.created_at (line ~148-155)
old_reply = """  <span className="text-[10px] text-neutral-400">
  {new Date(reply.created_at).toLocaleDateString('zh-CN', {
  month:'short',
  day:'numeric',
  hour:'2-digit',
  minute:'2-digit',
  })}
  </span>"""

new_reply = """  <span className="text-[10px] text-text-disabled">
  {formatDate(reply.created_at, 'zh-CN', { month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })}
  </span>"""

nc = c
if old_comment in nc:
    nc = nc.replace(old_comment, new_comment)
    print("  OK  CommentItem: comment.created_at fixed")
else:
    print("  SKIP CommentItem: comment pattern not matched")
    # Show what's actually there
    idx = nc.find('comment.created_at')
    if idx >= 0:
        print(f"    Found at offset {idx}, context: ...{repr(nc[max(0,idx-40):idx+100])}...")

if old_reply in nc:
    nc = nc.replace(old_reply, new_reply)
    print("  OK  CommentItem: reply.created_at fixed")
else:
    print("  SKIP CommentItem: reply pattern not matched")
    idx = nc.find('reply.created_at')
    if idx >= 0:
        print(f"    Found at offset {idx}, context: ...{repr(nc[max(0,idx-40):idx+100])}...")

if nc != c:
    open(fp, "w", encoding="utf-8").write(nc)
    print("  File written")
else:
    print("  No changes made")
