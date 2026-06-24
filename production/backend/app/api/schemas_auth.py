from pydantic import BaseModel, ConfigDict, Field, field_validator


class LoginRequest(BaseModel):
    invite_code: str = Field(min_length=1, max_length=50)

    @field_validator("invite_code")
    @classmethod
    def invite_code_must_not_be_blank(cls, value: str) -> str:
        invite_code = value.strip()
        if not invite_code:
            raise ValueError("Invite code is required")
        return invite_code


class UserResponse(BaseModel):
    id: int
    name: str
    role: str
    wedding_id: int
    invite_id: int
    guest_id: int | None = None
    wedding_phase: str = "live"

    model_config = ConfigDict(from_attributes=True)


class LoginResponse(BaseModel):
    user: UserResponse
    message: str = "Login successful"
