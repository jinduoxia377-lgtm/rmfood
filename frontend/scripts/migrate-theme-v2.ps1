# RMFOOD 主题迁移 — 第二轮：正则化清理残留 dark: 中性色前缀
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

    # ── 1. 删除所有 dark:text-neutral-X （亮色类已含语义）──
    $m = ([regex]::Matches($changed, 'dark:text-neutral-[0-9]+')).Count
    if ($m -gt 0) {
        $reps += $m
        $changed = $changed -replace 'dark:text-neutral-\d+', ''
    }

    # ── 2. 删除 dark:border-neutral-X ──
    $m = ([regex]::Matches($changed, 'dark:border-neutral-[0-9]+')).Count
    if ($m -gt 0) {
        $reps += $m
        $changed = $changed -replace 'dark:border-neutral-\d+', ''
    }

    # ── 3. 删除 dark:hover:bg-neutral-X ──
    $m = ([regex]::Matches($changed, 'dark:hover:bg-neutral-[0-9]+')).Count
    if ($m -gt 0) {
        $reps += $m
        $changed = $changed -replace 'dark:hover:bg-neutral-\d+', ''
    }

    # ── 4. 删除 dark:bg-neutral-X（保留透明叠加如 /80）──
    # dark:bg-neutral-900/80 → 保留（半透明叠加是有意为之）
    # dark:bg-neutral-900 → 删除
    $m = ([regex]::Matches($changed, 'dark:bg-neutral-\d+(?![/\w])')).Count
    if ($m -gt 0) {
        $reps += $m
        $changed = $changed -replace 'dark:bg-neutral-\d+(?![/\w])', ''
    }

    # ── 5. bg-white dark:bg-neutral-Y → surface-card ──
    $m = ([regex]::Matches($changed, 'bg-white\s+dark:bg-neutral-\d+')).Count
    if ($m -gt 0) {
        $reps += $m
        $changed = $changed -replace 'bg-white\s+dark:bg-neutral-\d+', 'surface-card'
    }
    # 也处理 bg-white/80 dark:bg-neutral-Y/80（保留透明度）
    $m = ([regex]::Matches($changed, 'bg-white/\d+.*?dark:bg-neutral-\d+/\d+')).Count
    if ($m -gt 0) {
        $reps += $m
        $changed = $changed -replace 'bg-white/\d+(.*?)dark:bg-neutral-\d+/\d+', 'surface-overlay$1'
    }

    # ── 6. bg-neutral-X dark:bg-neutral-X（同值）→ 单值 ──
    foreach ($i in 50,100,200,300,400,500,600,700,800,900) {
        $pattern = "bg-neutral-$i\s+dark:bg-neutral-$i"
        $m = ([regex]::Matches($changed, $pattern)).Count
        if ($m -gt 0) {
            $reps += $m
            $changed = $changed -replace [regex]::Escape($pattern), "bg-neutral-$i"
        }
    }

    # ── 7. bg-neutral-X dark:bg-neutral-Y（降级：Y > X → Y，否则删 dark）──
    $map = @{100='50';200='100';300='200';400='300';500='400';600='500';700='600';800='700';900='800'}
    foreach ($k in $map.Keys) {
        $v = $map[$k]
        $pattern = "bg-neutral-$k\s+dark:bg-neutral-$k"
        $m = ([regex]::Matches($changed, $pattern)).Count
        if ($m -gt 0) {
            $reps += $m
            $changed = $changed -replace [regex]::Escape($pattern), "bg-neutral-$v"
        }
    }

    if ($reps -gt 0) {
        $statsChanged++
        $statsTotal += $reps
        Set-Content $file.FullName -Value $changed -Encoding UTF8 -NoNewline
        Write-Output "  ✓ $rel`t$reps"
    }
}

Write-Output ""
Write-Output "=== 完成 ==="
Write-Output "修改文件: $statsChanged  总替换: $statsTotal"
