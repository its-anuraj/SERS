"""
SERS — ML Microservice (Python FastAPI)
Provides AI/ML endpoints for crash detection, hospital matching, route optimization
"""

from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
import os
from dotenv import load_dotenv

from routers import crash_detection, hospital_matcher, route_optimizer, hotspot, severity

load_dotenv()

app = FastAPI(
    title="SERS ML Service",
    description="AI/ML microservice for Smart Emergency Response System",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---- API Key auth ----
API_KEY = os.getenv("API_KEY", "ml_internal_api_key")

def verify_api_key(x_api_key: str = Header(default="")):
    if API_KEY and x_api_key != API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    return True

# ---- Health check ----
@app.get("/health")
def health():
    return {"status": "ok", "service": "SERS ML", "version": "1.0.0"}

# ---- Routers ----
app.include_router(crash_detection.router, prefix="/crash-detection", tags=["Crash Detection"])
app.include_router(hospital_matcher.router, prefix="/hospital-match", tags=["Hospital Matcher"])
app.include_router(route_optimizer.router, prefix="/route-optimize", tags=["Route Optimizer"])
app.include_router(hotspot.router, prefix="/hotspots", tags=["Hotspot Prediction"])
app.include_router(severity.router, prefix="/severity", tags=["Severity Classifier"])
