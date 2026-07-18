import re
from datetime import date, datetime, time
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator, model_validator

from app.db.models import RsvpStatus, TaskStatus, TaskPriority, TaskContext


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class GuestBase(BaseModel):
    wedding_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=20)
    relationship: str | None = Field(default=None, max_length=100)
    rsvp_status: RsvpStatus = RsvpStatus.pending
    meal_choice: str | None = Field(default=None, max_length=100)
    dietary_notes: str | None = Field(default=None, max_length=500)
    dietary_restrictions: str | None = None
    plus_one_name: str | None = Field(default=None, max_length=255)
    plus_one_rsvp: RsvpStatus | None = None
    plus_one_dietary: str | None = None
    plus_one_meal_choice: str | None = Field(default=None, max_length=120)
    table_number: int | None = Field(default=None, ge=1)
    seat_number: int | None = Field(default=None, ge=1)
    notes: str | None = None

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        name = value.strip()
        if not name:
            raise ValueError("Guest name is required")
        return name

    @field_validator("email")
    @classmethod
    def email_must_look_valid(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        email = value.strip()
        if not EMAIL_PATTERN.fullmatch(email):
            raise ValueError("Email must be a valid address")
        return email


class GuestCreate(GuestBase):
    pass


class GuestUpdate(BaseModel):
    wedding_id: int | None = Field(default=None, gt=0)
    name: str | None = Field(default=None, min_length=1, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=20)
    relationship: str | None = Field(default=None, max_length=100)
    rsvp_status: RsvpStatus | None = None
    meal_choice: str | None = Field(default=None, max_length=100)
    dietary_notes: str | None = Field(default=None, max_length=500)
    dietary_restrictions: str | None = None
    plus_one_name: str | None = Field(default=None, max_length=255)
    plus_one_rsvp: RsvpStatus | None = None
    plus_one_dietary: str | None = None
    plus_one_meal_choice: str | None = Field(default=None, max_length=120)
    table_number: int | None = Field(default=None, ge=1)
    seat_number: int | None = Field(default=None, ge=1)
    notes: str | None = None

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        name = value.strip()
        if not name:
            raise ValueError("Guest name is required")
        return name

    @field_validator("email")
    @classmethod
    def email_must_look_valid(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        email = value.strip()
        if not EMAIL_PATTERN.fullmatch(email):
            raise ValueError("Email must be a valid address")
        return email


class GuestRSVPUpdate(BaseModel):
    rsvp_status: RsvpStatus | None = None
    # Meal fields are only accepted while the wedding's meal_selection_open
    # switch is on, and must name an active menu option — both enforced in the
    # RSVP endpoint (they need the DB), not here.
    meal_choice: str | None = Field(default=None, max_length=100)
    plus_one_meal_choice: str | None = Field(default=None, max_length=120)
    dietary_notes: str | None = Field(default=None, max_length=500)
    plus_one_name: str | None = Field(default=None, max_length=255)

    @field_validator("meal_choice", "plus_one_meal_choice", "dietary_notes", "plus_one_name")
    @classmethod
    def blank_optional_text_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class GuestResponse(GuestBase):
    id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)

class TaskBase(BaseModel):
    wedding_id: int = Field(gt=0)
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None
    status: TaskStatus = TaskStatus.not_started
    priority: TaskPriority = TaskPriority.medium
    # Which planning board this task belongs to. The admin Timeline always
    # sends 'wedding'; stag/hen boards are Wave 3 item 14 D2 (not mounted yet).
    context: TaskContext = TaskContext.wedding
    due_date: date | None = None
    assigned_to: int | None = None
    category: str | None = Field(default=None, max_length=100)

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str) -> str:
        title = value.strip()
        if not title:
            raise ValueError("Task title is required")
        return title


class TaskCreate(TaskBase):
    # Defaults to the authenticated user's wedding; clients need not send it.
    wedding_id: int | None = Field(default=None, gt=0)


class TaskUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None
    status: TaskStatus | None = None
    priority: TaskPriority | None = None
    context: TaskContext | None = None
    # date, not datetime — the edit form sends "YYYY-MM-DD" exactly like
    # TaskCreate; datetime here rejected every edit of a task with a due date.
    due_date: date | None = None
    assigned_to: int | None = None
    category: str | None = Field(default=None, max_length=100)

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        title = value.strip()
        if not title:
            raise ValueError("Task title is required")
        return title


class TaskMove(BaseModel):
    """Body for PATCH /api/tasks/{id}/move — drag a card to a column slot.

    `position` is the 0-based target index within the destination column
    (after the move). No fractional positions: the server resequences
    neighbours as a simple integer resequence, which is plenty at wedding
    scale. A position past the end of the column clamps to an append.
    """

    status: TaskStatus
    position: int = Field(ge=0)


class TaskResponse(TaskBase):
    id: int
    position: int | None = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


PARTY_VALUES = {"stag", "hen"}


def _validate_party_value(value: str | None) -> str | None:
    if value is None:
        return None
    party = value.strip().lower()
    if party not in PARTY_VALUES:
        allowed = ", ".join(sorted(PARTY_VALUES))
        raise ValueError(f"Party must be one of: {allowed}")
    return party


