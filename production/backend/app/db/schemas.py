import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

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
    due_date: datetime | None = None
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
    pass


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
