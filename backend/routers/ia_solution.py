import os, json, re, math
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from sqlalchemy import text
from datetime import datetime, timedelta, timezone
import httpx

from db import get_db
from auth import get_current_user

router = APIRouter(prefix="/api/ia", tags=["IA Solution"])

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL   = "llama-3.1-8b-instant"

PRIOR_ALPHA = 1.0
PRIOR_BETA  = 30.0


# ─── Helpers ─────────────────────────────────────────────────────────────────

def _parse_dt(val):
    if val is None:
        return None
    if isinstance(val, datetime):
        return val.replace(tzinfo=timezone.utc) if val.tzinfo is None else val
    try:
        s = str(val).strip().replace("Z", "+00:00")
        dt = datetime.fromisoformat(s)
        return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt
    except Exception:
        return None

def _safe_float(v, default=0.0):
    try:
        return float(v) if v is not None else default
    except (ValueError, TypeError):
        return default


# ─── Classification & Normalisation industrielle ─────────────────────────────

_PLANIFIE_KEYWORDS = [
    "nettoyage", "inspection", "entretien", "maintenance préventive",
    "maintenance preventive", "planifié", "planifiée", "planifie", "planifiee",
    "systématique", "systematique", "périodique", "periodique",
    "vidange", "graissage", "lubrification",
    "révision planifiée", "revision planifiee",
    "visite préventive", "visite preventive",
    "contrôle planifié", "controle planifie",
    "ria", "ronde", "arrêt planifié", "arret planifie",
    "remplacement planifié", "remplacement planifie",
    "préventif", "preventif", "préventive", "preventive",
    " pm ", "pm ", "p.m.", "travaux d'entretien", "travaux entretien",
]

# Patterns de normalisation : (regex, label standard)
_NORM_PATTERNS = [
    (r"d[eé]faut[^\w]*eau[^\w]*bourrage",     "Défaut eau de bourrage"),
    (r"d[eé]faut[^\w]*bourrage",              "Défaut eau de bourrage"),
    (r"vibration[^\w]*palier|palier[^\w]*vibration",         "Vibration palier"),
    (r"vibration[^\w]*roulement|roulement[^\w]*vibration",   "Vibration roulement"),
    (r"vibration[^\w]*balourd|balourd[^\w]*vibration",       "Vibration balourd"),
    (r"vibration",                            "Vibration excessive"),
    (r"fuite[^\w]*huile|huile[^\w]*fuite",    "Fuite huile"),
    (r"fuite[^\w]*eau|eau[^\w]*fuite",        "Fuite eau"),
    (r"fuite[^\w]*joint|joint[^\w]*fuite",    "Fuite joint"),
    (r"fuite[^\w]*presse[^\w]*[eé]toupe",     "Fuite presse-étoupe"),
    (r"fuite[^\w]*garniture",                 "Fuite garniture mécanique"),
    (r"fuite",                                "Fuite"),
    (r"surchauffe[^\w]*moteur|moteur[^\w]*surchauffe",       "Surchauffe moteur"),
    (r"surchauffe[^\w]*palier|palier[^\w]*surchauffe",       "Surchauffe palier"),
    (r"surchauffe[^\w]*roulement|roulement[^\w]*surchauffe", "Surchauffe roulement"),
    (r"surchauffe",                           "Surchauffe"),
    (r"blocage[^\w]*rotor|rotor[^\w]*blocage","Blocage rotor"),
    (r"blocage[^\w]*impulseur",               "Blocage impulseur"),
    (r"blocage",                              "Blocage mécanique"),
    (r"d[eé]clenchement.{0,40}surcharge|surcharge.{0,40}d[eé]clenchement", "Déclenchement surcharge"),
    (r"d[eé]clenchement.{0,40}fusible",        "Déclenchement surcharge"),
    (r"d[eé]clenchement.{0,40}thermique|thermique.{0,40}d[eé]clenchement", "Déclenchement thermique"),
    (r"d[eé]clenchement.{0,40}[eé]l[eé]vateur","Déclenchement élévateur"),
    (r"d[eé]clenchement.{0,40}moteur",         "Déclenchement moteur"),
    (r"d[eé]clenchement.{0,40}pompe",          "Déclenchement pompe"),
    (r"d[eé]clenchement.{0,40}tableau|tableau.{0,40}d[eé]clenchement", "Déclenchement électrique"),
    (r"d[eé]clenchement.{0,40}alimentation",   "Déclenchement électrique"),
    (r"d[eé]clenchement",                      "Déclenchement"),
    (r"d[eé]faut[^\w]*alimentation[^\w]*[eé]lectrique",      "Défaut alimentation électrique"),
    (r"d[eé]faut[^\w]*[eé]lectrique|[eé]lectrique[^\w]*d[eé]faut",       "Défaut électrique"),
    (r"panne[^\w]*[eé]lectrique|[eé]lectrique[^\w]*panne",   "Panne électrique"),
    (r"usure[^\w]*garniture|garniture[^\w]*usure",           "Usure garniture"),
    (r"usure[^\w]*joint|joint[^\w]*usure",    "Usure joint"),
    (r"usure[^\w]*palier|palier[^\w]*usure",  "Usure palier"),
    (r"usure",                                "Usure mécanique"),
    (r"corrosion",                            "Corrosion"),
    (r"casse[^\w]*arbre|arbre[^\w]*casse|rupture[^\w]*arbre|arbre[^\w]*rupture", "Rupture arbre"),
    (r"rupture[^\w]*accouplement|accouplement[^\w]*rupture",  "Rupture accouplement"),
    (r"compensateur",                         "Défaillance compensateur"),
    (r"rupture",                              "Rupture mécanique"),
    (r"casse",                                "Casse mécanique"),
    (r"bruit[^\w]*anormal|anormal[^\w]*bruit","Bruit anormal"),
    (r"bruit",                                "Bruit anormal"),
    (r"cavitation",                           "Cavitation pompe"),
    (r"manque[^\w]*d['’]eau|absence[^\w]*d['’]eau","Manque d'eau"),
    (r"chute[^\w]*pression|perte[^\w]*pression",             "Chute de pression"),
    (r"perte[^\w]*d[eé]bit|chute[^\w]*d[eé]bit",            "Perte de débit"),
    (r"coupure[^\w]*[eé]lectrique",           "Coupure électrique"),
    (r"surcharge",                            "Surcharge mécanique"),
    (r"d[eé]faut[^\w]*roulement|roulement[^\w]*d[eé]faut",  "Défaut roulement"),
    (r"d[eé]faut[^\w]*palier|palier[^\w]*d[eé]faut",        "Défaut palier"),
    (r"d[eé]faut[^\w]*joint|joint[^\w]*d[eé]faut",          "Défaut joint"),
    (r"changement[^\w]*pompe|remplacement[^\w]*pompe",       "Remplacement pompe"),
    (r"d[eé]faut[^\w]*pompe|pompe[^\w]*d[eé]faut",          "Défaut pompe"),
]

