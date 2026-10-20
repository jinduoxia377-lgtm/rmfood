"""
Tests for the metrics module at app.core.metrics.

Covers:
- CounterMetric: inc, expose
- HistogramMetric: observe, expose, bucket boundaries
- GaugeMetric: set, inc, dec, expose
- MetricsCollector: record_request, record_cache_hit, record_cache_miss,
  record_db_query, record_ai_inference, expose
- Cache hit/miss ratio tracking
"""
import pytest

from app.core.observability.metrics import (
    CounterMetric,
    GaugeMetric,
    HistogramMetric,
    MetricsCollector,
)


# ────────────────────────────────────────────
# CounterMetric
# ────────────────────────────────────────────


class TestCounterMetric:
    """Counter is monotonically increasing; it exposes Prometheus text format."""

    def test_initial_value_is_zero(self):
        counter = CounterMetric("test_total", "A test counter")
        assert counter.value == 0.0

    def test_inc_default_increments_by_one(self):
        counter = CounterMetric("test_total", "A test counter")
        counter.inc()
        assert counter.value == 1.0

    def test_inc_custom_amount(self):
        counter = CounterMetric("test_total", "A test counter")
        counter.inc(5.0)
        assert counter.value == 5.0

    def test_inc_accumulates(self):
        counter = CounterMetric("test_total", "A test counter")
        counter.inc(3.0)
        counter.inc(2.5)
        assert counter.value == 5.5

    def test_inc_zero_is_noop(self):
        counter = CounterMetric("test_total", "A test counter")
        counter.inc(0)
        assert counter.value == 0.0

    def test_expose_contains_help_line(self):
        counter = CounterMetric("test_total", "A test counter")
        text = counter.expose()
        assert "# HELP test_total A test counter" in text

    def test_expose_contains_type_line(self):
        counter = CounterMetric("test_total", "A test counter")
        text = counter.expose()
        assert "# TYPE test_total counter" in text

    def test_expose_contains_value(self):
        counter = CounterMetric("test_total", "A test counter")
        counter.inc(42.0)
        text = counter.expose()
        assert "test_total 42.0" in text

    def test_expose_format_matches_prometheus(self):
        counter = CounterMetric("req_count", "Request count")
        counter.inc(7)
        lines = counter.expose().split("\n")
        assert len(lines) == 3  # HELP, TYPE, value
        assert lines[0].startswith("# HELP req_count")
        assert lines[1] == "# TYPE req_count counter"
        assert lines[2] == "req_count 7.0"


# ────────────────────────────────────────────
# HistogramMetric
# ────────────────────────────────────────────


