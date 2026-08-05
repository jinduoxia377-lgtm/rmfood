"""
RMFOOD 项目测试配置

提供统一的模块路径和 pytest 插件配置，确保所有测试文件可以正常导入。
"""
import sys
import os

# 将项目根目录加入 sys.path，使 `from backend.app.*` 和 `from app.*` 均可工作
_project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _project_root not in sys.path:
    sys.path.insert(0, _project_root)

# 同时添加 backend/ 目录，兼容旧测试的 `from app.*` 导入风格
_backend_dir = os.path.join(_project_root, "backend")
if _backend_dir not in sys.path:
    sys.path.insert(0, _backend_dir)

# 配置 chromadb 在测试环境中静默（避免不必要的日志输出）
os.environ.setdefault("CHROMA_NO_TELEMETRY", "1")
