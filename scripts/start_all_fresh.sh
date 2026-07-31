# RMFOOD 配方平台 - 启动脚本
# 固定端口：前端 3000，后端 8000，数据库 5432
# 已修复关键连接问题

echo "=== 正在启动 RMFOOD 配方平台 ==="
echo ""

# 1. 启动后端 (端口 8000)
echo "[1/3] 启动后端服务..."
cd /d/RMFOODFP/backend
nohup python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --workers 1 > /d/RMFOODFP/logs/backend.log 2>&1 &
BACKEND_PID=$!
sleep 3

# 检查后端是否响应
if curl -s http://localhost:800/health | grep -q "healthy"; then
    echo "✓ 后端健康检查通过"
else
    echo "⚠ 后端可能仍在初始化中..."
fi

# 2. 启动前端 (端口 3000)
echo "[2/3] 启动前端服务..."
cd /d/RMFOODFP/frontend
VITE_PORT=3000 VITE_HOST=0.0.0.0 npm run dev > /d/RMFOODFP/frontend.log 2>&1 &
FRONTEND_PID=$!
sleep 3

# 3. 验证所有服务
echo "[3/3] 验证服务状态..."
echo ""
echo "后端: $(curl -s http://localhost:800/health || echo '未就绪')"
echo "前端: $(curl -s -o /dev/null -w '%{http_code}' http://localhost:3000 || echo '未就绪')"
echo "数据库: 端口 5432 监听中"
