import json
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from db import get_db
from auth import get_current_user

router = APIRouter(prefix="/api/rca", tags=["RCA"])


# ─── Schémas ────────────────────────────────────────────────────────────────

class SessionIn(BaseModel):
    id: Optional[str] = None
    titre: Optional[str] = None
    methode: Optional[str] = None
    statut: Optional[str] = "non-commencee"
    equip_id: Optional[str] = None
    incident_session_id: Optional[str] = None  # NOUVEAU : lien avec la session d'incident
    niveau: Optional[int] = 2
    source: Optional[str] = "Manuel"
    responsable: Optional[str] = None
    zone: Optional[str] = None
    phenomene: Optional[str] = None
    cause_arret: Optional[str] = None
    date_ouverture: Optional[str] = None
    date_heure_debut: Optional[str] = None
    date_heure_fin: Optional[str] = None
    temps_analyse: Optional[float] = 0
    cumul_arret: Optional[float] = 0
    frequence: Optional[int] = 0
    taux_panne: Optional[float] = 0
    disponibilite: Optional[float] = 100
    participants: Optional[list] = []
    noeuds: Optional[list] = []
    actions_generees: Optional[list] = []


class ActionIn(BaseModel):
    rca_id: str
    cause: Optional[str] = None
    action: str
    responsable: Optional[str] = None
    delai: Optional[str] = None
    statut: Optional[str] = "pas-commence"
    commentaire: Optional[str] = None


class ActionUpdate(BaseModel):
    cause: Optional[str] = None
    action: Optional[str] = None
    responsable: Optional[str] = None
    delai: Optional[str] = None
    statut: Optional[str] = None
    commentaire: Optional[str] = None


# ─── Sessions RCA ────────────────────────────────────────────────────────────

