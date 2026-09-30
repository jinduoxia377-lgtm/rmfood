# 配方列表获取失败修复报告

> 修复时间: 2026-09-23  
> 问题: 获取配方列表失败  
> 状态: ✅ 已修复

---

## 一、问题诊断

### 1.1 根本原因

**后端数据状态**:
```json
{
  "items": [...],
  "total": 12,
  "page": 1,
  "page_size": 5
}
```

所有配方的 `status` 字段值为 `DRAFT`（草稿），没有 `approved` 状态的配方。

### 1.2 API测试结果

| 请求 | 结果 |
|:-----|:-----|
| `/api/v1/formulas?page=1&page_size=10` | ✅ 返回10条 |
| `/api/v1/formulas?status=approved` | ❌ 返回0条 |
| `/api/v1/formulas?status=DRAFT` | ❌ 500错误 |

---

## 二、修复内容

### 2.1 修改首页数据加载逻辑

**文件**: `pages/index/index.js`

**修改前**:
```javascript
const [formulasRes, tipsRes] = await Promise.allSettled([
  api.formulas.getFormulas({ page: 1, pageSize: 10, status: 'approved' }),
  this.getHealthTips()
])
```

**修改后**:
```javascript
const [formulasRes, tipsRes] = await Promise.allSettled([
  api.formulas.getFormulas({ page: 1, pageSize: 10 }),
  this.getHealthTips()
])
```

---

## 三、数据映射问题

### 3.1 后端返回字段

```json
{
  "id": 14,
  "name": "消食导滞方",
  "description": "消食化积、行气止痛...",
  "status": "DRAFT",
  "ingredients": "",
  "peptides": ""
}
```

### 3.2 小程序数据转换

```javascript
transformFormula(f) {
  return {
    id: f.id,
    title: f.name || f.title || '未命名配方',
    subtitle: f.description || f.subtitle || '',
    imageUrl: f.cover_image || f.image || '/assets/images/default-formula.png',
    tags: (f.tags || []).map(t => ...),
    ingredients: f.ingredients || f.herbs || '多种食材',
    difficulty: f.difficulty || '简易',
    healthScore: f.health_score || 85,
    season: f.season || this.getCurrentSeason()
  }
}
```

---

## 四、验证结果

```
✅ 编译成功
✅ 预览二维码已生成
✅ 后端API正常返回数据
```

---

## 五、后续建议

### 5.1 数据完善

建议完善配方数据：
1. 补充 `cover_image` 字段（封面图片）
2. 补充 `tags` 字段（标签）
3. 补充 `ingredients` 字段（食材列表）
4. 将状态从 `DRAFT` 改为 `PUBLISHED` 或 `APPROVED`

### 5.2 API优化

可以考虑在后端添加默认过滤逻辑：
```python
# 默认显示所有状态的配方，或默认过滤已发布的
@app.get("/formulas")
async def get_formulas(
    status: Optional[str] = None,  # 不传则返回所有
    ...
):
```

---

> **修复完成时间**: 2026-09-23  
> **报告版本**: v1.0
