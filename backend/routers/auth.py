from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy import text

from db import get_db
from auth import verify_password, hash_password, create_token, get_current_user

router = APIRouter(prefix="/api/auth", tags=["Auth"])


@router.post("/login")
async def login(
    form: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db),
):
    row = db.execute(
        text(
            "SELECT u.id, u.username, u.password, u.role, u.nom, u.prenom, u.site_id, "
            "s.nom AS site_nom, s.code AS site_code "
            "FROM users u LEFT JOIN sites s ON u.site_id = s.id "
            "WHERE u.username = :u AND u.actif = 1"
        ),
        {"u": form.username},
    ).mappings().fetchone()

    if not row or not verify_password(form.password, row["password"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Identifiants incorrects",
        )

    # Hash plain-text password on first successful login
    if not (row["password"].startswith("$2b$") or row["password"].startswith("$2a$")):
        db.execute(
            text("UPDATE users SET password = :p WHERE id = :id"),
            {"p": hash_password(form.password), "id": row["id"]},
        )
        db.commit()

    token = create_token(row["id"])
    return {
        "access_token": token,
        "token_type": "bearer",
        "user": {
            "id": row["id"],
            "username": row["username"],
            "nom": row["nom"],
            "prenom": row["prenom"],
            "role": row["role"],
            "site_id": row["site_id"],
            "site": row["site_nom"],
            "site_key": row["site_code"],
        },
    }


@router.get("/me")
async def me(user=Depends(get_current_user)):
    return user
