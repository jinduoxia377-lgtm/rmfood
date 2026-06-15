#!/usr/bin/env bash
# ════════════════════════════════════════════
#  RMFOOD K8s 部署脚本
#  支持: Helm 部署 / Kustomize 部署
# ════════════════════════════════════════════
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# 默认值
ACTION="deploy"
ENVIRONMENT="staging"
CHART_VERSION=""
DRY_RUN=false
ROLLBACK_TO=""

usage() {
    echo "Usage: $0 [OPTIONS]"
    echo ""
    echo "Actions:"
    echo "  --action deploy     Deploy to K8s (default)"
    echo "  --action rollback   Rollback to previous release"
    echo "  --action status     Show release status"
    echo "  --action upgrade    Upgrade Helm chart"
    echo ""
    echo "Options:"
    echo "  --env staging|production    Target environment"
    echo "  --dry-run                   Preview changes only"
    echo "  --chart-version VERSION     Helm chart version to deploy"
    echo "  --rollback-to VERSION       Rollback to specific version"
    echo "  -h, --help                  Show this help"
    exit 1
}

# 解析参数
while [[ $# -gt 0 ]]; do
    case $1 in
        --action) ACTION="$2"; shift 2 ;;
        --env) ENVIRONMENT="$2"; shift 2 ;;
        --dry-run) DRY_RUN=true; shift ;;
        --chart-version) CHART_VERSION="$2"; shift 2 ;;
        --rollback-to) ROLLBACK_TO="$2"; shift 2 ;;
        -h|--help) usage ;;
        *) echo "Unknown option: $1"; usage ;;
    esac
done

# 验证
if [[ "$ACTION" != "deploy" && "$ACTION" != "rollback" && "$ACTION" != "status" && "$ACTION" != "upgrade" ]]; then
    echo "❌ Invalid action: $ACTION"
    usage
fi

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    echo "❌ Invalid environment: $ENVIRONMENT (must be staging or production)"
    exit 1
fi

echo "═══════════════════════════════════════"
echo "  RMFOOD K8s Deployment: $ACTION"
echo "  Environment: $ENVIRONMENT"
echo "═══════════════════════════════════════"

# Helm 部署
deploy_helm() {
    local values_file="deploy/helm/rmfood/values.yaml"
    if [[ "$ENVIRONMENT" == "production" ]]; then
        values_file="deploy/helm/rmfood/values-production.yaml"
    fi

    local helm_args=(-f "$values_file")
    if [[ -n "$CHART_VERSION" ]]; then
        helm_args+=(--version "$CHART_VERSION")
    fi

    if [[ "$DRY_RUN" == true ]]; then
        echo "🔍 DRY RUN - would execute:"
        echo "   helm upgrade --install rmfood deploy/helm/rmfood ${helm_args[*]}"
        echo "   Values file: $values_file"
        return 0
    fi

    echo "🚀 Deploying with Helm..."
    helm upgrade --install rmfood deploy/helm/rmfood  \
        --namespace rmfood --create-namespace \
        --wait --timeout 10m0s \
        --atomic

    echo "✅ Deployment complete"
}

# 回滚
rollback_helm() {
    if [[ -n "$ROLLBACK_TO" ]]; then
        echo "🔄 Rolling back to revision: $ROLLBACK_TO"
        kubectl rollout undo deployment -n rmfood rmfood-backend --to-revision="$ROLLBACK_TO" 2>/dev/null || true
        kubectl rollout undo deployment -n rmfood rmfood-frontend --to-revision="$ROLLBACK_TO" 2>/dev/null || true
    else
        echo "🔄 Rolling back to previous revision"
        helm rollback rmfood -n rmfood
    fi
    echo "✅ Rollback complete"
}

# 状态检查
status_helm() {
    echo "📊 Release status:"
    helm list -n rmfood 2>/dev/null || echo "  No releases found"
    echo ""
    echo "📊 Pod status:"
    kubectl get pods -n rmfood 2>/dev/null || echo "  No pods found"
    echo ""
    echo "📊 Events:"
    kubectl get events -n rmfood --sort-by=.lastTimestamp 2>/dev/null | tail -10 || echo "  No events"
}

# 执行
case $ACTION in
    deploy) deploy_helm ;;
    rollback) rollback_helm ;;
    status) status_helm ;;
    upgrade) deploy_helm ;;
esac

echo ""
echo "═══════════════════════════════════════"
echo "  K8s Deployment $ACTION complete: $ENVIRONMENT"
echo "═══════════════════════════════════════"
