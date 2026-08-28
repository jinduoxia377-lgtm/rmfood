# ═══════════════════════════════════════════════════════════
# RMFOOD LAN 一键部署脚本 (PowerShell)
# 用法: .\scripts\lan-deploy.ps1 {up|down|logs|status|rebuild}
# ═══════════════════════════════════════════════════════════

param(
    [Parameter(Position=0)]
    [ValidateSet('up', 'down', 'status', 'logs', 'rebuild', 'help')]
    [string]$Command = 'help',

    [Parameter(ValueFromRemainingArguments=$true)]
    [string[]]$ExtraArgs
)

$ErrorActionPreference = 'Stop'

$SCRIPT_DIR = Split-Path -Parent $MyInvocation.MyCommand.Path
$PROJECT_DIR = Split-Path -Parent $SCRIPT_DIR
$COMPOSE_FILE = Join-Path $PROJECT_DIR 'docker-compose.lan.yml'

# ─── Colors ─────────────────────────────────────
function Write-Info    { Write-Host "[INFO]    $args" -ForegroundColor Blue }
function Write-Ok      { Write-Host "[OK]      $args" -ForegroundColor Green }
function Write-Warn    { Write-Host "[WARN]    $args" -ForegroundColor Yellow }
function Write-Error   { Write-Host "[ERROR]   $args" -ForegroundColor Red }
function Write-Step    { Write-Host "── $args" -ForegroundColor Cyan }

# ─── Pre-flight checks ─────────────────────────
function Test-Docker {
    if (-not (Get-Command docker -ErrorAction SilentlyContinue)) {
        Write-Error "Docker 未安装，请先安装 Docker Desktop"
        exit 1
    }
    $null = docker compose version 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Error "Docker Compose 插件不可用"
        exit 1
    }
}

function Test-Env {
    $envFile = Join-Path $PROJECT_DIR '.env'
    if (-not (Test-Path $envFile)) {
        Write-Error ".env 文件不存在，请从 .env.example 复制"
        exit 1
    }

    $envContent = Get-Content $envFile -Raw
    if ($envContent -notmatch '^SECRET_KEY=') {
        Write-Error "缺少 SECRET_KEY"
        exit 1
    }
    if ($envContent -notmatch '^POSTGRES_PASSWORD=') {
        Write-Error "缺少 POSTGRES_PASSWORD"
        exit 1
    }
}

function Test-Compose {
    if (-not (Test-Path $COMPOSE_FILE)) {
        Write-Error "docker-compose.lan.yml 不存在于 $PROJECT_DIR"
        exit 1
    }
}

# ─── Commands ───────────────────────────────────
function Get-EnvValue($key, $default) {
    $envContent = Get-Content (Join-Path $PROJECT_DIR '.env') -Raw
    if ($envContent -match "^$key=(.+)$") {
        return $matches[1]
    }
    return $default
}

function Cmd-Up {
    Write-Step "启动 RMFOOD LAN 部署"
    Set-Location $PROJECT_DIR
    docker compose -f $COMPOSE_FILE up -d --build
    Write-Ok "Docker Compose 启动完成"
    Wait-ForServices
}

function Cmd-Down {
    Write-Step "停止 RMFOOD 所有服务"
    Set-Location $PROJECT_DIR
    docker compose -f $COMPOSE_FILE down
    Write-Ok "所有服务已停止"
}

function Cmd-Status {
    Write-Step "服务状态"
    Set-Location $PROJECT_DIR
    docker compose -f $COMPOSE_FILE ps
    Write-Host ""
    Get-AccessInfo
}

function Cmd-Logs {
    Set-Location $PROJECT_DIR
    $argsList = @("logs", "-f") + $ExtraArgs
    & docker compose -f $COMPOSE_FILE $argsList
}

function Cmd-Rebuild {
    Write-Step "重新构建并启动"
    Set-Location $PROJECT_DIR
    docker compose -f $COMPOSE_FILE down
    docker compose -f $COMPOSE_FILE up -d --build
    Write-Ok "重建完成"
    Wait-ForServices
}

