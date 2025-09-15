# database.py
"""
Connexion à la base de données MongoDB.

Ce fichier initialise la connexion à MongoDB et expose la variable `db`
que les routes peuvent utiliser pour accéder aux collections (patients, consultations, etc.).

Rôle dans le projet :
Ce fichier est responsable de :

Établir la connexion à MongoDB (locale ou cloud, comme MongoDB Atlas)

Exporter la base (db) pour l’utiliser dans toutes les routes
"""

# database.py - Solution mixte pour éviter les conflits

from pymongo import MongoClient
from motor.motor_asyncio import AsyncIOMotorClient
import os

# URL de connexion
MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")

# ✅ CLIENT SYNCHRONE (pour auth/login existant)
sync_client = MongoClient(MONGO_URI)
sync_db = sync_client["medical-app"]

# Collections synchrones (pour vos routes existantes)
users_collection = sync_db["users"]
patients_collection_sync = sync_db["patients"]

# ✅ CLIENT ASYNCHRONE (pour les nouvelles fonctionnalités avec photos)
async_client = AsyncIOMotorClient(MONGO_URI)
async_db = async_client["medical-app"]

# ✅ FONCTION pour FastAPI Depends (asynchrone)
async def get_database():
    """Fonction de dépendance asynchrone pour FastAPI"""
    return async_db

# ✅ FONCTION pour obtenir la base de données synchrone
def get_database_sync():
    """Version synchrone pour les routes auth existantes"""
    return sync_db

# ✅ ALIAS pour compatibilité avec votre code existant
client = sync_client
db = sync_db