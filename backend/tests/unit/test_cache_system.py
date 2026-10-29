"""
Unit tests for the multi-level cache system.

Tests cover:
- CacheStats: hit_rate calculation
- MemoryCacheEntry: is_expired property
- MultiLevelCache: L1 set/get, TTL expiry, LRU eviction, null caching,
  Redis unavailable degradation

Uses asyncio and mocks Redis if needed.
"""
import time

import pytest

from app.core.performance.cache_system import (
    CacheConfig,
    CacheStats,
    MemoryCacheEntry,
    MultiLevelCache,
)


# ════════════════════════════════════════════════════════════════
# CacheStats Tests
# ════════════════════════════════════════════════════════════════


class TestCacheStats:
    """Tests for CacheStats hit_rate property."""

    def test_hit_rate_zero_when_no_requests(self):
        stats = CacheStats(hits=0, misses=0)
        assert stats.hit_rate == 0.0

    def test_hit_rate_100_percent_all_hits(self):
        stats = CacheStats(hits=10, misses=0)
        assert stats.hit_rate == 100.0

    def test_hit_rate_50_percent(self):
        stats = CacheStats(hits=5, misses=5)
        assert stats.hit_rate == 50.0

    def test_hit_rate_correct_percentage(self):
        stats = CacheStats(hits=3, misses=7)
        assert stats.hit_rate == pytest.approx(30.0, abs=0.01)

    def test_hit_rate_zero_percent_all_misses(self):
        stats = CacheStats(hits=0, misses=100)
        assert stats.hit_rate == 0.0

    def test_to_dict_contains_all_fields(self):
        stats = CacheStats(hits=10, misses=5, sets=8, deletes=2, evictions=1, errors=0)
        d = stats.to_dict()
        assert "hits" in d
        assert "misses" in d
        assert "hit_rate" in d
        assert "total_requests" in d
        assert "sets" in d
        assert "deletes" in d
        assert "evictions" in d
        assert "errors" in d

    def test_to_dict_total_requests(self):
        stats = CacheStats(hits=7, misses=3)
        d = stats.to_dict()
        assert d["total_requests"] == 10

    def test_to_dict_hit_rate_string_format(self):
        stats = CacheStats(hits=1, misses=1)
        d = stats.to_dict()
        assert d["hit_rate"] == "50.00%"


# ════════════════════════════════════════════════════════════════
# MemoryCacheEntry Tests
# ════════════════════════════════════════════════════════════════


class TestMemoryCacheEntry:
    """Tests for MemoryCacheEntry is_expired property."""

    def test_fresh_entry_not_expired(self):
        entry = MemoryCacheEntry(value="test_data", ttl_seconds=300)
        assert entry.is_expired is False

    def test_expired_entry_returns_true(self):
        entry = MemoryCacheEntry(value="test_data", ttl_seconds=1)
        # Simulate time passing by setting expires_at to the past
        entry.expires_at = time.time() - 10
        assert entry.is_expired is True

    def test_ttl_seconds_stored(self):
        entry = MemoryCacheEntry(value="data", ttl_seconds=600)
        assert entry.expires_at > entry.created_at
        assert entry.expires_at - entry.created_at == pytest.approx(600, abs=1)

    def test_value_stored(self):
        entry = MemoryCacheEntry(value={"key": "value"}, ttl_seconds=60)
        assert entry.value == {"key": "value"}

    def test_size_bytes_calculated(self):
        entry = MemoryCacheEntry(value="hello", ttl_seconds=60)
        assert entry.size_bytes > 0

    def test_size_bytes_zero_for_none_value(self):
        entry = MemoryCacheEntry(value=None, ttl_seconds=60)
        assert entry.size_bytes == 0

    def test_ttl_remaining_positive(self):
        entry = MemoryCacheEntry(value="data", ttl_seconds=300)
        remaining = entry.ttl
        assert remaining > 0
        assert remaining <= 300

    def test_ttl_remaining_zero_when_expired(self):
        entry = MemoryCacheEntry(value="data", ttl_seconds=1)
        entry.expires_at = time.time() - 10
        assert entry.ttl == 0


# ════════════════════════════════════════════════════════════════
# MultiLevelCache L1 Tests
# ════════════════════════════════════════════════════════════════


