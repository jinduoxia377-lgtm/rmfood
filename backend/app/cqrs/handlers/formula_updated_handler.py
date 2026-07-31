"""Formula updated event handler for CQRS query side.

This handler listens to domain events (FormulaCreated, FormulaUpdated) and
updates the read-optimized query model accordingly.
"""

from typing import Any, Optional

from ..queries.service import QueryService
from ..queries.models import FormulaQueryModel


class FormulaUpdatedEventHandler:
    """Domain event handler that updates the query-side model."""

    def __init__(self, query_service: QueryService):
        self.query_service = query_service

    def handle(self, event: Any) -> None:
        """Handle a formula update event.
        
        Args:
            event: Domain event containing formula data
                Expected attributes: formula_id, formula_data
        """
        # Extract formula data from event
        formula_id = getattr(event, 'formula_id', None) or event.get('formula_id')
        formula_data = getattr(event, 'formula_data', None) or event.get('formula_data')
        
        if not formula_id or not formula_data:
            return
        
        # Convert domain data to query model
        try:
            query_model = FormulaQueryModel.from_domain_formula(formula_data)
        except Exception as e:
            print(f"Error converting to query model: {e}")
            return
        
        # Update query service cache
        self.query_service._cache_formula(query_model)
        
        # In a real implementation, you would also persist this to the read DB
        # self._persist_to_read_db(query_model)


class FormulaCreatedEventHandler(FormulaUpdatedEventHandler):
    """Specialized handler for creation events (can have different logic)."""
    pass


def register_event_handlers(event_bus, query_service):
    """Register event handlers with the event bus.
    
    Args:
        event_bus: Event bus instance that can publish/sub events
        query_service: QueryService instance to use for handling
    """
    from app.core.domain_events import FormulaCreatedEvent, FormulaUpdatedEvent
    
    created_handler = FormulaCreatedEventHandler(query_service)
    updated_handler = FormulaUpdatedEventHandler(query_service)
    
    # Subscribe to events
    event_bus.subscribe(FormulaCreatedEvent, created_handler.handle)
    event_bus.subscribe(FormulaUpdatedEvent, updated_handler.handle)