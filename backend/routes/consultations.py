# routes/consultations.py
"""
Routes pour la gestion des consultations médicales.

Les consultations sont créées et consultées par le médecin.
Elles sont liées à un patient et à un médecin.

Rôle dans le projet :
Ce fichier contient les routes HTTP pour gérer les consultations :

Enregistrer une nouvelle consultation

Modifier une consultation (optionnel)

Lister les consultations d’un patient (historique)

Récupérer une consultation par son ID
"""

from fastapi import APIRouter, HTTPException, status, Body, Query
from bson import ObjectId
from typing import List
from datetime import datetime, date
from pydantic import BaseModel
import math

import logging

logger = logging.getLogger(__name__)

from database import db
from models.consultation import (
    ConsultationCreate,
    ConsultationUpdate,
    ConsultationInDB,
)

consultations_collection = db["consultations"]

consultations_router = APIRouter(
    # prefix="/consultations",
    tags=["Consultations"]
)

# Fonction utilitaire pour transformer un document MongoDB en dict Pydantic
def consultation_helper(consultation: dict) -> dict:
    
    # Gérer la conversion datetime -> string pour le frontend
    date_consultation = consultation["date_consultation"]
    if isinstance(date_consultation, datetime):
        # Convertir en string YYYY-MM-DD pour le frontend
        date_consultation = date_consultation.strftime("%Y-%m-%d")
    elif isinstance(date_consultation, date):
        # Convertir date en string
        date_consultation = date_consultation.strftime("%Y-%m-%d")
    
    # Gérer created_at et updated_at
    created_at = consultation.get("created_at")
    if isinstance(created_at, datetime):
        created_at = created_at.isoformat()
        
    updated_at = consultation.get("updated_at")
    if isinstance(updated_at, datetime):
        updated_at = updated_at.isoformat()
    
    result = {
        "id": str(consultation["_id"]),
        "patient_id": consultation["patient_id"],
        "medecin_id": consultation["medecin_id"],
        "date_consultation": date_consultation,
        "motif": consultation["motif"],
        "symptomes": consultation["symptomes"],
        "diagnostic": consultation.get("diagnostic"),
        "traitement": consultation.get("traitement"),
        "notes": consultation.get("notes"),
        "created_at": created_at,
        "updated_at": updated_at,
    }
    
    if "patient" in consultation:
        result["patient"] = consultation["patient"]
        logger.info(f"Patient ajouté au résultat: {result['patient']}")
    
    if "medecin" in consultation:
        result["medecin"] = consultation["medecin"]
        logger.info(f"Médecin ajouté au résultat: {result['medecin']}")
    
    return result
    
# Modèle pour la réponse paginée
class PaginatedConsultationResponse(BaseModel):
    items: List[ConsultationInDB]
    total: int
    page: int
    size: int
    pages: int
    
@consultations_router.get("/", response_model=PaginatedConsultationResponse)
@consultations_router.get("", response_model=PaginatedConsultationResponse)
def get_consultations(page: int = Query(1, ge=1), size: int = Query(10, ge=1)):
    skip = (page - 1) * size
    

    
    # Récupérer les consultations avec pagination
    consultations = list(consultations_collection.find().skip(skip).limit(size))
    
    for i, consultation in enumerate(consultations):
        print(f"Consultation {i}: ID = {consultation.get('_id')}")
    
    # Compter le total pour la pagination
    total_count = consultations_collection.count_documents({})
    
    # Calculer le nombre de pages
    total_pages = math.ceil(total_count / size) if total_count > 0 else 1
    
    return PaginatedConsultationResponse(
        items=[consultation_helper(c) for c in consultations],
        total=total_count,
        page=page,
        size=size,
        pages=total_pages
    )

