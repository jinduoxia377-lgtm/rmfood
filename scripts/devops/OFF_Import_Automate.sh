#!/bin/bash
# ==============================================================================
# OFF Data Import Automation Script (WSL/Ubuntu version)
# 请切换到 WSH Ubuntu 环境下运行此脚本
# ==============================================================================

set -euo pipefail

# ========== 配置 ==========
WSL_PROJECT_ROOT="/mnt/d/RMFOOD配方平台/backend"
LOG_DIR="${WSL_PROJECT_ROOT}/logs/off_import"
VENV_BIN="${WSL_PROJECT_ROOT}/.venv/bin/python"

# ========== 函数定义 ==========
log() {
    echo "[$(date +%F_%H:%M:%S)] $1"
}

check_env() {
    log "检查环境..."

    # 检查 Python 版本
    if ! command -v python3 &>/dev/null; then
        log "错误: python3 未安装，请先安装 Ubuntu"
        exit 1
    fi

    log "Python 版本: $(python3 --version)"

    # 检查 Venv
    if [ ! -f "${WSL_PROJECT_ROOT}/.venv/bin/activate" ]; then
        log "警告: 虚拟环境不存在，请先运行: source ${WSL_PROJECT_ROOT}/.venv/bin/activate"
        return 1
    fi
    log "虚拟环境路径: ${WSL_PROJECT_ROOT}/.venv"

    # 检查数据库
    if ! command -v psql &>/dev/null; then
        log "警告: psql 未安装，跳过数据库连接测试"
    else
        if PGPASSWORD="password" psql -h localhost -p 5432 -U postgres -d rmfood -c "SELECT 1;" &>/dev/null; then
            log "✓ PostgreSQL 连接成功"
        else
            log "警告: 无法连接到 PostgreSQL 数据库"
        fi
    fi

    # 检查 Redis
    if redis-cli ping &>/dev/null; then
        log "✓ Redis 连接成功"
    else
        log "警告: Redis 不可用（Celery 任务队列将禁用）"
    fi
}

run_sample() {
    log ""
    log "========================================"
    log "Phase A: 样本验证 (100 products)"
    log "========================================"

    cd "${WSL_PROJECT_ROOT}"

    if [ -f "${VENV_BIN}" ]; then
        log "使用虚拟环境 Python: ${VENV_BIN}"
        "${VENV_BIN}" scripts/import_off_direct.py sample
    else
        log "使用系统 Python"
        python3 scripts/import_off_direct.py sample
    fi
}

run_bulk() {
    log ""
    log "========================================"
    log "Phase B: 批量中国产品导入 (~30分类, 预计1-3小时)"
    log "========================================"

    export OFF_CHINA_ONLY=true
    cd "${WSL_PROJECT_ROOT}"

    if [ -f "${VENV_BIN}" ]; then
        "${VENV_BIN}" scripts/import_off_direct.py bulk
    else
        python3 scripts/import_off_direct.py bulk
    fi
}

run_sync() {
    log ""
    log "========================================"
    log "Phase C: 增量同步测试"
    log "========================================"

    cd "${WSL_PROJECT_ROOT}"

    if [ -f "${VENV_BIN}" ]; then
        "${VENV_BIN}" scripts/import_off_direct.py sync
    else
        python3 scripts/import_off_direct.py sync
    fi
}

run_embed() {
    log ""
    log "========================================"
    log "Phase D: 生成嵌入向量 (limit=10000)"
    log "========================================"

    cd "${WSL_PROJECT_ROOT}"

    if [ -f "${VENV_BIN}" ]; then
        "${VENV_BIN}" scripts/import_off_direct.py embed 10000
    else
        python3 scripts/import_off_direct.py embed 10000
    fi
}

generate_report() {
    log ""
    log "========================================"
    log "生成导入报告"
    log "========================================"

    cd "${WSL_PROJECT_ROOT}"

    cat << 'EOF'
# OFF 数据导入报告 - 自动生成

# 总体统计
psql "postgresql+asyncpg://postgres:password@localhost:5432/rmfood" -c "
SELECT
    source,
    COUNT(*) as total_products,
    COUNT(DISTINCT brand) as unique_brands,
    COUNT(DISTINCT category) as unique_categories,
    COUNT(CASE WHEN embedding IS NOT NULL THEN 1 END) as with_embedding,
    ROUND(AVG(data_quality), 2) as avg_data_quality,
    MIN(crawl_timestamp) as first_import,
    MAX(crawl_timestamp) as last_update
FROM retail_products
WHERE source = 'openfoodfacts'
GROUP BY source;
"

# 分类分布
psql "postgresql+asyncpg://postgres:password@localhost:5432/rmfood" -c "
SELECT category, COUNT(*) as cnt
FROM retail_products
WHERE source = 'openfoodfacts' AND category IS NOT NULL
GROUP BY category ORDER BY cnt DESC LIMIT 10;
"

# 任务追踪
psql "postgresql+asyncpg://postgres:password@localhost:5432/rmfood" -c "
SELECT task_id, status, progress_pct, created_at, updated_at
FROM import_tasks ORDER BY created_at DESC LIMIT 5;
"

# 错误日志
psql "postgresql+asyncpg://postgres:password@localhost:5432/rmfood" -c "
SELECT error_type, error_message, COUNT(*) as count
FROM import_errors GROUP BY error_type ORDER BY count DESC;
"
EOF
}

# ========== 主流程 ==========
log "开始 OFF 数据导入自动化流程"
log "项目目录: ${WSL_PROJECT_ROOT}"
log ""

check_env

log ""
log "选择要执行的阶段:"
log "  A) Phase A: 样本验证 (快速测试)"
log "  B) Phase B: 批量导入中国产品 (主要任务)"
log "  C) Phase C: 增量同步 (每日更新)"
log "  D) Phase D: 生成向量嵌入 (AI搜索准备)"
log "  E) Execute All: 按顺序执行所有阶段"
log "  R): 仅生成报告"

read -rp "请输入选项 (A/B/C/D/E/R): " choice

case "$choice" in
    A|a)
        run_sample
        ;;
    B|b)
        run_bulk
        ;;
    C|c)
        run_sync
        ;;
    D|d)
        run_embed
        ;;
    E|e)
        log ""
        log "=== 开始执行所有阶段 ==="
        run_sample
        run_bulk
        run_sync
        run_embed
        log ""
        log "=== 所有阶段完成 ==="
        ;;
    R|r)
        generate_report
        ;;
    *)
        log "无效选项，退出。"
        exit 1
        ;;
esac

log ""
log "流程完成！"
