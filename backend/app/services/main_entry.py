import logging
logger = logging.getLogger(__name__)
"""Main application entry point - initializes microservices infrastructure."""

import asyncio
from app.factories.adapters_factory import get_adapter_registry
from app.infrastructure.microservice_event_bus import get_event_bus, Event
from app.infrastructure.microservice_gateway import get_microservice_gateway, MicroserviceGateway
from app.services.microservice_boundaries import ChatServiceFormula, FormulaCreatedEvent

async def initialize_services():
    """Initialize all microservice infrastructure components."""
    
    # 1. Get adapter registry (Phase 1)
    registry = get_adapter_registry()
    registry.load_all()  # Register core adapters
    
    logger.info("✓ Adapter Registry initialized")
    
    # 2. Get event bus (Phase 3)
    event_bus = get_event_bus()
    logger.info("✓ Event Bus initialized")
    
    # 3. Create microservice gateway in local mode (can switch to remote later)
    gateway = get_microservice_gateway(mode="local")
    logger.info("✓ Microservice Gateway initialized (local mode)")
    
    # Example: Register service endpoints with gateway
    from app.services.ai.conversation_service.main import app as ai_app
    from app.services.calculation_service.main import app as calc_app
    from app.services.auth_service.main import app as auth_app
    
    # In production, these would be actual service instances
    gateway.register_local_service("ai-conversation", ai_app)
    gateway.register_local_service("formula-calculation", calc_app)
    gateway.register_local_service("auth", auth_app)
    
    logger.info("✓ Service endpoints registered with gateway")
    
    # Example: Publish domain event
    event = FormulaCreatedEvent(
        formula_id="form_001",
        user_id="user_demo",
        creator="system"
    )
    await event_bus.publish(event)
    logger.info(f"✓ Domain event published: {event.event_id}")
    
    return gateway, event_bus, registry

if __name__ == "__main__":
    loop = asyncio.get_event_loop()
    gateway, event_bus, registry = loop.run_until_complete(initialize_services())
    print("All services initialized successfully!")
