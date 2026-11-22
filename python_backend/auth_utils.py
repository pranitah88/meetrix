import base64
import hashlib
import hmac
import json
import time
from typing import Optional, Dict, Any
import bcrypt
from fastapi import Header, HTTPException, status, Depends
from config import JWT_SECRET, JWT_EXPIRATION_HOURS

# ─────────────────────────────────────────────────────────────
# Password Hashing with Bcrypt
# ─────────────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    """Hash password using bcrypt with standard salt."""
    salt = bcrypt.gensalt(10)
    return bcrypt.hashpw(password.encode("utf-8"), salt).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verify plain password against bcrypt hash."""
    try:
        return bcrypt.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

# ─────────────────────────────────────────────────────────────
# Pure Python Standard-Compliant HS256 JWT
# Zero external packages required, 100% standard compatible
# ─────────────────────────────────────────────────────────────

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("utf-8")

def _b64url_decode(s: str) -> bytes:
    rem = len(s) % 4
    if rem > 0:
        s += "=" * (4 - rem)
    return base64.urlsafe_b64decode(s.encode("utf-8"))

def create_jwt_token(payload: Dict[str, Any], secret: str = JWT_SECRET, exp_hours: int = JWT_EXPIRATION_HOURS) -> str:
    """Create a signed HS256 JWT token with expiration timestamp."""
    p = dict(payload)
    if "exp" not in p:
        p["exp"] = int(time.time()) + (exp_hours * 3600)
    p["iat"] = int(time.time())

    header = {"alg": "HS256", "typ": "JWT"}
    h_b64 = _b64url_encode(json.dumps(header, separators=(",", ":")).encode("utf-8"))
    p_b64 = _b64url_encode(json.dumps(p, separators=(",", ":")).encode("utf-8"))
    signing_input = f"{h_b64}.{p_b64}".encode("utf-8")

    sig = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()
    s_b64 = _b64url_encode(sig)
    return f"{h_b64}.{p_b64}.{s_b64}"

def verify_jwt_token(token: str, secret: str = JWT_SECRET) -> Dict[str, Any]:
    """Verify and decode HS256 JWT token."""
    parts = token.split(".")
    if len(parts) != 3:
        raise ValueError("Invalid JWT token format")

    h_b64, p_b64, s_b64 = parts
    signing_input = f"{h_b64}.{p_b64}".encode("utf-8")
    expected_sig = hmac.new(secret.encode("utf-8"), signing_input, hashlib.sha256).digest()

    try:
        actual_sig = _b64url_decode(s_b64)
    except Exception:
        raise ValueError("Invalid JWT signature encoding")

    if not hmac.compare_digest(expected_sig, actual_sig):
        raise ValueError("Invalid JWT signature")

    try:
        payload = json.loads(_b64url_decode(p_b64).decode("utf-8"))
    except Exception:
        raise ValueError("Invalid JWT payload")

    if "exp" in payload and payload["exp"] < time.time():
        raise ValueError("JWT token has expired")

    return payload

# ─────────────────────────────────────────────────────────────
# FastAPI Authentication Dependency
# ─────────────────────────────────────────────────────────────

def get_current_user_payload(authorization: Optional[str] = Header(None)) -> Dict[str, Any]:
    """Extract and verify JWT token from Authorization header (Bearer <token>)."""
    if not authorization:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authorization header missing"
        )

    parts = authorization.split(" ")
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authorization format. Expected Bearer <token>"
        )

    token = parts[1]
    try:
        payload = verify_jwt_token(token)
        return payload
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid or expired token: {str(e)}"
        )
