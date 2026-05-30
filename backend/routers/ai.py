import os, json, asyncio, base64
from typing import List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from sqlalchemy import text
from sqlalchemy.orm import Session

from auth import get_current_user
from db import get_db

router = APIRouter(prefix="/api/ai", tags=["AI"])

GROQ_API_KEY   = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL     = "llama-3.1-8b-instant"         # fallback chat
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL   = "gemini-2.0-flash"             # agent RCA principal
GEMINI_URL     = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"


# ─── Fonctions de collecte DB ────────────────────────────────────────────────

async def _tool_get_rca_history(args: dict, db: Session, site_id: str) -> str:
    equip_id  = args.get("equip_id", "")
    phenomene = args.get("phenomene", "")

    same = db.execute(text(
        "SELECT titre, phenomene, cause_arret, methode, "
        "GROUP_CONCAT(DISTINCT a.action SEPARATOR ' | ') as actions "
        "FROM rca_sessions s "
        "LEFT JOIN rca_actions a ON a.rca_id = s.id "
        "WHERE s.statut = 'cloturee' AND s.equip_id = :eid "
        "GROUP BY s.id ORDER BY s.updated_at DESC LIMIT 5"
    ), {"eid": equip_id}).mappings().fetchall()

    parts = []
    if same:
        rows = [
            f"  • [{r['methode']}] {r['titre']} | Phénomène: {r['phenomene'] or '—'} "
            f"| Cause: {r['cause_arret'] or '—'} | Actions: {r['actions'] or '—'}"
            for r in same
        ]
        parts.append("RCA clôturées — même équipement :\n" + "\n".join(rows))
    else:
        parts.append(f"Aucune RCA clôturée trouvée pour {equip_id}.")

    if phenomene and len(phenomene) > 3:
        kw = phenomene[:30]
        similar = db.execute(text(
            "SELECT equip_id, titre, phenomene, cause_arret "
            "FROM rca_sessions "
            "WHERE statut = 'cloturee' AND site_id = :sid "
            "AND (phenomene LIKE :kw OR cause_arret LIKE :kw) AND equip_id != :eid "
            "ORDER BY updated_at DESC LIMIT 4"
        ), {"sid": site_id, "kw": f"%{kw}%", "eid": equip_id}).mappings().fetchall()

        if similar:
            rows = [
                f"  • {r['equip_id']} | {r['titre']} | Cause: {r['cause_arret'] or '—'}"
                for r in similar
            ]
            parts.append("RCA similaires (autres équipements) :\n" + "\n".join(rows))

    return "\n\n".join(parts)


async def _tool_get_tum_data(args: dict, db: Session) -> str:
    equip_id = args.get("equip_id", "")

    stats = db.execute(text(
        "SELECT COUNT(*) as freq, SUM(duration) as cumul, AVG(duration) as moy, "
        "GROUP_CONCAT(DISTINCT cause ORDER BY cause SEPARATOR ', ') as causes "
        "FROM arrets WHERE equip_id = :eid "
        "AND start_time >= DATE_SUB(NOW(), INTERVAL 180 DAY)"
    ), {"eid": equip_id}).mappings().fetchone()

    if not stats or not stats["freq"]:
        return f"Aucune donnée TUM disponible pour {equip_id} sur les 6 derniers mois."

    return (
        f"TUM — {equip_id} (6 derniers mois) :\n"
        f"  • Fréquence : {stats['freq']} arrêts\n"
        f"  • Cumul TD : {round(stats['cumul'] or 0, 1)} h\n"
        f"  • Durée moy. : {round(stats['moy'] or 0, 1)} h/arrêt\n"
        f"  • Causes enregistrées : {stats['causes'] or 'Non renseignées'}"
    )


async def _tool_get_existing_tree(args: dict, db: Session) -> str:
    rca_id = args.get("rca_id", "")
    if not rca_id:
        return "Aucun identifiant RCA fourni."

    row = db.execute(text(
        "SELECT noeuds, phenomene, cause_arret FROM rca_sessions WHERE id = :id"
    ), {"id": rca_id}).mappings().fetchone()

    if not row:
        return f"Session RCA {rca_id} introuvable."

    noeuds = row["noeuds"] or "[]"
    try:
        tree = json.loads(noeuds)
        if not tree:
            return f"L'arbre de la session {rca_id} est vide pour le moment."
        summary = json.dumps(tree, ensure_ascii=False, indent=2)
        return (
            f"Arbre de causes existant — session {rca_id} :\n"
            f"Phénomène : {row['phenomene'] or '—'} | Cause déclarée : {row['cause_arret'] or '—'}\n"
            f"Noeuds :\n{summary}"
        )
    except Exception:
        return f"Arbre existant (brut) : {noeuds}"


