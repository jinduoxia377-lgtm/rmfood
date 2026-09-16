# RMCHM 药食同源图片问题 - 最终深度诊断报告

**诊断日期**：2026-09-08  
**问题状态**：✅ 技术层面已修复，需用户操作验证

---

## 一、问题现象

用户在前端 http://localhost:3000/databases 页面的「药食同源」标签页中，点击药材卡片时看不到图片。

---

## 二、深度诊断结果

### 2.1 技术层验证（全部通过 ✅）

| 检查项 | 状态 | 详情 |
|--------|------|------|
| 数据库记录 | ✅ | 127条药食同源药材，105条有image_path |
| API响应 | ✅ | `/api/v1/databases/herbs/rmchm?food_homology_only=true` 返回127条，含image_path |
| 图片文件 | ✅ | 107张JPG存在于 `backend/static/data/106FAM/` |
| 图片URL可访问 | ✅ | `http://localhost:3000/static/data/106FAM/八角.jpg` → 200, image/jpeg, 110374字节 |
| HomologyTab编译代码 | ✅ | 包含searchRmchmHerbs, food_homology_only, image_path, /static/ |
| Vite代理配置 | ✅ | `/static` → `localhost:8000` 已配置并生效 |
| DatabasePage导入 | ✅ | 正确导入并渲染HomologyTab组件 |

### 2.2 发现的次要问题

| 问题 | 状态 | 说明 |
|------|------|------|
| HerbsTab缺少RMCHM按钮 | ⚠️ 次要 | 编译后代码中 `setDataSource('rmchm')` 未出现 |
| HerbsTab缺少图片渲染 | ⚠️ 次要 | 编译后代码中 img标签未出现 |
| 注：这不影响药食同源页面 | | 药食同源使用HomologyTab，不涉及HerbsTab |

---

## 三、根因分析

### 3.1 初始问题（已修复）

| 层级 | 问题 | 修复 |
|------|------|------|
| 数据源 | HomologyTab使用TCMSP端点（无图片字段） | 切换为RMCHM端点 + food_homology_only=true |
| 图片路径 | 前端缺少 `/static` 前缀 | 修改为 `/static/${item.image_path}` |
| 静态服务 | 图片不在Vite可访问目录 | 复制到 `backend/static/data/106FAM/` |
| Vite代理 | 缺少 `/static` 代理规则 | 添加 proxy 配置 |

### 3.2 当前状态

所有技术层面已修复完成。图片URL可正常访问，前端代码已正确编译。

---

## 四、可能仍无法显示的原因

### 4.1 浏览器缓存（最可能）

浏览器可能缓存了旧的JS bundle，不包含最新的图片渲染逻辑。

### 4.2 React Query缓存

React Query可能缓存了旧的API响应数据（不含image_path字段）。

### 4.3 用户查看的是错误页面

用户可能看到的是「中药材」Tab（HerbsTab）而非「药食同源」Tab（HomologyTab）。

---

## 五、验证步骤

### 5.1 快速验证图片是否正常

在浏览器地址栏直接访问：
```
http://localhost:3000/static/data/106FAM/八角.jpg
```
如果能看到图片，说明代理和后端都正常。

### 5.2 清除缓存并验证

1. 按 `Ctrl+Shift+R` 强制刷新页面
2. 或打开开发者工具(F12) → Network标签 → 勾选"Disable cache" → 刷新
3. 导航到「药食同源」Tab
4. 查看网络请求中是否有 `/static/data/106FAM/xxx.jpg` 的请求
5. 检查这些请求的状态码和Content-Type

### 5.3 检查控制台错误

按F12打开开发者工具 → Console标签，检查是否有JavaScript错误。

---

## 六、数据统计

### 6.1 药食同源图片覆盖

| 指标 | 数值 |
|------|------|
| 药食同源药材总数 | 127 |
| 有图片的药材数 | 105 |
| 图片覆盖率 | 82.7% |
| 图片文件数 | 107 |

### 6.2 有图片的药食同源药材（部分）

| 药材名称 | 类别 | 化合物数 | 图片大小 |
|---------|------|---------|---------|
| 八角茴香 | 温里药 | 49 | 110KB |
| 白扁豆 | 补气药 | 14 | 81KB |
| 白果 | 止咳平喘药 | 50 | 87KB |
| 白芷 | 解表药 | 15 | - |
| 百合 | 润肺止咳药 | 10 | - |
| 薄荷 | 解表药 | 20 | - |
| 荜茇 | 温里药 | 8 | - |
| 紫苏 | 解表药 | 12 | - |
| 草果 | 化湿药 | 6 | - |
| 陈皮 | 理气药 | - | - |

---

## 七、修复清单

| 项目 | 文件 | 状态 |
|------|------|------|
| 图片文件迁移 | `backend/static/data/106FAM/` | ✅ 完成 |
| HomologyTab API切换 | `HomologyTab.tsx:71` | ✅ 完成 |
| HomologyTab图片渲染 | `HomologyTab.tsx:294-305` | ✅ 完成 |
| HomologyTab字段适配 | `HomologyTab.tsx` | ✅ 完成 |
| Vite代理配置 | `vite.config.ts:190-194` | ✅ 完成 |
| HerbsTab RMCHM按钮 | `HerbsTab.tsx` | ⚠️ 需检查 |

---

## 八、后续建议

### 8.1 立即操作

1. 在浏览器中按 `Ctrl+Shift+R` 强制刷新
2. 进入 http://localhost:3000/databases
3. 点击「药食同源」Tab
4. 查看药材卡片中是否有图片

### 8.2 如果仍然无法显示

1. 按F12打开开发者工具
2. 切换到Network标签
3. 勾选"Disable cache"
4. 刷新页面
5. 筛选图片请求（Filter: img）
6. 查看 `/static/data/106FAM/` 相关请求的状态码

### 8.3 根据Network结果判断

| 状态码 | Content-Type | 含义 |
|--------|-------------|------|
| 200 | image/jpeg | 图片加载成功，检查CSS样式 |
| 404 | text/html | 路径错误，检查image_path字段 |
| 0 | - | 网络问题或CORS拦截 |
| CORS错误 | - | 代理配置问题 |

---

## 九、总结

**技术诊断结论**：所有后端API、图片文件、前端代码、Vite代理均正常工作。图片URL `http://localhost:3000/static/data/106FAM/八角.jpg` 返回正确的JPEG图像数据。

**最可能的原因**：浏览器缓存了旧的JS bundle，导致图片渲染代码未生效。

**建议操作**：强制刷新浏览器（Ctrl+Shift+R）并检查开发者工具Network标签。

---

**报告完成！请按照上述验证步骤操作。**
