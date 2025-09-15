import google.generativeai as genai
import os
import json
import logging
from typing import Dict, List, Optional
from datetime import datetime

logger = logging.getLogger(__name__)

class GeminiService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY n'est pas définie dans les variables d'environnement")
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-1.5-flash')
        
    def generate_diagnostic_suggestions(self, patient_info: Dict, consultation_data: Dict) -> Dict:
        """
        Génère des suggestions de diagnostic basées sur les données patient et consultation
        """
        try:
            # Construire le prompt médical
            prompt = self._build_medical_prompt(patient_info, consultation_data)
            
            # Générer la réponse avec Gemini
            response = self.model.generate_content(prompt)
            
            # Parser la réponse JSON
            suggestions = self._parse_gemini_response(response.text)
            
            return {
                "success": True,
                "suggestions": suggestions,
                "timestamp": datetime.utcnow().isoformat(),
                "model_used": "gemini-1.5-flash"
            }
            
        except Exception as e:
            logger.error(f"Erreur Gemini API: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "suggestions": []
            }
    
    def _build_medical_prompt(self, patient_info: Dict, consultation_data: Dict) -> str:
        """
        Construit un prompt médical structuré pour Gemini
        """
        # Calculer l'âge approximatif
        age_info = ""
        if patient_info.get("date_naissance"):
            try:
                birth_date = datetime.strptime(patient_info["date_naissance"], "%Y-%m-%d")
                age = (datetime.now() - birth_date).days // 365
                age_info = f"Âge: {age} ans"
            except:
                age_info = "Âge: Non spécifié"
        
        prompt = f"""
Tu es un assistant médical IA spécialisé dans l'aide au diagnostic. Analyse les informations suivantes et propose des diagnostics différentiels probables.

INFORMATIONS PATIENT:
- {age_info}
- Sexe: {patient_info.get('sexe', 'Non spécifié')}

CONSULTATION:
- Motif: {consultation_data.get('motif', '')}
- Symptômes: {consultation_data.get('symptomes', '')}

INSTRUCTIONS:
1. Propose 3-4 diagnostics différentiels les plus probables
2. Pour chaque diagnostic, fournis:
   - Le nom du diagnostic
   - Un score de probabilité (0-100)
   - Une brève explication (2-3 lignes)
   - 1-2 examens complémentaires recommandés

3. Réponds UNIQUEMENT au format JSON suivant (aucun autre texte):

{{
  "diagnostics": [
    {{
      "nom": "Nom du diagnostic",
      "probabilite": 85,
      "explication": "Explication concise du diagnostic basée sur les symptômes",
      "examens_recommandes": ["Examen 1", "Examen 2"]
    }}
  ],
  "recommandations_generales": "Recommandations générales pour le patient",
  "niveau_urgence": "Faible/Modéré/Élevé"
}}

IMPORTANT: 
- Base-toi uniquement sur les symptômes fournis
- Évite les diagnostics trop spécialisés sans symptômes spécifiques
- Privilégie les diagnostics les plus courants correspondant aux symptômes
- Réponds en français
"""
        return prompt
    
    def _parse_gemini_response(self, response_text: str) -> List[Dict]:
        """
        Parse la réponse JSON de Gemini
        """
        try:
            # Nettoyer la réponse (enlever les balises markdown si présentes)
            clean_response = response_text.strip()
            if clean_response.startswith("```json"):
                clean_response = clean_response[7:]
            if clean_response.endswith("```"):
                clean_response = clean_response[:-3]
            
            # Parser le JSON
            parsed_data = json.loads(clean_response)
            
            # Validation de la structure
            if "diagnostics" not in parsed_data:
                raise ValueError("Format de réponse invalide: 'diagnostics' manquant")
            
            return parsed_data
            
        except json.JSONDecodeError as e:
            logger.error(f"Erreur parsing JSON: {e}", extra={"response_text": response_text})
            
            # Fallback en cas d'erreur de parsing
            return {
                "diagnostics": [{
                    "nom": "Diagnostic non disponible",
                    "probabilite": 0,
                    "explication": "Erreur lors de l'analyse IA",
                    "examens_recommandes": []
                }],
                "recommandations_generales": "Veuillez consulter un médecin pour un diagnostic approprié",
                "niveau_urgence": "Modéré"
            }
        
        except Exception as e:
            logger.error(f"Erreur générale parsing: {e}", exc_info=True)
            return {
                "diagnostics": [],
                "recommandations_generales": "Erreur lors de l'analyse",
                "niveau_urgence": "Modéré"
            }
            