async def _tool_search_external(args: dict) -> str:
    query  = args.get("query", "")
    source = args.get("source", "all")
    parts  = []

    async with httpx.AsyncClient(timeout=15) as client:

        # ── Wikipedia FR ──────────────────────────────────────────────────────
        if source in ("wikipedia", "all"):
            try:
                resp = await client.get(
                    "https://fr.wikipedia.org/w/api.php",
                    params={
                        "action": "query", "list": "search",
                        "srsearch": query, "srlimit": 2,
                        "format": "json", "utf8": 1,
                    },
                )
                if resp.status_code == 200:
                    results = resp.json().get("query", {}).get("search", [])
                    if results:
                        rows = []
                        for r in results:
                            snippet = (r.get("snippet", "")
                                       .replace('<span class="searchmatch">', "")
                                       .replace("</span>", ""))
                            rows.append(f"  • {r['title']} : {snippet}")
                        parts.append("Wikipedia :\n" + "\n".join(rows))
            except Exception:
                pass

        # ── DuckDuckGo Instant Answer ─────────────────────────────────────────
        if source in ("duckduckgo", "all"):
            try:
                resp = await client.get(
                    "https://api.duckduckgo.com/",
                    params={
                        "q": query, "format": "json",
                        "no_html": "1", "skip_disambig": "1",
                    },
                )
                if resp.status_code == 200:
                    data = resp.json()
                    abstract = (data.get("AbstractText") or "").strip()
                    related  = data.get("RelatedTopics", [])[:4]
                    if abstract:
                        source_name = data.get("AbstractSource", "")
                        parts.append(f"DuckDuckGo ({source_name}) :\n  {abstract}")
                    elif related:
                        rows = [f"  • {t['Text']}" for t in related if isinstance(t, dict) and t.get("Text")]
                        if rows:
                            parts.append("DuckDuckGo (sujets liés) :\n" + "\n".join(rows))
            except Exception:
                pass

        # ── OpenAlex ──────────────────────────────────────────────────────────
        if source in ("openalex", "all"):
            try:
                resp = await client.get(
                    "https://api.openalex.org/works",
                    params={
                        "search": query, "per_page": 3,
                        "select": "title,publication_year,concepts",
                    },
                    headers={"User-Agent": "JESA-ReliabilityOS/2.0 (contact@jesa.ma)"},
                )
                if resp.status_code == 200:
                    results = resp.json().get("results", [])
                    if results:
                        rows = []
                        for r in results:
                            concepts = ", ".join(
                                c["display_name"] for c in (r.get("concepts") or [])[:3]
                            )
                            rows.append(
                                f"  • [{r.get('publication_year','?')}] "
                                f"{r.get('title','?')} | Thèmes: {concepts or '—'}"
                            )
                        parts.append("Publications académiques (OpenAlex) :\n" + "\n".join(rows))
            except Exception:
                pass

        # ── CrossRef (articles scientifiques) ─────────────────────────────────
        if source in ("crossref", "all"):
            try:
                resp = await client.get(
                    "https://api.crossref.org/works",
                    params={
                        "query": query, "rows": 3,
                        "select": "title,published-print,abstract",
                    },
                    headers={"User-Agent": "JESA-ReliabilityOS/2.0 (mailto:contact@jesa.ma)"},
                )
                if resp.status_code == 200:
                    items = resp.json().get("message", {}).get("items", [])
                    if items:
                        rows = []
                        for item in items[:3]:
                            title   = " ".join(item.get("title", ["?"]))
                            year    = ((item.get("published-print") or {})
                                       .get("date-parts", [[""]])[0][0])
                            abstract = ((item.get("abstract") or "")
                                        .replace("<jats:p>", "").replace("</jats:p>", "")
                                        .strip())[:180]
                            rows.append(
                                f"  • [{year}] {title}"
                                + (f" — {abstract}" if abstract else "")
                            )
                        parts.append("CrossRef (publications) :\n" + "\n".join(rows))
            except Exception:
                pass

    if not parts:
        return (
            "Aucune source externe n'a retourné de résultats pour cette requête. "
            "Procède à l'analyse en te basant sur tes connaissances expertes en fiabilité industrielle."
        )
    return "\n\n".join(parts)


