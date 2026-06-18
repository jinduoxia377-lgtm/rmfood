#!/bin/bash
# install-deps.sh
# 简化的依赖安装脚本

set -e

PROJECT_ROOT=$(dirname "$(dirname "$0")")

usage() {
    echo "用法: $0 {base|api|db|ml|dev|prod|all}"
    echo ""
    echo "选项:"
    echo "  base   安装基础核心依赖"
    echo "  api    安装API相关依赖（包含基础）"
    echo "  db     安装数据库相关依赖（包含基础）"
    echo "  ml     安装机器学习相关依赖（包含基础）"
    echo "  dev    安装开发工具依赖（包含基础）"
    echo "  prod   安装生产环境依赖（包含所有）"
    echo "  all    安装所有依赖组"
    echo ""
    echo "示例:"
    echo "  $0 base   # 只安装基础依赖"
    echo "  $0 all    # 安装完整开发环境"
}

install_deps() {
    local group=$1
    local requirements_file="$PROJECT_ROOT/backend/requirements/$group.txt"

    if [ ! -f "$requirements_file" ]; then
        echo "错误: 找不到依赖文件 $requirements_file"
        exit 1
    fi

    echo "正在安装 $group 依赖..."
    pip install -r "$requirements_file"

    if [ $? -eq 0 ]; then
        echo "✅ $group 依赖安装完成"
    else
        echo "❌ $group 依赖安装失败"
        exit 1
    fi
}

activate_venv() {
    if [ -n "$VIRTUAL_ENV" ]; then
        echo "✅ 已在虚拟环境中: $VIRTUAL_ENV"
    elif [ -d "$PROJECT_ROOT/.venv" ]; then
        source "$PROJECT_ROOT/.venv/Scripts/activate"
        echo "✅ 已激活虚拟环境"
    else
        echo "⚠️  未检测到虚拟环境，将在当前环境安装依赖"
    fi
}

# 检查参数
if [ $# -ne 1 ]; then
    usage
    exit 1
fi

case "$1" in
    base|api|db|ml|dev|prod)
        activate_venv
        install_deps "$1"
        ;;
    all)
        activate_venv
        echo "安装完整开发环境..."
        install_deps "prod"
        install_deps "dev"
        echo "✅ 所有依赖安装完成"
        ;;
    *)
        echo "错误: 未知选项 '$1'"
        usage
        exit 1
        ;;
esac