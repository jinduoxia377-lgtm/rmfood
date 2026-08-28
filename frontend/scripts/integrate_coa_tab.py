"""Apply COA tab integration to DatabasePage.tsx - fixed patterns"""
path = r'src\pages\database\DatabasePage.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

original = content

# 1. Add FileText to lucide imports
content = content.replace(
    "   Minus,\n} from 'lucide-react'",
    "   Minus,\n   FileText,\n} from 'lucide-react'"
)

# 2. Add COAsTab import
content = content.replace(
    "import SearchAnalyticsDashboard from './tabs/SearchAnalyticsDashboard';",
    "import SearchAnalyticsDashboard from './tabs/SearchAnalyticsDashboard';\nimport COAsTab from './tabs/COAsTab';"
)

# 3. Add 'coa' to DbTab type
content = content.replace(
    "type DbTab = 'dashboard' | 'herbs' | 'peptides' | 'graph' | 'homology' | 'food_materials' | 'retail_products' | 'analytics' | 'sync';",
    "type DbTab = 'dashboard' | 'herbs' | 'peptides' | 'graph' | 'homology' | 'food_materials' | 'retail_products' | 'analytics' | 'sync' | 'coa';"
)

# 4. Add 'coa' to tabs keyboard shortcut array
content = content.replace(
    "const tabs: DbTab[] = ['dashboard', 'herbs', 'peptides', 'graph', 'homology', 'food_materials', 'retail_products', 'analytics', 'sync'];",
    "const tabs: DbTab[] = ['dashboard', 'herbs', 'peptides', 'graph', 'homology', 'food_materials', 'retail_products', 'analytics', 'sync', 'coa'];"
)

# 5. Add COA tab label in the stats cards (check exact format)
content = content.replace(
    "{ value: 'sync' as DbTab, label: '数据管理', icon: RefreshCw, badge: null },",
    "{ value: 'sync' as DbTab, label: '数据管理', icon: RefreshCw, badge: null },\n            { value: 'coa' as DbTab, label: 'COA报告', icon: FileText, badge: null },"
)

# 6. Add COA TabsContent before closing </Tabs>
content = content.replace(
    '        <TabsContent value="sync" className="animate-fade-in">\n          <DataManagementTab />\n        </TabsContent>\n      </Tabs>',
    '        <TabsContent value="sync" className="animate-fade-in">\n          <DataManagementTab />\n        </TabsContent>\n        <TabsContent value="coa" className="animate-fade-in">\n          <COAsTab />\n        </TabsContent>\n      </Tabs>'
)

if content == original:
    print("ERROR: No changes made")
    # Debug
    debug_patterns = [
        ("Minus import", "   Minus,\n} from 'lucide-react'"),
        ("SearchAnalytics import", "import SearchAnalyticsDashboard"),
        ("DbTab type", "type DbTab = 'dashboard'"),
        ("tabs array", "const tabs: DbTab[]"),
        ("sync label", "{ value: 'sync' as DbTab"),
        ("sync TabsContent", 'value="sync" className="animate-fade-in"'),
    ]
    for name, pat in debug_patterns:
        found = pat in original
        print(f"  {'FOUND' if found else 'NOT FOUND'}: {name}")
else:
    print(f"Applied changes successfully")
    with open(path, 'w', encoding='utf-8') as f:
        f.write(content)

checks = [
    ("FileText import", "FileText" in content),
    ("COAsTab import", "COAsTab" in content),
    ("DbTab coa", "'coa'" in content),
    ("COA tab label", "COA报告" in content),
    ("COA TabsContent", "<COAsTab" in content),
]
print("\nVerification:")
for name, ok in checks:
    print(f"  {'OK' if ok else 'FAIL'}: {name}")
