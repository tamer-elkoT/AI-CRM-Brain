from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from datetime import timedelta, datetime, timezone
import uuid
import random
import logging

from models.database import SessionLocal
from models.schema import User, OTPCode
from models.api_schemas import (
    LoginRequest, TokenResponse, UserCreate, UserUpdate, UserResponse,
    GoogleLoginRequest, OTPVerifyRequest, SignupPendingResponse,
)
from utils.security import (
    verify_password, get_password_hash,
    create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES,
)
from services.notification_service import send_whatsapp_otp

from google.oauth2 import id_token
from google.auth.transport import requests

from jose import JWTError, jwt
from utils.security import SECRET_KEY, ALGORITHM

router = APIRouter()
logger = logging.getLogger(__name__)

# In production, get this from .env
GOOGLE_CLIENT_ID = "YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com"

OTP_EXPIRY_MINUTES = 10


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(db: Session = Depends(get_db)) -> User:
    """
    Dependency that extracts the current user from the JWT Bearer token.
    Must be used with endpoints that require authentication.
    
    NOTE: FastAPI injects the Authorization header automatically via
    the request object. We access it through the dependency chain.
    """
    from fastapi import Request
    from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

    # This is a simplified approach; we'll use a closure below.
    raise NotImplementedError("Use get_current_user_dep instead")


def _extract_user_id_from_token(token: str) -> str:
    """Decode JWT and return user_id (the 'sub' claim)."""
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return user_id
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")


from fastapi import Header

def get_current_user_dep(
    authorization: str = Header(..., alias="Authorization"),
    db: Session = Depends(get_db),
) -> User:
    """
    Dependency: extracts Bearer token from Authorization header,
    decodes the JWT, and returns the User ORM object.
    """
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Invalid authorization header")
    
    token = authorization.split(" ", 1)[1]
    user_id = _extract_user_id_from_token(token)
    
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


