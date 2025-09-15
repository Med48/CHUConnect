# models/user.py
"""
Modèles Pydantic pour les utilisateurs (médecin, secrétaire).

Chaque utilisateur possède un rôle spécifique avec des droits différents.

Rôle dans le projet :
Ce fichier définit les modèles Pydantic pour les utilisateurs, c’est-à-dire ici le médecin et le secrétaire.
Il permet de gérer l’authentification, les rôles, et les informations de base des utilisateurs.
"""

from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from enum import Enum

class Role(str, Enum):
    medecin = "medecin"
    secretaire = "secretaire"
    admin = "admin"

class UserBase(BaseModel):
    nom: str  # ← Changé de 'username' à 'nom'
    email: EmailStr
    role: Role
    medecin_id: Optional[str] = None  # ✅ AJOUTER ce champ optionnel


class UserCreate(UserBase):
    password: str  # mot de passe en clair avant hashage

class UserInDB(UserBase):
    id: str = Field(..., alias="_id")
    password: str  # ← Changé de 'hashed_password' à 'password'

    class Config:
        from_attributes = True
        validate_by_name = True

class UserPublic(UserBase):
    id: str = Field(..., alias="_id")

    class Config:
        from_attributes = True
        validate_by_name = True