from sqlalchemy.ext.asyncio import AsyncSession
from typing import List, Optional, Dict, Any
from ..models.formula_model import FormulaModel
from ..domain.events.formula_events import FormulaCreatedEvent, FormulaUpdatedEvent
from .interfaces import FormulaRepository

class AsyncSQLAlchemyFormulaRepository(FormulaRepository):
    """Async SQLAlchemy implementation of formula repository.
    
    This handles all persistence operations on the write side of CQRS.
    It will emit domain events after successful operations.
    """
    
    def __init__(self, session: AsyncSession):
        self.session = session
    
    async def save(self, data: Dict[str, Any]) -> str:
        """Save new formula and return its ID."""
        model = FormulaModel(
            id=data.get("id", f"form_{len(str(data))}"),
            name=data.get("name", "Untitled"),
            status=data.get("status", "DRAFT"),
            ingredients_json=str(data.get("ingredients", [])),
            efficacy_scores_json=str(data.get("efficacy_scores", {})),
            cost_estimate=data.get("cost_estimate", 0.0),
        )
        
        self.session.add(model)
        await self.session.commit()
        await self.session.refresh(model)
        
        # Emit creation event
        event = FormulaCreatedEvent(
            formula_id=model.id,
            user_id=data.get("user_id", "system"),
            creator=data.get("creator", "system"),
            formula_data={
                "name": model.name,
                "status": model.status,
                "ingredients": data.get("ingredients", []),
            }
        )
        return model.id
    
    async def get(self, formula_id: str) -> Optional[Dict[str, Any]]:
        """Retrieve formula by ID."""
        result = await self.session.get(FormulaModel, formula_id)
        if result:
            return result.to_dict()
        return None
    
    async def update(self, formula_id: str, data: Dict[str, Any], version: int = None) -> bool:
        """Update existing formula."""
        model = await self.session.get(FormulaModel, formula_id)
        if not model:
            return False
        
        # Update fields
        model.name = data.get("name", model.name)
        model.status = data.get("status", model.status)
        model.ingredients_json = str(data.get("ingredients", []))
        model.efficacy_scores_json = str(data.get("efficacy_scores", {}))
        model.cost_estimate = data.get("cost_estimate", model.cost_estimate)
        model.updated_at = datetime.utcnow()
        
        await self.session.commit()
        
        # Emit update event
        event = FormulaUpdatedEvent(
            formula_id=formula_id,
            user_id=data.get("user_id", "system"),
            updater=data.get("updater", "system"),
            formula_data=data,
            version=version or 1
        )
        
        return True
    
    async def delete(self, formula_id: str, user_id: str, reason: str) -> bool:
        """Delete formula (soft delete option could be added)."""
        model = await self.session.get(FormulaModel, formula_id)
        if not model:
            return False
        
        await self.session.delete(model)
        await self.session.commit()
        return True
    
    async def find_by_status(self, status: str, limit: int = 20) -> List[str]:
        """Get list of formula IDs by status."""
        result = await self.session.execute(
            select(FormulaModel.id).where(FormulaModel.status == status).limit(limit)
        )
        return [str(row.id) for row in result.fetchall()]