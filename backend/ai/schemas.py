from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime

class DiagnosticRequest(BaseModel):
    """Modèle pour la requête de diagnostic IA"""
    patient_info: Dict
    motif: str
    symptomes: str

class DiagnosticSuggestion(BaseModel):
    """Modèle pour une suggestion de diagnostic"""
    nom: str
    probabilite: int  # 0-100
    explication: str
    examens_recommandes: List[str]

class DiagnosticResponse(BaseModel):
    """Modèle pour la réponse complète de diagnostic"""
    diagnostics: List[DiagnosticSuggestion]
    recommandations_generales: str
    niveau_urgence: str  # Faible/Modéré/Élevé

class AISuggestionCreate(BaseModel):
    """Modèle pour sauvegarder les suggestions IA"""
    consultation_id: Optional[str] = None
    patient_id: str
    medecin_id: str
    input_data: Dict
    ai_response: Dict
    selected_diagnostic: Optional[str] = None
    validated: bool = False

class AISuggestionInDB(BaseModel):
    """Modèle pour les suggestions IA en base"""
    id: str
    consultation_id: Optional[str]
    patient_id: str
    medecin_id: str
    input_data: Dict
    ai_response: Dict
    selected_diagnostic: Optional[str]
    validated: bool
    created_at: datetime
    updated_at: Optional[datetime]