# Regex nettoyage générique : codes équipements, pourcentages, identifiants
_CLEANUP_RE = re.compile(
    r'\b[A-Z]{2,4}\s*\d{1,4}\b'       # ex: ACP 28, PP3, DN900
    r'|\d+\s*%'                        # ex: 28%
    r'|\b(n°|no\.?|num\.?)\s*\d+\b'   # ex: n°3
    r'|\s{2,}',
    re.IGNORECASE,
)


def _classify_event(cause: str) -> str:
    """Retourne 'PLANIFIE' ou 'DEFAILLANCE' selon les mots-clés de la cause."""
    if not cause or not cause.strip():
        return "DEFAILLANCE"
    lower = cause.lower()
    for kw in _PLANIFIE_KEYWORDS:
        if kw in lower:
            return "PLANIFIE"
    return "DEFAILLANCE"


def _normalize_failure_mode(cause: str) -> str:
    """Normalise un mode de défaillance vers un label standard industriel."""
    if not cause or not cause.strip():
        return "Non renseigné"
    lower = cause.lower()
    for pattern, label in _NORM_PATTERNS:
        if re.search(pattern, lower):
            return label
    # Nettoyage générique : supprimer codes équipements et identifiants
    cleaned = _CLEANUP_RE.sub(' ', cause).strip()
    return cleaned[:60].strip() if cleaned else cause[:60].strip()


async def _groq_json(system: str, user: str, max_tokens: int = 1400) -> dict:
    import asyncio, logging
    if not GROQ_API_KEY:
        raise HTTPException(503, "Service IA non configuré (GROQ_API_KEY manquant)")

    payload = {
        "model": GROQ_MODEL,
        "messages": [
            {"role": "system", "content": system},
            {"role": "user",   "content": user},
        ],
        "max_tokens": max_tokens,
        "temperature": 0.2,
    }
    headers = {"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"}

    # ── Retry automatique sur 429 (rate limit Groq) ──────────────────────────
    MAX_ATTEMPTS = 4
    for attempt in range(MAX_ATTEMPTS):
        async with httpx.AsyncClient(timeout=60) as client:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers=headers, json=payload,
            )

        if resp.status_code == 429:
            if attempt < MAX_ATTEMPTS - 1:
                # Respecter l'en-tête retry-after si présent, sinon backoff exponentiel
                retry_after = float(resp.headers.get("retry-after", 2 ** attempt * 3))
                wait = min(retry_after, 20)   # max 20 s d'attente
                logging.warning(f"[GROQ] 429 rate limit — attente {wait:.1f}s (tentative {attempt+1}/{MAX_ATTEMPTS})")
                await asyncio.sleep(wait)
                continue
            raise HTTPException(429, "Quota Groq dépassé — réessayez dans quelques secondes")

        if resp.status_code != 200:
            raise HTTPException(502, f"Erreur Groq {resp.status_code} : {resp.text[:300]}")

        # ── Parsing JSON ─────────────────────────────────────────────────────
        data   = resp.json()
        choice = data.get("choices", [{}])[0]
        finish = choice.get("finish_reason", "")
        raw    = (choice.get("message") or {}).get("content", "").strip()

        if finish == "length":
            logging.warning(f"[GROQ] JSON potentiellement tronqué (finish=length, max_tokens={max_tokens})")

        match = re.search(r'\{[\s\S]*\}', raw)
        if not match:
            raise HTTPException(502, f"Réponse IA invalide (finish={finish})")
        try:
            return json.loads(match.group())
        except json.JSONDecodeError as e:
            raise HTTPException(502, f"JSON IA malformé (finish={finish}) : {str(e)[:100]}")


# ─── Réseau neuronal MLP ─────────────────────────────────────────────────────

def _extract_nn_features(ref_rows: list, tum_rows: list, zone_cats: dict, cat_cats: dict):
    """Construit un vecteur de 6 features pour un équipement."""
    src_ref = bool(ref_rows)
    rows    = ref_rows if src_ref else tum_rows
    if not rows:
        return None

    freq = len(rows) / 2.0  # fréquence annuelle estimée sur 2 ans

    durs = []
    for r in rows:
        d = _safe_float(r.get("duree_arret_minutes", 0)) / 60.0 if src_ref \
            else _safe_float(r.get("duration", 0))
        if d > 0:
            durs.append(d)

    avg_dur = sum(durs) / len(durs) if durs else 0.0
    std_dur = (sum((x - avg_dur) ** 2 for x in durs) / len(durs)) ** 0.5 if len(durs) > 1 else 0.0

    causes  = set(r.get("cause_arret" if src_ref else "cause", "") or "" for r in rows)
    causes.discard("")
    zone    = (rows[0].get("zone_geographique" if src_ref else "zone") or "").strip()
    cat     = (rows[0].get("categorie") or "").strip()

    return [freq, avg_dur, std_dur, len(causes),
            zone_cats.get(zone, 0), cat_cats.get(cat, 0)]


