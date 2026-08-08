from typing import List
from app.cqrs.queries.models import SearchResultItem, FormulaSearchQuery
from app.cqrs.queries.service import QueryService

class SearchService:
    """Provides formula search capabilities."""
    
    def __init__(self, query_service: QueryService):
        self.query_service = query_service
    
    def search(self, query: FormulaSearchQuery) -> List[SearchResultItem]:
        return self.query_service.search_formulas(query)
