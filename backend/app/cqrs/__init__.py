"""CQRS module for query-side optimization"""

from .queries.models import FormulaQueryModel
from .queries.service import QueryService

__all__ = [
    "QueryService",
    "FormulaQueryModel",
]
