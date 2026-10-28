from datetime import timedelta
from typing import Any, List, Optional

from .models import FormulaQueryModel, FormulaSearchQuery, SearchResultItem


class CacheService:
    """Simple cache interface."""
    def get(self, key: str) -> Any: pass
    def set(self, key: str, value: Any, ttl: Optional[timedelta] = None): pass
    def delete(self, key: str): pass

class InMemoryCache(CacheService):
    def __init__(self): self.store = {}
    def get(self, key): return self.store.get(key)
    def set(self, key, value, ttl=None): self.store[key] = value

class QueryService:
    def __init__(self, cache=None):
        self.cache = cache or InMemoryCache()
        self.formula_cache_prefix = "formula:"
        self.search_cache_prefix = "search:"

    def get_formula(self, formula_id: str) -> Optional[FormulaQueryModel]:
        cache_key = f"{self.formula_cache_prefix}{formula_id}"
        cached = self.cache.get(cache_key)
        if cached: return cached
        # In production query read store
        return None

    def search_formulas(self, query: FormulaSearchQuery) -> List[SearchResultItem]:
        cache_key = f"{self.search_cache_prefix}{str(query.target_effects)}"
        cached = self.cache.get(cache_key)
        if cached: return cached
        results = self._simulate_search(query)
        self.cache.set(cache_key, results, timedelta(minutes=5))
        return results

    def _simulate_search(self, query) -> List[SearchResultItem]:
        # Simulate search results
        return [SearchResultItem(formula_id="form_001", name="Sample", relevance_score=0.95,
                                 ingredients_summary="Simulated", efficacy_summary={})]

# Service setup function
def create_query_service():
    return QueryService()
