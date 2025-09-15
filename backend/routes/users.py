from fastapi import APIRouter, HTTPException, status, Body, Depends
from typing import List, Optional
from bson import ObjectId
from database import db
from models.user import UserCreate, UserInDB, UserPublic
from utils.helpers import hash_password, verify_password
from utils.security import get_current_user
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

users_collection = db["users"]
users_router = APIRouter()

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

@users_router.get("/me", response_model=UserPublic)
async def get_current_user_info(current_user: dict = Depends(get_current_user)):
    """Récupérer les informations complètes de l'utilisateur connecté"""
    
    try:
        user_id = current_user["id"]
        user_obj_id = ObjectId(user_id)
        
        print(f"Recherche utilisateur avec ID: {user_id}")
        full_user = users_collection.find_one({"_id": user_obj_id})
        
        if full_user:
            complete_user = user_helper(full_user)
            return complete_user
        else:
            logger.error(f"Utilisateur non trouvé en DB avec ID: {user_id}")
            raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
            
    except Exception as e:
        logger.error(f"Erreur dans /users/me: {e}")
        raise HTTPException(status_code=500, detail="Erreur serveur")

@users_router.post("/", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
@users_router.post("", response_model=UserPublic, status_code=status.HTTP_201_CREATED)
def create_user(
    user: UserCreate, 
    current_user: dict = Depends(get_current_user)
):
    """Créer un utilisateur"""
    
    # === VÉRIFICATION DES PERMISSIONS ===
    if current_user["role"] == "admin":  # ✅ CORRIGÉ : ["role"] au lieu de .role
        # Admin peut créer tout type d'utilisateur
        pass
    elif current_user["role"] == "medecin":  # ✅ CORRIGÉ
        # Médecin peut créer SEULEMENT des secrétaires
        if user.role != "secretaire":
            raise HTTPException(
                status_code=403, 
                detail="Les médecins peuvent seulement créer des secrétaires"
            )
    else:
        # Secrétaires et autres rôles ne peuvent rien créer
        raise HTTPException(
            status_code=403, 
            detail="Vous n'avez pas les permissions pour créer des utilisateurs"
        )
    
    # === VÉRIFICATIONS D'UNICITÉ ===
    if users_collection.find_one({"email": user.email}):
        raise HTTPException(status_code=400, detail="Email déjà utilisé")
    if users_collection.find_one({"nom": user.nom}):
        raise HTTPException(status_code=400, detail="Nom d'utilisateur déjà utilisé")

    # === GESTION SPÉCIFIQUE DES SECRÉTAIRES ===
    if user.role == "secretaire":
        # Auto-association si médecin crée
        if current_user["role"] == "medecin":  # ✅ CORRIGÉ
            # Si un médecin crée la secrétaire, l'associer automatiquement
            user.medecin_id = str(current_user["id"])
        elif not user.medecin_id:
            # Si admin crée, medecin_id est requis
            raise HTTPException(
                status_code=400, 
                detail="Un secrétaire doit être associé à un médecin (medecin_id requis)"
            )
        
        # Vérifier que le medecin_id existe et correspond à un médecin
        if user.medecin_id:
            try:
                medecin_obj_id = ObjectId(user.medecin_id)
            except:
                raise HTTPException(status_code=400, detail="medecin_id invalide")
                
            medecin = users_collection.find_one({
                "_id": medecin_obj_id, 
                "role": "medecin"
            })
            if not medecin:
                raise HTTPException(
                    status_code=400, 
                    detail="Le médecin spécifié n'existe pas"
                )
    
    # === GESTION MÉDECINS ET ADMINS ===
    elif user.role in ["medecin", "admin"]:
        if user.medecin_id is not None:
            raise HTTPException(
                status_code=400,
                detail="Un médecin ou admin ne peut pas avoir de medecin_id"
            )

    # === CRÉATION DE L'UTILISATEUR ===
    # Hasher le mot de passe
    hashed_pwd = hash_password(user.password)
    user_dict = user.dict()
    user_dict["password"] = hashed_pwd
    user_dict["created_at"] = datetime.utcnow().isoformat()
    user_dict["created_by"] = str(current_user["id"])  # ✅ CORRIGÉ
    
    inserted = users_collection.insert_one(user_dict)
    new_doc = users_collection.find_one({"_id": inserted.inserted_id})
    return user_helper(new_doc)

@users_router.get("/{user_id}", response_model=UserPublic)
def get_user(user_id: str):
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="ID invalide")
    doc = users_collection.find_one({"_id": obj_id})
    if not doc:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    return user_helper(doc)

