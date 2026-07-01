# backend/app/api/auth.py
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from datetime import timedelta
from pydantic import BaseModel, EmailStr
from typing import Optional
import httpx

from app.core.db import get_db, User, Consumer
from app.core.security import verify_password, get_password_hash, create_access_token, decode_access_token, oauth2_scheme
from app.core.config import settings

router = APIRouter(prefix="/auth", tags=["auth"])

class UserRegister(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    phone: Optional[str] = None
    tax_id: Optional[str] = None

class TokenResponse(BaseModel):
    access_token: str
    token_type: str
    role: str

class GoogleLoginRequest(BaseModel):
    token: str # Simulated Google OAuth ID token
    email: EmailStr
    full_name: str

class ForgotPasswordRequest(BaseModel):
    email: EmailStr

class UserProfile(BaseModel):
    id: int
    email: str
    role: str
    full_name: Optional[str] = None
    phone: Optional[str] = None
    tax_id: Optional[str] = None

def verify_supabase_token(token: str) -> Optional[str]:
    if not settings.SUPABASE_URL or not settings.SUPABASE_ANON_KEY:
        return None
    try:
        headers = {
            "Authorization": f"Bearer {token}",
            "apikey": settings.SUPABASE_ANON_KEY
        }
        url = f"{settings.SUPABASE_URL.rstrip('/')}/auth/v1/user"
        with httpx.Client() as client:
            response = client.get(url, headers=headers, timeout=5.0)
            if response.status_code == 200:
                data = response.json()
                return data.get("email")
    except Exception as e:
        print(f"Error validating Supabase token: {e}")
    return None

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    
    # Try local JWT decoding first
    payload = decode_access_token(token)
    if payload is not None:
        user_id = payload.get("sub")
        if user_id is not None:
            user = db.query(User).filter(User.id == int(user_id)).first()
            if user is not None:
                return user
                
    # If local JWT decoding fails, try Supabase validation
    email = verify_supabase_token(token)
    if email is not None:
        # Check if user exists locally. If not, auto-register them.
        user = db.query(User).filter(User.email == email).first()
        if not user:
            role = "admin" if email == settings.ADMIN_EMAIL else "consumer"
            user = User(
                email=email,
                password_hash=get_password_hash("supabase-oauth-placeholder-password"),
                role=role
            )
            db.add(user)
            db.commit()
            db.refresh(user)
            
            # Create Consumer Profile
            if role == "consumer":
                consumer = Consumer(
                    user_id=user.id,
                    full_name=email.split('@')[0].capitalize(),
                    phone=None,
                    tax_id=None
                )
                db.add(consumer)
                db.commit()
                db.refresh(user)
        return user
        
    raise credentials_exception

@router.post("/register", response_model=TokenResponse)
def register(user_data: UserRegister, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(User).filter(User.email == user_data.email).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Email is already registered")
        
    # Create new User
    user = User(
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        role="consumer"
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    
    # Create associated Consumer profile
    consumer = Consumer(
        user_id=user.id,
        full_name=user_data.full_name,
        phone=user_data.phone,
        tax_id=user_data.tax_id
    )
    db.add(consumer)
    db.commit()
    
    # Issue JWT token
    access_token = create_access_token(subject=user.id, role=user.role)
    return {"access_token": access_token, "token_type": "bearer", "role": user.role}

@router.post("/login", response_model=TokenResponse)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
        
    access_token = create_access_token(subject=user.id, role=user.role)
    return {"access_token": access_token, "token_type": "bearer", "role": user.role}

@router.post("/google", response_model=TokenResponse)
def google_signin(login_req: GoogleLoginRequest, db: Session = Depends(get_db)):
    # Google simulation
    user = db.query(User).filter(User.email == login_req.email).first()
    
    if not user:
        # Create user if it doesn't exist yet
        user = User(
            email=login_req.email,
            password_hash=get_password_hash(f"SimulatedGooglePassword-{login_req.token[:8]}"),
            role="consumer"
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        
        # Create Consumer Profile
        consumer = Consumer(
            user_id=user.id,
            full_name=login_req.full_name
        )
        db.add(consumer)
        db.commit()
        
    access_token = create_access_token(subject=user.id, role=user.role)
    return {"access_token": access_token, "token_type": "bearer", "role": user.role}

@router.post("/forgot-password")
def forgot_password(req: ForgotPasswordRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == req.email).first()
    if not user:
        raise HTTPException(status_code=404, detail="Email address not found")
        
    # In production, dispatch an actual reset URL. In this mockup, we return success.
    return {
        "status": "success",
        "message": f"Password reset link has been dispatched to {req.email}. (Demo mock check: link expires in 2 hours)"
    }

@router.get("/me", response_model=UserProfile)
def get_me(current_user: User = Depends(get_current_user)):
    response = {
        "id": current_user.id,
        "email": current_user.email,
        "role": current_user.role,
        "full_name": None,
        "phone": None,
        "tax_id": None
    }
    
    if current_user.consumer:
        response["full_name"] = current_user.consumer.full_name
        response["phone"] = current_user.consumer.phone
        response["tax_id"] = current_user.consumer.tax_id
    elif current_user.role == "admin":
        response["full_name"] = "System Administrator"
        
    return response
