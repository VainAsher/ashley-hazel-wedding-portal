from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.auth import require_coordinator
from app.api.schemas_auth import UserResponse
from app.db.database import get_db
from app.db.models import BudgetCategory, Vendor, Wedding
from app.db.schemas import VendorCreate, VendorResponse, VendorUpdate
from app.logging import get_logger


router = APIRouter(prefix="/api/vendors", tags=["vendors"])
logger = get_logger(__name__)


def serialize_vendor(vendor: Vendor) -> dict[str, object]:
    return {
        "id": vendor.id,
        "wedding_id": vendor.wedding_id,
        "vendor_name": vendor.vendor_name,
        "category_id": vendor.category_id,
        "category_name": vendor.category.category_name if vendor.category else None,
        "contact_person": vendor.contact_person,
        "email": vendor.email,
        "phone": vendor.phone,
        "website": vendor.website,
        "contract_signed": vendor.contract_signed,
        "notes": vendor.notes,
        "created_at": vendor.created_at,
    }


def get_vendor_or_404(db: Session, vendor_id: int, wedding_id: int, action: str) -> Vendor:
    vendor = db.get(Vendor, vendor_id)
    if vendor is None or vendor.wedding_id != wedding_id:
        logger.warning("vendor_not_found", extra={"action": action, "vendor_id": vendor_id})
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Vendor not found")
    return vendor


def ensure_category_exists(db: Session, category_id: int, action: str) -> None:
    if db.get(BudgetCategory, category_id) is None:
        logger.warning(
            "budget_category_not_found",
            extra={"action": action, "category_id": category_id},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Budget category not found",
        )


@router.get("", response_model=list[VendorResponse])
async def list_vendors(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> list[dict[str, object]]:
    vendors = (
        db.query(Vendor)
        .filter(Vendor.wedding_id == current_user.wedding_id)
        .order_by(Vendor.id)
        .all()
    )
    return [serialize_vendor(vendor) for vendor in vendors]


@router.post("", response_model=VendorResponse, status_code=status.HTTP_201_CREATED)
async def create_vendor(
    vendor: VendorCreate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> dict[str, object]:
    if vendor.wedding_id != current_user.wedding_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create vendors for other weddings",
        )
    if db.get(Wedding, vendor.wedding_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wedding not found",
        )
    ensure_category_exists(db, vendor.category_id, "create_vendor")

    db_vendor = Vendor(**vendor.model_dump())
    db.add(db_vendor)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning("vendor_create_rejected", extra={"wedding_id": vendor.wedding_id})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vendor could not be created",
        ) from exc

    db.refresh(db_vendor)
    logger.info("vendor_created", extra={"vendor_id": db_vendor.id})
    return serialize_vendor(db_vendor)


@router.put("/{vendor_id}", response_model=VendorResponse)
async def update_vendor(
    vendor_id: int,
    vendor: VendorUpdate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> dict[str, object]:
    db_vendor = get_vendor_or_404(db, vendor_id, current_user.wedding_id, "update_vendor")
    update_data = vendor.model_dump(exclude_unset=True)

    if "category_id" in update_data:
        ensure_category_exists(db, update_data["category_id"], "update_vendor")

    for field, value in update_data.items():
        setattr(db_vendor, field, value)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning("vendor_update_rejected", extra={"vendor_id": vendor_id})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vendor could not be updated",
        ) from exc

    db.refresh(db_vendor)
    logger.info("vendor_updated", extra={"vendor_id": vendor_id})
    return serialize_vendor(db_vendor)


@router.delete("/{vendor_id}")
async def delete_vendor(
    vendor_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> dict[str, int | str]:
    db_vendor = get_vendor_or_404(db, vendor_id, current_user.wedding_id, "delete_vendor")
    db.delete(db_vendor)
    db.commit()
    logger.info("vendor_deleted", extra={"vendor_id": vendor_id})
    return {"status": "deleted", "id": vendor_id}
