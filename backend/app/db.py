import os
from datetime import datetime, date, timezone
from sqlalchemy import create_engine, String, Integer, Float, Date, DateTime, JSON, UniqueConstraint, Index
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, sessionmaker

def normalize_database_url(url: str) -> str:
    # Render Postgres exposes postgres://; explicitly select psycopg v3.
    if url.startswith("postgres://"):
        return "postgresql+psycopg://" + url.removeprefix("postgres://")
    if url.startswith("postgresql://"):
        return "postgresql+psycopg://" + url.removeprefix("postgresql://")
    return url


DATABASE_URL = normalize_database_url(os.getenv("DATABASE_URL", "sqlite:///./lifepulse.db"))
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, expire_on_commit=False)

class Base(DeclarativeBase): pass

class Bill(Base):
    __tablename__ = "bills"
    __table_args__ = (UniqueConstraint("owner_id", "period_start", "period_end", name="uq_bill_period"), Index("ix_bill_owner_period", "owner_id", "period_start"))
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(80), index=True)
    consumption_kwh: Mapped[float] = mapped_column(Float)
    period_start: Mapped[date] = mapped_column(Date)
    period_end: Mapped[date] = mapped_column(Date)
    billing_days: Mapped[int] = mapped_column(Integer)
    total_amount_inr: Mapped[float] = mapped_column(Float)
    verified: Mapped[bool] = mapped_column(default=True)
    provenance: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

class Action(Base):
    __tablename__ = "actions"
    id: Mapped[int] = mapped_column(primary_key=True)
    owner_id: Mapped[str] = mapped_column(String(80), index=True)
    action_id: Mapped[str] = mapped_column(String(120))
    title: Mapped[str] = mapped_column(String(240))
    expected_impact: Mapped[str] = mapped_column(String(300))
    impact_unit: Mapped[str] = mapped_column(String(80))
    start_date: Mapped[date] = mapped_column(Date)
    status: Mapped[str] = mapped_column(String(30), default="active")
    created_at: Mapped[datetime] = mapped_column(DateTime, default=lambda: datetime.now(timezone.utc))

def get_db():
    db = SessionLocal()
    try: yield db
    finally: db.close()
