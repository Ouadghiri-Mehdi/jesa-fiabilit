from typing import Optional, Any

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text

from db import get_db
from auth import get_current_user

router = APIRouter(prefix="/api/config", tags=["Config"])


# ─── Équipements ─────────────────────────────────────────────────────────────

class EquipementIn(BaseModel):
    id: str
    designation: Optional[str] = None
    famille: Optional[str] = None
    entite: Optional[str] = None
    actif: Optional[int] = 1


@router.get("/equipements")
async def get_equipements(user=Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        text("SELECT * FROM equipements WHERE site_id = :site_id ORDER BY id"),
        {"site_id": user["site_id"]},
    ).mappings().fetchall()
    return [dict(r) for r in rows]


@router.post("/equipements")
async def create_equipement(
    eq: EquipementIn,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    existing = db.execute(
        text("SELECT id FROM equipements WHERE id = :id"),
        {"id": eq.id},
    ).fetchone()
    if existing:
        raise HTTPException(status_code=409, detail=f"Équipement {eq.id} existe déjà")

    db.execute(
        text(
            "INSERT INTO equipements (id, designation, famille, entite, site_id, actif) "
            "VALUES (:id, :designation, :famille, :entite, :site_id, :actif)"
        ),
        {**eq.model_dump(), "site_id": user["site_id"]},
    )
    db.commit()

    row = db.execute(
        text("SELECT * FROM equipements WHERE id = :id"),
        {"id": eq.id},
    ).mappings().fetchone()
    return dict(row) if row else {}


@router.put("/equipements/{eq_id}")
async def update_equipement(
    eq_id: str,
    eq: EquipementIn,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    data = eq.model_dump(exclude_unset=True)
    data.pop("id", None)
    if not data:
        raise HTTPException(status_code=400, detail="Aucun champ à mettre à jour")

    set_clause = ", ".join(f"`{k}` = :{k}" for k in data)
    data["_id"] = eq_id
    data["_site_id"] = user["site_id"]

    db.execute(
        text(f"UPDATE equipements SET {set_clause} WHERE id = :_id AND site_id = :_site_id"),
        data,
    )
    db.commit()

    row = db.execute(
        text("SELECT * FROM equipements WHERE id = :id"),
        {"id": eq_id},
    ).mappings().fetchone()
    return dict(row) if row else {}


@router.delete("/equipements/{eq_id}")
async def delete_equipement(
    eq_id: str,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    # Soft delete (actif = 0) to preserve foreign key integrity in arrets/rca_sessions
    db.execute(
        text("UPDATE equipements SET actif = 0 WHERE id = :id AND site_id = :site_id"),
        {"id": eq_id, "site_id": user["site_id"]},
    )
    db.commit()
    return {"ok": True}


# ─── Causes d'arrêt ──────────────────────────────────────────────────────────

class CausesBulkIn(BaseModel):
    libelles: list[str]


@router.get("/causes")
async def get_causes(user=Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            "SELECT * FROM causes_arret "
            "WHERE is_global = 1 OR site_id = :site_id "
            "ORDER BY libelle"
        ),
        {"site_id": user["site_id"]},
    ).mappings().fetchall()
    return [dict(r) for r in rows]


@router.post("/causes/bulk")
async def replace_causes(body: CausesBulkIn, user=Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(
        text("DELETE FROM causes_arret WHERE site_id = :site_id AND is_global = 0"),
        {"site_id": user["site_id"]},
    )
    for lib in body.libelles:
        lib = lib.strip()
        if lib:
            db.execute(
                text("INSERT INTO causes_arret (libelle, site_id, is_global) VALUES (:libelle, :site_id, 0)"),
                {"libelle": lib, "site_id": user["site_id"]},
            )
    db.commit()
    return {"ok": True, "count": len(body.libelles)}


@router.delete("/causes/{cause_id}")
async def delete_cause(cause_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(
        text("DELETE FROM causes_arret WHERE id = :id AND site_id = :site_id AND is_global = 0"),
        {"id": cause_id, "site_id": user["site_id"]},
    )
    db.commit()
    return {"ok": True}


# ─── Participants référentiel ─────────────────────────────────────────────────

class ParticipantIn(BaseModel):
    nom: str
    fonction: Optional[str] = ""


class ParticipantsBulkIn(BaseModel):
    participants: list[ParticipantIn]


@router.get("/participants")
async def get_participants(user=Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        text(
            "SELECT * FROM participants_ref "
            "WHERE site_id = :site_id "
            "ORDER BY nom"
        ),
        {"site_id": user["site_id"]},
    ).mappings().fetchall()
    return [dict(r) for r in rows]


@router.post("/participants/bulk")
async def replace_participants(body: ParticipantsBulkIn, user=Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(
        text("DELETE FROM participants_ref WHERE site_id = :site_id"),
        {"site_id": user["site_id"]},
    )
    for p in body.participants:
        nom = p.nom.strip()
        if nom:
            db.execute(
                text("INSERT INTO participants_ref (nom, fonction, site_id) VALUES (:nom, :fonction, :site_id)"),
                {"nom": nom, "fonction": (p.fonction or "").strip(), "site_id": user["site_id"]},
            )
    db.commit()
    return {"ok": True, "count": len(body.participants)}


@router.delete("/participants/{participant_id}")
async def delete_participant(participant_id: int, user=Depends(get_current_user), db: Session = Depends(get_db)):
    db.execute(
        text("DELETE FROM participants_ref WHERE id = :id AND site_id = :site_id"),
        {"id": participant_id, "site_id": user["site_id"]},
    )
    db.commit()
    return {"ok": True}


# ─── Équipements bulk (import liste complète) ─────────────────────────────────

@router.post("/equipements/bulk")
async def bulk_equipements(
    equips: list[EquipementIn],
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not equips:
        return {"ok": True, "created": 0, "updated": 0}

    for eq in equips:
        eq_id = (eq.id or "").strip()
        if not eq_id:
            continue
        db.execute(
            text(
                "INSERT INTO equipements (id, designation, famille, entite, site_id, actif) "
                "VALUES (:id, :des, :famille, :entite, :site_id, 1) "
                "ON DUPLICATE KEY UPDATE "
                "designation = VALUES(designation), "
                "famille     = VALUES(famille), "
                "entite      = VALUES(entite), "
                "actif       = 1"
            ),
            {
                "id":      eq_id,
                "des":     eq.designation or eq_id,
                "famille": eq.famille,
                "entite":  eq.entite,
                "site_id": user["site_id"],
            },
        )
    db.commit()
    return {"ok": True}


# ─── Historique de référence (Data2 — base IA) ───────────────────────────────

class HistoriqueRefIn(BaseModel):
    poste_technique:     str
    designation:         Optional[str]   = None
    niveau:              Optional[str]   = None
    categorie:           Optional[str]   = None
    date_debut:          Optional[str]   = None
    date_fin:            Optional[str]   = None
    heure_debut:         Optional[str]   = None
    heure_fin:           Optional[str]   = None
    duree_arret_minutes: Optional[float] = None
    zone_geographique:   Optional[str]   = None
    cause_arret:         Optional[str]   = None
    description:         Optional[str]   = None


@router.post("/historique-reference/bulk")
async def bulk_historique_reference(
    data: list[HistoriqueRefIn],
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not data:
        return {"ok": True, "count": 0}
    def _calc_duree(hd: str | None, hf: str | None) -> float | None:
        """Calcule la durée en minutes depuis heure_debut / heure_fin."""
        if not hd or not hf:
            return None
        try:
            def to_min(t: str) -> int:
                parts = t.strip().split(":")
                return int(parts[0]) * 60 + int(parts[1])
            dur = to_min(hf) - to_min(hd)
            if dur < 0:
                dur += 1440  # arrêt de nuit
            return float(dur) if dur > 0 else None
        except Exception:
            return None

    for row in data:
        # Durée : utiliser la valeur fournie, sinon calculer depuis heure_debut/heure_fin
        duree = row.duree_arret_minutes
        if duree is None:
            duree = _calc_duree(row.heure_debut, row.heure_fin)

        db.execute(
            text(
                "INSERT INTO historique_reference "
                "(poste_technique, designation, niveau, categorie, "
                "date_debut, date_fin, heure_debut, heure_fin, duree_arret_minutes, "
                "zone_geographique, cause_arret, description, site_id) "
                "VALUES (:pt, :des, :niv, :cat, :dd, :df, :hd, :hf, :dur, "
                ":zone, :cause, :desc, :site_id)"
            ),
            {
                "pt":      row.poste_technique,
                "des":     row.designation,
                "niv":     row.niveau,
                "cat":     row.categorie,
                "dd":      row.date_debut        or None,
                "df":      row.date_fin          or None,
                "hd":      row.heure_debut       or None,
                "hf":      row.heure_fin         or None,
                "dur":     duree,
                "zone":    row.zone_geographique or None,
                "cause":   row.cause_arret       or None,
                "desc":    row.description       or None,
                "site_id": user["site_id"],
            },
        )
    db.commit()
    return {"ok": True, "count": len(data)}


# ─── Sites (lecture seule pour le frontend) ───────────────────────────────────

@router.get("/sites")
async def get_sites(user=Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(text("SELECT * FROM sites ORDER BY nom")).mappings().fetchall()
    return [dict(r) for r in rows]
