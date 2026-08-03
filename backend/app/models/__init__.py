from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, Float, Integer, String, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.db import Base


class Part(Base):
    __tablename__ = "parts"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    category: Mapped[str] = mapped_column(String(32), index=True)
    name: Mapped[str] = mapped_column(String(256))
    brand: Mapped[str] = mapped_column(String(64), default="")
    list_price: Mapped[float] = mapped_column(Float)
    search_keywords: Mapped[str] = mapped_column(String(256))
    specs: Mapped[dict[str, Any]] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class VerifiedPrice(Base):
    __tablename__ = "verified_prices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    part_id: Mapped[str] = mapped_column(String(64), index=True, unique=True)
    price: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(8), default="CNY")
    source_platform: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    product_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    verified_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class PriceHistory(Base):
    __tablename__ = "price_history"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    part_id: Mapped[str] = mapped_column(String(64), index=True)
    price: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(8), default="CNY")
    source: Mapped[str] = mapped_column(String(64))  # correction / serpapi / catalog
    source_platform: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    product_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    recorded_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, index=True)


class PriceCorrection(Base):
    __tablename__ = "price_corrections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    part_id: Mapped[str] = mapped_column(String(64), index=True)
    price: Mapped[float] = mapped_column(Float)
    currency: Mapped[str] = mapped_column(String(8), default="CNY")
    source_platform: Mapped[Optional[str]] = mapped_column(String(64), nullable=True)
    product_url: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    submitter: Mapped[str] = mapped_column(String(64), default="anonymous")
    status: Mapped[str] = mapped_column(String(16), default="pending", index=True)  # pending/verified/rejected
    reject_reason: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    needs_manual_review: Mapped[int] = mapped_column(Integer, default=0)  # 0/1
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
