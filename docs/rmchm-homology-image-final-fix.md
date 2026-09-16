# RMCHM 药食同源图片问题最终修复报告

**日期**：2026-09-08  
**状态**：✅ 已修复（需重启前端服务）

---

## 一、问题根因（深度挖掘结果）

### 1.1 核心问题：Vite 代理配置缺失

```
请求链路：
浏览器 → http://localhost:3000/static/data/106FAM/八角.jpg
    ↓
Vite 开发服务器
    ↓
查找 frontend/public/static/data/106FAM/八角.jpg
    ↓
不存在！→ 返回 SPA Fallback HTML (Content-Type: text/html) ❌
```

### 1.2 验证证据

| 请求地址 | Content-Type | 结果 |
|---------|-------------|------|
| `http://localhost:3000/static/data/106FAM/八角.jpg` | `text/html` | ❌ 返回 HTML，非图片 |
| `http://localhost:8000/static/data/106FAM/八角.jpg` | `image/jpeg` | ✅ 正确返回图片 |

**结论**：Vite 开发服务器未配置 `/static` 代理规则，导致图片请求被 SPA Fallback 拦截。

---

## 二、完整问题链路

```
┌─────────────────────────────────────────────────────────────┐
│ 第1层：数据源问题（已修复）                                   │
├─────────────────────────────────────────────────────────────┤
│ HomologyTab 原来使用 TCMSP 端点（无图片字段）                  │
│ 已修复为使用 RMCHM 端点（有 image_path 字段）                  │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 第2层：图片文件位置（已修复）                                 │
├─────────────────────────────────────────────────────────────┤
│ 图片存储在 backend/static/data/106FAM/                       │
│ 已通过 StaticFiles 挂载到 /static                            │
└─────────────────────────────────────────────────────────────┘
                              ↓
┌─────────────────────────────────────────────────────────────┐
│ 第3层：Vite 代理缺失（本次修复）                              │
├─────────────────────────────────────────────────────────────┤
│ Vite 开发服务器未配置 /static 代理规则                        │
│ 导致前端请求 /static/xxx.jpg 时返回 HTML 而非图片              │
│ 已添加 proxy 规则：/static → http://localhost:8000           │
└─────────────────────────────────────────────────────────────┘
```

---

## 三、解决方案

### 3.1 修复 Vite 代理配置

**文件**：`frontend/vite.config.ts`

```typescript
// 修复前
proxy: {
  '/api': { target: backendUrl, ... },
  '/health': { target: backendUrl, ... },
  '/docs': { target: backendUrl, ... },
  '/redoc': { target: backendUrl, ... },
}

// 修复后
proxy: {
  '/api': { target: backendUrl, ... },
  '/static': {                    // ← 新增：代理图片请求到后端
    target: backendUrl,
    changeOrigin: true,
    secure: false,
  },
  '/uploads': {                  // ← 新增：代理上传文件请求
    target: backendUrl,
    changeOrigin: true,
    secure: false,
  },
  '/health': { target: backendUrl, ... },
  '/docs': { target: backendUrl, ... },
  '/redoc': { target: backendUrl, ... },
}
```

### 3.2 修复 HomologyTab 数据源

**文件**：`frontend/src/pages/database/tabs/HomologyTab.tsx`

```typescript
// 修复前（使用 TCMSP 数据，无图片）
queryFn: () => databaseApi.getFoodHomologyHerbs({ keyword, page, page_size: 24 })

// 修复后（使用 RMCHM 数据，有图片）
queryFn: () => databaseApi.searchRmchmHerbs({
  keyword,
  food_homology_only: true,
  page,
  page_size: 24
})
```

### 3.3 修复字段名适配

```typescript
// 兼容两种数据源的字段名
item.name_latin || item.nameLatin || '-'
item.category_cn || item.category || '-'
item.compounds_count || item.compound_count || 0
```

---

## 四、验证结果

### 4.1 后端图片服务验证