def _build_nn_model(ref_rows_all: list):
    """
    Entraîne un MLPRegressor sur toutes les lignes de historique_reference.
    Retourne (pipeline, zone_cats, cat_cats) ou None si données insuffisantes.
    """
    try:
        import numpy as np
        from sklearn.neural_network import MLPRegressor
        from sklearn.preprocessing import StandardScaler
        from sklearn.pipeline import Pipeline
        from collections import defaultdict
    except ImportError:
        return None

    if len(ref_rows_all) < 15:
        return None

    zones     = sorted(set((r.get("zone_geographique") or "").strip() for r in ref_rows_all))
    cats      = sorted(set((r.get("categorie") or "").strip() for r in ref_rows_all))
    zone_cats = {z: i for i, z in enumerate(zones)}
    cat_cats  = {c: i for i, c in enumerate(cats)}

    groups = defaultdict(list)
    for r in ref_rows_all:
        pt = (r.get("poste_technique") or "").strip()
        if pt:
            groups[pt].append(r)

    if len(groups) < 8:
        return None

    X, y = [], []
    for rows in groups.values():
        feats = _extract_nn_features(rows, [], zone_cats, cat_cats)
        if feats is None:
            continue
        freq, avg_dur, _, n_causes, *_ = feats
        # Cible : combinaison normalisée fréquence + durée + diversité modes
        risk = min(1.0, 0.45 * min(freq / 6.0, 1.0)
                      + 0.40 * min(avg_dur / 8.0, 1.0)
                      + 0.15 * min(n_causes / 5.0, 1.0))
        X.append(feats)
        y.append(risk)

    if len(X) < 8:
        return None

    import numpy as np
    pipeline = Pipeline([
        ("scaler", StandardScaler()),
        ("mlp", MLPRegressor(
            hidden_layer_sizes=(32, 16),
            activation="relu",
            solver="adam",
            max_iter=500,
            random_state=42,
            early_stopping=True,
            validation_fraction=0.15,
            n_iter_no_change=20,
        )),
    ])
    try:
        pipeline.fit(np.array(X, dtype=float), np.array(y, dtype=float))
        return pipeline, zone_cats, cat_cats
    except Exception:
        return None


def _nn_predict(tum_arrets: list, ref_rows: list, nn_model_data) -> float | None:
    """Retourne le score MLP pour un équipement (0-1), ou None si modèle absent."""
    if nn_model_data is None:
        return None
    try:
        import numpy as np
        pipeline, zone_cats, cat_cats = nn_model_data
        feats = _extract_nn_features(ref_rows, tum_arrets, zone_cats, cat_cats)
        if feats is None:
            return None
        score = float(pipeline.predict(np.array([feats], dtype=float))[0])
        return max(0.0, min(1.0, score))
    except Exception:
        return None


# ─── Algorithme prédiction ────────────────────────────────────────────────────

def _parse_date_simple(val):
    if val is None:
        return None
    if isinstance(val, datetime):
        return val
    try:
        return datetime.strptime(str(val).strip()[:10], "%Y-%m-%d")
    except Exception:
        return None


def _find_similar_rows(equip_id: str, exact_ref: list, all_ref_rows: list, tum_arrets: list) -> list:
    """
    Priorité 3 — équipements similaires dans historique_reference.
    Critères : catégorie, zone, causes, niveau.
    """
    # Caractéristiques de l'équipement cible
    target_cat    = None
    target_zone   = None
    target_niveau = None
    target_causes: set = set()

    for r in exact_ref:
        if r.get("categorie")        and not target_cat:    target_cat    = r["categorie"].strip()
        if r.get("zone_geographique") and not target_zone:  target_zone   = r["zone_geographique"].strip()
        if r.get("niveau")           and not target_niveau: target_niveau = r["niveau"].strip()
        if r.get("cause_arret"):
            target_causes.add(r["cause_arret"].strip())

    for a in tum_arrets:
        if a.get("cause"):
            target_causes.add(str(a["cause"]).strip())

    # Si aucune caractéristique → pas de similarité possible
    if not (target_cat or target_zone or target_causes):
        return []

    scored = []
    for r in all_ref_rows:
        pt = (r.get("poste_technique") or "").strip()
        if pt == equip_id:
            continue  # déjà dans exact_ref

        score = 0
        if target_cat   and r.get("categorie")         and r["categorie"].strip()         == target_cat:    score += 3
        if target_zone  and r.get("zone_geographique") and r["zone_geographique"].strip() == target_zone:   score += 2
        if target_niveau and r.get("niveau")           and r["niveau"].strip()            == target_niveau: score += 1
        if target_causes and r.get("cause_arret")      and r["cause_arret"].strip()       in target_causes: score += 2

        if score >= 2:  # seuil minimum de similarité
            scored.append((score, r))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [r for _, r in scored[:300]]  # max 300 voisins


def _ref_period_from_rows(rows: list, fallback: int = 365) -> int:
    """Calcule la période couverte par des lignes de référence (en jours)."""
    dates = []
    for r in rows:
        for field in ("date_debut", "date_fin"):
            d = _parse_date_simple(r.get(field))
            if d:
                dates.append(d)
    if len(dates) >= 2:
        raw = (max(dates) - min(dates)).days
        return max(raw, fallback)
    return fallback