class TestHistogramMetric:
    """Histogram tracks value distribution across configurable buckets."""

    def test_initial_state_is_empty(self):
        h = HistogramMetric("test_duration", "Test duration")
        assert h.count == 0
        assert h.sum_value == 0.0

    def test_observe_increments_count(self):
        h = HistogramMetric("test_duration", "Test duration")
        h.observe(0.1)
        assert h.count == 1

    def test_observe_accumulates_sum(self):
        h = HistogramMetric("test_duration", "Test duration")
        h.observe(0.1)
        h.observe(0.3)
        assert h.sum_value == pytest.approx(0.4)

    def test_observe_increments_matching_buckets(self):
        # Default buckets include 0.1
        h = HistogramMetric("test_duration", "Test duration")
        h.observe(0.05)  # should land in buckets >= 0.05
        # Bucket 0.005 should NOT be incremented (0.05 > 0.005)
        assert h.bucket_counts.get(0.005, 0) == 0
        # Bucket 0.05 should be incremented
        assert h.bucket_counts.get(0.05, 0) == 1
        # Bucket 0.1 should also be incremented (0.05 <= 0.1)
        assert h.bucket_counts.get(0.1, 0) == 1

    def test_observe_exact_boundary_value(self):
        h = HistogramMetric("test_duration", "Test duration")
        h.observe(0.5)
        # 0.5 <= 0.5, so bucket 0.5 should be 1
        assert h.bucket_counts.get(0.5, 0) == 1
        # 0.5 > 0.25, so bucket 0.25 should be 0
        assert h.bucket_counts.get(0.25, 0) == 0

    def test_observe_value_below_smallest_bucket(self):
        h = HistogramMetric("test_duration", "Test duration")
        h.observe(0.0001)  # below 0.005
        assert h.bucket_counts.get(0.005, 0) == 1

    def test_observe_value_above_largest_bucket(self):
        h = HistogramMetric("test_duration", "Test duration")
        h.observe(999.0)  # above 10.0
        # No regular bucket should capture this
        assert h.bucket_counts.get(10.0, 0) == 0
        # But count still increments
        assert h.count == 1

    def test_custom_buckets(self):
        h = HistogramMetric("custom", "Custom", buckets=[1.0, 5.0, 10.0])
        h.observe(3.0)
        assert h.bucket_counts.get(1.0, 0) == 0
        assert h.bucket_counts.get(5.0, 0) == 1
        assert h.bucket_counts.get(10.0, 0) == 1

    def test_expose_contains_help_and_type(self):
        h = HistogramMetric("req_dur", "Request duration")
        text = h.expose()
        assert "# HELP req_dur Request duration" in text
        assert "# TYPE req_dur histogram" in text

    def test_expose_contains_bucket_lines(self):
        h = HistogramMetric("req_dur", "Request duration")
        text = h.expose()
        for bucket in h.buckets:
            assert f'req_dur_bucket{{le="{bucket}"}}' in text

    def test_expose_contains_plus_inf_bucket(self):
        h = HistogramMetric("req_dur", "Request duration")
        h.observe(0.5)
        text = h.expose()
        assert 'req_dur_bucket{le="+Inf"} 1' in text

    def test_expose_contains_sum_and_count(self):
        h = HistogramMetric("req_dur", "Request duration")
        h.observe(0.3)
        h.observe(0.7)
        text = h.expose()
        assert "req_dur_sum 1.0" in text
        assert "req_dur_count 2" in text

    def test_expose_all_buckets_zero_when_no_observations(self):
        h = HistogramMetric("req_dur", "Request duration")
        text = h.expose()
        assert 'req_dur_bucket{le="+Inf"} 0' in text
        assert "req_dur_sum 0.0" in text
        assert "req_dur_count 0" in text


# ────────────────────────────────────────────
# GaugeMetric
# ────────────────────────────────────────────


class TestGaugeMetric:
    """Gauge can go up and down; it represents a current value."""

    def test_initial_value_is_zero(self):
        g = GaugeMetric("active_conns", "Active connections")
        assert g.value == 0.0

    def test_set_overwrites_value(self):
        g = GaugeMetric("active_conns", "Active connections")
        g.set(42.0)
        assert g.value == 42.0

    def test_set_to_zero(self):
        g = GaugeMetric("active_conns", "Active connections")
        g.set(10.0)
        g.set(0.0)
        assert g.value == 0.0

    def test_set_negative_value(self):
        g = GaugeMetric("delta", "Delta")
        g.set(-5.0)
        assert g.value == -5.0

    def test_inc_default_increments_by_one(self):
        g = GaugeMetric("active_conns", "Active connections")
        g.inc()
        assert g.value == 1.0

    def test_inc_custom_amount(self):
        g = GaugeMetric("active_conns", "Active connections")
        g.inc(3.5)
        assert g.value == 3.5

    def test_inc_accumulates(self):
        g = GaugeMetric("active_conns", "Active connections")
        g.inc(2)
        g.inc(3)
        assert g.value == 5.0

    def test_dec_default_decrements_by_one(self):
        g = GaugeMetric("active_conns", "Active connections")
        g.set(5.0)
        g.dec()
        assert g.value == 4.0

    def test_dec_custom_amount(self):
        g = GaugeMetric("active_conns", "Active connections")
        g.set(10.0)
        g.dec(3.0)
        assert g.value == 7.0

    def test_dec_below_zero(self):
        g = GaugeMetric("delta", "Delta")
        g.set(2.0)
        g.dec(5.0)
        assert g.value == -3.0

    def test_inc_then_dec_returns_to_original(self):
        g = GaugeMetric("pool", "Connection pool")
        g.set(10.0)
        g.inc(5)
        g.dec(5)
        assert g.value == 10.0

    def test_expose_format(self):
        g = GaugeMetric("temp", "Temperature")
        g.set(36.6)
        text = g.expose()
        assert "# HELP temp Temperature" in text
        assert "# TYPE temp gauge" in text
        assert "temp 36.6" in text


