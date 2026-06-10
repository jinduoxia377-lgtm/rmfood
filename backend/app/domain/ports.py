"""
端口定义：应用层与基础设施层之间的契约

这些 ABC 类定义领域层需要的外部服务接口，
由 infrastructure/ 目录下的适配器实现。
"""
from abc import ABC, abstractmethod
from typing import Optional, List
from .entities import Formula, FormulaId, DomainEvent


class FormulaRepository(ABC):
    """配方仓储接口"""

    @abstractmethod
    async def save(self, formula: Formula) -> None:
        ...

    @abstractmethod
    async def get_by_id(self, id: FormulaId) -> Optional[Formula]:
        ...

    @abstractmethod
    async def get_by_name(self, name: str) -> Optional[Formula]:
        ...

    @abstractmethod
    async def find_by_status(self, status: str, limit: int = 20) -> List[Formula]:
        ...

    @abstractmethod
    async def delete(self, id: FormulaId) -> None:
        ...


class EventPublisher(ABC):
    """事件发布器接口"""

    @abstractmethod
    async def publish(self, event: DomainEvent) -> None:
        ...


class IngredientCompatibilityService(ABC):
    """原料配伍禁忌查询接口"""

    @abstractmethod
    async def is_compatible(self, ingredient_a_id: str, ingredient_b_id: str) -> bool:
        ...

    @abstractmethod
    async def get_incompatible_pairs(self) -> dict[str, str]:
        ...


class IngredientRepository(ABC):
    """原料仓储接口"""

    @abstractmethod
    async def get_dosage_range(self, ingredient_id: str) -> tuple[float, float]:
        """
        获取原料的安全用量范围 (min, max)
        返回 (最小有效剂量, 最大安全剂量) 单位为克
        """
        ...


class MobileServicePort(ABC):
    """移动端服务端口 — 定义移动端 Facade 需要的外部能力"""

    @abstractmethod
    async def get_dashboard(self, user_id: str):
        """获取移动端仪表盘数据"""
        ...

    @abstractmethod
    async def sync_push(self, items: list[dict]) -> list[dict]:
        """推送同步数据"""
        ...

    @abstractmethod
    async def sync_pull(self, last_sync: str | None = None) -> list[dict]:
        """拉取同步数据"""
        ...

    @abstractmethod
    async def get_notifications(self, user_id: str, limit: int = 20):
        """获取推送通知"""
        ...

    @abstractmethod
    async def mark_notification_read(self, notification_id: str) -> bool:
        """标记通知已读"""
        ...

    @abstractmethod
    async def get_traceability(self, formula_id: str):
        """获取配方溯源记录"""
        ...


class NotificationPort(ABC):
    """通知服务端口 — 定义通知发送能力"""

    @abstractmethod
    async def send(self, user_id: str, title: str, message: str, channel: str = "in_app") -> bool:
        """发送通知"""
        ...

    @abstractmethod
    async def get_unread_count(self, user_id: str) -> int:
        """获取未读通知数"""
        ...


class SearchPort(ABC):
    """搜索服务端口 — 定义全文搜索能力"""

    @abstractmethod
    async def search(self, query: str, index: str, limit: int = 20) -> list[dict]:
        """全文搜索"""
        ...

    @abstractmethod
    async def index_document(self, index: str, doc_id: str, body: dict) -> bool:
        """索引文档"""
        ...

    @abstractmethod
    async def delete_document(self, index: str, doc_id: str) -> bool:
        """删除文档"""
        ...


class PeptideAnalysisPort(ABC):
    """肽分析服务端口 — 定义肽序列分析能力"""

    @abstractmethod
    async def analyze_sequence(self, sequence: str) -> dict:
        """分析肽序列（理化性质、二级结构、生物活性）"""
        ...

    @abstractmethod
    async def predict_activity(self, sequence: str) -> dict:
        """预测生物活性"""
        ...

    @abstractmethod
    async def assess_safety(self, sequence: str) -> dict:
        """评估安全性（毒性、致敏性）"""
        ...


class AuthPort(ABC):
    """认证服务端口 — 定义认证能力"""

    @abstractmethod
    async def authenticate(self, username: str, password: str) -> dict | None:
        """认证用户，返回 token 或 None"""
        ...

    @abstractmethod
    async def verify_token(self, token: str) -> dict | None:
        """验证 token，返回用户信息或 None"""
        ...

    @abstractmethod
    async def refresh_token(self, refresh_token: str) -> dict | None:
        """刷新 token"""
        ...
