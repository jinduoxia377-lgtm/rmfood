"""Fix typography.ts and ai.icons.tsx remaining TS errors."""
from pathlib import Path
import re

# ──────────────────────────────────────────────
# 1. typography.ts — fix FONT_SIZES/LINE_HEIGHTS any indexing
# ──────────────────────────────────────────────
p = Path(r'src/utils/typography.ts')
s = p.read_text(encoding='utf-8')

# Replace FONT_SIZES['xxx' as any] with (FONT_SIZES as Record<string,string>)['xxx']
s = re.sub(
    r"FONT_SIZES\['([^']+)'(?:\s*as\s*any)?\]",
    r"(FONT_SIZES as Record<string, string>)['\1']",
    s
)

# Replace LINE_HEIGHTS['xxx' as keyof typeof LINE_HEIGHTS] with proper cast
s = re.sub(
    r"LINE_HEIGHTS\['([^']+)'(?:\s*as\s*keyof\s*typeof\s*LINE_HEIGHTS)?\]",
    r"(LINE_HEIGHTS as Record<string, string>)['\1']",
    s
)

p.write_text(s, encoding='utf-8')
print("[1] typography.ts: fixed FONT_SIZES/LINE_HEIGHTS any indexing")

# ──────────────────────────────────────────────
# 2. ai.icons.tsx — cast AIIcons values to ComponentType
# ──────────────────────────────────────────────
p = Path(r'src/config/ai.icons.tsx')
s = p.read_text(encoding='utf-8')

# Cast the AIIcons object to allow ForwardRefExoticComponent assignment
# Change: export const AIIcons = { ... } as const
# To: export const AIIcons = { ... } as const as Record<AIIconName, ComponentType<...>>
old = "export const AIIcons = {"
new = "export const AIIcons = {"
# Instead, add a type assertion on the getAIIcon return
old_ret = "return (AIIcons[name] || Circle) as ComponentType<{ className?: string; size?: number }>;"
new_ret = "return (AIIcons[name] as ComponentType<{ className?: string; size?: number }> || Circle) as ComponentType<{ className?: string; size?: number }>;"
if old_ret in s:
    s = s.replace(old_ret, new_ret)
    p.write_text(s, encoding='utf-8')
    print("[2] ai.icons.tsx: getAIIcon return cast fixed")
else:
    # Alternative: cast the whole AIIcons object
    if "as const" in s and "AIIcons" in s:
        # Find the closing of AIIcons object and add type assertion
        s = re.sub(
            r"(export const AIIcons = \{[^}]+\})\s*as const",
            r"\1 as unknown as Record<AIIconName, ComponentType<{ className?: string; size?: number }>>",
            s,
            flags=re.DOTALL
        )
        p.write_text(s, encoding='utf-8')
        print("[2] ai.icons.tsx: AIIcons object type assertion added")
    else:
        print("[2] ai.icons.tsx: pattern not found, skipping")

print("Done.")
