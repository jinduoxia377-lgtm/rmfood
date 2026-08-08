"""Event Bus implementation for cross-service communication.

This supports both in-process event handling (for monolithic mode) and
distributed messaging (for microservices mode via Kafka/RabbitMQ).
"""

from typing import Callable, Optional, Dict, List
from dataclasses import dataclass
import asyncio
import logging

logger = logging.getLogger(__name__)


@dataclass
class Event:
    """Base event structure."""
    event_id: str
    timestamp: float
    payload: Dict[str, Any]
    source_service: str


class EventBus:
    """
    Central event bus that allows services to communicate via domain events.
    
    In monolithic mode, events are delivered synchronously within the same process.
    In microservices mode, this can be backed by a message broker like Kafka.
    """
    
    def __init__(self):
        self._subscribers: Dict[str, List[Callable]] = {}
        self._publisher: Optional[Any] = None  # Will be set for distributed mode
    
    def subscribe(self, event_type: str, handler: Callable) -> None:
        """Subscribe a handler to an event type."""
        if event_type not in self._subscribers:
            self._subscribers[event_type] = []
        self._subscribers[event_type].append(handler)
        logger.info(f"Subscribed handler to event type: {event_type}")
    
    def unsubscribe(self, event_type: str, handler: Callable) -> None:
        """Unsubscribe a handler from an event type."""
        if event_type in self._subscribers:
            self._subscribers[event_type].remove(handler)
            logger.info(f"Unremoved handler from event type: {event_type}")
    
    async def publish(self, event: Event) -> None:
        """Publish an event to all subscribers."""
        event_type = type(event).__name__
        
        if event_type in self._subscribers:
            for handler in self._subscribers[event_type]:
                try:
                    # Call handler asynchronously
                    if asyncio.iscoroutinefunction(handler):
                        await handler(event)
                    else:
                        handler(event)
                except Exception as e:
                    logger.error(f"Error handling event {event.event_id}: {e}")
        
        # Also trigger any distributed publisher if configured
        if self._publisher:
            await self._publisher.publish_event(event)
    
    def set_publisher(self, publisher: Any) -> None:
        """Set a distributed message broker publisher (for microservices mode)."""
        self._publisher = publisher
        logger.info("Event bus configured with distributed publisher")


# Global instance for use across the application
_event_bus: Optional[EventBus] = None


def get_event_bus() -> EventBus:
    """Get the global event bus singleton."""
    global _event_bus
    if _event_bus is None:
        _event_bus = EventBus()
    return _event_bus


# Helper function to create and dispatch events
def create_event(event_id: str, source_service: str, payload: Dict[str, Any]) -> Event:
    """Create a new domain event."""
    return Event(
        event_id=event_id,
        timestamp=time.time(),
        payload=payload,
        source_service=source_service
    )