# ─── Collecte contexte DB (single-shot, pas de tool calling) ─────────────────

async def _fetch_suggest_context(
    db: Session, equip_id: str, site_id: str, phenomene: str, rca_id: str
) -> str:
    tum  = await _tool_get_tum_data({"equip_id": equip_id}, db)
    rca  = await _tool_get_rca_history({"equip_id": equip_id, "phenomene": phenomene}, db, site_id)
    parts = [tum, rca]

    if rca_id:
        tree = await _tool_get_existing_tree({"rca_id": rca_id}, db)
        parts.append(tree)

    # Enrichissement externe : 4 sources en parallèle
    if phenomene and len(phenomene) > 4:
        query = f"{phenomene} {equip_id} maintenance industrielle fiabilité"
        wiki, openalex, ddg, crossref = await asyncio.gather(
            _tool_search_external({"query": query, "source": "wikipedia"}),
            _tool_search_external({"query": query, "source": "openalex"}),
            _tool_search_external({"query": query, "source": "duckduckgo"}),
            _tool_search_external({"query": query, "source": "crossref"}),
        )
        ext_parts = [
            r for r in [wiki, openalex, ddg, crossref]
            if r and "Aucune source" not in r
        ]
        if ext_parts:
            parts.append("SOURCES EXTERNES :\n\n" + "\n\n".join(ext_parts))

    return "\n\n".join(parts)


async def _call_llm(messages: list) -> str:
    payload = {
        "messages":    messages,
        "max_tokens":  800,
        "temperature": 0.4,
    }
    async with httpx.AsyncClient(timeout=45) as client:
        # Tentative Gemini
        if GEMINI_API_KEY:
            resp = await client.post(
                GEMINI_URL,
                headers={"Authorization": f"Bearer {GEMINI_API_KEY}", "Content-Type": "application/json"},
                json={**payload, "model": GEMINI_MODEL},
            )
            if resp.status_code == 200:
                return resp.json()["choices"][0]["message"]["content"].strip()
            print(f"[GEMINI] {resp.status_code} {resp.text[:200]}")

        # Fallback Groq
        if GROQ_API_KEY:
            resp = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                json={**payload, "model": GROQ_MODEL},
            )
            if resp.status_code == 200:
                return resp.json()["choices"][0]["message"]["content"].strip()
            print(f"[GROQ] {resp.status_code} {resp.text[:200]}")

    raise HTTPException(502, "Service IA indisponible (Gemini + Groq en échec)")


# ─── Schémas ─────────────────────────────────────────────────────────────────

