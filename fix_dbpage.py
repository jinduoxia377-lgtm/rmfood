import re

filepath = "D:/RMFOODFP/frontend/src/pages/database/DatabasePage.tsx"
with open(filepath, "r", encoding="utf-8") as f:
    content = f.read()

# 1. Remove ViewMode type
content = content.replace("type ViewMode = 'overview' | 'compact' | 'detailed';\n", "")

# 2. Remove STORAGE_KEY_VIEW_MODE
content = content.replace("const STORAGE_KEY_VIEW_MODE = 'db_view_mode';\n", "")

# 3. Remove viewMode state
content = re.sub(r"  const \[viewMode, setViewMode\] = useState<ViewMode>\(\(\) => \{[\s\S]*?\}\);\n\n", "", content)

# 4. Remove handleViewModeChange
content = re.sub(r"  const handleViewModeChange = useCallback\(.*?}, \[\]\);\n\n", "", content, flags=re.DOTALL)

# 5. Remove LayoutDashboard, LayoutList, LayoutGrid from imports
content = re.sub(r"  LayoutDashboard,\n  LayoutList,\n  LayoutGrid,\n", "", content)

# 6. Remove viewMode from dependencies
content = content.replace("    viewMode,\n", "")

# 7. Change grid gap
content = content.replace("className={`grid gap-2.5 ${", "className={`grid gap-4 ${")

# 8. Simplify grid class - remove ternary
content = re.sub(
    r"\s*\? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'\s*\n\s*:\s*viewMode === 'compact'\s*\n\s*\?\s*'grid-cols-3 md:grid-cols-6'\s*\n\s*:\s*'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'",
    "            ? 'grid-cols-2 md:grid-cols-3 lg:grid-cols-6'",
    content
)

# 9. Remove the viewMode toggle buttons div
content = re.sub(
    r"        /\* 左侧：视图切换 \*/[\s\S]*?        </div>\n\n",
    "",
    content
)

# 10. Remove StatCardConfig interface
content = re.sub(
    r"interface StatCardConfig \{[\s\S]*?\}\n\n",
    "",
    content
)

# 11. Remove local StatCard component
content = re.sub(
    r"// ─── 统计卡片组件 ───[\s\S]*?^}\n",
    "",
    content,
    flags=re.MULTILINE
)

# 12. Remove ArrowUp, ArrowDown, Minus from imports
content = re.sub(r"  ArrowUp,\n  ArrowDown,\n  Minus,\n", "", content)

# 13. Add Card imports to existing import
content = content.replace(
    "import { PageHeader, Badge, Tabs, Tooltip, TabsList, TabsTrigger, TabsContent, useToast } from '@/components/ui';",
    "import { PageHeader, Badge, Tabs, Tooltip, TabsList, TabsTrigger, TabsContent, useToast, Card, CardHeader, CardTitle, CardContent } from '@/components/ui';"
)

# 14. Replace statCardsConfig useMemo
old_pattern = r"  const statCardsConfig = useMemo\([\s\S]*?\),\n    \[herbCount, peptideCount, graphNodes, homologyCount, stats, todayQueries\],\n  \);"
new_config = """  const statCardsConfig = useMemo(
    () => [
      { label: '中药材', value: herbCount, icon: Database, variant: 'primary' as const, size: 'default' as const },
      { label: '活性肽', value: peptideCount, icon: Activity, variant: 'secondary' as const, size: 'default' as const },
      { label: '图谱节点', value: graphNodes.total_herbs + graphNodes.total_compounds + graphNodes.total_targets, icon: Layers, variant: 'info' as const, size: 'default' as const },
      { label: '药食同源', value: homologyCount, icon: Zap, variant: 'success' as const, size: 'default' as const },
      { label: '配伍关系', value: stats?.knowledge_graph?.herb_interactions ?? 0, icon: TrendingUp, variant: 'warning' as const, size: 'default' as const },
      { label: '今日查询', value: todayQueries, icon: Eye, variant: 'primary' as const, size: 'default' as const },
    ],
    [herbCount, peptideCount, graphNodes, homologyCount, stats, todayQueries],
  );"""
content = re.sub(old_pattern, new_config, content)

# 15. Replace StatCard usage with Card
content = content.replace(
    "<StatCard key={config.label} config={config} onClick={() => setTab(config.tab)} />",
    "<Card key={config.label} className=\"h-full px-5 py-4 cursor-pointer hover:shadow-lg hover:-translate-y-0.5 transition-all\" onClick={() => {\n        if (config.label === '中药材') setTab('herbs');\n        else if (config.label === '活性肽') setTab('peptides');\n        else if (config.label === '图谱节点') setTab('graph');\n        else if (config.label === '药食同源') setTab('homology');\n        else if (config.label === '配伍关系') setTab('graph');\n        else setTab('dashboard');\n      }}>"
)

# 16. Close Card wrapper after the mapping
content = content.replace(
    "          ))}\n      </div>",
    "            </Card>\n          ))}\n      </div>"
)

with open(filepath, "w", encoding="utf-8") as f:
    f.write(content)

print("DatabasePage.tsx fixed successfully")
