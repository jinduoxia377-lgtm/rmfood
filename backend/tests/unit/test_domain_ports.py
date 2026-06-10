"""
Tests for domain port ABCs in app.domain.ports.

Verifies that:
- Each port is an ABC (abstract base class)
- Each port cannot be instantiated directly (raises TypeError)
- Concrete implementations satisfy the contract
"""
from abc import ABC

import pytest

from app.domain.ports import (
    AuthPort,
    EventPublisher,
    FormulaRepository,
    IngredientCompatibilityService,
    IngredientRepository,
    MobileServicePort,
    NotificationPort,
    PeptideAnalysisPort,
    SearchPort,
)


# ────────────────────────────────────────────
# Helpers: concrete implementations for each port
# ────────────────────────────────────────────


class ConcreteFormulaRepository(FormulaRepository):
    async def save(self, formula):
        pass

    async def get_by_id(self, id):
        return None

    async def get_by_name(self, name):
        return None

    async def find_by_status(self, status, limit=20):
        return []

    async def delete(self, id):
        pass


class ConcreteEventPublisher(EventPublisher):
    async def publish(self, event):
        pass


class ConcreteIngredientCompatibilityService(IngredientCompatibilityService):
    async def is_compatible(self, ingredient_a_id, ingredient_b_id):
        return True

    async def get_incompatible_pairs(self):
        return {}


class ConcreteIngredientRepository(IngredientRepository):
    async def get_dosage_range(self, ingredient_id):
        return (0.1, 10.0)


class ConcreteMobileServicePort(MobileServicePort):
    async def get_dashboard(self, user_id):
        return {}

    async def sync_push(self, items):
        return items

    async def sync_pull(self, last_sync=None):
        return []

    async def get_notifications(self, user_id, limit=20):
        return []

    async def mark_notification_read(self, notification_id):
        return True

    async def get_traceability(self, formula_id):
        return {}


class ConcreteNotificationPort(NotificationPort):
    async def send(self, user_id, title, message, channel="in_app"):
        return True

    async def get_unread_count(self, user_id):
        return 0


class ConcreteSearchPort(SearchPort):
    async def search(self, query, index, limit=20):
        return []

    async def index_document(self, index, doc_id, body):
        return True

    async def delete_document(self, index, doc_id):
        return True


class ConcretePeptideAnalysisPort(PeptideAnalysisPort):
    async def analyze_sequence(self, sequence):
        return {}

    async def predict_activity(self, sequence):
        return {}

    async def assess_safety(self, sequence):
        return {}


class ConcreteAuthPort(AuthPort):
    async def authenticate(self, username, password):
        return None

    async def verify_token(self, token):
        return None

    async def refresh_token(self, refresh_token):
        return None


# ────────────────────────────────────────────
# Registry of all ports for parametrized tests
# ────────────────────────────────────────────

ALL_PORTS = [
    FormulaRepository,
    EventPublisher,
    IngredientCompatibilityService,
    IngredientRepository,
    MobileServicePort,
    NotificationPort,
    SearchPort,
    PeptideAnalysisPort,
    AuthPort,
]

CONCRETE_IMPLEMENTATIONS = {
    FormulaRepository: ConcreteFormulaRepository,
    EventPublisher: ConcreteEventPublisher,
    IngredientCompatibilityService: ConcreteIngredientCompatibilityService,
    IngredientRepository: ConcreteIngredientRepository,
    MobileServicePort: ConcreteMobileServicePort,
    NotificationPort: ConcreteNotificationPort,
    SearchPort: ConcreteSearchPort,
    PeptideAnalysisPort: ConcretePeptideAnalysisPort,
    AuthPort: ConcreteAuthPort,
}


# ────────────────────────────────────────────
# Test: each port is an ABC
# ────────────────────────────────────────────


class TestPortIsABC:
    """Every port class must inherit from ABC."""

    @pytest.mark.parametrize("port_cls", ALL_PORTS, ids=lambda c: c.__name__)
    def test_port_is_abc_subclass(self, port_cls):
        assert issubclass(port_cls, ABC), f"{port_cls.__name__} does not inherit from ABC"

    @pytest.mark.parametrize("port_cls", ALL_PORTS, ids=lambda c: c.__name__)
    def test_port_is_abstract(self, port_cls):
        # ABCMeta sets __abstractmethods__ on abstract classes
        assert getattr(port_cls, "__abstractmethods__", frozenset()), (
            f"{port_cls.__name__} has no abstract methods"
        )


# ────────────────────────────────────────────
# Test: each port cannot be instantiated directly
# ────────────────────────────────────────────


class TestPortCannotInstantiate:
    """Instantiating an ABC without implementing all abstract methods raises TypeError."""

    @pytest.mark.parametrize("port_cls", ALL_PORTS, ids=lambda c: c.__name__)
    def test_direct_instantiation_raises_type_error(self, port_cls):
        with pytest.raises(TypeError):
            port_cls()


# ────────────────────────────────────────────
# Test: concrete implementations can be instantiated
# ────────────────────────────────────────────


