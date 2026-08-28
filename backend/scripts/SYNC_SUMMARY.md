# TCMSP 中药材数据同步修复报告

## 问题诊断

### 发现的问题
1. **数据库只有 21 种药材**，而 TCMSP 知识库有 289 种
2. **根本原因**：数据库表有 `name` 字段（NOT NULL），但同步脚本未提供该字段值
3. **次要问题**：DFBP 肽统计 `total_peptides` 显示 100 而非 7540（需重启后端）

## 修复内容

### 1. 完成中药材数据同步
- 执行 `scripts/sync_herbs.py` 脚本
- 成功插入 274 种缺失药材
- 数据库现有 295 种药材（包含原有 21 种 + 新增 274 种）

### 2. 后端代码修复（待重启生效）
- 修复 `dfbp_client.py` 的 `get_sync_stats()` 方法
- 修复 `tcmsp_client.py` 的 `get_sync_stats()` 方法
- 改进异常处理逻辑，避免静默降级到内存知识库

### 3. 前端容错机制
- 在 `DatabasePage.tsx` 中添加备用数据源查询
- 当 sync/stats 数据异常时，自动从 dashboard/overview 获取正确数据

## 验证结果

| 指标 | 修复前 | 修复后 |
|------|--------|--------|
| 中药材总数 | 21 | **295** ✅ |
| 活性肽总数 | 100 (错误) | 7540 (需重启) |
| 知识图谱节点 | 9269 | 9269 ✅ |

## 后续步骤

**需要重启后端服务以使 DFBP 修复生效：**
```powershell
# 停止现有服务
taskkill /F /IM python.exe

# 重新启动
cd D:\RMFOODFP\backend
.\.venv\Scripts\python.exe -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

重启后验证：
```bash
curl http://localhost:8000/api/v1/databases/sync/stats
# 应显示 "total_peptides": 7540
```
