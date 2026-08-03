"""Model gateway - Central registry and router for multiple LLM adapters."""

from typing import List, Dict, Type, Optional
from dataclasses import dataclass, field

from .ports import LLMPort, ChatResponse, Message


@dataclass
class ModelVariant:
    cls: Type[LLMPort]
    env: str
    description: str
    priority: int = 1


class ModelRegistry:
    _instances = {}
    
    def __new__(cls):
        if cls not in cls._instances:
            cls._instances[cls] = super().__new__(cls)
            cls._instances[cls]._initialized = False
        return cls._instances[cls]
    
    def __init__(self):
        if self._initialized:
            return
        self._initialized = True
        self._registered = {}
        self._default_mapping = {}
    
    def register_provider(self, provider_name, variants, descriptions, default_variant="prod"):
        if provider_name not in self._registered:
            self._registered[provider_name] = {}
        for variant_key, adapter_cls in variants.items():
            variant = ModelVariant(cls=adapter_cls, env=variant_key, description=descriptions.get(variant_key, variant_key))
            self._registered[provider_name][variant_key] = variant
        self.set_default(provider_name, default_variant)
    
    def set_default(self, provider_name, variant_key):
        if provider_name in self._registered and variant_key in self._registered[provider_name]:
            self._default_mapping[provider_name] = variant_key
        else:
            raise KeyError("Provider or variant not registered")
    
    def get_adapter_instance(self, provider_name, **kwargs):
        if provider_name not in self._registered:
            available = list(self._registered.keys())
            raise KeyError(f"Unknown provider: {provider_name}. Available: {available}")
        
        variant_key = self._default_mapping.get(provider_name, "prod")
        if variant_key not in self._registered[provider_name]:
            available = list(self._registered[provider_name].keys())
            raise KeyError(f"Variant '{variant_key}' not in provider '{provider_name}'. Available: {available}")
        
        adapter_cls = self._registered[provider_name][variant_key].cls
        try:
            return adapter_cls(**kwargs)
        except Exception as e:
            raise RuntimeError(f"Failed to instantiate {provider_name}: {e}") from e
    
    def get_all_providers(self):
        return list(self._registered.keys())


class ModelGateway:
    def __init__(self):
        self._registry = ModelRegistry()
        self._setup_default_providers()
    
    def _setup_default_providers(self):
        # Delay import to avoid circular dependencies
        from .openai_adapter import OpenAIAPI
        openai_variants = {"prod": OpenAIAPI}
        openai_descs = {"prod": "Production: OpenAI live API"}
        self._registry.register_provider("openai", openai_variants, openai_descs, "prod")
    
    def chat(self, provider_name, messages, **kwargs):
        adapter = self._registry.get_adapter_instance(provider_name, **kwargs)
        return adapter.chat(messages, **kwargs)
    
    def get_available_models(self):
        result = {}
        for provider in self.get_all_providers():
            try:
                adapter = self._registry.get_adapter_instance(provider)
                result[provider] = adapter.get_supported_models()
            except Exception as provider_err:
                logger.warning("[ModelGateway] 获取 %s 可用模型失败: %s", provider, provider_err)
                result[provider] = []
        return result


class MockOpenAIAdapter(LLMPort):
    def __init__(self, api_key=None, default_model="mock"):
        self.default_model = default_model
        self.supported_models = ["mock"]
    
    def chat(self, messages, **kwargs):
        content = "[MOCK RESPONSE] " + "; ".join([m.content[:50] for m in messages])
        return ChatResponse(
            messages=[Message(role="assistant", content=content)],
            usage={"prompt_tokens": 0, "completion_tokens": 0},
            model_used="mock"
        )
    
    def get_supported_models(self):
        return self.supported_models
    
    def get_default_model(self):
        return self.default_model
