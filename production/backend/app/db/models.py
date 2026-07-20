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


class TaskContext(str, enum.Enum):
    """Which planning board a task belongs to. Kanban V2 scopes tasks so the
    same board can power Stag & Hen planning later (Wave 3 item 14 D2); the
    admin Timeline always uses `wedding` for now."""

    wedding = "wedding"
    stag = "stag"
    hen = "hen"


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

task_context_enum = Enum(
    TaskContext,
    name="task_context",
    native_enum=True,
    create_type=False,
    values_callable=lambda values: [item.value for item in values],
)


class Wedding(Base):
    __tablename__ = "weddings"
    __table_args__ = (
        CheckConstraint(
            "party_visibility_mode IN ('partner_visible', 'locked')",
            name="ck_weddings_party_visibility_mode_valid",
        ),
    )

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
    # Wedding-day "currently playing" pick (Dancefloor v2); NULL = nothing set.
    # use_alter breaks the weddings <-> song_requests FK cycle for create_all.
    now_playing_song_id: Mapped[int | None] = mapped_column(
        ForeignKey("song_requests.id", ondelete="SET NULL", use_alter=True)
    )
    # The couple's "menu is ready" switch: gates guest meal selection in RSVP.
    meal_selection_open: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("FALSE")
    )
    # Cross-grant default for the non-subject partner's access to their
    # partner's stag/hen party (Wave 3 item 14 D1). See
    # docs/specs/PARTY_PORTALS_D1.md "Access rule".
    party_visibility_mode: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'partner_visible'")
    )
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
    # foreign_keys pinned: weddings.now_playing_song_id adds a second FK path.
    song_requests: Mapped[list["SongRequest"]] = orm_relationship(
        back_populates="wedding", foreign_keys="SongRequest.wedding_id"
    )
    feedback: Mapped[list["Feedback"]] = orm_relationship(back_populates="wedding")
    notifications: Mapped[list["Notification"]] = orm_relationship(back_populates="wedding")
    menu_options: Mapped[list["MenuOption"]] = orm_relationship(back_populates="wedding")


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
    address: Mapped[str | None] = mapped_column(String(500))
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
    plus_one_meal_choice: Mapped[str | None] = mapped_column(String(120))
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
        CheckConstraint(
            "party IN ('stag', 'hen') OR party IS NULL",
            name="ck_invites_party_valid",
        ),
        CheckConstraint(
            "associated_party IN ('stag', 'hen') OR associated_party IS NULL",
            name="ck_invites_associated_party_valid",
        ),
        Index("idx_invites_code", "code", unique=True),
        Index("idx_invites_wedding_role", "wedding_id", "role"),
        Index("idx_invites_guest_id", "guest_id"),
        Index(
            "uq_one_party_admin_per_party",
            "wedding_id",
            "party",
            unique=True,
            postgresql_where=text("party_admin = true"),
        ),
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
    # Guest's party membership (Wave 3 item 14 D1). NULL = not in a party.
    party: Mapped[str | None] = mapped_column(String(10))
    # Best Man (stag) / Maid of Honour (hen) — at most one per (wedding, party);
    # DB-backstopped by uq_one_party_admin_per_party above. Grants party_admin
    # powers (pin/hide messages, edit party info, always allowed to reveal).
    party_admin: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("FALSE")
    )
    # Friendly label, auto-set to "Best Man"/"Maid of Honour" when party_admin
    # is set; kept editable in case the couple wants different wording.
    party_title: Mapped[str | None] = mapped_column(String(50))
    # Meaningful only when role='couple': display name for this partner
    # ("Ashley" / "Hazel"). Display only — never used for access logic.
    partner_label: Mapped[str | None] = mapped_column(String(50))
    # Meaningful only when role='couple': which party is *this partner's own*
    # do. This — not partner_label — drives the party access rule.
    associated_party: Mapped[str | None] = mapped_column(String(10))
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
        CheckConstraint(
            "context IN ('wedding', 'stag', 'hen')",
            name="tasks_context_valid",
        ),
        Index("idx_tasks_wedding_id", "wedding_id"),
        Index("idx_tasks_status", "status"),
        Index("idx_tasks_priority", "priority"),
        Index("idx_tasks_assigned_to", "assigned_to"),
        Index("idx_tasks_due_date", "due_date"),
        Index("idx_tasks_wedding_status", "wedding_id", "status"),
        Index(
            "idx_tasks_wedding_context_status_position",
            "wedding_id",
            "context",
            "status",
            "position",
        ),
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
    # Which planning board (wedding/stag/hen) this task lives on. The admin
    # Timeline always writes 'wedding'; stag/hen mounting is Wave 3 item 14 D2.
    context: Mapped[TaskContext] = mapped_column(
        task_context_enum, nullable=False, server_default=text("'wedding'")
    )
    # Ordering slot within (wedding_id, context, status) for drag & drop.
    # Simple integer resequence per column (no fractional positions) —
    # plenty at wedding scale. Nullable for rows created before the v2
    # migration backfilled them; the API always writes an explicit int.
    position: Mapped[int | None] = mapped_column(Integer)
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
    thumb_path: Mapped[str | None] = mapped_column(String(500))
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

    wedding: Mapped[Wedding] = orm_relationship(
        back_populates="song_requests", foreign_keys=[wedding_id]
    )


