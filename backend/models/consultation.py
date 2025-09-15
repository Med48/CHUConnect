# models/consultation.py
"""
Modèles Pydantic pour la gestion des consultations médicales.

Chaque consultation est liée à un patient et à un médecin,
et contient les informations cliniques de la visite.

Rôle dans le projet :
Ce fichier définit les modèles Pydantic pour les consultations médicales, qui sont :

créées par le médecin à chaque visite d’un patient

liées à un patient et à un médecin (via leurs ObjectId)

utilisées pour enregistrer les symptômes, diagnostic, traitement, etc.
"""

from pydantic import BaseModel, Field
from datetime import datetime, date
from typing import Optional, List
from enum import Enum

class ConsultationBase(BaseModel):
    patient_id: str
    medecin_id: str
    date_consultation: date  # Utilisez date au lieu de datetime pour simplifier
    motif: str  # Ajouté
    symptomes: str    # Changé de List[str] à str
    diagnostic: Optional[str] = None
    traitement: Optional[str] = None
    notes: Optional[str] = None  # Ajouté
    # Supprimé medicaments pour l'instant

class ConsultationCreate(ConsultationBase):
    pass

class ConsultationUpdate(BaseModel):
    medecin_id: Optional[str] = None
    date_consultation: Optional[date] = None
    motif: Optional[str] = None
    symptomes: Optional[str] = None
    diagnostic: Optional[str] = None
    traitement: Optional[str] = None
    notes: Optional[str] = None

class ConsultationInDB(ConsultationBase):
    id: str = Field(alias="_id")
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    class Config:
        populate_by_name = True
