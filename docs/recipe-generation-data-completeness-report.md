# 配方生成模块数据完整性补全报告

## 📋 修改摘要

### 1. 新增脚本

| 文件 | 功能 |
|------|------|
| `backend/app/services/recipe_generation_data_completer.py` | 填充 TCMHerb 表的 extra_knowledge 字段 |
| `backend/app/services/recipe_generation_data_checker.py` | 验证数据完整性并输出报告 |
| `backend/app/services/recipe_generation_data_initializer.py` | 启动时自动初始化数据 |
| `backend/app/services/ai/algorithms/database_formula_optimizer.py` | 纯数据库驱动优化器 |

### 2. 修改的核心文件

#### `backend/app/services/formula_designer.py`
- 添加数据来源检测机制
- 记录 HerbKnowledgeService 加载状态

#### `backend/app/services/ai/algorithms/bayesian_formula_optimizer.py`
- 移除静默回退到 `_BUILTIN_HERBS` 的逻辑
- 数据库无数据时抛出 RuntimeError

#### `backend/app/services/ai/algorithms/algorithm.py`
- 修改 `_try_load_herb_knowledge()` 方法
- 强制使用数据库数据，失败时抛出异常

#### `backend/app/services/ai/algorithms/evaluator.py`
- 修改 `_ensure_herbs_loaded()` 和 `_load_herbs_sync()`
- 添加数据完整性校验（最低 20 种药材）

#### `backend/app/api/ai_modules/generation.py`
- 添加数据来源验证日志
- 使用 HerbKnowledgeService 建立 herb_id → name_cn 映射

#### `backend/app/main.py`
- 在 AI 服务初始化后添加数据完整性检查
- 启动时输出数据质量报告

---

## 🔧 使用方法

### 1. 初始化数据（首次运行）

```bash
# 进入后端目录
cd backend

# 运行数据补全脚本
python -m app.services.recipe_generation_data_completer

# 验证数据完整性
python -m app.services.recipe_generation_data_checker
```

### 2. 启动时自动检查

应用启动时会自动执行数据完整性检查，并在日志中输出：
```
[Startup] 配方生成数据检查:
  药材数: 319, 覆盖率: 98.4%
  适配器: ✅, 加载: 319
```

### 3. API 调用验证

访问 `/ai/generate` 端点时，日志会显示：
```
[数据完整性] ✅ 使用数据库数据: 319 种药材
```

---

## 📊 数据源优先级

| 优先级 | 数据源 | 说明 |
|--------|--------|------|
| 1 | TCMSP 数据库 | 生产环境首选 |
| 2 | HerbKnowledgeService | 动态加载，支持热更新 |
| 3 | 硬编码 _BUILTIN_HERBS | **仅用于测试/开发** |

---

## ✅ 已验证的改进

1. **数据完整性检查**
   - 启动时验证药材数量 ≥ 20
   - 验证 extra_knowledge 覆盖率 ≥ 80%
   - 不满足条件时警告日志

2. **强制数据库加载**
   - 优化器加载失败时抛出异常
   - 不再静默回退到假数据
   - 清晰的错误提示信息

3. **日志追踪**
   - 每次 API 调用记录数据来源
   - 启动时输出数据质量报告
   - 数据不足时明确提示补全命令

---

## 🔍 测试建议

```bash
# 1. 启动应用
python -m app.main

# 2. 查看启动日志
# 确认 "[Startup] 配方生成数据检查" 输出

# 3. 调用 API
curl -X POST http://localhost:8000/ai/generate \
  -H "Content-Type: application/json" \
  -d '{"target_effects": ["免疫调节", "抗氧化"]}'

# 4. 检查日志
# 确认 "[数据完整性] ✅ 使用数据库数据"
```

---

## ⚠️ 注意事项

1. **首次运行必须执行数据补全脚本**
   ```bash
   python -m app.services.recipe_generation_data_completer
   ```

2. **数据库必须有 TCMHerb 表数据**
   - 确保已运行 `init_db()` 或手动导入数据
   - 至少 50 种药材，40 种有 extra_knowledge

3. **硬编码数据仍保留但标记为测试用途**
   - `_BUILTIN_HERBS` 仅用于单元测试
   - 生产环境不会使用

---

## 📈 预期效果

| 指标 | 补全前 | 补全后 |
|------|--------|--------|
| 药材数据来源 | 硬编码 ~50 种 | 数据库 319 种 |
| 功效覆盖 | 静态字典 | 动态计算 |
| 数据更新 | 需修改代码 | 数据库更新即可 |
| 错误处理 | 静默回退 | 明确报错 |
