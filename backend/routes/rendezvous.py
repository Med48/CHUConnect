# routes/rendezvous.py
"""
Routes pour la gestion des rendez-vous médicaux.

Permet de créer, modifier, récupérer les rendez-vous liés à un patient et un médecin.

Rôle dans le projet :
Ce fichier gère les routes liées aux rendez-vous médicaux :

création, modification, récupération, suppression

consultation des rendez-vous d’un patient ou d’un médecin
"""

from fastapi import APIRouter, HTTPException, status, Body, Query, Path
from typing import List, Generic, TypeVar
from bson import ObjectId
from database import db
from datetime import datetime, date
import math
import re
from pydantic import BaseModel

from models.rendezvous import (
    RendezVousCreate,
    RendezVousUpdate,
    RendezVousInDB,
)


rendezvous_collection = db["rendezvous"]
patients_collection = db["patients"]
medecins_collection = db["users"]

rendezvous_router = APIRouter(
    tags=["Rendez-vous"]
)

# Helper
def rendezvous_helper(doc: dict) -> dict:
    # Fonction pour convertir les dates/datetime en string
    def format_date(date_value):
        if isinstance(date_value, datetime):
            return date_value.strftime("%Y-%m-%d")
        elif hasattr(date_value, 'strftime'):  # Pour les objets date
            return date_value.strftime("%Y-%m-%d")
        elif isinstance(date_value, str):
            return date_value
        else:
            return str(date_value)  # Fallback
    
    return {
        "id": str(doc["_id"]),
        "patient_id": str(doc["patient_id"]),
        "medecin_id": str(doc["medecin_id"]),
        "date_rendez_vous": format_date(doc["date_rendez_vous"]),  # ← Conversion
        "heure": doc["heure"],
        "motif": doc.get("motif"),
        "statut": doc.get("statut", "programme"),
    }
    
T = TypeVar('T')
    
class PaginatedResponse(BaseModel, Generic[T]):
    items: List[T]
    total: int
    page: int
    size: int
    pages: int

# Route pour les rendez-vous
@rendezvous_router.get("/", response_model=PaginatedResponse[RendezVousInDB])
@rendezvous_router.get("", response_model=PaginatedResponse[RendezVousInDB])
def get_all_rendezvous(page: int = Query(1, ge=1), size: int = Query(10, ge=1)):
    skip = (page - 1) * size
    
    # Récupérer les rendez-vous avec pagination
    rdvs = list(rendezvous_collection.find().skip(skip).limit(size))
    
    # Compter le total pour la pagination
    total_count = rendezvous_collection.count_documents({})
    
    # Calculer le nombre de pages
    total_pages = math.ceil(total_count / size) if total_count > 0 else 1
    
    return PaginatedResponse(
        items=[rendezvous_helper(doc) for doc in rdvs],
        total=total_count,
        page=page,
        size=size,
        pages=total_pages
    )

# Créer un rendez-vous
@rendezvous_router.post("", response_model=RendezVousInDB, status_code=status.HTTP_201_CREATED)
def create_rendezvous(rdv: RendezVousCreate):
    inserted = rendezvous_collection.insert_one(rdv.dict())
    new_doc = rendezvous_collection.find_one({"_id": inserted.inserted_id})
    return rendezvous_helper(new_doc)

# Lister les rendez-vous d’un patient (avec pagination)
@rendezvous_router.get("/patient/{patient_id}", response_model=List[RendezVousInDB])
def get_rendezvous_by_patient(
    patient_id: str,
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1)
):
    try:
        ObjectId(patient_id)
    except:
        raise HTTPException(status_code=400, detail="ID patient invalide")

    skip = (page - 1) * size
    rdvs = rendezvous_collection.find({"patient_id": patient_id}).skip(skip).limit(size)
    return [rendezvous_helper(doc) for doc in rdvs]

# Lister les rendez-vous d’un médecin
@rendezvous_router.get("/medecin/{medecin_id}", response_model=List[RendezVousInDB])
def get_rendezvous_by_medecin(
    medecin_id: str,
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1)
):
    try:
        ObjectId(medecin_id)
    except:
        raise HTTPException(status_code=400, detail="ID médecin invalide")

    skip = (page - 1) * size
    rdvs = rendezvous_collection.find({"medecin_id": medecin_id}).skip(skip).limit(size)
    return [rendezvous_helper(doc) for doc in rdvs]

