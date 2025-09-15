# utils/security.py
"""
Fonctions de sécurité : création et vérification des tokens JWT, récupération de l'utilisateur authentifié.

Rôle dans le projet :
Ce fichier contient toute la logique liée à la sécurité et à l’authentification, notamment :

la création de tokens JWT,

la vérification des tokens,

l’extraction de l’utilisateur connecté via le token (utilisé dans les routes protégées).
"""

from jose import JWTError, jwt
from datetime import datetime, timedelta
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from bson import ObjectId

from config import SECRET_KEY, ALGORITHM, ACCESS_TOKEN_EXPIRE_DELTA
from database import users_collection  # Utilisez la même collection
from schemas.user_schema import user_helper

security = HTTPBearer()

def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.utcnow() + ACCESS_TOKEN_EXPIRE_DELTA
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)) -> dict:    
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Token invalide ou expiré",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:        
        # Accéder au token via credentials.credentials
        payload = jwt.decode(credentials.credentials, SECRET_KEY, algorithms=[ALGORITHM])
        
        user_id: str = payload.get("sub")
        
        if user_id is None or not ObjectId.is_valid(user_id):
            raise credentials_exception
            
    except JWTError as e:
        print(f"Erreur JWT: {e}")
        raise credentials_exception

    user = users_collection.find_one({"_id": ObjectId(user_id)})
    
    if user is None:
        raise credentials_exception

    result = user_helper(user)
    return result