def _compute_prediction(
    equip_id,
    tum_arrets,
    ref_rows,           # Niveau 1 : cause-spécifique
    ref_rows_equip,     # Niveau 2 : toutes défaillances équipement (renfort)
    rca_rows,           # Signal RCA (sessions passées)
    now,
    nn_model_data=None,
):
    """
    Moteur de prédiction hybride industriel :
      - TUM live     : priorité maximale
      - Référence N1 : cause-spécifique (poids plein)
      - Référence N2 : comportement global équipement (poids 0.30, renfort)
      - RCA passées  : signal de sévérité (poids 0.20)
      - Bayésien     : gestion de l'incertitude
      - NN           : couche future (poids max 0.10)
    """
    window_12m     = now - timedelta(days=365)
    window_3m      = now - timedelta(days=90)
    window_prev_3m = now - timedelta(days=180)

    arr_12m     = [a for a in tum_arrets
                   if _parse_dt(a.get("start_time")) and
                      _parse_dt(a["start_time"]) >= window_12m]
    arr_3m      = [a for a in arr_12m if _parse_dt(a["start_time"]) >= window_3m]
    arr_prev_3m = [a for a in arr_12m
                   if window_prev_3m <= _parse_dt(a["start_time"]) < window_3m]

    n_tum     = len(arr_12m)
    cumul_tum = sum(_safe_float(a.get("duration")) for a in arr_12m)
    n_recent  = len(arr_3m)
    n_prev    = len(arr_prev_3m)

    # ════════════════════════════════════════════════════════════════════════
    # NIVEAU 1 — Référence cause-spécifique
    # ════════════════════════════════════════════════════════════════════════
    n_ref1   = len(ref_rows)
    dur_ref1 = sum(_safe_float(r.get("duree_arret_minutes", 0)) / 60.0 for r in ref_rows)
    period1  = _ref_period_from_rows(ref_rows, fallback=365)

    top_ref_cause = None
    if ref_rows:
        counts = {}
        for r in ref_rows:
            c = (r.get("cause_arret") or "").strip()
            if c:
                counts[c] = counts.get(c, 0) + 1
        top_ref_cause = max(counts, key=counts.get) if counts else None

    # ════════════════════════════════════════════════════════════════════════
    # NIVEAU 2 — Comportement global équipement (renfort, poids 0.30)
    # Utilisé uniquement si N1 insuffisant (< 5 événements)
    # Exclut les lignes déjà comptées en N1
    # ════════════════════════════════════════════════════════════════════════
    n_ref2   = 0
    dur_ref2 = 0.0
    period2  = 365

    if n_ref1 < 5 and ref_rows_equip:
        ref1_ids = {id(r) for r in ref_rows}
        other    = [r for r in ref_rows_equip if id(r) not in ref1_ids]
        n_ref2   = len(other)
        dur_ref2 = sum(_safe_float(r.get("duree_arret_minutes", 0)) / 60.0 for r in other)
        period2  = _ref_period_from_rows(other, fallback=365)

    # ════════════════════════════════════════════════════════════════════════
    # SIGNAL RCA — sessions passées clôturées (sévérité confirmée)
    # Chaque RCA clôturée = preuve de défaillance sérieuse passée
    # niveau 2 (5why) = poids 1.0 ; niveau 1 (kaizen) = poids 0.5
    # ════════════════════════════════════════════════════════════════════════
    rca_signal   = 0.0
    n_rca_closed = 0
    for rca in (rca_rows or []):
        if (rca.get("statut") or "").lower() == "cloturee":
            n_rca_closed += 1
            rca_signal   += 1.0 if rca.get("niveau") == 2 else 0.5

    # ════════════════════════════════════════════════════════════════════════
    # COMBINAISON BAYÉSIENNE
    # N_combined = N1 (plein) + N2×0.30 (renfort) + RCA×0.20 (sévérité)
    # Période = max des deux niveaux pour éviter de comprimer la fenêtre
    # ════════════════════════════════════════════════════════════════════════
    n_ref_combined   = n_ref1 + 0.30 * n_ref2 + 0.20 * rca_signal
    dur_ref_combined = dur_ref1 + 0.30 * dur_ref2
    ref_period       = max(period1, period2)

    # Plafond industriel : max 2 pannes/mois pour un seul mode de défaillance
    max_ref = max(24.0, (ref_period / 365.0) * 24.0)
    if n_ref_combined > max_ref:
        scale            = max_ref / n_ref_combined
        n_ref_combined   = max_ref
        dur_ref_combined = dur_ref_combined * scale

    avg_ref_dur = (dur_ref_combined / n_ref_combined) if n_ref_combined > 0 else 0.0
    n_ref       = n_ref1  # pour l'affichage

    post_alpha = PRIOR_ALPHA + n_ref_combined
    post_beta  = PRIOR_BETA  + ref_period
    lambda_bay = post_alpha / post_beta

    # ── TUM local — poids croissant avec le volume d'observations ────────────
    if n_tum > 0:
        lambda_tum = n_tum / 365.0
        weight_tum = min(0.80, 0.30 + n_tum * 0.05)
        lambda_eff = weight_tum * lambda_tum + (1 - weight_tum) * lambda_bay
    else:
        lambda_eff = lambda_bay

    mtbf_days = 1.0 / lambda_eff if lambda_eff > 0 else 999

    # ── Dernier arrêt & prochaine défaillance ────────────────────────────────
    last_arret_dt = None
    if arr_12m:
        parsed = [_parse_dt(a["start_time"]) for a in arr_12m if _parse_dt(a.get("start_time"))]
        if parsed:
            last_arret_dt = max(parsed)

    days_since_last = ((now - last_arret_dt).total_seconds() / 86400) if last_arret_dt else None
    time_to_next    = max(0, mtbf_days - days_since_last) if days_since_last is not None else mtbf_days
    next_failure_dt = (now + timedelta(days=time_to_next)).strftime("%Y-%m-%d")

    # ── Scores composites ────────────────────────────────────────────────────
    freq_score = min(1.0, n_tum / 12.0) if n_tum > 0 \
                 else min(0.5, n_ref / max(ref_period / 30, 1) / 12.0)

    if n_tum > 0:
        total_dur = cumul_tum
    elif n_ref > 0:
        total_dur = avg_ref_dur * (lambda_bay * 365)
    else:
        total_dur = 0.0
    dur_score = min(1.0, total_dur / 100.0)

    trend_ratio  = (n_recent / n_prev) if n_prev > 0 else (2.0 if n_recent > 0 else 1.0)
    trend_score  = min(1.0, max(0.0, (trend_ratio - 0.5) / 1.5))
    bayes_risk   = 0.45 * freq_score + 0.30 * dur_score + 0.25 * trend_score

    # ── NN : couche future, poids MAX 10% ────────────────────────────────────
    nn_score = _nn_predict(tum_arrets, ref_rows, nn_model_data)
    if nn_score is not None:
        w_nn       = min(0.10, 0.05 + n_tum * 0.01)   # 1 arrêt=6%, 5=10% max
        risk_score = (1 - w_nn) * bayes_risk + w_nn * nn_score
    else:
        risk_score = bayes_risk

    # ── Modificateur RCA : récidive confirmée ────────────────────────────────
    if n_rca_closed >= 2:
        risk_score = min(1.0, risk_score * 1.15)   # récidive → +15%
    elif n_rca_closed == 1:
        risk_score = min(1.0, risk_score * 1.07)   # première RCA clôturée → +7%

    prob_bayes      = 1 - math.exp(-lambda_eff * 30)
    criticite_score = 0.60 * prob_bayes + 0.40 * risk_score

    if criticite_score >= 0.65:
        criticite = "CRITIQUE"
    elif criticite_score >= 0.35:
        criticite = "MODÉRÉE"
    else:
        criticite = "FAIBLE"

    avg_dur = (cumul_tum / n_tum) if n_tum > 0 else avg_ref_dur

    # ── Source de données ────────────────────────────────────────────────────
    parts = []
    if n_tum > 0:
        parts.append(f"TUM ({n_tum})")
    if n_ref1 > 0:
        parts.append(f"Réf. cause ({n_ref1})")
    if n_ref2 > 0:
        parts.append(f"Réf. équip ({n_ref2}×0.3)")
    if n_rca_closed > 0:
        parts.append(f"RCA ({n_rca_closed})")
    data_source = " + ".join(parts) if parts else "Prior Bayésien"

    # ── Cause principale TUM ─────────────────────────────────────────────────
    tum_cause_counts: dict = {}
    for a in arr_12m:
        c = (a.get("cause") or "").strip()
        if c:
            tum_cause_counts[c] = tum_cause_counts.get(c, 0) + 1
    top_tum_cause        = max(tum_cause_counts, key=tum_cause_counts.get) if tum_cause_counts else None
    defaillance_probable = top_tum_cause or top_ref_cause or "À déterminer"
    cause_probable       = top_ref_cause or top_tum_cause or "À déterminer"

    # ── Effet probable ───────────────────────────────────────────────────────
    if criticite == "CRITIQUE":
        effet_probable = "Arrêt complet de la production" if avg_dur >= 4 \
                         else "Perturbation majeure de la production"
    elif criticite == "MODÉRÉE":
        effet_probable = "Perturbation de la cadence de production"
    else:
        effet_probable = "Impact mineur sur la production"

    return {
        "equip_id":             equip_id,
        "risk_score":           round(risk_score, 3),
        "criticite":            criticite,
        "mtbf_days":            round(mtbf_days, 1),
        "next_failure_date":    next_failure_dt,
        "n_arrets_12m":         n_tum,
        "n_arrets_ref":         n_ref,
        "cumul_heures":         round(cumul_tum, 2),
        "avg_duration_h":       round(avg_dur, 2),
        "ref_period_days":      ref_period,
        "top_ref_cause":        top_ref_cause,
        "defaillance_probable": defaillance_probable,
        "cause_probable":       cause_probable,
        "effet_probable":       effet_probable,
        "freq_score":           round(freq_score, 3),
        "dur_score":            round(dur_score, 3),
        "trend_score":          round(trend_score, 3),
        "trend_ratio":          round(trend_ratio, 2),
        "days_since_last":      round(days_since_last, 0) if days_since_last is not None else None,
        "data_source":          data_source,
        "n_rca_closed":         n_rca_closed,
        "lambda_eff":           round(lambda_eff * 30, 4),
        "prob_bayes":           round(prob_bayes, 3),
        "criticite_score":      round(criticite_score, 3),
        "duree_estimee_h":      round(avg_dur * min(1.3, max(1.0, trend_ratio)), 2),
        "nn_score":             round(nn_score, 3) if nn_score is not None else None,
    }


