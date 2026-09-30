# 配方生成数据补全 - 快速使用指南

## 问题说明

原配方生成模块使用了大量硬编码的假数据（`_BUILTIN_HERBS`），不符合"实际数据必须调用数据库完整数据"的要求。

## 解决方案

已创建以下脚本和修改：

### 1. 新增脚本

| 脚本 | 用途 |
|------|------|
| `recipe_generation_data_completer.py` | 填充 TCMHerb 表的 extra_knowledge 字段 |
| `recipe_generation_data_checker.py` | 验证数据完整性 |
| `recipe_generation_data_initializer.py` | 启动时自动初始化 |
| `verify_recipe_generation_data.py` | 快速验证脚本 |

### 2. 修改的核心文件

- `formula_designer.py` - 添加数据来源检测
- `bayesian_formula_optimizer.py` - 移除静默回退
- `algorithm.py` - 强制数据库加载
- `evaluator.py` - 添加数据完整性校验
- `generation.py` - API 层数据验证
- `main.py` - 启动时数据检查

---

## 立即执行

```bash
# 进入后端目录
cd D:\RMFOODFP\backend

# 1. 验证当前数据状态
python -m app.services.verify_recipe_generation_data

# 2. 如果数据不完整，运行补全
python -m app.services.recipe_generation_data_completer

# 3. 再次验证
python -m app.services.verify_recipe_generation_data
```

---

## 验证结果示例

### 成功输出
```
============================================================
配方生成数据验证
============================================================

[1] 数据库连接...
    ✅ 连接成功，TCMHerb 表共有 319 条记录

[2] 检查 extra_knowledge 字段...
    有知识数据: 315/319 (98.7%)

[3] 测试 HerbKnowledgeAdapter...
    ✅ 适配器工作正常，加载 319 种药材

[4] 样本药材:
    - 黄芪: 4 项功效, 安全指数 0.95
    - 人参: 4 项功效, 安全指数 0.85
    ...

[5] 功效索引:
    功效类别数: 28
    - 免疫调节: 45 种药材
    - 抗氧化: 38 种药材
    ...

============================================================
✅ 数据验证通过，配方生成功能可用
```

### 需要补全的输出
```
⚠️  知识数据覆盖率不足 80%，建议运行补全脚本
    命令: python -m app.services.recipe_generation_data_completer
```

---

## API 调用时的日志

成功时使用数据库数据：
```
[数据完整性] ✅ 使用数据库数据: 319 种药材
[NSGA-II] ✅ 数据库加载成功: 319 种药材, 28 种功效
```

失败时抛出明确错误：
```
[数据完整性] 数据库药材不足: 实际 5 种, 最低要求 20 种
RuntimeError: 数据库药材数据不足...
```

---

## 注意事项

1. **首次运行必须补全数据**
   ```bash
   python -m app.services.recipe_generation_data_completer
   ```

2. **硬编码数据保留但标记为测试用途**
   - `_BUILTIN_HERBS` 仅用于单元测试
   - 生产环境不会使用

3. **数据库必须有数据**
   - 确保已运行 `init_db()` 或种子脚本
   - 至少 50 种药材，40 种有 extra_knowledge

---

## 相关文件

- 详细报告: `docs/recipe-generation-data-completeness-report.md`
- 补全脚本: `backend/app/services/recipe_generation_data_completer.py`
- 验证脚本: `backend/app/services/verify_recipe_generation_data.py`