class InviteCreate(BaseModel):
    wedding_id: int = Field(gt=0)
    role: str = Field(min_length=1, max_length=20)
    guest_id: int | None = None
    household_name: str | None = Field(default=None, max_length=255)
    # Guest "wedding party" flags (Wave 3 item 14 D1). Only meaningful for
    # role='guest'; validated together below.
    party: str | None = None
    party_admin: bool = False
    party_title: str | None = Field(default=None, max_length=50)
    # Couple individual-identity fields. Only meaningful for role='couple'.
    partner_label: str | None = Field(default=None, max_length=50)
    associated_party: str | None = None

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, value: str) -> str:
        valid_roles = {"guest", "coordinator", "couple"}
        if value.lower() not in valid_roles:
            raise ValueError(f"Role must be one of {valid_roles}")
        return value.lower()

    @field_validator("party", "associated_party")
    @classmethod
    def party_must_be_valid(cls, value: str | None) -> str | None:
        return _validate_party_value(value)

    @field_validator("party_title", "partner_label")
    @classmethod
    def blank_optional_text_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @model_validator(mode="after")
    def party_fields_match_role(self) -> "InviteCreate":
        if self.role != "guest" and (self.party is not None or self.party_admin):
            raise ValueError("party/party_admin are only valid for guest invites")
        if self.role != "couple" and (
            self.partner_label is not None or self.associated_party is not None
        ):
            raise ValueError(
                "partner_label/associated_party are only valid for couple invites"
            )
        if self.party_admin and self.party is None:
            raise ValueError("party_admin requires a party")
        return self


class InviteUpdate(BaseModel):
    guest_id: int | None = None
    household_name: str | None = None
    # Guest "wedding party" flags (Wave 3 item 14 D1). Explicit null clears
    # the field (e.g. removing someone from a party).
    party: str | None = None
    party_admin: bool | None = None
    party_title: str | None = Field(default=None, max_length=50)
    # Couple individual-identity fields.
    partner_label: str | None = Field(default=None, max_length=50)
    associated_party: str | None = None

    @field_validator("party", "associated_party")
    @classmethod
    def party_must_be_valid(cls, value: str | None) -> str | None:
        return _validate_party_value(value)

    @field_validator("party_title", "partner_label")
    @classmethod
    def blank_optional_text_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class InviteResponse(BaseModel):
    id: int
    code: str
    wedding_id: int
    role: str
    guest_id: int | None
    household_name: str | None
    party: str | None = None
    party_admin: bool = False
    party_title: str | None = None
    partner_label: str | None = None
    associated_party: str | None = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Budget categories
# ---------------------------------------------------------------------------


class BudgetCategoryResponse(BaseModel):
    id: int
    category_name: str
    description: str | None = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Vendors
# ---------------------------------------------------------------------------


class VendorBase(BaseModel):
    wedding_id: int = Field(gt=0)
    vendor_name: str = Field(min_length=1, max_length=255)
    category_id: int = Field(gt=0)
    contact_person: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=20)
    website: str | None = Field(default=None, max_length=255)
    contract_signed: bool = False
    notes: str | None = None

    @field_validator("vendor_name")
    @classmethod
    def vendor_name_must_not_be_blank(cls, value: str) -> str:
        name = value.strip()
        if not name:
            raise ValueError("Vendor name is required")
        return name


class VendorCreate(VendorBase):
    # Defaults to the authenticated user's wedding; clients need not send it.
    wedding_id: int | None = Field(default=None, gt=0)


class VendorUpdate(BaseModel):
    vendor_name: str | None = Field(default=None, min_length=1, max_length=255)
    category_id: int | None = Field(default=None, gt=0)
    contact_person: str | None = Field(default=None, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=20)
    website: str | None = Field(default=None, max_length=255)
    contract_signed: bool | None = None
    notes: str | None = None

    @field_validator("vendor_name")
    @classmethod
    def vendor_name_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        name = value.strip()
        if not name:
            raise ValueError("Vendor name is required")
        return name


class VendorResponse(BaseModel):
    id: int
    wedding_id: int
    vendor_name: str
    category_id: int
    category_name: str | None = None
    contact_person: str | None = None
    email: str | None = None
    phone: str | None = None
    website: str | None = None
    contract_signed: bool
    notes: str | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Budget items
# ---------------------------------------------------------------------------


class BudgetItemBase(BaseModel):
    wedding_id: int = Field(gt=0)
    vendor_id: int | None = Field(default=None, gt=0)
    category_id: int = Field(gt=0)
    description: str = Field(min_length=1, max_length=255)
    estimated_cost: Decimal | None = None
    actual_cost: Decimal | None = None
    paid: bool = False
    payment_date: date | None = None
    notes: str | None = None

    @field_validator("description")
    @classmethod
    def description_must_not_be_blank(cls, value: str) -> str:
        description = value.strip()
        if not description:
            raise ValueError("Budget item description is required")
        return description


class BudgetItemCreate(BudgetItemBase):
    # Defaults to the authenticated user's wedding; clients need not send it.
    wedding_id: int | None = Field(default=None, gt=0)