@users_router.get("/", response_model=List[UserPublic])
def list_users(
    current_user: dict = Depends(get_current_user),
    role: Optional[str] = None
):
    """
    Récupérer les utilisateurs avec permissions basées sur le rôle
    - Admins: Peuvent voir tous les utilisateurs
    - Médecins: Peuvent voir tous les médecins + leurs secrétaires
    - Secrétaires: Peuvent voir leur médecin + autres médecins (pour les RDV)
    """
    
    try:
        user_role = current_user.get("role")
        
        if user_role == "admin":
            # Les admins peuvent voir tous les utilisateurs
            query = {}
            if role:
                query["role"] = role
            users_cursor = users_collection.find(query)
            
        elif user_role == "medecin":
            # Les médecins peuvent voir tous les médecins et leurs secrétaires
            current_medecin_id = current_user.get("id")
            if role == "medecin":
                # Seulement les médecins
                users_cursor = users_collection.find({"role": "medecin"})
            elif role == "secretaire":
                # Seulement les secrétaires de ce médecin
                users_cursor = users_collection.find({
                    "role": "secretaire", 
                    "medecin_id": current_medecin_id
                })
            else:
                # Tous les médecins + les secrétaires de ce médecin
                users_cursor = users_collection.find({
                    "$or": [
                        {"role": "medecin"},
                        {"role": "secretaire", "medecin_id": current_medecin_id}
                    ]
                })
                
        elif user_role == "secretaire":
            # Les secrétaires peuvent voir tous les médecins (pour les RDV) + leur médecin
            medecin_id = current_user.get("medecin_id")
            if role == "medecin":
                # Seulement les médecins
                users_cursor = users_collection.find({"role": "medecin"})
            else:
                # Tous les médecins (pas les autres secrétaires)
                users_cursor = users_collection.find({"role": "medecin"})
        
        else:
            raise HTTPException(
                status_code=403, 
                detail="Rôle non autorisé"
            )
        
        users_list = []
        for user_doc in users_cursor:
            print(f"Processing user: {user_doc}")
            try:
                processed_user = user_helper(user_doc)
                users_list.append(processed_user)
            except Exception as e:
                print(f"Erreur processing user {user_doc.get('_id')}: {e}")
                continue
        
        print(f"Total users found: {len(users_list)}")
        return users_list
        
    except Exception as e:
        print(f"Erreur dans list_users: {e}")
        raise HTTPException(status_code=500, detail="Erreur serveur")

@users_router.put("/{user_id}", response_model=UserPublic)
def update_user(
    user_id: str, 
    user_update: UserCreate,
    current_user: dict = Depends(get_current_user)
):
    """Mettre à jour un utilisateur (seuls les admins)"""
    # Vérifier que l'utilisateur actuel est admin
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=403, 
            detail="Seuls les administrateurs peuvent modifier les utilisateurs"
        )
    
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="ID invalide")
    
    # Vérifier que l'utilisateur existe
    existing_user = users_collection.find_one({"_id": obj_id})
    if not existing_user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    # Validation pour les secrétaires
    if user_update.role == "secretaire":
        if not user_update.medecin_id:
            raise HTTPException(
                status_code=400, 
                detail="Un secrétaire doit être associé à un médecin"
            )
        
        # Vérifier que le medecin_id existe
        try:
            medecin_obj_id = ObjectId(user_update.medecin_id)
        except:
            raise HTTPException(status_code=400, detail="medecin_id invalide")
            
        medecin = users_collection.find_one({
            "_id": medecin_obj_id, 
            "role": "medecin"
        })
        if not medecin:
            raise HTTPException(
                status_code=400, 
                detail="Le médecin spécifié n'existe pas"
            )
    
    # Pour les médecins et admins, medecin_id doit être None
    elif user_update.role in ["medecin", "admin"]:
        if user_update.medecin_id is not None:
            raise HTTPException(
                status_code=400,
                detail="Un médecin ou admin ne peut pas avoir de medecin_id"
            )
    
    # Préparer les données de mise à jour
    update_dict = user_update.dict()
    if user_update.password and user_update.password.strip():  # ← Vérifie que ce n'est pas vide
        update_dict["password"] = hash_password(user_update.password)
    else:
        update_dict["password"] = existing_user["password"]  # ← Garde l'ancien
    
    # Conserver la date de création originale
    if "created_at" not in update_dict:
        update_dict["created_at"] = existing_user.get("created_at")
    
    # Mettre à jour l'utilisateur
    users_collection.update_one(
        {"_id": obj_id},
        {"$set": update_dict}
    )
    
    # Récupérer l'utilisateur mis à jour
    updated_doc = users_collection.find_one({"_id": obj_id})
    return user_helper(updated_doc)

