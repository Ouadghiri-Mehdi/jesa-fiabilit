import os
from fastapi import Header, HTTPException
from db import get_db

async def get_current_user(authorization: str = Header(...)):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Token manquant")
    token = authorization.split(" ")[1]
    db = get_db()
    try:
        user = db.auth.get_user(token)
        if not user or not user.user:
            raise HTTPException(status_code=401, detail="Token invalide")
        uid = user.user.id
        profile = db.table("profiles").select("*, sites(nom, code)").eq("id", uid).single().execute()
        if not profile.data:
            raise HTTPException(status_code=404, detail="Profil introuvable")
        return {
            "id": uid,
            "email": user.user.email,
            "site_id": profile.data["site_id"],
            "site": profile.data["sites"]["nom"] if profile.data.get("sites") else "",
            "site_key": (profile.data["sites"]["code"] if profile.data.get("sites") else "").lower(),
            "role": profile.data.get("role", "user"),
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=401, detail=str(e))
