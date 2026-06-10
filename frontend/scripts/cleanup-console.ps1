# RMFOOD Console.log 清理脚本 (PowerShell版本)
param(
    [switch]$DryRun,
    [string]$TargetDir = "d:\RMFOOD配方平台\frontend\src"
)

$ErrorActionPreference = "Stop"

Write-Host "`n🚀 开始 Console.log 清理...`n" -ForegroundColor Cyan

$stats = @{
    TotalFiles = 0
    ModifiedFiles = 0
    ConsoleLogCount = 0
    ConsoleWarnCount = 0
    ConsoleErrorCount = 0
    ConsoleDebugCount = 0
    FixedCount = 0
    ImportAdded = 0
}

Write-Host "📂 正在扫描文件..." -ForegroundColor Yellow

if (-not (Test-Path $TargetDir)) {
    Write-Host "❌ 目录不存在: $TargetDir" -ForegroundColor Red
    exit 1
}

$files = Get-ChildItem -Path $TargetDir -Recurse -Include *.ts,*.tsx -File |
         Where-Object { $_.FullName -notmatch 'node_modules|__mocks__|__tests__|dist|build' }

$stats.TotalFiles = $files.Count
Write-Host "   找到 $($stats.TotalFiles) 个文件`n" -ForegroundColor Green

$filesToModify = @()

