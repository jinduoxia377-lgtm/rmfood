"""
RMFOOD 项目测试配置

提供统一的模块路径和 pytest 插件配置，确保所有测试文件可以正常导入。
关键：清除工作树路径，确保模块只从主仓库加载。
"""
import sys
import os

# 清除工作树路径（避免模块从多个位置加载导致 SQLAlchemy metadata 冲突）
sys.path = [p for p in sys.path if "worktrees" not in p and ".claude" not in p]

# 设置项目根目录为主仓库
_PROJECT_ROOT = r"D:\RMFOODFP"
_BACKEND_DIR = os.path.join(_PROJECT_ROOT, "backend")

# 添加路径（按优先级）
for _path in [_PROJECT_ROOT, _BACKEND_DIR]:
    if _path not in sys.path:
        sys.path.insert(0, _path)

# 配置 chromadb 在测试环境中静默
os.environ.setdefault("CHROMA_NO_TELEMETRY", "1")

# 在导入任何模型前先加载 base，确保 SQLAlchemy metadata 唯一
import app.models.base  # noqa: F401
