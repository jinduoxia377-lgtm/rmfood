"""
Tests for the lazy module framework at app.core.lazy_module.

Covers:
- LazyModule: deferred import, caching, invalid module path, fallback, repr
- LazyServiceRegistry: register, get, is_loaded, get_status, len, contains
"""
import types

import pytest

from app.core.lazy_module import LazyModule, LazyServiceRegistry


# ────────────────────────────────────────────
# LazyModule
# ────────────────────────────────────────────


class TestLazyModuleDeferredImport:
    """LazyModule must not import the target module until an attribute is accessed."""

    def test_not_loaded_after_construction(self):
        mod = LazyModule("json")
        assert mod.is_loaded is False

    def test_module_path_property(self):
        mod = LazyModule("json")
        assert mod.module_path == "json"

    def test_accessing_attribute_triggers_import(self):
        mod = LazyModule("json")
        # json.dumps exists; accessing it forces import
        _ = mod.dumps
        assert mod.is_loaded is True

    def test_attribute_value_matches_real_module(self):
        mod = LazyModule("json")
        import json as real_json
        assert mod.dumps is real_json.dumps

    def test_multiple_accesses_use_same_module(self):
        mod = LazyModule("json")
        first = mod.dumps
        second = mod.loads
        assert mod.is_loaded is True
        # Both come from the same underlying module
        import json as real_json
        assert first is real_json.dumps
        assert second is real_json.loads

    def test_nonexistent_attribute_after_load_raises_attribute_error(self):
        mod = LazyModule("json")
        with pytest.raises(AttributeError):
            _ = mod.this_does_not_exist_on_json


class TestLazyModuleCaching:
    """Once loaded, the module must be cached and not re-imported."""

    def test_is_loaded_becomes_true_after_first_access(self):
        mod = LazyModule("os")
        assert mod.is_loaded is False
        _ = mod.path
        assert mod.is_loaded is True

    def test_subsequent_access_does_not_reload(self):
        mod = LazyModule("os")
        _ = mod.path  # triggers load
        # If we call _load again it should return immediately
        mod._load()  # should be a no-op
        assert mod.is_loaded is True


class TestLazyModuleInvalidPath:
    """Accessing an attribute on a LazyModule with an invalid module path must raise."""

    def test_import_error_on_invalid_module(self):
        mod = LazyModule("nonexistent_module_xyz_12345")
        with pytest.raises(ImportError):
            _ = mod.anything

    def test_import_error_marks_as_loaded(self):
        """After a failed import (no fallback), _loaded is set to True to avoid retry loops."""
        mod = LazyModule("nonexistent_module_xyz_12345")
        with pytest.raises(ImportError):
            _ = mod.anything
        # _loaded is True even though _module is None (no fallback provided)
        assert mod._loaded is True


class TestLazyModuleFallback:
    """When a fallback is provided and import fails, attribute access delegates to the fallback."""

    def test_fallback_used_when_module_missing(self):
        fallback = types.SimpleNamespace(answer=42)
        mod = LazyModule("nonexistent_module_xyz_12345", fallback=fallback)
        assert mod.answer == 42

    def test_fallback_does_not_set_is_loaded_true(self):
        """is_loaded requires _module to be not None; fallback alone does not count."""
        fallback = types.SimpleNamespace(answer=42)
        mod = LazyModule("nonexistent_module_xyz_12345", fallback=fallback)
        _ = mod.answer
        # _loaded is True but _module is None -> is_loaded is False
        assert mod.is_loaded is False

    def test_fallback_attribute_not_found_returns_none(self):
        """getattr with default None when the fallback lacks the attribute."""
        fallback = types.SimpleNamespace()
        mod = LazyModule("nonexistent_module_xyz_12345", fallback=fallback)
        assert mod.missing_attr is None

    def test_no_fallback_and_missing_module_raises_attribute_error(self):
        """When import fails and no fallback, AttributeError with descriptive message."""
        mod = LazyModule("nonexistent_module_xyz_12345")
        with pytest.raises(AttributeError, match="未加载"):
            _ = mod.anything


class TestLazyModuleRepr:
    """repr shows the module path and loading status."""

    def test_repr_pending(self):
        mod = LazyModule("json")
        assert repr(mod) == "LazyModule('json', status=pending)"

    def test_repr_loaded(self):
        mod = LazyModule("json")
        _ = mod.dumps  # trigger load
        assert repr(mod) == "LazyModule('json', status=loaded)"


