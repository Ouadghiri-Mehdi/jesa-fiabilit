import os, uuid
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from routers import auth, tum, rca, config, ai, ia_solution

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

ALLOWED_EXTENSIONS = {".pdf", ".png", ".jpg", ".jpeg", ".xlsx", ".xls", ".doc", ".docx"}
MAX_SIZE = 10 * 1024 * 1024  # 10 Mo

app = FastAPI(title="JESA Fiabilité API", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "https://jesa-fiabilit.vercel.app",
        "http://localhost:5173",
        "http://localhost:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.include_router(auth.router)
app.include_router(tum.router)
app.include_router(rca.router)
app.include_router(config.router)
app.include_router(ai.router)
app.include_router(ia_solution.router)


@app.post("/api/upload")
async def upload_file(file: UploadFile = File(...)):
    ext = os.path.splitext(file.filename or "")[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, f"Type de fichier non autorisé : {ext}")
    content = await file.read()
    if len(content) > MAX_SIZE:
        raise HTTPException(413, "Fichier trop volumineux (max 10 Mo)")
    filename = f"{uuid.uuid4().hex}{ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    with open(path, "wb") as f:
        f.write(content)
    return {"url": f"/uploads/{filename}", "name": file.filename, "type": file.content_type or ""}


@app.get("/")
def root():
    return {"status": "ok", "service": "JESA Fiabilité API v2 (MySQL)"}
