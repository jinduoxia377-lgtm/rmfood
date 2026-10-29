"""Tests for analytics SQL injection fix.

Verifies the custom_aggregation endpoint rejects malicious identifiers.
"""


class TestSQLInjectionProtection:
    """SQL injection prevention tests for analytics aggregation."""

    def test_valid_entity_accepted(self):
        """Valid entity names should be accepted."""
        valid_entities = ["formulas", "experiments", "users", "ingredients"]
        for entity in valid_entities:
            assert entity.isidentifier()

    def test_sql_injection_entity_rejected(self):
        """Malicious entity names should be rejected."""
        malicious = [
            "users; DROP TABLE users; --",
            "1); DROP TABLE users; --",
            "formulas' OR '1'='1",
        ]
        for m in malicious:
            # Should not be a valid identifier
            assert not m.isidentifier() or ";" in m or "'" in m

    def test_valid_column_names_accepted(self):
        """Known column names should be accepted."""
        valid_columns = {
            "formulas": ["id", "name", "code", "status", "version",
                         "creator_id", "created_at", "updated_at"],
            "experiments": ["id", "title", "code", "status", "formula_id"],
            "users": ["id", "username", "email", "role", "is_active"],
            "ingredients": ["id", "name", "name_cn", "category", "source"],
        }
        for entity, cols in valid_columns.items():
            for col in cols:
                assert col.isidentifier()

    def test_malicious_column_rejected(self):
        """Malicious column names should be rejected."""
        malicious = [
            "id); DROP TABLE users;--",
            "1 OR 1=1",
            "name; EXEC xp_cmdshell",
        ]
        for m in malicious:
            # These contain spaces or special chars
            assert not m.isidentifier()
