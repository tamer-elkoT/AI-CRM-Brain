"""
Team Controller — Admin-only endpoints for listing team members.
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from models.database import SessionLocal
from models.schema import User
from controllers.auth_controller import get_current_user_dep, get_db

router = APIRouter()


@router.get("/team/members")
def list_team_members(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """
    Admin-only: list all users in the same company.
    Returns name, email, role, phone_number, is_active, created_at.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can view team members.")

    users = (
        db.query(User)
        .filter(User.company_id == current_user.company_id)
        .order_by(User.created_at.asc())
        .all()
    )

    return [
        {
            "id": str(u.id),
            "name": u.name or "",
            "email": u.email,
            "role": u.role,
            "phone_number": u.phone_number,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else "",
        }
        for u in users
    ]