@router.get("/sessions")
async def get_sessions(user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Récupère toutes les sessions RCA du site."""
    rows = db.execute(
        text("""
            SELECT rs.*, a.session_status, a.duration as incident_duration
            FROM rca_sessions rs
            LEFT JOIN arrets a ON rs.incident_session_id = a.session_id
            WHERE rs.site_id = :site_id 
            ORDER BY rs.created_at DESC
        """),
        {"site_id": user["site_id"]},
    ).mappings().fetchall()
    return [_parse_session(dict(r)) for r in rows]


@router.get("/sessions-closed-global")
async def get_closed_sessions_global(user=Depends(get_current_user), db: Session = Depends(get_db)):
    """Toutes les sessions clôturées, tous sites confondus (Vue Globale)."""
    rows = db.execute(
        text(
            "SELECT rs.*, s.nom AS site_nom, a.session_status, a.duration as incident_duration "
            "FROM rca_sessions rs "
            "LEFT JOIN sites s ON rs.site_id = s.id "
            "LEFT JOIN arrets a ON rs.incident_session_id = a.session_id "
            "WHERE rs.statut = 'cloturee' "
            "ORDER BY rs.updated_at DESC, rs.created_at DESC"
        )
    ).mappings().fetchall()
    return [_parse_session(dict(r)) for r in rows]


@router.get("/sessions/for-incident/{incident_session_id}")
async def get_session_by_incident(
    incident_session_id: str, 
    user=Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Récupère la RCA associée à une session d'incident spécifique."""
    row = db.execute(
        text("""
            SELECT rs.*, a.session_status, a.duration as incident_duration
            FROM rca_sessions rs
            LEFT JOIN arrets a ON rs.incident_session_id = a.session_id
            WHERE rs.incident_session_id = :incident_session_id 
            AND rs.site_id = :site_id
        """),
        {"incident_session_id": incident_session_id, "site_id": user["site_id"]},
    ).mappings().fetchone()
    
    if not row:
        return None  # Pas de RCA pour cet incident
    
    return _parse_session(dict(row))


@router.get("/sessions/for-equipment/{equip_id}")
async def get_sessions_by_equipment(
    equip_id: str,
    include_closed: bool = True,
    user=Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    """Récupère toutes les RCA pour un équipement (historique complet)."""
    
    closed_filter = "" if include_closed else "AND rs.statut != 'cloturee'"
    
    rows = db.execute(
        text(f"""
            SELECT rs.*, a.session_status, a.duration as incident_duration,
                   a.start_time as incident_start_time
            FROM rca_sessions rs
            LEFT JOIN arrets a ON rs.incident_session_id = a.session_id
            WHERE rs.equip_id = :equip_id 
            AND rs.site_id = :site_id
            {closed_filter}
            ORDER BY a.start_time DESC
        """),
        {"equip_id": equip_id, "site_id": user["site_id"]},
    ).mappings().fetchall()
    
    return [_parse_session(dict(r)) for r in rows]


@router.get("/sessions/{session_id}")
async def get_session(
    session_id: str, 
    user=Depends(get_current_user), 
    db: Session = Depends(get_db)
):
    row = db.execute(
        text("""
            SELECT rs.*, a.session_status, a.duration as incident_duration
            FROM rca_sessions rs
            LEFT JOIN arrets a ON rs.incident_session_id = a.session_id
            WHERE rs.id = :id AND rs.site_id = :site_id
        """),
        {"id": session_id, "site_id": user["site_id"]},
    ).mappings().fetchone()
    
    if not row:
        raise HTTPException(status_code=404, detail="Session introuvable")
    return _parse_session(dict(row))


@router.post("/sessions")
async def create_session(
    session: SessionIn,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    now = datetime.utcnow()
    rca_id = session.id or f"RCA-{now.strftime('%Y%m%d')}-{abs(hash(now.isoformat())) % 900 + 100}"

    # Si un incident_session_id est fourni, vérifier qu'il existe et n'a pas déjà une RCA
    if session.incident_session_id:
        existing = db.execute(
            text("""
                SELECT id FROM rca_sessions 
                WHERE incident_session_id = :incident_session_id 
                AND site_id = :site_id
            """),
            {"incident_session_id": session.incident_session_id, "site_id": user["site_id"]},
        ).fetchone()
        
        if existing:
            raise HTTPException(
                status_code=409, 
                detail=f"Une RCA existe déjà pour cet incident (session {session.incident_session_id})"
            )
        
        # Récupérer les infos de l'incident pour pré-remplir
        incident = db.execute(
            text("""
                SELECT equip_id, cause, zone, duration 
                FROM arrets 
                WHERE session_id = :session_id
            """),
            {"session_id": session.incident_session_id},
        ).mappings().fetchone()
        
        if incident:
            session.equip_id = session.equip_id or incident["equip_id"]
            session.cause_arret = session.cause_arret or incident["cause"]
            session.zone = session.zone or incident["zone"]
            session.cumul_arret = session.cumul_arret or float(incident["duration"])

    db.execute(
        text(
            "INSERT INTO rca_sessions "
            "(id, equip_id, site_id, incident_session_id, titre, methode, statut, niveau, source, "
            "responsable, zone, phenomene, cause_arret, date_ouverture, "
            "date_heure_debut, date_heure_fin, temps_analyse, cumul_arret, frequence, "
            "taux_panne, disponibilite, participants, noeuds, actions_generees, created_by) "
            "VALUES "
            "(:id, :equip_id, :site_id, :incident_session_id, :titre, :methode, :statut, :niveau, :source, "
            ":responsable, :zone, :phenomene, :cause_arret, :date_ouverture, "
            ":date_heure_debut, :date_heure_fin, :temps_analyse, :cumul_arret, :frequence, "
            ":taux_panne, :disponibilite, :participants, :noeuds, :actions_generees, :created_by)"
        ),
        {
            "id": rca_id,
            "equip_id": session.equip_id,
            "site_id": user["site_id"],
            "incident_session_id": session.incident_session_id,
            "titre": session.titre or session.equip_id or "Sans titre",
            "methode": session.methode or "5why",
            "statut": session.statut or "non-commencee",
            "niveau": session.niveau or 2,
            "source": session.source or "Manuel",
            "responsable": session.responsable,
            "zone": session.zone,
            "phenomene": session.phenomene,
            "cause_arret": session.cause_arret,
            "date_ouverture": session.date_ouverture or now.strftime("%Y-%m-%d"),
            "date_heure_debut": session.date_heure_debut,
            "date_heure_fin": session.date_heure_fin,
            "temps_analyse": session.temps_analyse or 0,
            "cumul_arret": session.cumul_arret or 0,
            "frequence": session.frequence or 0,
            "taux_panne": session.taux_panne or 0,
            "disponibilite": session.disponibilite if session.disponibilite is not None else 100,
            "participants": json.dumps(session.participants or []),
            "noeuds": json.dumps(session.noeuds or []),
            "actions_generees": json.dumps(session.actions_generees or []),
            "created_by": user["id"],
        },
    )
    db.commit()

    row = db.execute(
        text("SELECT * FROM rca_sessions WHERE id = :id"),
        {"id": rca_id},
    ).mappings().fetchone()
    return _parse_session(dict(row)) if row else {}


@router.put("/sessions/{session_id}")
async def update_session(
    session_id: str,
    session: SessionIn,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = session.model_dump(exclude_unset=True)
    data.pop("id", None)

    if "participants" in data:
        data["participants"] = json.dumps(data["participants"])
    if "noeuds" in data:
        data["noeuds"] = json.dumps(data["noeuds"])
    if "actions_generees" in data:
        data["actions_generees"] = json.dumps(data["actions_generees"])

    if not data:
        raise HTTPException(status_code=400, detail="Aucun champ à mettre à jour")

    set_clause = ", ".join(f"`{k}` = :{k}" for k in data)
    data["_id"] = session_id
    data["_site_id"] = user["site_id"]

    db.execute(
        text(f"UPDATE rca_sessions SET {set_clause} WHERE id = :_id AND site_id = :_site_id"),
        data,
    )
    db.commit()

    row = db.execute(
        text("SELECT * FROM rca_sessions WHERE id = :id"),
        {"id": session_id},
    ).mappings().fetchone()
    return _parse_session(dict(row)) if row else {}


@router.put("/sessions/{session_id}/close")
async def close_rca_session(
    session_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Clôture une session RCA et marque également l'incident associé comme CLOSED."""
    
    # Récupérer la session RCA
    rca = db.execute(
        text("SELECT incident_session_id FROM rca_sessions WHERE id = :id AND site_id = :site_id"),
        {"id": session_id, "site_id": user["site_id"]},
    ).mappings().fetchone()
    
    if not rca:
        raise HTTPException(status_code=404, detail="Session RCA introuvable")
    
    # Clôturer la RCA
    db.execute(
        text("UPDATE rca_sessions SET statut = 'cloturee', updated_at = now() WHERE id = :id"),
        {"id": session_id},
    )
    
    # Clôturer également l'incident associé (s'il existe et est encore OPEN)
    if rca["incident_session_id"]:
        db.execute(
            text("""
                UPDATE arrets 
                SET session_status = 'CLOSED', 
                    session_closed_at = now(), 
                    session_closed_by = :closed_by
                WHERE session_id = :session_id AND session_status = 'OPEN'
            """),
            {"session_id": rca["incident_session_id"], "closed_by": user["id"]},
        )
    
    db.commit()
    
    return {"ok": True, "message": "RCA et incident clôturés avec succès"}


@router.delete("/sessions/{session_id}")
async def delete_session(
    session_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.execute(
        text("DELETE FROM rca_sessions WHERE id = :id AND site_id = :site_id"),
        {"id": session_id, "site_id": user["site_id"]},
    )
    db.commit()
    return {"ok": True}


# ─── Actions correctives ─────────────────────────────────────────────────────

@router.get("/actions")
async def get_actions(user=Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            "SELECT a.*, r.titre AS rca_titre, r.equip_id, r.incident_session_id "
            "FROM rca_actions a "
            "JOIN rca_sessions r ON a.rca_id = r.id "
            "WHERE a.site_id = :site_id "
            "ORDER BY a.delai ASC, a.created_at DESC"
        ),
        {"site_id": user["site_id"]},
    ).mappings().fetchall()
    return [dict(r) for r in rows]


@router.get("/actions/rca/{rca_id}")
async def get_actions_by_rca(rca_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            "SELECT * FROM rca_actions WHERE rca_id = :rca_id AND site_id = :site_id "
            "ORDER BY delai ASC"
        ),
        {"rca_id": rca_id, "site_id": user["site_id"]},
    ).mappings().fetchall()
    return [dict(r) for r in rows]


@router.post("/actions")
async def create_action(
    action: ActionIn,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    rca = db.execute(
        text("""
            SELECT id, equip_id, incident_session_id 
            FROM rca_sessions 
            WHERE id = :id AND site_id = :site_id
        """),
        {"id": action.rca_id, "site_id": user["site_id"]},
    ).mappings().fetchone()
    
    if not rca:
        raise HTTPException(status_code=404, detail="Session RCA introuvable")

    result = db.execute(
        text(
            "INSERT INTO rca_actions "
            "(rca_id, equip_id, site_id, cause, action, responsable, delai, statut, commentaire) "
            "VALUES (:rca_id, :equip_id, :site_id, :cause, :action, :responsable, :delai, :statut, :commentaire)"
        ),
        {
            "rca_id": action.rca_id,
            "equip_id": rca["equip_id"],
            "site_id": user["site_id"],
            "cause": action.cause,
            "action": action.action,
            "responsable": action.responsable,
            "delai": action.delai,
            "statut": action.statut or "pas-commence",
            "commentaire": action.commentaire,
        },
    )
    db.commit()

    row = db.execute(
        text("SELECT * FROM rca_actions WHERE id = :id"),
        {"id": result.lastrowid},
    ).mappings().fetchone()
    return dict(row) if row else {}


@router.put("/actions/{action_id}")
async def update_action(
    action_id: int,
    action: ActionUpdate,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = action.model_dump(exclude_unset=True)
    if not data:
        raise HTTPException(status_code=400, detail="Aucun champ à mettre à jour")

    set_clause = ", ".join(f"`{k}` = :{k}" for k in data)
    data["_id"] = action_id
    data["_site_id"] = user["site_id"]

    db.execute(
        text(f"UPDATE rca_actions SET {set_clause} WHERE id = :_id AND site_id = :_site_id"),
        data,
    )
    db.commit()

    row = db.execute(
        text("SELECT * FROM rca_actions WHERE id = :id"),
        {"id": action_id},
    ).mappings().fetchone()
    return dict(row) if row else {}


@router.delete("/actions/{action_id}")
async def delete_action(
    action_id: int,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    db.execute(
        text("DELETE FROM rca_actions WHERE id = :id AND site_id = :site_id"),
        {"id": action_id, "site_id": user["site_id"]},
    )
    db.commit()
    return {"ok": True}


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _parse_session(d: dict) -> dict:
    for field in ("participants", "noeuds", "actions_generees"):
        val = d.get(field)
        if isinstance(val, str):
            try:
                d[field] = json.loads(val)
            except (json.JSONDecodeError, TypeError):
                d[field] = []
        elif val is None:
            d[field] = []
    return d