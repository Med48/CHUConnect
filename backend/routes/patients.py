# routes/patients.py
"""
Routes pour la gestion des patients : création, mise à jour, récupération, suppression.

Accessible aux médecins et secrétaires.
Rôle dans le projet :
Ce fichier contient toutes les routes HTTP liées aux patients, comme :

Ajouter un patient

Modifier un patient

Récupérer un patient par CIN

Lister tous les patients

Supprimer un patient (optionnel)

Chaque route utilise les modèles Pydantic définis dans models/patient.py et la base MongoDB via database.py.
"""

from fastapi import APIRouter, HTTPException, status, Body, Query, Depends, UploadFile, Form, File
from typing import List, Optional
from bson import ObjectId
from datetime import datetime, date
from database import db, get_database
from models.patient import PatientCreate, PatientUpdate, PatientInDB, PhotoUploadResponse
from motor.motor_asyncio import AsyncIOMotorDatabase, AsyncIOMotorGridFSBucket
from utils.security import get_current_user
from fastapi.responses import StreamingResponse
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorGridFSBucket
from bson.errors import InvalidId
import io
from PIL import Image
import logging

patients_collection = db["patients"]
rendezvous_collection = db["rendezvous"]
consultations_collection = db["consultations"]
users_collection = db["users"]

logger = logging.getLogger(__name__)

# Configuration pour les photos
ALLOWED_EXTENSIONS = {'jpg', 'jpeg', 'png'}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5MB
PHOTO_MAX_WIDTH = 800
PHOTO_MAX_HEIGHT = 600
PHOTO_QUALITY = 85

patients_router = APIRouter(
    tags=["Patients"]
)

def patient_helper(patient: dict) -> dict:
    """
    Convertir un document patient MongoDB en dictionnaire pour l'API
    ✅ INCLUT MAINTENANT TOUS LES CHAMPS Y COMPRIS LES PHOTOS
    """
    # Gérer la conversion datetime -> date si nécessaire
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
        "email": patient.get("email"),  # ✅ AJOUTER email
        "medecin_id": patient.get("medecin_id"),
        
        # ✅ AJOUTER TOUS LES CHAMPS PHOTO
        "photo_file_id": patient.get("photo_file_id"),
        "photo_url": patient.get("photo_url"),
        "photo_data": patient.get("photo_data"),
        "photo_filename": patient.get("photo_filename"),
        "photo_content_type": patient.get("photo_content_type"),
        
        # ✅ AJOUTER les timestamps
        "created_at": patient.get("created_at").isoformat() if patient.get("created_at") else None,
        "updated_at": patient.get("updated_at").isoformat() if patient.get("updated_at") else None
    }
    
    return result

# ✅ Fonction utilitaire pour transformer un document MongoDB en dict Pydantic
def consultation_helper(consultation: dict) -> dict:
    # Gérer la conversion datetime -> date si nécessaire
    date_consultation = consultation["date_consultation"]
    if isinstance(date_consultation, datetime):
        date_consultation = date_consultation.date()
    
    return {
        "id": str(consultation["_id"]),
        "patient_id": consultation["patient_id"],
        "medecin_id": consultation["medecin_id"],
        "date_consultation": date_consultation,
        "motif": consultation["motif"],
        "symptomes": consultation["symptomes"],
        "diagnostic": consultation.get("diagnostic"),
        "traitement": consultation.get("traitement"),
        "notes": consultation.get("notes"),
        "created_at": consultation.get("created_at"),
        "updated_at": consultation.get("updated_at"),
    }

# ✅ CORRIGER l'indentation de cette fonction
def rendezvous_helper(doc: dict) -> dict:
    return {
        "id": str(doc["_id"]),
        "patient_id": str(doc["patient_id"]),
        "medecin_id": str(doc["medecin_id"]),
        "date_rendez_vous": doc["date_rendez_vous"],
        "heure": doc["heure"],
        "motif": doc.get("motif"),
        "statut": doc.get("statut", "programme"),
    }