# ─── GET /api/ia/predictions ─────────────────────────────────────────────────

@router.get("/predictions")
async def get_predictions(user=Depends(get_current_user), db: Session = Depends(get_db)):
    site_id = user["site_id"]
    now     = datetime.now(timezone.utc)
    cutoff  = now - timedelta(days=365)

    tum_rows = db.execute(text(
        "SELECT equip_id, start_time, duration, cause, zone "
        "FROM arrets "
        "WHERE site_id = :sid AND start_time >= :cutoff "
        "ORDER BY start_time ASC"
    ), {"sid": site_id, "cutoff": cutoff.strftime("%Y-%m-%d %H:%M:%S")}).mappings().fetchall()

    ref_rows_all = db.execute(text(
        "SELECT poste_technique, duree_arret_minutes, "
        "date_debut, date_fin, cause_arret, zone_geographique, categorie "
        "FROM historique_reference WHERE site_id = :sid"
    ), {"sid": site_id}).mappings().fetchall()

    equip_meta_rows = db.execute(text(
        "SELECT id, designation, entite FROM equipements WHERE site_id = :sid"
    ), {"sid": site_id}).mappings().fetchall()
    equip_info = {r["id"]: dict(r) for r in equip_meta_rows}

    tum_rows     = [dict(r) for r in tum_rows]
    ref_rows_all = [dict(r) for r in ref_rows_all]

    # ── Étape 1 : filtrer les arrêts planifiés (TUM) ──────────────────────────
    tum_rows_all        = tum_rows  # garder pour métadonnées zone
    tum_rows_defaillance = [
        a for a in tum_rows
        if _classify_event(a.get("cause") or "") == "DEFAILLANCE"
    ]

    # ── Étape 2 : filtrer les arrêts planifiés (Référence) ───────────────────
    ref_rows_defaillance = [
        r for r in ref_rows_all
        if _classify_event(r.get("cause_arret") or "") == "DEFAILLANCE"
    ]

    # ── Groupement TUM par équipement (métadonnées : zone / designation)
    equip_tum: dict = {}
    for a in tum_rows_all:
        equip_tum.setdefault(a["equip_id"], []).append(a)

    # ── Étape 3 : groupement TUM par (equip_id, mode_normalise) ─────────────
    equip_cause_tum: dict = {}
    for a in tum_rows_defaillance:
        raw_cause  = (a.get("cause") or "").strip()
        norm_cause = _normalize_failure_mode(raw_cause) if raw_cause else "Non renseigné"
        equip_cause_tum.setdefault((a["equip_id"], norm_cause), []).append(a)

    # ── Identifiants TUM connus (pour matching préfixe) ─────────────────────
    tum_equip_ids = set(eq_id for (eq_id, _) in equip_cause_tum.keys()) if True else set()

    # ── Groupement référence : exact ET préfixe ───────────────────────────────
    # La référence utilise poste_technique long (ex: "JF08-3M-PDEF-...")
    # Le TUM utilise equip_id court (ex: "JF08")
    # On indexe les deux : exact (pt == equip_id) ET préfixe (pt starts with equip_id)
    equip_ref: dict = {}        # clé = poste_technique exact
    equip_ref_pfx: dict = {}    # clé = TUM equip_id (matching préfixe)
    equip_cause_ref: dict = {}
    equip_cause_ref_pfx: dict = {}

    for r in ref_rows_defaillance:
        pt = (r.get("poste_technique") or "").strip()
        if not pt:
            continue

        # Index exact
        equip_ref.setdefault(pt, []).append(r)
        raw_c = (r.get("cause_arret") or "").strip()
        norm_c = _normalize_failure_mode(raw_c) if raw_c else None
        if norm_c:
            equip_cause_ref.setdefault((pt, norm_c), []).append(r)

        # Index préfixe : chercher quel TUM equip_id est préfixe de ce pt
        for tum_id in tum_equip_ids:
            if pt == tum_id or pt.startswith(tum_id + "-"):
                equip_ref_pfx.setdefault(tum_id, []).append(r)
                if norm_c:
                    equip_cause_ref_pfx.setdefault((tum_id, norm_c), []).append(r)
                break  # un seul match préfixe suffit

    if not equip_cause_tum:
        return []

    # ── Chargement sessions RCA (signal de sévérité) ─────────────────────────
    rca_session_rows = db.execute(text(
        "SELECT equip_id, statut, niveau, methode, created_at "
        "FROM rca_sessions WHERE site_id = :sid"
    ), {"sid": site_id}).mappings().fetchall()

    equip_rca: dict = {}
    for rca in rca_session_rows:
        eq = (rca.get("equip_id") or "").strip()
        if eq:
            equip_rca.setdefault(eq, []).append(dict(rca))

    # NN entraîné uniquement sur données de vraies défaillances
    nn_model_data = _build_nn_model(ref_rows_defaillance)

    predictions = []
    for (eq_id, norm_cause) in sorted(equip_cause_tum.keys()):
        tum_for_cause = equip_cause_tum[(eq_id, norm_cause)]

        # ── Niveau 1 : référence cause-spécifique ────────────────────────────
        ref_for_cause = equip_cause_ref.get((eq_id, norm_cause), [])
        if not ref_for_cause:
            ref_for_cause = equip_cause_ref_pfx.get((eq_id, norm_cause), [])

        # Cause inconnue → tout l'équipement comme N1
        if not ref_for_cause and norm_cause == "Non renseigné":
            ref_for_cause = equip_ref.get(eq_id, []) or equip_ref_pfx.get(eq_id, [])

        # ── Niveau 2 : comportement global équipement (renfort) ──────────────
        # Toutes les défaillances référence de cet équipement (toutes causes)
        ref_equip_all = equip_ref.get(eq_id, []) or equip_ref_pfx.get(eq_id, [])

        # ── RCA passées pour cet équipement ──────────────────────────────────
        rca_for_equip = equip_rca.get(eq_id, [])

        pred = _compute_prediction(
            equip_id       = eq_id,
            tum_arrets     = tum_for_cause,
            ref_rows       = ref_for_cause,
            ref_rows_equip = ref_equip_all,
            rca_rows       = rca_for_equip,
            now            = now,
            nn_model_data  = nn_model_data,
        )

        # Mode de défaillance normalisé
        pred["cause_arret"]          = norm_cause
        pred["defaillance_probable"] = norm_cause if norm_cause != "Non renseigné" \
                                       else (pred.get("defaillance_probable") or "À déterminer")

        meta = equip_info.get(eq_id, {})
        pred["designation"] = meta.get("designation") or ""
        pred["entite"]      = meta.get("entite") or ""
        tum_all = equip_tum.get(eq_id, [])
        pred["zone"]        = next((a["zone"] for a in tum_all if a.get("zone")), "")

        # Traçabilité filtrage
        n_total_tum = len([a for a in tum_all
                           if _parse_dt(a.get("start_time")) and
                              _parse_dt(a["start_time"]) >= now - timedelta(days=365)])
        pred["n_planifie_exclus"] = max(0, n_total_tum - pred["n_arrets_12m"])
        pred["type_arret"]        = "DEFAILLANCE"

        predictions.append(pred)

    for pred in predictions:
        pred["top_cause"] = pred.get("cause_arret") or pred.get("defaillance_probable") or "—"

    predictions.sort(key=lambda x: x["risk_score"], reverse=True)
    return predictions


