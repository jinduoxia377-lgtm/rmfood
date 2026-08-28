# RMFOOD 主题迁移 — 第三轮：正则统一清理（解决上一轮产生的重复类）
Set-Location "D:\RMFOODFP\frontend\src"

$tsxFiles = Get-ChildItem -Recurse -Filter "*.tsx" |
    Where-Object { $_.FullName -notmatch 'node_modules|worktree|__tests__|\.d\.ts' }

$statsTotal = 0
$statsChanged = 0

foreach ($file in $tsxFiles) {
    $rel = $file.FullName.Replace("D:\RMFOODFP\frontend\src\", "")
    $content = Get-Content $file.FullName -Raw -Encoding UTF8
    if (-not $content) { continue }

    $changed = $content
    $reps = 0

    # ═══════════════════════════════════════════════════════════
    # 1. 移除孤立残留的 dark: 前缀中性色（上一轮产生的孤儿类）
    #    例如：bg-white bg-neutral-800 中的 bg-neutral-800 来自 dark:bg-neutral-800 的降级
    #    策略：只删那些明显是上轮产物产生的重复
    # ═══════════════════════════════════════════════════════════

    # bg-white dark:bg-neutral-X → surface-card（X 后紧跟非字母数字）
    $m = ([regex]::Matches($changed, 'bg-white\s+dark:bg-neutral-\d+(?=[/\s>"'"']|$)')).Count
    if ($m -gt 0) { $reps += $m; $changed = $changed -replace 'bg-white\s+dark:bg-neutral-\d+(?=[/\s>"'"']|$)', 'surface-card' }

    # bg-neutral-X dark:bg-neutral-X（同值重复）→ 单值
    foreach ($i in 50,100,200,300,400,500,600,700,800,900) {
        $pat = "bg-neutral-$i\s+dark:bg-neutral-$i(?=[\s>"'"']|$)"
        $m = ([regex]::Matches($changed, $pat)).Count
        if ($m -gt 0) { $reps += $m; $changed = $changed -replace [regex]::Escape($pat), "bg-neutral-$i" }
    }

    # ═══════════════════════════════════════════════════════════
    # 2. 删除无对应亮色的孤立 dark: 中性色类
    #    这些是上一轮把 dark:text-neutral 替换为空导致的孤儿
    #    例：className="text-sm text-neutral-400 " → 末尾多余空格/孤立 dark: 类
    # ═══════════════════════════════════════════════════════════

    # 删除孤立的 dark:text-neutral-X（无亮色对时保留作为 fallback 的除外）
    # 策略：如果该行有亮色 text-neutral-X 且不同，说明 dark: 是降级，删除它
    # 但如果只有 dark:text-neutral-X 没有亮色，则保留（fallback 模式）
    $darkTextMatches = [regex]::Matches($changed, 'dark:text-neutral-\d+')
    foreach ($m in $darkTextMatches) {
        $full = $m.Value
        # 找对应位置前后，看有没有亮色版本
        $start = [Math]::Max(0, $m.Index - 30)
        $snippet = $changed.Substring($start, [Math]::Min(60, $changed.Length - $start))
        $num = $full -replace 'dark:text-neutral-', ''
        $light = "text-neutral-$num"
        if ($snippet.Contains($light)) {
            # 有亮色对应，删除 dark 版本
            $changed = $changed.Remove($m.Index, $full.Length)
            $reps++
        }
    }

    # ═══════════════════════════════════════════════════════════
    # 3. 清理双重空格和孤立空格
    # ═══════════════════════════════════════════════════════════
    $m = ([regex]::Matches($changed, '  +')).Count
    if ($m -gt 0) {
        $reps += $m
        $changed = $changed -replace '  +', ' '
    }
    # 清理 className 中引号前的空格
    $changed = $changed -replace '\s+"', '"'
    $changed = $changed -replace '\s+\'', '\''

    if ($reps -gt 0) {
        $statsChanged++
        $statsTotal += $reps
        Set-Content $file.FullName -Value $changed -Encoding UTF8 -NoNewline
        Write-Output "  ✓ $rel`t$reps"
    }
}

Write-Output ""
Write-Output "=== 完成 ==="
Write-Output "修改文件: $statsChanged  总清理: $statsTotal"
