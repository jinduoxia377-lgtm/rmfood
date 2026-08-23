from dataclasses import dataclass, field
from typing import List, Optional, Dict
from datetime import datetime

@dataclass
class FormulaQueryModel:
    id: str
    name: str
    status: str
    created_at: datetime
    updated_at: datetime
    ingredients_summary: str
    efficacy_scores: Dict[str, float]
    total_dosage: float
    cost_estimate: float
    target_effects: List[str]
    is_approved: bool
    popularity_count: int = 0
    last_accessed: Optional[datetime] = None
    
    @classmethod
    def from_write_model(cls, write_model):
        return cls(
            id=str(write_model.id),
            name=write_model.name,
            status=str(write_model.status),
            created_at=write_model.created_at,
            updated_at=write_model.updated_at,
            ingredients_summary="Simulated summary",
            efficacy_scores={},
            total_dosage=0.0,
            cost_estimate=0.0,
            target_effects=[],
            is_approved=False,
        )

@dataclass
class SearchResultItem:
    formula_id: str
    name: str
    relevance_score: float
    ingredients_summary: str
    efficacy_summary: Dict[str, float]

@dataclass
class FormulaSearchQuery:
    target_effects: List[str] = field(default_factory=list)
    min_relevance: float = 0.5
    max_results: int = 20
    status_filter: Optional[str] = None
    sort_by: str = "relevance"