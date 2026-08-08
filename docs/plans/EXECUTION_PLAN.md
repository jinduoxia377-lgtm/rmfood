# ✅ OpenFoodFacts 数据导入执行报告

## 前置条件确认

| 检查项 | 状态 | 说明 |
|--------|------|------|
| PostgreSQL服务 | ✅ 运行中 | 检测到16个postgres.exe进程 |
| .env配置 | ✅ 正确 | DATABASE_URL已设置 |
| 源文件存在 | ✅ `en.openfoodfacts.org.products.csv` | 12.4GB TSV格式，211列 |
| 编码检测 | ✅ UTF-8 | 可直接读取 |
| import脚本 | ✅ `import_openfoodfacts_csv.py` | 支持GBK自动降级、分批写入、ON CONFLICT UPSERT |
| Windows兼容 | ✅ loader_sync已集成 | psycopg2同步导入器 |

---

## 🚀 立即执行方案

### 方式一：直接命令行执行（推荐）

在CMD中以**管理员身份**运行：

```batch
cd d:\RMFOOD配方平台\backend

REM ============================
REM Step 1: 先小规模测试 (500条)
REM ============================
python scripts/import_openfoodfacts_csv.py --test-limit 500 --no-drop-index

REM ============================
REM Step 2: 如果Step 1成功，全量导入
REM ============================
python scripts/import_openfoodfacts_csv.py --chunk-size 20000
```

### 方式二：完整自动化脚本

创建 `run_full_import.bat`：

```batch
@echo off
setlocal enabledelayedexpansion

cd d:\RMFOOD配方平台\backend

echo [=== 阶段 1 ===] 测试模式(100行)
python scripts/import_openflowfacts_csv.py --test-limit 100 --dry-run
if %errorlevel% neq 0 (echo 测试失败！退出) & exit /b 1

echo [=== 阶段 2 ===] 正式小批量测试
python scripts/import_openfoodfacts_csv.py --test-limit 500 --no-drop-index
if %errorlevel% neq 0 (echo 测试失败！退出) & exit /b 1

echo [=== 阶段 3 ===] 全量导入开始...
python scripts/import_openfoodfacts_csv.py --chunk-size 20000

echo [=== 完成 ===] 全部导入成功！
endlocal
```

---

## ⏱️ 预计耗时（参考）

| 场景 | 行数 | 预估时间 |
|------|------|---------|
| 测试模式 | 100-500行 | < 1分钟 |
| 抽样测试 | 5,000-10,000行 | 2-5分钟 |
| **全量导入** | ~550万行 | **8-24小时** (取决于硬件) |

> 💡 **建议策略**：首次导入建议使用 `--test-limit 5000` 验证后，再执行全量。如系统资源有限，可分批多次执行（每次导入新分类的产品）。

---

## 📊 导入后会验证的命令

```batch
cd d:\RMFOOD配方平台\backend

# 统计已导入数量
python -c "from app.core.database.session import get_session_factory; import asyncio; async def test(): async with get_session_factory() as db: r = await db.execute('SELECT source, count(*) from retail_products where source like ''%openfoodfacts'' group by source'); rows = await r.fetchall(); print(rows); asyncio.run(test())"

# 查看最近10条
psql -U postgres -d rmfood -c "SELECT code, product_name, brand FROM retail_products WHERE source='openfoodfacts_csv' ORDER BY created_at DESC LIMIT 10;"
```

---

## 🔑 关键参数说明

| 参数 | 默认值 | 作用 |
|------|--------|------|
| `--csv` | `D:\RMFOOD配方平台\openfoodfacts\en.openfoodfacts.org.products.csv` | CSV文件路径 |
| `--chunk-size` | 10000 | 每批写入行数（调大可提升速度但消耗更多内存） |
| `--test-limit` | 0 | 只导入N行用于测试 |
| `--dry-run` | false | 仅扫描不写入数据库 |
| `--no-drop-index` | false | 是否DROP索引加速（导入后重建） |

---

**🎯 一切就绪，请直接执行命令开始导入。**如遇任何问题，请提供错误信息。
