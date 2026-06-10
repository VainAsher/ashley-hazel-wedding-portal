from __future__ import annotations

import enum
from datetime import date, datetime, time

from sqlalchemy import Date, DateTime, Enum, ForeignKey, Index, Integer, String, Text, Time, text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship as orm_relationship


class Base(DeclarativeBase):
    """Base class for SQLAlchemy models."""


class RsvpStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"
    tentative = "tentative"


rsvp_status_enum = Enum(
    RsvpStatus,
    name="rsvp_status",
    native_enum=True,
    create_type=False,
    values_callable=lambda values: [item.value for item in values],
)


class Wedding(Base):
    __tablename__ = "weddings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    couple_names: Mapped[str] = mapped_column(String(255), nullable=False)
    wedding_date: Mapped[date] = mapped_column(Date, nullable=False)
    ceremony_time: Mapped[time | None] = mapped_column(Time)
    ceremony_location: Mapped[str | None] = mapped_column(String(255))
    reception_location: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )

    guests: Mapped[list["Guest"]] = orm_relationship(back_populates="wedding")


class Guest(Base):
    __tablename__ = "guests"
    __table_args__ = (
        Index("idx_guests_email", "email", postgresql_where=text("email IS NOT NULL")),
        Index("idx_guests_name", "name"),
        Index("idx_guests_created_at", "created_at"),
        Index("idx_guests_wedding_rsvp", "wedding_id", "rsvp_status"),
        Index("idx_guests_wedding_created", "wedding_id", text("created_at DESC")),
        Index(
            "idx_guests_table_assignment",
            "wedding_id",
            "table_number",
            "seat_number",
            postgresql_where=text("table_number IS NOT NULL"),
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    wedding_id: Mapped[int] = mapped_column(
        ForeignKey("weddings.id", ondelete="CASCADE"), nullable=False, index=True
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(20))
    relationship: Mapped[str | None] = mapped_column(String(100))
    rsvp_status: Mapped[RsvpStatus | None] = mapped_column(
        rsvp_status_enum, server_default=text("'pending'::rsvp_status")
    )
    dietary_restrictions: Mapped[str | None] = mapped_column(Text)
    plus_one_name: Mapped[str | None] = mapped_column(String(255))
    plus_one_rsvp: Mapped[RsvpStatus | None] = mapped_column(rsvp_status_enum)
    plus_one_dietary: Mapped[str | None] = mapped_column(Text)
    table_number: Mapped[int | None] = mapped_column(Integer)
    seat_number: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )

    wedding: Mapped[Wedding] = orm_relationship(back_populates="guests")