# ─────────────────────────────────────────────
# POST /login — unchanged from original
# ─────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    """
    Real login endpoint.
    """
    user = db.query(User).filter(User.email == request.email).first()
    if not user or not user.hashed_password:
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    if not verify_password(request.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
        
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    
    return TokenResponse(access_token=access_token, token_type="bearer")


# ─────────────────────────────────────────────
# POST /signup — now returns SignupPendingResponse
# ─────────────────────────────────────────────
@router.post("/signup", response_model=SignupPendingResponse)
def signup(request: UserCreate, db: Session = Depends(get_db)):
    """
    Step 1 of 2-step signup:
    - Creates the user with is_whatsapp_verified=False
    - Generates a 6-digit OTP
    - Sends the OTP via WhatsApp (logged locally for dev)
    - Returns SignupPendingResponse (NOT a token)
    """
    # Check for duplicate email
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create user
    new_user = User(
        id=uuid.uuid4(),
        email=request.email,
        hashed_password=get_password_hash(request.password),
        name=request.name,
        business_field=request.business_field,
        role=request.role or "Sales",
        phone_number=request.phone_number,
        is_whatsapp_verified=False,
    )
    db.add(new_user)
    db.flush()  # get the user ID without committing

    # Generate 6-digit OTP
    otp_code = f"{random.randint(100000, 999999)}"
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=OTP_EXPIRY_MINUTES)

    otp_record = OTPCode(
        id=uuid.uuid4(),
        user_id=new_user.id,
        phone_number=request.phone_number or "",
        otp_code=otp_code,
        expires_at=expires_at,
    )
    db.add(otp_record)
    db.commit()

    # Send OTP via WhatsApp (mock — logged to console)
    if request.phone_number:
        send_whatsapp_otp(phone=request.phone_number, otp_code=otp_code)

    logger.info(f"Signup initiated for {request.email}. OTP sent to {request.phone_number}")

    return SignupPendingResponse(
        status="pending_verification",
        message="Account created. Please verify your WhatsApp number with the OTP code.",
        phone_number=request.phone_number or "",
    )


# ─────────────────────────────────────────────
# POST /verify-otp — Step 2 of signup
# ─────────────────────────────────────────────
@router.post("/verify-otp", response_model=TokenResponse)
def verify_otp(request: OTPVerifyRequest, db: Session = Depends(get_db)):
    """
    Step 2 of 2-step signup:
    - Validates the OTP for the given phone number
    - If valid: sets is_whatsapp_verified=True, deletes OTP, returns JWT
    - If invalid/expired: returns 401
    """
    now = datetime.now(timezone.utc)

    # Find a valid (non-expired) OTP for this phone number
    otp_record = (
        db.query(OTPCode)
        .filter(
            OTPCode.phone_number == request.phone_number,
            OTPCode.otp_code == request.otp_code,
            OTPCode.expires_at > now,
        )
        .first()
    )

    if not otp_record:
        raise HTTPException(
            status_code=401,
            detail="Invalid or expired OTP. Please request a new code.",
        )

    # Mark user as verified
    user = db.query(User).filter(User.id == otp_record.user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.is_whatsapp_verified = True

    # Clean up: delete used OTP (and any other OTPs for this user)
    db.query(OTPCode).filter(OTPCode.user_id == user.id).delete()
    db.commit()

    # Issue JWT
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )

    logger.info(f"OTP verified for {user.email}. WhatsApp verified ✅")

    return TokenResponse(access_token=access_token, token_type="bearer")


# ─────────────────────────────────────────────
# POST /google — unchanged from original
# ─────────────────────────────────────────────
@router.post("/google", response_model=TokenResponse)
def google_auth(request: GoogleLoginRequest, db: Session = Depends(get_db)):
    """
    Authenticates a user using a Google OAuth token.
    If the user doesn't exist, creates a new one.
    """
    try:
        # Validate the Google token
        idinfo = id_token.verify_oauth2_token(request.credential, requests.Request(), GOOGLE_CLIENT_ID)
        
        email = idinfo['email']
        name = idinfo.get('name', '')
        
        # Check if user exists
        user = db.query(User).filter(User.email == email).first()
        
        if not user:
            # Create user if they don't exist
            user = User(
                id=uuid.uuid4(),
                email=email,
                name=name,
                hashed_password=None # OAuth users don't have passwords
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
        access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
        access_token = create_access_token(
            data={"sub": str(user.id)}, expires_delta=access_token_expires
        )
        
        return TokenResponse(access_token=access_token, token_type="bearer")
        
    except ValueError:
        # Invalid token
        raise HTTPException(status_code=401, detail="Invalid Google token")


# ─────────────────────────────────────────────
# GET /users/me — current user profile
# ─────────────────────────────────────────────
@router.get("/users/me", response_model=UserResponse)
def get_me(current_user: User = Depends(get_current_user_dep)):
    """
    Returns the authenticated user's profile.
    """
    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        name=current_user.name,
        is_active=current_user.is_active,
        role=current_user.role or "Sales",
        phone_number=current_user.phone_number,
        is_whatsapp_verified=current_user.is_whatsapp_verified or False,
        whatsapp_template=current_user.whatsapp_template,
        email_template=current_user.email_template,
    )


# ─────────────────────────────────────────────
# PATCH /users/me/templates — save outreach templates
# ─────────────────────────────────────────────
@router.patch("/users/me/templates", response_model=UserResponse)
def update_templates(
    request: UserUpdate,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """
    Updates the current user's outreach templates (whatsapp_template, email_template).
    """
    # We need to re-fetch the user in the *same* session the dependency uses
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if request.whatsapp_template is not None:
        user.whatsapp_template = request.whatsapp_template
    if request.email_template is not None:
        user.email_template = request.email_template
    if request.name is not None:
        user.name = request.name
    if request.business_field is not None:
        user.business_field = request.business_field

    db.commit()
    db.refresh(user)

    return UserResponse(
        id=str(user.id),
        email=user.email,
        name=user.name,
        is_active=user.is_active,
        role=user.role or "Sales",
        phone_number=user.phone_number,
        is_whatsapp_verified=user.is_whatsapp_verified or False,
        whatsapp_template=user.whatsapp_template,
        email_template=user.email_template,
    )
