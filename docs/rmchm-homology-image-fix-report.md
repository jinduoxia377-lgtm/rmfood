# RMCHM 药食同源图片问题深度审查报告

**审查日期**：2026-09-08  
**问题状态**：✅ 已修复

---

## 一、问题现象

用户在「药食同源」标签页测试时，药材图片无法显示。

---

## 二、深度根因分析

### 2.1 问题链路追踪

```
用户访问 /databases → 点击「药食同源」Tab
    ↓
HomologyTab.tsx 调用 API
    ↓
API: /api/v1/databases/herbs/food-homology
    ↓
后端返回: TCMSP 数据 (TCMHerb 对象)
    ↓
问题: TCMHerb 对象没有 image_path 字段 ❌
    ↓
前端尝试渲染图片 → image_path 为 undefined
    ↓
结果: 图片无法显示
```

### 2.2 根本原因（三层问题）

| 层级 | 问题描述 | 影响 |
|------|---------|------|
| **数据源错误** | HomologyTab 使用 TCMSP 端点，而非 RMCHM 端点 | 返回数据无图片字段 |
| **字段不匹配** | TCMHerb 对象结构 vs RMCHMHerb 对象结构不同 | 前端无法渲染图片 |
| **图片路径缺失** | 即使有 image_path，也缺少 `/static` 前缀 | 图片 URL 错误 |

### 2.3 数据对比

| 字段 | TCMSP (food-homology 端点) | RMCHM (rmchm 端点) |
|------|---------------------------|-------------------|
| 药材总数 | 96 | 127 |
| image_path | ❌ 不存在 | ✅ 存在 |
| name_pinyin | ❌ 不存在 | ✅ 存在 |
| nature_cn | ❌ 不存在 | ✅ 存在 |
| category_cn | ⚠️ category | ✅ category_cn |
| compounds_count | ✅ | ✅ |

---

## 三、解决方案

### 3.1 后端 API 修改

**无需修改** - RMCHM 端点已支持 `food_homology_only` 参数：

```
GET /api/v1/databases/herbs/rmchm?food_homology_only=true
```

**验证结果**：
```json
{
  "total": 127,
  "items": [
    {
      "name_cn": "八角茴香",
      "image_path": "data/106FAM/八角.jpg",
      "is_food_homology": true,
      ...
    }
  ]
}
```

### 3.2 前端代码修改

**文件**: `frontend/src/pages/database/tabs/HomologyTab.tsx`

#### 修复 1：切换 API 端点

```typescript
// 修复前（错误 - 使用 TCMSP 数据）
const listQuery = useQuery({
  queryKey: ['db-homology-list', keyword, page, effectFilter],
  queryFn: () => databaseApi.getFoodHomologyHerbs({ keyword, page, page_size: 24 }),
});

// 修复后（正确 - 使用 RMCHM 数据）
const listQuery = useQuery({
  queryKey: ['db-homology-list', keyword, page, effectFilter],
  queryFn: () => databaseApi.searchRmchmHerbs({ keyword, food_homology_only: true, page, page_size: 24 }),
});
```

#### 修复 2：添加图片渲染（卡片视图）

```tsx
// 修复前
<div className="w-10 h-10 rounded-xl bg-primary-100 ...">
  <span className="text-lg">🌿</span>
</div>

// 修复后
{item.image_path ? (
  <img
    src={`/static/${item.image_path}`}
    alt={item.name_cn}
    className="w-10 h-10 rounded-xl object-cover flex-shrink-0"
    onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
  />
) : (
  <div className="w-10 h-10 rounded-xl bg-primary-100 ...">
    <span className="text-lg">🌿</span>
  </div>
)}
```

#### 修复 3：添加图片渲染（表格视图）

```tsx
<td className="...">
  <div className="flex items-center gap-2">
    {item.image_path ? (
      <img
        src={`/static/${item.image_path}`}
        alt={item.name_cn}
        className="w-6 h-6 rounded object-cover"
        onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
      />
    ) : (
      <div className="w-6 h-6 rounded bg-primary-100 ...">
        <span className="text-xs">🌿</span>
      </div>
    )}
    <span><Highlight text={item.name_cn} keyword={keyword} /></span>
  </div>
</td>
```

#### 修复 4：字段名兼容

```tsx
// 字段名适配（兼容 TCMSP 和 RMCHM 两种数据结构）
item.name_latin || item.nameLatin || '-'
item.category_cn || item.category || '-'
item.compounds_count || item.compound_count || 0
```

---

## 四、验证结果

### 4.1 图片文件验证

```powershell
# 图片文件存在性
Test-Path "D:\RMFOODFP\backend\static\data\106FAM\八角.jpg"
→ True ✅

# 图片文件大小
Get-Item "D:\RMFOODFP\backend\static\data\106FAM\八角.jpg"
→ Length: 110374 bytes ✅
```

