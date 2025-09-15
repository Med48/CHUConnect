# schemas/user_schema.py
"""
Fonction de transformation des documents User de MongoDB
vers des objets Python sérialisables (pour les réponses JSON).

Rôle dans le projet :
Ce fichier permet de convertir les documents MongoDB des utilisateurs (médecin ou secrétaire) 
en objets Python utilisables dans les réponses API.
Il est notamment utilisé après l'inscription ou lors de la récupération de profils.
"""

from datetime import datetime

    
def user_helper(doc: dict) -> dict:
    
    # Vérifier les valeurs
    nom_value = doc.get("nom", "")
    email_value = doc.get("email", "")
    role_value = doc.get("role", "")
    medecin_id_value = doc.get("medecin_id")
    created_at_value = doc.get("created_at")
    
    try:
        # TOUJOURS convertir _id en id string
        user_id = str(doc["_id"])  # ← Important : toujours convertir
        
        result = {
            "id": user_id,  # ← Utiliser la variable
            "nom": nom_value,
            "email": email_value,
            "role": role_value,
            "medecin_id": medecin_id_value,
            "created_at": created_at_value or datetime.utcnow().isoformat(),
        }
        return result
    except Exception as e:
        print(f"ERREUR dans user_helper: {e}")
        raise e