import motor.motor_asyncio
from passlib.context import CryptContext

# Connexion à MongoDB
client = motor.motor_asyncio.AsyncIOMotorClient("mongodb://localhost:27017")
db = client["medical-app"]
users_collection = db["users"]

# Pour hasher les mots de passe
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

async def init_users():
    existing = await users_collection.find_one({"email": "karim@chu-oujda.ma"})
    if not existing:
        await users_collection.insert_many([
            {
                "nom": "Dr. Karim",
                "email": "karim@chu-oujda.ma",
                "password": pwd_context.hash("medecin123"),
                "role": "medecin"
            },
            {
                "nom": "Samira",
                "email": "samira@chu-oujda.ma",
                "password": pwd_context.hash("secretaire123"),
                "role": "secretaire"
            }
        ])
        print("Utilisateurs insérés.")
    else:
        print("ℹLes utilisateurs existent déjà.")

# Lancer la fonction
import asyncio
asyncio.run(init_users())
