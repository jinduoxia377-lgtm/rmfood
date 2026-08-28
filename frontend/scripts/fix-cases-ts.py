#!/usr/bin/env python3
"""Fix FormulaCasesPage + FormulaCaseDetailPage TypeScript errors"""
import re, os

SRC = r"D:\RMFOODFP\frontend\src"

# ═══════════════════════════════════════════════════════════════
# FormulaCasesPage.tsx
# ═══════════════════════════════════════════════════════════════
fp = os.path.join(SRC, "pages/formula/FormulaCasesPage.tsx")
c = open(fp, encoding="utf-8").read()

# Fix 1: Badge variant="secondary" → "info"
c = c.replace('variant="secondary"', 'variant="info"')

# Fix 2: Badge variant="outline" → "neutral"
c = c.replace('variant="outline"', 'variant="neutral"')

# Fix 3: Select onChange — add explicit type annotation to avoid ChangeEvent generic inference
# Pattern: onChange={(e) => setParams(prev => ({ ..., sort_by: e.target.value, ...}))}
# Add : React.ChangeEvent<HTMLSelectElement> = 
c = re.sub(
    r'onChange=\{\(e\) => setParams',
    'onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setParams',
    c
)
# Also fix the sort_dir cast line
c = c.replace(
    "sort_dir: e.target.value as 'asc' | 'desc'",
    "sort_dir: (e.target.value || 'desc') as 'asc' | 'desc'"
)

open(fp, "w", encoding="utf-8").write(c)
print(f"  OK  FormulaCasesPage.tsx")

# ═══════════════════════════════════════════════════════════════
# FormulaCaseDetailPage.tsx
# ═══════════════════════════════════════════════════════════════
fp = os.path.join(SRC, "pages/formula/FormulaCaseDetailPage.tsx")
c = open(fp, encoding="utf-8").read()

# Fix 1: Remove unused sonner import (L31 — addToast already imported from toastStore)
c = re.sub(r"import\s+{\s*toast\s*}\s+from\s+'sonner'\s*\n?", "", c)
# Also remove the import line if it's the only import from sonner
c = re.sub(r"^import.*?from\s+'sonner'\s*$\n?", "", c, flags=re.MULTILINE)
c = re.sub(r"\n\s*import\s+{\s*toast\s*}\s+from\s+'sonner'\s*", "\n", c)
c = re.sub(r"import\s+{\s*toast\s*}\s+from\s+'sonner'\s*\n?", "", c)

# Fix 2: Badge variant="outline" → "neutral"
c = c.replace('variant="outline"', 'variant="neutral"')

# Fix 3: Badge variant="secondary" (in tags) → "neutral"
# Need to be careful — there may be multiple. The one in tags section should be neutral.
# The one for "AI生成" is already fixed above (outline→neutral).
# Tags badge: variant="secondary" → "neutral"
c = c.replace('variant="secondary"{tag}', 'variant="neutral"{tag}')
# Fallback: if there's still a variant="secondary" for Badge, change to neutral
c = re.sub(r'<Badge[^>]*variant="secondary"', '<Badge variant="neutral"', c)

# Fix 4: Button variant="destructive" → "danger"
c = c.replace('variant="destructive"', 'variant="danger"')

open(fp, "w", encoding="utf-8").write(c)
print(f"  OK  FormulaCaseDetailPage.tsx")

print("\n=== Done ===")
