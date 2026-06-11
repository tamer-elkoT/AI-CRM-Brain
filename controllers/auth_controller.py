from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy.orm import Session
from datetime import timedelta, datetime, timezone
import uuid
import random
import logging
import os

from models.database import SessionLocal
from models.schema import User, OTPCode, Company
from models.api_schemas import (
    LoginRequest, TokenResponse, UserCreate, UserUpdate, UserResponse,
    GoogleLoginRequest, OTPVerifyRequest, SignupPendingResponse,
    AdminSignupRequest, InviteRequest, TeamSignupRequest, InviteResponse
)
from utils.security import (
    verify_password, get_password_hash,
    create_access_token, ACCESS_TOKEN_EXPIRE_MINUTES,
)
from utils.email_sender import send_invite_email
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
# POST /signup/admin — Epic 2 Multi-Tenant
# ─────────────────────────────────────────────
@router.post("/signup/admin", response_model=TokenResponse)
def signup_admin(request: AdminSignupRequest, db: Session = Depends(get_db)):
    """
    Creates a new Company Workspace and an Admin user.
    Bypasses OTP for immediate JWT token return (per Epic 2 spec).
    """
    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Create Company
    new_company = Company(
        id=uuid.uuid4(),
        name=request.company_name,
        industry=request.industry,
    )
    db.add(new_company)
    db.flush()

    # Create Admin User
    new_user = User(
        id=uuid.uuid4(),
        email=request.email,
        hashed_password=get_password_hash(request.password),
        name=request.name,
        role="admin",
        company_id=new_company.id,
        phone_number=request.phone_number,
        is_whatsapp_verified=True,  # Bypassed
    )
    db.add(new_user)
    db.commit()

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(new_user.id)}, expires_delta=access_token_expires
    )
    return TokenResponse(access_token=access_token, token_type="bearer")


