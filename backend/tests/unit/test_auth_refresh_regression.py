"""回归测试：POST /api/v1/auth/refresh 空 body 返回 400 而非 500。

历史 bug：app/api/auth.py 的 refresh_token 直接 await request.json()，
空 body / 非 JSON body 抛 json.decoder.JSONDecodeError，未捕获导致 500。
修复：安全解析请求体，解析失败按空 body 处理，由统一校验返回 400。
"""
import pytest


class TestAuthRefreshEmptyBody:
    """refresh_token 端点对空/非法 body 应返回 400"""

    def test_refresh_empty_body_returns_400(self, client):
        r = client.post("/api/v1/auth/refresh", content="")
        assert r.status_code == 400

    def test_refresh_non_json_body_returns_400(self, client):
        r = client.post("/api/v1/auth/refresh", content="not-json")
        assert r.status_code == 400