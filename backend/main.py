from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import tum, rca

app = FastAPI(title="JESA Fiabilité API")

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

app.include_router(tum.router)
app.include_router(rca.router)

@app.get("/")
def root():
    return {"status": "ok", "service": "JESA Fiabilité API"}
