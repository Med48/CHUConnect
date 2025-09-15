# utils/helpers.py
"""
Fonctions utilitaires réutilisables (hash, vérification, ObjectId safe, etc.).

Rôle dans le projet :
Ce fichier contient des fonctions utilitaires réutilisables dans plusieurs endroits de ton backend.
Il centralise les petites opérations comme le hachage de mots de passe, la vérification, et la génération d’ObjectId.
"""

from passlib.context import CryptContext
from bson import ObjectId

# Initialisation du gestionnaire de hash
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

# Hasher un mot de passe
def hash_password(password: str) -> str:
    return pwd_context.hash(password)

# Vérifier un mot de passe
def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)

# Vérifie si une chaîne est un ObjectId valide
def is_valid_objectid(id_str: str) -> bool:
    return ObjectId.is_valid(id_str)
