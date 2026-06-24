import re
from datetime import date, datetime, time
from decimal import Decimal

from pydantic import BaseModel, ConfigDict, Field, computed_field, field_validator

from app.db.models import RsvpStatus, TaskStatus, TaskPriority


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MEAL_CHOICES = {"chicken", "fish", "vegetarian"}


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
    meal_choice: str | None = Field(default=None, max_length=100)
    dietary_notes: str | None = Field(default=None, max_length=500)
    plus_one_name: str | None = Field(default=None, max_length=255)

    @field_validator("meal_choice")
    @classmethod
    def meal_choice_must_be_supported(cls, value: str | None) -> str | None:
        if value is None or value == "":
            return None
        meal_choice = value.strip().lower()
        if meal_choice not in MEAL_CHOICES:
            allowed = ", ".join(sorted(MEAL_CHOICES))
            raise ValueError(f"Meal choice must be one of: {allowed}")
        return meal_choice

    @field_validator("dietary_notes", "plus_one_name")
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
    due_date: datetime | None = None
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


class TaskResponse(TaskBase):
    id: int
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class InviteCreate(BaseModel):
    wedding_id: int = Field(gt=0)
    role: str = Field(min_length=1, max_length=20)
    guest_id: int | None = None
    household_name: str | None = Field(default=None, max_length=255)

    @field_validator("role")
    @classmethod
    def role_must_be_valid(cls, value: str) -> str:
        valid_roles = {"guest", "coordinator", "couple"}
        if value.lower() not in valid_roles:
            raise ValueError(f"Role must be one of {valid_roles}")
        return value.lower()


class InviteUpdate(BaseModel):
    guest_id: int | None = None
    household_name: str | None = None


class InviteResponse(BaseModel):
    id: int
    code: str
    wedding_id: int
    role: str
    guest_id: int | None
    household_name: str | None
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


class WeddingSettingsResponse(BaseModel):
    id: int
    couple_names: str
    wedding_date: date
    ceremony_time: time | None = None
    ceremony_location: str | None = None
    reception_location: str | None = None

    model_config = ConfigDict(from_attributes=True)


class WeddingSettingsUpdate(BaseModel):
    couple_names: str | None = Field(default=None, min_length=1, max_length=255)
    wedding_date: date | None = None
    ceremony_time: time | None = None
    ceremony_location: str | None = Field(default=None, max_length=255)
    reception_location: str | None = Field(default=None, max_length=255)

    @field_validator("couple_names")
    @classmethod
    def couple_names_must_not_be_blank(cls, value: str | None) -> str | None:
        if value is None:
            return None
        couple_names = value.strip()
        if not couple_names:
            raise ValueError("Couple names are required")
        return couple_names


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
COMMUNICATION_AUDIENCES = {"all", "attending", "pending", "declined"}
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
