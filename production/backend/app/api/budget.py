from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.auth import require_coordinator
from app.api.schemas_auth import UserResponse
from app.db.database import get_db
from app.db.models import BudgetCategory, BudgetItem, Vendor, Wedding
from app.db.schemas import (
    BudgetCategoryResponse,
    BudgetCategorySummary,
    BudgetItemCreate,
    BudgetItemResponse,
    BudgetItemUpdate,
    BudgetSummaryResponse,
)
from app.logging import get_logger


router = APIRouter(prefix="/api/budget", tags=["budget"])
logger = get_logger(__name__)


ZERO = Decimal("0")


def serialize_item(item: BudgetItem) -> dict[str, object]:
    return {
        "id": item.id,
        "wedding_id": item.wedding_id,
        "vendor_id": item.vendor_id,
        "vendor_name": item.vendor.vendor_name if item.vendor else None,
        "category_id": item.category_id,
        "category_name": item.category.category_name if item.category else None,
        "description": item.description,
        "estimated_cost": item.estimated_cost,
        "actual_cost": item.actual_cost,
        "paid": item.paid,
        "payment_date": item.payment_date,
        "notes": item.notes,
        "created_at": item.created_at,
    }


def get_item_or_404(db: Session, item_id: int, wedding_id: int, action: str) -> BudgetItem:
    item = db.get(BudgetItem, item_id)
    if item is None or item.wedding_id != wedding_id:
        logger.warning("budget_item_not_found", extra={"action": action, "item_id": item_id})
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Budget item not found"
        )
    return item


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


def ensure_vendor_in_wedding(
    db: Session, vendor_id: int, wedding_id: int, action: str
) -> None:
    vendor = db.get(Vendor, vendor_id)
    if vendor is None or vendor.wedding_id != wedding_id:
        logger.warning(
            "budget_vendor_not_found",
            extra={"action": action, "vendor_id": vendor_id},
        )
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Vendor not found",
        )


@router.get("/categories", response_model=list[BudgetCategoryResponse])
async def list_categories(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> list[BudgetCategory]:
    return db.query(BudgetCategory).order_by(BudgetCategory.id).all()


@router.get("/items", response_model=list[BudgetItemResponse])
async def list_items(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> list[dict[str, object]]:
    items = (
        db.query(BudgetItem)
        .filter(BudgetItem.wedding_id == current_user.wedding_id)
        .order_by(BudgetItem.id)
        .all()
    )
    return [serialize_item(item) for item in items]


@router.post("/items", response_model=BudgetItemResponse, status_code=status.HTTP_201_CREATED)
async def create_item(
    item: BudgetItemCreate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> dict[str, object]:
    if item.wedding_id is None:
        item.wedding_id = current_user.wedding_id
    elif item.wedding_id != current_user.wedding_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create budget items for other weddings",
        )
    if db.get(Wedding, item.wedding_id) is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Wedding not found",
        )
    ensure_category_exists(db, item.category_id, "create_item")
    if item.vendor_id is not None:
        ensure_vendor_in_wedding(db, item.vendor_id, item.wedding_id, "create_item")

    db_item = BudgetItem(**item.model_dump())
    db.add(db_item)
    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning("budget_item_create_rejected", extra={"wedding_id": item.wedding_id})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Budget item could not be created",
        ) from exc

    db.refresh(db_item)
    logger.info("budget_item_created", extra={"item_id": db_item.id})
    return serialize_item(db_item)


@router.put("/items/{item_id}", response_model=BudgetItemResponse)
async def update_item(
    item_id: int,
    item: BudgetItemUpdate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> dict[str, object]:
    db_item = get_item_or_404(db, item_id, current_user.wedding_id, "update_item")
    update_data = item.model_dump(exclude_unset=True)

    if "category_id" in update_data:
        ensure_category_exists(db, update_data["category_id"], "update_item")
    if update_data.get("vendor_id") is not None:
        ensure_vendor_in_wedding(
            db, update_data["vendor_id"], current_user.wedding_id, "update_item"
        )

    for field, value in update_data.items():
        setattr(db_item, field, value)

    try:
        db.commit()
    except IntegrityError as exc:
        db.rollback()
        logger.warning("budget_item_update_rejected", extra={"item_id": item_id})
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Budget item could not be updated",
        ) from exc

    db.refresh(db_item)
    logger.info("budget_item_updated", extra={"item_id": item_id})
    return serialize_item(db_item)


@router.delete("/items/{item_id}")
async def delete_item(
    item_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> dict[str, int | str]:
    db_item = get_item_or_404(db, item_id, current_user.wedding_id, "delete_item")
    db.delete(db_item)
    db.commit()
    logger.info("budget_item_deleted", extra={"item_id": item_id})
    return {"status": "deleted", "id": item_id}


@router.get("/summary", response_model=BudgetSummaryResponse)
async def budget_summary(
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> BudgetSummaryResponse:
    items = (
        db.query(BudgetItem)
        .filter(BudgetItem.wedding_id == current_user.wedding_id)
        .all()
    )

    total_estimated = ZERO
    total_actual = ZERO
    total_paid = ZERO
    by_category: dict[int, dict[str, object]] = {}

    for item in items:
        estimated = item.estimated_cost or ZERO
        actual = item.actual_cost or ZERO
        paid_amount = actual if item.paid else ZERO

        total_estimated += estimated
        total_actual += actual
        total_paid += paid_amount

        bucket = by_category.get(item.category_id)
        if bucket is None:
            bucket = {
                "category_id": item.category_id,
                "category_name": item.category.category_name if item.category else "",
                "estimated": ZERO,
                "actual": ZERO,
                "paid": ZERO,
            }
            by_category[item.category_id] = bucket
        bucket["estimated"] += estimated
        bucket["actual"] += actual
        bucket["paid"] += paid_amount

    return BudgetSummaryResponse(
        total_estimated=total_estimated,
        total_actual=total_actual,
        total_paid=total_paid,
        remaining=total_estimated - total_paid,
        by_category=[
            BudgetCategorySummary(**bucket)
            for bucket in sorted(by_category.values(), key=lambda b: b["category_id"])
        ],
    )