# Récupérer un rendez-vous par ID
@rendezvous_router.get("/{rendezvous_id}", response_model=RendezVousInDB)
def get_rendezvous_by_id(rendezvous_id: str):
    try:
        obj_id = ObjectId(rendezvous_id)
    except:
        raise HTTPException(status_code=400, detail="ID rendez-vous invalide")

    doc = rendezvous_collection.find_one({"_id": obj_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Rendez-vous non trouvé")
    return rendezvous_helper(doc)

@rendezvous_router.get("/date/{date_rdv}", response_model=List[RendezVousInDB])
def get_appointments_by_date(date_rdv: str):
    try:
        # Convertir la string en date
        target_date = datetime.strptime(date_rdv, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Format de date invalide. Utilisez YYYY-MM-DD")
    
    # Rechercher les rendez-vous pour cette date
    appointments = rendezvous_collection.find({
        "date_rdv": date_rdv  # ou selon votre structure de données
    })
    
    return [rendezvous_helper(rdv) for rdv in appointments]

# Modifier un rendez-vous
@rendezvous_router.put("/{rendezvous_id}", response_model=RendezVousInDB)
def update_rendezvous(rendezvous_id: str, updates: RendezVousUpdate = Body(...)):
    try:
        obj_id = ObjectId(rendezvous_id)
    except:
        raise HTTPException(status_code=400, detail="ID rendez-vous invalide")

    existing = rendezvous_collection.find_one({"_id": obj_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Rendez-vous non trouvé")

    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    rendezvous_collection.update_one({"_id": obj_id}, {"$set": update_data})
    updated = rendezvous_collection.find_one({"_id": obj_id})
    return rendezvous_helper(updated)

# Supprimer un rendez-vous
@rendezvous_router.delete("/{rendezvous_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rendezvous(rendezvous_id: str):
    try:
        obj_id = ObjectId(rendezvous_id)
    except:
        raise HTTPException(status_code=400, detail="ID rendez-vous invalide")

    result = rendezvous_collection.delete_one({"_id": obj_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Rendez-vous non trouvé")
    

@rendezvous_router.get("/calendar/{year}/{month}", response_model=List[dict])
def get_appointments_by_month(year: int, month: int):
    
    try:
        # Créer les dates de début et fin du mois AVEC plus de flexibilité
        start_date = f"{year}-{month:02d}-01"
        
        # Calculer le dernier jour du mois
        if month == 12:
            end_date = f"{year + 1}-01-01"
        else:
            # Calculer le premier jour du mois suivant
            next_month = month + 1
            end_date = f"{year}-{next_month:02d}-01"
                
        rendezvous_collection = db["rendezvous"]
        
        # NOUVELLE APPROCHE : rechercher tous les rendez-vous du mois
        appointments = rendezvous_collection.find({
            "date_rendez_vous": {
                "$regex": f"^{year}-{month:02d}-"  # ← Plus simple et plus fiable
            }
        })
        
        result = []
        for apt in appointments:
            
            patient_id = apt["patient_id"]
            medecin_id = apt["medecin_id"]
            
            patients_collection = db["patients"]
            users_collection = db["users"]
            
            try:
                patient = patients_collection.find_one({"_id": ObjectId(patient_id)})
                medecin = users_collection.find_one({"_id": ObjectId(medecin_id)})
            except:
                # Si les IDs ne sont pas des ObjectId, essayer en tant que string
                patient = patients_collection.find_one({"_id": patient_id})
                medecin = users_collection.find_one({"_id": medecin_id})
            
            result.append({
                "id": str(apt["_id"]),
                "date_rendez_vous": apt["date_rendez_vous"],
                "heure": apt["heure"],
                "patient_nom": patient.get("nom", "Patient inconnu") if patient else "Patient inconnu",
                "medecin_nom": medecin.get("nom", "Médecin inconnu") if medecin else "Médecin inconnu",
                "motif": apt.get("motif", ""),
                "statut": apt.get("statut", "programme")
            })
        
        return result
        
    except Exception as e:
        print(f"Erreur: {e}")
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")

@rendezvous_router.get("/calendar/date/{year}/{month}/{day}", response_model=List[dict])
def get_appointments_by_date(year: int, month: int, day: int):
    # Reformater la date
    date_str = f"{year}-{month:02d}-{day:02d}"
    
    try:
        rendezvous_collection = db["rendezvous"]
        appointments = list(rendezvous_collection.find({
            "date_rendez_vous": date_str  # Recherche exacte
        }).sort("heure", 1))
        
        
        result = []
        for apt in appointments:
            
            patient_id = apt["patient_id"]
            medecin_id = apt["medecin_id"]
            
            patients_collection = db["patients"]
            users_collection = db["users"]
            
            try:
                patient = patients_collection.find_one({"_id": ObjectId(patient_id)})
                medecin = users_collection.find_one({"_id": ObjectId(medecin_id)})
            except:
                patient = patients_collection.find_one({"_id": patient_id})
                medecin = users_collection.find_one({"_id": medecin_id})
            
            result.append({
                "id": str(apt["_id"]),
                "date_rendez_vous": apt["date_rendez_vous"],
                "heure": apt["heure"],
                "patient_nom": patient.get("nom", "Patient inconnu") if patient else "Patient inconnu",
                "medecin_nom": medecin.get("nom", "Médecin inconnu") if medecin else "Médecin inconnu",
                "motif": apt.get("motif", ""),
                "statut": apt.get("statut", "programme")
            })
        
        return result
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur: {str(e)}")