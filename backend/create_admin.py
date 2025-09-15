import motor.motor_asyncio
from passlib.context import CryptContext
from datetime import datetime
import logging

logger = logging.getLogger(__name__)

# Connexion à MongoDB
client = motor.motor_asyncio.AsyncIOMotorClient("mongodb://localhost:27017")
db = client["medical-app"]
users_collection = db["users"]

# Pour hasher les mots de passe
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def create_admin():
    """Créer uniquement l'utilisateur admin"""
    
    # Vérifier si l'admin existe déjà
    existing_admin = await users_collection.find_one({"email": "admin@chu-oujda.ma"})
    
    if existing_admin:
        logger.warning("L'administrateur existe déjà", extra={
            "email": existing_admin['email'],
            "nom": existing_admin['nom']
        })
        return
    
    # Créer le nouvel admin
    admin_user = {
        "nom": "Administrateur",
        "email": "admin@chu-oujda.ma",
        "password": pwd_context.hash("admin123"),
        "role": "admin",
        "created_at": datetime.utcnow().isoformat()
    }
    
    # Insérer l'admin dans la base
    result = await users_collection.insert_one(admin_user)
    
    if result.inserted_id:
        print("✅ Administrateur créé avec succès!")
        print("=" * 40)
        print("📋 Informations de connexion:")
        print(f"👤 Nom: {admin_user['nom']}")
        print(f"📧 Email: {admin_user['email']}")
        print(f"🔐 Mot de passe: admin123")
        print(f"🏷️  Rôle: {admin_user['role']}")
        print("=" * 40)
        print("💡 Vous pouvez maintenant vous connecter avec ces identifiants.")
    else:
        print("❌ Erreur lors de la création de l'administrateur.")

# Lancer la fonction
if __name__ == "__main__":
    import asyncio
    
    print("🚀 Création de l'administrateur...")
    print("=" * 50)
    
    asyncio.run(create_admin())
    
    print("=" * 50)
    print("✨ Script terminé!")