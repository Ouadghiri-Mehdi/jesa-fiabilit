from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional, Any
from auth import get_current_user
from db import get_db

router = APIRouter(prefix="/api/rca", tags=["RCA"])

class SessionIn(BaseModel):
    id: str
    titre: Optional[str] = None
    methode: Optional[str] = None
    statut: Optional[str] = "non-commencee"
    equip_id: Optional[str] = None
    niveau: Optional[int] = 2
    source: Optional[str] = "Manuel"
    responsable: Optional[str] = None
    zone: Optional[str] = None
    phenomene: Optional[str] = None
    cause_arret: Optional[str] = None
    date_ouverture: Optional[str] = None
    date_heure_debut: Optional[str] = None
    date_heure_fin: Optional[str] = None
    cumul_arret: Optional[float] = 0
    frequence: Optional[float] = 0
    taux_panne: Optional[float] = 0
    disponibilite: Optional[float] = 100
    participants: Optional[list] = []
    noeuds: Optional[list] = []
    actions_generees: Optional[list] = []

@router.get("/sessions")
async def get_sessions(user=Depends(get_current_user)):
    db = get_db()
    res = db.table("rca_sessions").select("*").eq("site_id", user["site_id"]).order("created_at", desc=True).execute()
    return res.data

@router.post("/sessions")
async def create_session(session: SessionIn, user=Depends(get_current_user)):
    db = get_db()
    row = session.model_dump()
    row["site_id"] = user["site_id"]
    row["created_by"] = user["id"]
    if not row.get("titre"):
        row["titre"] = row.get("equip_id") or "Sans titre"
    res = db.table("rca_sessions").insert(row).execute()
    return res.data[0] if res.data else {}

@router.put("/sessions/{session_id}")
async def update_session(session_id: str, session: SessionIn, user=Depends(get_current_user)):
    db = get_db()
    row = session.model_dump(exclude_unset=True)
    row["updated_at"] = "now()"
    res = db.table("rca_sessions").update(row).eq("id", session_id).eq("site_id", user["site_id"]).execute()
    return res.data[0] if res.data else {}

@router.delete("/sessions/{session_id}")
async def delete_session(session_id: str, user=Depends(get_current_user)):
    db = get_db()
    db.table("rca_sessions").delete().eq("id", session_id).eq("site_id", user["site_id"]).execute()
    return {"ok": True}
