"""
🔒 P3-5: Prometheus 指标扩展 - 业务 + 系统指标

提供:
1. **业务指标** - API 调用、请求延迟、错误率等
2. **系统指标** - CPU、内存、磁盘、网络等
3. **自定义指标** - 业务特定指标（用户注册、配方创建等）
4. **Gauge / Counter / Histogram / Summary** - 四种指标类型
5. **标签支持** - 按端点、方法、状态码、租户等维度聚合
6. **Prometheus 端点** - `/metrics/prometheus`
7. **客户端性能上报端点** - `/api/v1/metrics/client-perf`

使用方式:
- 在 create_app 中调用 setup_enhanced_metrics(app)
- 业务代码通过 metrics_collector.record_*() 记录指标
- Prometheus 从 /metrics/prometheus 抓取

集成在现有 metrics 模块基础上：
    from .core.observability.metrics import metrics as base_metrics
    from .core.observability.metrics_extended import setup_enhanced_metrics
"""

import json
import logging
import threading
import time
from collections import defaultdict, deque
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List

from fastapi import FastAPI, Request, status
from fastapi.responses import JSONResponse, PlainTextResponse

logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────
# 🔒 P3-5: 指标基类
# ─────────────────────────────────────────────

class MetricBase:
    """指标基类 - 提供标签管理"""

    def __init__(self, name: str, description: str, label_names: List[str] = None):
        self.name = name
        self.description = description
        self.label_names = label_names or []
        self._values: Dict[str, Any] = {}
        self._lock = threading.Lock()

    def _make_key(self, labels: Dict[str, str]) -> str:
        if not labels:
            return ''
        # 按标签名排序以保持键一致
        sorted_labels = sorted(labels.items(), key=lambda x: x[0])
        return ','.join(f'{k}={v}' for k, v in sorted_labels)

    def _validate_labels(self, labels: Dict[str, str]) -> Dict[str, str]:
        if not labels:
            return {}
        # 只保留已声明的标签
        return {k: str(v) for k, v in labels.items() if k in self.label_names}


# ─────────────────────────────────────────────
# 🔒 P3-5: Counter - 单调递增计数器
# ─────────────────────────────────────────────

class Counter(MetricBase):
    """
    Counter 指标 - 只增不减，如请求总数、错误总数
    """

    def inc(self, amount: float = 1.0, labels: Dict[str, str] = None):
        with self._lock:
            key = self._make_key(self._validate_labels(labels or {}))
            self._values[key] = self._values.get(key, 0.0) + amount

    def get(self, labels: Dict[str, str] = None) -> float:
        with self._lock:
            key = self._make_key(self._validate_labels(labels or {}))
            return self._values.get(key, 0.0)

    def reset(self):
        with self._lock:
            self._values.clear()

    def expose(self) -> str:
        lines = [f'# HELP {self.name} {self.description}', f'# TYPE {self.name} counter']
        with self._lock:
            if not self._values:
                lines.append(f'{self.name} 0')
            for key, value in self._values.items():
                if key:
                    label_str = '{' + ','.join(f'{k}="{v}"' for k, v in (item.split('=') for item in key.split(','))) + '}'
                    lines.append(f'{self.name}{label_str} {value}')
                else:
                    lines.append(f'{self.name} {value}')
        return '\n'.join(lines) + '\n'


# ─────────────────────────────────────────────
# 🔒 P3-5: Gauge - 瞬时值仪表
# ─────────────────────────────────────────────

class Gauge(MetricBase):
    """
    Gauge 指标 - 瞬时值，如当前活跃连接数、内存使用
    """

    def set(self, value: float, labels: Dict[str, str] = None):
        with self._lock:
            key = self._make_key(self._validate_labels(labels or {}))
            self._values[key] = value

    def inc(self, amount: float = 1.0, labels: Dict[str, str] = None):
        with self._lock:
            key = self._make_key(self._validate_labels(labels or {}))
            self._values[key] = self._values.get(key, 0.0) + amount

    def dec(self, amount: float = 1.0, labels: Dict[str, str] = None):
        with self._lock:
            key = self._make_key(self._validate_labels(labels or {}))
            self._values[key] = self._values.get(key, 0.0) - amount

    def get(self, labels: Dict[str, str] = None) -> float:
        with self._lock:
            key = self._make_key(self._validate_labels(labels or {}))
            return self._values.get(key, 0.0)

    def reset(self):
        with self._lock:
            self._values.clear()

    def expose(self) -> str:
        lines = [f'# HELP {self.name} {self.description}', f'# TYPE {self.name} gauge']
        with self._lock:
            if not self._values:
                lines.append(f'{self.name} 0')
            for key, value in self._values.items():
                if key:
                    label_str = '{' + ','.join(f'{k}="{v}"' for k, v in (item.split('=') for item in key.split(','))) + '}'
                    lines.append(f'{self.name}{label_str} {value}')
                else:
                    lines.append(f'{self.name} {value}')
        return '\n'.join(lines) + '\n'