class BudgetItemUpdate(BaseModel):
    vendor_id: int | None = Field(default=None, gt=0)
    category_id: int | None = Field(default=None, gt=0)
    description: str | None = Field(default=None, min_length=1, max_length=255)
    estimated_cost: Decimal | None = None
    actual_cost: Decimal | None = None
    paid: bool | None = None
    payment_date: date | None = None
    notes: str | None = None

    @field_validator("description")
    @classmethod
    def description_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        description = value.strip()
        if not description:
            raise ValueError("Budget item description is required")
        return description


class BudgetItemResponse(BaseModel):
    id: int
    wedding_id: int
    vendor_id: int | None = None
    vendor_name: str | None = None
    category_id: int
    category_name: str | None = None
    description: str
    # Serialized as JSON numbers (not Decimal strings) for the frontend.
    estimated_cost: float | None = None
    actual_cost: float | None = None
    paid: bool
    payment_date: date | None = None
    notes: str | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Wedding settings
# ---------------------------------------------------------------------------


WEDDING_PHASES = {"planning", "live", "event", "archived"}

HEX_COLOR_PATTERN = r"^#[0-9a-fA-F]{6}$"

# Curated typography allowlists — the single backend source of truth. The
# frontend mirrors these in src/lib/theme.ts (THEME_DISPLAY_FONTS /
# THEME_BODY_FONTS); keep both lists in sync. First entry is the default.
THEME_DISPLAY_FONTS = (
    "Georgia",
    "Playfair Display",
    "Cormorant Garamond",
    "EB Garamond",
    "Libre Baskerville",
    "Lora",
    "Marcellus",
    "Great Vibes",
)
THEME_BODY_FONTS = (
    "Inter",
    "Source Sans 3",
    "Nunito Sans",
    "Karla",
    "Mulish",
)
THEME_TYPE_SCALES = (0.9, 1.0, 1.1)

# Wave 4 item 17 Phase 1 (docs/specs/VIEWPORT_PAGING_PHASE1.md): guest-site
# navigation pattern for Dashboard/RSVP/Schedule/Blessings. 'paged' is the
# approved default (couple signed off on the Phase 0 spike); 'scroll' is the
# route-level fallback the couple can flip back to with no redeploy.
THEME_LAYOUT_MODES = ("paged", "scroll")

# ROADMAP item 18 (docs/specs/PAGE_BACKGROUNDS.md): per-page background photo
# + focal point/zoom, couple-set in admin Settings. Mirrors
# production/frontend/public/backgrounds/*.jpg — keep both allowlists in
# sync, same convention as THEME_DISPLAY_FONTS/THEME_BODY_FONTS above.
STOCK_BACKGROUND_FILES = (
    "bg-01-winter-selfie.jpg",
    "bg-02-registry-office.jpg",
    "bg-03-waterfall.jpg",
    "bg-04-woodland-walk.jpg",
    "bg-05-evening-sky.jpg",
    "bg-06-registry-candid.jpg",
)
PAGE_BACKGROUND_SOURCES = ("stock", "gallery", "upload")
# Maps onto real guest routes /dashboard, /rsvp, /schedule, /celebrate,
# /wedding-party, plus the pre-login invite/landing page. Stag/Hen stay on
# their fixed backgrounds for now -- explicitly out of scope for v1.
PAGE_BACKGROUND_KEYS = (
    "dashboard",
    "rsvp",
    "schedule",
    "celebrate",
    "wedding_party",
    "invite",
)


class PageBackground(BaseModel):
    """One guest/landing page's background photo + focal point + zoom.

    focal_x/focal_y: 0-100, the CSS background-position percentage the
        couple chose by dragging the crosshair in Settings.
    zoom: 1.0 (natural cover-fit crop) up to 2.5x, anchored at the focal
        point (see GuestLayout.tsx's transform/transform-origin split).
    """

    source: str = Field(default="stock")
    url: str = Field(..., min_length=1, max_length=500)
    focal_x: float = Field(default=50.0, ge=0, le=100)
    focal_y: float = Field(default=50.0, ge=0, le=100)
    zoom: float = Field(default=1.0, ge=1.0, le=2.5)

    @field_validator("source")
    @classmethod
    def source_must_be_allowlisted(cls, value: str) -> str:
        if value not in PAGE_BACKGROUND_SOURCES:
            raise ValueError(
                "Background source must be one of: " + ", ".join(PAGE_BACKGROUND_SOURCES)
            )
        return value

    @model_validator(mode="after")
    def url_must_match_source(self) -> "PageBackground":
        if self.source == "stock":
            allowed = {f"/backgrounds/{name}" for name in STOCK_BACKGROUND_FILES}
            if self.url not in allowed:
                raise ValueError("Stock background must be one of the shipped files")
        elif not self.url.startswith("/uploads/"):
            raise ValueError("Gallery/upload backgrounds must reference an uploaded file")
        return self


