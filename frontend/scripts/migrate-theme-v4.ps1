# RMFOOD 主题迁移 v4 — 修复双空格 + 去重
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

    # ── 1. 修复上一轮产生的双空格问题 ──
    # bg-neutral-700 " → bg-neutral-700"（删除空格）
    $m = ([regex]::Matches($changed, ' bg-neutral-\d+"')).Count
    if ($m -gt 0) { $reps += $m; $changed = $changed -replace ' bg-neutral-(\d+)"', ' bg-neutral-$1"' }

    # 更通用的：任何 " 前有双空格的场景
    $m = ([regex]::Matches($changed, '  +(?="|$)')).Count
    if ($m -gt 0) { $reps += $m; $changed = $changed -replace '  +', ' ' }

    # ── 2. 删除孤立孤 dark: 中性色（无亮色对）──
    $m = ([regex]::Matches($changed, ' dark:text-neutral-\d+')).Count
    if ($m -gt 0) { $reps += $m; $changed = $changed -replace ' dark:text-neutral-\d+', '' }

    $m = ([regex]::Matches($changed, ' dark:border-neutral-\d+')).Count
    if ($m -gt 0) { $reps += $m; $changed = $changed -replace ' dark:border-neutral-\d+', '' }

    $m = ([regex]::Matches($changed, ' dark:hover:bg-neutral-\d+')).Count
    if ($m -gt 0) { $reps += $m; $changed = $changed -replace ' dark:hover:bg-neutral-\d+', '' }

    # ── 3. 清理孤立 dark:bg-neutral（无亮色对时保留 fallback）──
    # 检测某处有 bg-neutral-X，同位置附近无 dark:bg-neutral-X 的情况
    # 简单策略：所有 dark:bg-neutral-Y 替换为对应 bg-neutral-X（如果存在）
    $m = ([regex]::Matches($changed, ' dark:bg-neutral-(\d+)')).Count
    if ($m -gt 0) {
        $map = @{50='50';100='50';200='100';300='200';400='300';500='400';600='500';700='600';800='700';900='800'}
        $changed = $changed -replace ' dark:bg-neutral-(\d+)', {
            param($m)
            $num = $m.Groups[1].Value
            if ($map.ContainsKey($num)) { " bg-neutral-$($map[$num])" }
            else { "" }
        }
        $reps += $m
    }

    # ── 4. 再次清理可能产生的双空格 ──
    $m = ([regex]::Matches($changed, '  +')).Count
    if ($m -gt 0) { $reps += $m; $changed = $changed -replace '  +', ' ' }

    # ── 5. 清理 className 尾部多余空格 ──
    $changed = $changed -replace '\s+"', '"'
    $changed = $changed -replace "\s+'", "'"

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