# ─────────────────────────────────────────────
# 🔒 P3-5: Histogram - 直方图（分位数）
# ─────────────────────────────────────────────

class Histogram(MetricBase):
    """
    Histogram 指标 - 用于请求延迟等分布统计

    提供分位数: P50, P90, P95, P99
    """

    def __init__(
        self,
        name: str,
        description: str,
        label_names: List[str] = None,
        buckets: List[float] = None,
        max_samples: int = 1000,
    ):
        super().__init__(name, description, label_names)
        # 默认桶（毫秒）
        self.buckets = buckets or [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000, float('inf')]
        self._counts: Dict[str, int] = defaultdict(int)
        self._sums: Dict[str, float] = defaultdict(float)
        self._bucket_counts: Dict[str, List[int]] = {}
        self._recent_samples: Dict[str, deque] = {}
        self.max_samples = max_samples

    def observe(self, value: float, labels: Dict[str, str] = None):
        """记录一个观测值"""
        with self._lock:
            key = self._make_key(self._validate_labels(labels or {}))
            self._counts[key] += 1
            self._sums[key] += value

            # 更新桶计数
            if key not in self._bucket_counts:
                self._bucket_counts[key] = [0] * len(self.buckets)
            for i, bucket in enumerate(self.buckets):
                if value <= bucket:
                    self._bucket_counts[key][i] += 1

            # 保留最近样本用于分位数计算
            if key not in self._recent_samples:
                self._recent_samples[key] = deque(maxlen=self.max_samples)
            self._recent_samples[key].append(value)

    def percentile(self, p: float, labels: Dict[str, str] = None) -> float:
        """获取 P50/P95 等分位数"""
        with self._lock:
            key = self._make_key(self._validate_labels(labels or {}))
            samples = list(self._recent_samples.get(key, []))
            if not samples:
                return 0.0
            samples.sort()
            idx = int(len(samples) * p / 100)
            return samples[min(idx, len(samples) - 1)]

    def get_summary(self, labels: Dict[str, str] = None) -> Dict[str, float]:
        """获取统计摘要"""
        with self._lock:
            key = self._make_key(self._validate_labels(labels or {}))
            samples = list(self._recent_samples.get(key, []))
            if not samples:
                return {"count": 0, "avg": 0, "p50": 0, "p95": 0, "p99": 0, "max": 0}

            samples.sort()
            return {
                "count": self._counts.get(key, 0),
                "avg": round(self._sums.get(key, 0.0) / max(self._counts.get(key, 1), 1), 2),
                "p50": round(samples[int(len(samples) * 0.50)], 2),
                "p90": round(samples[int(len(samples) * 0.90)], 2),
                "p95": round(samples[int(len(samples) * 0.95)], 2),
                "p99": round(samples[int(len(samples) * 0.99)], 2),
                "max": round(max(samples), 2),
            }

    def reset(self):
        with self._lock:
            self._counts.clear()
            self._sums.clear()
            self._bucket_counts.clear()
            self._recent_samples.clear()

    def expose(self) -> str:
        lines = [f'# HELP {self.name} {self.description}', f'# TYPE {self.name} histogram']
        with self._lock:
            # 为每个标签组合生成指标
            all_keys = set(self._counts.keys()) | set(self._bucket_counts.keys())
            if not all_keys:
                all_keys = {''}

            for key in all_keys:
                label_part = ''
                label_part_bucket = ''
                if key:
                    labels_dict = dict(item.split('=') for item in key.split(','))
                    label_str = '{' + ','.join(f'{k}="{v}"' for k, v in labels_dict.items()) + '}'
                    label_part = label_str
                    label_part_bucket = label_str.rstrip('}')

                # 桶计数
                cumulative_count = 0
                for i, bucket in enumerate(self.buckets):
                    count = self._bucket_counts.get(key, [0] * len(self.buckets))[i]
                    cumulative_count += count
                    bucket_val = '+Inf' if bucket == float('inf') else bucket
                    if label_part_bucket:
                        lines.append(
                            self.name + '_bucket' + label_part_bucket + ',le="' + str(bucket_val) + '"} ' + str(cumulative_count)
                        )
                    else:
                        lines.append(
                            f'{self.name}_bucket{{le="{bucket_val}"}} {cumulative_count}'
                        )

                # 总数
                total = self._counts.get(key, 0)
                lines.append(f'{self.name}_count{label_part} {total}')
                # 总和
                lines.append(f'{self.name}_sum{label_part} {round(self._sums.get(key, 0.0), 2)}')

        return '\n'.join(lines) + '\n'


