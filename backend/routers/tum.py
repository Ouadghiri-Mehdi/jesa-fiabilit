from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from sqlalchemy import text
import uuid

from db import get_db
from auth import get_current_user

router = APIRouter(prefix="/api/tum", tags=["TUM"])


# ─── Schémas ────────────────────────────────────────────────────────────────

class IncidentStartIn(BaseModel):
    equip_id: str
    start_time: datetime
    duration: float = 0.0
    cause: Optional[str] = None
    zone: Optional[str] = None
    designation: Optional[str] = None
    description: Optional[str] = None


class IncidentAddDurationIn(BaseModel):
    session_id: str
    duration: float  # heures à ajouter


class IncidentCloseIn(BaseModel):
    session_id: str


class SeuilsIn(BaseModel):
    n1_cumul: float
    n1_frequence: int
    n1_horizon: int
    n2_cumul: float
    n2_frequence: int
    n2_horizon: int


# ─── Nouveaux endpoints pour la gestion de sessions ─────────────────────────

@router.post("/incident/start")
async def start_incident(
    data: IncidentStartIn,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Démarre une nouvelle session d'incident pour un équipement."""
    
    # Vérifier qu'il n'y a pas déjà une session OPEN
    existing = db.execute(
        text("SELECT id FROM arrets WHERE equip_id = :equip_id AND site_id = :site_id AND session_status = 'OPEN'"),
        {"equip_id": data.equip_id, "site_id": user["site_id"]},
    ).fetchone()
    
    if existing:
        raise HTTPException(
            status_code=409, 
            detail=f"Un incident est déjà en cours sur cet équipement. Session ID: {existing[0]}"
        )
    
    # Générer un ID de session unique
    session_id = f"SESS-{datetime.now().strftime('%Y%m%d')}-{str(uuid.uuid4())[:8]}"
    
    # Auto-créer l'équipement si inconnu
    eq = db.execute(
        text("SELECT id FROM equipements WHERE id = :id"),
        {"id": data.equip_id},
    ).fetchone()
    if not eq:
        db.execute(
            text("INSERT INTO equipements (id, designation, site_id) VALUES (:id, :id, :site_id)"),
            {"id": data.equip_id, "site_id": user["site_id"]},
        )
    
    # Créer la session d'incident (premier enregistrement d'arrêt)
    db.execute(
        text(
            "INSERT INTO arrets "
            "(session_id, equip_id, site_id, start_time, duration, frequence, session_status, "
            "cause, zone, designation, description, created_by) "
            "VALUES "
            "(:session_id, :equip_id, :site_id, :start_time, :duration, 1, 'OPEN', "
            ":cause, :zone, :designation, :description, :created_by)"
        ),
        {
            "session_id": session_id,
            "equip_id": data.equip_id,
            "site_id": user["site_id"],
            "start_time": data.start_time,
            "duration": data.duration,
            "cause": data.cause,
            "zone": data.zone,
            "designation": data.designation,
            "description": data.description,
            "created_by": user["id"],
        },
    )
    db.commit()

    # Vérifier les seuils dès la création (au cas où la 1ère saisie dépasse déjà N1/N2)
    await _check_thresholds_and_trigger_rca(
        db, user, data.equip_id, session_id, data.duration, 1
    )

    return {
        "session_id": session_id,
        "equip_id": data.equip_id,
        "status": "OPEN",
        "duration": data.duration,
        "message": "Incident démarré avec succès"
    }


@router.post("/incident/add-duration")
async def add_duration(
    data: IncidentAddDurationIn,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Ajoute de la durée à une session d'incident existante."""
    
    session = db.execute(
        text(
            "SELECT id, equip_id, duration, frequence, session_status FROM arrets "
            "WHERE session_id = :session_id"
        ),
        {"session_id": data.session_id},
    ).mappings().fetchone()

    if not session:
        raise HTTPException(status_code=404, detail="Session d'incident introuvable")

    if session["session_status"] != "OPEN":
        raise HTTPException(
            status_code=400,
            detail=f"La session {data.session_id} est déjà clôturée. Impossible d'ajouter de la durée."
        )

    new_duration  = session["duration"]  + data.duration
    new_frequence = (session["frequence"] or 1) + 1

    db.execute(
        text(
            "UPDATE arrets SET duration = :duration, frequence = :frequence "
            "WHERE session_id = :session_id"
        ),
        {
            "duration":   new_duration,
            "frequence":  new_frequence,
            "session_id": data.session_id,
        },
    )
    db.commit()

    # Vérifier les seuils et upgrader la méthode RCA si nécessaire
    await _check_thresholds_and_trigger_rca(
        db, user, session["equip_id"], data.session_id, new_duration, new_frequence
    )

    return {
        "session_id":   data.session_id,
        "new_duration": new_duration,
        "new_frequence": new_frequence,
        "status": "OPEN"
    }


@router.post("/incident/close")
async def close_incident(
    data: IncidentCloseIn,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Clôture une session d'incident. La durée est figée définitivement."""
    
    session = db.execute(
        text(
            "SELECT id, session_status FROM arrets "
            "WHERE session_id = :session_id"
        ),
        {"session_id": data.session_id},
    ).mappings().fetchone()
    
    if not session:
        raise HTTPException(status_code=404, detail="Session d'incident introuvable")
    
    if session["session_status"] == "CLOSED":
        raise HTTPException(status_code=400, detail="La session est déjà clôturée")
    
    db.execute(
        text(
            "UPDATE arrets SET "
            "session_status = 'CLOSED', "
            "session_closed_at = :closed_at, "
            "session_closed_by = :closed_by "
            "WHERE session_id = :session_id"
        ),
        {
            "closed_at": datetime.now(timezone.utc),
            "closed_by": user["id"],
            "session_id": data.session_id,
        },
    )
    db.commit()
    
    return {
        "session_id": data.session_id,
        "status": "CLOSED",
        "message": "Incident clôturé avec succès"
    }


@router.get("/incident/active/{equip_id}")
async def get_active_incident(
    equip_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Récupère la session active (OPEN) pour un équipement."""
    
    session = db.execute(
        text(
            "SELECT session_id, equip_id, start_time, duration, session_status, "
            "cause, zone, designation, description "
            "FROM arrets "
            "WHERE equip_id = :equip_id AND site_id = :site_id AND session_status = 'OPEN'"
        ),
        {"equip_id": equip_id, "site_id": user["site_id"]},
    ).mappings().fetchone()
    
    if not session:
        return {"has_active_incident": False}
    
    return {
        "has_active_incident": True,
        "session_id": session["session_id"],
        "equip_id": session["equip_id"],
        "start_time": session["start_time"],
        "duration": session["duration"],
        "status": session["session_status"],
        "cause": session["cause"],
        "zone": session["zone"],
        "designation": session["designation"],
        "description": session["description"],
    }


@router.get("/incident/history/{equip_id}")
async def get_incident_history(
    equip_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Récupère l'historique complet des incidents (sessions) pour un équipement."""
    
    sessions = db.execute(
        text(
            "SELECT session_id, equip_id, start_time, duration, session_status, "
            "session_closed_at, cause, zone, designation, description "
            "FROM arrets "
            "WHERE equip_id = :equip_id AND site_id = :site_id "
            "ORDER BY start_time DESC"
        ),
        {"equip_id": equip_id, "site_id": user["site_id"]},
    ).mappings().fetchall()
    
    return [
        {
            "session_id": s["session_id"],
            "equip_id": s["equip_id"],
            "start_time": s["start_time"],
            "duration": float(s["duration"]),
            "status": s["session_status"],
            "closed_at": s["session_closed_at"],
            "cause": s["cause"],
            "zone": s["zone"],
        }
        for s in sessions
    ]


# ─── Endpoints existants (adaptés pour compatibilité) ───────────────────────

@router.get("/arrets")
async def get_arrets(user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Retourne tous les arrêts (maintenu pour compatibilité)."""
    rows = db.execute(
        text("SELECT * FROM arrets WHERE site_id = :site_id ORDER BY start_time DESC"),
        {"site_id": user["site_id"]},
    ).mappings().fetchall()
    return [_row(r) for r in rows]


@router.get("/seuils")
async def get_seuils(user=Depends(get_current_user), db: Session = Depends(get_db)):
    row = db.execute(
        text("SELECT * FROM seuils WHERE site_id = :site_id"),
        {"site_id": user["site_id"]},
    ).mappings().fetchone()
    return _row(row) if row else {}


@router.put("/seuils")
async def update_seuils(
    seuils: SeuilsIn,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.execute(
        text(
            "UPDATE seuils SET "
            "n1_cumul = :n1_cumul, n1_frequence = :n1_frequence, n1_horizon = :n1_horizon, "
            "n2_cumul = :n2_cumul, n2_frequence = :n2_frequence, n2_horizon = :n2_horizon "
            "WHERE site_id = :site_id"
        ),
        {**seuils.model_dump(), "site_id": user["site_id"]},
    )
    db.commit()
    row = db.execute(
        text("SELECT * FROM seuils WHERE site_id = :site_id"),
        {"site_id": user["site_id"]},
    ).mappings().fetchone()
    return _row(row) if row else {}


# ─── Fonctions privées ───────────────────────────────────────────────────────

async def _check_thresholds_and_trigger_rca(
    db: Session,
    user: dict,
    equip_id: str,
    session_id: str,
    current_duration: float,
    current_frequence: int = 1,
):
    """Vérifie les seuils N1/N2 (cumul ET fréquence). Crée ou upgrade la RCA."""

    seuils = db.execute(
        text("SELECT * FROM seuils WHERE site_id = :site_id"),
        {"site_id": user["site_id"]},
    ).mappings().fetchone()

    if not seuils:
        return

    niveau  = None
    methode = None

    if current_duration >= seuils["n2_cumul"] or current_frequence >= seuils["n2_frequence"]:
        niveau  = 2
        methode = "5why"
    elif current_duration >= seuils["n1_cumul"] or current_frequence >= seuils["n1_frequence"]:
        niveau  = 1
        methode = "kaizen"

    if not niveau:
        return  # En dessous des seuils — rien à faire

    # Chercher une RCA active pour cette session
    existing_rca = db.execute(
        text(
            "SELECT id, methode, niveau FROM rca_sessions "
            "WHERE incident_session_id = :session_id AND statut != 'cloturee'"
        ),
        {"session_id": session_id},
    ).mappings().fetchone()

    if existing_rca:
        # Upgrader kaizen → 5why si le seuil N2 est maintenant atteint
        if niveau == 2 and existing_rca["niveau"] != 2:
            db.execute(
                text(
                    "UPDATE rca_sessions SET methode = :methode, niveau = :niveau, "
                    "titre = :titre WHERE id = :id"
                ),
                {
                    "methode": methode,
                    "niveau":  niveau,
                    "titre":   f"{equip_id} - {methode}",
                    "id":      existing_rca["id"],
                },
            )
            db.commit()
        return  # RCA déjà existante — pas de doublon

    # Créer une nouvelle RCA
    await _create_rca_for_session(
        db, user, equip_id, session_id, niveau, methode, current_duration
    )


async def _create_rca_for_session(
    db: Session,
    user: dict,
    equip_id: str,
    session_id: str,
    niveau: int,
    methode: str,
    cumul_duration: float,
):
    """Crée une RCA liée à une session d'incident spécifique."""
    
    now = datetime.now(timezone.utc)
    rca_id = f"RCA-{now.strftime('%Y%m%d')}-{abs(hash(session_id + now.isoformat())) % 900 + 100}"
    
    # Récupérer les infos de la session
    session = db.execute(
        text("SELECT cause, zone FROM arrets WHERE session_id = :session_id"),
        {"session_id": session_id},
    ).mappings().fetchone()
    
    db.execute(
        text(
            "INSERT INTO rca_sessions "
            "(id, equip_id, site_id, incident_session_id, titre, niveau, source, statut, methode, "
            "cause_arret, phenomene, zone, date_ouverture, cumul_arret, "
            "participants, noeuds, actions_generees, created_by) "
            "VALUES "
            "(:id, :equip_id, :site_id, :incident_session_id, :titre, :niveau, 'TUM', 'non-commencee', :methode, "
            ":cause_arret, :phenomene, :zone, :date_ouverture, :cumul_arret, "
            "'[]', '[]', '[]', :created_by)"
        ),
        {
            "id": rca_id,
            "equip_id": equip_id,
            "site_id": user["site_id"],
            "incident_session_id": session_id,
            "titre": f"{equip_id} - {methode}",
            "niveau": niveau,
            "methode": methode,
            "cause_arret": session["cause"] if session else "",
            "phenomene": session["cause"] if session else "",
            "zone": session["zone"] if session else "",
            "date_ouverture": now.strftime("%Y-%m-%d"),
            "cumul_arret": cumul_duration,
            "created_by": user["id"],
        },
    )
    db.commit()


def _row(r) -> dict:
    return dict(r)