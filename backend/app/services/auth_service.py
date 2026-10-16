from datetime import datetime, timedelta, timezone
from typing import Optional, Dict, Any
import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerifyMismatchError, InvalidHash
from app.config import settings
from app.models.user import UserRole

ph = PasswordHasher(
    time_cost=2,
    memory_cost=19456, # 19 MB
    parallelism=1,
    hash_len=32,
    salt_len=16
)

def hash_password(password: str) -> str:
    """Hashes a password using Argon2id."""
    return ph.hash(password)

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Verifies a plain password against an Argon2id hash."""
    try:
        return ph.verify(hashed_password, plain_password)
    except (VerifyMismatchError, InvalidHash):
        return False

def create_access_token(
    user_id: int,
    institutional_id: str,
    role: UserRole,
    college_id: Optional[int] = None,
    expires_delta: Optional[timedelta] = None
) -> str:
    """Creates a signed JWT access token with tenant context."""
    now = datetime.now(timezone.utc)
    if expires_delta:
        expire = now + expires_delta
    else:
        expire = now + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    
    to_encode: Dict[str, Any] = {
        "sub": str(user_id),
        "institutional_id": institutional_id,
        "role": role.value if hasattr(role, "value") else str(role),
        "college_id": college_id,
        "exp": expire,
        "iat": now
    }
    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    """Decodes and validates a JWT access token."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        return payload
    except (jwt.PyJWTError, Exception):
        return None

def create_password_reset_token(user_id: int) -> str:
    """Creates a 15-minute signed token for password reset."""
    now = datetime.now(timezone.utc)
    expire = now + timedelta(minutes=15)
    to_encode = {
        "sub": str(user_id),
        "purpose": "password_reset",
        "exp": expire,
        "iat": now
    }
    return jwt.encode(to_encode, settings.SECRET_KEY, algorithm=settings.ALGORITHM)

def decode_password_reset_token(token: str) -> Optional[int]:
    """Validates password reset token and returns user_id if valid."""
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        if payload.get("purpose") != "password_reset":
            return None
        return int(payload.get("sub"))
    except (jwt.PyJWTError, Exception):
        return None
