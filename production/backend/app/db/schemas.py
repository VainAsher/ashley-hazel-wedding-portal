import re
from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.db.models import RsvpStatus


EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class GuestBase(BaseModel):
    wedding_id: int = Field(gt=0)
    name: str = Field(min_length=1, max_length=255)
    email: str | None = Field(default=None, max_length=255)
    phone: str | None = Field(default=None, max_length=20)
    relationship: str | None = Field(default=None, max_length=100)
    rsvp_status: RsvpStatus = RsvpStatus.pending
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


class GuestResponse(GuestBase):
    id: int
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = ConfigDict(from_attributes=True)
