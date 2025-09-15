# routes/auth.py
"""
Route d'authentification pour les utilisateurs.

Vérifie les identifiants (email + mot de passe) et retourne un JWT en cas de succès.

Rôle dans le projet :
Authentifier un utilisateur avec email + mot de passe

Générer un JWT token en cas de succès

Ce token pourra ensuite être utilisé pour sécuriser les autres routes (avec rôle)
"""

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel, EmailStr
from database import db
from models.user import Role
from utils.helpers import verify_password
from utils.security import create_access_token

auth_router = APIRouter()
users_collection = db["users"]

class LoginInput(BaseModel):
    email: EmailStr
    password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: str
    role: Role

@auth_router.post("/login", response_model=TokenResponse)
def login_user(credentials: LoginInput):
    user = users_collection.find_one({"email": credentials.email})
    if not user or not verify_password(credentials.password, user["password"]):
        raise HTTPException(status_code=401, detail="Identifiants invalides")

    token_data = {
        "sub": str(user["_id"]),
        "role": user["role"]
    }

    token = create_access_token(token_data)

    return TokenResponse(
        access_token=token,
        user_id=str(user["_id"]),
        role=user["role"]
    )