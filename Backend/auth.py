import jwt
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel
from typing import Optional

from database import get_db
import models

SECRET_KEY = "my_super_secret_mock_key_for_signal"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 days

router = APIRouter(prefix="/auth", tags=["auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="auth/verify-otp")

class SendOTPRequest(BaseModel):
    identifier: str # Phone number or username

class VerifyOTPRequest(BaseModel):
    identifier: str
    otp: str

class ProfileUpdateRequest(BaseModel):
    display_name: str
    avatar_url: Optional[str] = None
    username: Optional[str] = None

class Token(BaseModel):
    access_token: str
    token_type: str

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise credentials_exception
    except jwt.InvalidTokenError:
        raise credentials_exception
        
    user = db.query(models.User).filter(models.User.id == int(user_id)).first()
    if user is None:
        raise credentials_exception
    return user

@router.post("/send-otp")
def send_otp(req: SendOTPRequest):
    # Mocking real phone verification and crypto key exchange
    return {"message": "OTP sent successfully. Use 123456 to verify. Key exchange mocked."}

@router.post("/verify-otp", response_model=Token)
def verify_otp(req: VerifyOTPRequest, db: Session = Depends(get_db)):
    if req.otp != "123456":
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    is_phone = req.identifier.startswith("+") or req.identifier.replace("-", "").isdigit()
    
    if is_phone:
        user = db.query(models.User).filter(models.User.phone == req.identifier).first()
    else:
        user = db.query(models.User).filter(models.User.username == req.identifier).first()

    if not user:
        user = models.User()
        if is_phone:
            user.phone = req.identifier
        else:
            user.username = req.identifier
        db.add(user)
        db.commit()
        db.refresh(user)

    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/profile")
def update_profile(req: ProfileUpdateRequest, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if req.username != current_user.username:
        if req.username is not None:
            existing_user = db.query(models.User).filter(func.lower(models.User.username) == req.username.lower()).first()
            if existing_user:
                raise HTTPException(status_code=400, detail="Username already exists")
        current_user.username = req.username

    current_user.display_name = req.display_name
    if req.avatar_url is not None:
        current_user.avatar_url = req.avatar_url
    db.commit()
    db.refresh(current_user)
    return {"message": "Profile updated", "display_name": current_user.display_name, "avatar_url": current_user.avatar_url, "username": current_user.username}

@router.get("/me")
def get_me(current_user: models.User = Depends(get_current_user)):
    return {
        "id": current_user.id,
        "phone": current_user.phone,
        "username": current_user.username,
        "display_name": current_user.display_name,
        "avatar_url": current_user.avatar_url
    }

@router.get("/search")
def search_users(query: str, current_user: models.User = Depends(get_current_user), db: Session = Depends(get_db)):
    if not query or len(query) < 2:
        return []
    
    results = db.query(models.User).filter(
        models.User.username.ilike(f"%{query}%"),
        models.User.id != current_user.id,
        models.User.username != None
    ).limit(20).all()
    
    return [
        {
            "id": u.id,
            "username": u.username,
            "display_name": u.display_name,
            "avatar_url": u.avatar_url
        }
        for u in results
    ]
