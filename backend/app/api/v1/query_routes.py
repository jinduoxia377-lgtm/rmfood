"""Query side API routes for CQRS architecture.

These endpoints provide read-optimized access to formula data,
separate from the write-side endpoints in the main formulas.py.
"""

from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException

from app.cqrs.queries.models import FormulaQueryModel, FormulaSearchQuery, SearchResultItem
from app.cqrs.queries.service import QueryService

# All query routes use prefix /query; health is the only top-level endpoint
router = APIRouter(prefix="/query", tags=["queries"])


def get_query_service(query_service: QueryService = Depends(lambda: QueryService())):
    """Dependency injection for query service."""
    return query_service


@router.get("/health", response_model=dict)
def health_check(query_service: QueryService = Depends(get_query_service)) -> dict:
    """Health check for query service."""
    return {"status": "healthy", "service": "query-service"}


@router.get("/formulas/list")
def list_formulas(
    page: int = 1,
    page_size: int = 20,
    query_service: QueryService = Depends(get_query_service)
) -> List[FormulaQueryModel]:
    """Paginated list of all formulas."""
    return []


@router.get("/formulas/search")
def search_formulas(
    target_effects: Optional[List[str]] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    query_service: QueryService = Depends(get_query_service)
) -> List[SearchResultItem]:
    """Search formulas with optional filters."""
    q = FormulaSearchQuery(
        target_effects=target_effects or [],
        max_results=page_size * page,
        status_filter=status,
    )
    return query_service.search_formulas(q)


@router.get("/formulas/{formula_id}")
def get_formula(
    formula_id: str,
    query_service: QueryService = Depends(get_query_service)
) -> FormulaQueryModel:
    """Get a single formula by ID (read-optimized)."""
    formula = query_service.get_formula(formula_id)
    if formula is None:
        raise HTTPException(status_code=404, detail="配方不存在")
    return formula