# ✅ MODIFIER la route get_patients pour filtrer par médecin
@patients_router.get("/", response_model=dict)
@patients_router.get("", response_model=dict)
def get_patients(
    page: int = Query(1, ge=1), 
    size: int = Query(10, ge=1),
    current_user: dict = Depends(get_current_user)
):
    skip = (page - 1) * size
    
    # Déterminer le medecin_id selon le rôle
    if current_user['role'] == 'medecin':
        medecin_id = current_user['id']
    elif current_user['role'] == 'secretaire':
        medecin_id = current_user.get('medecin_id')
        
        if not medecin_id:
            raise HTTPException(
                status_code=400, 
                detail="Secrétaire sans médecin associé"
            )
    else:
        raise HTTPException(
            status_code=403, 
            detail="Rôle non autorisé"
        )
    
    filter_query = {"medecin_id": medecin_id}
    
    # Compter le total pour ce médecin
    total = patients_collection.count_documents(filter_query)
    
    # Récupérer les patients paginés
    patients = patients_collection.find(filter_query).skip(skip).limit(size)
    patients_list = [patient_helper(p) for p in patients]
        
    return {
        "items": patients_list,
        "total": total,
        "page": page,
        "size": size,
        "pages": (total + size - 1) // size
    }

# ✅ MODIFIER la route get_patient_by_cin pour vérifier le médecin
@patients_router.get("/cin/{cin}", response_model=PatientInDB)
def get_patient_by_cin(cin: str, current_user: dict = Depends(get_current_user)):
    medecin_id = current_user['id']
    patient = patients_collection.find_one({"cin": cin, "medecin_id": medecin_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient non trouvé.")
    return patient_helper(patient)

@patients_router.post("", response_model=PatientInDB, status_code=status.HTTP_201_CREATED)
def create_patient(patient: PatientCreate, current_user: dict = Depends(get_current_user)):
    
    # ✅ DÉTERMINER LE MEDECIN_ID SELON LE RÔLE
    if current_user['role'] == 'medecin':
        medecin_id = current_user['id']
        
    elif current_user['role'] == 'secretaire':
        medecin_id = current_user.get('medecin_id')
        
        if not medecin_id:
            logger.error("Secrétaire sans médecin associé")
            raise HTTPException(
                status_code=400, 
                detail="Secrétaire sans médecin associé"
            )
            
        try:
            medecin_obj_id = ObjectId(medecin_id)
            medecin = users_collection.find_one({
                "_id": medecin_obj_id, 
                "role": "medecin"
            })
            if not medecin:
                raise HTTPException(
                    status_code=400, 
                    detail="Médecin associé non trouvé"
                )
        except:
            raise HTTPException(status_code=400, detail="medecin_id invalide")
    else:
        raise HTTPException(
            status_code=403, 
            detail="Rôle non autorisé pour créer des patients"
        )

    # 🔄 NOUVELLE LOGIQUE DE VÉRIFICATION DU CIN
    # Calculer l'âge du patient
    today = datetime.now().date()
    if isinstance(patient.date_naissance, datetime):
        birth_date = patient.date_naissance.date()
    else:
        birth_date = patient.date_naissance
    
    age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))

    # Convertir la date de naissance en datetime pour MongoDB
    if isinstance(patient.date_naissance, date) and not isinstance(patient.date_naissance, datetime):
        date_naissance_datetime = datetime.combine(patient.date_naissance, datetime.min.time())
    else:
        date_naissance_datetime = patient.date_naissance

    # Vérifier l'existence du CIN selon l'âge
    if age >= 18:
        # Pour les adultes : vérification stricte (CIN + médecin unique)
        existing_adult = patients_collection.find_one({
            "cin": patient.cin, 
            "medecin_id": medecin_id
        })
        if existing_adult:
            raise HTTPException(
                status_code=400, 
                detail="Un patient adulte avec ce CIN existe déjà pour ce médecin"
            )
    else:
        # Pour les mineurs : vérification par CIN + nom + prénom + date de naissance
        existing_minor = patients_collection.find_one({
            "cin": patient.cin,
            "nom": patient.nom,
            "prenom": patient.prenom,
            "date_naissance": date_naissance_datetime,
            "medecin_id": medecin_id
        })
        if existing_minor:
            raise HTTPException(
                status_code=400, 
                detail="Ce patient mineur existe déjà avec ces informations exactes"
            )
        
        # Vérifier si un tuteur avec ce CIN existe déjà
        existing_tuteur = patients_collection.find_one({
            "cin": patient.cin, 
            "medecin_id": medecin_id
        })
        if existing_tuteur:
            # Calculer l'âge du patient existant
            if isinstance(existing_tuteur.get('date_naissance'), datetime):
                existing_birth_date = existing_tuteur['date_naissance'].date()
            else:
                existing_birth_date = existing_tuteur['date_naissance']
            
            existing_age = today.year - existing_birth_date.year - ((today.month, today.day) < (existing_birth_date.month, existing_birth_date.day))
            
            if existing_age >= 18:
                logger.info(f"Mineur ajouté avec le CIN de son tuteur (âge tuteur: {existing_age} ans)")
            else:
                logger.info("Ajout d'un autre mineur avec le même CIN de tuteur")

    # Préparer les données du patient
    patient_data = patient.dict()
    patient_data['medecin_id'] = medecin_id
    
    # Ajouter des métadonnées pour la gestion
    patient_data['age_at_creation'] = age
    patient_data['is_minor'] = age < 18

    # Convertir date en datetime pour MongoDB (utiliser la même variable)
    patient_data['date_naissance'] = date_naissance_datetime

    # Insérer le patient
    result = patients_collection.insert_one(patient_data)
    created = patients_collection.find_one({"_id": result.inserted_id})
    
    return patient_helper(created)

