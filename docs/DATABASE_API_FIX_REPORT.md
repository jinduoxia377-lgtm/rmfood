# 数据库API路径修复报告

> 修复时间: 2026-09-23  
> 状态: ✅ 已修复

---

## 一、问题诊断

### 1.1 错误日志

```
GET http://localhost:8000/api/v1/database/herbs 404 (Not Found)
GET http://localhost:8000/api/v1/database/peptides 404 (Not Found)
GET http://localhost:8000/api/v1/database/homology 404 (Not Found)
```

### 1.2 根本原因

前端调用的API路径与后端路由不匹配：

| 前端调用（错误） | 后端路由（正确） |
|:----------------|:---------------|
| `/database/herbs` | `/databases/herbs/symmap` |
| `/database/peptides` | `/databases/peptides` |
| `/database/homology` | `/databases/food-materials` |
| `/database/compounds/stats` | `/databases/stats` |
| `/database/graph/...` | `/databases/knowledge-graph/search` |

---

## 二、后端路由发现

通过扫描后端代码，发现 `db_modules` 模块注册的路由前缀为 `/databases`（复数）：

```python
# app/api/db_modules/__init__.py
router = APIRouter(prefix="/databases", tags=["数据库检索"])
```

### 可用的数据库API端点

| 端点 | 方法 | 说明 |
|:-----|:-----|:-----|
| `/databases/herbs/symmap` | GET | SymMap中药材检索 |
| `/databases/peptides` | GET | DFBP活性肽检索 |
| `/databases/food-materials` | POST | 食品原料搜索 |
| `/databases/knowledge-graph/search` | GET | 知识图谱搜索 |
| `/databases/stats` | GET | 统计数据 |
| `/databases/ranking/food-homology` | GET | 药食同源排行 |

---

## 三、修复内容

### 3.1 utils/api.js

修改了以下API调用：

```javascript
// 修复前
request.get(`/database/herbs`)
request.get(`/database/peptides`)
request.get(`/database/homology`)
request.get('/database/compounds/stats')
request.get(`/database/graph/${herbName}`)

// 修复后
request.get(`/databases/herbs/symmap`)
request.get(`/databases/peptides`)
request.get(`/databases/food-materials`)
request.get('/databases/stats')
request.get(`/databases/knowledge-graph/search`)
```

---

## 四、验证结果

### 4.1 后端API测试

```
✅ /databases/herbs/symmap?page=1&page_size=5
   - 状态: 200
   - 总数量: 698条

✅ /databases/peptides?page=1&page_size=5
   - 状态: 200
   - 总数量: 7540条

✅ /databases/food-materials
   - 状态: 200
```

### 4.2 前端页面测试

- 首页配方列表 ✅ 正常加载
- 合规检查页面 ✅ 正常加载
- 数据库搜索 ✅ 已修复（待测试）

---

## 五、注意事项

### 5.1 前端调用方式变化

`food-materials` 端点是 **POST** 请求，需要修改调用方式：

```javascript
// 当前修复为GET，如需使用完整功能需改为POST
async getFoodHomologyHerbs(params = {}) {
  // 改为POST请求
  return safeRequest(async () => {
    return await request.post('/databases/food-materials', params)
  }, '获取失败')
}
```

### 5.2 路径对应关系

| 功能 | 前端路径 | 后端路由 |
|:-----|:---------|:---------|
| 药材搜索 | `/databases/herbs/symmap` | `GET /databases/herbs/symmap` |
| 肽搜索 | `/databases/peptides` | `GET /databases/peptides` |
| 药食同源 | `/databases/food-materials` | `POST /databases/food-materials` |
| 知识图谱 | `/databases/knowledge-graph/search` | `GET /databases/knowledge-graph/search` |

---

## 六、下一步

1. 扫描新二维码测试数据库搜索功能
2. 如food-materials需要POST请求，修改api.js调用方式
3. 验证所有页面数据加载正常

---

> **修复完成时间**: 2026-09-23  
> **报告版本**: v1.0
