# models/patient.py
"""
Définition des modèles Pydantic pour les patients.

Ces modèles servent à valider les données entrantes et sortantes
concernant les patients (création, modification, affichage).

Rôle dans le projet :
Ce fichier contient le modèle de données Pydantic pour valider les informations des patients :

quand on crée un nouveau patient

quand on modifie un patient

quand on retourne les données d’un patient depuis MongoDB

"""

from pydantic import BaseModel, Field, ConfigDict, validator
from typing import Optional
from datetime import date, datetime

class PatientBase(BaseModel):
    nom: str
    prenom: str
    cin: str
    genre: str
    date_naissance: date
    adresse: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None  # ✅ AJOUTER le champ email
    medecin_id: str  # ✅ AJOUTER ce champ
    
    # ✅ AJOUTER les validateurs
    @validator('cin')
    def cin_must_be_uppercase(cls, v):
        if v:
            return v.upper()
        return v
    
    @validator('genre')
    def validate_genre(cls, v):
        if v not in ['M', 'F']:
            raise ValueError('Genre doit être M ou F')
        return v
    
    @validator('email')
    def validate_email(cls, v):
        if v and '@' not in v:
            raise ValueError('Format email invalide')
        return v

class PatientCreate(PatientBase):
    pass  # même chose que PatientBase pour l'ajout
    # medecin_id est maintenant requis via PatientBase

class PatientUpdate(BaseModel):
    nom: Optional[str] = None
    prenom: Optional[str] = None
    cin: Optional[str] = None  # ✅ AJOUTER comme optionnel
    genre: Optional[str] = None
    date_naissance: Optional[date] = None
    adresse: Optional[str] = None
    telephone: Optional[str] = None
    email: Optional[str] = None  # ✅ AJOUTER comme optionnel
    medecin_id: Optional[str] = None  # ✅ AJOUTER comme optionnel pour les updates
    
    # ✅ AJOUTER les mêmes validateurs
    @validator('cin')
    def cin_must_be_uppercase(cls, v):
        if v:
            return v.upper()
        return v
    
    @validator('genre')
    def validate_genre(cls, v):
        if v and v not in ['M', 'F']:
            raise ValueError('Genre doit être M ou F')
        return v
    
    @validator('email')
    def validate_email(cls, v):
        if v and '@' not in v:
            raise ValueError('Format email invalide')
        return v

class PatientInDB(PatientBase):
    id: str = Field(..., alias="_id")  # pour retourner le _id MongoDB comme id
    # medecin_id est maintenant inclus via PatientBase
    
    # ✅ NOUVEAUX CHAMPS POUR LA PHOTO
    photo_file_id: Optional[str] = None
    photo_url: Optional[str] = None
    photo_data: Optional[str] = None  # Pour le stockage base64
    
    # ✅ AJOUTER les timestamps
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    model_config = ConfigDict(
        populate_by_name=True,
        from_attributes=True,
        # ✅ AJOUTER l'encodage JSON pour les dates
        json_encoders = {
            datetime: lambda dt: dt.isoformat() if dt else None,
            date: lambda d: d.isoformat() if d else None
        }
    )

# ✅ NOUVEAU MODÈLE pour la réponse d'upload de photo
class PhotoUploadResponse(BaseModel):
    message: str
    photo_url: str
    file_id: str

# ✅ ALIAS pour la compatibilité
PatientResponse = PatientInDB