# Route : Créer une consultation
@consultations_router.post("", response_model=ConsultationInDB, status_code=status.HTTP_201_CREATED)
def create_consultation(consultation: ConsultationCreate):
    
    # Convertir les données avant insertion
    consultation_data = consultation.dict()
    
    # CONVERSION IMPORTANTE : date -> datetime pour MongoDB
    if isinstance(consultation_data.get('date_consultation'), date) and not isinstance(consultation_data.get('date_consultation'), datetime):
        consultation_data['date_consultation'] = datetime.combine(
            consultation_data['date_consultation'], 
            datetime.min.time()  # Heure à 00:00:00
        )
    elif isinstance(consultation_data.get('date_consultation'), str):
        # Si c'est une string, la convertir en datetime
        consultation_data['date_consultation'] = datetime.strptime(
            consultation_data['date_consultation'], 
            "%Y-%m-%d"
        )
    
    # Ajouter les timestamps
    consultation_data['created_at'] = datetime.utcnow()
    consultation_data['updated_at'] = datetime.utcnow()
    
    # OPTION 1: Utiliser le medecin_id envoyé depuis le frontend
    if not consultation_data.get('medecin_id'):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="medecin_id est requis"
        )
        
    try:
        # Insertion dans MongoDB
        result = consultations_collection.insert_one(consultation_data)
        
        # Récupérer le document créé
        created = consultations_collection.find_one({"_id": result.inserted_id})
        if not created:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erreur lors de la création de la consultation"
            )
            
        return consultation_helper(created)
        
    except Exception as e:
        logger.error(f"Erreur création consultation: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la création de la consultation: {str(e)}"
        )

# Route : Lister les consultations d'un patient (avec pagination)
@consultations_router.get("/patient/{patient_id}", response_model=List[ConsultationInDB])
def get_consultations_by_patient(
    patient_id: str,
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1)
):
    try:
        ObjectId(patient_id)
    except:
        raise HTTPException(status_code=400, detail="ID patient invalide")

    skip = (page - 1) * size
    consultations = consultations_collection.find({"patient_id": patient_id}).skip(skip).limit(size)
    return [consultation_helper(doc) for doc in consultations]

# Route : Lister les consultations d'un médecin (avec pagination)
@consultations_router.get("/medecin/{medecin_id}", response_model=List[ConsultationInDB])
def get_consultations_by_medecin(
    medecin_id: str,
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1)
):
    """Récupérer toutes les consultations d'un médecin spécifique"""
    try:
        ObjectId(medecin_id)
    except:
        raise HTTPException(status_code=400, detail="ID médecin invalide")

    skip = (page - 1) * size
    consultations = consultations_collection.find({"medecin_id": medecin_id}).skip(skip).limit(size)
    return [consultation_helper(doc) for doc in consultations]