# ─── GET /api/ia/causes/{equip_id} ───────────────────────────────────────────

@router.get("/causes/{equip_id}")
async def get_causes(equip_id: str, user=Depends(get_current_user), db: Session = Depends(get_db)):
    site_id = user["site_id"]

    rows = db.execute(text(
        "SELECT cause, COUNT(*) as freq, SUM(duration) as cumul_h "
        "FROM arrets "
        "WHERE equip_id = :eid AND site_id = :sid "
        "AND cause IS NOT NULL AND cause != '' "
        "AND start_time >= DATE_SUB(NOW(), INTERVAL 12 MONTH) "
        "GROUP BY cause ORDER BY freq DESC"
    ), {"eid": equip_id, "sid": site_id}).mappings().fetchall()

    causes = [dict(r) for r in rows]

    total = db.execute(text(
        "SELECT COUNT(*) FROM arrets "
        "WHERE equip_id = :eid AND site_id = :sid "
        "AND start_time >= DATE_SUB(NOW(), INTERVAL 12 MONTH)"
    ), {"eid": equip_id, "sid": site_id}).scalar() or 0

    if not causes:
        return {"causes": [], "total_arrets": total}

    max_freq  = max(c["freq"] for c in causes)
    max_cumul = max(c["cumul_h"] or 0 for c in causes) or 1

    for c in causes:
        freq_n    = c["freq"] / max_freq
        dur_n     = (c["cumul_h"] or 0) / max_cumul
        c["poids"]   = round(0.6 * freq_n + 0.4 * dur_n, 3)
        c["cumul_h"] = round(c["cumul_h"] or 0, 2)
        c["pct"]     = round(c["freq"] / total * 100, 1) if total else 0

    causes.sort(key=lambda x: x["poids"], reverse=True)
    return {"causes": causes, "total_arrets": total}


