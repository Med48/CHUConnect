# models/rendezvous.py
"""
Modèles Pydantic pour les rendez-vous médicaux.

Chaque rendez-vous est planifié entre un patient et un médecin,
et peut contenir un motif et un statut (confirmé, annulé, en attente...).

Rôle dans le projet :
Ce fichier définit les modèles Pydantic pour les rendez-vous :

Chaque rendez-vous est lié à un patient et un médecin

Il contient la date, l'heure, le motif, et l’état du rendez-vous
"""

from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class RendezVousBase(BaseModel):
    patient_id: str
    medecin_id: str  # Changé de str à int pour correspondre à l'interface TS
    date_rendez_vous: str  # Ajouté pour séparer date et heure
    heure: str  # Ajouté pour correspondre à l'interface TS
    motif: Optional[str] = None
    statut: str = "programme"  # Changé de "en attente" à "programme"

class RendezVousCreate(RendezVousBase):
    pass

class RendezVousUpdate(BaseModel):
    date_rendez_vous: Optional[datetime] = None
    heure: Optional[str] = None
    motif: Optional[str] = None
    statut: Optional[str] = None

class RendezVousInDB(RendezVousBase):
    id: str = Field(..., alias="_id")

    class Config:
        from_attributes = True
        validate_by_name = True
