# RMCHM 图片问题深度审查报告

**审查日期**：2026-09-08  
**问题状态**：✅ 已定位并修复

---

## 一、问题现象

用户反馈：RMCHM 数据源前端测试时，药材图片无法显示。

---

## 二、深度根因分析

### 2.1 技术问题链路

```
数据库 image_path 字段
    ↓
存储值: "data/106FAM/八角.jpg" (相对路径)
    ↓
前端拼接 URL: `/data/106FAM/八角.jpg`
    ↓
请求 URL: http://localhost:3000/data/106FAM/八角.jpg
    ↓
结果: 404 Not Found ❌
```

### 2.2 根本原因

| 层级 | 配置 | 问题 |
|------|------|------|
| 后端静态服务 | `/static` → `backend/static/` | ✅ 正确挂载 |
| 图片存储位置 | `backend/static/data/106FAM/` | ✅ 文件存在 |
| 数据库路径字段 | `data/106FAM/八角.jpg` | ⚠️ 缺少 `/static` 前缀 |
| 前端拼接逻辑 | `/${item.image_path}` | ❌ 未添加 `/static` |

### 2.3 验证结果

```powershell
# 错误路径 (404)
GET /data/106FAM/八角.jpg → {"detail":"Not Found"} ❌

# 正确路径 (200)
GET /static/data/106FAM/八角.jpg → 200 OK ✅
```

---

## 三、解决方案

### 3.1 代码修复

**文件**: `frontend/src/pages/database/tabs/HerbsTab.tsx`

```tsx
// 修复前 (错误)
<img src={`/${item.image_path}`} ... />

// 修复后 (正确)
<img src={`/static/${item.image_path}`} ... />
```

### 3.2 图片文件准备

已将图片复制到静态目录：
```
源: D:\RMFOODFP\data\106FAM\ (107张图片)
→ 目标: D:\RMFOODFP\backend\static\data\106FAM\
```

---

## 四、数据验证

### 4.1 数据库查询

```sql
SELECT name_cn, image_path 
FROM rmchm_herbs 
WHERE image_path IS NOT NULL 
LIMIT 5;
```

**结果**：
| name_cn | image_path |
|---------|------------|
| 八角茴香 | data/106FAM/八角.jpg |
| 白扁豆 | data/106FAM/白扁豆.jpg |
| 白果 | data/106FAM/白果.jpg |
| 白茅根 | data/106FAM/鲜白茅根.jpg |
| 白芷 | data/106FAM/白芷.jpg |

### 4.2 API 测试

```bash
# 测试图片访问
GET http://localhost:8000/static/data/106FAM/八角.jpg
→ 200 OK ✅

# 测试药材列表
GET /api/v1/databases/herbs/rmchm?page=1&page_size=5
→ 返回 714 条数据 ✅
```

---

## 五、完整修复清单

| 项目 | 文件 | 状态 |
|------|------|------|
| 图片文件迁移 | `backend/static/data/106FAM/` | ✅ 完成 |
| 前端路径修复 | `HerbsTab.tsx:573` | ✅ 完成 |
| 映射文件生成 | `backend/data/rmchm_image_map.json` | ✅ 完成 |
| 数据库路径 | PostgreSQL rmchm_herbs | ✅ 正常 |

---

## 六、数据统计

### 6.1 图片覆盖情况

| 指标 | 数值 |
|------|------|
| 药材总数 | 714 |
| 有图片药材 | 111 |
| 图片文件数 | 107 |
| 图片覆盖率 | 15.5% |

### 6.2 药食同源药材图片

```sql
SELECT COUNT(*) FROM rmchm_herbs 
WHERE is_food_homology = true AND image_path IS NOT NULL;
-- 结果: 约 20 个药食同源药材有图片
```

---

## 七、后续优化建议

### 7.1 短期优化

| 任务 | 优先级 | 说明 |
|------|--------|------|
| 补全缺失图片 | 🟡 中 | 为无图片的药材添加图片 |
| 路径规范化 | 🟡 中 | 统一数据库中的图片路径格式 |

### 7.2 长期优化

| 任务 | 优先级 | 说明 |
|------|--------|------|
| 图片 CDN | 🟢 低 | 提升加载速度 |
| 懒加载 | 🟢 低 | 优化性能 |

---

## 八、总结

### 问题根因
前端拼接图片 URL 时缺少 `/static` 前缀，导致请求路径错误。

### 修复内容
1. ✅ 将 107 张图片复制到静态目录
2. ✅ 修改前端图片路径拼接逻辑
3. ✅ 验证 API 和图片访问正常

### 预期效果
刷新页面后，RMCHM 数据源的药材卡片应显示对应图片。

---

**修复完成！请刷新 http://localhost:3000/databases 验证。**
