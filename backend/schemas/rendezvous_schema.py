# schemas/rendezvous_schema.py
"""
Fonction de transformation des documents RendezVous de MongoDB
vers des objets Python sérialisables (pour les réponses JSON).

Rôle dans le projet :
Ce fichier contient une fonction qui formate les documents MongoDB de la collection 
rendezvous en objets JSON-friendly, utilisables dans les réponses de l’API.
"""

from datetime import datetime


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