# schemas/patient_schema.py
"""
Fonctions de transformation des documents Patient de MongoDB
vers des objets Python sérialisables (pour les réponses JSON).

Rôle dans le projet :
Ce fichier contient une fonction qui formate les documents MongoDB de la collection patients 
pour les rendre compatibles avec les réponses JSON de l'API.
"""

from datetime import datetime


def patient_helper(patient: dict) -> dict:
    """
    Convertir un document patient MongoDB en dictionnaire pour l'API
    INCLUT MAINTENANT TOUS LES CHAMPS Y COMPRIS LES PHOTOS
    """
    date_naissance = patient["date_naissance"]
    if isinstance(date_naissance, datetime):
        date_naissance = date_naissance.date()
    
    result = {
        "id": str(patient["_id"]),
        "nom": patient["nom"],
        "prenom": patient["prenom"],
        "cin": patient["cin"],
        "genre": patient["genre"],
        "date_naissance": date_naissance,
        "adresse": patient.get("adresse"),
        "telephone": patient.get("telephone"),
        "email": patient.get("email"),
        "medecin_id": patient.get("medecin_id"),
        
        # AJOUTER TOUS LES CHAMPS PHOTO
        "photo_file_id": patient.get("photo_file_id"),
        "photo_url": patient.get("photo_url"),
        "photo_data": patient.get("photo_data"),
        "photo_filename": patient.get("photo_filename"),
        "photo_content_type": patient.get("photo_content_type"),
        
        # AJOUTER les timestamps
        "created_at": patient.get("created_at").isoformat() if patient.get("created_at") else None,
        "updated_at": patient.get("updated_at").isoformat() if patient.get("updated_at") else None
    }
    
    return result