# ─── POST /api/ia/arbre ───────────────────────────────────────────────────────

class ArbreRequest(BaseModel):
    equip_id: str
    causes: list[dict]

@router.post("/arbre")
async def generate_arbre(body: ArbreRequest, user=Depends(get_current_user)):
    if not body.causes:
        raise HTTPException(400, "Aucune cause disponible pour générer l'arbre")

    causes_txt = "\n".join(
        f"  - {c['cause']} | fréquence: {c['freq']} arrêts | cumul: {c['cumul_h']}h | poids: {c['poids']}"
        for c in body.causes
    )

    system = """Tu es un expert fiabiliste industriel et analyste causal avancé (RCA + réseau bayésien), spécialisé mines et phosphates.
Tu construis des arbres causaux industriels dynamiques basés uniquement sur des données terrain réelles.
Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans texte avant ou après le JSON."""

    user_prompt = f"""Équipement : {body.equip_id}

Données terrain TUM — historique pannes réelles (12 mois) :
{causes_txt}

MISSION : Construis un arbre causal industriel dynamique et asymétrique pour cet équipement.

RÈGLES IMPÉRATIVES :
- Structure récursive totalement libre : chaque nœud a 0 à N enfants
- Profondeur variable par branche : suit la chaîne causale réelle jusqu'à la cause racine
- Les causes TUM les plus fréquentes/lourdes (poids élevé) → branches plus développées (plus de niveaux)
- Les causes rares ou simples → branches courtes (1-2 niveaux)
- Arbre asymétrique : chaque branche a sa propre profondeur et largeur
- Aucun nombre fixe de niveaux ni de causes — uniquement dicté par la causalité réelle
- Causes racines = nœuds sans enfants (où le "pourquoi" n'a plus de réponse technique terrain)

RÈGLE ANTI-REDONDANCE (ABSOLUMENT OBLIGATOIRE) :
- Chaque libellé de cause doit être UNIQUE dans tout l'arbre — aucun texte de nœud ne peut apparaître deux fois, même partiellement similaire
- Avant de finaliser, vérifie mentalement que chaque valeur "cause" est différente de toutes les autres dans l'arbre entier
- Si une même cause technique pourrait expliquer plusieurs branches, ne la place que dans la branche la plus pertinente et reformule différemment pour les autres
- Chaque branche doit explorer une DIMENSION DIFFÉRENTE : mécanique / électrique / process / maintenance / humain / environnement / conception
- Interdit : copier-coller le même texte ou quasi-même texte dans deux nœuds distincts

FORMAT JSON récursif (profondeur libre) :
{{
  "arbre": [
    {{
      "id": "C1",
      "cause": "cause terrain issue des données TUM",
      "poids": 0.85,
      "enfants": [
        {{
          "id": "C1.1",
          "cause": "pourquoi C1 se produit (dimension technique)",
          "enfants": [
            {{
              "id": "C1.1.1",
              "cause": "cause racine profonde",
              "enfants": []
            }},
            {{
              "id": "C1.1.2",
              "cause": "autre facteur contributeur",
              "enfants": []
            }}
          ]
        }},
        {{
          "id": "C1.2",
          "cause": "autre raison directe de C1",
          "enfants": []
        }}
      ]
    }},
    {{
      "id": "C2",
      "cause": "deuxième cause terrain",
      "poids": 0.60,
      "enfants": [
        {{
          "id": "C2.1",
          "cause": "explication directe courte",
          "enfants": []
        }}
      ]
    }}
  ],
  "debat": [
    {{"agent": "Agent Fréquence",  "argument": "...", "vote": "cause exacte"}},
    {{"agent": "Agent Impact",     "argument": "...", "vote": "cause exacte"}},
    {{"agent": "Agent Historique", "argument": "...", "vote": "cause exacte"}}
  ],
  "causes_racines": ["nœuds feuilles sans enfants = vraies causes racines identifiées"]
}}

Adapte la profondeur et la largeur à la réalité de CET équipement selon ses données TUM."""

    return await _groq_json(system, user_prompt, max_tokens=4000)


# ─── POST /api/ia/priorisation ────────────────────────────────────────────────

class PrioritisationRequest(BaseModel):
    equip_id: str
    causes: list[str]

