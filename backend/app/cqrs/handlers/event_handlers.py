from typing import Callable, Dict, Any
import logging
from app.cqrs.queries.models import FormulaQueryModel
from app.cqrs.queries.service import QueryService

logger = logging.getLogger(__name__)

class CQRSHandler:
    """Handles domain events that update query-side models."""
    
    def __init__(self, query_service: QueryService):
        self.query_service = query_service
        self.handlers = {}
    
    def register_handler(self, event_type, handler):
        self.handlers[event_type] = handler
    
    def handle_event(self, event):
        event_type = type(event).__name__
        if event_type in self.handlers:
            self.handlers[event_type](event)
    
    def on_formula_created(self, event):
        query_model = FormulaQueryModel.from_write_model(event.formula)
        logger.debug("CQRS: Created query model for %s", event.formula.id)
    
    def on_formula_updated(self, event):
        query_model = FormulaQueryModel.from_write_model(event.formula)
        logger.debug("CQRS: Updated query model for %s", event.formula.id)
