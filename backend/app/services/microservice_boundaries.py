"""Service Boundaries Definition - Phase 3 Microservice Preparation."""

import time
from abc import ABC, abstractmethod
from typing import TypeVar

T = TypeVar('T')

class ServiceContract(ABC):
    """Base interface for all microservice contracts."""

    @abstractmethod
    def get_service_name(self) -> str:
        pass

    @abstractmethod
    def get_api_version(self) -> str:
        pass

    @abstractmethod
    def get_health_endpoint(self) -> str:
        pass


class ChatServiceContract(ServiceContract):
    """Contract for the AI Conversation Service."""

    def get_service_name(self) -> str:
        return "ai-conversation-service"

    def get_api_version(self) -> str:
        return "v1"

    def get_health_endpoint(self) -> str:
        return "/health"


class CalculationServiceContract(ServiceContract):
    """Contract for the Formula Calculation Service."""

    def get_service_name(self) -> str:
        return "formula-calculation-service"

    def get_api_version(self) -> str:
        return "v1"

    def get_health_endpoint(self) -> str:
        return "/status"


class AuthzServiceContract(ServiceContract):
    """Contract for the Authentication Service."""

    def get_service_name(self) -> str:
        return "authz-service"

    def get_api_version(self) -> str:
        return "v1"

    def get_health_endpoint(self) -> str:
        return "/healthcheck"


class DomainEvent:
    """Base class for domain events."""

    def __init__(self, event_id: str, timestamp: float, emitting_service: str):
        self.event_id = event_id
        self.timestamp = timestamp
        self.emitting_service = emitting_service


class FormulaCreatedEvent(DomainEvent):
    """Emitted when a new formula is created."""

    def __init__(self, formula_id: str, user_id: str, creator: str):
        super().__init__(
            event_id="formula_" + formula_id,
            timestamp=time.time(),
            emitting_service="formula-service"
        )
        self.formula_id = formula_id
        self.user_id = user_id
        self.creator = creator


class ConversationStartedEvent(DomainEvent):
    """Emitted when a new chat conversation begins."""

    def __init__(self, conversation_id: str, user_id: str, model_type: str):
        super().__init__(
            event_id="conv_" + conversation_id,
            timestamp=time.time(),
            emitting_service="conversation-service"
        )
        self.conversation_id = conversation_id
        self.user_id = user_id
        self.model_type = model_type
