# 专业清理硬编码颜色脚本
# 功能：将 CSS 文件中的硬编码颜色替换为 CSS 变量

param(
    [string]$SourcePath = "src",
    [switch]$DryRun = $false
)

# 定义颜色映射表（无重复键）
$colorMapping = @{
    # 绿色系
    '#10B981' = 'var(--color-success-500)'
    '#34D399' = 'var(--color-success-400)'
    '#6EE7B7' = 'var(--color-success-300)'
    '#059669' = 'var(--color-success-600)'
    '#047857' = 'var(--color-success-700)'
    '#064E3B' = 'var(--color-success-900)'
    '#022C22' = 'var(--color-success-950)'
    '#22C55E' = 'var(--color-green-500)'
    '#16A34A' = 'var(--color-green-600)'
    '#4ADE80' = 'var(--color-green-400)'
    '#166534' = 'var(--color-green-900)'
    '#34C759' = 'var(--color-apple-green)'
    '#52C41A' = 'var(--color-success-static)'
    '#248A3D' = 'var(--color-green-dark)'
    '#065F46' = 'var(--color-green-800)'
    '#2D4A3D' = 'var(--color-green-muted)'
    '#A7F3D0' = 'var(--color-green-light)'
    '#D1FAE5' = 'var(--color-green-surface)'
    '#ECFDF5' = 'var(--color-green-bg)'
    '#F0FDF4' = 'var(--color-green-pale)'
    
    # 中性色系 - Slate
    '#0F172A' = 'var(--color-slate-900)'
    '#1E293B' = 'var(--color-slate-800)'
    '#334151' = 'var(--color-slate-700)'
    '#475569' = 'var(--color-slate-600)'
    '#64748B' = 'var(--color-slate-500)'
    '#94A3B8' = 'var(--color-slate-400)'
    '#CBD5E1' = 'var(--color-slate-300)'
    '#E2E8F0' = 'var(--color-slate-200)'
    '#F1F5F9' = 'var(--color-slate-100)'
    '#F8FAFC' = 'var(--color-slate-50)'
    
    # 中性色系 - Gray
    '#6B7280' = 'var(--color-gray-500)'
    '#9CA3AF' = 'var(--color-gray-400)'
    '#4B5563' = 'var(--color-gray-600)'
    '#1F2937' = 'var(--color-gray-800)'
    '#111827' = 'var(--color-gray-900)'
    '#374151' = 'var(--color-gray-700)'
    '#D1D5DB' = 'var(--color-gray-300)'
    '#E5E7EB' = 'var(--color-gray-200)'
    '#F3F4F6' = 'var(--color-gray-100)'
    '#F9FAFB' = 'var(--color-gray-50)'
    '#999' = 'var(--color-gray-mid)'
    '#666' = 'var(--color-gray-dark)'
    '#333' = 'var(--color-gray-darker)'
    '#888' = 'var(--color-gray-light-mid)'
    '#aaa' = 'var(--color-gray-lighter)'
    '#bbb' = 'var(--color-gray-light)'
    '#ddd' = 'var(--color-gray-pale)'
    '#e0e0e0' = 'var(--color-gray-very-light)'
    '#f0f0f0' = 'var(--color-gray-surface)'
    '#f5f5f5' = 'var(--color-gray-bg)'
    '#fafafa' = 'var(--color-gray-warm)'
    '#F5F5F5' = 'var(--color-gray-warm-light)'
    '#F0F0F0' = 'var(--color-gray-steel)'
    '#E8E8E8' = 'var(--color-gray-border)'
    '#D9D9D9' = 'var(--color-gray-input)'
    '#a0a0a0' = 'var(--color-gray-text)'
    '#A0AEC0' = 'var(--color-gray-cool)'
    '#B8C4D0' = 'var(--color-gray-blue)'
    '#BDBDBD' = 'var(--color-gray-disabled)'
    '#788296' = 'var(--color-gray-muted)'
    '#4A5568' = 'var(--color-gray-rich)'
    '#495057' = 'var(--color-gray-input-text)'
    
    # 功能色 - Red/Error
    '#EF4444' = 'var(--color-red-500)'
    '#F87171' = 'var(--color-red-400)'
    '#DC2626' = 'var(--color-red-600)'
    '#FCA5A5' = 'var(--color-red-300)'
    '#FEE2E2' = 'var(--color-red-100)'
    '#991B1B' = 'var(--color-red-900)'
    '#7F1D1D' = 'var(--color-red-950)'
    '#C62828' = 'var(--color-red-bold)'
    '#B91C1C' = 'var(--color-red-deep)'
    '#FF4D4F' = 'var(--color-red-vibrant)'
    '#FF6961' = 'var(--color-red-soft)'
    '#FF877A' = 'var(--color-red-pale)'
    '#FECACA' = 'var(--color-red-surface)'
    '#FFF5F5' = 'var(--color-red-bg)'
    '#FFF0F0' = 'var(--color-red-light)'
    '#FFE3E3' = 'var(--color-red-border)'
    '#FF453A' = 'var(--color-red-apple)'
    '#FF3B30' = 'var(--color-red-ios)'
    '#D70015' = 'var(--color-red-brand)'
    '#C1000F' = 'var(--color-red-dark-brand)'
    
    # 功能色 - Yellow/Warning
    '#F59E0B' = 'var(--color-yellow-500)'
    '#FBBF24' = 'var(--color-yellow-400)'
    '#D97706' = 'var(--color-yellow-600)'
    '#FCD34D' = 'var(--color-yellow-300)'
    '#FEF3C7' = 'var(--color-yellow-100)'
    '#FDE68A' = 'var(--color-yellow-surface)'
    '#FFFBEB' = 'var(--color-yellow-bg)'
    '#EAB308' = 'var(--color-yellow-bold)'
    '#CA8A04' = 'var(--color-yellow-dark)'
    '#92400E' = 'var(--color-yellow-deep)'
    '#451A03' = 'var(--color-yellow-darkest)'
    '#FFB84D' = 'var(--color-yellow-soft)'
    '#FFC107' = 'var(--color-yellow-material)'
    
    # 功能色 - Blue/Info
    '#3B82F6' = 'var(--color-blue-500)'
    '#60A5FA' = 'var(--color-blue-400)'
    '#2563EB' = 'var(--color-blue-600)'
    '#93C5FD' = 'var(--color-blue-300)'
    '#DBEAFE' = 'var(--color-blue-100)'
    '#EFF6FF' = 'var(--color-blue-surface)'
    '#F0F9FF' = 'var(--color-blue-bg)'
    '#0EA5E9' = 'var(--color-sky-500)'
    '#38BDF8' = 'var(--color-sky-400)'
    '#0284C7' = 'var(--color-sky-600)'
    '#0369A1' = 'var(--color-sky-dark)'
    '#075985' = 'var(--color-sky-deep)'
    '#0C4A6E' = 'var(--color-sky-darkest)'
    '#1D4ED8' = 'var(--color-blue-bold)'
    '#1E40AF' = 'var(--color-blue-deep)'
    '#172554' = 'var(--color-blue-darkest)'
    '#005AC5' = 'var(--color-blue-apple)'
    '#1890FF' = 'var(--color-blue-antd)'
    '#0A84FF' = 'var(--color-blue-ios)'
    '#007AFF' = 'var(--color-blue-system)'
    '#7AB8FF' = 'var(--color-blue-soft)'
    
    # 紫色/Violet
    '#8B5CF6' = 'var(--color-violet-500)'
    '#A78BFA' = 'var(--color-violet-400)'
    '#7C3AED' = 'var(--color-violet-600)'
    '#C4B5FD' = 'var(--color-violet-300)'
    '#EDE9FE' = 'var(--color-violet-100)'
    '#DDD6FE' = 'var(--color-violet-surface)'
    '#F3E8FF' = 'var(--color-violet-bg)'
    '#FAF5FF' = 'var(--color-violet-pale)'
    '#9333EA' = 'var(--color-purple-600)'
    '#A855F7' = 'var(--color-purple-500)'
    '#C084FC' = 'var(--color-purple-400)'
    '#6D28D9' = 'var(--color-purple-dark)'
    '#5B21B6' = 'var(--color-purple-deep)'
    '#3B0764' = 'var(--color-purple-darkest)'
    '#4F46E5' = 'var(--color-indigo-600)'
    '#6366F1' = 'var(--color-indigo-500)'
    '#818CF8' = 'var(--color-indigo-400)'
    '#C7D2FE' = 'var(--color-indigo-200)'
    '#EEF2FF' = 'var(--color-indigo-100)'
    '#4338CA' = 'var(--color-indigo-dark)'
    '#232340' = 'var(--color-indigo-darkest)'
    '#33335A' = 'var(--color-indigo-muted)'
    '#D4A5FF' = 'var(--color-purple-soft)'
    '#BF6DE0' = 'var(--color-purple-warm)'
    '#AF52DE' = 'var(--color-purple-old)'
    
    # 粉色/Pink
    '#EC4899' = 'var(--color-pink-500)'
    '#F472B6' = 'var(--color-pink-400)'
    '#DB2777' = 'var(--color-pink-600)'
    '#FBCFE8' = 'var(--color-pink-200)'
    '#FCE7F3' = 'var(--color-pink-100)'
    '#FFF0F5' = 'var(--color-pink-bg)'
    
    # 橙色/Orange
    '#FB923C' = 'var(--color-orange-400)'
    '#F97316' = 'var(--color-orange-500)'
    '#EA580C' = 'var(--color-orange-600)'
    '#C2410C' = 'var(--color-orange-700)'
    '#FFEDD5' = 'var(--color-orange-100)'
    '#FFF7ED' = 'var(--color-orange-bg)'
    '#C27800' = 'var(--color-orange-old)'
    '#C25E00' = 'var(--color-orange-deep)'
    '#B45309' = 'var(--color-orange-darker)'
    '#78350F' = 'var(--color-orange-darkest)'
    
    # 白色/黑色
    '#FFFFFF' = 'var(--color-white)'
    '#ffffff' = 'var(--color-white)'
    '#FFF' = 'var(--color-white-short)'
    '#fff' = 'var(--color-white-short)'
    '#FEFEFE' = 'var(--color-white-pure)'
    '#FDFEFE' = 'var(--color-white-warm)'
    '#FAFAFA' = 'var(--color-white-smoke)'
    '#FAF9F9' = 'var(--color-white-paper)'
    '#FAFAF9' = 'var(--color-white-zinc)'
    '#F5F5F4' = 'var(--color-white-stone)'
    '#000000' = 'var(--color-black)'
    '#000' = 'var(--color-black-short)'
    '#1A1A1A' = 'var(--color-black-soft)'
    '#1F1F1F' = 'var(--color-black-elevated)'
    '#2C2C2C' = 'var(--color-black-card)'
    '#1A1A2E' = 'var(--color-black-midnight)'
    '#0A0F1E' = 'var(--color-black-depth)'
    '#0D1321' = 'var(--color-black-ocean)'
    '#242830' = 'var(--color-black-graphite)'
    '#1A1D23' = 'var(--color-black-charcoal)'
    '#2A2A45' = 'var(--color-black-indigo)'
    '#212529' = 'var(--color-black-bootstrap)'
    
    # Apple 系统色
    '#F5F5F7' = 'var(--color-apple-bg)'
    '#6E6E73' = 'var(--color-apple-text)'
    '#86868B' = 'var(--color-apple-secondary)'
    '#9A9A9F' = 'var(--color-apple-tertiary)'
    '#2C2C2E' = 'var(--color-apple-dark-bg)'
    '#1C1C1E' = 'var(--color-apple-dark-surface)'
    '#30D158' = 'var(--color-apple-green)'
    
    # 特殊品牌色
    '#FF9F0A' = 'var(--color-brand-orange)'
    '#FAF3E0' = 'var(--color-brand-cream)'
    '#8B7355' = 'var(--color-brand-brown)'
    '#5C4B37' = 'var(--color-brand-dark-brown)'
}

