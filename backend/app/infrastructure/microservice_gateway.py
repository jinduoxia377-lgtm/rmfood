"""Microservice Gateway - Entry point for service-to-service communication.

In monolithic mode, this provides direct method calls. In microservices mode,
it translates to HTTP/gRPC calls to remote services.
"""

from typing import Any, Dict, Optional

import httpx


class MicroserviceGateway:
    """Gateway that abstracts communication with microservices.

    Supports both local (same process) and remote (HTTP/gRPC) invocation modes.
    """

    def __init__(self, mode: str = "local"):
        """
        Initialize the gateway.

        Args:
            mode: "local" (in-process calls) or "remote" (HTTP calls to deployed services)
        """
        self.mode = mode
        self._service_endpoints: Dict[str, str] = {
            "ai-conversation": "http://localhost:8000",
            "formula-calculation": "http://localhost:8001",
            "authz": "http://localhost:8002",
        }

        # Local service instances (for local mode)
        self._local_services: Dict[str, Any] = {}

    def set_service_endpoint(self, service_name: str, endpoint: str) -> None:
        """Set the endpoint URL for a specific service."""
        self._service_endpoints[service_name] = endpoint

    def register_local_service(self, service_name: str, service_instance: Any) -> None:
        """Register a local service instance (for local mode)."""
        self._local_services[service_name] = service_instance

    async def call_chat_service(self, method: str, **kwargs) -> Dict[str, Any]:
        """Call a method on the AI conversation service."""
        if self.mode == "local":
            service = self._local_services.get("ai-conversation")
            if service is None:
                raise RuntimeError("Chat service not registered in local mode")
            return getattr(service, method)(**kwargs)
        else:
            # Remote call via HTTP (pseudo-code - actual implementation would use httpx)
            endpoint = self._service_endpoints["ai-conversation"] + "/" + method
            response = await httpx.post(endpoint, json=kwargs)
            return response.json()

    async def call_calculation_service(self, method: str, **kwargs) -> Dict[str, Any]:
        """Call a method on the formula calculation service."""
        if self.mode == "local":
            service = self._local_services.get("formula-calculation")
            if service is None:
                raise RuntimeError("Calculation service not registered in local mode")
            return getattr(service, method)(**kwargs)
        else:
            response = await httpx.post(json=kwargs)
            return response.json()

    async def call_auth_service(self, method: str, **kwargs) -> Dict[str, Any]:
        """Call a method on the authentication service."""
        if self.mode == "local":
            service = self._local_services.get("authz")
            if service is None:
                raise RuntimeError("Auth service not registered in local mode")
            return getattr(service, method)(**kwargs)
        else:
            endpoint = self._service_endpoints["authz"] + "/" + method
            response = await httpx.post(endpoint, json=kwargs)
            return response.json()


# Global gateway instance (injectable dependency)
_gateway: Optional[MicroserviceGateway] = None


def get_microservice_gateway(mode: str = "local") -> MicroserviceGateway:
    """Get or create the global microservice gateway."""
    global _gateway
    if _gateway is None or _gateway.mode != mode:
        _gateway = MicroserviceGateway(mode=mode)
    return _gateway
