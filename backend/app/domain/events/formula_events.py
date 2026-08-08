from datetime import datetime
from typing import Any, Dict

class DomainEvent:
    def __init__(self, event_id, timestamp):
        self.event_id = event_id
        self.timestamp = timestamp
    
    def to_dict(self):
        return {"event_id": self.event_id, "timestamp": self.timestamp}

class FormulaCreatedEvent(DomainEvent):
    def __init__(self, formula_id, user_id, creator, formula_data):
        super().__init__(f"formula_created_{formula_id}", datetime.utcnow().timestamp())
        self.formula_id = formula_id
        self.user_id = user_id
        self.creator = creator
        self.formula_data = formula_data
        
    def to_dict(self):
        base = super().to_dict()
        base.update({
            "event_type": "FormulaCreatedEvent",
            "formula_id": self.formula_id,
            "user_id": self.user_id,
            "creator": self.creator,
            "formula_data": self.formula_data
        })
        return base
