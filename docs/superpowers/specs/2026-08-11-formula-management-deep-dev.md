# 配方管理功能深度开发计划

> 生成时间：2026-08-11
> 目标页面：http://localhost:3000/formulas?sort_field=updated_at&sort_dir=desc

## 现状分析

### 前端
- `FormulaListPage.tsx`（2040行）：功能非常完善，支持双视图、虚拟滚动、URL参数同步、双字段排序、操作日志、权限控制
- `useFormulaManager.ts`（1710行）：本地配方管理 Hook，功能丰富（v8.0）
- `api/formula.ts`：API 调用层，定义了完整的 API 接口
- `types/formula.ts`：类型定义丰富，涵盖 20+ 种数据结构

### 后端
- `formulas.py`：路由层，仅 422 行，覆盖基础 CRUD + 版本 + 审核
- `formula_module.py`：服务层，核心业务逻辑
- `deps.py`：依赖注入层，筛选参数定义不完整
- 缺少：排序支持、标签/分类筛选、操作日志 API、导入导出 API、批量删除

---

## 发现的问题清单

### 🔴 P0：阻断性问题（功能不可用）

#### P0-1：后端分页响应格式不匹配
- **现象**：前端 `listData?.data` 始终为 undefined
- **根因**：
  - 后端返回：`{"items": [...], "total": N, "page": P, "page_size": S}`
  - 前端期望：`{"data": [...], "total": N, "total_pages": T}`
- **位置**：`backend/app/api/formulas.py` L101-106

#### P0-2：后端排序完全缺失
- **现象**：URL 参数 `sort_field=updated_at&sort_dir=desc` 被忽略
- **根因**：
  - `FormulaFilterParams` 无排序字段
  - `list_formulas` 方法硬编码 `order_by(Formula.updated_at.desc())`
- **位置**：`backend/app/api/deps.py` L296-306，`backend/app/services/formula/formula_module.py` L183

#### P0-3：后端筛选参数缺失
- **现象**：tags、category、effect_category、日期范围筛选无效
- **根因**：`list_formulas` 方法未实现这些过滤逻辑
- **位置**：`backend/app/services/formula/formula_module.py` L141-187

### 🟡 P1：功能缺失

#### P1-1：缺少 4 个 API 端点
| 端点 | 前端状态 | 后端状态 |
|------|----------|----------|
| `GET /formulas/logs` | 有 `OperationLogPanel` 组件 | ❌ 不存在 |
| `GET /formulas/permissions/check` | 有权限检查逻辑 | ❌ 不存在 |
| `POST /formulas/import` | 有导入功能 | ❌ 不存在 |
| `POST /formulas/export` | 有导出功能 | ❌ 不存在 |
| `POST /formulas/batch-delete` | 有批量删除 | ❌ 不存在 |

#### P1-2：字段映射不完整
- 前端显示 `formula.experimentIds`（实验数量）→ 后端无此字段
- 前端显示 `formula.ingredientCount` → 后端无此聚合字段
- 后端返回 `target_effects` → 前端期望 `targetEffects`（驼峰命名不一致）

#### P1-3：统计分析 API 数据不完整
- 当前仅返回：`total_formulas` + `status_distribution`
- 前端期望：`recent_creations`、`trend_data`、`top_creators`、`approval_stats`

---

## 开发计划

### 阶段一：修复 P0 问题（核心功能可用）

#### 任务 1.1：修复后端分页响应格式
**文件**：`backend/app/api/formulas.py`

将响应从：
```python
return {
    "items": formula_responses,
    "total": total,
    "page": pagination.page,
    "page_size": pagination.page_size,
}
```
改为：
```python
import math
return {
    "data": formula_responses,
    "total": total,
    "total_pages": math.ceil(total / pagination.page_size),
    "page": pagination.page,
    "page_size": pagination.page_size,
}
```

---

#### 任务 1.2：扩展筛选参数
**文件**：`backend/app/api/deps.py`

修改 `FormulaFilterParams` 类：
```python
class FormulaFilterParams:
    def __init__(
        self,
        status: Optional[str] = Query(None, description="配方状态"),
        creator_id: Optional[int] = Query(None, description="创建者ID"),
        search: Optional[str] = Query(None, description="搜索关键词"),
        tags: Optional[str] = Query(None, description="标签ID逗号分隔"),
        category: Optional[str] = Query(None, description="分类ID逗号分隔"),
        effect_category: Optional[str] = Query(None, description="功效分类"),
        created_start: Optional[str] = Query(None, description="创建开始日期"),
        created_end: Optional[str] = Query(None, description="创建结束日期"),
        updated_start: Optional[str] = Query(None, description="更新开始日期"),
        updated_end: Optional[str] = Query(None, description="更新结束日期"),
        sort_field: Optional[str] = Query("updated_at", description="排序字段"),
        sort_order: Optional[str] = Query("desc", description="排序方向"),
        sort_field2: Optional[str] = Query(None, description="次排序字段"),
        sort_order2: Optional[str] = Query("asc", description="次排序方向"),
        favorites_only: Optional[bool] = Query(False, description="仅收藏"),
    ):
        self.status = status
        self.creator_id = creator_id
        self.search = search
        self.tags = tags
        self.category = category
        self.effect_category = effect_category
        self.created_start = created_start
        self.created_end = created_end
        self.updated_start = updated_start
        self.updated_end = updated_end
        self.sort_field = sort_field
        self.sort_order = sort_order
        self.sort_field2 = sort_field2
        self.sort_order2 = sort_order2
        self.favorites_only = favorites_only
```

