"""Event publisher module for CQRS."""


class EventPublisher:
    def __init__(self, query_service):
        self.subscribers = []
        self.query_service = query_service
    def subscribe(self, callback):
        self.subscribers.append(callback)
    async def publish(self, event):
        for sub in self.subscribers:
            sub(event)
