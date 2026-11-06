# 迁移 021：修正 users.role 列默认值 'user' → 'GUEST'（'user' 不在 userrole 枚举内）
--
-- 背景：users.role 列是 character varying，应用层用 SQLAlchemy 的 userrole 枚举
-- （GUEST/RESEARCHER/FORMULATOR/REVIEWER/ADMIN）读写。但该列的 DB 默认值被误设为
-- 'user'——这不是合法枚举值。任何绕过应用、直接 SQL 插入且未显式指定 role 的用户
-- 会继承默认 'user'，登录时 SQLAlchemy 加载该行到枚举即抛 LookupError → 500。
-- 真实注册流程（auth.py register）总是显式传合法 role，故线上 0 条脏数据；
-- 但默认值本身是个陷阱（conftest.py 测试夹具也误用 role="user"）。
-- 本迁移把默认值改为合法枚举值 GUEST，消除该隐患。可逆。

BEGIN;

ALTER TABLE users ALTER COLUMN role SET DEFAULT 'GUEST';

COMMIT;

-- ===== 回滚 =====
-- ALTER TABLE users ALTER COLUMN role SET DEFAULT 'user';
