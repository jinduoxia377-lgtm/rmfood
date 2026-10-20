# ═══════════════════════════════════════════════════════════════
# RMFOOD 后端测试一键运行脚本（Windows PowerShell）
# ═══════════════════════════════════════════════════════════════
# 用途：
#   1. 自动清理旧的 coverage 并行数据文件（避免 "Can't combine statement
#      coverage data with branch data" 崩溃）；
#   2. 使用仓库根目录 .venv 运行后端 pytest。
#
# 用法：
#   .\scripts\run_backend_tests.ps1              # 运行全部后端测试
#   .\scripts\run_backend_tests.ps1 tests/unit/test_auth_utils.py   # 指定文件
#   参数 -WithCoverage：附带覆盖率报告（需先清理旧数据）
# ═══════════════════════════════════════════════════════════════
param(
    [string]$TestPath = 'tests',
    [switch]$WithCoverage
)

$ErrorActionPreference = 'Stop'
$backendDir = Split-Path -Parent $PSScriptRoot
Set-Location $backendDir

# 定位 Python（优先根 .venv，其次 backend/.venv，最后系统 python）
$pyCandidates = @(
    (Join-Path $backendDir '..\.venv\Scripts\python.exe'),
    (Join-Path $backendDir '.venv\Scripts\python.exe'),
    'python'
)
$py = $null
foreach ($c in $pyCandidates) {
    if (Test-Path $c) { $py = $c; break }
}
if (-not $py) { $py = 'python' }
Write-Host "[脚本] 使用 Python: $py"

# 清理 stale coverage 数据（生成物，可安全删除）
Write-Host '[脚本] 清理 stale coverage 数据文件...'
Get-ChildItem -Path $backendDir -Filter '.coverage*' -File -ErrorAction SilentlyContinue | ForEach-Object {
    Write-Host ("       删除 {0}" -f $_.Name)
    Remove-Item -LiteralPath $_.FullName -Force
}

# 组装 pytest 参数
$pytestArgs = @('-m', 'pytest', $TestPath, '-q')
if (-not $WithCoverage) {
    $pytestArgs += '--no-cov'
} else {
    $pytestArgs += @('--cov=app', '--cov-report=term-missing')
}

Write-Host "[脚本] 运行: & $py @pytestArgs"
& $py @pytestArgs
$code = $LASTEXITCODE
Write-Host "[脚本] pytest 退出码: $code"
exit $code