class WeddingTheme(BaseModel):
    """Guest-site theme dials set by the couple in admin Settings.

    primary: accent/button colour (prototype sun gold)
    secondary: deep contrast colour used for text on primary and the
        photo-background tint (prototype deep plum)
    tint_opacity: strength of the tint over background photos
    display_font: headings typeface (allowlisted; prototype Georgia serif)
    body_font: running-text typeface (allowlisted; prototype Inter/system)
    type_scale: root font-size multiplier — 0.9 (cosy) / 1.0 / 1.1 (roomy)
    layout_mode: 'paged' (viewport-fit swipeable deck, the default) or
        'scroll' (today's normal scrolling pages) for
        Dashboard/RSVP/Schedule/Blessings
    page_backgrounds: per-page background photo + focal point/zoom, keyed by
        PAGE_BACKGROUND_KEYS. A key's absence means "not customized" -- the
        frontend falls back to today's stock photo for that page.
    """

    primary: str = Field(default="#f6c445", pattern=HEX_COLOR_PATTERN)
    secondary: str = Field(default="#2b064d", pattern=HEX_COLOR_PATTERN)
    tint_opacity: float = Field(default=0.9, ge=0.3, le=1.0)
    display_font: str = THEME_DISPLAY_FONTS[0]
    body_font: str = THEME_BODY_FONTS[0]
    type_scale: float = 1.0
    layout_mode: str = THEME_LAYOUT_MODES[0]
    page_backgrounds: dict[str, PageBackground] = Field(default_factory=dict)

    @field_validator("display_font")
    @classmethod
    def display_font_must_be_allowlisted(cls, value: str) -> str:
        if value not in THEME_DISPLAY_FONTS:
            raise ValueError(
                "Headings font must be one of: " + ", ".join(THEME_DISPLAY_FONTS)
            )
        return value

    @field_validator("body_font")
    @classmethod
    def body_font_must_be_allowlisted(cls, value: str) -> str:
        if value not in THEME_BODY_FONTS:
            raise ValueError("Text font must be one of: " + ", ".join(THEME_BODY_FONTS))
        return value

    @field_validator("type_scale")
    @classmethod
    def type_scale_must_be_allowlisted(cls, value: float) -> float:
        if value not in THEME_TYPE_SCALES:
            raise ValueError(
                "Type scale must be one of: "
                + ", ".join(str(scale) for scale in THEME_TYPE_SCALES)
            )
        return value

    @field_validator("layout_mode")
    @classmethod
    def layout_mode_must_be_allowlisted(cls, value: str) -> str:
        if value not in THEME_LAYOUT_MODES:
            raise ValueError(
                "Layout mode must be one of: " + ", ".join(THEME_LAYOUT_MODES)
            )
        return value

    @field_validator("page_backgrounds")
    @classmethod
    def page_backgrounds_keys_must_be_allowlisted(
        cls, value: dict[str, PageBackground]
    ) -> dict[str, PageBackground]:
        unknown = set(value) - set(PAGE_BACKGROUND_KEYS)
        if unknown:
            raise ValueError(
                "Unknown page background key(s): " + ", ".join(sorted(unknown))
            )
        return value


PARTY_VISIBILITY_MODES = {"partner_visible", "locked"}


class WeddingSettingsResponse(BaseModel):
    id: int
    couple_names: str
    wedding_date: date
    ceremony_time: time | None = None
    ceremony_location: str | None = None
    reception_location: str | None = None
    phase: str
    theme: WeddingTheme | None = None
    meal_selection_open: bool = False
    # Cross-grant default for the non-subject partner's access to their
    # partner's stag/hen party (Wave 3 item 14 D1 "Party visibility" dial).
    party_visibility_mode: str = "partner_visible"

    model_config = ConfigDict(from_attributes=True)


class WeddingSettingsUpdate(BaseModel):
    couple_names: str | None = Field(default=None, min_length=1, max_length=255)
    wedding_date: date | None = None
    ceremony_time: time | None = None
    ceremony_location: str | None = Field(default=None, max_length=255)
    reception_location: str | None = Field(default=None, max_length=255)
    phase: str | None = None
    # Explicit null resets the guest site to the built-in defaults.
    theme: WeddingTheme | None = None
    # Menu builder switch: opens guest meal selection in RSVP.
    meal_selection_open: bool | None = None
    party_visibility_mode: str | None = None

    @field_validator("couple_names")
    @classmethod
    def couple_names_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        couple_names = value.strip()
        if not couple_names:
            raise ValueError("Couple names are required")
        return couple_names

    @field_validator("phase")
    @classmethod
    def phase_must_be_valid(cls, value: str | None) -> str | None:
        if value is None:
            return None
        phase = value.strip().lower()
        if phase not in WEDDING_PHASES:
            allowed = ", ".join(sorted(WEDDING_PHASES))
            raise ValueError(f"Phase must be one of: {allowed}")
        return phase

    @field_validator("party_visibility_mode")
    @classmethod
    def party_visibility_mode_must_be_valid(cls, value: str | None) -> str | None:
        if value is None:
            return None
        mode = value.strip().lower()
        if mode not in PARTY_VISIBILITY_MODES:
            allowed = ", ".join(sorted(PARTY_VISIBILITY_MODES))
            raise ValueError(f"Party visibility mode must be one of: {allowed}")
        return mode