async def generate_patient_summary(patient_data: dict) -> str:
    """
    Générer un résumé intelligent du patient avec Gemini
    """
    try:
        # Construction du prompt pour le résumé patient
        consultations_text = ""
        for i, consultation in enumerate(patient_data.get('consultations', []), 1):
            consultations_text += f"""
        Consultation {i} ({consultation.get('date', 'Date inconnue')}):
        - Motif: {consultation.get('motif', 'Non spécifié')}
        - Symptômes: {consultation.get('symptomes', 'Non spécifié')}
        - Diagnostic: {consultation.get('diagnostic', 'Non spécifié')}
        - Traitement: {consultation.get('traitement', 'Non spécifié')}
        - Notes: {consultation.get('notes', 'Aucune note')}
        """

        rdv_text = ""
        for rdv in patient_data.get('rendez_vous', []):
            rdv_text += f"- {rdv.get('date', 'Date inconnue')}: {rdv.get('motif', 'Motif non spécifié')} (Statut: {rdv.get('statut', 'Non défini')})\n"

        prompt = f"""
        Tu es un assistant médical IA spécialisé dans l'analyse de dossiers patients. 
        Génère un résumé médical structuré et professionnel pour ce patient.
        
        INFORMATIONS PATIENT:
        - Nom: {patient_data.get('nom', 'Non spécifié')}
        - Âge: {patient_data.get('age', 'Non spécifié')} ans
        - Genre: {patient_data.get('genre', 'Non spécifié')}
        
        HISTORIQUE DES CONSULTATIONS:
        {consultations_text}
        
        RENDEZ-VOUS:
        {rdv_text}
        
        INSTRUCTIONS:
        Génère un résumé médical structuré comprenant:
        
        ## PROFIL PATIENT
        Informations démographiques et contexte général
        
        ## SYNTHÈSE CLINIQUE
        - Problèmes de santé principaux identifiés
        - Évolution des symptômes dans le temps
        - Patterns récurrents ou tendances observées
        
        ## HISTORIQUE THÉRAPEUTIQUE
        - Traitements prescrits et leur chronologie
        - Efficacité observée des traitements
        - Changements de stratégie thérapeutique
        
        ## POINTS D'ATTENTION
        - Symptômes récurrents ou persistants
        - Facteurs de risque identifiés
        - Besoins de suivi spécifiques
        
        ## RECOMMANDATIONS
        - Axes de surveillance prioritaires
        - Examens complémentaires suggérés
        - Optimisations thérapeutiques possibles
        
        Le résumé doit être:
        - Objectif et factuel
        - Structuré et facile à lire
        - Orienté vers l'aide à la décision médicale
        - Respectueux de la confidentialité médicale
        
        Réponds uniquement avec le contenu du résumé en markdown, sans introduction ni conclusion.
        """

        # Génération avec Gemini
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        # Configuration pour un résumé médical
        generation_config = genai.types.GenerationConfig(
            temperature=0.3,  # Plus conservateur pour du médical
            top_p=0.8,
            top_k=40,
            max_output_tokens=2048,
        )
        
        response = await model.generate_content_async(
            prompt,
            generation_config=generation_config
        )
        
        if not response.text:
            raise Exception("Réponse vide de l'API Gemini")
            
        return response.text.strip()
        
    except Exception as e:
        logger.error(f"Erreur lors de la génération du résumé patient: {e}")
        raise Exception(f"Erreur IA: {str(e)}")