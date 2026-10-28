"""Formula service - Orchestrates write-side operations and event publishing.

This sits between the command handlers and the data repository, coordinating
the entire CQRS write-side workflow.
"""

from typing import Any, Dict, Optional

from ..infrastructure.repository import FormulaRepository
from .event_publisher import EventPublisher


class FormulaService:
    """Service layer for formula management on the write side.

    Handles business logic and coordinates with repositories and event systems.
    """

    def __init__(self, repo: FormulaRepository, event_publisher: EventPublisher):
        self.repo = repo
        self.event_publisher = event_publisher

    async def create_formula(self, user_id: str, creator: str,
                            formula_data: Dict[str, Any]) -> str:
        """Create a new formula with all necessary steps."""

        # Generate unique ID if not provided
        formula_id = formula_data.get("id", f"form_{int(1000000 + 100000 * (hash(str(formula_data)) % 900000))}")

        # Prepare formula data including metadata
        data_with_meta = {
            "id": formula_id,
            "name": formula_data.get("name", "Untitled Formula"),
            "status": formula_data.get("status", "DRAFT"),
            "ingredients": formula_data.get("ingredients", []),
            "efficacy_scores": formula_data.get("efficacy_scores", {}),
            "cost_estimate": formula_data.get("cost_estimate", 0.0),
            "user_id": user_id,
            "creator": creator,
        }

        # Persist to database
        formula_id = await self.repo.save(data_with_meta)

        # Event is emitted by the repository in its save method

        return formula_id

    async def update_formula(self, formula_id: str, user_id: str, updater: str,
                           formula_data: Dict[str, Any], version: int = None) -> bool:
        """Update an existing formula."""
        data_with_meta = {
            "name": formula_data.get("name", None),
            "status": formula_data.get("status", None),
            "ingredients": formula_data.get("ingredients", None),
            "efficacy_scores": formula_data.get("efficacy_scores", None),
            "cost_estimate": formula_data.get("cost_estimate", None),
            "user_id": user_id,
            "updater": updater,
        }

        # Remove keys with None values to preserve existing data
        data_with_meta = {k: v for k, v in data_with_meta.items() if v is not None}

        success = await self.repo.update(formula_id, data_with_meta, version=version)

        if success:
            # Update event already emitted by repository
            pass
        return success

    async def delete_formula(self, formula_id: str, user_id: str, reason: str) -> bool:
        """Delete a formula."""
        return await self.repo.delete(formula_id, user_id, reason)

    async def get_formula(self, formula_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve a formula by ID (for read/write consistency checks)."""
        return await self.repo.get(formula_id)
