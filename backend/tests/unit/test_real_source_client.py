"""
real_source_client.NCBIOnlineSource 单元测试

覆盖：
- 依赖缺失（aiohttp 未安装）与真实网络不可达的区分（probe）
- 网络异常（aiohttp.ClientError）正确报告
- 可达时返回 reachable=True、latency_ms 为 int
- 检索阶段依赖缺失时返回空列表（不反复探测/不抛错）

所有测试均 mock 网络层，不访问真实网络。
"""
import builtins

import aiohttp

from app.services.peptide_analyzer.real_source_client import NCBIOnlineSource


class _FakeResp:
    """伪造 aiohttp 响应：status=200，json() 返回 PubMed esearchresult"""

    status = 200

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def json(self):
        return {"esearchresult": {"count": "123"}}


class _FakeErrorResp:
    """伪造 aiohttp 响应上下文：__aenter__ 时抛出 ClientError（模拟真实网络失败）"""

    async def __aenter__(self):
        raise aiohttp.ClientError("connection refused")

    async def __aexit__(self, *args):
        return None


class _FakeSearchResp:
    """伪造 aiohttp 响应：status=200，json() 返回可配置 payload（esearch idlist / esummary 数据）"""

    status = 200

    def __init__(self, payload):
        self._payload = payload

    async def __aenter__(self):
        return self

    async def __aexit__(self, *args):
        return None

    async def json(self):
        return self._payload


def _make_aiohttp_missing_import():
    """返回替换 builtins.__import__ 的函数：使 import aiohttp 抛 ModuleNotFoundError"""
    real_import = builtins.__import__

    def fake_import(name, globals=None, locals=None, fromlist=(), level=0):
        if name == "aiohttp":
            raise ModuleNotFoundError("No module named 'aiohttp'", name="aiohttp")
        return real_import(name, globals, locals, fromlist, level)

    return fake_import


async def test_probe_reports_dependency_missing(monkeypatch):
    """aiohttp 未安装时：probe 必须报告「依赖缺失」，而非网络不可达"""
    monkeypatch.setattr(builtins, "__import__", _make_aiohttp_missing_import())
    source = NCBIOnlineSource()
    result = await source.probe()

    assert result["reachable"] is False
    assert "依赖缺失" in result["note"]
    assert "aiohttp" in result["note"]


async def test_probe_reports_network_error(monkeypatch):
    """真实网络异常（aiohttp.ClientError）：note 包含异常类型，reachable=False"""
    def fake_get(self, url, timeout=None):
        return _FakeErrorResp()

    monkeypatch.setattr(aiohttp.ClientSession, "get", fake_get)
    source = NCBIOnlineSource()
    result = await source.probe()

    assert result["reachable"] is False
    assert "ClientError" in result["note"]


async def test_probe_reachable(monkeypatch):
    """NCBI 可达（HTTP 200）：reachable=True，latency_ms 为 int，note 含「实测可达」"""
    def fake_get(self, url, timeout=None):
        return _FakeResp()

    monkeypatch.setattr(aiohttp.ClientSession, "get", fake_get)
    source = NCBIOnlineSource()
    result = await source.probe()

    assert result["reachable"] is True
    assert isinstance(result["latency_ms"], int)
    assert "实测可达" in result["note"]


async def test_search_peptide_literature_returns_empty_on_dependency_missing(monkeypatch):
    """检索阶段 aiohttp 依赖缺失：返回 []，而不是把依赖缺失当网络失败"""
    monkeypatch.setattr(builtins, "__import__", _make_aiohttp_missing_import())
    source = NCBIOnlineSource()
    # 模拟 last_probe 曾可达，但检索时 aiohttp 不可用（依赖缺失分支）
    source.last_probe = {"reachable": True}
    result = await source.search_peptide_literature(
        activity_type="ACE inhibitory peptide", limit=3
    )

    assert result == []


async def test_search_peptide_literature_with_sequence_uses_sequence_in_query(monkeypatch):
    """提供 sequence 时，esearch 查询 URL 的 term 必须包含 'VPP AND ACE'（序列级检索）"""
    from urllib.parse import parse_qs, urlparse

    captured_urls = []

    def fake_get(self, url, timeout=None):
        captured_urls.append(url)
        if "esearch.fcgi" in url:
            payload = {"esearchresult": {"idlist": ["1", "2"]}}
        else:
            payload = {
                "result": {
                    "uids": ["1", "2"],
                    "1": {
                        "title": "VPP ACE inhibitory",
                        "source": "J",
                        "pubdate": "2020",
                        "authors": [],
                        "articleids": [],
                    },
                    "2": {
                        "title": "Another",
                        "source": "J",
                        "pubdate": "2021",
                        "authors": [],
                        "articleids": [],
                    },
                }
            }
        return _FakeSearchResp(payload)

    monkeypatch.setattr(aiohttp.ClientSession, "get", fake_get)
    source = NCBIOnlineSource()
    source.last_probe = {"reachable": True}

    result = await source.search_peptide_literature(
        sequence="VPP", activity_type="ACE inhibitory", limit=5
    )

    # 至少发起过一次 esearch 请求，且其 term 为序列级查询（quote 编码，unquote 后含 VPP AND ACE）
    assert captured_urls, "应至少发起一次 HTTP 请求"
    esearch_url = next(u for u in captured_urls if "esearch.fcgi" in u)
    term = parse_qs(urlparse(esearch_url).query).get("term", [""])[0]
    assert "VPP AND ACE" in term
    # 序列级检索应返回文献，且诚实标注实际命中的检索式
    assert result, "序列级检索应返回文献"
    assert result[0]["query"] == "VPP AND ACE inhibitory"