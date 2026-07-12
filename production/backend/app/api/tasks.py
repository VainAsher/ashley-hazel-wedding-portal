from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.api.auth import require_coordinator
from app.api.schemas_auth import UserResponse
from app.db.database import get_db
from app.db.models import Task, TaskContext
from app.db.schemas import TaskCreate, TaskMove, TaskResponse, TaskUpdate

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


def _column_query(db: Session, wedding_id: int, context: TaskContext, task_status: str):
    return db.query(Task).filter(
        Task.wedding_id == wedding_id,
        Task.context == context,
        Task.status == task_status,
    )


def _end_of_column_position(
    db: Session, wedding_id: int, context: TaskContext, task_status: str
) -> int:
    """Next free position at the end of a (wedding, context, status) column."""
    return _column_query(db, wedding_id, context, task_status).count()


def _resequence_column(
    db: Session,
    wedding_id: int,
    context: TaskContext,
    task_status: str,
    exclude_id: int | None = None,
) -> list[Task]:
    """Renumber a column's tasks 0..n-1 in current position order (stable)."""
    query = _column_query(db, wedding_id, context, task_status)
    if exclude_id is not None:
        query = query.filter(Task.id != exclude_id)
    column_tasks = query.order_by(
        Task.position.asc().nulls_last(), Task.id.asc()
    ).all()
    for index, column_task in enumerate(column_tasks):
        if column_task.position != index:
            column_task.position = index
    return column_tasks


@router.get("", response_model=list[TaskResponse])
async def list_tasks(
    context: TaskContext = Query(default=TaskContext.wedding),
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> list[Task]:
    """List tasks for the current user's wedding, ordered for the board."""
    return (
        db.query(Task)
        .filter(Task.wedding_id == current_user.wedding_id, Task.context == context)
        .order_by(Task.status.asc(), Task.position.asc().nulls_last(), Task.id.asc())
        .all()
    )


@router.post("", response_model=TaskResponse, status_code=status.HTTP_201_CREATED)
async def create_task(
    task: TaskCreate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> Task:
    """Create a new task for the current wedding. New cards append to the
    end of their column."""
    if task.wedding_id is None:
        task.wedding_id = current_user.wedding_id
    elif task.wedding_id != current_user.wedding_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot create tasks for other weddings",
        )

    position = _end_of_column_position(db, task.wedding_id, task.context, task.status)

    new_task = Task(
        wedding_id=task.wedding_id,
        title=task.title,
        description=task.description,
        status=task.status,
        priority=task.priority,
        context=task.context,
        position=position,
        due_date=task.due_date,
        assigned_to=task.assigned_to,
        category=task.category,
    )
    db.add(new_task)
    db.commit()
    db.refresh(new_task)
    return new_task


@router.get("/{task_id}", response_model=TaskResponse)
async def get_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> Task:
    """Get a specific task."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    if task.wedding_id != current_user.wedding_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    return task


@router.patch("/{task_id}/move", response_model=TaskResponse)
async def move_task(
    task_id: int,
    move: TaskMove,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> Task:
    """Move a card to a column slot in one call (drag & drop, or the ← →
    move buttons paired with a position), resequencing neighbours.

    Cross-wedding tasks 404 (rather than 403) so a stray id from another
    wedding reveals nothing about whether it exists.
    """
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task or task.wedding_id != current_user.wedding_id:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    source_status = task.status
    source_context = task.context
    same_column = source_status == move.status

    # Pull every other card currently in the destination column (in order),
    # insert this one at the clamped target index, then renumber 0..n-1.
    destination_tasks = (
        _column_query(db, task.wedding_id, source_context, move.status)
        .filter(Task.id != task.id)
        .order_by(Task.position.asc().nulls_last(), Task.id.asc())
        .all()
    )
    target_index = min(max(move.position, 0), len(destination_tasks))
    destination_tasks.insert(target_index, task)

    for index, column_task in enumerate(destination_tasks):
        column_task.position = index
    task.status = move.status

    if not same_column:
        # Close the gap left behind in the source column.
        _resequence_column(db, task.wedding_id, source_context, source_status, exclude_id=task.id)

    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.patch("/{task_id}", response_model=TaskResponse)
async def update_task(
    task_id: int,
    task_update: TaskUpdate,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> Task:
    """Update a task."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    if task.wedding_id != current_user.wedding_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    update_data = task_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(task, field, value)

    db.add(task)
    db.commit()
    db.refresh(task)
    return task


@router.delete("/{task_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_task(
    task_id: int,
    db: Session = Depends(get_db),
    current_user: UserResponse = Depends(require_coordinator),
) -> None:
    """Delete a task."""
    task = db.query(Task).filter(Task.id == task_id).first()
    if not task:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Task not found",
        )

    if task.wedding_id != current_user.wedding_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Insufficient permissions",
        )

    db.delete(task)
    db.commit()