@patients_router.put("/id/{patient_id}", response_model=PatientInDB)
def update_patient(
    patient_id: str, 
    updates: PatientUpdate = Body(...),
    current_user: dict = Depends(get_current_user)
):
    
    try:
        obj_id = ObjectId(patient_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID invalide")

    # ✅ DÉTERMINER LE MEDECIN_ID SELON LE RÔLE
    if current_user['role'] == 'medecin':
        medecin_id = current_user['id']
        
    elif current_user['role'] == 'secretaire':
        medecin_id = current_user.get('medecin_id')
        
        if not medecin_id:
            raise HTTPException(
                status_code=400, 
                detail="Secrétaire sans médecin associé"
            )
    else:
        raise HTTPException(
            status_code=403, 
            detail="Rôle non autorisé"
        )

    # Vérifier que le patient appartient au bon médecin
    existing = patients_collection.find_one({"_id": obj_id, "medecin_id": medecin_id})
    if not existing:
        raise HTTPException(status_code=404, detail="Patient non trouvé")

    update_data = {k: v for k, v in updates.dict().items() if v is not None}
    
    # Ne pas permettre de changer le medecin_id via update
    if 'medecin_id' in update_data:
        del update_data['medecin_id']
    
    # Convertir date en datetime si nécessaire pour la mise à jour
    if 'date_naissance' in update_data and isinstance(update_data['date_naissance'], date) and not isinstance(update_data['date_naissance'], datetime):
        update_data['date_naissance'] = datetime.combine(
            update_data['date_naissance'], 
            datetime.min.time()
        )
    
    patients_collection.update_one({"_id": obj_id}, {"$set": update_data})

    updated = patients_collection.find_one({"_id": obj_id})
    return patient_helper(updated)

@patients_router.delete("/id/{patient_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_patient(patient_id: str, current_user: dict = Depends(get_current_user)):
    
    try:
        obj_id = ObjectId(patient_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID invalide")

    # DÉTERMINER LE MEDECIN_ID SELON LE RÔLE
    if current_user['role'] == 'medecin':
        medecin_id = current_user['id']
        
    elif current_user['role'] == 'secretaire':
        medecin_id = current_user.get('medecin_id')
        
        if not medecin_id:
            raise HTTPException(
                status_code=400, 
                detail="Secrétaire sans médecin associé"
            )
    else:
        raise HTTPException(
            status_code=403, 
            detail="Rôle non autorisé"
        )
    
    # Vérifier que le patient appartient au bon médecin
    patient = patients_collection.find_one({"_id": obj_id, "medecin_id": medecin_id})
    
    if not patient:
        logger.warning("Tentative d'accès à un patient inexistant ou non autorisé")
        raise HTTPException(status_code=404, detail="Patient non trouvé")

    # Supprimer le patient
    result = patients_collection.delete_one({"_id": obj_id, "medecin_id": medecin_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Impossible de supprimer le patient")
    
@patients_router.get("/id/{patient_id}", response_model=PatientInDB)
def get_patient_by_id(patient_id: str, current_user: dict = Depends(get_current_user)):    
    try:
        obj_id = ObjectId(patient_id)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"ID invalide: {patient_id}")
    
    # DÉTERMINER LE MEDECIN_ID SELON LE RÔLE
    if current_user['role'] == 'medecin':
        medecin_id = current_user['id']
    elif current_user['role'] == 'secretaire':
        medecin_id = current_user.get('medecin_id')
        if not medecin_id:
            raise HTTPException(
                status_code=400, 
                detail="Secrétaire sans médecin associé"
            )
    else:
        raise HTTPException(
            status_code=403, 
            detail="Rôle non autorisé"
        )
    
    # Vérifier que le patient appartient au bon médecin
    patient = patients_collection.find_one({"_id": obj_id, "medecin_id": medecin_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient non trouvé")
    
    return patient_helper(patient)

@patients_router.get("/id/{patient_id}/appointments", response_model=List[dict])
def get_patient_appointments(patient_id: str, current_user: dict = Depends(get_current_user)):
    try:
        obj_id = ObjectId(patient_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID patient invalide")
    
    # DÉTERMINER LE MEDECIN_ID SELON LE RÔLE
    if current_user['role'] == 'medecin':
        medecin_id = current_user['id']
    elif current_user['role'] == 'secretaire':
        medecin_id = current_user.get('medecin_id')
        if not medecin_id:
            raise HTTPException(status_code=400, detail="Secrétaire sans médecin associé")
    else:
        raise HTTPException(status_code=403, detail="Rôle non autorisé")
    
    # Vérifier que le patient appartient au bon médecin
    patient = patients_collection.find_one({"_id": obj_id, "medecin_id": medecin_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient non trouvé")
    
    # Récupérer les rendez-vous du patient
    appointments = rendezvous_collection.find({"patient_id": patient_id})  
    
    return [rendezvous_helper(appointment) for appointment in appointments]

@patients_router.get("/id/{patient_id}/consultations", response_model=List[dict])
def get_patient_consultations(patient_id: str, current_user: dict = Depends(get_current_user)):
    try:
        obj_id = ObjectId(patient_id)
    except Exception:
        raise HTTPException(status_code=400, detail="ID patient invalide")
    
    # DÉTERMINER LE MEDECIN_ID SELON LE RÔLE
    if current_user['role'] == 'medecin':
        medecin_id = current_user['id']
    elif current_user['role'] == 'secretaire':
        medecin_id = current_user.get('medecin_id')
        if not medecin_id:
            raise HTTPException(status_code=400, detail="Secrétaire sans médecin associé")
    else:
        raise HTTPException(status_code=403, detail="Rôle non autorisé")
    
    # Vérifier que le patient appartient au bon médecin
    patient = patients_collection.find_one({"_id": obj_id, "medecin_id": medecin_id})
    if not patient:
        raise HTTPException(status_code=404, detail="Patient non trouvé")
    
    # Récupérer les consultations du patient
    consultations = consultations_collection.find({"patient_id": patient_id})
    
    return [consultation_helper(consultation) for consultation in consultations]

@patients_router.get("/medecin/{medecin_id}", response_model=dict)
def get_patients_by_medecin(
    medecin_id: str,
    page: int = Query(1, ge=1), 
    size: int = Query(50, ge=1),
    current_user: dict = Depends(get_current_user)
):
    """
    Récupérer tous les patients d'un médecin spécifique
    Accessible par le médecin lui-même ou ses secrétaires
    """
    
    # Vérification des autorisations
    if current_user["role"] == "medecin":
        # Un médecin ne peut voir que ses propres patients
        if current_user["id"] != medecin_id:
            raise HTTPException(
                status_code=403, 
                detail="Vous ne pouvez voir que vos propres patients"
            )
    elif current_user["role"] == "secretaire":
        # Une secrétaire ne peut voir que les patients de son médecin
        if current_user.get("medecin_id") != medecin_id:
            raise HTTPException(
                status_code=403, 
                detail="Vous ne pouvez voir que les patients de votre médecin"
            )
    else:
        raise HTTPException(
            status_code=403, 
            detail="Accès non autorisé"
        )

    try:
        # Vérifier que le médecin existe
        medecin_obj_id = ObjectId(medecin_id)
        medecin = users_collection.find_one({
            "_id": medecin_obj_id, 
            "role": "medecin"
        })
        if not medecin:
            raise HTTPException(status_code=404, detail="Médecin non trouvé")

        # Calculer la pagination
        skip = (page - 1) * size
        
        # Récupérer les patients du médecin
        filter_query = {"medecin_id": medecin_id}
        
        total = patients_collection.count_documents(filter_query)
        patients_cursor = patients_collection.find(filter_query).skip(skip).limit(size)
        
        patients_list = list(patients_cursor)
        
        patients = [patient_helper(patient) for patient in patients_list]
        
        return {
            "items": patients,
            "total": total,
            "page": page,
            "size": size,
            "pages": (total + size - 1) // size
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur dans get_patients_by_medecin: {e}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Erreur serveur: {str(e)}")
    
def allowed_file(filename: str) -> bool:
    """Vérifier si l'extension du fichier est autorisée"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def resize_image(image_data: bytes, max_width: int = PHOTO_MAX_WIDTH, max_height: int = PHOTO_MAX_HEIGHT) -> bytes:
    """Redimensionner l'image pour optimiser l'espace de stockage"""
    try:
        # Ouvrir l'image
        image = Image.open(io.BytesIO(image_data))
        
        # Convertir en RGB si nécessaire (pour PNG avec transparence)
        if image.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', image.size, (255, 255, 255))
            if image.mode == 'P':
                image = image.convert('RGBA')
            background.paste(image, mask=image.split()[-1] if image.mode == 'RGBA' else None)
            image = background
        
        # Redimensionner en gardant les proportions
        image.thumbnail((max_width, max_height), Image.Resampling.LANCZOS)
        
        # Sauvegarder dans un buffer
        output = io.BytesIO()
        image.save(output, format='JPEG', quality=PHOTO_QUALITY, optimize=True)
        output.seek(0)
        
        return output.getvalue()
    except Exception as e:
        logger.error(f"Erreur lors du redimensionnement de l'image: {e}")
        raise HTTPException(status_code=400, detail="Erreur lors du traitement de l'image")

# ✅ ROUTES POUR LES PHOTOS avec le bon type de db

@patients_router.post("/id/{patient_id}/photo", response_model=PhotoUploadResponse)
async def upload_patient_photo(
    patient_id: str,
    photo: UploadFile = File(...),
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    """Upload ou mise à jour de la photo d'un patient"""
    try:
        # Vérifier que le patient existe et appartient au bon médecin
        try:
            patient_obj_id = ObjectId(patient_id)
        except InvalidId:
            raise HTTPException(status_code=400, detail="ID patient invalide")
        
        patient = await db.patients.find_one({"_id": patient_obj_id})
        if not patient:
            raise HTTPException(status_code=404, detail="Patient non trouvé")
        
        # Vérification des autorisations
        user_role = current_user.get("role")
        if user_role == "medecin":
            # Un médecin ne peut modifier que ses propres patients
            if str(patient["medecin_id"]) != str(current_user["id"]):
                raise HTTPException(status_code=403, detail="Accès refusé à ce patient")
        elif user_role == "secretaire":
            # Une secrétaire ne peut modifier que les patients de son médecin
            if str(patient["medecin_id"]) != str(current_user["medecin_id"]):
                raise HTTPException(status_code=403, detail="Accès refusé à ce patient")
        else:
            raise HTTPException(status_code=403, detail="Rôle non autorisé")
        
        # Vérifications du fichier
        if not photo.filename:
            raise HTTPException(status_code=400, detail="Aucun fichier sélectionné")
        
        if not allowed_file(photo.filename):
            raise HTTPException(
                status_code=400, 
                detail="Format de fichier non supporté. Utilisez JPG, JPEG ou PNG."
            )
        
        # Lire le contenu du fichier
        content = await photo.read()
        if len(content) > MAX_FILE_SIZE:
            raise HTTPException(
                status_code=400, 
                detail=f"Fichier trop volumineux. Taille maximum: {MAX_FILE_SIZE // (1024*1024)}MB"
            )
        
        # Redimensionner l'image
        processed_image = resize_image(content)
        
        # ✅ Initialiser GridFS avec la base de données
        fs = AsyncIOMotorGridFSBucket(db, bucket_name="patient_photos")
        
        # Supprimer l'ancienne photo si elle existe
        if patient.get("photo_file_id"):
            try:
                await fs.delete(ObjectId(patient["photo_file_id"]))
                logger.info(f"Ancienne photo supprimée pour le patient {patient_id}")
            except Exception as e:
                logger.warning(f"Impossible de supprimer l'ancienne photo: {e}")
        
        # Uploader la nouvelle photo
        file_id = await fs.upload_from_stream(
            filename=f"patient_{patient_id}_{photo.filename}",
            source=io.BytesIO(processed_image),
            metadata={
                "patient_id": patient_id,
                "original_filename": photo.filename,
                "content_type": "image/jpeg",
                "uploaded_by": str(current_user["id"]),
                "file_size": len(processed_image)
            }
        )
        
        # Mettre à jour le document patient avec l'ID du fichier
        photo_url = f"/patients/id/{patient_id}/photo"
        await db.patients.update_one(
            {"_id": patient_obj_id},
            {
                "$set": {
                    "photo_file_id": str(file_id),
                    "photo_url": photo_url,
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        logger.info(f"Photo uploadée avec succès pour le patient {patient_id}")
        
        return PhotoUploadResponse(
            message="Photo uploadée avec succès",
            photo_url=photo_url,
            file_id=str(file_id)
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de l'upload de la photo: {e}")
        raise HTTPException(status_code=500, detail="Erreur interne du serveur")

@patients_router.get("/id/{patient_id}/photo")
async def get_patient_photo(
    patient_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    """Récupérer la photo d'un patient"""
    try:
        # Vérifier que le patient existe et appartient au bon médecin
        try:
            patient_obj_id = ObjectId(patient_id)
        except InvalidId:
            raise HTTPException(status_code=400, detail="ID patient invalide")
        
        patient = await db.patients.find_one({"_id": patient_obj_id})
        if not patient:
            raise HTTPException(status_code=404, detail="Patient non trouvé")
        
        # Vérification des autorisations
        user_role = current_user.get("role")
        if user_role == "medecin":
            if str(patient["medecin_id"]) != str(current_user["id"]):
                raise HTTPException(status_code=403, detail="Accès refusé à ce patient")
        elif user_role == "secretaire":
            if str(patient["medecin_id"]) != str(current_user["medecin_id"]):
                raise HTTPException(status_code=403, detail="Accès refusé à ce patient")
        else:
            raise HTTPException(status_code=403, detail="Rôle non autorisé")
        
        # Vérifier si le patient a une photo
        if not patient.get("photo_file_id"):
            raise HTTPException(status_code=404, detail="Aucune photo trouvée pour ce patient")
        
        # Récupérer la photo depuis GridFS
        fs = AsyncIOMotorGridFSBucket(db, bucket_name="patient_photos")
        
        try:
            file_id = ObjectId(patient["photo_file_id"])
            grid_out = await fs.open_download_stream(file_id)
            
            # Lire le contenu du fichier
            content = await grid_out.read()
            
            # Retourner l'image
            return StreamingResponse(
                io.BytesIO(content),
                media_type="image/jpeg",
                headers={
                    "Content-Disposition": f"inline; filename=patient_{patient_id}_photo.jpg"
                }
            )
            
        except Exception as e:
            logger.error(f"Erreur lors de la récupération de la photo: {e}")
            raise HTTPException(status_code=404, detail="Photo non trouvée")
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la récupération de la photo: {e}")
        raise HTTPException(status_code=500, detail="Erreur interne du serveur")

@patients_router.delete("/id/{patient_id}/photo")
async def delete_patient_photo(
    patient_id: str,
    db: AsyncIOMotorDatabase = Depends(get_database),
    current_user: dict = Depends(get_current_user)
):
    """Supprimer la photo d'un patient"""
    try:
        # Vérifier que le patient existe et appartient au bon médecin
        try:
            patient_obj_id = ObjectId(patient_id)
        except InvalidId:
            raise HTTPException(status_code=400, detail="ID patient invalide")
        
        patient = await db.patients.find_one({"_id": patient_obj_id})
        if not patient:
            raise HTTPException(status_code=404, detail="Patient non trouvé")
        
        # Vérification des autorisations
        user_role = current_user.get("role")
        if user_role == "medecin":
            if str(patient["medecin_id"]) != str(current_user["id"]):
                raise HTTPException(status_code=403, detail="Accès refusé à ce patient")
        elif user_role == "secretaire":
            if str(patient["medecin_id"]) != str(current_user["medecin_id"]):
                raise HTTPException(status_code=403, detail="Accès refusé à ce patient")
        else:
            raise HTTPException(status_code=403, detail="Rôle non autorisé")
        
        # Vérifier si le patient a une photo
        if not patient.get("photo_file_id"):
            raise HTTPException(status_code=404, detail="Aucune photo à supprimer")
        
        # Supprimer la photo de GridFS
        fs = AsyncIOMotorGridFSBucket(db, bucket_name="patient_photos")
        
        try:
            await fs.delete(ObjectId(patient["photo_file_id"]))
        except Exception as e:
            logger.warning(f"Erreur lors de la suppression du fichier GridFS: {e}")
        
        # Mettre à jour le document patient
        await db.patients.update_one(
            {"_id": patient_obj_id},
            {
                "$unset": {
                    "photo_file_id": "",
                    "photo_url": ""
                },
                "$set": {
                    "updated_at": datetime.utcnow()
                }
            }
        )
        
        logger.info(f"Photo supprimée avec succès pour le patient {patient_id}")
        
        return {"message": "Photo supprimée avec succès"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur lors de la suppression de la photo: {e}")
        raise HTTPException(status_code=500, detail="Erreur interne du serveur")