class TestMultiLevelCacheL1Basic:
    """Tests for basic L1 memory cache set/get."""

    @pytest.fixture
    def cache(self):
        config = CacheConfig(
            l1_enabled=True,
            l1_max_size=100,
            l1_default_ttl_seconds=300,
            l2_enabled=False,
            enable_stats=True,
        )
        return MultiLevelCache(config)

    @pytest.mark.asyncio
    async def test_set_and_get_basic(self, cache):
        await cache.set("key1", "value1")
        result = await cache.get("key1")
        assert result == "value1"

    @pytest.mark.asyncio
    async def test_set_and_get_dict(self, cache):
        data = {"name": "test", "score": 42}
        await cache.set("key2", data)
        result = await cache.get("key2")
        assert result == data

    @pytest.mark.asyncio
    async def test_get_nonexistent_key_returns_none(self, cache):
        result = await cache.get("nonexistent")
        assert result is None

    @pytest.mark.asyncio
    async def test_set_returns_true(self, cache):
        result = await cache.set("key1", "value1")
        assert result is True

    @pytest.mark.asyncio
    async def test_delete_existing_key(self, cache):
        await cache.set("key1", "value1")
        deleted = await cache.delete("key1")
        assert deleted is True
        result = await cache.get("key1")
        assert result is None

    @pytest.mark.asyncio
    async def test_delete_nonexistent_key_returns_false(self, cache):
        deleted = await cache.delete("nonexistent")
        assert deleted is False

    @pytest.mark.asyncio
    async def test_overwrite_existing_key(self, cache):
        await cache.set("key1", "original")
        await cache.set("key1", "updated")
        result = await cache.get("key1")
        assert result == "updated"

    @pytest.mark.asyncio
    async def test_stats_tracked_on_set(self, cache):
        await cache.set("k1", "v1")
        await cache.set("k2", "v2")
        assert cache.stats.sets == 2

    @pytest.mark.asyncio
    async def test_stats_tracked_on_hit(self, cache):
        await cache.set("key1", "value1")
        await cache.get("key1")
        assert cache.stats.hits >= 1

    @pytest.mark.asyncio
    async def test_stats_tracked_on_miss(self, cache):
        await cache.get("nonexistent")
        assert cache.stats.misses >= 1


class TestMultiLevelCacheTTLExpiry:
    """Tests for L1 cache TTL expiry."""

    @pytest.mark.asyncio
    async def test_entry_expires_after_ttl(self):
        config = CacheConfig(
            l1_enabled=True,
            l1_default_ttl_seconds=1,  # 1 second TTL
            l2_enabled=False,
        )
        cache = MultiLevelCache(config)

        await cache.set("key1", "value1")
        # Immediately should be available
        result = await cache.get("key1")
        assert result == "value1"

        # Manually expire the entry
        entry = cache._l1_cache["key1"]
        entry.expires_at = time.time() - 1

        result = await cache.get("key1")
        assert result is None

    @pytest.mark.asyncio
    async def test_custom_ttl_parameter(self):
        config = CacheConfig(
            l1_enabled=True,
            l1_default_ttl_seconds=300,
            l2_enabled=False,
        )
        cache = MultiLevelCache(config)

        await cache.set("key1", "value1", ttl=2)
        entry = cache._l1_cache["key1"]
        assert entry.expires_at - entry.created_at == pytest.approx(2, abs=1)

    @pytest.mark.asyncio
    async def test_expired_entry_eviction_increments_stats(self):
        config = CacheConfig(
            l1_enabled=True,
            l1_default_ttl_seconds=1,
            l2_enabled=False,
            enable_stats=True,
        )
        cache = MultiLevelCache(config)

        await cache.set("key1", "value1")
        entry = cache._l1_cache["key1"]
        entry.expires_at = time.time() - 1

        await cache.get("key1")
        assert cache.stats.evictions >= 1


