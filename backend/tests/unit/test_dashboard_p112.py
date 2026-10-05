# type: ignore
"""P1-12 回归：dashboard /trends 与 /statistics 改为 GROUP BY 聚合后的行为一致性测试。

背景：dashboard.py 的逐日统计原实现为 for i in range(days) 逐日 2~3 次 SQL 往返
（30d=60~90 次、90d=180~270 次）。P1-12 改为 GROUP BY date(created_at) 单条聚合 +
Python 侧补零。注意：date() 提取函数是 PostgreSQL 专有语法——生产环境为 PostgreSQL
（SQL 合法）；SQLite 测试库下该 SQL 会抛异常，因此本测试使用 mock DB 会话
（依赖注入覆盖）验证端点的日期补全逻辑与响应契约，不在 SQLite 上真实执行该 SQL。

校验点：
1. /trends 各周期日期序列完整（7d=7 天、30d=30 天、90d=90 天），缺失日期补 0。
2. GROUP BY 结果正确映射到逐日序列（部分日有数据、其余补 0），与旧「区间 count」语义一致。
3. /statistics 的 recent_activity 30 天序列完整、缺日补 0，by_status 键稳定。

运行：pytest tests/unit/test_dashboard_p112.py -v
"""
from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.api.deps import get_current_user, get_current_active_user, get_db_session
from app.models import User

from app.api.dashboard import (
    EXPERIMENT_STATUS_DEFAULTS,
    FORMULA_STATUS_DEFAULTS,
    USER_ROLE_DEFAULTS,
)


# ── mock 结果构造工具 ───────────────────────────────────────────

def make_result(rows=None, scalar=None):
    """构造 db.execute() 的返回结果（.all() / .scalar()）。"""
    m = MagicMock()
    m.all.return_value = rows or []
    m.scalar.return_value = scalar
    return m


def override_db_with_sequence(app, results):
    """将 get_db_session 替换为按调用顺序返回 results 的 AsyncMock 会话。"""
    db = MagicMock()
    db.execute = AsyncMock(side_effect=list(results))
    app.dependency_overrides[get_db_session] = lambda: db
    return db


def make_client(db_results=None):
    app = create_app()

    async def mock_get_current_user():
        user = MagicMock(spec=User)
        user.id = 1
        user.username = "test_researcher"
        user.email = "test@example.com"
        user.role = "researcher"
        user.is_active = True
        return user

    async def mock_get_active_user():
        return await mock_get_current_user()

    app.dependency_overrides[get_current_user] = mock_get_current_user
    app.dependency_overrides[get_current_active_user] = mock_get_active_user
    if db_results is not None:
        override_db_with_sequence(app, db_results)
    return app


# ── /trends 契约测试 ────────────────────────────────────────────

@pytest.mark.parametrize("period,days", [("7d", 7), ("30d", 30), ("90d", 90)])
def test_trends_contract_shape(period, days):
    """数据库无记录时（GROUP BY 空结果）：日期序列完整 + 全 0 填充。"""
    today = datetime.now().date()
    app = make_client()
    app.dependency_overrides[get_db_session] = lambda: _sequence_db([
        make_result(rows=[], scalar=None),   # formula daily
        make_result(rows=[], scalar=None),   # experiment daily
        make_result(rows=[], scalar=None),   # formula approved daily
    ])

    with TestClient(app) as client:
        resp = client.get(f"/api/v1/dashboard/trends?period={period}")
        assert resp.status_code == 200, resp.text
        payload = resp.json()
        assert payload["period"] == period
        data = payload["data"]
        assert len(data) == days
        expected_dates = [
            (today - timedelta(days=days - 1) + timedelta(days=i)).isoformat() for i in range(days)
        ]
        assert [d["date"] for d in data] == expected_dates
        assert all(d["formulas_created"] == 0 for d in data)
        assert all(d["experiments_created"] == 0 for d in data)
        assert all(d["formulas_approved"] == 0 for d in data)


def _sequence_db(results):
    db = MagicMock()
    db.execute = AsyncMock(side_effect=list(results))
    return db


def test_trends_daily_values_from_group_by():
    """验证 GROUP BY 结果正确映射到逐日序列（部分日有数据，其余补 0）。"""
    today = datetime.now().date()
    start = today - timedelta(days=6)  # 7d 周期

    # formulas: 第0天3条、第5天2条（approved 第5天1条）；experiments: 第3天4条
    f_rows = [(start, 3), (today - timedelta(days=1), 2)]
    e_rows = [(start + timedelta(days=3), 4)]
    fa_rows = [(today - timedelta(days=1), 1)]

    app = make_client()
    app.dependency_overrides[get_db_session] = lambda: _sequence_db([
        make_result(rows=f_rows, scalar=None),
        make_result(rows=e_rows, scalar=None),
        make_result(rows=fa_rows, scalar=None),
    ])

    with TestClient(app) as client:
        resp = client.get("/api/v1/dashboard/trends?period=7d")
        assert resp.status_code == 200, resp.text
        data = resp.json()["data"]
        assert len(data) == 7

        # 逐日断言：与旧「区间 count」语义一致（缺日=0）
        expected = {
            start.isoformat(): 3,
            (today - timedelta(days=1)).isoformat(): 2,
            (start + timedelta(days=3)).isoformat(): 0,
        }
        for i, entry in enumerate(data):
            day = start + timedelta(days=i)
            assert entry["date"] == day.isoformat()
            assert entry["formulas_created"] == expected.get(day.isoformat(), 0)
            assert entry["experiments_created"] == (4 if day == start + timedelta(days=3) else 0)
            assert entry["formulas_approved"] == (1 if day == today - timedelta(days=1) else 0)


# ── /statistics recent_activity 测试 ────────────────────────────

def test_statistics_recent_activity_30d_complete():
    """recent_activity 30 天完整、缺日补 0，by_status 键稳定。"""
    today = datetime.now().date()
    start_date = today - timedelta(days=29)
    f_rows = [(start_date, 3), (today, 1)]
    e_rows = [(start_date + timedelta(days=1), 5)]

    app = make_client()
    app.dependency_overrides[get_db_session] = lambda: _sequence_db([
        make_result(rows=[1], scalar=12),      # formula total
        make_result(rows=[], scalar=None),     # formula by status
        make_result(rows=[1], scalar=8),       # experiment total
        make_result(rows=[], scalar=None),     # experiment by status
        make_result(rows=[1], scalar=4),       # user total
        make_result(rows=[], scalar=None),     # user by role
        make_result(rows=f_rows, scalar=None), # formula daily
        make_result(rows=e_rows, scalar=None), # experiment daily
    ])

    with TestClient(app) as client:
        resp = client.get("/api/v1/dashboard/statistics")
        assert resp.status_code == 200, resp.text
        payload = resp.json()

        recent = payload["recent_activity"]
        assert len(recent) == 30
        expected_dates = [
            (today - timedelta(days=29) + timedelta(days=i)).isoformat() for i in range(30)
        ]
        assert [d["date"] for d in recent] == expected_dates

        for entry in recent:
            day = entry["date"]
            assert entry["formulas"] == (
                3 if day == start_date.isoformat() else (1 if day == today.isoformat() else 0)
            )
            assert entry["experiments"] == (5 if day == (start_date + timedelta(days=1)).isoformat() else 0)

        for key in FORMULA_STATUS_DEFAULTS:
            assert key in payload["formulas"]["by_status"]
        for key in EXPERIMENT_STATUS_DEFAULTS:
            assert key in payload["experiments"]["by_status"]
        for key in USER_ROLE_DEFAULTS:
            assert key in payload["users"]["by_role"]