# ─────────────────────────────────────────────
# 🔒 P3-5: 增强指标收集器
# ─────────────────────────────────────────────

class EnhancedMetricsCollector:
    """
    🔒 P3-5: 增强的 Prometheus 指标收集器

    提供业务 + 系统指标
    """

    def __init__(self):
        # ── 业务指标 ──
        # API 请求数
        self.api_requests = Counter(
            'rmfood_api_requests_total',
            'API 请求总数',
            ['method', 'endpoint', 'status_code', 'tenant'],
        )

        # API 请求延迟
        self.api_latency = Histogram(
            'rmfood_api_request_duration_seconds',
            'API 请求延迟（毫秒转秒）',
            ['method', 'endpoint', 'tenant'],
        )

        # 错误计数
        self.api_errors = Counter(
            'rmfood_api_errors_total',
            'API 错误总数',
            ['method', 'endpoint', 'error_type', 'tenant'],
        )

        # 活跃请求数
        self.active_requests = Gauge(
            'rmfood_api_active_requests',
            '当前活跃请求数',
            ['method', 'endpoint'],
        )

        # ── 业务特定指标 ──
        # 配方相关
        self.formula_created = Counter(
            'rmfood_formula_created_total',
            '创建的配方总数',
            ['source', 'tenant'],
        )

        self.formula_ai_generated = Counter(
            'rmfood_formula_ai_generated_total',
            'AI 生成配方数',
            ['model', 'tenant'],
        )

        # 用户相关
        self.user_registrations = Counter(
            'rmfood_user_registrations_total',
            '用户注册总数',
            ['method'],
        )

        self.user_logins = Counter(
            'rmfood_user_logins_total',
            '用户登录总数',
            ['method'],
        )

        # AI 推理相关
        self.ai_inference_requests = Counter(
            'rmfood_ai_inference_total',
            'AI 推理请求总数',
            ['model', 'status'],
        )

        self.ai_inference_latency = Histogram(
            'rmfood_ai_inference_duration_seconds',
            'AI 推理延迟（秒）',
            ['model'],
        )

        self.ai_inference_queue_size = Gauge(
            'rmfood_ai_inference_queue_size',
            'AI 推理队列大小',
        )

        # 数据库相关
        self.db_query_count = Counter(
            'rmfood_db_queries_total',
            '数据库查询总数',
            ['operation', 'table'],
        )

        self.db_query_latency = Histogram(
            'rmfood_db_query_duration_seconds',
            '数据库查询延迟（秒）',
            ['operation', 'table'],
        )

        # 缓存相关
        self.cache_hits = Counter(
            'rmfood_cache_hits_total',
            '缓存命中次数',
            ['cache_name'],
        )

        self.cache_misses = Counter(
            'rmfood_cache_misses_total',
            '缓存未命中次数',
            ['cache_name'],
        )

        self.cache_hit_rate = Gauge(
            'rmfood_cache_hit_rate',
            '缓存命中率',
            ['cache_name'],
        )

        # ── 系统指标 ──
        self.system_cpu = Gauge(
            'rmfood_system_cpu_percent',
            'CPU 使用率（%）',
        )

        self.system_memory = Gauge(
            'rmfood_system_memory_percent',
            '内存使用率（%）',
        )

        self.system_memory_bytes = Gauge(
            'rmfood_system_memory_bytes',
            '内存使用量（字节）',
            ['type'],
        )

        self.system_disk = Gauge(
            'rmfood_system_disk_percent',
            '磁盘使用率（%）',
            ['mountpoint'],
        )

        self.system_network = Counter(
            'rmfood_system_network_bytes_total',
            '网络流量（字节）',
            ['direction'],
        )

        # 进程指标
        self.process_memory_mb = Gauge(
            'rmfood_process_memory_mb',
            '进程内存使用（MB）',
        )

        self.process_cpu_percent = Gauge(
            'rmfood_process_cpu_percent',
            '进程 CPU 使用率（%）',
        )

        # 前端性能指标（客户端上报）
        self.client_perf_lcp = Histogram(
            'rmfood_client_lcp_ms',
            '前端 LCP（毫秒）',
            ['page'],
        )

        self.client_perf_cls = Histogram(
            'rmfood_client_cls',
            '前端 CLS（无量纲）',
            ['page'],
        )

        self.client_perf_fid = Histogram(
            'rmfood_client_fid_ms',
            '前端 FID（毫秒）',
            ['page'],
        )

        # 健康状态
        self.health_status = Gauge(
            'rmfood_health_status',
            '健康状态（1=健康，0=不健康）',
            ['component'],
        )

        # ── 所有指标集合 ──
        self._all_metrics = [
            self.api_requests,
            self.api_latency,
            self.api_errors,
            self.active_requests,
            self.formula_created,
            self.formula_ai_generated,
            self.user_registrations,
            self.user_logins,
            self.ai_inference_requests,
            self.ai_inference_latency,
            self.ai_inference_queue_size,
            self.db_query_count,
            self.db_query_latency,
            self.cache_hits,
            self.cache_misses,
            self.cache_hit_rate,
            self.system_cpu,
            self.system_memory,
            self.system_memory_bytes,
            self.system_disk,
            self.system_network,
            self.process_memory_mb,
            self.process_cpu_percent,
            self.client_perf_lcp,
            self.client_perf_cls,
            self.client_perf_fid,
            self.health_status,
        ]

        # 定时更新系统指标
        self._system_update_thread = None
        self._stop_event = threading.Event()
        self._start_system_monitor()

    # ── 业务指标便捷方法 ──

    def record_request(self, method: str, endpoint: str, status_code: int, duration_ms: float, tenant: str = 'default'):
        """记录 API 请求指标"""
        self.api_requests.inc(1.0, {'method': method, 'endpoint': endpoint, 'status_code': str(status_code), 'tenant': tenant})
        self.api_latency.observe(duration_ms / 1000.0, {'method': method, 'endpoint': endpoint, 'tenant': tenant})
        if status_code >= 400:
            error_type = str(status_code // 100) + 'xx'
            self.api_errors.inc(1.0, {'method': method, 'endpoint': endpoint, 'error_type': error_type, 'tenant': tenant})

    def record_formula_created(self, source: str = 'manual', tenant: str = 'default'):
        """记录配方创建"""
        self.formula_created.inc(1.0, {'source': source, 'tenant': tenant})

    def record_formula_ai_generated(self, model: str, tenant: str = 'default'):
        """记录 AI 生成配方"""
        self.formula_ai_generated.inc(1.0, {'model': model, 'tenant': tenant})

    def record_user_login(self, method: str = 'password'):
        """记录用户登录"""
        self.user_logins.inc(1.0, {'method': method})

    def record_user_registration(self, method: str = 'email'):
        """记录用户注册"""
        self.user_registrations.inc(1.0, {'method': method})

    def record_ai_inference(self, model: str, duration_seconds: float, success: bool = True):
        """记录 AI 推理"""
        status = 'success' if success else 'error'
        self.ai_inference_requests.inc(1.0, {'model': model, 'status': status})
        self.ai_inference_latency.observe(duration_seconds, {'model': model})

    def record_db_query(self, operation: str, table: str, duration_seconds: float):
        """记录数据库查询"""
        self.db_query_count.inc(1.0, {'operation': operation, 'table': table})
        self.db_query_latency.observe(duration_seconds, {'operation': operation, 'table': table})

    def record_cache(self, cache_name: str, hit: bool):
        """记录缓存命中/未命中"""
        if hit:
            self.cache_hits.inc(1.0, {'cache_name': cache_name})
        else:
            self.cache_misses.inc(1.0, {'cache_name': cache_name})

        # 计算命中率
        hits = self.cache_hits.get({'cache_name': cache_name})
        misses = self.cache_misses.get({'cache_name': cache_name})
        total = hits + misses
        if total > 0:
            self.cache_hit_rate.set(round(hits / total, 4), {'cache_name': cache_name})

    def record_client_perf(self, page: str, lcp_ms: float = None, cls: float = None, fid_ms: float = None):
        """记录客户端性能指标"""
        if lcp_ms is not None:
            self.client_perf_lcp.observe(lcp_ms, {'page': page})
        if cls is not None:
            self.client_perf_cls.observe(cls, {'page': page})
        if fid_ms is not None:
            self.client_perf_fid.observe(fid_ms, {'page': page})

    def record_health_status(self, component: str, healthy: bool):
        """记录组件健康状态"""
        self.health_status.set(1.0 if healthy else 0.0, {'component': component})

    # ── 系统指标更新 ──

    def _update_system_metrics(self):
        """定时更新系统资源指标"""
        try:
            import psutil

            # CPU 使用率
            cpu_percent = psutil.cpu_percent(interval=0.1)
            self.system_cpu.set(round(cpu_percent, 2))

            # 内存
            memory = psutil.virtual_memory()
            self.system_memory.set(round(memory.percent, 2))
            self.system_memory_bytes.set(float(memory.used), {'type': 'used'})
            self.system_memory_bytes.set(float(memory.total), {'type': 'total'})
            self.system_memory_bytes.set(float(memory.available), {'type': 'available'})

            # 磁盘
            for partition in psutil.disk_partitions():
                try:
                    usage = psutil.disk_usage(partition.mountpoint)
                    self.system_disk.set(round(usage.percent, 2), {'mountpoint': partition.mountpoint})
                except PermissionError:
                    continue

            # 进程指标
            proc = psutil.Process()
            self.process_memory_mb.set(round(proc.memory_info().rss / (1024 * 1024), 2))
            self.process_cpu_percent.set(round(proc.cpu_percent(interval=0.1), 2))

            # 网络（增量）
            net = psutil.net_io_counters()
            if net:
                self.system_network.inc(float(net.bytes_sent), {'direction': 'sent'})
                self.system_network.inc(float(net.bytes_recv), {'direction': 'received'})

        except Exception as e:
            logger.error(f"[Metrics] 系统指标更新失败: {e}")

    def _start_system_monitor(self):
        """启动系统指标监控线程"""
        if self._system_update_thread is not None:
            return

        def monitor_loop():
            while not self._stop_event.is_set():
                try:
                    self._update_system_metrics()
                except Exception as e:
                    logger.error(f"[Metrics] 监控循环异常: {e}")
                self._stop_event.wait(30)  # 每 30 秒更新一次

        self._system_update_thread = threading.Thread(
            target=monitor_loop,
            daemon=True,
            name='metrics-system-monitor',
        )
        self._system_update_thread.start()

    def stop(self):
        """停止指标收集"""
        self._stop_event.set()

    # ── 暴露指标 ──

    def expose(self) -> str:
        """生成 Prometheus 格式的指标文本"""
        output = []
        for metric in self._all_metrics:
            try:
                output.append(metric.expose())
            except Exception as e:
                logger.error(f"[Metrics] 指标暴露失败: {metric.name}: {e}")

        # 添加元信息
        output.append('# HELP rmfood_info RMFOOD 应用信息\n# TYPE rmfood_info gauge\nrmfood_info{version="1.0.0"} 1\n')

        return '\n'.join(output)

    def get_summary(self) -> Dict[str, Any]:
        """获取指标摘要（用于 API）"""
        return {
            "api": {
                "total_requests": sum(self.api_requests._values.values()) if hasattr(self.api_requests, '_values') else 0,
                "total_errors": sum(self.api_errors._values.values()) if hasattr(self.api_errors, '_values') else 0,
                "latency_p50": self.api_latency.get_summary().get("p50", 0),
                "latency_p95": self.api_latency.get_summary().get("p95", 0),
                "latency_p99": self.api_latency.get_summary().get("p99", 0),
            },
            "ai": {
                "total_inferences": sum(self.ai_inference_requests._values.values()) if hasattr(self.ai_inference_requests, '_values') else 0,
                "queue_size": self.ai_inference_queue_size.get(),
            },
            "system": {
                "cpu_percent": self.system_cpu.get(),
                "memory_percent": self.system_memory.get(),
            },
            "timestamp": datetime.now(timezone.utc).isoformat(),
        }


# ─────────────────────────────────────────────
# 🔒 P3-5: 全局单例
# ─────────────────────────────────────────────

metrics_collector = EnhancedMetricsCollector()


# ─────────────────────────────────────────────
# 🔒 P3-5: 主注册函数
# ─────────────────────────────────────────────

def setup_enhanced_metrics(app: FastAPI):
    """
    🔒 P3-5: 注册增强的 Prometheus 指标端点

    新增:
    - GET /metrics/prometheus - Prometheus 指标
    - POST /api/v1/metrics/client-perf - 客户端性能上报
    - GET /api/v1/metrics/summary - 指标摘要（JSON）
    """
    logger.info("[Metrics] 初始化增强 Prometheus 指标收集器")

    # 🔒 P3-5: 添加请求中间件（记录 API 请求指标）
    @app.middleware("http")
    async def metrics_middleware(request: Request, call_next):
        start_time = time.time()
        method = request.method
        endpoint = request.url.path

        # 跳过静态文件和指标端点自身
        is_skipped = endpoint.startswith(('/static', '/uploads', '/metrics', '/openapi.json', '/docs', '/redoc'))

        try:
            if not is_skipped:
                metrics_collector.active_requests.inc(1.0, {'method': method, 'endpoint': endpoint})

            response = await call_next(request)

            if not is_skipped:
                duration_ms = (time.time() - start_time) * 1000
                status_code = response.status_code
                metrics_collector.record_request(
                    method=method,
                    endpoint=endpoint,
                    status_code=status_code,
                    duration_ms=duration_ms,
                )

            return response
        finally:
            if not is_skipped:
                metrics_collector.active_requests.dec(1.0, {'method': method, 'endpoint': endpoint})

    # 🔒 P3-5: Prometheus 指标端点
    @app.get("/metrics/prometheus", tags=["系统"], include_in_schema=False, summary="Prometheus 指标")
    async def prometheus_metrics():
        """返回 Prometheus 格式的指标"""
        metrics_text = metrics_collector.expose()
        return PlainTextResponse(
            content=metrics_text,
            media_type='text/plain; version=0.0.4; charset=utf-8',
        )

    # 🔒 P3-5: 指标摘要端点
    @app.get("/api/v1/metrics/summary", tags=["系统管理"], summary="指标摘要")
    async def metrics_summary():
        """返回 JSON 格式的指标摘要"""
        return metrics_collector.get_summary()

    # 🔒 P3-5: 客户端性能上报端点
    @app.post("/api/v1/metrics/client-perf", tags=["系统管理"], summary="客户端性能上报")
    async def client_performance_report(request: Request):
        """接收前端上报的性能指标"""
        try:
            body = await request.json()

            # 记录各指标
            page = body.get('pagePath', body.get('pageUrl', 'unknown'))

            if 'metrics' in body and isinstance(body['metrics'], list):
                for metric in body['metrics']:
                    name = metric.get('name', '').upper()
                    value = metric.get('value', 0)

                    if name == 'LCP':
                        metrics_collector.record_client_perf(page=page, lcp_ms=value)
                    elif name == 'CLS':
                        metrics_collector.record_client_perf(page=page, cls=value)
                    elif name == 'FID' or name == 'INP':
                        metrics_collector.record_client_perf(page=page, fid_ms=value)

                logger.info(
                    f"[Metrics] 客户端性能上报: {page} - "
                    f"{len(body['metrics'])} 个指标"
                )

            return {"status": "ok", "recorded": len(body.get('metrics', []))}
        except json.JSONDecodeError:
            return JSONResponse(
                status_code=status.HTTP_400_BAD_REQUEST,
                content={"error": "Invalid JSON"},
            )
        except Exception:
            logger.error("[Metrics] 客户端性能上报失败", exc_info=True)
            return JSONResponse(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                content={"error": "指标上报失败"},
            )

    logger.info("[Metrics] 增强指标端点已注册: /metrics/prometheus, /api/v1/metrics/*")


# 便捷方法装饰器
def track_latency(operation: str = None, table: str = None):
    """
    🔒 P3-5: 数据库查询延迟记录装饰器
    """
    def decorator(func: Callable):
        async def wrapper(*args, **kwargs):
            start = time.time()
            try:
                result = await func(*args, **kwargs)
                duration = time.time() - start
                metrics_collector.record_db_query(
                    operation=operation or func.__name__,
                    table=table or 'unknown',
                    duration_seconds=duration,
                )
                return result
            except Exception as e:
                metrics_collector.record_db_query(
                    operation=operation or func.__name__,
                    table=table or 'unknown',
                    duration_seconds=time.time() - start,
                )
                raise e
        return wrapper
    return decorator


# 便捷: 记录 AI 推理
def record_inference_completion(model: str, duration: float, success: bool = True):
    metrics_collector.record_ai_inference(model=model, duration_seconds=duration, success=success)