class TestMultiLevelCacheLRUEviction:
    """Tests for L1 LRU eviction when capacity is reached."""

    @pytest.mark.asyncio
    async def test_lru_eviction_when_full(self):
        config = CacheConfig(
            l1_enabled=True,
            l1_max_size=2,  # only 2 items
            l1_default_ttl_seconds=300,
            l2_enabled=False,
            enable_stats=True,
        )
        cache = MultiLevelCache(config)

        await cache.set("first", "v1")
        await cache.set("second", "v2")
        # Cache is now at capacity (2 items)
        await cache.set("third", "v3")  # should evict "first"

        # "first" should have been evicted
        result_first = await cache.get("first")
        assert result_first is None

        # "second" and "third" should still be present
        result_second = await cache.get("second")
        assert result_second == "v2"
        result_third = await cache.get("third")
        assert result_third == "v3"

    @pytest.mark.asyncio
    async def test_lru_eviction_increments_eviction_count(self):
        config = CacheConfig(
            l1_enabled=True,
            l1_max_size=2,
            l1_default_ttl_seconds=300,
            l2_enabled=False,
            enable_stats=True,
        )
        cache = MultiLevelCache(config)

        await cache.set("a", 1)
        await cache.set("b", 2)
        await cache.set("c", 3)  # evicts "a"
        assert cache.stats.evictions >= 1

    @pytest.mark.asyncio
    async def test_lru_access_refreshes_position(self):
        config = CacheConfig(
            l1_enabled=True,
            l1_max_size=2,
            l1_default_ttl_seconds=300,
            l2_enabled=False,
        )
        cache = MultiLevelCache(config)

        await cache.set("first", "v1")
        await cache.set("second", "v2")
        # Access "first" to move it to end (most recently used)
        await cache.get("first")
        # Now add a third item -- "second" should be evicted (least recently used)
        await cache.set("third", "v3")

        result_first = await cache.get("first")
        assert result_first == "v1"  # still present (was accessed)
        result_second = await cache.get("second")
        assert result_second is None  # evicted


class TestMultiLevelCacheNullCaching:
    """Tests for null value caching (cache penetration prevention)."""

    @pytest.mark.asyncio
    async def test_null_caching_enabled(self):
        config = CacheConfig(
            l1_enabled=True,
            l2_enabled=False,
            enable_null_caching=True,
            null_ttl_seconds=60,
        )
        cache = MultiLevelCache(config)

        await cache.set("missing_key", None)
        result = await cache.get("missing_key")
        # Null caching stores sentinel; get returns the sentinel (not None)
        # This prevents cache penetration by marking the key as "known empty"
        assert result is not None  # sentinel stored

    @pytest.mark.asyncio
    async def test_null_cached_as_sentinel(self):
        config = CacheConfig(
            l1_enabled=True,
            l2_enabled=False,
            enable_null_caching=True,
            null_ttl_seconds=60,
        )
        cache = MultiLevelCache(config)

        await cache.set("key", None)
        # Internally it should be stored as "__NULL__"
        entry = cache._l1_cache.get("key")
        assert entry is not None
        assert entry.value == "__NULL__"

    @pytest.mark.asyncio
    async def test_null_caching_disabled_does_not_cache(self):
        config = CacheConfig(
            l1_enabled=True,
            l2_enabled=False,
            enable_null_caching=False,
        )
        cache = MultiLevelCache(config)

        await cache.set("key", None)
        # When null caching is disabled, None should still be stored
        # but retrieval depends on implementation
        result = await cache.get("key")
        # With null caching disabled, None is stored directly
        assert result is None


