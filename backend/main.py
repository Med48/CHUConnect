# main.py
"""
Point d'entrée de l'application FastAPI.

Ce fichier initialise l'application FastAPI, configure le middleware CORS
(pour autoriser les connexions entre le frontend React et ce backend),
et inclut toutes les routes (auth, patients, consultations, rendez-vous...).

Rôle dans le projet :
Ce fichier est le point d'entrée principal de ton API FastAPI. Il configure :

le lancement de l’application

le chargement des routes (patients, consultations, etc.)

le middleware (CORS par exemple)

la connexion MongoDB si elle est déclenchée ici (ou déléguée à database.py)
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
import os

from routes.auth import auth_router
from routes.users import users_router
from routes.patients import patients_router
from routes.consultations import consultations_router
from routes.rendezvous import rendezvous_router
from routes.ai_diagnostic import ai_router
from routes.ai_planning import planning_router
from routes.ai_patient_summary import ai_patient_summary_router

app = FastAPI(
    title="API Gestion Médicale",
    version="1.0.0",
    redirect_slashes=True
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ⚠️ IMPORTANT : Les routes API DOIVENT être définies AVANT les routes statiques
app.include_router(auth_router, prefix="/auth", tags=["Authentification"])
app.include_router(users_router, prefix="/users", tags=["Utilisateurs"])
app.include_router(patients_router, prefix="/patients", tags=["Patients"])
app.include_router(consultations_router, prefix="/consultations", tags=["Consultations"])
app.include_router(rendezvous_router, prefix="/appointments", tags=["Rendez-vous"])
app.include_router(ai_router, prefix="/api")
app.include_router(planning_router, prefix="/api")
app.include_router(ai_patient_summary_router, prefix="/api")

# Servir les fichiers statiques
app.mount("/static", StaticFiles(directory="static"), name="static")

# Remplacez la route catch-all par celle-ci :
@app.get("/")
async def serve_index():
    return FileResponse("static/index.html")

# Et ajoutez ceci pour servir les autres fichiers statiques
@app.get("/{file_path:path}")
async def serve_static_files(file_path: str):
    # Ne pas intercepter les routes API
    api_prefixes = ["auth", "users", "patients", "consultations", "appointments", "api"]
    if any(file_path.startswith(prefix) for prefix in api_prefixes):
        raise HTTPException(status_code=404, detail="API route not found")
    
    full_path = f"static/{file_path}"
    if os.path.exists(full_path) and os.path.isfile(full_path):
        return FileResponse(full_path)
    
    # Pour les routes frontend (SPA routing)
    return FileResponse("static/index.html")