"""Promise Keeper API."""
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import config

app = FastAPI(title="Promise Keeper")

app.add_middleware(
    CORSMiddleware,
    allow_origins=config.FRONTEND_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok", "demo_mode": config.DEMO_MODE}
