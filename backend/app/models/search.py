"""Search persistence ORM models (search_history, search_favorites, search_recent_views)"""
from sqlalchemy import BigInteger, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from .base import BaseModel


class SearchHistory(BaseModel):
    """User search history"""
    __tablename__ = "search_history"

    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    keyword: Mapped[str] = mapped_column(String(500), nullable=False)
    source: Mapped[str] = mapped_column(String(50), default="")  # herbs, peptides, graph, unified
    result_count: Mapped[int] = mapped_column(Integer, default=0)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "keyword": self.keyword,
            "source": self.source,
            "result_count": self.result_count,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class SearchFavorites(BaseModel):
    """User search favorites"""
    __tablename__ = "search_favorites"

    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    keyword: Mapped[str] = mapped_column(String(500), nullable=False)
    source: Mapped[str] = mapped_column(String(50), default="")

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "keyword": self.keyword,
            "source": self.source,
        }


class SearchRecentViews(BaseModel):
    """Recently viewed search results"""
    __tablename__ = "search_recent_views"

    user_id: Mapped[int] = mapped_column(BigInteger, nullable=False, index=True)
    resource_type: Mapped[str] = mapped_column(String(50), nullable=False)  # herb, peptide, compound
    resource_id: Mapped[int] = mapped_column(BigInteger, nullable=False)
    keyword: Mapped[str] = mapped_column(String(500), nullable=True)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "user_id": self.user_id,
            "resource_type": self.resource_type,
            "resource_id": self.resource_id,
            "keyword": self.keyword,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }
