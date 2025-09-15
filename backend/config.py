# config.py
"""
Configuration centrale de l'application (clé secrète, algorithmes, durée de token, etc.).
Charge les variables depuis le fichier .env.
"""

from dotenv import load_dotenv
import os
from datetime import timedelta

# Charger les variables depuis le fichier .env
load_dotenv()

# JWT settings
SECRET_KEY = os.getenv("SECRET_KEY", "supersecretkey")
ALGORITHM = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "60"))

# Calcul de l'expiration des tokens en timedelta
ACCESS_TOKEN_EXPIRE_DELTA = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)