from fastapi import APIRouter, HTTPException, status, Depends
from pydantic import BaseModel, EmailStr
from typing import Optional, Dict, Any
from db import db
from auth_utils import hash_password, verify_password, create_jwt_token, get_current_user_payload

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

class LoginRequest(BaseModel):
    email: str
    password: str

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str
    role: Optional[str] = "Team Member"
    department: Optional[str] = "Engineering"

def sanitize_user(user: Dict[str, Any]) -> Dict[str, Any]:
    """Strip password hash from user response object."""
    clean = dict(user)
    clean.pop("password", None)
    return clean

@router.post("/login")
def login(req: LoginRequest):
    user = db.find_user_by_email(req.email)
    if not user or not verify_password(req.password, user.get("password", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password"
        )

    clean_user = sanitize_user(user)
    token = create_jwt_token({
        "id": clean_user["_id"],
        "name": clean_user["name"],
        "email": clean_user["email"],
        "role": clean_user.get("role", "")
    })

    return {
        "token": token,
        "user": clean_user
    }

@router.post("/register", status_code=status.HTTP_201_CREATED)
def register(req: RegisterRequest):
    if len(req.password.strip()) < 6:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Password must be at least 6 characters"
        )

    existing = db.find_user_by_email(req.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered"
        )

    user_doc = {
        "name": req.name.strip(),
        "email": req.email.strip().lower(),
        "password": hash_password(req.password.strip()),
        "role": req.role,
        "department": req.department
    }

    created = db.insert_user(user_doc)
    clean_user = sanitize_user(created)

    token = create_jwt_token({
        "id": clean_user["_id"],
        "name": clean_user["name"],
        "email": clean_user["email"],
        "role": clean_user.get("role", "")
    })

    return {
        "token": token,
        "user": clean_user
    }

@router.get("/me")
def get_me(payload: Dict[str, Any] = Depends(get_current_user_payload)):
    user = db.find_user_by_id(payload.get("id"))
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return sanitize_user(user)