# ────────────────────────────────────────────
# MetricsCollector
# ────────────────────────────────────────────


class TestMetricsCollector:
    """MetricsCollector aggregates HTTP, cache, DB, and AI metrics."""

    def test_record_request_increments_total(self):
        collector = MetricsCollector()
        collector.record_request("GET", "/api/health", 200, 0.01)
        assert collector.http_requests_total.value == 1.0

    def test_record_request_multiple_calls(self):
        collector = MetricsCollector()
        collector.record_request("GET", "/api/a", 200, 0.01)
        collector.record_request("POST", "/api/b", 201, 0.02)
        collector.record_request("GET", "/api/c", 200, 0.015)
        assert collector.http_requests_total.value == 3.0

    def test_record_request_records_duration(self):
        collector = MetricsCollector()
        collector.record_request("GET", "/api/slow", 200, 1.5)
        assert collector.http_request_duration_seconds.count == 1
        assert collector.http_request_duration_seconds.sum_value == pytest.approx(1.5)

    def test_record_request_4xx_increments_error_counter(self):
        collector = MetricsCollector()
        collector.record_request("GET", "/api/not-found", 404, 0.01)
        assert collector.http_errors_total.value == 1.0

    def test_record_request_5xx_increments_error_counter(self):
        collector = MetricsCollector()
        collector.record_request("POST", "/api/fail", 500, 0.05)
        assert collector.http_errors_total.value == 1.0

    def test_record_request_2xx_does_not_increment_error_counter(self):
        collector = MetricsCollector()
        collector.record_request("GET", "/api/ok", 200, 0.01)
        assert collector.http_errors_total.value == 0.0

    def test_record_request_3xx_does_not_increment_error_counter(self):
        collector = MetricsCollector()
        collector.record_request("GET", "/api/redirect", 301, 0.01)
        assert collector.http_errors_total.value == 0.0

    def test_record_cache_hit_increments(self):
        collector = MetricsCollector()
        collector.record_cache_hit()
        collector.record_cache_hit()
        assert collector.cache_hits_total.value == 2.0

    def test_record_cache_miss_increments(self):
        collector = MetricsCollector()
        collector.record_cache_miss()
        assert collector.cache_misses_total.value == 1.0

    def test_record_db_query_records_duration(self):
        collector = MetricsCollector()
        collector.record_db_query(0.025)
        assert collector.db_query_duration_seconds.count == 1
        assert collector.db_query_duration_seconds.sum_value == pytest.approx(0.025)

    def test_record_db_query_multiple(self):
        collector = MetricsCollector()
        collector.record_db_query(0.01)
        collector.record_db_query(0.02)
        collector.record_db_query(0.03)
        assert collector.db_query_duration_seconds.count == 3
        assert collector.db_query_duration_seconds.sum_value == pytest.approx(0.06)

    def test_record_ai_inference_records_duration_and_count(self):
        collector = MetricsCollector()
        collector.record_ai_inference(2.5)
        assert collector.ai_inference_duration_seconds.count == 1
        assert collector.ai_inference_duration_seconds.sum_value == pytest.approx(2.5)
        assert collector.ai_requests_total.value == 1.0

    def test_record_ai_inference_multiple(self):
        collector = MetricsCollector()
        collector.record_ai_inference(1.0)
        collector.record_ai_inference(3.0)
        assert collector.ai_requests_total.value == 2.0
        assert collector.ai_inference_duration_seconds.sum_value == pytest.approx(4.0)

    def test_expose_returns_string(self):
        collector = MetricsCollector()
        text = collector.expose()
        assert isinstance(text, str)

    def test_expose_ends_with_newline(self):
        collector = MetricsCollector()
        text = collector.expose()
        assert text.endswith("\n")

    def test_expose_contains_all_metric_names(self):
        collector = MetricsCollector()
        text = collector.expose()
        expected_names = [
            "rmfood_http_requests_total",
            "rmfood_http_request_duration_seconds",
            "rmfood_http_requests_in_progress",
            "rmfood_http_errors_total",
            "rmfood_cache_hits_total",
            "rmfood_cache_misses_total",
            "rmfood_db_connections_active",
            "rmfood_db_query_duration_seconds",
            "rmfood_ai_inference_duration_seconds",
            "rmfood_ai_requests_total",
            "rmfood_formulas_created_total",
            "rmfood_active_users",
        ]
        for name in expected_names:
            assert name in text, f"Missing metric: {name}"

    def test_expose_contains_help_and_type_for_counters(self):
        collector = MetricsCollector()
        text = collector.expose()
        assert "# HELP rmfood_http_requests_total" in text
        assert "# TYPE rmfood_http_requests_total counter" in text

    def test_expose_contains_help_and_type_for_histograms(self):
        collector = MetricsCollector()
        text = collector.expose()
        assert "# TYPE rmfood_http_request_duration_seconds histogram" in text

    def test_expose_contains_help_and_type_for_gauges(self):
        collector = MetricsCollector()
        text = collector.expose()
        assert "# TYPE rmfood_http_requests_in_progress gauge" in text
        assert "# TYPE rmfood_db_connections_active gauge" in text


