"""
RMFOOD 平台发布版本的单一事实源（Single Source of Truth）
=========================================================

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
⚠️  修改版本号请勿手工编辑本文件。

    正确做法：在仓库根目录执行

        npm run version:bump -- patch    # 2.0.0 -> 2.0.1
        npm run version:bump -- minor    # 2.0.0 -> 2.1.0
        npm run version:bump -- major    # 2.0.0 -> 3.0.0

    该脚本会原子化更新全部 8 个版本承载点，避免版本漂移。

    一致性门禁：  npm run version:check
    策略与决策：  docs/adr/ADR-038-语义化版本发布体系.md
    变更历史：    CHANGELOG.md
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

设计要点
--------
1. **本模块零依赖**：不 import 项目内任何模块，可被配置层安全引用而不产生循环导入。
2. **仅承载「平台发布版本」一个语义**：即"这个项目整体到了哪一代"。
   REST API 契约版本（v1 / v2）是**独立轴**，权威定义在
   `backend/app/api/api_version.py` 的 `CURRENT_API_VERSION` / `API_MATRIX`。
   两个轴**不得混用**——API v1 在平台 2.x 内一直有效。
3. **运行时可覆盖**：部署环境可用 `APP_VERSION` 环境变量覆盖内嵌版本
   （例如打补丁构建），覆盖逻辑在 `app.core.config.Settings` 中实现。
"""

from __future__ import annotations

__all__ = ["__version__", "VERSION_TUPLE", "RELEASE_DATE", "VERSION_SOURCE_FILES"]

#: 平台发布版本号 —— 严格遵循 SemVer 2.0.0
#: https://semver.org/lang/zh-CN/
__version__ = "2.1.0"

#: 元组形式，便于程序化比较，例如 `VERSION_TUPLE >= (2, 1, 0)`
VERSION_TUPLE: tuple[int, int, int] = (2, 1, 0)

#: 本次版本的发布日期（与 CHANGELOG.md 条目、git tag 日期保持一致）
RELEASE_DATE = "2026-10-30"

#: 全部版本承载点（相对仓库根目录）—— 与 scripts/version/check-version.js 中的
#: VERSION_SOURCES 必须保持同步。修改任一处时必须同时更新另一处。
VERSION_SOURCE_FILES: tuple[str, ...] = (
    "package.json",
    "frontend/package.json",
    "miniprogram/package.json",
    "backend/pyproject.toml",
    "backend/app/version.py",
    ".env.example",
    "backend/.env.example",
    "CHANGELOG.md",
)
