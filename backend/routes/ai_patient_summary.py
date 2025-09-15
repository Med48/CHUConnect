from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from datetime import datetime
from typing import Dict, Any
import logging

from database import db
from utils.security import get_current_user
from ai.gemini_service import generate_patient_summary

logger = logging.getLogger(__name__)

patients_collection = db["patients"]
consultations_collection = db["consultations"]
rendezvous_collection = db["rendezvous"]

ai_patient_summary_router = APIRouter(
    prefix="/ai/patient-summary",
    tags=["IA Patient Summary"]
)

def calculate_age(birth_date) -> int:
    """Calculer l'âge du patient"""
    today = datetime.now().date()
    if isinstance(birth_date, datetime):
        birth_date = birth_date.date()
    
    age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
    return age

@ai_patient_summary_router.post("/{patient_id}")
async def generate_patient_summary_endpoint(
    patient_id: str,
    current_user: dict = Depends(get_current_user)
):
    """
    Générer un résumé intelligent du patient avec l'IA Gemini
    Accessible uniquement aux médecins
    """
    try:
        # Vérification des autorisations (seuls les médecins)
        if current_user.get('role') != 'medecin':
            raise HTTPException(
                status_code=403, 
                detail="Seuls les médecins peuvent générer des résumés IA"
            )
        
        # Vérifier l'ID patient
        try:
            patient_obj_id = ObjectId(patient_id)
        except Exception:
            raise HTTPException(status_code=400, detail="ID patient invalide")
        
        # Récupérer le patient et vérifier l'appartenance au médecin
        patient = patients_collection.find_one({
            "_id": patient_obj_id, 
            "medecin_id": current_user['id']
        })
        
        if not patient:
            raise HTTPException(
                status_code=404, 
                detail="Patient non trouvé ou accès non autorisé"
            )
        
        # Récupérer toutes les consultations du patient pour ce médecin
        consultations = list(consultations_collection.find({
            "patient_id": patient_id,
            "medecin_id": current_user['id']
        }).sort("date_consultation", -1))
        
        # Vérifier qu'il y a des consultations
        if not consultations:
            raise HTTPException(
                status_code=400,
                detail="Aucune consultation trouvée pour générer un résumé"
            )
        
        # Récupérer les rendez-vous
        appointments = list(rendezvous_collection.find({
            "patient_id": patient_id,
            "medecin_id": current_user['id']
        }).sort("date_rendez_vous", -1))
        
        # Préparer les données pour l'IA
        patient_data = {
            "nom": f"{patient.get('nom', '')} {patient.get('prenom', '')}",
            "age": calculate_age(patient.get('date_naissance')),
            "genre": "Masculin" if patient.get('genre') == 'M' else "Féminin",
            "consultations": [
                {
                    "date": consultation['date_consultation'].strftime('%d/%m/%Y') if isinstance(consultation['date_consultation'], datetime) else str(consultation['date_consultation']),
                    "motif": consultation.get('motif', ''),
                    "symptomes": consultation.get('symptomes', ''),
                    "diagnostic": consultation.get('diagnostic', ''),
                    "traitement": consultation.get('traitement', ''),
                    "notes": consultation.get('notes', '')
                }
                for consultation in consultations
            ],
            "rendez_vous": [
                {
                    "date": rdv['date_rendez_vous'].strftime('%d/%m/%Y') if isinstance(rdv['date_rendez_vous'], datetime) else str(rdv['date_rendez_vous']),
                    "motif": rdv.get('motif', ''),
                    "statut": rdv.get('statut', '')
                }
                for rdv in appointments
            ]
        }
        
        logger.info(f"Génération résumé IA pour patient {patient_id} par médecin {current_user['id']}")
        
        # Générer le résumé avec Gemini
        resume_content = await generate_patient_summary(patient_data)
        
        # Structurer la réponse
        response = {
            "success": True,
            "patient_id": patient_id,
            "patient_nom": patient_data["nom"],
            "generated_at": datetime.utcnow().isoformat(),
            "resume_content": resume_content,
            "statistics": {
                "nb_consultations": len(consultations),
                "nb_rendez_vous": len(appointments),
                "periode_suivi": {
                    "premiere_consultation": consultations[-1]['date_consultation'].strftime('%d/%m/%Y') if consultations else None,
                    "derniere_consultation": consultations[0]['date_consultation'].strftime('%d/%m/%Y') if consultations else None
                }
            },
            "medecin_id": current_user['id'],
            "medecin_nom": current_user.get('nom', 'Dr. ' + current_user.get('username', ''))
        }
        
        logger.info(f"Résumé IA généré avec succès pour patient {patient_id}")
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la génération du résumé IA: {e}")
        raise HTTPException(
            status_code=500, 
            detail="Erreur interne lors de la génération du résumé"
        )