class SongReaction(Base):
    """A guest's ♥ on a wall song — one per invite per song (Dancefloor v2).

    The invite is the durable identity (display names are editable), so the
    unique constraint is on (song_request_id, invite_id).
    """

    __tablename__ = "song_reactions"
    __table_args__ = (
        UniqueConstraint(
            "song_request_id", "invite_id", name="uq_song_reactions_song_invite"
        ),
        Index("idx_song_reactions_invite", "invite_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    song_request_id: Mapped[int] = mapped_column(
        ForeignKey("song_requests.id", ondelete="CASCADE"), nullable=False
    )
    invite_id: Mapped[int] = mapped_column(
        ForeignKey("invites.id", ondelete="CASCADE"), nullable=False
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )


class MenuOption(Base):
    __tablename__ = "menu_options"
    __table_args__ = (
        CheckConstraint(
            "course IN ('starter', 'main', 'dessert') OR course IS NULL",
            name="ck_menu_options_course",
        ),
        CheckConstraint(
            "length(btrim(name)) > 0", name="ck_menu_options_name_not_blank"
        ),
        Index("idx_menu_options_wedding", "wedding_id"),
        Index("idx_menu_options_wedding_active", "wedding_id", "active"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    wedding_id: Mapped[int] = mapped_column(
        ForeignKey("weddings.id", ondelete="CASCADE"), nullable=False
    )
    name: Mapped[str] = mapped_column(String(120), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    # Grouping ships in the schema for later; the v1 UI is one flat list.
    course: Mapped[str | None] = mapped_column(String(20))
    is_vegetarian: Mapped[bool] = mapped_column(Boolean, server_default=text("FALSE"))
    is_vegan: Mapped[bool] = mapped_column(Boolean, server_default=text("FALSE"))
    is_gluten_free: Mapped[bool] = mapped_column(Boolean, server_default=text("FALSE"))
    # Soft-delete flag: inactive options stay for history but leave the
    # guest-facing menu.
    active: Mapped[bool] = mapped_column(Boolean, server_default=text("TRUE"))
    created_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), server_default=text("now()")
    )

    wedding: Mapped[Wedding] = orm_relationship(back_populates="menu_options")


class Feedback(Base):
    __tablename__ = "feedback"
    __table_args__ = (
        CheckConstraint("type IN ('bug', 'idea')", name="ck_feedback_type"),
        CheckConstraint(
            "status IN ('new', 'triaged', 'done')", name="ck_feedback_status"
        ),
        Index("idx_feedback_wedding_status", "wedding_id", "status"),
        Index("idx_feedback_wedding_created", "wedding_id", text("created_at DESC")),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    wedding_id: Mapped[int] = mapped_column(
        ForeignKey("weddings.id", ondelete="CASCADE"), nullable=False
    )
    submitted_by: Mapped[str] = mapped_column(String(255), nullable=False)
    type: Mapped[str] = mapped_column(String(10), nullable=False)
    message: Mapped[str] = mapped_column(Text, nullable=False)
    # Auto-captured context from the widget: page path, session role, and
    # viewport ("1280x720") — nothing more is collected.
    page: Mapped[str | None] = mapped_column(String(200))
    role: Mapped[str | None] = mapped_column(String(30))
    viewport: Mapped[str | None] = mapped_column(String(30))
    status: Mapped[str] = mapped_column(
        String(20), nullable=False, server_default=text("'new'")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    wedding: Mapped[Wedding] = orm_relationship(back_populates="feedback")


class Notification(Base):
    __tablename__ = "notifications"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('communication', 'mention', 'system')",
            name="ck_notifications_kind",
        ),
        Index("idx_notifications_recipient_read", "recipient_invite_id", "read_at"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    wedding_id: Mapped[int] = mapped_column(
        ForeignKey("weddings.id", ondelete="CASCADE"), nullable=False
    )
    # The durable per-member identity is the invite (sessions store invite_id);
    # notifications address the invite, not the guest row.
    recipient_invite_id: Mapped[int] = mapped_column(
        ForeignKey("invites.id", ondelete="CASCADE"), nullable=False
    )
    kind: Mapped[str] = mapped_column(String(20), nullable=False)
    title: Mapped[str] = mapped_column(String(200), nullable=False)
    body: Mapped[str | None] = mapped_column(Text)
    link_path: Mapped[str | None] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

    wedding: Mapped[Wedding] = orm_relationship(back_populates="notifications")
    recipient_invite: Mapped[Invite] = orm_relationship()


# ---------------------------------------------------------------------------
# Stag & Hen party portals (Wave 3 item 14 D1) — see
# docs/specs/PARTY_PORTALS_D1.md for the full contract, especially the
# security-critical "Access rule" implemented in app/api/party.py.
# ---------------------------------------------------------------------------


class PartyReveal(Base):
    """Per-couple-invite reveal gate for a party's content.

    One row per (wedding, party, invite) that needs gating. Absence of a row
    falls back to the wedding's party_visibility_mode default for
    non-subjects only — subjects with no row are always locked out.
    """

    __tablename__ = "party_reveals"
    __table_args__ = (
        CheckConstraint("party IN ('stag', 'hen')", name="ck_party_reveals_party_valid"),
        UniqueConstraint(
            "wedding_id", "party", "invite_id", name="uq_party_reveals_wedding_party_invite"
        ),
        Index("idx_party_reveals_wedding_party", "wedding_id", "party"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    wedding_id: Mapped[int] = mapped_column(
        ForeignKey("weddings.id", ondelete="CASCADE"), nullable=False
    )
    party: Mapped[str] = mapped_column(String(10), nullable=False)
    invite_id: Mapped[int] = mapped_column(
        ForeignKey("invites.id", ondelete="CASCADE"), nullable=False
    )
    revealed: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("FALSE")
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )


class PartyMessage(Base):
    """Party message board post (blessings-pattern): author + hidden + pin,
    moderated by that party's admin (Best Man/Maid of Honour)."""

    __tablename__ = "party_messages"
    __table_args__ = (
        CheckConstraint("party IN ('stag', 'hen')", name="ck_party_messages_party_valid"),
        Index("idx_party_messages_wedding_party", "wedding_id", "party"),
        Index("idx_party_messages_wedding_party_hidden", "wedding_id", "party", "hidden"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    wedding_id: Mapped[int] = mapped_column(
        ForeignKey("weddings.id", ondelete="CASCADE"), nullable=False
    )
    party: Mapped[str] = mapped_column(String(10), nullable=False)
    invite_id: Mapped[int] = mapped_column(
        ForeignKey("invites.id", ondelete="CASCADE"), nullable=False
    )
    message: Mapped[str] = mapped_column(Text, nullable=False)
    hidden: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("FALSE")
    )
    pinned: Mapped[bool] = mapped_column(
        Boolean, nullable=False, server_default=text("FALSE")
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    author: Mapped[Invite] = orm_relationship()


class PartyInfo(Base):
    """Free-text date/venue/plan blurb for a party, editable by that party's
    admin. PK (wedding_id, party) — one row per party per wedding."""

    __tablename__ = "party_info"
    __table_args__ = (
        CheckConstraint("party IN ('stag', 'hen')", name="ck_party_info_party_valid"),
    )

    wedding_id: Mapped[int] = mapped_column(
        ForeignKey("weddings.id", ondelete="CASCADE"), primary_key=True
    )
    party: Mapped[str] = mapped_column(String(10), primary_key=True)
    details: Mapped[str | None] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )


class MemberProfile(Base):
    """Wedding-party mini profile (Wave 3 item 15).

    One row per eligible invite (any invite with `party IS NOT NULL`), created
    lazily on first save — no row means "hasn't filled theirs in yet", which
    the directory endpoint falls back to the guest's name/party title for
    rather than treating as an error. Guest-visible, not party-only: see
    docs/specs/WEDDING_PARTY_PROFILES.md.
    """

    __tablename__ = "member_profiles"
    __table_args__ = (
        UniqueConstraint("invite_id", name="uq_member_profiles_invite_id"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    invite_id: Mapped[int] = mapped_column(
        ForeignKey("invites.id", ondelete="CASCADE"), nullable=False
    )
    display_name: Mapped[str | None] = mapped_column(String(100))
    role_title: Mapped[str | None] = mapped_column(String(100))
    about: Mapped[str | None] = mapped_column(Text)
    best_known_for: Mapped[str | None] = mapped_column(String(200))
    favourite_song: Mapped[str | None] = mapped_column(String(200))
    photo_path: Mapped[str | None] = mapped_column(String(500))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), nullable=False, server_default=text("now()")
    )

    invite: Mapped[Invite] = orm_relationship()
