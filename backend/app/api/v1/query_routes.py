"""Query side API routes for CQRS architecture.

These endpoints provide read-optimized access to formula data,
separate from the write-side endpoints in the main formulas.py.
"""

from fastAPI import APIRouter, Depends, HTTPException
from typing import List, Optional

from ....cqrs.service import QueryService
from cqrs.queries.models import FormulaQueryModel


router = APIRouter(prefix="/query", tags=["queries"])


def get_query_service(query_service: QueryService = Depends(lambda: QueryService())):
    """Dependency injection for query service."""
    return query_service


@router.get("/formulas/{formula_id}", response_model=FormulaQueryModel)
def get_formula(
    formula_id: str,
    query_service: QueryService = Depends(get_query_service)
) -> FormulaQueryModel:
    """Get a single formula by ID (read-optimized)."""
    formula = query_service.get_formula(formula_id)
    if formula is None:
        raise HTTPException(status_code=404, detail="Formula not found")
    return formula


@router.get("/formulas/search", response_model=List[FormulaQueryModel])
def search_formulas(
    target_effects: Optional[List[str]] = None,
    status: Optional[str] = None,
    page: int = 1,
    page_size: int = 20,
    query_service: QueryService = Depends(get_query_service)
) -> List[FormulaQueryModel]:
    """Search formulas with optional filters."""
    # In production, this would query the read-optimized store
    return query_service.search_formulas(target_effects or [], max_results=page_size * page)


@router.get("/formulas/list", response_model=List[FormulaQueryModel])
def list_formulas(
    page: int = 1,
    page_size: int = 20,
    query_service: QueryService = Depends(get_query_service)
) -> List[FormulaQueryModel]:
    """Paginated list of all formulas."""
    return query_service.get_formula_list(page, page_size)


@router.get("/health", response_model=dict)
def health_check(query_service: QueryService = Depends(get_query_service)) -> dict:
    """Health check for query service."""
    return {"status": "healthy", "service": "query-service"}