# ─────────────────────────────────────────────
# POST /invite — Epic 2 Multi-Tenant
# ─────────────────────────────────────────────
@router.post("/invite", response_model=InviteResponse)
def invite_user(
    request: InviteRequest,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db)
):
    """
    Generates a secure invite token for a specific role within the admin's company.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can invite users.")

    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="User is not associated with a company.")

    expires_delta = timedelta(hours=48)
    expire = datetime.now(timezone.utc) + expires_delta
    
    to_encode = {
        "type": "invite",
        "company_id": str(current_user.company_id),
        "role": request.role,
        "email": request.email,
        "exp": expire
    }
    
    invite_token = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    
    # Send email via SMTP
    app_base_url = os.getenv("APP_BASE_URL", "http://localhost:5173")
    magic_link = f"{app_base_url}/signup/team?token={invite_token}"
    
    # We fetch the company name safely
    company_name = "your company"
    if current_user.company_id:
        company = db.query(Company).filter(Company.id == current_user.company_id).first()
        if company:
            company_name = company.name

    email_result = send_invite_email(
        to_email=request.email,
        invite_link=magic_link,
        role=request.role,
        company_name=company_name
    )
    
    return InviteResponse(
        invite_token=invite_token,
        role=request.role,
        email=request.email,
        expires_in="48 hours",
        email_status=email_result.get("status", "failed"),
        email_error=email_result.get("error"),
    )


# ─────────────────────────────────────────────
# POST /signup/team — Epic 2 Multi-Tenant
# ─────────────────────────────────────────────
@router.post("/signup/team", response_model=TokenResponse)
def signup_team(request: TeamSignupRequest, db: Session = Depends(get_db)):
    """
    Signs up a team member using a valid invite token.
    """
    try:
        # Epic 3 Fix: Handle users pasting the full magic link
        token_str = request.invite_token.strip()
        if "token=" in token_str:
            token_str = token_str.split("token=")[-1].split("&")[0]

        payload = jwt.decode(token_str, SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") != "invite":
            raise HTTPException(status_code=400, detail="Invalid token type")
        
        company_id = payload.get("company_id")
        role = payload.get("role")
        token_email = payload.get("email")
        
        if not company_id or not role:
            raise HTTPException(status_code=400, detail="Malformed invite token")
            
        if token_email and token_email != request.email:
            raise HTTPException(status_code=400, detail="Email does not match the invitation")
            
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired invite token")

    existing = db.query(User).filter(User.email == request.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        id=uuid.uuid4(),
        email=request.email,
        hashed_password=get_password_hash(request.password),
        name=request.name,
        role=role,
        company_id=uuid.UUID(company_id),
        phone_number=request.phone_number,
        is_whatsapp_verified=True,  # Bypassed
    )
    db.add(new_user)
    db.commit()

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(new_user.id)}, expires_delta=access_token_expires
    )
    return TokenResponse(access_token=access_token, token_type="bearer")


# ─────────────────────────────────────────────
# POST /signup — legacy
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
def get_me(
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """
    Returns the authenticated user's profile.
    Epic 3: Now includes username and account_name.
    """
    # Resolve company name from relation
    company_name = None
    if current_user.company:
        company_name = current_user.company.name
    elif current_user.company_id:
        # Lazy fallback if relationship not loaded
        company = db.query(Company).filter(Company.id == current_user.company_id).first()
        company_name = company.name if company else None

    return UserResponse(
        id=str(current_user.id),
        email=current_user.email,
        company_id=str(current_user.company_id) if current_user.company_id else None,
        company_name=company_name,
        name=current_user.name,
        # Epic 3: new profile fields
        username=current_user.username,
        account_name=current_user.account_name,
        business_field=current_user.business_field,
        is_active=current_user.is_active,
        role=current_user.role or "rep",
        phone_number=current_user.phone_number,
        is_whatsapp_verified=current_user.is_whatsapp_verified or False,
        whatsapp_template=current_user.whatsapp_template,
        email_template=current_user.email_template,
    )


# ─────────────────────────────────────────────
# PATCH /users/me — update full profile (Epic 3 expanded)
# ─────────────────────────────────────────────
@router.patch("/users/me", response_model=UserResponse)
@router.patch("/users/me/templates", response_model=UserResponse)  # backwards-compat alias
def update_me(
    request: UserUpdate,
    current_user: User = Depends(get_current_user_dep),
    db: Session = Depends(get_db),
):
    """
    Updates the current user's profile fields.
    Epic 3: expanded to handle name, username, account_name, phone_number, templates.
    """
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Apply only the fields the caller provided
    if request.name is not None:
        user.name = request.name
    if request.username is not None:
        # Check uniqueness before saving
        conflict = db.query(User).filter(
            User.username == request.username, User.id != user.id
        ).first()
        if conflict:
            raise HTTPException(status_code=409, detail="Username already taken")
        user.username = request.username
    if request.account_name is not None:
        user.account_name = request.account_name
    if request.business_field is not None:
        user.business_field = request.business_field
    if request.phone_number is not None:
        user.phone_number = request.phone_number
    if request.whatsapp_template is not None:
        user.whatsapp_template = request.whatsapp_template
    if request.email_template is not None:
        user.email_template = request.email_template

    db.commit()
    db.refresh(user)

    return UserResponse(
        id=str(user.id),
        email=user.email,
        company_id=str(user.company_id) if user.company_id else None,
        company_name=user.company.name if user.company else None,
        name=user.name,
        username=user.username,
        account_name=user.account_name,
        business_field=user.business_field,
        is_active=user.is_active,
        role=user.role or "rep",
        phone_number=user.phone_number,
        is_whatsapp_verified=user.is_whatsapp_verified or False,
        whatsapp_template=user.whatsapp_template,
        email_template=user.email_template,
    )


# ─────────────────────────────────────────────────────────────────
# GET /zoho/initiate — Start Zoho OAuth for a Company workspace
# ─────────────────────────────────────────────────────────────────
@router.get("/zoho/initiate")
def zoho_oauth_initiate(
    current_user: User = Depends(get_current_user_dep),
):
    """
    Builds and returns the Zoho OAuth authorization URL.
    The frontend receives this URL and does window.location.href = url.
    The company_id is embedded in the 'state' param to identify the tenant on callback.
    """
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only admins can connect Zoho.")
    if not current_user.company_id:
        raise HTTPException(status_code=400, detail="User is not associated with a company.")

    client_id     = os.getenv("ZOHO_CLIENT_ID", "")
    redirect_uri  = os.getenv("ZOHO_REDIRECT_URI", "http://localhost:8000/api/v1/auth/zoho/callback")
    scope         = os.getenv("SCOPE_NAME", "ZohoCRM.modules.deals.READ,ZohoCRM.modules.contacts.READ")

    if not client_id:
        raise HTTPException(status_code=500, detail="ZOHO_CLIENT_ID not configured in .env")

    state = str(current_user.company_id)

    auth_url = (
        f"https://accounts.zoho.com/oauth/v2/auth"
        f"?response_type=code"
        f"&client_id={client_id}"
        f"&scope={scope}"
        f"&redirect_uri={redirect_uri}"
        f"&access_type=offline"
        f"&state={state}"
    )
    return {"auth_url": auth_url}


# ─────────────────────────────────────────────────────────────────────────────
# GET /zoho/callback — Zoho exchanges code → tokens; we save them to Company
# ─────────────────────────────────────────────────────────────────────────────
@router.get("/zoho/callback")
def zoho_oauth_callback(
    code: str,
    state: str,
    db: Session = Depends(get_db),
):
    """
    Receives the OAuth callback from Zoho.
    Exchanges the authorization code for access + refresh tokens
    and persists them on the Company row identified by `state` (company_id).
    Then redirects the browser back to the admin wizard.
    """
    import requests as http_requests
    from fastapi.responses import RedirectResponse

    client_id     = os.getenv("ZOHO_CLIENT_ID", "")
    client_secret = os.getenv("ZOHO_CLIENT_SECRET", "")
    redirect_uri  = os.getenv("ZOHO_REDIRECT_URI", "http://localhost:8000/api/v1/auth/zoho/callback")
    app_base_url  = os.getenv("APP_BASE_URL", "http://localhost:5173")

    # Exchange code for tokens
    token_url = "https://accounts.zoho.com/oauth/v2/token"
    payload = {
        "grant_type": "authorization_code",
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uri": redirect_uri,
        "code": code,
    }
    resp = http_requests.post(token_url, data=payload)
    if resp.status_code != 200:
        logger.error(f"Zoho token exchange failed: {resp.text}")
        raise HTTPException(status_code=502, detail=f"Zoho token exchange failed: {resp.text}")

    token_data     = resp.json()
    access_token   = token_data.get("access_token")
    refresh_token  = token_data.get("refresh_token")

    # Persist tokens to the Company record
    import uuid as _uuid
    try:
        company_id = _uuid.UUID(state)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid state param (company_id).")

    company = db.query(Company).filter(Company.id == company_id).first()
    if not company:
        raise HTTPException(status_code=404, detail="Company not found.")

    company.zoho_access_token  = access_token
    company.zoho_refresh_token = refresh_token
    db.commit()

    logger.info(f"✅ Zoho connected for company {company.name} (id={company_id})")

    # Redirect admin back to the invite wizard step
    return RedirectResponse(url=f"{app_base_url}/auth?zoho=connected")
