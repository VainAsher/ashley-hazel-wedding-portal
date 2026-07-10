from __future__ import annotations

import enum
from datetime import date, datetime, time

from decimal import Decimal

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    Time,
    UniqueConstraint,
    text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship as orm_relationship


class Base(DeclarativeBase):
    """Base class for SQLAlchemy models."""


class RsvpStatus(str, enum.Enum):
    pending = "pending"
    accepted = "accepted"
    declined = "declined"
    tentative = "tentative"


class TaskStatus(str, enum.Enum):
    not_started = "not_started"
    in_progress = "in_progress"
    done = "done"
    blocked = "blocked"


class TaskPriority(str, enum.Enum):
    low = "low"
    medium = "medium"
    high = "high"


rsvp_status_enum = Enum(
    RsvpStatus,
    name="rsvp_status",
    native_enum=True,
    create_type=False,
    values_callable=lambda values: [item.value for item in values],
)

task_status_enum = Enum(
    TaskStatus,
    name="task_status",
    native_enum=True,
    create_type=False,
    values_callable=lambda values: [item.value for item in values],
)

task_priority_enum = Enum(
    TaskPriority,
    name="task_priority",
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
    phase: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'live'")
    )
    # Couple-configurable guest-site theme (admin Settings dials); NULL = defaults.
    theme: Mapped[dict | None] = mapped_column(JSONB)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at: Mapped[datetime | None] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )

    guests: Mapped[list["Guest"]] = orm_relationship(back_populates="wedding")
    invites: Mapped[list["Invite"]] = orm_relationship(back_populates="wedding")
    tasks: Mapped[list["Task"]] = orm_relationship(back_populates="wedding")
    wedding_party: Mapped[list["WeddingParty"]] = orm_relationship(back_populates="wedding")
    vendors: Mapped[list["Vendor"]] = orm_relationship(back_populates="wedding")
    budget_items: Mapped[list["BudgetItem"]] = orm_relationship(back_populates="wedding")
    events: Mapped[list["Event"]] = orm_relationship(back_populates="wedding")
    communications: Mapped[list["Communication"]] = orm_relationship(back_populates="wedding")
    blessings: Mapped[list["Blessing"]] = orm_relationship(back_populates="wedding")
    gallery_items: Mapped[list["GalleryItem"]] = orm_relationship(back_populates="wedding")
    song_requests: Mapped[list["SongRequest"]] = orm_relationship(back_populates="wedding")


class Guest(Base):
    __tablename__ = "guests"
    __table_args__ = (
        UniqueConstraint("wedding_id", "email", name="uq_guests_wedding_email"),
        CheckConstraint("length(btrim(name)) > 0", name="ck_guests_name_not_blank"),
        CheckConstraint(
            "email IS NULL OR email ~* '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'",
            name="ck_guests_email_format",
        ),
        CheckConstraint(
            "rsvp_status::text IN ('pending', 'accepted', 'declined', 'tentative')",
            name="ck_guests_rsvp_status_valid",
        ),
        CheckConstraint(
            "plus_one_rsvp IS NULL OR plus_one_rsvp::text IN "
            "('pending', 'accepted', 'declined', 'tentative')",
            name="ck_guests_plus_one_rsvp_valid",
        ),
        CheckConstraint(
            "table_number IS NULL OR table_number > 0",
            name="ck_guests_table_number_positive",
        ),
        CheckConstraint(
            "seat_number IS NULL OR seat_number > 0",
            name="ck_guests_seat_number_positive",
        ),
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
    rsvp_status: Mapped[RsvpStatus] = mapped_column(
        rsvp_status_enum,
        nullable=False,
        server_default=text("'pending'::rsvp_status"),
    )
    meal_choice: Mapped[str | None] = mapped_column(String(100))
    dietary_notes: Mapped[str | None] = mapped_column(Text)
    dietary_restrictions: Mapped[str | None] = mapped_column(Text)
    plus_one_name: Mapped[str | None] = mapped_column(String(255))
    plus_one_rsvp: Mapped[RsvpStatus | None] = mapped_column(rsvp_status_enum)
    plus_one_dietary: Mapped[str | None] = mapped_column(Text)
    table_number: Mapped[int | None] = mapped_column(Integer)
    seat_number: Mapped[int | None] = mapped_column(Integer)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )

    wedding: Mapped[Wedding] = orm_relationship(back_populates="guests")
    invites: Mapped[list["Invite"]] = orm_relationship(back_populates="guest")