class MsgHistory(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    question: str
    page:     Optional[str]         = "/"
    history:  Optional[List[MsgHistory]] = []

class SuggestRequest(BaseModel):
    equip_id:  str
    phenomene: Optional[str] = None
    methode:   str            = "5why"
    question:  Optional[str] = None
    rca_id:    Optional[str] = None


# ─── RAG contexte global (chat) ───────────────────────────────────────────────

def _fetch_context(db: Session, site_id: str) -> dict:
    try:
        arrets = db.execute(text(
            "SELECT COUNT(*) as cnt, COUNT(DISTINCT equip_id) as equip "
            "FROM arrets WHERE site_id = :sid "
            "AND start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY)"
        ), {"sid": site_id}).mappings().fetchone()

        sessions = db.execute(text(
            "SELECT COUNT(*) as total, "
            "SUM(CASE WHEN statut='cloturee' THEN 1 ELSE 0 END) as cloturees "
            "FROM rca_sessions WHERE site_id = :sid"
        ), {"sid": site_id}).mappings().fetchone()

        actions = db.execute(text(
            "SELECT COUNT(*) as pending FROM rca_actions "
            "WHERE site_id = :sid AND statut NOT IN ('terminé','termine')"
        ), {"sid": site_id}).mappings().fetchone()

        top = db.execute(text(
            "SELECT equip_id, COUNT(*) as freq, SUM(duration) as cumul "
            "FROM arrets WHERE site_id = :sid "
            "AND start_time >= DATE_SUB(NOW(), INTERVAL 30 DAY) "
            "GROUP BY equip_id ORDER BY freq DESC LIMIT 3"
        ), {"sid": site_id}).mappings().fetchall()

        top_str = ", ".join(
            f"{r['equip_id']} ({r['freq']} arrêts, {round(r['cumul'] or 0, 1)}h)"
            for r in top
        ) or "Aucun arrêt récent"

        return {
            "nb_arrets":          arrets["cnt"]    if arrets   else 0,
            "nb_equip":           arrets["equip"]  if arrets   else 0,
            "nb_sessions":        sessions["total"]     if sessions else 0,
            "nb_cloturees":       sessions["cloturees"] if sessions else 0,
            "nb_actions_pending": actions["pending"]    if actions  else 0,
            "top_equip":          top_str,
        }
    except Exception:
        return {k: "N/A" for k in ("nb_arrets","nb_equip","nb_sessions","nb_cloturees","nb_actions_pending","top_equip")}


def _build_system(ctx: dict, page: str) -> str:
    page_desc = {
        "/tum":        "TUM — Saisie et suivi des arrêts machines, seuils N1/N2, Pareto",
        "/rca":        "RCA — Analyses causes racines (5-Why, Quick Kaizen)",
        "/actions":    "Actions — Suivi des actions correctives générées par les RCA",
        "/historique": "Historique — Dossier complet par équipement",
        "/dashboard":  "Dashboard — KPIs (MTBF, MTTR, Disponibilité)",
    }.get(page, "Navigation générale")

    return f"""Tu es l'assistant IA de JESA ReliabilityOS, plateforme de gestion de la fiabilité industrielle.

DONNÉES RÉELLES DU SITE :
- Arrêts (30 derniers jours) : {ctx['nb_arrets']} sur {ctx['nb_equip']} équipements
- Sessions RCA : {ctx['nb_sessions']} dont {ctx['nb_cloturees']} clôturées
- Actions en attente : {ctx['nb_actions_pending']}
- Top équipements : {ctx['top_equip']}

PAGE COURANTE : {page_desc}

Réponds en français, concis et professionnel.
Utilise <strong> pour les termes importants. Pas de markdown ni astérisques. Maximum 3 paragraphes."""


# ─── Endpoint /suggest (Agent ReAct) ─────────────────────────────────────────

@router.post("/suggest")
async def suggest(
    body: SuggestRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not GROQ_API_KEY and not GEMINI_API_KEY:
        raise HTTPException(503, "Service IA non configuré")

    methode_label = {
        "5why":   "Arbre des 5 Pourquoi",
        "kaizen": "Quick Kaizen (roue PDCA)",
        "qqoqcp": "QQOQCP (Qui Quoi Où Quand Comment Pourquoi)",
    }.get(body.methode, body.methode)

    # Collecte des données DB directement (1 seul appel LLM ensuite)
    context = await _fetch_suggest_context(
        db, body.equip_id, user["site_id"],
        body.phenomene or "", body.rca_id or ""
    )

    question = body.question or "Analyse les causes racines probables et les actions correctives recommandées."

    system = f"""Tu es un expert senior en fiabilité industrielle (secteur industriel, mines, phosphates — Maroc), spécialisé en analyse RCA.

CONTEXTE DE LA SESSION :
  Équipement  : {body.equip_id}
  Phénomène   : {body.phenomene or 'Non précisé'}
  Méthode     : {methode_label}
  Session RCA : {body.rca_id or 'Nouvelle session'}

FORMAT DE RÉPONSE :
Prose continue uniquement. Aucun tiret, aucun astérisque, aucune liste numérotée.
Utilise <strong>terme</strong> pour les termes clés. Aucune autre balise sauf <br>.
Phrases affirmatives d'expert. Maximum 250 mots. Causes spécifiques à cet équipement."""

    user_msg = f"""DONNÉES RÉELLES ISSUES DE LA BASE :

{context}

QUESTION : {question}"""

    reply = await _call_llm([
        {"role": "system", "content": system},
        {"role": "user",   "content": user_msg},
    ])
    return {"reply": reply}


# ─── Endpoint /upload-file (analyse PDF / image) ─────────────────────────────

def _extract_pdf_text(content: bytes) -> str:
    """Extrait le texte d'un PDF numérique via PyMuPDF."""
    try:
        import fitz  # pymupdf
        doc  = fitz.open(stream=content, filetype="pdf")
        text = "\n".join(page.get_text() for page in doc).strip()
        doc.close()
        return text if text else ""
    except ImportError:
        return ""   # pymupdf non installé → on passera par Gemini Vision
    except Exception:
        return ""


def _extract_image_text(content: bytes) -> str:
    """Extrait le texte d'une image via Tesseract OCR (local, sans quota API)."""
    try:
        import pytesseract
        from PIL import Image
        import io

        # Détection automatique du chemin Tesseract sur Windows
        import os, platform
        if platform.system() == "Windows":
            candidates = [
                r"C:\Program Files\Tesseract-OCR\tesseract.exe",
                r"C:\Program Files (x86)\Tesseract-OCR\tesseract.exe",
                r"C:\Users\USER\AppData\Local\Programs\Tesseract-OCR\tesseract.exe",
            ]
            for path in candidates:
                if os.path.exists(path):
                    pytesseract.pytesseract.tesseract_cmd = path
                    break

        img  = Image.open(io.BytesIO(content))
        # Essai français + anglais (meilleure couverture pour docs industriels)
        text = pytesseract.image_to_string(img, lang="fra+eng")
        return text.strip()
    except ImportError:
        return ""   # pytesseract non installé → fallback Gemini Vision
    except Exception:
        return ""


async def _gemini_vision(content: bytes, mime: str, prompt: str) -> str:
    """Envoie une image à Gemini Vision et retourne la réponse texte."""
    if not GEMINI_API_KEY:
        raise HTTPException(503, "GEMINI_API_KEY manquant pour l'analyse d'image")

    b64 = base64.b64encode(content).decode()
    messages = [{
        "role": "user",
        "content": [
            {"type": "text",      "text": prompt},
            {"type": "image_url", "image_url": {"url": f"data:{mime};base64,{b64}"}},
        ],
    }]
    async with httpx.AsyncClient(timeout=60) as client:
        resp = await client.post(
            GEMINI_URL,
            headers={"Authorization": f"Bearer {GEMINI_API_KEY}", "Content-Type": "application/json"},
            json={"model": GEMINI_MODEL, "messages": messages, "max_tokens": 1200, "temperature": 0.3},
        )
    if resp.status_code == 429:
        raise HTTPException(429, "Quota Gemini Vision dépassé")
    if resp.status_code != 200:
        raise HTTPException(502, f"Gemini Vision erreur : {resp.text[:200]}")
    return resp.json()["choices"][0]["message"]["content"].strip()


@router.post("/upload-file")
async def upload_file(
    file:      UploadFile = File(...),
    equip_id:  str        = Form(default=""),
    phenomene: str        = Form(default=""),
    rca_id:    str        = Form(default=""),
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Analyse un fichier joint (PDF ou image) dans le contexte d'une session RCA.
    Retourne une analyse structurée pour l'Agent RCA.
    """
    if not GEMINI_API_KEY and not GROQ_API_KEY:
        raise HTTPException(503, "Service IA non configuré")

    content  = await file.read()
    fname    = (file.filename or "").lower()
    analysis = ""

    # ── Étape 1 : extraction du contenu ──────────────────────────────────────
    # ── Prompt système commun — analyse honnête du contenu réel ─────────────
    ctx_equip = equip_id or "non précisé"
    ctx_pheno = phenomene or "non précisé"

    system_file = (
        f"Tu es un assistant expert en fiabilité industrielle (JESA ReliabilityOS). "
        f"L'utilisateur travaille sur l'analyse RCA de l'équipement <strong>{ctx_equip}</strong> "
        f"(phénomène : {ctx_pheno}).\n\n"
        "RÈGLE ABSOLUE : analyse uniquement le contenu RÉEL du document joint. "
        "Ne jamais inventer, ni extrapoler, ni utiliser le nom de l'équipement ou le phénomène "
        "comme si c'étaient des informations issues du document.\n\n"
        "LOGIQUE DE RÉPONSE :\n"
        "• Si le document est un rapport technique, bon de travail, fiche panne, "
        "compte-rendu de maintenance ou historique d'équipement → extraire les informations "
        "utiles à la RCA : causes identifiées, actions réalisées, observations terrain, "
        "dates, durées, équipements ou composants mentionnés. "
        "Utilise <strong> pour les éléments clés.\n"
        "• Si le document n'a AUCUN lien avec la maintenance ou la fiabilité industrielle "
        "(ex : document commercial, juridique, marketing, informatique, etc.) → "
        "réponds clairement que ce document n'est pas un document technique de maintenance, "
        "puis résume brièvement son contenu réel en 2-3 phrases.\n\n"
        "Réponds en français."
    )

    if fname.endswith(".pdf"):
        text_content = _extract_pdf_text(content)
        if text_content:
            # PDF numérique → texte extrait → analyse LLM
            analysis = await _call_llm([
                {"role": "system", "content": system_file},
                {"role": "user", "content":
                    f"Fichier : {file.filename}\n\n"
                    f"CONTENU DU DOCUMENT :\n{text_content[:4000]}"},
            ])
        else:
            # PDF scanné → Gemini Vision
            mime   = "application/pdf"
            prompt = (
                f"{system_file}\n\n"
                f"Fichier : {file.filename}\n"
                "Analyse ce document scanné et applique la logique de réponse définie."
            )
            analysis = await _gemini_vision(content, mime, prompt)

    elif fname.endswith((".png", ".jpg", ".jpeg", ".webp")):
        mime_map = {".png": "image/png", ".jpg": "image/jpeg",
                    ".jpeg": "image/jpeg", ".webp": "image/webp"}
        ext      = next((k for k in mime_map if fname.endswith(k)), ".jpg")
        mime     = mime_map[ext]

        # ── Tentative 1 : Tesseract OCR local (sans quota, sans API) ──────────
        ocr_text = _extract_image_text(content)
        if ocr_text and len(ocr_text) > 30:
            # Texte lisible trouvé (screenshot, document scanné, étiquette) → LLM sur texte
            analysis = await _call_llm([
                {"role": "system", "content": system_file},
                {"role": "user", "content":
                    f"Fichier image : {file.filename}\n\n"
                    f"TEXTE EXTRAIT DE L'IMAGE (OCR) :\n{ocr_text[:4000]}"},
            ])
        else:
            # ── Tentative 2 : Gemini Vision (photo, schéma sans texte) ────────
            prompt = (
                f"{system_file}\n\n"
                f"Fichier image : {file.filename}\n"
                "Analyse cette image et applique la logique de réponse définie. "
                "Si c'est une image d'équipement industriel → décris l'état visible, "
                "les défauts, codes d'erreur, plaques signalétiques. "
                "Si ce n'est pas une image technique → dis-le clairement."
            )
            try:
                analysis = await _gemini_vision(content, mime, prompt)
            except HTTPException as e:
                if e.status_code == 429:
                    return {
                        "reply": (
                            "⚠️ <strong>Quota Gemini Vision dépassé</strong> — "
                            "L'analyse d'image est temporairement indisponible (limite API atteinte).<br><br>"
                            "Vous pouvez :<br>"
                            "• Réessayer dans quelques minutes<br>"
                            "• Convertir l'image en PDF puis la joindre — "
                            "l'analyse PDF passe par PyMuPDF en local, sans quota Gemini"
                        ),
                        "filename": file.filename,
                        "type": "file_analysis",
                    }
                raise

    else:
        raise HTTPException(400, "Format non supporté. Utilisez PDF, PNG ou JPG.")

    if not analysis:
        raise HTTPException(502, "L'analyse du fichier n'a pas pu être générée.")

    return {
        "reply":    analysis,
        "filename": file.filename,
        "type":     "file_analysis",
    }


# ─── Endpoint /chat (assistant global) ───────────────────────────────────────

@router.post("/chat")
async def chat(
    body: ChatRequest,
    user=Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not GROQ_API_KEY:
        raise HTTPException(503, "Service IA non configuré")

    ctx    = _fetch_context(db, user["site_id"])
    system = _build_system(ctx, body.page or "/")

    history = []
    for m in (body.history or [])[-6:]:
        if m.role in ("user", "assistant"):
            history.append({"role": m.role, "content": m.content})
    history.append({"role": "user", "content": body.question})

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={
                "model":       GROQ_MODEL,
                "messages":    [{"role": "system", "content": system}] + history,
                "max_tokens":  600,
                "temperature": 0.4,
            },
        )

    if resp.status_code != 200:
        raise HTTPException(502, f"Erreur Groq : {resp.text[:300]}")

    reply = resp.json()["choices"][0]["message"]["content"].strip()
    return {"reply": reply}
