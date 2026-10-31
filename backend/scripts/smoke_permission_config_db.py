"""
permission_config 数据库持久化冒烟测试

验证 PermissionConfigService 的写 → 读 → 删 → 回退默认 全链路。

运行方式（在 backend 目录）:
    venv\\Scripts\\python.exe scripts/smoke_permission_config_db.py

安全说明：
- 仅操作 system_configs 表中 config_key='role_permissions' 的自定义配置；
- 若该键已存在（理论上不应存在），脚本会先备份并在结束时恢复原值；
- 不修改任何既有表结构。
"""
import asyncio
import os
import sys

# 必须在导入服务模块前设置，模块级 _PERM_CONFIG_SOURCE 在 import 时读取
os.environ["PERMISSION_CONFIG_SOURCE"] = "db"

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from sqlalchemy import select, delete  # noqa: E402

from app.core.database.session import async_session_factory  # noqa: E402
from app.models import SystemConfig, UserRole  # noqa: E402
from app.core.rbac.permission import ROLE_PERMISSIONS  # noqa: E402
from app.services.permission_config import PermissionConfigService, _CONFIG_KEY  # noqa: E402

CONFIG_KEY = "role_permissions"
TEST_ROLE = UserRole.RESEARCHER
TEST_PERMS = ["formula:read", "ai:use", "database:search"]


async def main() -> int:
    async with async_session_factory() as db:
        service = PermissionConfigService(db)

        # 0. 备份既有配置（若有）
        existing = (await db.execute(
            select(SystemConfig).where(SystemConfig.config_key == CONFIG_KEY)
        )).scalar_one_or_none()
        backup_value = existing.config_value if existing else None
        backup_id = existing.id if existing else None
        print(f"[备份] role_permissions 既有配置: {backup_value!r}")

        # 1. 写入自定义配置
        ok = await service.update_role_permissions(TEST_ROLE, TEST_PERMS)
        print(f"[写] update_role_permissions({TEST_ROLE.name}) -> {ok}")
        assert ok is True, "写入失败"

        # 2. 读回
        perms = await service.get_role_permissions(TEST_ROLE)
        print(f"[读] get_role_permissions({TEST_ROLE.name}) -> {perms}")
        assert perms == TEST_PERMS, f"读回不一致: {perms} != {TEST_PERMS}"

        # 确认已落库（绕过缓存，直接查库）
        import json as _json
        row = (await db.execute(
            select(SystemConfig).where(SystemConfig.config_key == CONFIG_KEY)
        )).scalar_one_or_none()
        assert row is not None, "数据库中没有 role_permissions 配置"
        raw_value = row.config_value
        # system_configs.config_value 为 TEXT 列，存储 JSON 字符串
        if isinstance(raw_value, str):
            raw_value = _json.loads(raw_value)
        db_value = (raw_value or {}).get(TEST_ROLE.value)
        assert db_value == TEST_PERMS, f"落库值不一致: {db_value} != {TEST_PERMS}"
        print(f"[落库] system_configs.config_value[{TEST_ROLE.value}] = {db_value}")

        # 3. 删除（回退默认）
        ok = await service.reset_to_defaults()
        print(f"[删] reset_to_defaults() -> {ok}")
        assert ok is True, "重置失败"

        # 4. 确认回退默认
        perms = await service.get_role_permissions(TEST_ROLE)
        defaults = ROLE_PERMISSIONS.get(TEST_ROLE, [])
        print(f"[回退] get_role_permissions({TEST_ROLE.name}) -> {perms}")
        assert perms == defaults, f"未回退默认: {perms} != {defaults}"

        # 确认数据库中配置已被删除
        row = (await db.execute(
            select(SystemConfig).where(SystemConfig.config_key == CONFIG_KEY)
        )).scalar_one_or_none()
        assert row is None, "重置后数据库仍有 role_permissions 配置"
        print("[回退] 数据库 role_permissions 配置已删除")

        # 5. 恢复备份（若原本存在）
        if backup_value is not None:
            import json as _json
            if isinstance(backup_value, str):
                backup_value = _json.loads(backup_value)
            if backup_id is not None:
                # 原配置存在：恢复原值（保留原行 id）
                await db.execute(
                    delete(SystemConfig).where(SystemConfig.config_key == CONFIG_KEY)
                )
                db.add(SystemConfig(
                    id=backup_id,
                    config_key=CONFIG_KEY,
                    config_value=backup_value,
                ))
            else:
                db.add(SystemConfig(config_key=CONFIG_KEY, config_value=backup_value))
            await db.commit()
            print(f"[恢复] 已恢复原 role_permissions 配置: {backup_value!r}")

        print("\n[PASS] 冒烟测试全部通过: 写 -> 读 -> 删 -> 回退默认")
        return 0


if __name__ == "__main__":
    try:
        raise SystemExit(asyncio.run(main()))
    except AssertionError as e:
        print(f"\n[FAIL] 冒烟测试失败: {e}")
        raise SystemExit(1)