from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from auth import get_current_user
from db import get_db

router = APIRouter(prefix="/api/tum", tags=["TUM"])

class ArretIn(BaseModel):
    equip_id: str
    start_time: datetime
    duration: float
    cause: Optional[str] = None
    zone: Optional[str] = None
    designation: Optional[str] = None

class SeuilsIn(BaseModel):
    n1_cumul: float
    n1_frequence: int
    n1_horizon: int
    n2_cumul: float
    n2_frequence: int
    n2_horizon: int

@router.get("/arrets")
async def get_arrets(user=Depends(get_current_user)):
    db = get_db()
    res = db.table("arrets").select("*").eq("site_id", user["site_id"]).order("start_time", desc=True).execute()
    return res.data

@router.post("/arrets")
async def create_arrets(arrets: list[ArretIn], user=Depends(get_current_user)):
    db = get_db()
    rows = [
        {
            "equip_id":   a.equip_id,
            "site_id":    user["site_id"],
            "start_time": a.start_time.isoformat(),
            "duration":   a.duration,
            "cause":      a.cause,
            "zone":       a.zone,
            "created_by": user["id"],
        }
        for a in arrets
    ]
    res = db.table("arrets").insert(rows).execute()
    # Vérifier les alertes et créer sessions RCA si besoin
    await _sync_alerts(db, user)
    return res.data

@router.delete("/arrets/{arret_id}")
async def delete_arret(arret_id: str, user=Depends(get_current_user)):
    db = get_db()
    db.table("arrets").delete().eq("id", arret_id).eq("site_id", user["site_id"]).execute()
    return {"ok": True}

@router.get("/seuils")
async def get_seuils(user=Depends(get_current_user)):
    db = get_db()
    res = db.table("seuils").select("*").eq("site_id", user["site_id"]).single().execute()
    return res.data

@router.put("/seuils")
async def update_seuils(seuils: SeuilsIn, user=Depends(get_current_user)):
    db = get_db()
    res = db.table("seuils").update(seuils.model_dump()).eq("site_id", user["site_id"]).execute()
    return res.data

async def _sync_alerts(db, user):
    from datetime import timedelta, timezone
    site_id = user["site_id"]

    seuils_res = db.table("seuils").select("*").eq("site_id", site_id).single().execute()
    seuils = seuils_res.data or {}

    n1_cumul = seuils.get("n1_cumul", 8)
    n1_freq  = seuils.get("n1_frequence", 3)
    n1_hor   = seuils.get("n1_horizon", 30)
    n2_cumul = seuils.get("n2_cumul", 24)
    n2_freq  = seuils.get("n2_frequence", 5)
    n2_hor   = seuils.get("n2_horizon", 30)

    arrets_res = db.table("arrets").select("*").eq("site_id", site_id).execute()
    arrets = arrets_res.data or []

    sessions_res = db.table("rca_sessions").select("id,equip_id,statut,cause_arret").eq("site_id", site_id).neq("statut", "cloturee").execute()
    active_sessions = {s["equip_id"]: s for s in (sessions_res.data or [])}

    now = datetime.now(timezone.utc)
    equip_ids = list({a["equip_id"] for a in arrets})

    for equip_id in equip_ids:
        cutoff_n2 = now - timedelta(days=n2_hor)
        cutoff_n1 = now - timedelta(days=n1_hor)
        equip_arrets = [a for a in arrets if a["equip_id"] == equip_id]

        def in_window(a, cutoff):
            try:
                t = datetime.fromisoformat(a["start_time"].replace("Z", "+00:00"))
                return t >= cutoff
            except:
                return False

        arrets_n2 = [a for a in equip_arrets if in_window(a, cutoff_n2)]
        arrets_n1 = [a for a in equip_arrets if in_window(a, cutoff_n1)]

        cumul_n2 = sum(float(a["duration"]) for a in arrets_n2)
        freq_n2  = len(arrets_n2)
        cumul_n1 = sum(float(a["duration"]) for a in arrets_n1)
        freq_n1  = len(arrets_n1)

        is_alert = cumul_n2 >= n2_cumul or freq_n2 >= n2_freq
        is_watch = cumul_n1 >= n1_cumul or freq_n1 >= n1_freq

        if not is_alert and not is_watch:
            continue

        niveau = 2 if is_alert else 1
        trigger = equip_arrets[-1] if equip_arrets else {}

        if equip_id in active_sessions:
            s = active_sessions[equip_id]
            if not s.get("cause_arret") and trigger.get("cause"):
                db.table("rca_sessions").update({"cause_arret": trigger["cause"]}).eq("id", s["id"]).execute()
            continue

        today = now.strftime("%Y-%m-%d")
        rca_id = f"RCA-{now.strftime('%Y%m%d')}-{hash(equip_id) % 900 + 100}"
        db.table("rca_sessions").insert({
            "id": rca_id,
            "equip_id": equip_id,
            "titre": equip_id,
            "zone": trigger.get("zone", ""),
            "date_ouverture": today,
            "niveau": niveau,
            "source": "TUM",
            "statut": "non-commencee",
            "methode": "5why" if niveau == 2 else "kaizen",
            "cause_arret": trigger.get("cause", ""),
            "phenomene": trigger.get("cause", ""),
            "participants": [],
            "noeuds": [],
            "actions_generees": [],
            "site_id": site_id,
            "created_by": user["id"],
        }).execute()