class TestConcreteImplementation:
    """A class that implements every abstract method can be instantiated."""

    @pytest.mark.parametrize(
        "port_cls",
        ALL_PORTS,
        ids=lambda c: c.__name__,
    )
    def test_concrete_instance_creation(self, port_cls):
        impl_cls = CONCRETE_IMPLEMENTATIONS[port_cls]
        instance = impl_cls()
        assert isinstance(instance, port_cls)


# ────────────────────────────────────────────
# Test: abstract method counts match expectations
# ────────────────────────────────────────────


class TestAbstractMethodCounts:
    """Verify the number of abstract methods for each port matches the specification."""

    def test_formula_repository_has_5_abstract_methods(self):
        assert len(FormulaRepository.__abstractmethods__) == 5

    def test_event_publisher_has_1_abstract_method(self):
        assert len(EventPublisher.__abstractmethods__) == 1

    def test_ingredient_compatibility_service_has_2_abstract_methods(self):
        assert len(IngredientCompatibilityService.__abstractmethods__) == 2

    def test_ingredient_repository_has_1_abstract_method(self):
        assert len(IngredientRepository.__abstractmethods__) == 1

    def test_mobile_service_port_has_6_abstract_methods(self):
        assert len(MobileServicePort.__abstractmethods__) == 6

    def test_notification_port_has_2_abstract_methods(self):
        assert len(NotificationPort.__abstractmethods__) == 2

    def test_search_port_has_3_abstract_methods(self):
        assert len(SearchPort.__abstractmethods__) == 3

    def test_peptide_analysis_port_has_3_abstract_methods(self):
        assert len(PeptideAnalysisPort.__abstractmethods__) == 3

    def test_auth_port_has_3_abstract_methods(self):
        assert len(AuthPort.__abstractmethods__) == 3


# ────────────────────────────────────────────
# Test: partial implementation still raises TypeError
# ────────────────────────────────────────────


class TestPartialImplementation:
    """Leaving even one abstract method unimplemented must raise TypeError."""

    def test_formula_repository_missing_save_raises(self):
        class Incomplete(FormulaRepository):
            async def get_by_id(self, id):
                return None

            async def get_by_name(self, name):
                return None

            async def find_by_status(self, status, limit=20):
                return []

            async def delete(self, id):
                pass

        with pytest.raises(TypeError):
            Incomplete()

    def test_search_port_missing_one_method_raises(self):
        class Incomplete(SearchPort):
            async def search(self, query, index, limit=20):
                return []

            async def index_document(self, index, doc_id, body):
                return True

            # delete_document is missing

        with pytest.raises(TypeError):
            Incomplete()

    def test_auth_port_empty_raises(self):
        class EmptyAuth(AuthPort):
            pass

        with pytest.raises(TypeError):
            EmptyAuth()


# ────────────────────────────────────────────
# Test: concrete methods are callable and return expected types
# ────────────────────────────────────────────


import asyncio


def _run(coro):
    """Helper to run async coroutines in sync tests."""
    return asyncio.get_event_loop().run_until_complete(coro)


class TestConcreteMethodBehavior:
    """Verify the concrete implementations return sensible default values."""

    def test_formula_repository_get_by_id_returns_none(self):
        repo = ConcreteFormulaRepository()
        result = _run(repo.get_by_id("nonexistent"))
        assert result is None

    def test_formula_repository_find_by_status_returns_list(self):
        repo = ConcreteFormulaRepository()
        result = _run(repo.find_by_status("DRAFT"))
        assert isinstance(result, list)

    def test_event_publisher_publish_returns_none(self):
        pub = ConcreteEventPublisher()
        result = _run(pub.publish(None))
        assert result is None

    def test_ingredient_compatibility_is_compatible_returns_bool(self):
        svc = ConcreteIngredientCompatibilityService()
        result = _run(svc.is_compatible("a", "b"))
        assert isinstance(result, bool)
        assert result is True

    def test_ingredient_repository_returns_tuple(self):
        repo = ConcreteIngredientRepository()
        result = _run(repo.get_dosage_range("ginseng"))
        assert isinstance(result, tuple)
        assert len(result) == 2
        assert result[0] < result[1]

    def test_mobile_service_sync_push_returns_list(self):
        svc = ConcreteMobileServicePort()
        result = _run(svc.sync_push([{"id": 1}]))
        assert isinstance(result, list)

    def test_notification_send_returns_bool(self):
        port = ConcreteNotificationPort()
        result = _run(port.send("u1", "title", "msg"))
        assert isinstance(result, bool)

    def test_search_port_returns_list(self):
        port = ConcreteSearchPort()
        result = _run(port.search("query", "index"))
        assert isinstance(result, list)

    def test_peptide_analysis_returns_dict(self):
        port = ConcretePeptideAnalysisPort()
        result = _run(port.analyze_sequence("ACDEFG"))
        assert isinstance(result, dict)

    def test_auth_port_authenticate_returns_none_for_unknown(self):
        port = ConcreteAuthPort()
        result = _run(port.authenticate("user", "pass"))
        assert result is None