# Route : Récupérer une consultation par son ID avec données enrichies
@consultations_router.get("/{consultation_id}", response_model=ConsultationInDB)
def get_consultation_by_id(consultation_id: str):
 
    try:
        obj_id = ObjectId(consultation_id)
    except Exception as e:
        logger.error(f"Erreur ObjectId: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail="ID consultation invalide")

    doc = consultations_collection.find_one({"_id": obj_id})
    
    if not doc:
        raise HTTPException(status_code=404, detail="Consultation non trouvée")
    
    # 🔧 ENRICHISSEMENT DES DONNÉES
    try:
        # Récupérer les données du patient
        patients_collection = db["patients"]
        patient_data = None
        if doc.get("patient_id"):
            try:
                patient_obj_id = ObjectId(doc["patient_id"])
                patient_data = patients_collection.find_one({"_id": patient_obj_id})
            except:
                # Si patient_id n'est pas un ObjectId, essayer comme string
                patient_data = patients_collection.find_one({"_id": doc["patient_id"]})
        
        # Récupérer les données du médecin
        users_collection = db["users"]
        medecin_data = None
        if doc.get("medecin_id"):
            try:
                medecin_obj_id = ObjectId(doc["medecin_id"])
                medecin_data = users_collection.find_one({"_id": medecin_obj_id})
            except:
                # Si medecin_id n'est pas un ObjectId, essayer comme string
                medecin_data = users_collection.find_one({"_id": doc["medecin_id"]})
        
        # Enrichir le document avec les données liées
        enriched_doc = doc.copy()
        
        if patient_data:
            enriched_doc["patient"] = {
                "id": str(patient_data["_id"]),
                "nom": patient_data.get("nom"),
                "prenom": patient_data.get("prenom"),
                "cin": patient_data.get("cin"),
                "date_naissance": patient_data.get("date_naissance"),
                "telephone": patient_data.get("telephone"),
                "adresse": patient_data.get("adresse"),
                "email": patient_data.get("email"),
            }
        else:
            logger.warning("Référence patient invalide détectée")
            
        if medecin_data:
            enriched_doc["medecin"] = {
                "id": str(medecin_data["_id"]),
                "nom": medecin_data.get("nom"),
                "email": medecin_data.get("email"),
                "role": medecin_data.get("role"),
            }
        else:
            logger.warning("Référence médecin invalide détectée")
        
        result = consultation_helper(enriched_doc)
        return result
        
    except Exception as e:
        logger.error(f"Erreur enrichissement consultation: {e}", exc_info=True)
        # En cas d'erreur, retourner au moins les données de base
        result = consultation_helper(doc)
        return result

# Route : Modifier une consultation
@consultations_router.put("/{consultation_id}", response_model=ConsultationInDB)
def update_consultation(consultation_id: str, updates: ConsultationUpdate = Body(...)):
    
    try:
        obj_id = ObjectId(consultation_id)
    except:
        raise HTTPException(status_code=400, detail="ID consultation invalide")

    existing = consultations_collection.find_one({"_id": obj_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Consultation non trouvée")

    # Préparer les données de mise à jour
    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    
    # Gérer la conversion de date si nécessaire
    if 'date_consultation' in update_data:
        date_val = update_data['date_consultation']
        if isinstance(date_val, str):
            update_data['date_consultation'] = datetime.strptime(date_val, "%Y-%m-%d")
        elif isinstance(date_val, date) and not isinstance(date_val, datetime):
            update_data['date_consultation'] = datetime.combine(date_val, datetime.min.time())
    
    # Ajouter le timestamp de mise à jour
    update_data['updated_at'] = datetime.utcnow()
        
    # Effectuer la mise à jour
    consultations_collection.update_one({"_id": obj_id}, {"$set": update_data})

    # Récupérer le document mis à jour
    updated = consultations_collection.find_one({"_id": obj_id})
    return consultation_helper(updated)

# Route : Supprimer une consultation
@consultations_router.delete("/{consultation_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_consultation(consultation_id: str):
    
    try:
        obj_id = ObjectId(consultation_id)
    except Exception as e:
        logger.error(f"Erreur ObjectId: {e}", exc_info=True)
        raise HTTPException(status_code=400, detail="ID consultation invalide")

    # Vérifier que la consultation existe
    existing = consultations_collection.find_one({"_id": obj_id})
    if not existing:
        logger.warning(f"Consultation non trouvée pour ID: {consultation_id}")
        raise HTTPException(status_code=404, detail="Consultation non trouvée")

    # Supprimer la consultation
    result = consultations_collection.delete_one({"_id": obj_id})
    
    if result.deleted_count == 1:
        logger.info(f"Consultation {consultation_id} supprimée avec succès")
        return {"message": "Consultation supprimée avec succès"}
    else:
        logger.error(f"Erreur lors de la suppression de la consultation {consultation_id}")
        raise HTTPException(status_code=500, detail="Erreur lors de la suppression")

# Route : Rechercher des consultations
@consultations_router.get("/search/", response_model=List[ConsultationInDB])
def search_consultations(
    q: str = Query(..., description="Terme de recherche"),
    page: int = Query(1, ge=1),
    size: int = Query(10, ge=1)
):
    """Rechercher des consultations par diagnostic, motif ou notes"""
    skip = (page - 1) * size
    
    # Recherche dans diagnostic, motif et notes
    search_query = {
        "$or": [
            {"diagnostic": {"$regex": q, "$options": "i"}},
            {"motif": {"$regex": q, "$options": "i"}},
            {"notes": {"$regex": q, "$options": "i"}},
            {"symptomes": {"$regex": q, "$options": "i"}}
        ]
    }
    
    consultations = consultations_collection.find(search_query).skip(skip).limit(size)
    return [consultation_helper(doc) for doc in consultations]

# Route : Statistiques des consultations
@consultations_router.get("/stats/general")
def get_consultation_stats():
    """Obtenir des statistiques générales sur les consultations"""
    try:
        # Nombre total de consultations
        total_consultations = consultations_collection.count_documents({})
        
        # Consultations par mois (derniers 6 mois)
        from datetime import datetime, timedelta
        six_months_ago = datetime.utcnow() - timedelta(days=180)
        
        recent_consultations = consultations_collection.count_documents({
            "created_at": {"$gte": six_months_ago}
        })
        
        # Consultations par médecin (top 10)
        pipeline = [
            {"$group": {"_id": "$medecin_id", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        
        consultations_by_medecin = list(consultations_collection.aggregate(pipeline))
        
        return {
            "total_consultations": total_consultations,
            "recent_consultations": recent_consultations,
            "consultations_by_medecin": consultations_by_medecin
        }
        
    except Exception as e:
        logger.error(f"Erreur lors de la récupération des statistiques: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Erreur lors du calcul des statistiques")