Write-Host "=== 专业清理硬编码颜色 ==="
Write-Host ""
Write-Host ("定义颜色映射: $($colorMapping.Count) 个")
Write-Host ""

# 获取所有 CSS 文件
$cssFiles = Get-ChildItem -Path $SourcePath -Recurse -Include "*.css"

$totalFixed = 0
$filesProcessed = 0

foreach ($f in $cssFiles) {
    $content = Get-Content $f.FullName -Raw -Encoding UTF8
    $originalCount = ([regex]::Matches($content, "#[0-9A-Fa-f]{3,6}(?![a-fA-F])")).Count
    
    foreach ($key in $colorMapping.Keys) {
        $value = $colorMapping[$key]
        $pattern = [regex]::new([regex]::Escape($key))
        $content = $content -replace $pattern, $value
    }
    
    $newCount = ([regex]::Matches($content, "#[0-9A-Fa-f]{3,6}(?![a-fA-F])")).Count
    $fixed = $originalCount - $newCount
    
    if ($fixed -gt 0) {
        if (-not $DryRun) {
            $content | Set-Content $f.FullName -Encoding UTF8
        }
        $totalFixed += $fixed
        $filesProcessed++
        Write-Host ("  ✅ {0,-50} -{1}" -f (Split-Path $f.FullName -Leaf), $fixed)
    }
}

Write-Host ""
Write-Host ("处理文件: $filesProcessed 个")
Write-Host ("修复硬编码颜色: $totalFixed 处")

# 统计剩余硬编码颜色
$totalHardcoded = 0
foreach ($f in $cssFiles) {
    $content = Get-Content $f.FullName -Raw -Encoding UTF8
    $totalHardcoded += ([regex]::Matches($content, "#[0-9A-Fa-f]{3,6}(?![a-fA-F])")).Count
}
Write-Host ("剩余硬编码颜色: $totalHardcoded 处")

if ($totalHardcoded -eq 0) {
    Write-Host ""
    Write-Host "🎉 所有硬编码颜色已清理完成!"
} else {
    Write-Host ""
    Write-Host "⚠️ 仍有部分硬编码颜色需要手动处理"
}