class TestMultiLevelCacheRedisDegradation:
    """Tests for graceful degradation when Redis is unavailable."""

    @pytest.mark.asyncio
    async def test_l1_works_without_redis(self):
        config = CacheConfig(
            l1_enabled=True,
            l2_enabled=False,  # Redis disabled
            l1_default_ttl_seconds=300,
        )
        cache = MultiLevelCache(config)

        await cache.set("key1", "value1")
        result = await cache.get("key1")
        assert result == "value1"

    @pytest.mark.asyncio
    async def test_redis_unavailable_flag(self):
        config = CacheConfig(
            l1_enabled=True,
            l2_enabled=False,
        )
        cache = MultiLevelCache(config)
        assert cache._redis_available is False

    @pytest.mark.asyncio
    async def test_l1_disabled_l2_disabled_returns_none(self):
        config = CacheConfig(
            l1_enabled=False,
            l2_enabled=False,
        )
        cache = MultiLevelCache(config)

        await cache.set("key1", "value1")
        result = await cache.get("key1")
        assert result is None

    @pytest.mark.asyncio
    async def test_l1_only_cache_roundtrip(self):
        """Full roundtrip with L1 only (no Redis)."""
        config = CacheConfig(
            l1_enabled=True,
            l1_max_size=50,
            l1_default_ttl_seconds=300,
            l2_enabled=False,
            enable_stats=True,
        )
        cache = MultiLevelCache(config)

        test_data = {
            "seq:VLGYTKEGN": {"score": 0.85, "tier": "high"},
            "seq:VPP": {"score": 0.72, "tier": "moderate"},
            "seq:IPP": {"score": 0.68, "tier": "moderate"},
        }

        for k, v in test_data.items():
            await cache.set(k, v)

        for k, v in test_data.items():
            result = await cache.get(k)
            assert result == v

    @pytest.mark.asyncio
    async def test_stats_tracking_without_redis(self):
        config = CacheConfig(
            l1_enabled=True,
            l2_enabled=False,
            enable_stats=True,
        )
        cache = MultiLevelCache(config)

        await cache.set("a", 1)
        await cache.get("a")
        await cache.get("missing")
        await cache.delete("a")

        assert cache.stats.sets == 1
        assert cache.stats.hits >= 1
        assert cache.stats.misses >= 1
        assert cache.stats.deletes == 1


class TestMultiLevelCacheEdgeCases:
    """Edge case tests for MultiLevelCache."""

    @pytest.mark.asyncio
    async def test_get_stats_returns_dict(self):
        config = CacheConfig(l1_enabled=True, l2_enabled=False)
        cache = MultiLevelCache(config)
        stats = cache.get_stats()
        assert isinstance(stats, dict)
        assert "l1_size" in stats
        assert "l1_max_size" in stats
        assert "l1_usage_percent" in stats
        assert "l2_available" in stats

    @pytest.mark.asyncio
    async def test_clear_all_empties_l1(self):
        config = CacheConfig(l1_enabled=True, l2_enabled=False)
        cache = MultiLevelCache(config)

        await cache.set("k1", "v1")
        await cache.set("k2", "v2")
        await cache.clear_all()

        assert await cache.get("k1") is None
        assert await cache.get("k2") is None
        assert len(cache._l1_cache) == 0

    @pytest.mark.asyncio
    async def test_set_with_list_value(self):
        config = CacheConfig(l1_enabled=True, l2_enabled=False)
        cache = MultiLevelCache(config)

        data = [1, 2, 3, "a", "b"]
        await cache.set("list_key", data)
        result = await cache.get("list_key")
        assert result == data

    @pytest.mark.asyncio
    async def test_set_with_nested_dict(self):
        config = CacheConfig(l1_enabled=True, l2_enabled=False)
        cache = MultiLevelCache(config)

        data = {"outer": {"inner": {"deep": 42}}}
        await cache.set("nested", data)
        result = await cache.get("nested")
        assert result == data

    @pytest.mark.asyncio
    async def test_max_size_one_eviction(self):
        config = CacheConfig(
            l1_enabled=True,
            l1_max_size=1,
            l2_enabled=False,
        )
        cache = MultiLevelCache(config)

        await cache.set("only", "one")
        await cache.set("new", "replaces")
        assert await cache.get("only") is None
        assert await cache.get("new") == "replaces"

    @pytest.mark.asyncio
    async def test_hit_rate_after_mixed_operations(self):
        config = CacheConfig(
            l1_enabled=True,
            l2_enabled=False,
            enable_stats=True,
        )
        cache = MultiLevelCache(config)

        # 2 hits (set then get), 2 misses (get nonexistent)
        await cache.set("k1", "v1")
        await cache.get("k1")          # hit
        await cache.set("k2", "v2")
        await cache.get("k2")          # hit
        await cache.get("missing1")    # miss
        await cache.get("missing2")    # miss

        stats = cache.stats
        assert stats.hits >= 2
        assert stats.misses >= 2
        assert stats.hit_rate == pytest.approx(50.0, abs=5.0)

    @pytest.mark.asyncio
    async def test_tags_not_supported_without_redis(self):
        """Tags are a Redis feature; with L1-only, set should still succeed."""
        config = CacheConfig(l1_enabled=True, l2_enabled=False)
        cache = MultiLevelCache(config)
        result = await cache.set("key", "value", tags=["tag1"])
        assert result is True
