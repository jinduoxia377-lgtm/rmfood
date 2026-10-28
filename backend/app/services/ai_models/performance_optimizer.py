"""
PepINVERT 性能优化与缓存管理

提供：
- 智能缓存策略（LRU、TTL、分层缓存）
- 请求限流与并发控制
- 性能指标收集与监控
- 结果导出服务
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import logging
import time
from collections import OrderedDict
from dataclasses import dataclass
from functools import wraps
from typing import Any, Callable, Dict, List, Optional, Tuple

logger = logging.getLogger(__name__)


@dataclass
class CacheEntry:
    """缓存条目"""

    key: str
    value: Any
    created_at: float
    accessed_at: float
    access_count: int = 0
    size_bytes: int = 0


@dataclass
class PerformanceMetrics:
    """性能指标"""

    total_requests: int = 0
    cache_hits: int = 0
    cache_misses: int = 0
    avg_response_time_ms: float = 0
    error_count: int = 0
    active_connections: int = 0


class SmartCache:
    """
    智能缓存管理器

    支持:
    - LRU (Least Recently Used) 淘汰策略
    - TTL (Time To Live) 过期机制
    - 分层缓存（热数据/温数据）
    - 内存使用监控
    """

    def __init__(
        self,
        max_size: int = 1000,
        default_ttl: int = 3600,
        hot_threshold: int = 10,
    ):
        self._cache: OrderedDict[str, CacheEntry] = OrderedDict()
        self._max_size = max_size
        self._default_ttl = default_ttl
        self._hot_threshold = hot_threshold
        self._metrics = PerformanceMetrics()
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[Any]:
        """获取缓存值"""
        async with self._lock:
            if key not in self._cache:
                self._metrics.cache_misses += 1
                return None

            entry = self._cache[key]

            if self._is_expired(entry):
                del self._cache[key]
                self._metrics.cache_misses += 1
                return None

            entry.accessed_at = time.time()
            entry.access_count += 1
            self._metrics.cache_hits += 1

            self._cache.move_to_end(key)
            return entry.value

    async def set(
        self,
        key: str,
        value: Any,
        ttl: Optional[int] = None,
    ) -> bool:
        """设置缓存值"""
        async with self._lock:
            try:
                size_bytes = len(json.dumps(value, default=str).encode('utf-8'))

                if len(self._cache) >= self._max_size:
                    await self._evict_lru()

                entry = CacheEntry(
                    key=key,
                    value=value,
                    created_at=time.time(),
                    accessed_at=time.time(),
                    size_bytes=size_bytes,
                )

                if key in self._cache:
                    del self._cache[key]

                self._cache[key] = entry
                return True

            except Exception as e:
                logger.warning(f"缓存写入失败: {e}")
                return False

    async def delete(self, key: str) -> bool:
        """删除缓存条目"""
        async with self._lock:
            if key in self._cache:
                del self._cache[key]
                return True
            return False

    async def clear(self):
        """清空所有缓存"""
        async with self._lock:
            self._cache.clear()

    async def get_stats(self) -> Dict[str, Any]:
        """获取缓存统计信息"""
        hot_entries = sum(
            1 for e in self._cache.values()
            if e.access_count >= self._hot_threshold
        )
        total_size = sum(e.size_bytes for e in self._cache.values())

        hit_rate = (
            self._metrics.cache_hits /
            (self._metrics.cache_hits + self._metrics.cache_misses)
            * 100
            if (self._metrics.cache_hits + self._metrics.cache_misses) > 0
            else 0
        )

        return {
            "total_entries": len(self._cache),
            "max_size": self._max_size,
            "hot_entries": hot_entries,
            "total_size_bytes": total_size,
            "hit_rate_percent": round(hit_rate, 2),
            "hits": self._metrics.cache_hits,
            "misses": self._metrics.cache_misses,
            "default_ttl_seconds": self._default_ttl,
        }

    def _is_expired(self, entry: CacheEntry) -> bool:
        ttl = self._default_ttl
        return (time.time() - entry.created_at) > ttl

    async def _evict_lru(self):
        """淘汰最近最少使用的条目"""
        if self._cache:
            oldest_key = next(iter(self._cache))
            del self._cache[oldest_key]


class RateLimiter:
    """
    请求限流器

    使用滑动窗口算法实现精确的速率控制。
    """

    def __init__(self, requests_per_minute: int = 60, burst_allowance: int = 10):
        self._rpm = requests_per_minute
        self._burst = burst_allowance
        self._requests: Dict[str, List[float]] = {}
        self._lock = asyncio.Lock()

    async def is_allowed(
        self,
        identifier: str,
        cost: int = 1,
    ) -> Tuple[bool, Optional[float]]:
        """
        检查是否允许请求

        Args:
            identifier: 用户ID或IP地址
            cost: 请求成本（复杂操作可设置更高）

        Returns:
            (allowed, retry_after_seconds)
        """
        async with self._lock:
            now = time.time()
            window_start = now - 60

            if identifier not in self._requests:
                self._requests[identifier] = []

            self._requests[identifier] = [
                t for t in self._requests[identifier] if t > window_start
            ]

            current_count = len(self._requests[identifier])
            allowed_count = self._rpm + self._burst

            if current_count + cost <= allowed_count:
                for _ in range(cost):
                    self._requests[identifier].append(now)
                return True, None

            oldest_request = min(self._requests[identifier]) if self._requests[identifier] else now
            retry_after = oldest_request + 60 - now

            return False, max(retry_after, 1.0)

    async def cleanup_old_entries(self):
        """清理过期的请求记录"""
        async with self._lock:
            cutoff = time.time() - 120
            for key in list(self._requests.keys()):
                self._requests[key] = [
                    t for t in self._requests[key] if t > cutoff
                ]
                if not self._requests[key]:
                    del self._requests[key]


class PerformanceMonitor:
    """
    性能监控器

    收集和报告 API 性能指标。
    """

    def __init__(self, sample_rate: float = 0.1):
        self._sample_rate = sample_rate
        self._metrics: Dict[str, List[Dict]] = {}
        self._current_requests: Dict[str, float] = {}

    def start_request(self, request_id: str, endpoint: str):
        """记录请求开始"""
        self._current_requests[request_id] = {
            "endpoint": endpoint,
            "start_time": time.time(),
        }

    def end_request(
        self,
        request_id: str,
        success: bool = True,
        response_size: int = 0,
    ):
        """记录请求结束"""
        if request_id not in self._current_requests:
            return

        req_info = self._current_requests.pop(request_id)
        duration_ms = (time.time() - req_info["start_time"]) * 1000

        endpoint = req_info["endpoint"]
        if endpoint not in self._metrics:
            self._metrics[endpoint] = []

        if random() < self._sample_rate or duration_ms > 1000:
            self._metrics[endpoint].append({
                "duration_ms": round(duration_ms, 2),
                "success": success,
                "response_size": response_size,
                "timestamp": time.time(),
            })

        # 只保留最近的 1000 条记录
        if len(self._metrics[endpoint]) > 1000:
            self._metrics[endpoint] = self._metrics[endpoint][-1000:]

    def get_endpoint_stats(self, endpoint: str) -> Dict[str, Any]:
        """获取特定端点的统计信息"""
        records = self._metrics.get(endpoint, [])

        if not records:
            return {"total_requests": 0}

        durations = [r["duration_ms"] for r in records]
        successes = [r for r in records if r["success"]]

        return {
            "total_requests": len(records),
            "successful_requests": len(successes),
            "error_rate": round(1 - len(successes) / len(records), 4),
            "avg_duration_ms": round(sum(durations) / len(durations), 2),
            "p50_duration_ms": round(sorted(durations)[len(durations) // 2], 2),
            "p95_duration_ms": round(sorted(durations)[int(len(durations) * 0.95)], 2),
            "p99_duration_ms": round(sorted(durations)[int(len(durations) * 0.99)] if len(durations) > 10 else 0, 2),
            "min_duration_ms": round(min(durations), 2),
            "max_duration_ms": round(max(durations), 2),
        }

    def get_all_stats(self) -> Dict[str, Any]:
        """获取所有端点的汇总统计"""
        all_records = []
        for endpoint_records in self._metrics.values():
            all_records.extend(endpoint_records)

        if not all_records:
            return {"total_requests": 0, "endpoints": {}}

        endpoints_stats = {}
        for endpoint in self._metrics:
            endpoints_stats[endpoint] = self.get_endpoint_stats(endpoint)

        return {
            "total_requests": len(all_records),
            "endpoints": endpoints_stats,
        }


class ExportService:
    """
    导出服务

    支持多种格式的结果导出。
    """

    @staticmethod
    def to_json(data: Any, pretty: bool = True) -> str:
        """导出为 JSON 格式"""
        indent = 2 if pretty else None
        return json.dumps(data, indent=indent, ensure_ascii=False, default=str)

    @staticmethod
    def to_csv(peptides: List[Dict[str, Any]]) -> str:
        """导出为 CSV 格式"""
        if not peptides:
            return ""

        headers = list(peptides[0].keys())
        lines = [",".join(headers)]

        for peptide in peptides:
            row = []
            for header in headers:
                value = peptide.get(header, "")
                if isinstance(value, dict):
                    value = json.dumps(value)
                elif isinstance(value, list):
                    value = ";".join(str(v) for v in value)
                row.append(str(value).replace(",", ";"))
            lines.append(",".join(row))

        return "\n".join(lines)

    @staticmethod
    def to_markdown_report(
        analysis_result: Dict[str, Any],
        sequence: str,
    ) -> str:
        """生成 Markdown 格式的分析报告"""
        lines = [
            "# 肽序列深度分析报告",
            "",
            "## 基本信息",
            f"- **序列**: `{sequence}`",
            f"- **分析时间**: {analysis_result.get('generated_at', 'N/A')}",
            "",
        ]

        if "overall_scores" in analysis_result:
            scores = analysis_result["overall_scores"]
            lines.extend([
                "## 综合评分",
                "| 指标 | 得分 |",
                "|------|------|",
                f"| 综合得分 | {(scores.get('composite', 0) * 100):.1f}% |",
                f"| 稳定性 | {(scores.get('stability', 0) * 100):.1f}% |",
                f"| 类药性 | {(scores.get('druglikeness', 0) * 100):.1f}% |",
                f"| 生物活性 | {(scores.get('bioactivity', 0) * 100):.1f}% |",
                f"| 安全性 | {(scores.get('safety', 0) * 100):.1f}% |",
                "",
            ])

        if "basic_properties" in analysis_result:
            props = analysis_result["basic_properties"]
            lines.extend([
                "## 理化性质",
                "| 属性 | 值 |",
                "|------|-----|",
                f"| 分子量 | {props.get('molecular_weight', 'N/A')} Da |",
                f"| LogP | {props.get('logp', 'N/A')} |",
                f"| TPSA | {props.get('tpsa', 'N/A')} Å² |",
                f"| GRAVY | {props.get('gravy', 'N/A')} |",
                f"| 等电点(pI) | {props.get('isoelectric_point', 'N/A')} |",
                "",
            ])

        if "secondary_structure" in analysis_result:
            ss = analysis_result["secondary_structure"]
            pct = ss.get("percentages", {})
            lines.extend([
                "## 二级结构预测",
                f"- **α-Helix**: {pct.get('alpha_helix', 0):.1f}%",
                f"- **β-Sheet**: {pct.get('beta_sheet', 0):.1f}%",
                f"- **Random Coil**: {pct.get('random_coil', 0):.1f}%",
                "",
            ])

        if "bioactivity_predictions" in analysis_result:
            bioact = analysis_result["bioactivity_predictions"]
            lines.extend([
                "## 生物活性预测",
                "| 目标活性 | 得分 | 等级 |",
                "|----------|------|------|",
            ])
            for activity, data in bioact.items():
                score = data.get("score", 0) if isinstance(data, dict) else data
                tier = data.get("tier", "-") if isinstance(data, dict) else "-"
                lines.append(f"| {activity} | {(score * 100):.1f}% | {tier.upper()} |")
            lines.append("")

        if "safety_assessment" in analysis_result:
            safety = analysis_result["safety_assessment"]
            lines.extend([
                "## 安全性评估",
                f"- **安全等级**: {safety.get('risk_level', 'N/A').upper()}",
                f"- **安全得分**: {(safety.get('safety_score', 0) * 100):.1f}%",
                f"- **免疫原性风险**: {(safety.get('immunogenicity_risk', 0) * 100):.1f}%",
                f"- **推荐储存**: {safety.get('recommended_storage_conditions', 'N/A')}",
                "",
            ])

        lines.extend([
            "---",
            "*报告由 RMFOOD PepINVERT 高级分析引擎自动生成*",
        ])

        return "\n".join(lines)


def cached(ttl: Optional[int] = None):
    """
    缓存装饰器工厂

    用法:
        @cached(ttl=300)
        async def my_function(arg1, arg2):
            ...
    """

    def decorator(func: Callable):
        cache_instance = SmartCache(default_ttl=ttl or 3600)

        @wraps(func)
        async def wrapper(*args, **kwargs):
            cache_key = _generate_cache_key(func.__name__, args, kwargs)

            cached_value = await cache_instance.get(cache_key)
            if cached_value is not None:
                logger.debug(f"缓存命中: {func.__name__}")
                return cached_value

            result = await func(*args, **kwargs)
            await cache_instance.set(cache_key, result, ttl=ttl)

            return result

        wrapper._cache = cache_instance
        return wrapper

    return decorator


def rate_limit(rpm: int = 60, burst: int = 10):
    """
    限流装饰器工厂

    用法:
        @rate_limit(rpm=30)
        async def my_api_endpoint(request):
            ...
    """
    limiter = RateLimiter(requests_per_minute=rpm, burst_allowance=burst)

    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            from fastapi import Request

            request = None
            for arg in args:
                if isinstance(arg, Request):
                    request = arg
                    break

            identifier = request.client.host if request else "unknown"
            allowed, retry_after = await limiter.is_allowed(identifier)

            if not allowed:
                from fastapi import HTTPException

                raise HTTPException(
                    status_code=429,
                    detail={
                        "error": "请求过于频繁，请稍后重试",
                        "retry_after_seconds": retry_after,
                    },
                )

            return await func(*args, **kwargs)

        return wrapper

    return decorator


def track_performance():
    """
    性能追踪装饰器

    记录函数执行时间和成功率。
    """
    monitor = PerformanceMonitor(sample_rate=1.0)

    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            import uuid as _uuid

            request_id = str(_uuid.uuid4())[:8]
            endpoint = func.__qualname__

            monitor.start_request(request_id, endpoint)

            try:
                result = await func(*args, **kwargs)
                monitor.end_request(request_id, success=True)
                return result

            except Exception as e:
                monitor.end_request(request_id, success=False)
                raise

        wrapper._monitor = monitor
        return wrapper

    return decorator


def _generate_cache_key(func_name: str, args: tuple, kwargs: dict) -> str:
    """生成缓存键"""
    key_data = {
        "func": func_name,
        "args": str(args)[:200],
        "kwargs": str(kwargs)[:200],
    }
    key_str = json.dumps(key_data, sort_keys=True, default=str)
    return hashlib.md5(key_str.encode()).hexdigest()


def random() -> float:
    """简单随机数生成"""
    import random as _random
    return _random.random()


_global_cache: Optional[SmartCache] = None
_global_limiter: Optional[RateLimiter] = None
_global_monitor: Optional[PerformanceMonitor] = None


def get_cache() -> SmartCache:
    global _global_cache
    if _global_cache is None:
        _global_cache = SmartCache()
    return _global_cache


def get_limiter() -> RateLimiter:
    global _global_limiter
    if _global_limiter is None:
        _global_limiter = RateLimiter()
    return _global_limiter


def get_monitor() -> PerformanceMonitor:
    global _global_monitor
    if _global_monitor is None:
        _global_monitor = PerformanceMonitor()
    return _global_monitor
