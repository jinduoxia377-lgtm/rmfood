# Batch 13: Fix remaining safe as any casts

files_fixed = []

# ========== eventSourcing.ts ==========
path = 'components/ai/features/utils/eventSourcing.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
orig = content
# This is a callback that returns typed data - need to check context
# Keep as any for now (third-party callback)
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print(f'eventSourcing: skipped')

# ========== PermissionMatrix.tsx ==========
path = 'pages/organizations/components/PermissionMatrix.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
orig = content
content = content.replace('setData(result as any)', 'setData(result as unknown)')
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
if orig != content: files_fixed.append('PermissionMatrix')

# ========== useExport.ts ==========
path = 'hooks/useExport.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
orig = content
content = content.replace('(doc as any).autoTable', '(doc as unknown as Record<string, unknown>).autoTable')
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
if orig != content: files_fixed.append('useExport')

# ========== ApiKeyConfigCenter.tsx ==========
path = 'components/ai/features/components/ApiKeyConfigCenter.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
orig = content
content = content.replace('[keyId]: undefined as any', '[keyId]: undefined')
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
if orig != content: files_fixed.append('ApiKeyConfigCenter')

# ========== FormulaComparison.tsx ==========
path = 'components/formula/FormulaComparison.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
orig = content
content = content.replace('(f.data[0] as any)?.[metric]', '(f.data[0] as Record<string, unknown>)?.[metric] as number')
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
if orig != content: files_fixed.append('FormulaComparison')

# ========== FormulaSharePanel.tsx ==========
path = 'components/ai/FormulaSharePanel.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
orig = content
content = content.replace('t as any', 't as unknown')
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
if orig != content: files_fixed.append('FormulaSharePanel')

# ========== StateCoordinator.ts ==========
path = 'components/ai/features/state/StateCoordinator.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
orig = content
content = content.replace('new Set<StateChangeListener<K>>() as any', 'new Set<StateChangeListener<K>>()')
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
if orig != content: files_fixed.append('StateCoordinator')

# ========== HeaderPro.tsx ==========
path = 'components/ai/features/GenerateTab/components/HeaderPro.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
orig = content
# Keep as any for Badge variant - type is too complex
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
print(f'HeaderPro: skipped')

# ========== operationLogger.ts ==========
path = 'utils/operationLogger.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
orig = content
content = content.replace('payload as any', 'payload as Record<string, unknown>')
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
if orig != content: files_fixed.append('operationLogger')

# ========== FoodMaterialSearchPanel.tsx ==========
path = 'pages/database/tabs/FoodMaterialSearchPanel.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
orig = content
content = content.replace('const r = resp as any', 'const r = resp as Record<string, unknown>')
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
if orig != content: files_fixed.append('FoodMaterialSearchPanel')

# ========== DatabasePage.tsx ==========
path = 'pages/database/DatabasePage.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
orig = content
content = content.replace('config.variant as any', 'config.variant as "default" | "secondary" | "destructive" | "outline" | "success" | "warning" | "info" | "danger" | "neutral" | "primary"')
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
if orig != content: files_fixed.append('DatabasePage')

# ========== ThemeImport.tsx ==========
path = 'theme/ThemeImport.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
orig = content
content = content.replace('applyCustomTheme(config as any)', 'applyCustomTheme(config as Record<string, unknown>)')
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
if orig != content: files_fixed.append('ThemeImport')

# ========== GeneticAlgorithmPanel.tsx ==========
path = 'components/ai/features/GeneticAlgorithmPanel.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
orig = content
content = content.replace('setResult(data as any)', 'setResult(data as unknown)')
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
if orig != content: files_fixed.append('GeneticAlgorithmPanel')

# ========== PeptidesTab.tsx ==========
path = 'pages/database/tabs/PeptidesTab.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
orig = content
content = content.replace('let arr = [...raw] as any[]', 'let arr = [...raw] as Record<string, unknown>[]')
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
if orig != content: files_fixed.append('PeptidesTab')

# ========== ImportPanel.tsx ==========
path = 'components/import/ImportPanel.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
orig = content
content = content.replace('onFileSelect(null as any)', 'onFileSelect(null as File | null)')
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
if orig != content: files_fixed.append('ImportPanel')

# ========== persistentStore.ts ==========
path = 'utils/persistentStore.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
orig = content
content = content.replace('key as any', 'key as string')
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
if orig != content: files_fixed.append('persistentStore')

# ========== COAsTab.tsx ==========
path = 'pages/database/tabs/COAsTab.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
orig = content
content = content.replace('return (resp as any)?.data ?? resp', 'return (resp as { data?: unknown } | null)?.data ?? resp')
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
if orig != content: files_fixed.append('COAsTab')

# ========== useExportManager.ts ==========
path = 'components/ai/features/hooks/useExportManager.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
orig = content
content = content.replace("return eventBus.subscribe('export:started' as any, (payload: any) => {", "return eventBus.subscribe('export:started', (payload: unknown) => {")
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
if orig != content: files_fixed.append('useExportManager')

# ========== ExperimentEditPage.tsx ==========
path = 'pages/experiment/ExperimentEditPage.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
orig = content
content = content.replace("{ name: trimmed, status: 'available' } as any", "{ name: trimmed, status: 'available' } as Record<string, unknown>")
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
if orig != content: files_fixed.append('ExperimentEditPage')

# ========== useOptimizedComponents.ts ==========
path = 'hooks/useOptimizedComponents.ts'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
orig = content
content = content.replace('comparator as any', 'comparator as (a: T, b: T) => boolean')
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
if orig != content: files_fixed.append('useOptimizedComponents')

# ========== PerformanceOptimizer.tsx ==========
path = 'components/analytics/PerformanceOptimizer.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
orig = content
content = content.replace('(performance as any).memory', '(performance as { memory?: { usedJSHeapSize?: number; totalJSHeapSize?: number; jsHeapSizeLimit?: number } }).memory')
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
if orig != content: files_fixed.append('PerformanceOptimizer')

# ========== HerbDetailContent.tsx ==========
path = 'pages/database/HerbDetailContent.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
orig = content
content = content.replace('setActiveTab(key as any)', 'setActiveTab(key as string)')
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
if orig != content: files_fixed.append('HerbDetailContent')

# ========== AdvancedFilter.tsx ==========
path = 'components/ai/features/components/AdvancedFilter.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
orig = content
content = content.replace('grade as any', 'grade as string')
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
if orig != content: files_fixed.append('AdvancedFilter')

# ========== GenerationProgress.tsx ==========
path = 'components/ai/features/GenerationProgress.tsx'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()
orig = content
content = content.replace('style={{ borderColor: `var(--tw-${stageInfo.color}-200, rgb(229, 231, 235))` } as any}', 'style={{ borderColor: `var(--tw-${stageInfo.color}-200, rgb(229, 231, 235))` }}')
with open(path, 'w', encoding='utf-8') as f:
    f.write(content)
if orig != content: files_fixed.append('GenerationProgress')

print(f'\nFixed files: {", ".join(files_fixed)}')
