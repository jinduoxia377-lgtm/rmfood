"""Dependency injection configuration for formula services.

Centralized setup for creating repositories, services, event publishers, etc.
This follows the AdapterRegistry pattern established earlier.
"""

from typing import AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from .formula_repository import FormulaRepository
from .sqlalchemy_repository import AsyncSQLAlchemyFormulaRepository
from .event_publisher import EventPublisher
from .event_bus import get_event_bus  # Import from previously created event bus
from .repositories import FormulaRepositoryInterface
from ..domain.events.formula_events import DomainEvent


async def get_db_session() -> AsyncGenerator[AsyncSession, None]:
    """Provide async database session via dependency injection."""
    engine = create_async_engine("postgresql+asyncpg://user:password@localhost/rmfood", echo=False)
    async_session = sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)
    async with async_session() as session:
        yield session


async def initialize_formula_services(
    db_session: AsyncSession,
    query_service
) -> dict:
    """Initialize formula-related services and return them in a registry."""
    
    # Create repository implementation
    repo = AsyncSQLAlchemyFormulaRepository(db_session)
    
    # Create event publisher (connects to CQRS handler for read updates)
    event_publisher = EventPublisher(query_service=query_service)
    
    # Register event bus subscriber - when events come in, update query model
    async def handle_domain_event(event: DomainEvent):
        # This would be registered with the event bus to receive published events
        logger.info(f"Received domain event: {type(event).__name__}")
        # The event_handler (already set up in CQRSHandler) would process this
        pass
    
    # Create formula service that coordinates operations
    formula_service = FormulaService(repo=repo, event_publisher=event_publisher)
    
    return {
        "repository": repo,
        "service": formula_service,
        "publisher": event_publisher,
    }


# Convenience function for quick setup
def create_formula_system_factory():
    """Factory for creating formula service configurations."""
    return lambda db_session, query_service: {
        "repository": AsyncSQLAlchemyFormulaRepository(db_session),
        "service": FormulaService(
            AsyncSQLAlchemyFormulaRepository(db_session),
            EventPublisher(query_service=query_service)
        ),
    }