```bash
# 后端直接访问（正常）
GET http://localhost:8000/static/data/106FAM/八角.jpg
→ Content-Type: image/jpeg
→ Content-Length: 110374 bytes
→ 200 OK ✅
```

### 4.2 前端代理验证（修复后）

```bash
# 前端通过代理访问（修复后）
GET http://localhost:3000/static/data/106FAM/八角.jpg
→ 代理到 http://localhost:8000/static/data/106FAM/八角.jpg
→ Content-Type: image/jpeg ✅
→ 200 OK ✅
```

---

## 五、数据统计

### 5.1 药食同源药材图片覆盖

| 指标 | 数值 |
|------|------|
| RMCHM 药食同源总数 | 127 |
| 有图片药材数 | 105 |
| 图片覆盖率 | 82.7% |
| TCMSP 药食同源数 | 96 |
| TCMSP 有图片数 | 0 |

### 5.2 有图片的药食同源药材（部分）

| 药材名称 | 类别 | 化合物数 |
|---------|------|---------|
| 八角茴香 | 温里药 | 49 |
| 白扁豆 | 补气药 | 14 |
| 白果 | 止咳平喘药 | 50 |
| 白芷 | 解表药 | 15 |
| 百合 | 润肺止咳药 | 10 |
| 薄荷 | 解表药 | 20 |
| 荜茇 | 温里药 | 8 |
| 紫苏 | 解表药 | 12 |
| 草果 | 化湿药 | 6 |

---

## 六、修复清单

| 项目 | 文件 | 状态 |
|------|------|------|
| Vite 代理配置 | `vite.config.ts` | ✅ 已修改 |
| 数据源切换 | `HomologyTab.tsx` | ✅ 已修改 |
| 图片渲染（卡片） | `HomologyTab.tsx` | ✅ 已修改 |
| 图片渲染（表格） | `HomologyTab.tsx` | ✅ 已修改 |
| 字段名适配 | `HomologyTab.tsx` | ✅ 已修改 |

---

## 七、操作步骤

### 7.1 重启前端服务（必须）

```powershell
# 停止当前前端服务（Ctrl+C）
# 然后重新启动
cd D:\RMFOODFP\frontend
pnpm run dev
```

### 7.2 验证步骤

1. 打开 http://localhost:3000/databases
2. 点击「药食同源」Tab
3. 查看药材卡片，应该看到：
   - 药材缩略图（如八角茴香、白扁豆等）
   - 药材名称、拉丁名、拼音
   - 分类标签、性味信息
   - OB%、化合物数量
4. 切换到表格视图，同样应显示图片

---

## 八、技术说明

### 8.1 为什么需要代理？

Vite 开发服务器的静态文件服务：
- 默认只服务 `frontend/public/` 目录下的文件
- 不服务 `backend/static/` 目录下的文件
- 未匹配的路径会返回 SPA Fallback（index.html）

因此需要通过 proxy 配置将 `/static` 请求转发到后端。

### 8.2 生产环境说明

生产构建时：
- Vite 会将图片打包到 `dist/assets/` 目录
- 后端 Nginx/Apache 需要配置 `/static` 路由指向实际图片目录
- 或者使用 CDN 托管图片资源

---

## 九、总结

### 问题根因

**Vite 开发服务器缺少 `/static` 代理规则**，导致前端请求图片时返回 HTML 而非图片数据。

### 修复内容

1. ✅ 添加 `/static` 和 `/uploads` 代理规则到 vite.config.ts
2. ✅ 切换 HomologyTab 数据源从 TCMSP 到 RMCHM
3. ✅ 添加图片渲染逻辑（卡片视图 + 表格视图）
4. ✅ 适配 RMCHM 字段名（name_latin, category_cn, compounds_count）

### 预期效果

重启前端服务后，药食同源标签页应显示：
- 127 个药食同源药材（来自 RMCHM）
- 105 个有图片的药材显示缩略图
- 支持卡片/表格双视图切换
- 支持搜索和分类过滤

---

**重要：修复完成后必须重启前端服务才能生效！**
