"""
Sprint 5: Notification Controller (Feature 8)
Handles in-app notification CRUD: fetch, mark read, unread count.
"""

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional
import logging

from models.database import SessionLocal
from models.schema import Notification, User
from models.api_schemas import NotificationResponse, NotificationListResponse

from jose import jwt
from utils.security import SECRET_KEY, ALGORITHM

router = APIRouter()
logger = logging.getLogger(__name__)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def _get_user_id_from_token(authorization: str) -> str:
    """Extract user_id from Bearer token."""
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    token = authorization.split(" ", 1)[1]
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("sub")
        if not user_id:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


@router.get("/notifications", response_model=NotificationListResponse)
def get_notifications(
    page: int = 1,
    page_size: int = 20,
    authorization: str = Header(..., alias="Authorization"),
    db: Session = Depends(get_db),
):
    """
    Fetch notifications for the current user, newest first.
    """
    user_id = _get_user_id_from_token(authorization)

    # Total count
    total = db.query(func.count(Notification.id)).filter(
        Notification.user_id == user_id
    ).scalar() or 0

    # Unread count
    unread = db.query(func.count(Notification.id)).filter(
        Notification.user_id == user_id,
        Notification.is_read == False,
    ).scalar() or 0

    # Paginated results
    offset = (page - 1) * page_size
    notifications = (
        db.query(Notification)
        .filter(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .offset(offset)
        .limit(page_size)
        .all()
    )

    items = [
        NotificationResponse(
            id=n.id,
            user_id=str(n.user_id),
            deal_id=n.deal_id,
            type=n.type,
            title=n.title,
            body=n.body,
            is_read=n.is_read,
            created_at=str(n.created_at),
        )
        for n in notifications
    ]

    return NotificationListResponse(
        items=items,
        unread_count=unread,
        total=total,
    )


@router.get("/notifications/unread-count")
def get_unread_count(
    authorization: str = Header(..., alias="Authorization"),
    db: Session = Depends(get_db),
):
    """
    Return count of unread notifications for the badge.
    """
    user_id = _get_user_id_from_token(authorization)

    count = db.query(func.count(Notification.id)).filter(
        Notification.user_id == user_id,
        Notification.is_read == False,
    ).scalar() or 0

    return {"unread_count": count}


@router.patch("/notifications/read-all")
def mark_all_read(
    authorization: str = Header(..., alias="Authorization"),
    db: Session = Depends(get_db),
):
    """
    Mark all notifications as read for the current user.
    """
    user_id = _get_user_id_from_token(authorization)

    updated = db.query(Notification).filter(
        Notification.user_id == user_id,
        Notification.is_read == False,
    ).update({"is_read": True})

    db.commit()

    return {
        "status": "success",
        "message": f"{updated} notifications marked as read.",
        "count": updated,
    }


@router.patch("/notifications/{notification_id}/read")
def mark_notification_read(
    notification_id: int,
    authorization: str = Header(..., alias="Authorization"),
    db: Session = Depends(get_db),
):
    """
    Mark a single notification as read.
    """
    user_id = _get_user_id_from_token(authorization)

    notification = db.query(Notification).filter(
        Notification.id == notification_id,
        Notification.user_id == user_id,
    ).first()

    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")

    notification.is_read = True
    db.commit()

    return {"status": "success", "message": "Notification marked as read."}
