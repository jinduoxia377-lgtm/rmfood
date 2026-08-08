from app.domain.events.formula_events import FormulaCreatedEvent

class FormulaCommandHandler:
    def __init__(self, event_bus):
        self.event_bus = event_bus
        self._formulas = {}
    
    def create_formula(self, user_id, creator, formula_data):
        formula_id = f"form_{len(self._formulas)+1}"
        self._formulas[formula_id] = {"data": formula_data, "creator": creator}
        
        event = FormulaCreatedEvent(
            formula_id=formula_id,
            user_id=user_id,
            creator=creator,
            formula_data=formula_data
        )
        self.event_bus.publish(event)
        
        return formula_id