# ────────────────────────────────────────────
# Cache hit/miss ratio tracking
# ────────────────────────────────────────────


class TestCacheHitMissRatio:
    """Track cache performance through hit and miss counters."""

    def test_no_cache_activity_means_zero_hits_and_misses(self):
        collector = MetricsCollector()
        assert collector.cache_hits_total.value == 0.0
        assert collector.cache_misses_total.value == 0.0

    def test_all_hits_no_misses(self):
        collector = MetricsCollector()
        for _ in range(10):
            collector.record_cache_hit()
        assert collector.cache_hits_total.value == 10.0
        assert collector.cache_misses_total.value == 0.0

    def test_all_misses_no_hits(self):
        collector = MetricsCollector()
        for _ in range(5):
            collector.record_cache_miss()
        assert collector.cache_hits_total.value == 0.0
        assert collector.cache_misses_total.value == 5.0

    def test_mixed_hits_and_misses(self):
        collector = MetricsCollector()
        # 70% hit rate scenario
        for _ in range(7):
            collector.record_cache_hit()
        for _ in range(3):
            collector.record_cache_miss()
        assert collector.cache_hits_total.value == 7.0
        assert collector.cache_misses_total.value == 3.0
        # Compute ratio manually
        total = collector.cache_hits_total.value + collector.cache_misses_total.value
        hit_ratio = collector.cache_hits_total.value / total
        assert hit_ratio == pytest.approx(0.7)

    def test_ratio_reflected_in_expose(self):
        collector = MetricsCollector()
        collector.record_cache_hit()
        collector.record_cache_hit()
        collector.record_cache_miss()
        text = collector.expose()
        assert "rmfood_cache_hits_total 2.0" in text
        assert "rmfood_cache_misses_total 1.0" in text

    def test_cache_metrics_independent_of_request_metrics(self):
        collector = MetricsCollector()
        collector.record_request("GET", "/api/x", 200, 0.01)
        collector.record_cache_hit()
        # HTTP and cache counters are separate
        assert collector.http_requests_total.value == 1.0
        assert collector.cache_hits_total.value == 1.0
        assert collector.cache_misses_total.value == 0.0