@users_router.delete("/{user_id}")
def delete_user(
    user_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Supprimer un utilisateur (seuls les admins)"""
    # Vérifier que l'utilisateur actuel est admin
    if current_user.get("role") != "admin":
        raise HTTPException(
            status_code=403, 
            detail="Seuls les administrateurs peuvent supprimer des utilisateurs"
        )
    
    try:
        obj_id = ObjectId(user_id)
    except:
        raise HTTPException(status_code=400, detail="ID invalide")
    
    # Vérifier que l'utilisateur existe
    existing_user = users_collection.find_one({"_id": obj_id})
    if not existing_user:
        raise HTTPException(status_code=404, detail="Utilisateur non trouvé")
    
    # Empêcher la suppression de son propre compte
    if str(obj_id) == current_user.get("id"):
        raise HTTPException(
            status_code=400, 
            detail="Vous ne pouvez pas supprimer votre propre compte"
        )
    
    # Supprimer l'utilisateur
    result = users_collection.delete_one({"_id": obj_id})
    
    if result.deleted_count == 1:
        return {"message": "Utilisateur supprimé avec succès"}
    else:
        raise HTTPException(status_code=500, detail="Erreur lors de la suppression")

# Routes spécifiques (gardées telles quelles)
@users_router.get("/medecins/", response_model=List[UserPublic])
def list_medecins():
    """Récupérer tous les médecins - accessible à tous les utilisateurs connectés"""
    medecins = users_collection.find({"role": "medecin"})
    return [user_helper(m) for m in medecins]

@users_router.get("/secretaires/", response_model=List[UserPublic])
def list_secretaires(current_user: dict = Depends(get_current_user)):
    """Récupérer les secrétaires selon les permissions"""
    user_role = current_user.get("role")
    
    if user_role == "admin":
        # Les admins voient tous les secrétaires
        secretaires = users_collection.find({"role": "secretaire"})
    elif user_role == "medecin":
        # Les médecins voient seulement leurs secrétaires
        current_medecin_id = current_user.get("id")
        secretaires = users_collection.find({
            "role": "secretaire",
            "medecin_id": current_medecin_id
        })
    else:
        raise HTTPException(
            status_code=403,
            detail="Non autorisé à voir les secrétaires"
        )
    
    return [user_helper(s) for s in secretaires]

@users_router.get("/medecin/{medecin_id}/secretaires", response_model=List[UserPublic])
def get_secretaires_by_medecin(
    medecin_id: str,
    current_user: dict = Depends(get_current_user)
):
    """Récupérer tous les secrétaires d'un médecin spécifique"""
    # Vérifier les permissions
    user_role = current_user.get("role")
    if user_role not in ["admin", "medecin"]:
        raise HTTPException(
            status_code=403,
            detail="Non autorisé"
        )
    
    # Si c'est un médecin, il ne peut voir que ses propres secrétaires
    if user_role == "medecin" and current_user.get("id") != medecin_id:
        raise HTTPException(
            status_code=403,
            detail="Un médecin ne peut voir que ses propres secrétaires"
        )
    
    try:
        obj_id = ObjectId(medecin_id)
    except:
        raise HTTPException(status_code=400, detail="medecin_id invalide")
    
    # Vérifier que le médecin existe
    medecin = users_collection.find_one({"_id": obj_id, "role": "medecin"})
    if not medecin:
        raise HTTPException(status_code=404, detail="Médecin non trouvé")
    
    # Récupérer les secrétaires associés
    secretaires = users_collection.find({
        "role": "secretaire",
        "medecin_id": medecin_id
    })
    return [user_helper(s) for s in secretaires]