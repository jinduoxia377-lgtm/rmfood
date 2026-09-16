# RMCHM 数据加载失败修复报告

**问题**：前端提示"❌ 数据加载失败，请刷新页面重试"  
**根因**：`frontend/src/api/database.ts` 缺少 RMCHM API 方法  
**状态**：✅ 已修复

---

## 一、问题定位

### 1.1 错误路径

```
用户点击 RMCHM 按钮
    ↓
setDataSource('rmchm')
    ↓
rmchmQuery.enabled = true
    ↓
调用 databaseApi.searchRmchmHerbs()  ❌ 方法不存在！
    ↓
报错：TypeError: databaseApi.searchRmchmHerbs is not a function
    ↓
herbData.isError = true
    ↓
显示错误提示："❌ 数据加载失败，请刷新页面重试"
```

### 1.2 缺失内容

| 组件 | 状态 |
|------|------|
| `frontend/src/types/index.ts` | ✅ 有 RMCHMHerb/RMCHMStats 类型 |
| `frontend/src/pages/database/tabs/HerbsTab.tsx` | ✅ 有 rmchmQuery hook |
| `frontend/src/api/database.ts` | ❌ **缺少 searchRmchmHerbs 等方法** |

---

## 二、修复内容

### 2.1 新增 API 方法

**文件**: `frontend/src/api/database.ts`

```typescript
// 在 SymMap 方法后添加

/** RMCHM 莱茵中药材检索 */
searchRmchmHerbs: (params: {
  keyword?: string
  category?: string
  food_homology_only?: boolean
  min_quality?: number
  page?: number
  page_size?: number
}) => api.get<any>('/databases/herbs/rmchm', { params }).then((r) => r.data),

/** RMCHM 数据统计 */
getRmchmStats: () => api.get<any>('/databases/herbs/rmchm/stats').then((r) => r.data),

/** RMCHM 药材详情 */
getRmchmHerb: (rmchmId: string) => api.get<any>(`/databases/herbs/rmchm/${rmchmId}`).then((r) => r.data),
```

---

## 三、完整修复清单

### 3.1 后端（已完成）

| 文件 | 状态 |
|------|------|
| `backend/app/models/external_data.py` | ✅ RMCHMHerb 模型 |
| `backend/app/api/db_modules/herbs.py` | ✅ 3个API端点 |
| `backend/app/models/models.py` | ✅ 导出RMCHMHerb |
| PostgreSQL rmchm_herbs | ✅ 714条数据 |
| PostgreSQL rmchm_herb_compounds | ✅ 19,020条 |
| PostgreSQL rmchm_herb_targets | ✅ 21,613条 |
| PostgreSQL rmchm_herb_diseases | ✅ 24,251条 |

### 3.2 前端（已完成）

| 文件 | 修复项 | 状态 |
|------|--------|------|
| `types/index.ts` | RMCHMHerb/RMCHMStats 类型 | ✅ |
| `api/database.ts` | searchRmchmHerbs 等方法 | ✅ 刚修复 |
| `api/database.mock.ts` | Mock 数据方法 | ✅ |
| `tabs/HerbsTab.tsx` | DataSource 类型 | ✅ |
| `tabs/HerbsTab.tsx` | rmchmQuery hook | ✅ |
| `tabs/HerbsTab.tsx` | isRmchm 函数 | ✅ |
| `tabs/HerbsTab.tsx` | RMCHM 切换按钮 | ✅ |

---

## 四、验证结果

### 4.1 后端API测试

```bash
# 测试成功
GET /api/v1/databases/herbs/rmchm?page=1&page_size=5
# 返回: 714条数据，首条为"阿胶"
```

### 4.2 前端代码检查

```
✅ DataSource 类型包含 'rmchm'
✅ rmchmQuery hook 已定义
✅ isRmchm 函数已添加
✅ RMCHM 切换按钮已添加
✅ searchRmchmHerbs API 方法已添加
```

---

## 五、预期效果

刷新 http://localhost:3000/databases 后：

```
┌─────────────────────────────────────────────────────────────┐
│  数据源： [TCMSP (502)] [SymMap (698)] [RMCHM (714) NEW]    │
├─────────────────────────────────────────────────────────────┤
│  搜索：[药材名称、拉丁名、拼音、别名...]     [搜索]          │
├─────────────────────────────────────────────────────────────┤
│  药材名称 | 拉丁名 | 分类 | 四气 | 归经 | OB% | 药食同源 | 质量 │
│  ─────────────────────────────────────────────────────────  │
│  阿胶     | Asini.. | 补虚药 | 甘,平 | 肺,肝,肾 | - | ✓ | 0.50 │
│  阿魏     | Ferula..| 消食药 | 苦,辛,温 | 脾,胃 | - | - | 0.40 │
│  ...                                                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 六、数据概览

| 项目 | 数量 |
|------|------|
| 药材总数 | 714 |
| 药食同源 | 127 (17.8%) |
| 化合物 | 19,020 |
| 靶点 | 21,613 |
| 疾病 | 24,251 |

---

**修复完成！请刷新页面验证。**
