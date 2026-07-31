""" Configuration module for microservices """

import os
from dataclasses import dataclass
from typing import Optional

@dataclass
class ServiceConfig:
    host: str = "0.0.0.0"
    port: int = 8000
    app_env: str = "development"
    log_level: str = "info"
    database_url: Optional[str] = None

    @classmethod
    def from_environment(cls):
        c = cls()
        c.app_env = os.getenv("APP_ENV", "development")
        return c

@dataclass
class MicroservicesConfig:
    event_bus_url: str = "redis://localhost:6379"

    def __init__(self):
        self.ai_conversation = ServiceConfig()