class BudgetCategorySummary(BaseModel):
    category_id: int
    category_name: str
    estimated: float
    actual: float
    paid: float


class BudgetSummaryResponse(BaseModel):
    total_estimated: float
    total_actual: float
    total_paid: float
    remaining: float
    by_category: list[BudgetCategorySummary]


# ---------------------------------------------------------------------------
# Events
# ---------------------------------------------------------------------------


class EventBase(BaseModel):
    wedding_id: int = Field(gt=0)
    event_name: str = Field(min_length=1, max_length=255)
    event_date: date
    event_time: time | None = None
    location: str | None = Field(default=None, max_length=255)
    description: str | None = None

    @field_validator("event_name")
    @classmethod
    def event_name_must_not_be_blank(cls, value: str) -> str:
        name = value.strip()
        if not name:
            raise ValueError("Event name is required")
        return name


class EventCreate(EventBase):
    # Defaults to the authenticated user's wedding; clients need not send it.
    wedding_id: int | None = Field(default=None, gt=0)


class EventUpdate(BaseModel):
    event_name: str | None = Field(default=None, min_length=1, max_length=255)
    event_date: date | None = None
    event_time: time | None = None
    location: str | None = Field(default=None, max_length=255)
    description: str | None = None

    @field_validator("event_name")
    @classmethod
    def event_name_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        name = value.strip()
        if not name:
            raise ValueError("Event name is required")
        return name


class EventResponse(BaseModel):
    id: int
    wedding_id: int
    event_name: str
    event_date: date
    event_time: time | None = None
    location: str | None = None
    description: str | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Communications
# ---------------------------------------------------------------------------


COMMUNICATION_CHANNELS = {"email", "whatsapp", "sms", "announcement"}
# Member-group audiences (guests/coordinators match invite roles today;
# wedding_party/stags/hens ship ahead of the Wave 3 party flags and match no
# invites yet) plus the original RSVP-based audiences.
COMMUNICATION_AUDIENCES = {
    "all",
    "attending",
    "pending",
    "declined",
    "guests",
    "coordinators",
    "wedding_party",
    "stags",
    "hens",
}
COMMUNICATION_STATUSES = {"draft", "scheduled", "sent"}


class CommunicationBase(BaseModel):
    wedding_id: int = Field(gt=0)
    subject: str = Field(min_length=1, max_length=255)
    body: str | None = None
    channel: str = Field(default="email", max_length=50)
    audience: str = Field(default="all", max_length=50)
    status: str = Field(default="draft", max_length=50)
    scheduled_for: datetime | None = None

    @field_validator("subject")
    @classmethod
    def subject_must_not_be_blank(cls, value: str) -> str:
        subject = value.strip()
        if not subject:
            raise ValueError("Communication subject is required")
        return subject

    @field_validator("channel")
    @classmethod
    def channel_must_be_valid(cls, value: str) -> str:
        channel = value.strip().lower()
        if channel not in COMMUNICATION_CHANNELS:
            allowed = ", ".join(sorted(COMMUNICATION_CHANNELS))
            raise ValueError(f"Channel must be one of: {allowed}")
        return channel

    @field_validator("audience")
    @classmethod
    def audience_must_be_valid(cls, value: str) -> str:
        audience = value.strip().lower()
        if audience not in COMMUNICATION_AUDIENCES:
            allowed = ", ".join(sorted(COMMUNICATION_AUDIENCES))
            raise ValueError(f"Audience must be one of: {allowed}")
        return audience

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, value: str) -> str:
        status_value = value.strip().lower()
        if status_value not in COMMUNICATION_STATUSES:
            allowed = ", ".join(sorted(COMMUNICATION_STATUSES))
            raise ValueError(f"Status must be one of: {allowed}")
        return status_value


class CommunicationCreate(CommunicationBase):
    # Defaults to the authenticated user's wedding; clients need not send it.
    wedding_id: int | None = Field(default=None, gt=0)


class CommunicationUpdate(BaseModel):
    subject: str | None = Field(default=None, min_length=1, max_length=255)
    body: str | None = None
    channel: str | None = Field(default=None, max_length=50)
    audience: str | None = Field(default=None, max_length=50)
    status: str | None = Field(default=None, max_length=50)
    scheduled_for: datetime | None = None

    @field_validator("subject")
    @classmethod
    def subject_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        subject = value.strip()
        if not subject:
            raise ValueError("Communication subject is required")
        return subject

    @field_validator("channel")
    @classmethod
    def channel_must_be_valid(cls, value: str | None) -> str | None:
        if value is None:
            return None
        channel = value.strip().lower()
        if channel not in COMMUNICATION_CHANNELS:
            allowed = ", ".join(sorted(COMMUNICATION_CHANNELS))
            raise ValueError(f"Channel must be one of: {allowed}")
        return channel

    @field_validator("audience")
    @classmethod
    def audience_must_be_valid(cls, value: str | None) -> str | None:
        if value is None:
            return None
        audience = value.strip().lower()
        if audience not in COMMUNICATION_AUDIENCES:
            allowed = ", ".join(sorted(COMMUNICATION_AUDIENCES))
            raise ValueError(f"Audience must be one of: {allowed}")
        return audience

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, value: str | None) -> str | None:
        if value is None:
            return None
        status_value = value.strip().lower()
        if status_value not in COMMUNICATION_STATUSES:
            allowed = ", ".join(sorted(COMMUNICATION_STATUSES))
            raise ValueError(f"Status must be one of: {allowed}")
        return status_value