---

#### 任务 1.3：实现后端筛选和排序逻辑
**文件**：`backend/app/services/formula/formula_module.py`

修改 `list_formulas` 方法：
```python
async def list_formulas(
    self,
    page: int = 1,
    page_size: int = 20,
    status: Optional[FormulaStatus] = None,
    creator_id: Optional[int] = None,
    search: Optional[str] = None,
    tags: Optional[list[int]] = None,
    category: Optional[list[int]] = None,
    created_start: Optional[str] = None,
    created_end: Optional[str] = None,
    updated_start: Optional[str] = None,
    updated_end: Optional[str] = None,
    sort_field: str = "updated_at",
    sort_order: str = "desc",
    sort_field2: Optional[str] = None,
    sort_order2: str = "asc",
    favorites_only: bool = False,
    organization_id: Optional[int] = None,
    include_deleted: bool = False,
) -> tuple[list[Formula], int]:
    """配方列表（分页 + 过滤 + 搜索 + 排序）"""
    from datetime import datetime
    
    # 排序字段映射
    sort_map = {
        "name": Formula.name,
        "status": Formula.status,
        "created_at": Formula.created_at,
        "updated_at": Formula.updated_at,
        "version": Formula.version,
    }
    
    primary_sort = sort_map.get(sort_field, Formula.updated_at)
    primary_order = primary_sort.desc() if sort_order == "desc" else primary_sort.asc()
    
    query = select(Formula).options(
        selectinload(Formula.creator),
        selectinload(Formula.ingredients),
        selectinload(Formula.peptides),
        selectinload(Formula.tags),
        selectinload(Formula.categories),
    )
    
    # 软删除过滤
    if not include_deleted and hasattr(Formula, 'deleted_at'):
        query = query.where(Formula.deleted_at.is_(None))
    
    # 多租户隔离
    if organization_id is not None:
        query = query.where(Formula.organization_id == organization_id)
    
    # 状态过滤
    if status:
        query = query.where(Formula.status == status)
    
    # 创建者过滤
    if creator_id:
        query = query.where(Formula.creator_id == creator_id)
    
    # 搜索
    if search:
        pattern = f"%{search}%"
        query = query.where(
            Formula.name.ilike(pattern)
            | Formula.code.ilike(pattern)
            | Formula.description.ilike(pattern)
        )
    
    # 标签过滤
    if tags:
        query = query.join(Formula.tags).where(Tag.id.in_(tags))
    
    # 分类过滤
    if category:
        query = query.join(Formula.categories).where(Category.id.in_(category))
    
    # 日期范围
    if created_start:
        query = query.where(Formula.created_at >= datetime.fromisoformat(created_start))
    if created_end:
        query = query.where(Formula.created_at <= datetime.fromisoformat(created_end) + timedelta(days=1))
    if updated_start:
        query = query.where(Formula.updated_at >= datetime.fromisoformat(updated_start))
    if updated_end:
        query = query.where(Formula.updated_at <= datetime.fromisoformat(updated_end) + timedelta(days=1))
    
    # 收藏过滤
    if favorites_only:
        # 需要前端传入收藏的配方 ID 列表，或存储到 Redis/数据库
        # 这里暂不做实现，返回空列表
        pass
    
    # 总数
    count_q = select(func.count()).select_from(query.subquery())
    total = (await self.db.execute(count_q)).scalar() or 0
    
    # 排序
    query = query.order_by(primary_order)
    if sort_field2:
        secondary_sort = sort_map.get(sort_field2, Formula.updated_at)
        secondary_order = secondary_sort.desc() if sort_order2 == "desc" else secondary_sort.asc()
        query = query.order_by(primary_order, secondary_order)
    
    # 分页
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await self.db.execute(query)
    
    return list(result.scalars().all()), total
```

---

#### 任务 1.4：添加缺失的 API 端点
**文件**：`backend/app/api/formulas.py`

新增端点：

