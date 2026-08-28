# RMFOOD 主题系统 — 组件级批量迁移脚本
Set-Location "D:\RMFOODFP\frontend\src"

$rules = @{}

# ── text-neutral-X dark:text-neutral-Y → text-neutral-X ──
foreach ($i in 50,100,200,300,400,500,600,700,800,900) {
    $rules["dark:text-neutral-$i "] = " "
    $rules["dark:text-neutral-$i,"] = ","
    $rules["dark:text-neutral-$i'"] = "'"
}
$rules[" dark:text-white"] = ""
$rules[",dark:text-white"] = ","
$rules["dark:text-white"] = ""

# ── border-neutral-X dark:border-neutral-Y → border-neutral-X ──
foreach ($i in 100,200,300,400,500,600,700,800) {
    $rules["dark:border-neutral-$i "] = " "
    $rules["dark:border-neutral-$i,"] = ","
}

# ── hover:bg-neutral-X dark:hover:bg-neutral-Y → hover:bg-neutral-X ──
foreach ($i in 100,200,300,400,500,600,700,800) {
    $rules["dark:hover:bg-neutral-$i "] = " "
    $rules["dark:hover:bg-neutral-$i,"] = ","
}

# ── bg-white dark:bg-neutral-900/800 → surface-card ──
$rules[" bg-white dark:bg-neutral-900 "] = " surface-card "
$rules[" bg-white dark:bg-neutral-800 "] = " surface-card "
$rules[" bg-white dark:bg-neutral-900,"] = " surface-card,"
$rules[" bg-white dark:bg-neutral-800,"] = " surface-card,"

# ── bg-neutral-X dark:bg-neutral-Y（降级映射）──
$mappings = @{100=50; 200=100; 300=200; 400=300; 500=400; 600=500; 700=600; 800=700; 900=800}
foreach ($k in $mappings.Keys) {
    $v = $mappings[$k]
    $rules[" dark:bg-neutral-$k "] = " bg-neutral-$v "
    $rules[" dark:bg-neutral-$k,"] = " bg-neutral-$v,"
}

Write-Output "=== 规则数: $($rules.Count) ==="

# ── 执行替换 ──
$tsxFiles = Get-ChildItem -Recurse -Filter "*.tsx" |
    Where-Object { $_.FullName -notmatch 'node_modules|worktree|__tests__|\.d\.ts' }

$statsFiles = 0
$statsChanged = 0
$statsTotal = 0
$dryRun = $args.Contains("-DryRun")

foreach ($file in $tsxFiles) {
    $rel = $file.FullName.Replace("D:\RMFOODFP\frontend\src\", "")
    $orig = Get-Content $file.FullName -Raw -Encoding UTF8
    if (-not $orig) { continue }

    $changed = $orig
    $reps = 0
    foreach ($key in $rules.Keys) {
        if ($changed.Contains($key)) {
            $m = [regex]::Matches($changed, [regex]::Escape($key)).Count
            $reps += $m
            $changed = $changed.Replace($key, $rules[$key])
        }
    }

    if ($reps -gt 0) {
        $statsFiles++
        $statsChanged++
        $statsTotal += $reps
        if ($dryRun) {
            Write-Output "  [DRY] $rel`t$reps"
        } else {
            Set-Content $file.FullName -Value $changed -Encoding UTF8 -NoNewline
            Write-Output "  ✓ $rel`t$reps"
        }
    } else {
        $statsFiles++
    }
}

Write-Output ""
Write-Output "处理: $statsFiles  修改: $statsChanged  总替换: $statsTotal"
if ($dryRun) { Write-Output "[仅预览]" }
