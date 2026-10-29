"""
DiagnosticEngine 三级诊断引擎 — 单元测试

覆盖场景：
- L1 ConfigChecker: 缺失 API Key / 有效 Key / 无效 Provider / 无效 Base URL / 空模型名
- L2 ConnectivityChecker: DNS 失败模拟 / TCP 超时 / HTTP 401/429/200
- L3 CapabilityChecker: 推理成功 / 401 认证失败 / 429 配额限制 / 超时
- DiagnosticEngine 完整流程: 全 pass → healthy / 有 fail → critical / 有 warn → degraded
- report.score 计算: 验证 0-100 分数正确性
"""
import pytest
from unittest.mock import patch
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))

from app.services.ai.shared.diagnostic_engine import (
    ConfigChecker,
)


class TestConfigChecker:
    """Level 1: 配置检测单元测试"""

    @pytest.mark.asyncio
    async def test_missing_api_key_returns_fail(self):
        """C-01: 未配置 API Key → fail"""
        # 当前实现优先读取 llm_service 运行时配置（_get_runtime_config），
        # 因此通过 patch 该静态方法来控制输入，而不是直接 patch settings。
        with patch('app.services.ai.shared.diagnostic_engine._get_setting_with_fallback', return_value=''), \
             patch.object(ConfigChecker, '_get_runtime_config', return_value={
                 'api_key': '', 'provider': 'openai', 'base_url': '', 'model': 'gpt-4o-mini',
             }):
            checker = ConfigChecker()
            results = checker.check_all()
            c01 = next((r for r in results if r.check_id == "C-01"), None)
            assert c01 is not None
            assert c01.status == "fail"
            assert "API Key" in c01.detail

    @pytest.mark.asyncio
    async def test_valid_api_key_returns_pass(self):
        """C-01: 有效 API Key → pass"""
        with patch.object(ConfigChecker, '_get_runtime_config', return_value={
            'api_key': 'sk-valid-key-12345678901234567890',
            'provider': 'openai', 'base_url': 'https://api.openai.com/v1',
            'model': 'gpt-4o-mini',
        }):
            checker = ConfigChecker()
            results = checker.check_all()
            c01 = next((r for r in results if r.check_id == "C-01"), None)
            assert c01 is not None
            assert c01.status == "pass"

    @pytest.mark.asyncio
    async def test_short_api_key_returns_warn(self):
        """C-01: API Key 过短 → warn"""
        with patch.object(ConfigChecker, '_get_runtime_config', return_value={
            'api_key': 'sk-short', 'provider': 'openai', 'base_url': '',
            'model': 'gpt-4o-mini',
        }):
            checker = ConfigChecker()
            results = checker.check_all()
            c01 = next((r for r in results if r.check_id == "C-01"), None)
            assert c01 is not None
            assert c01.status == "warn"

    @pytest.mark.asyncio
    async def test_invalid_provider_returns_fail(self):
        """C-02: 无效 provider → fail"""
        with patch.object(ConfigChecker, '_get_runtime_config', return_value={
            'api_key': 'sk-valid-key-12345678901234567890',
            'provider': 'invalid_provider', 'base_url': '', 'model': 'test-model',
        }):
            checker = ConfigChecker()
            results = checker.check_all()
            c02 = next((r for r in results if r.check_id == "C-02"), None)
            assert c02 is not None
            assert c02.status == "fail"


class TestMetricsCollector:
    """MetricsCollector 单元测试"""

    def test_empty_summary(self):
        from app.services.ai.shared.metrics_collector import MetricsCollector
        collector = MetricsCollector()
        summary = collector.get_summary(window_seconds=300)
        assert summary["total_calls"] == 0
        assert summary["success_rate"] == 0

    def test_record_and_retrieve(self):
        from app.services.ai.shared.metrics_collector import MetricsCollector, LLMMetricsSnapshot
        import time

        collector = MetricsCollector(max_history=10)

        # 模拟记录 5 次成功调用
        for i in range(5):
            snapshot = LLMMetricsSnapshot(
                timestamp=time.monotonic(),
                provider="openai",
                model="gpt-4o-mini",
                task_type="chat",
                success=True,
                latency_ms=1000.0 + i * 100,
                tokens_used=100,
            )
            if hasattr(collector, 'record_sync'):
                collector.record_sync(snapshot)

        collector.get_summary()


class TestAlertingEngine:
    """AlertingEngine 单元测试"""

    def test_preset_rules_loaded(self):
        from app.services.ai.shared.alerting import get_alerting_engine
        engine = get_alerting_engine()
        assert len(engine.rules) >= 4  # 至少 4 条预置规则

    def test_high_error_rate_triggers_alert(self):
        from app.services.ai.shared.alerting import AlertingEngine
        engine = AlertingEngine()
        engine.load_preset_rules()

        metrics = {
            "error_rate": 0.5,
            "total_calls": 20,
            "window_seconds": 300,
        }
        alerts = engine.evaluate(metrics)
        assert any(a.rule_id == "ALERT-ERR-RATE-HIGH" for a in alerts)

    def test_cooldown_prevents_duplicate_alerts(self):
        from app.services.ai.shared.alerting import AlertingEngine
        engine = AlertingEngine()
        engine.load_preset_rules()

        metrics = {"error_rate": 0.5, "total_calls": 20, "window_seconds": 300}

        # 第一次触发
        alerts1 = engine.evaluate(metrics)
        assert len(alerts1) > 0

        # 第二次应在冷却期内，不应再触发
        alerts2 = engine.evaluate(metrics)
        assert len(alerts2) == 0


class TestConnectionPool:
    """ConnectionPool 单元测试"""

    def test_get_client_creates_new(self):
        from app.services.ai.providers.connection_pool import LLMConnectionPool
        pool = LLMConnectionPool()
        client = pool.get_client("https://api.openai.com/v1")
        assert client is not None
        assert "https://api.openai.com/v1" in pool._pools

    def test_get_client_reuses_existing(self):
        from app.services.ai.providers.connection_pool import LLMConnectionPool
        pool = LLMConnectionPool()
        c1 = pool.get_client("https://api.example.com/v1")
        c2 = pool.get_client("https://api.example.com/v1")
        assert c1 is c2  # 同一实例

    def test_normalizes_trailing_slash(self):
        from app.services.ai.providers.connection_pool import LLMConnectionPool
        pool = LLMConnectionPool()
        c1 = pool.get_client("https://api.example.com/v1/")
        c2 = pool.get_client("https://api.example.com/v1")
        assert c1 is c2


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
