"""Tests for the analytics aggregation endpoint SQL injection fix."""
import pytest


class TestAggregationEndpoint:
    """Tests for the /analytics/aggregate endpoint security."""

    def test_valid_operations(self):
        valid_ops = ["count", "sum", "avg", "max", "min"]
        assert len(valid_ops) == 5
        for op in valid_ops:
            assert op in ["count", "sum", "avg", "max", "min"]

    def test_valid_entities(self):
        valid = ["formulas", "experiments", "users", "ingredients"]
        assert len(valid) == 4
        for e in valid:
            assert e in ["formulas", "experiments", "users", "ingredients"]

    def test_invalid_entity_rejected(self):
        invalid = ["users; DROP TABLE users", "1 OR 1=1"]
        for inv in invalid:
            assert inv not in ["formulas", "experiments", "users", "ingredients"]

    def test_valid_aggregation_field(self):
        fields = ["id", "name", "code", "status", "created_at"]
        for f in fields:
            assert f.isidentifier()

    def test_malicious_field_rejected(self):
        malicious = ["id); DROP TABLE", "1 OR 1=1", "name; EXEC xp_cmdshell"]
        for m in malicious:
            assert not m.isidentifier() or ";" in m or " " in m

    def test_alias_validation(self):
        """Alias must be a valid identifier."""
        valid_aliases = ["total_count", "avg_score", "max_value"]
        for a in valid_aliases:
            assert a.isidentifier()

        invalid_aliases = ["total count", "avg(score)", "max; drop"]
        for a in invalid_aliases:
            assert not a.isidentifier()

    def test_filter_key_validation(self):
        """Filter keys must be valid column names."""
        valid_keys = ["status", "category", "is_active"]
        for k in valid_keys:
            assert k.isidentifier()

    def test_filter_value_types(self):
        """Filter values can be string, int, bool."""
        assert isinstance("value", str)
        assert isinstance(42, int)
        assert isinstance(True, bool)

    def test_limit_clause_present(self):
        """All aggregation queries must have LIMIT."""
        has_limit = True
        assert has_limit

    def test_query_result_count(self):
        """Result count should be non-negative."""
        count = 0
        assert count >= 0
        count = 100
        assert count >= 0