class WeddingParty(Base):
    __tablename__ = "wedding_party"
    __table_args__ = (
        UniqueConstraint("wedding_id", "name", "role", name="uq_wedding_party_name_role"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    wedding_id: Mapped[int] = mapped_column(
        ForeignKey("weddings.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(20))
    attire_notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )

    wedding: Mapped[Wedding] = orm_relationship(back_populates="wedding_party")


class Invite(Base):
    __tablename__ = "invites"
    __table_args__ = (
        CheckConstraint("length(btrim(code)) > 0", name="ck_invites_code_not_blank"),
        CheckConstraint(
            "role IN ('couple', 'coordinator', 'guest')",
            name="ck_invites_role_valid",
        ),
        Index("idx_invites_code", "code", unique=True),
        Index("idx_invites_wedding_role", "wedding_id", "role"),
        Index("idx_invites_guest_id", "guest_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    code: Mapped[str] = mapped_column(String(50), nullable=False)
    wedding_id: Mapped[int] = mapped_column(
        ForeignKey("weddings.id", ondelete="CASCADE"), nullable=False
    )
    guest_id: Mapped[int | None] = mapped_column(
        ForeignKey("guests.id", ondelete="SET NULL")
    )
    household_name: Mapped[str | None] = mapped_column(String(255))
    role: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default=text("'guest'")
    )
    redeemed_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )

    wedding: Mapped[Wedding] = orm_relationship(back_populates="invites")
    guest: Mapped[Guest | None] = orm_relationship(back_populates="invites")


class GuestAudit(Base):
    __tablename__ = "guest_audit"
    __table_args__ = (
        CheckConstraint(
            "action IN ('INSERT', 'UPDATE', 'DELETE')",
            name="ck_guest_audit_action",
        ),
        Index("idx_guest_audit_guest_id", "guest_id"),
        Index("idx_guest_audit_changed_at", text("changed_at DESC")),
        Index("idx_guest_audit_guest_changed_at", "guest_id", text("changed_at DESC")),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    guest_id: Mapped[int] = mapped_column(Integer, nullable=False)
    wedding_id: Mapped[int | None] = mapped_column(Integer)
    action: Mapped[str] = mapped_column(String(50), nullable=False)
    old_values: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    new_values: Mapped[dict[str, object] | None] = mapped_column(JSONB)
    changed_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )
    changed_by: Mapped[str | None] = mapped_column(
        String(255), server_default=text("CURRENT_USER")
    )

    # guest_audit.wedding_id intentionally carries no FK (migration 004): audit
    # rows must survive guest/wedding deletion. This is a viewonly convenience
    # join only — hence the explicit primaryjoin and no back-ref on Wedding.
    wedding: Mapped["Wedding | None"] = orm_relationship(
        "Wedding",
        primaryjoin="foreign(GuestAudit.wedding_id) == Wedding.id",
        viewonly=True,
    )


class Task(Base):
    __tablename__ = "tasks"
    __table_args__ = (
        CheckConstraint(
            "status IN ('not_started', 'in_progress', 'done', 'blocked')",
            name="tasks_status_valid",
        ),
        CheckConstraint(
            "priority IN ('low', 'medium', 'high')",
            name="tasks_priority_valid",
        ),
        Index("idx_tasks_wedding_id", "wedding_id"),
        Index("idx_tasks_status", "status"),
        Index("idx_tasks_priority", "priority"),
        Index("idx_tasks_assigned_to", "assigned_to"),
        Index("idx_tasks_due_date", "due_date"),
        Index("idx_tasks_wedding_status", "wedding_id", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    wedding_id: Mapped[int] = mapped_column(
        ForeignKey("weddings.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    status: Mapped[TaskStatus] = mapped_column(
        task_status_enum, nullable=False, server_default=text("'not_started'")
    )
    priority: Mapped[TaskPriority] = mapped_column(
        task_priority_enum, nullable=False, server_default=text("'medium'")
    )
    due_date: Mapped[date | None] = mapped_column(Date)
    assigned_to: Mapped[int | None] = mapped_column(
        ForeignKey("wedding_party.id", ondelete="SET NULL")
    )
    category: Mapped[str | None] = mapped_column(String(100))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )

    wedding: Mapped[Wedding] = orm_relationship(back_populates="tasks")
    assigned_party: Mapped["WeddingParty | None"] = orm_relationship()


class BudgetCategory(Base):
    __tablename__ = "budget_categories"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    category_name: Mapped[str] = mapped_column(String(100), nullable=False, unique=True)
    description: Mapped[str | None] = mapped_column(Text)

    vendors: Mapped[list["Vendor"]] = orm_relationship(back_populates="category")
    budget_items: Mapped[list["BudgetItem"]] = orm_relationship(back_populates="category")


class Vendor(Base):
    __tablename__ = "vendors"
    __table_args__ = (
        Index("idx_vendors_wedding_id", "wedding_id"),
        Index("idx_vendors_category", "category_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    wedding_id: Mapped[int] = mapped_column(
        ForeignKey("weddings.id", ondelete="CASCADE"), nullable=False
    )
    vendor_name: Mapped[str] = mapped_column(String(255), nullable=False)
    category_id: Mapped[int] = mapped_column(
        ForeignKey("budget_categories.id"), nullable=False
    )
    contact_person: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(20))
    website: Mapped[str | None] = mapped_column(String(255))
    contract_signed: Mapped[bool] = mapped_column(
        Boolean, server_default=text("FALSE")
    )
    contract_file: Mapped[str | None] = mapped_column(String(500))
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )

    wedding: Mapped[Wedding] = orm_relationship(back_populates="vendors")
    category: Mapped[BudgetCategory] = orm_relationship(back_populates="vendors")
    budget_items: Mapped[list["BudgetItem"]] = orm_relationship(back_populates="vendor")


class BudgetItem(Base):
    __tablename__ = "budget_items"
    __table_args__ = (
        Index("idx_budget_items_wedding_id", "wedding_id"),
        Index("idx_budget_items_category", "category_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    wedding_id: Mapped[int] = mapped_column(
        ForeignKey("weddings.id", ondelete="CASCADE"), nullable=False
    )
    vendor_id: Mapped[int | None] = mapped_column(
        ForeignKey("vendors.id", ondelete="SET NULL")
    )
    category_id: Mapped[int] = mapped_column(
        ForeignKey("budget_categories.id"), nullable=False
    )
    description: Mapped[str] = mapped_column(String(255), nullable=False)
    estimated_cost: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    actual_cost: Mapped[Decimal | None] = mapped_column(Numeric(10, 2))
    paid: Mapped[bool] = mapped_column(Boolean, server_default=text("FALSE"))
    payment_date: Mapped[date | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )

    wedding: Mapped[Wedding] = orm_relationship(back_populates="budget_items")
    category: Mapped[BudgetCategory] = orm_relationship(back_populates="budget_items")
    vendor: Mapped["Vendor | None"] = orm_relationship(back_populates="budget_items")


class Event(Base):
    __tablename__ = "events"
    __table_args__ = (
        Index("idx_events_wedding_id", "wedding_id"),
        Index("idx_events_date", "event_date"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    wedding_id: Mapped[int] = mapped_column(
        ForeignKey("weddings.id", ondelete="CASCADE"), nullable=False
    )
    event_name: Mapped[str] = mapped_column(String(255), nullable=False)
    event_date: Mapped[date] = mapped_column(Date, nullable=False)
    event_time: Mapped[time | None] = mapped_column(Time)
    location: Mapped[str | None] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime, server_default=text("CURRENT_TIMESTAMP")
    )

    wedding: Mapped[Wedding] = orm_relationship(back_populates="events")


class Communication(Base):
    __tablename__ = "communications"
    __table_args__ = (
        CheckConstraint(
            "channel IN ('email', 'whatsapp', 'sms', 'announcement')",
            name="ck_communications_channel",
        ),
        CheckConstraint(
            "audience IN ('all', 'attending', 'pending', 'declined')",
            name="ck_communications_audience",
        ),
        CheckConstraint(
            "status IN ('draft', 'scheduled', 'sent')",
            name="ck_communications_status",
        ),
        CheckConstraint(
            "length(btrim(subject)) > 0",
            name="ck_communications_subject_not_blank",
        ),
        Index("idx_communications_wedding", "wedding_id"),
        Index("idx_communications_wedding_status", "wedding_id", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    wedding_id: Mapped[int] = mapped_column(
        ForeignKey("weddings.id", ondelete="CASCADE"), nullable=False
    )
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    channel: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default=text("'email'")
    )
    audience: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default=text("'all'")
    )
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default=text("'draft'")
    )
    scheduled_for: Mapped[datetime | None] = mapped_column(DateTime)
    sent_at: Mapped[datetime | None] = mapped_column(DateTime)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )

    wedding: Mapped[Wedding] = orm_relationship(back_populates="communications")


class Blessing(Base):
    __tablename__ = "blessings"
    __table_args__ = (
        Index("idx_blessings_wedding", "wedding_id"),
        Index("idx_blessings_wedding_hidden", "wedding_id", "hidden"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    wedding_id: Mapped[int] = mapped_column(
        ForeignKey("weddings.id", ondelete="CASCADE"), nullable=False
    )
    author_name: Mapped[str] = mapped_column(String(255), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    hidden: Mapped[bool] = mapped_column(Boolean, server_default=text("FALSE"))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )

    wedding: Mapped[Wedding] = orm_relationship(back_populates="blessings")


class GalleryItem(Base):
    __tablename__ = "gallery_items"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'approved', 'rejected')",
            name="ck_gallery_status",
        ),
        Index("idx_gallery_wedding", "wedding_id"),
        Index("idx_gallery_wedding_status", "wedding_id", "status"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    wedding_id: Mapped[int] = mapped_column(
        ForeignKey("weddings.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str | None] = mapped_column(String(255))
    caption: Mapped[str | None] = mapped_column(Text)
    file_path: Mapped[str] = mapped_column(String(500), nullable=False)
    content_type: Mapped[str | None] = mapped_column(String(100))
    file_size: Mapped[int | None] = mapped_column(Integer)
    uploaded_by: Mapped[str | None] = mapped_column(String(255))
    status: Mapped[str] = mapped_column(
        String(50), nullable=False, server_default=text("'approved'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )

    wedding: Mapped[Wedding] = orm_relationship(back_populates="gallery_items")


class SongRequest(Base):
    __tablename__ = "song_requests"
    __table_args__ = (
        CheckConstraint(
            "status IN ('pending', 'approved', 'rejected', 'blocked')",
            name="ck_song_requests_status",
        ),
        Index("idx_song_requests_wedding_status", "wedding_id", "status"),
        Index("idx_song_requests_wedding_created", "wedding_id", text("created_at DESC")),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    wedding_id: Mapped[int] = mapped_column(
        ForeignKey("weddings.id", ondelete="CASCADE"), nullable=False
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    artist: Mapped[str | None] = mapped_column(String(255))
    source_url: Mapped[str | None] = mapped_column(String(500))
    dedication: Mapped[str | None] = mapped_column(String(500))
    requested_by: Mapped[str] = mapped_column(String(255), nullable=False)
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'pending'")
    )
    pinned: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("FALSE")
    )
    position: Mapped[int | None] = mapped_column(Integer)
    resolved_title: Mapped[str | None] = mapped_column(String(255))
    resolved_artist: Mapped[str | None] = mapped_column(String(255))
    artwork_url: Mapped[str | None] = mapped_column(String(500))
    spotify_track_id: Mapped[str | None] = mapped_column(String(64))
    # 30s audio preview for the guest jukebox (iTunes match); NULL = none yet.
    preview_url: Mapped[str | None] = mapped_column(String(500))
    created_at: Mapped[datetime] = mapped_column(
        DateTime, nullable=False, server_default=text("CURRENT_TIMESTAMP")
    )

    wedding: Mapped[Wedding] = orm_relationship(back_populates="song_requests")
