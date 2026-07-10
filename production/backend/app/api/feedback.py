from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.auth import require_coordinator, require_guest
from app.api.schemas_auth import UserResponse
from app.db.database import get_db
from app.db.models import Feedback
from app.db.schemas import FeedbackCreate, FeedbackResponse, FeedbackUpdate
from app.logging import get_logger


router = APIRouter(prefix="/api/feedback", tags=["feedback"])
logger = get_logger(__name__)


def get_feedback_or_404(db: Session, feedback_id: int, wedding_id: int) -> Feedback:
    feedback = db.get(Feedback, feedback_id)
    if feedback is None or feedback.wedding_id != wedding_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Feedback not found"
        )
    return feedback


@router.post("", response_model=FeedbackResponse, status_code=status.HTTP_201_CREATED)
async def create_feedback(
    payload: FeedbackCreate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_guest),
) -> Feedback:
    """Any signed-in user (guests included) can report a bug or share an idea.

    Deliberately not phase-gated: feedback should be welcome from the first
    invite preview to the last dance.
    """
    db_feedback = Feedback(
        wedding_id=current_user.wedding_id,
        submitted_by=current_user.name,
        type=payload.type,
        message=payload.message,
        page=payload.page,
        role=payload.role,
        viewport=payload.viewport,
    )
    db.add(db_feedback)
    db.commit()
    db.refresh(db_feedback)
    logger.info(
        "feedback_submitted",
        extra={"feedback_id": db_feedback.id, "feedback_type": db_feedback.type},
    )
    return db_feedback


@router.get("", response_model=list[FeedbackResponse])
async def list_feedback(
    status_filter: Literal["new", "triaged", "done"] | None = Query(
        None, alias="status"
    ),
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> list[Feedback]:
    query = db.query(Feedback).filter(Feedback.wedding_id == current_user.wedding_id)
    if status_filter is not None:
        query = query.filter(Feedback.status == status_filter)
    return query.order_by(Feedback.created_at.desc(), Feedback.id.desc()).all()


@router.patch("/{feedback_id}", response_model=FeedbackResponse)
async def update_feedback(
    feedback_id: int,
    payload: FeedbackUpdate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> Feedback:
    feedback = get_feedback_or_404(db, feedback_id, current_user.wedding_id)
    feedback.status = payload.status
    db.commit()
    db.refresh(feedback)
    logger.info(
        "feedback_updated",
        extra={"feedback_id": feedback.id, "feedback_status": feedback.status},
    )
    return feedback