@router.post("/priorisation")
async def generate_priorisation(body: PrioritisationRequest, user=Depends(get_current_user)):
    if not body.causes:
        raise HTTPException(400, "Aucune cause à prioriser")

    causes_list = "\n".join(f"  - {c}" for c in body.causes)

    system = """Tu es un orchestrateur MCP (Multi-Agent Coordination Protocol) expert en fiabilité industrielle (mines, phosphates, industrie lourde).
Tu simules le débat de 5 agents spécialisés pour prioriser les causes de défaillance.
Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans texte avant ou après le JSON."""

    user_prompt = f"""Équipement : {body.equip_id}

Causes feuilles issues de l'arbre causal (nœuds sans enfants = vraies causes racines) :
{causes_list}

MISSION — Orchestration MCP à 5 agents :

Chaque agent attribue à chaque cause un score normalisé entre 0.0 et 1.0 :

  • Agent RCA         (poids 0.30) : degré de confirmation comme cause racine selon l'arbre causal.
                                     1.0 = cause racine directe confirmée | 0.0 = cause indirecte ou secondaire
  • Agent Historique  (poids 0.20) : récurrence dans l'historique de défaillances similaires.
                                     1.0 = cause connue et récurrente | 0.0 = jamais observée
  • Agent Fréquence   (poids 0.20) : fréquence relative d'apparition de cette cause dans les arrêts.
                                     1.0 = très fréquente | 0.0 = très rare
  • Agent Durée       (poids 0.15) : impact sur la durée d'arrêt machine générée par cette cause.
                                     1.0 = arrêt long >8h | 0.0 = arrêt court <1h
  • Agent Propagation (poids 0.15) : risque de propagation vers d'autres équipements ou systèmes.
                                     1.0 = risque de cascade critique | 0.0 = cause totalement isolée

Score MCP = rca×0.30 + historique×0.20 + frequence×0.20 + duree×0.15 + propagation×0.15
Arrondi à 2 décimales. Les causes doivent être triées du score MCP le plus élevé au plus faible.

Niveau MCP selon score :
  "CRITIQUE" si score_mcp >= 0.80
  "ÉLEVÉ"    si score_mcp >= 0.60
  "MOYEN"    si score_mcp >= 0.40
  "FAIBLE"   si score_mcp < 0.40

Pour chaque cause, génère une explication automatique de 1 à 2 phrases expliquant pourquoi
les agents ont convergé vers ce score (cite les agents qui ont le plus influencé le résultat).

Retourne ce JSON (ne mets RIEN d'autre) :
{{
  "scores": [
    {{
      "cause": "nom exact de la cause",
      "rang": 1,
      "agents": {{
        "rca": 1.0,
        "historique": 0.9,
        "frequence": 0.8,
        "duree": 0.9,
        "propagation": 0.95
      }},
      "score_mcp": 0.92,
      "niveau": "CRITIQUE",
      "explication": "L'agent RCA confirme cette cause comme racine directe. L'agent Propagation détecte un risque élevé de défaillance en cascade."
    }}
  ],
  "synthese_globale": "2-3 phrases expliquant la décision finale de l'orchestrateur MCP et les causes prioritaires retenues"
}}"""

    return await _groq_json(system, user_prompt, max_tokens=4000)


# ─── POST /api/ia/amdec ───────────────────────────────────────────────────────

class AmdecRequest(BaseModel):
    equip_id: str
    top_causes: list[str]   # causes TOP issues du score MCP

@router.post("/amdec")
async def generate_amdec(body: AmdecRequest, user=Depends(get_current_user)):
    if not body.top_causes:
        raise HTTPException(400, "Causes TOP manquantes")

    causes_txt = "\n".join(f"  - {c}" for c in body.top_causes)

    system = """Tu es un expert AMDEC (Analyse des Modes de Défaillance, de leurs Effets et de leur Criticité) en fiabilité industrielle (mines, phosphates, industrie lourde).
Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans texte avant ou après le JSON."""

    user_prompt = f"""Équipement : {body.equip_id}
Causes retenues : {causes_txt}

Génère une analyse AMDEC pour chaque cause. Barème 1-10 : G=Gravité, F=Fréquence, D=Détectabilité, RPN=F×G×D.
Statut : RPN>300→"Critique", 200-300→"Élevé", <200→"Moyen".
L'AMDEC est indépendant du score MCP.

Pour les recommandations : une action courte (max 20 mots) par cause.
Types : maintenance, inspection, surveillance. Priorités : haute, moyenne, faible. Délais : immédiat, 1 semaine, 1 mois, 3 mois.
decision_finale : 1 phrase résumant le plan d'action.

JSON uniquement :
{{
  "amdec": [{{"cause":"...","G":8,"F":7,"D":6,"RPN":336,"statut":"Critique"}}],
  "recommandations": [{{"cause":"...","type":"maintenance","action":"...","priorite":"haute","delai":"immédiat"}}],
  "decision_finale": "..."
}}"""

    return await _groq_json(system, user_prompt, max_tokens=4000)


# ─── POST /api/ia/recommandations ─────────────────────────────────────────────

class RecoRequest(BaseModel):
    equip_id: str
    causes_racines: list[str]
    amdec: list[dict]

@router.post("/recommandations")
async def generate_recommandations(body: RecoRequest, user=Depends(get_current_user)):
    if not body.causes_racines:
        raise HTTPException(400, "Causes racines manquantes")

    causes_txt = "\n".join(f"  - {c}" for c in body.causes_racines)
    amdec_txt  = "\n".join(
        f"  - {r.get('cause_racine','?')} | Mode: {r.get('mode_defaillance','?')} | Criticité C={r.get('C','?')} ({r.get('niveau','?')})"
        for r in body.amdec
    )

    system = """Tu es un expert en maintenance industrielle et fiabilité.
Tu génères des recommandations correctives et préventives précises, actionnables et priorisées.
Tu réponds UNIQUEMENT en JSON valide, sans markdown, sans texte avant ou après le JSON."""

    user_prompt = f"""Équipement : {body.equip_id}

Causes racines :
{causes_txt}

Résultats AMDEC :
{amdec_txt}

Génère des recommandations concrètes, une par cause racine au minimum.
Retourne ce JSON (ne mets RIEN d'autre) :
{{
  "recommandations": [
    {{
      "cause_racine": "...",
      "action": "description précise de l'action à mener",
      "type": "corrective",
      "priorite": "haute",
      "delai": "immédiat"
    }}
  ]
}}

Types possibles : corrective, preventive
Priorités : haute, moyenne, faible
Délais : immédiat, 1 semaine, 1 mois, 3 mois"""

    return await _groq_json(system, user_prompt)
