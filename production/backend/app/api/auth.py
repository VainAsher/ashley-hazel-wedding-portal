from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from app.api.schemas_auth import LoginRequest, LoginResponse, UserResponse
from app.db.database import get_db
from app.db.models import Guest, Invite
from app.logging import get_logger


router = APIRouter(prefix="/api/auth", tags=["auth"])
logger = get_logger(__name__)

SESSION_GUEST_ID = "guest_id"
SESSION_INVITE_ID = "invite_id"
SESSION_NAME = "name"
SESSION_ROLE = "role"
SESSION_USER_ID = "user_id"
SESSION_WEDDING_ID = "wedding_id"


def normalize_invite_code(invite_code: str) -> str:
    return invite_code.strip().upper()


def invite_to_user(invite: Invite) -> UserResponse:
    guest = invite.guest
    identity_id = guest.id if guest else invite.id
    name = guest.name if guest else invite.household_name
    if not name:
        name = f"{invite.role.title()} Invite"

    return UserResponse(
        id=identity_id,
        name=name,
        role=invite.role,
        wedding_id=invite.wedding_id,
        invite_id=invite.id,
        guest_id=guest.id if guest else None,
    )


def store_user_session(request: Request, user: UserResponse) -> None:
    request.session[SESSION_USER_ID] = user.id
    request.session[SESSION_INVITE_ID] = user.invite_id
    request.session[SESSION_GUEST_ID] = user.guest_id
    request.session[SESSION_WEDDING_ID] = user.wedding_id
    request.session[SESSION_ROLE] = user.role
    request.session[SESSION_NAME] = user.name


@router.post("/login", response_model=LoginResponse)
async def login(
    request_body: LoginRequest,
    request: Request,
    db: Session = Depends(get_db),
) -> LoginResponse:
    invite_code = normalize_invite_code(request_body.invite_code)
    invite = db.query(Invite).filter(Invite.code == invite_code).first()

    if invite is None:
        logger.warning("auth_login_invalid_invite")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid invite code",
        )

    user = invite_to_user(invite)
    store_user_session(request, user)
    logger.info(
        "auth_login_success",
        extra={
            "invite_id": invite.id,
            "guest_id": user.guest_id,
            "role": user.role,
            "wedding_id": user.wedding_id,
        },
    )
    return LoginResponse(user=user)


@router.post("/logout")
async def logout(request: Request) -> dict[str, str]:
    request.session.clear()
    logger.info("auth_logout_success")
    return {"message": "Logout successful"}


async def get_current_user(request: Request, db: Session = Depends(get_db)) -> UserResponse:
    invite_id = request.session.get(SESSION_INVITE_ID)
    if not invite_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    invite = db.get(Invite, invite_id)
    if invite is None:
        request.session.clear()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    guest_id = request.session.get(SESSION_GUEST_ID)
    if guest_id is not None and db.get(Guest, guest_id) is None:
        request.session.clear()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Not authenticated",
        )

    return invite_to_user(invite)


@router.get("/me", response_model=UserResponse)
async def me(current_user: UserResponse = Depends(get_current_user)) -> UserResponse:
    return current_user
