"""
Unit tests for app.api.router_registry module.

Covers:
- RouterRegistry initialization (empty state)
- CRITICAL_MODULES constant
- TAG_OVERRIDES constant
- V1_MODULES constant
- RouterRegistry class behavior

NOTE: We load the module in isolation via importlib.util to avoid
triggering app.api.__init__.py which eagerly imports the entire
application stack (auth, database, etc.).
"""
from __future__ import annotations

import importlib.util
import sys
from pathlib import Path

import pytest

# ── Load router_registry in isolation (bypass app.api __init__.py) ──
_MODULE_PATH = Path(__file__).resolve().parents[2] / "app" / "api" / "router_registry.py"
_spec = importlib.util.spec_from_file_location("_isolated_router_registry", _MODULE_PATH)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)

CRITICAL_MODULES = _mod.CRITICAL_MODULES
TAG_OVERRIDES = _mod.TAG_OVERRIDES
V1_MODULES = _mod.V1_MODULES
RouterRegistry = _mod.RouterRegistry


class TestRouterRegistryInit:
    """RouterRegistry starts with empty internal state."""

    def test_registry_initializes_empty(self):
        registry = RouterRegistry()
        assert registry._routers == {}
        assert registry._deferred_modules == {}
        assert registry._loaded is False

    def test_registry_not_loaded_by_default(self):
        registry = RouterRegistry()
        assert registry._loaded is False


class TestCriticalModules:
    """CRITICAL_MODULES identifies routes that must load at startup."""

    def test_is_frozenset(self):
        assert isinstance(CRITICAL_MODULES, frozenset)

    def test_contains_auth(self):
        assert "auth" in CRITICAL_MODULES

    def test_contains_oauth2_auth(self):
        assert "oauth2_auth" in CRITICAL_MODULES

    def test_contains_users(self):
        assert "users" in CRITICAL_MODULES

    def test_contains_formulas(self):
        assert "formulas" in CRITICAL_MODULES

    def test_contains_databases(self):
        assert "databases" in CRITICAL_MODULES

    def test_contains_knowledge_graph(self):
        assert "knowledge_graph" in CRITICAL_MODULES

    def test_expected_count(self):
        """Verify the total number of critical modules has not changed accidentally."""
        assert len(CRITICAL_MODULES) == 6


class TestTagOverrides:
    """TAG_OVERRIDES maps module names to human-readable Chinese tag labels."""

    def test_is_dict(self):
        assert isinstance(TAG_OVERRIDES, dict)

    def test_auth_maps_to_auth_management(self):
        assert TAG_OVERRIDES["auth"] == ["认证管理"]

    def test_oauth2_auth_maps_to_auth_management(self):
        assert TAG_OVERRIDES["oauth2_auth"] == ["认证管理"]

    def test_users_maps_to_user_management(self):
        assert TAG_OVERRIDES["users"] == ["用户管理"]

    def test_formulas_maps_to_formula_management(self):
        assert TAG_OVERRIDES["formulas"] == ["配方管理"]

    def test_databases_maps_to_knowledge_db(self):
        assert TAG_OVERRIDES["databases"] == ["知识数据库"]

    def test_knowledge_graph_maps_to_knowledge_db(self):
        assert TAG_OVERRIDES["knowledge_graph"] == ["知识数据库"]

    def test_experiments_maps_to_experiment_management(self):
        assert TAG_OVERRIDES["experiments"] == ["实验管理"]

    def test_ai_maps_to_ai_intelligent(self):
        assert TAG_OVERRIDES["ai"] == ["AI智能"]

    def test_chat_maps_to_ai_intelligent(self):
        assert TAG_OVERRIDES["chat"] == ["AI智能"]

    def test_dashboard_maps_to_dashboard(self):
        assert TAG_OVERRIDES["dashboard"] == ["仪表盘"]

    def test_notifications_maps_to_notification_system(self):
        assert TAG_OVERRIDES["notifications"] == ["通知系统"]

    def test_websocket_maps_to_websocket(self):
        assert TAG_OVERRIDES["websocket"] == ["WebSocket"]

    def test_analytics_maps_to_data_analysis(self):
        assert TAG_OVERRIDES["analytics"] == ["数据分析"]

    def test_organizations_maps_to_org_management(self):
        assert TAG_OVERRIDES["organizations"] == ["组织管理"]

    def test_integrations_maps_to_integration(self):
        assert TAG_OVERRIDES["integrations"] == ["集成框架"]

    def test_activity_maps_to_activity_log(self):
        assert TAG_OVERRIDES["activity"] == ["活动日志"]

    def test_peptide_analysis_routes_maps(self):
        assert TAG_OVERRIDES["peptide_analysis_routes"] == ["肽分析"]

    def test_peptide_design_routes_maps(self):
        assert TAG_OVERRIDES["peptide_design_routes"] == ["肽设计"]

    def test_all_values_are_lists(self):
        """Every tag override value must be a list of strings."""
        for key, tags in TAG_OVERRIDES.items():
            assert isinstance(tags, list), f"TAG_OVERRIDES[{key!r}] is not a list"
            for tag in tags:
                assert isinstance(tag, str), (
                    f"TAG_OVERRIDES[{key!r}] contains non-string: {tag!r}"
                )

    def test_expected_entry_count(self):
        """Verify the total number of tag override entries has not changed accidentally."""
        assert len(TAG_OVERRIDES) == 18


class TestV1Modules:
    """V1_MODULES lists the v1 sub-package route modules."""

    def test_is_frozenset(self):
        assert isinstance(V1_MODULES, frozenset)

    def test_contains_sync_router(self):
        assert "sync_router" in V1_MODULES

    def test_contains_team_router(self):
        assert "team_router" in V1_MODULES

    def test_contains_team_dashboard_router(self):
        assert "team_dashboard_router" in V1_MODULES

    def test_contains_version_router(self):
        assert "version_router" in V1_MODULES

    def test_contains_notification_router(self):
        assert "notification_router" in V1_MODULES

    def test_contains_ai_router(self):
        assert "ai_router" in V1_MODULES

    def test_contains_websocket_router(self):
        assert "websocket_router" in V1_MODULES

    def test_expected_count(self):
        assert len(V1_MODULES) == 7


class TestRouterRegistryClass:
    """RouterRegistry class-level behavior tests."""

    def test_routers_dict_starts_empty(self):
        registry = RouterRegistry()
        assert len(registry._routers) == 0

    def test_deferred_modules_starts_empty(self):
        registry = RouterRegistry()
        assert len(registry._deferred_modules) == 0

    def test_multiple_instances_are_independent(self):
        """Each RouterRegistry instance has its own state."""
        r1 = RouterRegistry()
        r2 = RouterRegistry()
        assert r1._routers is not r2._routers
        assert r1._deferred_modules is not r2._deferred_modules

    def test_loaded_flag_is_boolean(self):
        registry = RouterRegistry()
        assert isinstance(registry._loaded, bool)