class CommunicationResponse(BaseModel):
    id: int
    wedding_id: int
    subject: str
    body: str | None = None
    channel: str
    audience: str
    status: str
    scheduled_for: datetime | None = None
    sent_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Gallery
# ---------------------------------------------------------------------------


GALLERY_STATUSES = {"pending", "approved", "rejected"}


class GalleryItemUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    caption: str | None = None
    status: str | None = Field(default=None, max_length=50)

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, value: str | None) -> str | None:
        if value is None:
            return None
        status_value = value.strip().lower()
        if status_value not in GALLERY_STATUSES:
            allowed = ", ".join(sorted(GALLERY_STATUSES))
            raise ValueError(f"Status must be one of: {allowed}")
        return status_value


class GalleryItemResponse(BaseModel):
    id: int
    wedding_id: int
    title: str | None = None
    caption: str | None = None
    file_path: str
    thumb_path: str | None = None
    content_type: str | None = None
    file_size: int | None = None
    uploaded_by: str | None = None
    status: str
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def url(self) -> str:
        return f"/uploads/{self.file_path}"

    @computed_field  # type: ignore[prop-decorator]
    @property
    def thumb_url(self) -> str | None:
        return f"/uploads/{self.thumb_path}" if self.thumb_path else None


# ---------------------------------------------------------------------------
# Blessings (guest well-wishes / guestbook)
# ---------------------------------------------------------------------------


class BlessingCreate(BaseModel):
    # Author defaults to the authenticated guest's name when omitted/blank.
    author_name: str | None = Field(default=None, max_length=255)
    message: str = Field(min_length=1)

    @field_validator("message")
    @classmethod
    def message_must_not_be_blank(cls, value: str) -> str:
        message = value.strip()
        if not message:
            raise ValueError("Blessing message is required")
        return message

    @field_validator("author_name")
    @classmethod
    def author_name_blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        author_name = value.strip()
        return author_name or None


class BlessingResponse(BaseModel):
    id: int
    author_name: str
    message: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BlessingAdminResponse(BaseModel):
    id: int
    author_name: str
    message: str
    hidden: bool
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


class BlessingModerate(BaseModel):
    hidden: bool


# ---------------------------------------------------------------------------
# Music (Dancefloor song requests)
# ---------------------------------------------------------------------------


SONG_REQUEST_STATUSES = {"pending", "approved", "rejected", "blocked"}


class SongRequestCreate(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    artist: str | None = Field(default=None, max_length=255)
    source_url: str | None = Field(default=None, max_length=500)
    dedication: str | None = Field(default=None, max_length=500)

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str) -> str:
        title = value.strip()
        if not title:
            raise ValueError("Song title is required")
        return title

    @field_validator("artist", "source_url", "dedication")
    @classmethod
    def blank_optional_text_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class SongRequestUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    artist: str | None = Field(default=None, max_length=255)
    dedication: str | None = Field(default=None, max_length=500)
    status: str | None = Field(default=None, max_length=20)
    pinned: bool | None = None
    position: int | None = None
    # Explicit null clears a mismatched jukebox preview.
    preview_url: str | None = Field(default=None, max_length=500)

    @field_validator("title")
    @classmethod
    def title_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        title = value.strip()
        if not title:
            raise ValueError("Song title is required")
        return title

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, value: str | None) -> str | None:
        if value is None:
            return None
        status_value = value.strip().lower()
        if status_value not in SONG_REQUEST_STATUSES:
            allowed = ", ".join(sorted(SONG_REQUEST_STATUSES))
            raise ValueError(f"Status must be one of: {allowed}")
        return status_value


class SongRequestMerge(BaseModel):
    duplicate_ids: list[int] = Field(min_length=1)


class SongRequestResponse(BaseModel):
    id: int
    wedding_id: int
    title: str
    artist: str | None = None
    source_url: str | None = None
    dedication: str | None = None
    requested_by: str
    status: str
    pinned: bool
    position: int | None = None
    resolved_title: str | None = None
    resolved_artist: str | None = None
    artwork_url: str | None = None
    spotify_track_id: str | None = None
    preview_url: str | None = None
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class SongWallItem(SongRequestResponse):
    """A wall song plus its reaction state for the requesting member."""

    reaction_count: int = 0
    reacted_by_me: bool = False


class SongWallResponse(BaseModel):
    """Dancefloor wall payload: the songs plus the couple's now-playing pick."""

    songs: list[SongWallItem]
    now_playing: SongWallItem | None = None


class AdminSongRequestResponse(SongRequestResponse):
    """Admin moderation row — reaction count included as a curation signal."""

    reaction_count: int = 0


class SongReactionState(BaseModel):
    reaction_count: int
    reacted_by_me: bool


