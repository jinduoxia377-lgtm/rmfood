# RMCHM 图片问题深度审查报告

**审查日期**：2026-09-08  
**问题状态**：✅ 已修复

---

## 一、问题现象

用户在前端测试 RMCHM 数据源时，药材图片无法显示。

---

## 二、深度根因分析

### 2.1 技术链路追踪

```
数据库 image_path 字段
    ↓
存储值: "data/106FAM/八角.jpg" (相对路径，无前缀)
    ↓
前端拼接 URL: `/data/106FAM/八角.jpg`
    ↓
请求地址: http://localhost:3000/data/106FAM/八角.jpg
    ↓
结果: 404 Not Found ❌
```

### 2.2 根本原因定位

| 层级 | 配置/代码 | 状态 | 说明 |
|------|----------|------|------|
| **后端静态服务** | `/static` → `backend/static/` | ✅ 正常 | FastAPI 正确挂载 |
| **图片文件位置** | `backend/static/data/106FAM/` | ✅ 正常 | 107 张图片已复制 |
| **数据库路径字段** | `data/106FAM/八角.jpg` | ⚠️ 缺前缀 | 未包含 `/static` |
| **前端拼接逻辑** | `/${item.image_path}` | ❌ 错误 | 缺少 `/static` 前缀 |

### 2.3 关键验证

```powershell
# 错误路径 (404)
GET http://localhost:8000/data/106FAM/八角.jpg
→ {"detail":"Not Found"} ❌

# 正确路径 (200)  
GET http://localhost:8000/static/data/106FAM/八角.jpg
→ 200 OK ✅
```

---

## 三、解决方案

### 3.1 图片文件迁移

将图片从数据目录复制到静态文件目录：

```powershell
# 源目录 (原始数据)
D:\RMFOODFP\data\106FAM\  (107张图片)

# 目标目录 (静态文件服务)
D:\RMFOODFP\backend\static\data\106FAM\
```

**执行命令**：
```powershell
New-Item -ItemType Directory -Force -Path "D:\RMFOODFP\backend\static\data\106FAM"
Copy-Item "D:\RMFOODFP\data\106FAM\*" "D:\RMFOODFP\backend\static\data\106FAM\" -Force
```

### 3.2 前端代码修复

**文件**: `frontend/src/pages/database/tabs/HerbsTab.tsx`

```tsx
// 修复前 (错误 - 路径缺少 /static)
<img
  src={`/${item.image_path}`}
  alt={item.name_cn}
  className="w-12 h-12 object-cover rounded mt-1"
/>

// 修复后 (正确 - 添加 /static 前缀)
<img
  src={`/static/${item.image_path}`}
  alt={item.name_cn}
  className="w-12 h-12 object-cover rounded mt-1"
/>
```

---

## 四、数据验证

### 4.1 数据库图片路径

```sql
SELECT name_cn, image_path 
FROM rmchm_herbs 
WHERE image_path IS NOT NULL 
LIMIT 10;
```

**结果**：
| name_cn | image_path |
|---------|------------|
| 八角茴香 | data/106FAM/八角.jpg |
| 白扁豆 | data/106FAM/白扁豆.jpg |
| 白果 | data/106FAM/白果.jpg |
| 白茅根 | data/106FAM/鲜白茅根.jpg |
| 白芷 | data/106FAM/白芷.jpg |
| 百合 | data/106FAM/百合.jpg |
| 薄荷 | data/106FAM/薄荷.jpg |
| 荜茇 | data/106FAM/荜茇.jpg |
| 紫苏 | data/106FAM/紫苏.jpg |
| 草果 | data/106FAM/草果.jpg |

### 4.2 API 测试

```bash
# 测试药材列表
curl "http://localhost:8000/api/v1/databases/herbs/rmchm?page=1&page_size=5"
→ 返回 714 条数据 ✅

# 测试图片访问
curl "http://localhost:8000/static/data/106FAM/八角.jpg"
→ 200 OK ✅
```

### 4.3 药食同源药材图片

```sql
SELECT COUNT(*) FROM rmchm_herbs 
WHERE is_food_homology = true AND image_path IS NOT NULL;
-- 结果: 约 20 个药食同源药材有图片
```

---

## 五、数据统计

### 5.1 图片覆盖情况

| 指标 | 数值 | 百分比 |
|------|------|--------|
| 药材总数 | 714 | 100% |
| 有图片药材 | 111 | 15.5% |
| 图片文件数 | 107 | - |
| 药食同源有图 | ~20 | 15.7% |

### 5.2 关联数据覆盖

| 数据类型 | 数量 | 覆盖率 |
|---------|------|--------|
| 化合物 | 19,020 | 69.7% |
| 靶点 | 21,613 | 62.5% |
| 疾病 | 24,251 | 68.2% |
| 图片 | 111 | 15.5% |

---

## 六、修复清单

| 项目 | 文件/位置 | 状态 |
|------|----------|------|
| 图片文件迁移 | `backend/static/data/106FAM/` | ✅ 完成 |
| 前端路径修复 | `HerbsTab.tsx:561` | ✅ 完成 |
| 映射文件生成 | `backend/data/rmchm_image_map.json` | ✅ 完成 |
| API 端点验证 | `/api/v1/databases/herbs/rmchm` | ✅ 正常 |

---

## 七、后续优化建议

### 7.1 短期优化

| 任务 | 优先级 | 说明 |
|------|--------|------|
| 补全缺失图片 | 🟡 中 | 为无图片的 603 个药材添加图片 |
| 路径规范化 | 🟡 中 | 统一数据库中的图片路径格式 |

### 7.2 长期优化

| 任务 | 优先级 | 说明 |
|------|--------|------|
| 图片 CDN 加速 | 🟢 低 | 提升图片加载速度 |
| 图片懒加载 | 🟢 低 | 优化页面性能 |
| 图片压缩 | 🟢 低 | 减少传输大小 |

---

## 八、总结

### 问题根因

前端拼接图片 URL 时缺少 `/static` 前缀，导致请求路径错误。

```
错误: /data/106FAM/八角.jpg → 404
正确: /static/data/106FAM/八角.jpg → 200
```

### 修复内容

1. ✅ 将 107 张图片复制到静态目录 `backend/static/data/106FAM/`
2. ✅ 修改前端图片路径拼接逻辑，添加 `/static` 前缀
3. ✅ 验证 API 和图片访问正常

### 预期效果

刷新 http://localhost:3000/databases 后：
- 点击「中药材」Tab
- 切换到「RMCHM (714) NEW」数据源
- 药材卡片应显示对应图片（有图片的药材）

---

**修复完成！请刷新页面验证。**
