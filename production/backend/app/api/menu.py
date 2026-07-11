from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.api.auth import require_coordinator, require_guest
from app.api.schemas_auth import UserResponse
from app.db.database import get_db
from app.db.models import MenuOption, Wedding
from app.db.schemas import (
    MenuOptionCreate,
    MenuOptionResponse,
    MenuOptionUpdate,
    PortalMenuResponse,
)
from app.logging import get_logger


router = APIRouter(prefix="/api/menu", tags=["menu"])
# Guest-facing menu lives under the portal namespace with the other
# authenticated guest reads; both routers are registered in main.py.
portal_router = APIRouter(prefix="/api/portal", tags=["portal"])
logger = get_logger(__name__)


def get_menu_option_or_404(db: Session, option_id: int, wedding_id: int) -> MenuOption:
    option = db.get(MenuOption, option_id)
    # Cross-wedding access is indistinguishable from "does not exist".
    if option is None or option.wedding_id != wedding_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Menu option not found"
        )
    return option


@router.get("", response_model=list[MenuOptionResponse])
async def list_menu_options(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> list[MenuOption]:
    """Coordinator view: every option, inactive (soft-deleted) ones included."""
    return (
        db.query(MenuOption)
        .filter(MenuOption.wedding_id == current_user.wedding_id)
        .order_by(MenuOption.id)
        .all()
    )


@router.post("", response_model=MenuOptionResponse, status_code=status.HTTP_201_CREATED)
async def create_menu_option(
    payload: MenuOptionCreate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> MenuOption:
    option = MenuOption(wedding_id=current_user.wedding_id, **payload.model_dump())
    db.add(option)
    db.commit()
    db.refresh(option)
    logger.info(
        "menu_option_created",
        extra={"menu_option_id": option.id, "wedding_id": option.wedding_id},
    )
    return option


@router.patch("/{option_id}", response_model=MenuOptionResponse)
async def update_menu_option(
    option_id: int,
    payload: MenuOptionUpdate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> MenuOption:
    option = get_menu_option_or_404(db, option_id, current_user.wedding_id)
    update_data = payload.model_dump(exclude_unset=True)

    for field, value in update_data.items():
        setattr(option, field, value)

    db.commit()
    db.refresh(option)
    logger.info(
        "menu_option_updated",
        extra={
            "menu_option_id": option.id,
            "updated_fields": sorted(update_data.keys()),
            "wedding_id": option.wedding_id,
        },
    )
    return option


@router.delete("/{option_id}")
async def delete_menu_option(
    option_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> dict[str, int | str]:
    """Soft-delete: flips active off so guests no longer see the option, while
    already-recorded meal choices keep pointing at a real name."""
    option = get_menu_option_or_404(db, option_id, current_user.wedding_id)
    option.active = False
    db.commit()
    logger.info(
        "menu_option_deleted",
        extra={"menu_option_id": option_id, "wedding_id": current_user.wedding_id},
    )
    return {"status": "deleted", "id": option_id}


@portal_router.get("/menu", response_model=PortalMenuResponse)
async def get_portal_menu(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> PortalMenuResponse:
    """Guest view: only active options, plus the meal_selection_open switch so
    the RSVP page knows whether to render the meal selects at all."""
    wedding = db.get(Wedding, current_user.wedding_id)
    if wedding is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Wedding not found"
        )
    options = (
        db.query(MenuOption)
        .filter(
            MenuOption.wedding_id == current_user.wedding_id,
            MenuOption.active.is_(True),
        )
        .order_by(MenuOption.id)
        .all()
    )
    return PortalMenuResponse(
        meal_selection_open=wedding.meal_selection_open,
        options=options,
    )
