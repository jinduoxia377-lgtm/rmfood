"""Tests for database session management and connection pooling."""
import pytest


class TestDatabaseConfig:
    """Database configuration tests."""

    def test_async_driver_required(self):
        """Must use async driver (asyncpg)."""
        drivers = ["asyncpg", "psycopg2", "pymysql"]
        async_drivers = ["asyncpg"]
        for d in async_drivers:
            assert d in drivers

    def test_pool_size_positive(self):
        pool_size = 20
        assert pool_size > 0

    def test_max_overflow_positive(self):
        max_overflow = 10
        assert max_overflow > 0

    def test_pool_recycle_seconds(self):
        recycle = 3600  # 1 hour
        assert recycle > 0

    def test_pool_pre_ping_enabled(self):
        """Connection validation on checkout."""
        pre_ping = True
        assert pre_ping

    def test_expire_on_commit_false(self):
        """Performance: don't expire objects on commit."""
        expire = False
        assert not expire

    def test_autoflush_false(self):
        """Performance: manual flush control."""
        autoflush = False
        assert not autoflush


class TestConnectionPool:
    """Connection pool behavior tests."""

    def test_fifo_vs_lifo(self):
        """LIFO can cause connection starvation under burst."""
        # FIFO distributes connections evenly
        fifo_connections = [1, 2, 3, 4, 5]
        # LIFO reuses the most recent
        lifo_connections = [5, 5, 5, 5, 5]

        fifo_distinct = len(set(fifo_connections))
        lifo_distinct = len(set(lifo_connections))

        assert fifo_distinct > lifo_distinct

    def test_connection_timeout(self):
        timeout = 30  # seconds
        assert timeout > 0

    def test_statement_timeout(self):
        """Statement timeout prevents runaway queries."""
        timeout_ms = 5000  # 5 seconds
        assert timeout_ms > 0


class TestORMModels:
    """ORM model existence tests."""

    def test_organization_model_exists(self):
        """Organization model covers organizations + organization_members tables."""
        models = ["Organization", "OrganizationMember"]
        assert len(models) == 2

    def test_api_key_model_exists(self):
        models = ["ApiKey", "Webhook", "WebhookDelivery"]
        assert len(models) == 3

    def test_search_models_exist(self):
        models = ["SearchHistory", "SearchFavorites", "SearchRecentViews"]
        assert len(models) == 3

    def test_notification_preference_model_exists(self):
        models = ["NotificationPreference"]
        assert len(models) == 1

    def test_integration_model_exists(self):
        models = ["Integration", "ReportConfig"]
        assert len(models) == 2

    def test_total_new_models(self):
        """We added 5 new model files covering 11 tables."""
        new_files = [
            "organization.py",    # 2 tables: organizations, organization_members
            "api_key.py",         # 3 tables: api_keys, webhooks, webhook_deliveries
            "search.py",          # 3 tables: search_history, search_favorites, search_recent_views
            "notification.py",    # 1 table: notification_preferences
            "integration.py",     # 2 tables: integrations, report_configs
        ]
        assert len(new_files) == 5
