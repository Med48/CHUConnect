from fastapi import APIRouter, HTTPException, status, Depends
from bson import ObjectId
from datetime import datetime
from typing import List

from database import db
from ai.gemini_service import GeminiService
from ai.schemas import DiagnosticRequest, DiagnosticResponse, AISuggestionCreate, AISuggestionInDB

import logging

logger = logging.getLogger(__name__)
# Collections MongoDB
ai_suggestions_collection = db["ai_suggestions"]
patients_collection = db["patients"]

ai_router = APIRouter(
    prefix="/ai",
    tags=["IA Diagnostique"]
)

# Instance du service Gemini
gemini_service = GeminiService()

def ai_suggestion_helper(doc: dict) -> dict:
    """Convertir un document MongoDB en dict pour l'API"""
    return {
        "id": str(doc["_id"]),
        "consultation_id": doc.get("consultation_id"),
        "patient_id": doc["patient_id"],
        "medecin_id": doc["medecin_id"],
        "input_data": doc["input_data"],
        "ai_response": doc["ai_response"],
        "selected_diagnostic": doc.get("selected_diagnostic"),
        "validated": doc.get("validated", False),
        "created_at": doc["created_at"].isoformat() if doc.get("created_at") else None,
        "updated_at": doc["updated_at"].isoformat() if doc.get("updated_at") else None,
    }

@ai_router.post("/diagnostic", response_model=DiagnosticResponse)
async def generate_diagnostic_suggestions(request: DiagnosticRequest):
    """
    Génère des suggestions de diagnostic basées sur les symptômes et informations patient
    """
    try:
        print(f"🤖 Requête IA reçue: {request.dict()}")
        
        # Validation des données d'entrée
        if not request.motif.strip() or not request.symptomes.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le motif et les symptômes sont requis pour l'analyse IA"
            )
        
        # Préparer les données pour Gemini
        consultation_data = {
            "motif": request.motif,
            "symptomes": request.symptomes
        }
        
        # Appeler le service Gemini
        result = gemini_service.generate_diagnostic_suggestions(
            patient_info=request.patient_info,
            consultation_data=consultation_data
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erreur IA: {result.get('error', 'Erreur inconnue')}"
            )
        
        logger.info(f"Suggestions générées: {result['suggestions']}")
        return DiagnosticResponse(**result["suggestions"])
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur génération diagnostic: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la génération des suggestions: {str(e)}"
        )

@ai_router.post("/save-suggestion", response_model=AISuggestionInDB)
async def save_ai_suggestion(suggestion: AISuggestionCreate):
    """
    Sauvegarde une suggestion IA avec la sélection du médecin
    """
    try:
        print(f"💾 Sauvegarde suggestion IA: {suggestion.dict()}")
        
        # Préparer les données pour MongoDB
        suggestion_data = suggestion.dict()
        suggestion_data["created_at"] = datetime.utcnow()
        suggestion_data["updated_at"] = datetime.utcnow()
        
        # Insérer dans MongoDB
        result = ai_suggestions_collection.insert_one(suggestion_data)
        
        # Récupérer le document créé
        created = ai_suggestions_collection.find_one({"_id": result.inserted_id})
        if not created:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="Erreur lors de la sauvegarde de la suggestion IA"
            )
        
        logger.info(f"Suggestion IA sauvegardée: {created}")
        return ai_suggestion_helper(created)
        
    except Exception as e:
        logger.error(f"Erreur sauvegarde suggestion IA: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la sauvegarde: {str(e)}"
        )

@ai_router.get("/suggestions/patient/{patient_id}", response_model=List[AISuggestionInDB])
async def get_patient_ai_suggestions(patient_id: str):
    """
    Récupère l'historique des suggestions IA pour un patient
    """
    try:
        suggestions = ai_suggestions_collection.find({"patient_id": patient_id}).sort("created_at", -1)
        return [ai_suggestion_helper(doc) for doc in suggestions]
    except Exception as e:
        logger.error(f"Erreur récupération suggestions IA: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la récupération: {str(e)}"
        )

@ai_router.put("/suggestion/{suggestion_id}/validate")
async def validate_ai_suggestion(suggestion_id: str, selected_diagnostic: str):
    """
    Valide une suggestion IA avec le diagnostic sélectionné par le médecin
    """
    try:
        obj_id = ObjectId(suggestion_id)
        
        # Mettre à jour la suggestion
        result = ai_suggestions_collection.update_one(
            {"_id": obj_id},
            {
                "$set": {
                    "selected_diagnostic": selected_diagnostic,
                    "validated": True,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        if result.matched_count == 0:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Suggestion IA non trouvée"
            )
        
        return {"message": "Suggestion validée avec succès"}
        
    except Exception as e:
        logger.error(f"Erreur validation suggestion IA: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la validation: {str(e)}"
        )

@ai_router.get("/stats/usage")
async def get_ai_usage_stats():
    """
    Statistiques d'utilisation de l'IA diagnostique
    """
    try:
        # Nombre total de suggestions générées
        total_suggestions = ai_suggestions_collection.count_documents({})
        
        # Nombre de suggestions validées
        validated_suggestions = ai_suggestions_collection.count_documents({"validated": True})
        
        # Suggestions par médecin
        pipeline = [
            {"$group": {"_id": "$medecin_id", "count": {"$sum": 1}}},
            {"$sort": {"count": -1}},
            {"$limit": 10}
        ]
        suggestions_by_medecin = list(ai_suggestions_collection.aggregate(pipeline))
        
        return {
            "total_suggestions": total_suggestions,
            "validated_suggestions": validated_suggestions,
            "validation_rate": (validated_suggestions / total_suggestions * 100) if total_suggestions > 0 else 0,
            "suggestions_by_medecin": suggestions_by_medecin
        }
        
    except Exception as e:
        logger.error(f"Erreur stats IA: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors du calcul des statistiques: {str(e)}"
        )