# ─── Helpers ────────────────────────────────────
function Wait-ForServices {
    Write-Step "等待服务就绪..."
    Set-Location $PROJECT_DIR

    $backendPort = Get-EnvValue 'BACKEND_PORT' '8000'
    $frontendPort = Get-EnvValue 'FRONTEND_PORT' '3000'

    $maxWait = 120
    $waited = 0

    # 等待后端
    while ($waited -lt $maxWait) {
        try {
            $resp = Invoke-WebRequest -Uri "http://localhost:$backendPort/api/v1/health" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
            if ($resp.StatusCode -eq 200) {
                Write-Ok "后端服务已就绪 (http://localhost:$backendPort)"
                break
            }
        } catch {}
        Start-Sleep -Seconds 2
        $waited += 2
        Write-Host -NoNewline "`r  等待后端... ${waited}s/$maxWait "
    }
    Write-Host ""

    $waited = 0
    # 等待前端
    while ($waited -lt $maxWait) {
        try {
            $resp = Invoke-WebRequest -Uri "http://localhost:$frontendPort" -TimeoutSec 2 -UseBasicParsing -ErrorAction Stop
            if ($resp.StatusCode -eq 200) {
                Write-Ok "前端服务已就绪 (http://localhost:$frontendPort)"
                break
            }
        } catch {}
        Start-Sleep -Seconds 2
        $waited += 2
        Write-Host -NoNewline "`r  等待前端... ${waited}s/$maxWait "
    }
    Write-Host ""

    Get-AccessInfo
}

function Get-AccessInfo {
    Write-Host ""
    Write-Step "访问信息"
    Write-Host ""

    $frontendPort = Get-EnvValue 'FRONTEND_PORT' '3000'
    $backendPort = Get-EnvValue 'BACKEND_PORT' '8000'

    # 获取本机 IP
    $ip = (Get-NetIPAddress -AddressFamily IPv4 `
            | Where-Object { $_.InterfaceAlias -notlike "*Loopback*" -and $_.IPAddress -notlike "169.*" } `
            | Select-Object -First 1).IPAddress
    if (-not $ip) { $ip = "你的IP" }

    Write-Host "  前端:      http://localhost:$frontendPort" -ForegroundColor Green
    Write-Host "  前端:      http://$ip:$frontendPort  (局域网访问)" -ForegroundColor Green
    Write-Host "  后端 API:  http://localhost:$backendPort" -ForegroundColor Green
    Write-Host "  Swagger:   http://localhost:$backendPort/docs" -ForegroundColor Green
    Write-Host ""
    Write-Host "  默认管理员账号:" -ForegroundColor Yellow
    Write-Host "  用户名: admin"
    Write-Host "  密码:   请查看 .env 中的 ADMIN_PASSWORD (默认 admin123)"
    Write-Host ""
}

# ─── Main ───────────────────────────────────────
switch ($Command) {
    'up' {
        Test-Docker
        Test-Env
        Test-Compose
        Cmd-Up
    }
    'down' {
        Test-Docker
        Cmd-Down
    }
    'status' {
        Test-Docker
        Cmd-Status
    }
    'logs' {
        Test-Docker
        Cmd-Logs
    }
    'rebuild' {
        Test-Docker
        Test-Env
        Test-Compose
        Cmd-Rebuild
    }
    'help' {
        Write-Host "RMFOOD LAN 一键部署脚本" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "用法: .\scripts\lan-deploy.ps1 {up|down|status|logs|rebuild}" -ForegroundColor White
        Write-Host ""
        Write-Host "  up        构建并启动所有服务"
        Write-Host "  down      停止所有服务"
        Write-Host "  status    查看服务状态和访问信息"
        Write-Host "  logs      查看实时日志 (可跟额外参数)"
        Write-Host "  rebuild   重新构建并启动"
        Write-Host "  help      显示此帮助"
    }
}
