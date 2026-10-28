from datetime import datetime

from sqlalchemy import Column, DateTime, Enum, Float, String, Text
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

class FormulaModel(Base):
    """ORM model for formula storage on write side."""

    __tablename__ = 'formulas'

    id = Column(String(50), primary_key=True)
    name = Column(String(200), nullable=False)
    status = Column(Enum('DRAFT', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'ARCHIVED'), default='DRAFT')
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # JSON field for ingredients and other formula data
    ingredients_json = Column(Text, nullable=False)
    efficacy_scores_json = Column(Text, nullable=False)
    cost_estimate = Column(Float, default=0.0)

    def to_dict(self):
        """Convert model dictionary compatible with command handlers."""
        return {
            "id": self.id,
            "name": self.name,
            "status": self.status.value if hasattr(self.status, "value") else str(self.status),
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "ingredients": self.ingredients_json,
            "efficacy_scores": self.efficacy_scores_json,
            "cost_estimate": self.cost_estimate,
        }
