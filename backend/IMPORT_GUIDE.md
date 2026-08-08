===== OpenFoodFacts Windows 导入执行指南 =====

问题总结：
- asyncpg 驱动在 Windows 上存在连接稳定性问题（任何连接都会失败）
- 中文字符路径导致编码冲突，使 psycopg2 也出现 UnicodeDecodeError
- PostgreSQL 服务正常运行 (postgresql-x64-18)

推荐方案（按可靠性排序）：

方案 A（推荐）：将项目移至无 Unicode 路径
1. 创建新目录: D:\rmfood
2. 将当前整个项目复制到 D:\rmfood\backend
3. 在 D:\rmfood\backend 中运行:
   python scripts/import_openfoodfacts_csv.py --test-limit 500 --no-drop-index

方案 B：使用 WSL（Windows Subsystem for Linux）
1. 在 Ubuntu (WSL) 中挂载 Windows 文件系统
2. 安装 Python 依赖: pip install -r requirements.txt
3. 运行导入脚本（在纯 Linux 环境中，所有问题都将消失）

方案 C：在当前路径下使用 sync 导入（已修复版本）
确保已安装 psycopg2: pip install psycopg2-binary
运行以下命令（在 VS Code 终端中）：

cd D:\RMFOOD配方平台\backend
set PYTHONUTF8=1
python -c "import sys; sys.flags.utf8_mode = 1"
python scripts/import_offsync.py --test-limit 500 --no-drop-index

预期行为：
- 如果连接成功，将看到 "SUCCESS: Connected!" 或类似消息
- 然后开始 CSV 扫描和导入
- 500 行测试完成后显示摘要统计

故障排除：
1. 如果连接失败，检查 PostgreSQL 是否监听 5432 端口
2. 如果仍然遇到编码错误，尝试方案 A 或 B
3. 日志文件: import_offsync.log 或 import_final_result.txt

注意：由于安全限制，自动执行的 Bash 命令可能被阻止。请在终端中手动执行上述命令。
