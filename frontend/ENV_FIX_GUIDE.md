# RMFOOD 前端环境修复指南

## 问题诊断
前端 `node_modules` 损坏，关键依赖包缺失：
- `vite`: 缺失或损坏
- `react`: 缺失
- `react-dom`: 缺失
- `typescript`: 缺失

## 根本原因
1. `pnpm install` 超时（网络/依赖解析问题）
2. npm 依赖冲突（React 19 + expo 包 peer dependency 问题）
3. `@react-three/*` 包引入 expo 导致依赖树复杂化

## 解决方案

### 方法一：使用npx启动（推荐）
```bash
cd D:\RMFOODFP\frontend
npx vite --port 3000 --host 0.0.0.0
```

### 方法二：完整重装依赖
```bash
cd D:\RMFOODFP\frontend
# 1. 清理
Remove-Item node_modules -Recurse -Force
Remove-Item pnpm-lock.yaml -Force

# 2. 使用npm安装（跳过peer deps检查）
npm install --legacy-peer-deps --force

# 3. 启动
npm run dev
```

### 方法三：简化package.json后安装
如果上述方法仍失败，临时移除 @react-three/* 包：
```bash
# 编辑 package.json，暂时注释掉以下依赖：
# "@react-three/drei": "^9.92.0",
# "@react-three/fiber": "^8.15.17",
# "three": "^0.160.0",

npm install --legacy-peer-deps
npm run dev

# 启动成功后再装回：
npm install @react-three/drei @react-three/fiber three
```

## 当前状态
- 后端: ✓ 运行中 (http://localhost:8000)
- 前端: 需手动启动

## 访问地址
- 应用: http://localhost:3000
- API: http://localhost:8000/api/v1
- 文档: http://localhost:8000/docs