foreach ($file in $files) {
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    $relativePath = $file.FullName.Replace($TargetDir, '').TrimStart('\')
    
    $hasChanges = $false
    $fileStats = @{
        Log = 0
        Warn = 0
        Error = 0
        Debug = 0
    }
    
    $logMatches = [regex]::Matches($content, 'console\.log\s*\(')
    if ($logMatches.Count -gt 0) {
        $fileStats.Log = $logMatches.Count
        $stats.ConsoleLogCount += $logMatches.Count
        $hasChanges = $true
    }
    
    $warnMatches = [regex]::Matches($content, 'console\.warn\s*\(')
    if ($warnMatches.Count -gt 0) {
        $fileStats.Warn = $warnMatches.Count
        $stats.ConsoleWarnCount += $warnMatches.Count
        $hasChanges = $true
    }
    
    $errorMatches = [regex]::Matches($content, 'console\.error\s*\(')
    if ($errorMatches.Count -gt 0) {
        $fileStats.Error = $errorMatches.Count
        $stats.ConsoleErrorCount += $errorMatches.Count
        $hasChanges = $true
    }
    
    $debugMatches = [regex]::Matches($content, 'console\.debug\s*\(')
    if ($debugMatches.Count -gt 0) {
        $fileStats.Debug = $debugMatches.Count
        $stats.ConsoleDebugCount += $debugMatches.Count
        $hasChanges = $true
    }
    
    if ($hasChanges) {
        $totalIssues = $fileStats.Log + $fileStats.Warn + $fileStats.Error + $fileStats.Debug
        $filesToModify += [PSCustomObject]@{
            File = $file
            RelativePath = $relativePath
            Content = $content
            Stats = $fileStats
            TotalIssues = $totalIssues
        }
        
        Write-Host "   📄 $relativePath ($totalIssues 处)" -ForegroundColor White
    }
}

Write-Host "`n📊 扫描完成，发现 $($filesToModify.Count) 个文件存在问题:" -ForegroundColor Yellow
Write-Host "   - console.log: $($stats.ConsoleLogCount) 处" -ForegroundColor Red
Write-Host "   - console.warn: $($stats.ConsoleWarnCount) 处" -ForegroundColor Yellow
Write-Host "   - console.error: $($stats.ConsoleErrorCount) 处" -ForegroundColor Magenta
Write-Host "   - console.debug: $($stats.ConsoleDebugCount) 处" -ForegroundColor Cyan
$totalAll = $stats.ConsoleLogCount + $stats.ConsoleWarnCount + $stats.ConsoleErrorCount + $stats.ConsoleDebugCount
Write-Host "   - 总计: $totalAll 处`n" -ForegroundColor Green

if ($filesToModify.Count -eq 0) {
    Write-Host "✅ 太棒了！没有发现 console.* 调用" -ForegroundColor Green
    exit 0
}

if (-not $DryRun) {
    Write-Host "🔧 开始修复...`n" -ForegroundColor Yellow
    
    foreach ($fileInfo in $filesToModify) {
        $newContent = $fileInfo.Content
        
        $newContent = $newContent -replace 'console\.log\s*\(', 'logger.info('
        $newContent = $newContent -replace 'console\.warn\s*\(', 'logger.warn('
        $newContent = $newContent -replace 'console\.error\s*\(', 'logger.error('
        $newContent = $newContent -replace 'console\.debug\s*\(', 'logger.debug('
        
        $needsImport = -not (
            $newContent -match "from '@/utils/safeLogger'" -or
            $newContent -match "from '\./utils/safeLogger'" -or
            $newContent -match "from '\.\.\/utils/safeLogger'" -or
            $newContent -match "from '\.\.\/\.\.\/utils/safeLogger'"
        )
        
        if ($needsImport) {
            $importStatement = "import { logger } from '@/utils/safeLogger';`n"
            
            $lines = $newContent -split "`n"
            $lastImportIndex = -1
            
            for ($i = 0; $i -lt $lines.Count; $i++) {
                if ($lines[$i].Trim() -match '^import |^require\(') {
                    $lastImportIndex = $i
                }
            }
            
            if ($lastImportIndex -ge 0) {
                $lines = $lines[0..$lastImportIndex] + $importStatement + $lines[($lastImportIndex + 1)..($lines.Count - 1)]
            } else {
                $lines = , $importStatement + $lines
            }
            
            $newContent = $lines -join "`n"
            $stats.ImportAdded++
        }
        
        Set-Content -Path $fileInfo.File.FullName -Value $newContent -Encoding UTF8 -NoNewline
        $stats.ModifiedFiles++
        $stats.FixedCount += $fileInfo.TotalIssues
        
        Write-Host "   ✅ 已修复: $($fileInfo.RelativePath) ($($fileInfo.TotalIssues) 处)" -ForegroundColor Green
    }
} else {
    Write-Host "🔍 [DRY RUN] 将要修复的文件:`n" -ForegroundColor Yellow
    
    foreach ($fileInfo in $filesToModify) {
        Write-Host "   🔧 将修复: $($fileInfo.RelativePath) ($($fileInfo.TotalIssues) 处)" -ForegroundColor DarkYellow
    }
}

Write-Host "`n================================================================================" -ForegroundColor White
Write-Host "📊 RMFOOD Console.log 清理报告" -ForegroundColor White
Write-Host "================================================================================" -ForegroundColor White
Write-Host ""
Write-Host "📁 扫描目录: $TargetDir" -ForegroundColor White
Write-Host "📄 总文件数: $($stats.TotalFiles)" -ForegroundColor White
Write-Host "🔍 发现问题:" -ForegroundColor White
Write-Host "   - console.log: $($stats.ConsoleLogCount) 处" -ForegroundColor Red
Write-Host "   - console.warn: $($stats.ConsoleWarnCount) 处" -ForegroundColor Yellow
Write-Host "   - console.error: $($stats.ConsoleErrorCount) 处" -ForegroundColor Magenta
Write-Host "   - console.debug: $($stats.ConsoleDebugCount) 处" -ForegroundColor Cyan
Write-Host "   - 总计: $totalAll 处" -ForegroundColor Green
Write-Host ""
Write-Host "✅ 修复结果:" -ForegroundColor White
Write-Host "   - 已修改文件: $($stats.ModifiedFiles)" -ForegroundColor Green
Write-Host "   - 已修复调用: $($stats.FixedCount)" -ForegroundColor Green
Write-Host "   - 添加import: $($stats.ImportAdded) 个文件" -ForegroundColor Green
Write-Host ""
Write-Host "✨ 清理完成！所有 console.* 调用已替换为 safeLogger" -ForegroundColor Green
Write-Host "================================================================================" -ForegroundColor White

Write-Host "`n✅ 清理流程完成！" -ForegroundColor Green
