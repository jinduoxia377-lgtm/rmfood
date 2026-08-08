from typing import Optional, Any
from datetime import timedelta
import redis
import json

class CacheService:
    """Cache service abstraction for CQRS read models."""
    
    def __init__(self, use_redis=False, host="localhost", port=6379):
        self.use_redis = use_redis
        if use_redis:
            self.client = redis.Redis(host=host, port=port, decode_responses=True)
        else:
            self._local_store = {}
    
    def get(self, key: str) -> Optional[Any]:
        if self.use_redis:
            val = self.client.get(key)
            if val:
                return json.loads(val)
            return None
        return self._local_store.get(key)
    
    def set(self, key: str, value: Any, ttl: Optional[timedelta] = None) -> None:
        serialized = json.dumps(value)
        if self.use_redis:
            if ttl:
                self.client.setex(key, int(ttl.total_seconds()), serialized)
            else:
                self.client.set(key, serialized)
        else:
            self._local_store[key] = serialized
    
    def delete(self, key: str) -> None:
        if self.use_redis:
            self.client.delete(key)
        else:
            self._local_store.pop(key, None)

def create_cache_service(use_redis=False):
    return CacheService(use_redis=use_redis)
