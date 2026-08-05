"""
RMFOOD 项目测试配置

提供统一的模块路径和 pytest 插件配置，确保所有测试文件可以正常导入。
"""
import sys
import os

# 使用绝对路径，避免工作树与主仓库的路径冲突
# 向上3级：tests -> ... -> .claude/worktrees/xxx -> ... -> RMFOODFP
_current = os.path.abspath(os.path.dirname(__file__))
_project_root = os.path.normpath(os.path.join(_current, "..", "..", "..", "..", "..", ".."))

# 如果自动推断路径不对，尝试已知路径
if not os.path.exists(os.path.join(_project_root, "backend", "app", "main.py")):
    _project_root = r"D:\RMFOODFP"

if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

# 配置 chromadb 在测试环境中静默
os.environ.setdefault("CHROMA_NO_TELEMETRY", "1")