### 4.2 API 访问验证

```bash
# 后端图片访问
GET http://localhost:8000/static/data/106FAM/八角.jpg
→ 200 OK ✅

# 前端代理访问
GET http://localhost:3000/static/data/106FAM/八角.jpg
→ 200 OK ✅

# RMCHM 药食同源 API
GET /api/v1/databases/herbs/rmchm?food_homology_only=true&page_size=5
→ total: 127 ✅
```

### 4.3 数据库验证

```sql
-- 药食同源药材图片分布
SELECT is_food_homology, COUNT(*) as total, 
       COUNT(CASE WHEN image_path IS NOT NULL THEN 1 END) as with_image
FROM rmchm_herbs
GROUP BY is_food_homology;

-- 结果:
-- is_food_homology | total | with_image
-- f                |   587 |          6
-- t                |   127 |        105  ← 127 个药食同源药材中 105 个有图片
```

---

## 五、数据统计

### 5.1 药食同源药材覆盖

| 指标 | TCMSP | RMCHM |
|------|-------|-------|
| 药材总数 | 96 | 127 |
| 有图片药材 | 0 | 105 |
| 图片覆盖率 | 0% | 82.7% |

### 5.2 有图片的药食同源药材（部分）

| 药材名称 | 图片路径 | 类别 |
|---------|---------|------|
| 八角茴香 | data/106FAM/八角.jpg | 温里药 |
| 白扁豆 | data/106FAM/白扁豆.jpg | 补气药 |
| 白果 | data/106FAM/白果.jpg | 止咳平喘药 |
| 白芷 | data/106FAM/白芷.jpg | 解表药 |
| 百合 | data/106FAM/百合.jpg | 润肺止咳药 |
| 薄荷 | data/106FAM/薄荷.jpg | 解表药 |
| 荜茇 | data/106FAM/荜茇.jpg | 温里药 |
| 紫苏 | data/106FAM/紫苏.jpg | 解表药 |
| 草果 | data/106FAM/草果.jpg | 化湿药 |

---

## 六、修复清单

| 项目 | 文件 | 状态 |
|------|------|------|
| API 端点切换 | `HomologyTab.tsx:71` | ✅ 完成 |
| 卡片视图图片渲染 | `HomologyTab.tsx:294-308` | ✅ 完成 |
| 表格视图图片渲染 | `HomologyTab.tsx:346-362` | ✅ 完成 |
| 字段名兼容适配 | `HomologyTab.tsx` | ✅ 完成 |
| 图片文件迁移 | `backend/static/data/106FAM/` | ✅ 已完成 |
| 静态服务配置 | `backend/app/main.py` | ✅ 已配置 |

---

## 七、预期效果

刷新 http://localhost:3000/databases 后：

1. 点击「药食同源」Tab
2. 查看 127 个药食同源药材（来自 RMCHM 数据库）
3. 有图片的药材显示缩略图（如八角茴香、白扁豆、白果等）
4. 无图片的药材显示默认占位符 🌿
5. 卡片视图和表格视图均支持图片显示

---

## 八、后续优化建议

### 8.1 短期优化

| 任务 | 优先级 | 说明 |
|------|--------|------|
| 补全缺失图片 | 🟡 中 | 为 22 个无图片的药食同源药材添加图片 |
| 图片懒加载 | 🟡 中 | 优化大量图片时的页面性能 |

### 8.2 长期优化

| 任务 | 优先级 | 说明 |
|------|--------|------|
| 图片 CDN | 🟢 低 | 提升图片加载速度 |
| 图片压缩 | 🟢 低 | 减少传输大小 |

---

## 九、总结

### 问题根因

**HomologyTab 使用了错误的数据源**：
- 原代码：调用 `/api/v1/databases/herbs/food-homology`（TCMSP 数据）
- 正确做法：调用 `/api/v1/databases/herbs/rmchm?food_homology_only=true`（RMCHM 数据）

TCMSP 数据没有 `image_path` 字段，导致图片无法显示。

### 修复内容

1. ✅ 切换 API 端点至 RMCHM
2. ✅ 添加图片渲染逻辑（卡片视图 + 表格视图）
3. ✅ 适配 RMCHM 字段名（name_latin, category_cn, compounds_count）
4. ✅ 验证图片文件和 API 访问正常

### 验证命令

```bash
# 测试药食同源 API
curl "http://localhost:8000/api/v1/databases/herbs/rmchm?food_homology_only=true&page_size=5"

# 测试图片访问
curl http://localhost:8000/static/data/106FAM/八角.jpg
```

---

**修复完成！请刷新 http://localhost:3000/databases 验证。**