class NowPlayingUpdate(BaseModel):
    """PUT /api/music/now-playing body; null clears the pick."""

    song_request_id: int | None


class NowPlayingResponse(BaseModel):
    now_playing: SongWallItem | None = None


# ---------------------------------------------------------------------------
# Guest portal (read-only wedding info for guests)
# ---------------------------------------------------------------------------


class WeddingInfoResponse(BaseModel):
    couple_names: str
    wedding_date: date
    ceremony_time: time | None = None
    ceremony_location: str | None = None
    reception_location: str | None = None
    phase: str

    model_config = ConfigDict(from_attributes=True)


class ScheduleEventResponse(BaseModel):
    id: int
    event_name: str
    event_date: date
    event_time: time | None = None
    location: str | None = None
    description: str | None = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Menu builder (coordinator CRUD + guest-facing portal menu)
# ---------------------------------------------------------------------------


MENU_COURSES = {"starter", "main", "dessert"}


def _validate_course(value: str | None) -> str | None:
    if value is None or value == "":
        return None
    course = value.strip().lower()
    if course not in MENU_COURSES:
        allowed = ", ".join(sorted(MENU_COURSES))
        raise ValueError(f"Course must be one of: {allowed}")
    return course


class MenuOptionCreate(BaseModel):
    # Name is capped at 100 (not the column's 120) so a chosen option always
    # fits guests.meal_choice VARCHAR(100).
    name: str = Field(min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    course: str | None = Field(default=None, max_length=20)
    is_vegetarian: bool = False
    is_vegan: bool = False
    is_gluten_free: bool = False
    active: bool = True

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str) -> str:
        name = value.strip()
        if not name:
            raise ValueError("Menu option name is required")
        return name

    @field_validator("description")
    @classmethod
    def blank_description_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator("course")
    @classmethod
    def course_must_be_valid(cls, value: str | None) -> str | None:
        return _validate_course(value)


class MenuOptionUpdate(BaseModel):
    name: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=2000)
    course: str | None = Field(default=None, max_length=20)
    is_vegetarian: bool | None = None
    is_vegan: bool | None = None
    is_gluten_free: bool | None = None
    active: bool | None = None

    @field_validator("name")
    @classmethod
    def name_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        name = value.strip()
        if not name:
            raise ValueError("Menu option name is required")
        return name

    @field_validator("description")
    @classmethod
    def blank_description_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None

    @field_validator("course")
    @classmethod
    def course_must_be_valid(cls, value: str | None) -> str | None:
        return _validate_course(value)


class MenuOptionResponse(BaseModel):
    id: int
    wedding_id: int
    name: str
    description: str | None = None
    course: str | None = None
    is_vegetarian: bool
    is_vegan: bool
    is_gluten_free: bool
    active: bool
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class PortalMenuOption(BaseModel):
    id: int
    name: str
    description: str | None = None
    course: str | None = None
    is_vegetarian: bool
    is_vegan: bool
    is_gluten_free: bool

    model_config = ConfigDict(from_attributes=True)


class PortalMenuResponse(BaseModel):
    # The RSVP page needs both together: the switch decides whether the meal
    # selects render at all, and the options populate them.
    meal_selection_open: bool
    options: list[PortalMenuOption]


# ---------------------------------------------------------------------------
# Feedback (in-site bug/idea reports)
# ---------------------------------------------------------------------------


FEEDBACK_TYPES = {"bug", "idea"}
FEEDBACK_STATUSES = {"new", "triaged", "done"}


class FeedbackCreate(BaseModel):
    type: str = Field(max_length=10)
    message: str = Field(min_length=1, max_length=2000)
    # Auto-captured context from the widget; all optional and display-only.
    page: str | None = Field(default=None, max_length=200)
    role: str | None = Field(default=None, max_length=30)
    viewport: str | None = Field(default=None, max_length=30)

    @field_validator("type")
    @classmethod
    def type_must_be_valid(cls, value: str) -> str:
        feedback_type = value.strip().lower()
        if feedback_type not in FEEDBACK_TYPES:
            allowed = ", ".join(sorted(FEEDBACK_TYPES))
            raise ValueError(f"Type must be one of: {allowed}")
        return feedback_type

    @field_validator("message")
    @classmethod
    def message_must_not_be_blank(cls, value: str) -> str:
        message = value.strip()
        if not message:
            raise ValueError("Feedback message is required")
        return message

    @field_validator("page", "role", "viewport")
    @classmethod
    def blank_optional_text_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class FeedbackUpdate(BaseModel):
    status: str = Field(max_length=20)

    @field_validator("status")
    @classmethod
    def status_must_be_valid(cls, value: str) -> str:
        status_value = value.strip().lower()
        if status_value not in FEEDBACK_STATUSES:
            allowed = ", ".join(sorted(FEEDBACK_STATUSES))
            raise ValueError(f"Status must be one of: {allowed}")
        return status_value


class FeedbackResponse(BaseModel):
    id: int
    wedding_id: int
    submitted_by: str
    type: str
    message: str
    page: str | None = None
    role: str | None = None
    viewport: str | None = None
    status: str
    created_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