```python
# ── 操作日志 ──
@router.get("/logs", summary="获取操作日志")
async def get_operation_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    start_date: Optional[str] = Query(None),
    end_date: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    target_type: Optional[str] = Query(None),
    result: Optional[str] = Query(None),
    current_user: User = Depends(require_role(UserRole.ADMIN, UserRole.REVIEWER)),
    db: AsyncSession = Depends(get_db_session),
):
    from sqlalchemy import desc
    query = select(AuditLog).where(AuditLog.entity_type == "formula")
    if start_date:
        query = query.where(AuditLog.created_at >= datetime.fromisoformat(start_date))
    if end_date:
        query = query.where(AuditLog.created_at <= datetime.fromisoformat(end_date))
    if action:
        query = query.where(AuditLog.action == action)
    if target_type:
        query = query.where(AuditLog.entity_type == target_type)
    if result:
        query = query.where(AuditLog.status_code >= 400 if result == "failure" else AuditLog.status_code < 400)
    
    query = query.order_by(desc(AuditLog.created_at))
    count_q = select(func.count()).select_from(query.subquery())
    total = (await db.execute(count_q)).scalar() or 0
    
    query = query.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(query)
    logs = result.scalars().all()
    
    return {
        "data": [{
            "id": str(log.id),
            "operatorId": str(log.user_id) if log.user_id else "",
            "operatorName": log.username or "",
            "operatorRole": log.user_role or "",
            "action": log.action or "",
            "target_type": log.entity_type or "",
            "target_id": str(log.entity_id) if log.entity_id else "",
            "target_name": str(log.details.get("target_name", "")) if log.details else "",
            "details": log.details or {},
            "result": "success" if (log.status_code or 200) < 400 else "failure",
            "created_at": log.created_at.isoformat(),
        } for log in logs],
        "total": total,
    }

# ── 权限检查 ──
@router.get("/permissions/check", summary="检查权限")
async def check_permission(
    permission: str = Query(..., description="权限字符串"),
    current_user: User = Depends(get_current_active_user),
):
    from ..api.deps import _get_user_permissions
    permissions = _get_user_permissions(current_user)
    has_perm = permission in permissions or "*" in permissions
    return {"has_permission": has_perm}

@router.get("/permissions", summary="获取用户权限列表")
async def get_user_permissions(
    current_user: User = Depends(get_current_active_user),
):
    from ..api.deps import _get_user_permissions
    permissions = _get_user_permissions(current_user)
    return {"permissions": permissions}

# ── 批量删除 ──
@router.post("/batch-delete", summary="批量删除配方")
async def batch_delete_formulas(
    request: dict = Body(...),
    current_user: User = Depends(require_role(UserRole.FORMULATOR, UserRole.ADMIN)),
    db: AsyncSession = Depends(get_db_session),
):
    ids = request.get("ids", [])
    service = FormulaService(db)
    success = 0
    for formula_id in ids:
        try:
            await service.delete_formula(int(formula_id), current_user.id)
            success += 1
        except Exception as e:
            logger.warning(f"批量删除失败 {formula_id}: {e}")
    return {"success": success, "failed": len(ids) - success}
```

---

### 阶段二：增强统计分析（P1）

#### 任务 2.1：完善统计 API
**文件**：`backend/app/api/formulas.py`

修改 `get_formula_statistics` 端点，返回完整数据。

---

### 阶段三：前端对接验证（P2）

#### 任务 3.1：验证排序功能
- 刷新页面，确认 URL 参数生效
- 点击表头排序，确认后端排序生效

#### 任务 3.2：验证筛选功能
- 测试状态筛选
- 测试标签筛选
- 测试日期范围筛选

#### 任务 3.3：验证操作日志
- 点击「操作日志」按钮
- 确认日志数据正常显示

---

## 优先级排序

1. **P0-1**：修复响应格式（2行改动）
2. **P0-2**：扩展筛选参数（5行改动）
3. **P0-3**：实现筛选/排序逻辑（100行改动）
4. **P1-1**：添加缺失端点（150行改动）
5. **P1-3**：完善统计 API（50行改动）

---

## 验证标准

- [ ] `GET /api/v1/formulas` 返回正确格式 `{"data": [...], "total": N, "total_pages": T}`
- [ ] `sort_field=updated_at&sort_dir=desc` 参数生效
- [ ] `tags`、`category`、`created_start`、`created_end` 筛选生效
- [ ] `GET /api/v1/formulas/logs` 返回操作日志
- [ ] `GET /api/v1/formulas/permissions/check?permission=formula:view` 返回权限结果
- [ ] `POST /api/v1/formulas/batch-delete` 批量删除成功
- [ ] 前端列表页数据正常显示
- [ ] 前端排序/筛选功能正常

---

## 影响范围

- **后端改动**：
  - `backend/app/api/deps.py` — 扩展筛选参数
  - `backend/app/services/formula/formula_module.py` — 实现筛选/排序逻辑
  - `backend/app/api/formulas.py` — 修复响应格式 + 新增端点

- **前端改动**：
  - 无（前端代码已完善，后端修复后自动生效）
