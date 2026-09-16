param(
    [string]$TargetPath = "src/pages",
    [switch]$DryRun = $false
)

$themeImport = @"
import { useTheme, useThemeInit } from '@/theme';
"@

$themeUsage = @"

  const { mode, activeThemeId } = useTheme();
  useThemeInit();
"@

Get-ChildItem -Path $TargetPath -Recurse -Include "*.tsx" | Where-Object {
    $_.Name -notlike "*Test*" -and $_.Name -notlike "*Spec*"
} | ForEach-Object {
    $file = $_
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    
    # 跳过已集成文件
    if ($content -match "useTheme|ThemeProvider|data-mode") {
        return
    }
    
    # 只处理有效的 React 组件
    if ($content -notmatch "export\s+(?:default\s+)?function\s+\w+\s*\(") {
        return
    }
    
    $newContent = $content
    
    # 添加主题导入
    if ($newContent -match "from 'react';") {
        $newContent = $newContent -replace "(from 'react';)", "`$1`n$themeImport"
    }
    
    # 在组件函数开头添加主题使用
    $funcMatch = [regex]::Match($newContent, "(export\s+(?:default\s+)?function\s+\w+\s*\([^)]*\)\s*\{)")
    if ($funcMatch.Success) {
        $insertPos = $funcMatch.Index + $funcMatch.Length
        $newContent = $newContent.Insert($insertPos, $themeUsage)
    }
    
    if (-not $DryRun) {
        $newContent | Set-Content $file.FullName -Encoding UTF8 -NoNewline
        Write-Host ("集成: {0}" -f $file.Name)
    }
}