# ---------------------------------------------------------------------------
# Notifications
# ---------------------------------------------------------------------------


NOTIFICATION_KINDS = {"communication", "mention", "system"}


class NotificationResponse(BaseModel):
    id: int
    wedding_id: int
    kind: str
    title: str
    body: str | None = None
    link_path: str | None = None
    created_at: datetime | None = None
    read_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)


class NotificationListResponse(BaseModel):
    """Wrapper so the bell gets its unread badge in the same round trip."""

    items: list[NotificationResponse]
    unread_count: int


# ---------------------------------------------------------------------------
# Stag & Hen party portals (Wave 3 item 14 D1) — see
# docs/specs/PARTY_PORTALS_D1.md. Access is enforced by
# app/api/party.py::has_party_access; these are the request/response shapes.
# ---------------------------------------------------------------------------


class PartyAccessResponse(BaseModel):
    """Nav-hint booleans only — every content endpoint independently
    re-checks the access rule; never trust this for authorization."""

    stag: bool
    hen: bool


class PartyMemberResponse(BaseModel):
    invite_id: int
    name: str
    party_admin: bool
    party_title: str | None = None


class PartyInfoResponse(BaseModel):
    details: str | None = None
    updated_at: datetime | None = None


class PartyInfoUpdate(BaseModel):
    details: str | None = None

    @field_validator("details")
    @classmethod
    def blank_details_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class PartyMessageCreate(BaseModel):
    message: str = Field(min_length=1)

    @field_validator("message")
    @classmethod
    def message_must_not_be_blank(cls, value: str) -> str:
        message = value.strip()
        if not message:
            raise ValueError("Message is required")
        return message


class PartyMessageModerate(BaseModel):
    """PATCH body — either field may be sent alone (e.g. pin without
    touching hidden, or vice versa)."""

    hidden: bool | None = None
    pinned: bool | None = None


class PartyMessageResponse(BaseModel):
    id: int
    author_name: str
    author_invite_id: int
    message: str
    hidden: bool
    pinned: bool
    created_at: datetime


class PartyRevealBanner(BaseModel):
    """Present only when the viewer is the non-subject couple member for
    this party — everything the reveal banner + toggle needs to render."""

    subject_invite_id: int
    subject_name: str
    revealed: bool


class PartySummaryResponse(BaseModel):
    party: str
    is_party_admin: bool
    info: PartyInfoResponse
    members: list[PartyMemberResponse]
    messages: list[PartyMessageResponse]
    reveal_banner: PartyRevealBanner | None = None


class PartyRevealUpdate(BaseModel):
    invite_id: int = Field(gt=0)
    revealed: bool


class PartyRevealResponse(BaseModel):
    party: str
    invite_id: int
    revealed: bool


# ---------------------------------------------------------------------------
# Wedding-party mini profiles (Wave 3 item 15)
# ---------------------------------------------------------------------------

ABOUT_MAX_LENGTH = 1000


class MemberProfileUpdate(BaseModel):
    """PUT /api/profiles/me body. Field length caps mirror the columns;
    `about` is bounded server-side even though the column is TEXT."""

    display_name: str | None = Field(default=None, max_length=100)
    role_title: str | None = Field(default=None, max_length=100)
    about: str | None = Field(default=None, max_length=ABOUT_MAX_LENGTH)
    best_known_for: str | None = Field(default=None, max_length=200)
    favourite_song: str | None = Field(default=None, max_length=200)

    @field_validator("display_name", "role_title", "about", "best_known_for", "favourite_song")
    @classmethod
    def blank_to_none(cls, value: str | None) -> str | None:
        if value is None:
            return None
        stripped = value.strip()
        return stripped or None


class MemberProfileResponse(BaseModel):
    """GET/PUT /api/profiles/me response — the caller's own profile, whether
    or not they've saved one yet (an unsaved-but-eligible profile is all
    None fields, not a 404; 404 is reserved for ineligible invites)."""

    invite_id: int
    display_name: str | None = None
    role_title: str | None = None
    about: str | None = None
    best_known_for: str | None = None
    favourite_song: str | None = None
    photo_path: str | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)

    @computed_field  # type: ignore[prop-decorator]
    @property
    def photo_url(self) -> str | None:
        return f"/uploads/{self.photo_path}" if self.photo_path else None


class MentionDirectoryEntry(BaseModel):
    """One entry in `GET /api/mentions/directory` -- the composer's
    autocomplete source. See docs/specs/MENTIONS.md's scoping rule."""

    invite_id: int
    display_name: str


class ProfileDirectoryEntry(BaseModel):
    """One card on the public 'Meet the wedding party' directory. Members
    who haven't filled in a profile yet still appear here, falling back to
    their guest name and party title so the page isn't full of gaps."""

    invite_id: int
    party: str
    display_name: str
    role_title: str | None = None
    about: str | None = None
    best_known_for: str | None = None
    favourite_song: str | None = None
    photo_path: str | None = None
    has_profile: bool

    @computed_field  # type: ignore[prop-decorator]
    @property
    def photo_url(self) -> str | None:
        return f"/uploads/{self.photo_path}" if self.photo_path else None
