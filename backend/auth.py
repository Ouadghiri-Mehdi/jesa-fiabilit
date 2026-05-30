import os
from datetime import datetime, timedelta
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.orm import Session
from sqlalchemy import text

from db import get_db

SECRET_KEY = os.getenv("SECRET_KEY", "jesa-secret-key-change-in-production-2024")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_HOURS = 8

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")


def verify_password(plain: str, stored: str) -> bool:
    # Plain-text passwords (from SQL seed) are compared directly;
    # once hashed on first login, bcrypt verify is used.
    if stored.startswith("$2b$") or stored.startswith("$2a$"):
        return pwd_context.verify(plain, stored)
    return plain == stored


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def create_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(hours=ACCESS_TOKEN_EXPIRE_HOURS)
    return jwt.encode({"sub": str(user_id), "exp": expire}, SECRET_KEY, algorithm=ALGORITHM)


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db),
):
    exc = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, TypeError, ValueError):
        raise exc

    row = db.execute(
        text(
            "SELECT u.id, u.username, u.email, u.role, u.nom, u.prenom, u.site_id, "
            "s.nom AS site_nom, s.code AS site_code "
            "FROM users u LEFT JOIN sites s ON u.site_id = s.id "
            "WHERE u.id = :id AND u.actif = 1"
        ),
        {"id": user_id},
    ).mappings().fetchone()

    if not row:
        raise exc

    return dict(row)
