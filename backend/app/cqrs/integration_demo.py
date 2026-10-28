import logging

logger = logging.getLogger(__name__)
"""CQRS Integration Demo - Shows how query models, cache, search, and event handlers work together."""

from app.cqrs.handlers.event_handlers import CQRSHandler
from app.cqrs.queries.models import FormulaSearchQuery
from app.cqrs.queries.search import SearchService
from app.cqrs.queries.service import QueryService
from app.infrastructure.cache import create_cache_service


def setup_cQRS_system(use_cache_redis=False):
    """Set up the complete CQRS read-side system."""

    # Create cache service
    cache = create_cache_service(use_redis=use_cache_redis)

    # Create query service with cache
    query_service = QueryService(cache)

    # Create CQRS handler to process domain events
    cqrshandler = CQRSHandler(query_service)

    # Register event handlers
    cqrshandler.register_handler("FormulaCreatedEvent", cqrshandler.on_formula_created)
    cqrshandler.register_handler("FormulaUpdatedEvent", cqrshandler.on_formula_updated)

    # Create search service
    search_service = SearchService(query_service)

    return {
        "query_service": query_service,
        "cqrshandler": cqrshandler,
        "search_service": search_service,
        "cache": cache,
    }


def demo_usage():
    """Demonstrate using the CQRS system."""

    logger.info("=" * 60)
    logger.info("CQRS Architecture Demo")
    logger.info("=" * 60)

    # Setup system (using in-memory cache for demo)
    system = setup_cQRS_system(use_cache_redis=False)

    qsvc = system["query_service"]
    chandler = system["cqrshandler"]
    sserv = system["search_service"]

    # Simulate creating a formula from write side
    class MockFormula:
        id = "form_123"
        name = "补气养血方"
        status = "APPROVED"
        created_at = datetime.now()
        updated_at = datetime.now()
        ingredients = []

    # Simulate domain event
    class MockEvent:
        def __init__(self, formula):
            self.formula = formula

    formula = MockFormula()
    event = MockEvent(formula)

    # Handle event - updates query model
    chandler.handle_event(event)

    # Perform search
    query = FormulaSearchQuery(target_effects=["补气"])
    results = sserv.search(query)

    logger.info(f"Search returned {len(results)} results")
    if results:
        logger.info(f"First result: {results[0].name} (score: {results[0].relevance_score})")

    logger.info("Demo complete!")


if __name__ == "__main__":
    from datetime import datetime
    demo_usage()
