# -*- coding: utf-8 -*-
"""Fix frontend TS errors"""
import re

# Fix MainLayout.tsx
path1 = 'D:/RMFOODFP/frontend/src/components/layout/MainLayout.tsx'
with open(path1, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove the extra </div> before );
content = content.replace(' <CommandPalette />\n </div>\n  </div>\n );', ' <CommandPalette />\n </div>\n );')
with open(path1, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print(f"MainLayout.tsx fixed")

# Fix FormulaTemplatesPage.tsx
path2 = 'D:/RMFOODFP/frontend/src/pages/formula/FormulaTemplatesPage.tsx'
with open(path2, 'r', encoding='utf-8') as f:
    content = f.read()

# Remove duplicate lines with literal \n
content = content.replace(
    "  const [templates, setTemplates] = useState<FormulaTemplate[]>([])\n  const [loading, setLoading] = useState(true)\\n  const [templates, setTemplates] = useState<FormulaTemplate[]>([])\\n  const [loading, setLoading] = useState(true)",
    "  const [templates, setTemplates] = useState<FormulaTemplate[]>([])\n  const [loading, setLoading] = useState(true)"
)
with open(path2, 'w', encoding='utf-8', newline='\n') as f:
    f.write(content)
print(f"FormulaTemplatesPage.tsx fixed")

print("Done")