# ────────────────────────────────────────────
# LazyServiceRegistry
# ────────────────────────────────────────────


class TestLazyServiceRegistryRegisterAndGet:
    """Register a module by name, then retrieve the LazyModule instance."""

    def test_register_and_get_returns_lazy_module(self):
        registry = LazyServiceRegistry()
        registry.register("json_mod", "json")
        mod = registry.get("json_mod")
        assert isinstance(mod, LazyModule)

    def test_get_unregistered_name_raises_key_error(self):
        registry = LazyServiceRegistry()
        with pytest.raises(KeyError, match="未注册"):
            registry.get("nonexistent")

    def test_registered_module_is_not_loaded_yet(self):
        registry = LazyServiceRegistry()
        registry.register("json_mod", "json")
        assert registry.is_loaded("json_mod") is False

    def test_registered_module_loads_on_attribute_access(self):
        registry = LazyServiceRegistry()
        registry.register("json_mod", "json")
        mod = registry.get("json_mod")
        _ = mod.dumps  # triggers import
        assert registry.is_loaded("json_mod") is True

    def test_register_with_fallback(self):
        fallback = types.SimpleNamespace(val=99)
        registry = LazyServiceRegistry()
        registry.register("missing", "nonexistent_xyz", fallback=fallback)
        mod = registry.get("missing")
        assert mod.val == 99

    def test_register_overwrites_previous(self):
        registry = LazyServiceRegistry()
        registry.register("svc", "json")
        registry.register("svc", "os")
        mod = registry.get("svc")
        assert mod.module_path == "os"


class TestLazyServiceRegistryIsLoaded:
    """is_loaded returns False for unknown names and unloaded modules."""

    def test_is_loaded_unknown_name_returns_false(self):
        registry = LazyServiceRegistry()
        assert registry.is_loaded("unknown") is False

    def test_is_loaded_after_access(self):
        registry = LazyServiceRegistry()
        registry.register("json_mod", "json")
        mod = registry.get("json_mod")
        _ = mod.dumps
        assert registry.is_loaded("json_mod") is True


class TestLazyServiceRegistryGetStatus:
    """get_status returns a dict of all registered modules with path and loaded status."""

    def test_empty_registry_returns_empty_dict(self):
        registry = LazyServiceRegistry()
        assert registry.get_status() == {}

    def test_status_contains_registered_modules(self):
        registry = LazyServiceRegistry()
        registry.register("a", "json")
        registry.register("b", "os")
        status = registry.get_status()
        assert "a" in status
        assert "b" in status

    def test_status_path_matches_registration(self):
        registry = LazyServiceRegistry()
        registry.register("svc", "json")
        status = registry.get_status()
        assert status["svc"]["path"] == "json"

    def test_status_reflects_loaded_state(self):
        registry = LazyServiceRegistry()
        registry.register("svc", "json")
        status_before = registry.get_status()
        assert status_before["svc"]["loaded"] is False

        mod = registry.get("svc")
        _ = mod.dumps  # trigger load

        status_after = registry.get_status()
        assert status_after["svc"]["loaded"] is True

    def test_status_multiple_modules(self):
        registry = LazyServiceRegistry()
        registry.register("json_mod", "json")
        registry.register("os_mod", "os")
        registry.register("sys_mod", "sys")

        # Load only json_mod
        mod = registry.get("json_mod")
        _ = mod.dumps

        status = registry.get_status()
        assert len(status) == 3
        assert status["json_mod"]["loaded"] is True
        assert status["os_mod"]["loaded"] is False
        assert status["sys_mod"]["loaded"] is False


class TestLazyServiceRegistryDunderMethods:
    """Test __len__ and __contains__ protocol."""

    def test_len_empty_registry(self):
        registry = LazyServiceRegistry()
        assert len(registry) == 0

    def test_len_after_registration(self):
        registry = LazyServiceRegistry()
        registry.register("a", "json")
        registry.register("b", "os")
        assert len(registry) == 2

    def test_contains_registered_name(self):
        registry = LazyServiceRegistry()
        registry.register("svc", "json")
        assert "svc" in registry

    def test_contains_unregistered_name(self):
        registry = LazyServiceRegistry()
        assert "missing" not in registry

    def test_len_after_overwrite_stays_same(self):
        registry = LazyServiceRegistry()
        registry.register("svc", "json")
        registry.register("svc", "os")
        assert len(registry) == 1
