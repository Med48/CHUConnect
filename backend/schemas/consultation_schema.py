# schemas/consultation_schema.py
"""
Fonctions de transformation des documents Consultation de MongoDB
vers des objets Python sérialisables (pour les réponses JSON).

Rôle dans le projet :
Ce fichier contient une fonction utilitaire pour convertir les documents MongoDB de la collection consultations 
en dictionnaires Python sérialisables (par exemple pour les réponses JSON).
Cela permet de ne pas renvoyer le champ Mongo _id brut ni d’avoir des types incompatibles avec JSON.
"""

# Fonction utilitaire pour transformer un document MongoDB en dict Pydantic
from datetime import date, datetime


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
    
    if "medecin" in consultation:
        result["medecin"] = consultation["medecin"]
    
    return result