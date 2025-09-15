import google.generativeai as genai
import os
import json
from typing import Dict, List, Optional, Tuple
from datetime import datetime, timedelta, time
from database import db
import math
import logging

logger = logging.getLogger(__name__)

class PlanningService:
    def __init__(self):
        self.api_key = os.getenv("GEMINI_API_KEY")
        if not self.api_key:
            raise ValueError("GEMINI_API_KEY n'est pas définie")
        
        genai.configure(api_key=self.api_key)
        self.model = genai.GenerativeModel('gemini-1.5-flash')
        
        # Collections MongoDB
        self.rendezvous_collection = db["rendezvous"]
        self.consultations_collection = db["consultations"]
    
    def suggest_smart_datetime(self, medecin_id: str, motif: str, patient_info: Dict = None) -> Dict:
        """
        🆕 NOUVELLE FONCTION : Suggère automatiquement date ET heure basé sur le motif
        """
        try:
            print(f"🤖 Suggestion intelligente date+heure pour motif: {motif}")
            
            # 1. Analyser l'historique du médecin
            historical_data = self._get_historical_patterns(medecin_id)
            
            # 2. Analyser le motif pour déterminer l'urgence et le type
            motif_analysis = self._analyze_motif_priority(motif)
            
            # 3. Récupérer les 14 prochains jours de planning
            upcoming_schedule = self._get_upcoming_schedule(medecin_id, 14)
            
            # 4. Générer les suggestions intelligentes avec IA
            suggestions = self._generate_smart_datetime_suggestions(
                medecin_id, motif, motif_analysis, upcoming_schedule, historical_data, patient_info
            )
            
            return {
                "success": True,
                "suggestions": suggestions,
                "motif_analysis": motif_analysis,
                "next_available": self._find_next_available_slot(upcoming_schedule),
                "urgency_level": motif_analysis.get("urgency_level", "normal")
            }
            
        except Exception as e:
            logger.error(f"Erreur Smart DateTime: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "suggestions": {}
            }
    
    def _analyze_motif_priority(self, motif: str) -> Dict:
        """
        Analyse le motif pour déterminer la priorité et les contraintes temporelles
        """
        try:
            prompt = f"""
            Analyse ce motif de consultation médicale et détermine les caractéristiques de planification.
            
            Motif: "{motif}"
            
            Évalue selon ces critères:
            1. Niveau d'urgence (urgent/modere/routine)
            2. Type de consultation (premiere/suivi/urgence/preventif)
            3. Moment optimal (matin/apres-midi/flexible)
            4. Durée recommandée (15-60 minutes)
            5. Délai recommandé (aujourd'hui/cette_semaine/dans_2_semaines/flexible)
            
            Réponds UNIQUEMENT en JSON:
            {{
              "urgency_level": "urgent|modere|routine",
              "consultation_type": "premiere|suivi|urgence|preventif|specialise",
              "optimal_time": "matin|apres_midi|fin_journee|flexible",
              "recommended_duration": 30,
              "recommended_delay": "aujourd_hui|cette_semaine|sous_15_jours|flexible",
              "special_requirements": ["requirement1", "requirement2"],
              "reasoning": "Explication de l'analyse"
            }}
            """
            
            response = self.model.generate_content(prompt)
            analysis = self._parse_json_response(response.text)
            
            # Validation et defaults
            if not analysis or "urgency_level" not in analysis:
                analysis = {
                    "urgency_level": "routine",
                    "consultation_type": "suivi",
                    "optimal_time": "flexible",
                    "recommended_duration": 20,
                    "recommended_delay": "sous_15_jours",
                    "special_requirements": [],
                    "reasoning": "Analyse par défaut"
                }
            
            return analysis
            
        except Exception as e:
            logger.error(f"Erreur analyse motif: {e}", exc_info=True)
            return {
                "urgency_level": "routine",
                "consultation_type": "suivi",
                "optimal_time": "flexible",
                "recommended_duration": 20,
                "recommended_delay": "sous_15_jours",
                "special_requirements": [],
                "reasoning": "Erreur d'analyse - valeurs par défaut"
            }
    
    def _get_upcoming_schedule(self, medecin_id: str, days: int = 14) -> Dict:
        """
        Récupère le planning des prochains jours
        """
        try:
            start_date = datetime.now().date()
            end_date = start_date + timedelta(days=days)
            
            # Récupérer tous les RDV dans cette période
            rdv_list = list(self.rendezvous_collection.find({
                "medecin_id": medecin_id,
                "date_rendez_vous": {
                    "$gte": start_date.strftime("%Y-%m-%d"),
                    "$lte": end_date.strftime("%Y-%m-%d")
                },
                "statut": {"$ne": "annule"}
            }))
            
            # Organiser par date
            schedule = {}
            for i in range(days):
                current_date = start_date + timedelta(days=i)
                date_str = current_date.strftime("%Y-%m-%d")
                
                # Ignorer les week-ends
                if current_date.weekday() < 5:  # 0-4 = Lundi-Vendredi
                    daily_rdv = [rdv for rdv in rdv_list if rdv["date_rendez_vous"] == date_str]
                    schedule[date_str] = {
                        "date": date_str,
                        "day_name": current_date.strftime("%A"),
                        "appointments": [rdv["heure"] for rdv in daily_rdv],
                        "load": len(daily_rdv),
                        "available_slots": self._calculate_available_slots(daily_rdv)
                    }
            
            return schedule
            
        except Exception as e:
            logger.error(f"Erreur récupération planning: {e}", exc_info=True)
            return {}
    
    def _calculate_available_slots(self, daily_rdv: List) -> List[str]:
        """
        Calcule les créneaux disponibles pour une journée
        """
        occupied = [rdv["heure"] for rdv in daily_rdv]
        all_slots = []
        
        # Générer tous les créneaux (8h-18h45, par 15min)
        for hour in range(8, 19):
            for minute in [0, 15, 30, 45]:
                if hour == 18 and minute > 45:
                    break
                slot = f"{hour:02d}:{minute:02d}"
                if slot not in occupied:
                    all_slots.append(slot)
        
        return all_slots
    
    def _generate_smart_datetime_suggestions(self, medecin_id: str, motif: str, 
                                           motif_analysis: Dict, upcoming_schedule: Dict, 
                                           historical_data: Dict, patient_info: Dict) -> Dict:
        """
        Génère les suggestions intelligentes de date + heure avec IA
        """
        try:
            # Construire le prompt intelligent
            prompt = self._build_smart_datetime_prompt(
                motif, motif_analysis, upcoming_schedule, historical_data, patient_info
            )
            
            # Appeler Gemini
            response = self.model.generate_content(prompt)
            
            # Parser la réponse
            suggestions = self._parse_smart_datetime_response(response.text, upcoming_schedule)
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Erreur génération suggestions: {e}", exc_info=True)
            return self._fallback_smart_suggestions(upcoming_schedule, motif_analysis)
    
    def _build_smart_datetime_prompt(self, motif: str, motif_analysis: Dict, 
                                   upcoming_schedule: Dict, historical_data: Dict, 
                                   patient_info: Dict) -> str:
        """
        Construit le prompt pour la suggestion intelligente date+heure
        """
        # Préparer les données de planning
        schedule_summary = []
        for date, info in list(upcoming_schedule.items())[:7]:  # 7 prochains jours
            schedule_summary.append(f"{info['day_name']} {date}: {info['load']} RDV, {len(info['available_slots'])} créneaux libres")
        
        prompt = f"""
Tu es un assistant IA expert en planification médicale optimale.

ANALYSE DU MOTIF:
Motif: "{motif}"
- Urgence: {motif_analysis.get('urgency_level')}
- Type: {motif_analysis.get('consultation_type')}
- Moment optimal: {motif_analysis.get('optimal_time')}
- Durée: {motif_analysis.get('recommended_duration')} min
- Délai recommandé: {motif_analysis.get('recommended_delay')}

PLANNING ACTUEL (7 prochains jours):
{chr(10).join(schedule_summary)}

HISTORIQUE MÉDECIN:
- Charge moyenne: {historical_data.get('average_daily_load', 'N/A')} RDV/jour
- Heures préférées: {historical_data.get('preferred_hours', [])}

CONTRAINTES:
- Horaires: 08:00-18:45 (créneaux 15min)
- Pas de week-end
- Respecter l'urgence du motif
- Optimiser la charge de travail

MISSION:
Propose 3-5 suggestions optimales de date + heure en analysant:
1. L'urgence du motif
2. La charge de travail optimale
3. Les préférences du médecin
4. L'efficacité du planning

Réponds UNIQUEMENT en JSON:
{{
  "suggested_slots": [
    {{
      "date": "2024-01-15",
      "time": "09:30",
      "score": 95,
      "category": "optimal|recommande|acceptable|urgence",
      "reasoning": "Pourquoi ce créneau est optimal",
      "workload_impact": "leger|normal|charge",
      "day_context": "Description du contexte de la journée"
    }}
  ],
  "global_recommendations": [
    "Recommandation générale 1",
    "Recommandation générale 2"
  ],
  "urgency_advice": "Conseil spécifique selon l'urgence",
  "optimal_strategy": "Stratégie de planification recommandée"
}}
"""
        return prompt
    
    def _parse_smart_datetime_response(self, response_text: str, upcoming_schedule: Dict) -> Dict:
        """
        Parse la réponse JSON de l'IA pour les suggestions date+heure
        """
        try:
            parsed_data = self._parse_json_response(response_text)
            
            if not parsed_data or "suggested_slots" not in parsed_data:
                raise ValueError("Format invalide")
            
            # Valider et filtrer les suggestions
            valid_suggestions = []
            for slot in parsed_data.get("suggested_slots", []):
                if self._validate_datetime_suggestion(slot, upcoming_schedule):
                    valid_suggestions.append(slot)
            
            parsed_data["suggested_slots"] = valid_suggestions
            
            return parsed_data
            
        except Exception as e:
            logger.error(f"Erreur parsing datetime: {e}", exc_info=True)
            return self._fallback_smart_suggestions(upcoming_schedule, {})
    
    def _validate_datetime_suggestion(self, slot: Dict, upcoming_schedule: Dict) -> bool:
        """
        Valide qu'une suggestion date+heure est réaliste
        """
        try:
            date = slot.get("date")
            time = slot.get("time")
            
            if not date or not time:
                return False
            
            # Vérifier que la date est dans le planning
            if date not in upcoming_schedule:
                return False
            
            # Vérifier que l'heure est disponible
            if time not in upcoming_schedule[date]["available_slots"]:
                return False
            
            # Vérifier le format de l'heure
            datetime.strptime(time, "%H:%M")
            
            return True
            
        except:
            return False
    
    def _find_next_available_slot(self, upcoming_schedule: Dict) -> Dict:
        """
        Trouve le prochain créneau disponible
        """
        for date, info in upcoming_schedule.items():
            if info["available_slots"]:
                return {
                    "date": date,
                    "time": info["available_slots"][0],
                    "day_name": info["day_name"]
                }
        
        return {"date": None, "time": None, "day_name": None}
    
    def _fallback_smart_suggestions(self, upcoming_schedule: Dict, motif_analysis: Dict) -> Dict:
        """
        Suggestions de fallback si l'IA échoue
        """
        suggestions = []
        
        # Prendre les 3 premiers jours avec des créneaux disponibles
        count = 0
        for date, info in upcoming_schedule.items():
            if count >= 3:
                break
            
            if info["available_slots"]:
                # Suggérer le premier créneau disponible
                suggestions.append({
                    "date": date,
                    "time": info["available_slots"][0],
                    "score": 70 - (count * 5),  # Score décroissant
                    "category": "acceptable",
                    "reasoning": f"Prochain créneau disponible le {info['day_name']}",
                    "workload_impact": "normal",
                    "day_context": f"Journée avec {info['load']} RDV existants"
                })
                count += 1
        
        return {
            "suggested_slots": suggestions,
            "global_recommendations": [
                "Suggestions générées automatiquement",
                "Vérifiez la pertinence selon le contexte médical"
            ],
            "urgency_advice": "Consultez l'analyse du motif pour adapter la planification",
            "optimal_strategy": "Planification basique par ordre de disponibilité"
        }
    
    def _parse_json_response(self, response_text: str) -> Dict:
        """
        Parse une réponse JSON de Gemini avec nettoyage
        """
        try:
            clean_response = response_text.strip()
            if clean_response.startswith("```json"):
                clean_response = clean_response[7:]
            if clean_response.endswith("```"):
                clean_response = clean_response[:-3]
            
            return json.loads(clean_response)
            
        except json.JSONDecodeError as e:
            logger.error(f"Erreur parsing JSON: {e}", extra={"response_text": response_text})
            return {}
        except Exception as e:
            logger.error(f"Erreur générale parsing: {e}", exc_info=True)
            return {}
    
    # ✅ Garder les anciennes méthodes pour compatibilité
    def suggest_optimal_slots(self, medecin_id: str, date_str: str, motif: str) -> Dict:
        """
        Ancienne fonction - maintenue pour compatibilité
        """
        try:
            historical_data = self._get_historical_patterns(medecin_id)
            existing_slots = self._get_existing_appointments(medecin_id, date_str)
            estimated_duration = self._estimate_duration_with_ai(motif, historical_data)
            
            suggestions = self._generate_ai_suggestions(
                medecin_id, date_str, motif, existing_slots, 
                estimated_duration, historical_data
            )
            
            return {
                "success": True,
                "suggestions": suggestions,
                "estimated_duration": estimated_duration,
                "analysis": {
                    "existing_appointments": len(existing_slots),
                    "optimal_slots_count": len(suggestions.get("recommended_slots", [])),
                    "workload_assessment": suggestions.get("workload_assessment", "normal")
                }
            }
            
        except Exception as e:
            logger.error(f"Erreur Planning IA: {e}", exc_info=True)
            return {
                "success": False,
                "error": str(e),
                "suggestions": {}
            }
    
    # ... (garder toutes les autres méthodes existantes)
    def _get_historical_patterns(self, medecin_id: str) -> Dict:
        """Analyse les patterns historiques du médecin"""
        try:
            three_months_ago = datetime.now() - timedelta(days=90)
            date_filter = three_months_ago.strftime("%Y-%m-%d")
            
            historical_rdv = list(self.rendezvous_collection.find({
                "medecin_id": medecin_id,
                "date_rendez_vous": {"$gte": date_filter}
            }))
            
            historical_consultations = list(self.consultations_collection.find({
                "medecin_id": medecin_id,
                "date_consultation": {"$gte": date_filter}
            }))
            
            patterns = {
                "total_appointments": len(historical_rdv),
                "average_daily_load": self._calculate_average_daily_load(historical_rdv),
                "preferred_hours": self._find_preferred_hours(historical_rdv),
                "motif_durations": self._analyze_motif_durations(historical_consultations),
                "peak_days": self._find_peak_days(historical_rdv),
                "typical_gaps": self._analyze_typical_gaps(historical_rdv)
            }
            
            return patterns
            
        except Exception as e:
            logger.error(f"Erreur analyse historique: {e}", exc_info=True)
            return {}
    
    def _calculate_average_daily_load(self, rdv_list: List) -> float:
        """Calcule la charge moyenne quotidienne"""
        if not rdv_list:
            return 0.0
        
        dates = {}
        for rdv in rdv_list:
            date = rdv["date_rendez_vous"]
            dates[date] = dates.get(date, 0) + 1
        
        return sum(dates.values()) / len(dates) if dates else 0.0
    
    def _find_preferred_hours(self, rdv_list: List) -> List[str]:
        """Trouve les heures préférées du médecin"""
        hour_counts = {}
        for rdv in rdv_list:
            hour = rdv["heure"][:2]
            hour_counts[hour] = hour_counts.get(hour, 0) + 1
        
        sorted_hours = sorted(hour_counts.items(), key=lambda x: x[1], reverse=True)
        return [hour for hour, count in sorted_hours[:3]]
    
    def _analyze_motif_durations(self, consultations: List) -> Dict:
        """Analyse les durées par motif de consultation"""
        motif_stats = {}
        
        for consultation in consultations:
            motif = consultation.get("motif", "").lower()
            simplified_motif = self._simplify_motif(motif)
            
            if simplified_motif not in motif_stats:
                motif_stats[simplified_motif] = {
                    "count": 0,
                    "avg_duration": 20
                }
            motif_stats[simplified_motif]["count"] += 1
        
        return motif_stats
    
    def _simplify_motif(self, motif: str) -> str:
        """Simplifie les motifs pour regroupement"""
        motif = motif.lower()
        
        if any(word in motif for word in ["suivi", "controle", "renouvellement"]):
            return "suivi_routine"
        elif any(word in motif for word in ["douleur", "mal", "souffrance"]):
            return "douleur"
        elif any(word in motif for word in ["fievre", "grippe", "rhume"]):
            return "infection"
        elif any(word in motif for word in ["urgence", "urgent"]):
            return "urgence"
        elif any(word in motif for word in ["consultation", "premiere", "nouveau"]):
            return "premiere_consultation"
        else:
            return "consultation_generale"
    
    def _find_peak_days(self, rdv_list: List) -> List[str]:
        """Trouve les jours de la semaine les plus chargés"""
        day_counts = {}
        for rdv in rdv_list:
            try:
                date_obj = datetime.strptime(rdv["date_rendez_vous"], "%Y-%m-%d")
                day_name = date_obj.strftime("%A")
                day_counts[day_name] = day_counts.get(day_name, 0) + 1
            except:
                continue
        
        sorted_days = sorted(day_counts.items(), key=lambda x: x[1], reverse=True)
        return [day for day, count in sorted_days[:3]]
    
    def _analyze_typical_gaps(self, rdv_list: List) -> int:
        """Analyse les écarts typiques entre RDV"""
        daily_schedules = {}
        
        for rdv in rdv_list:
            date = rdv["date_rendez_vous"]
            if date not in daily_schedules:
                daily_schedules[date] = []
            daily_schedules[date].append(rdv["heure"])
        
        gaps = []
        for date, times in daily_schedules.items():
            if len(times) > 1:
                times.sort()
                for i in range(1, len(times)):
                    try:
                        t1 = datetime.strptime(times[i-1], "%H:%M")
                        t2 = datetime.strptime(times[i], "%H:%M")
                        gap = (t2 - t1).seconds // 60
                        if gap > 0 and gap <= 120:
                            gaps.append(gap)
                    except:
                        continue
        
        return int(sum(gaps) / len(gaps)) if gaps else 30
    
    def _get_existing_appointments(self, medecin_id: str, date_str: str) -> List[str]:
        """Récupère les créneaux déjà occupés"""
        existing = list(self.rendezvous_collection.find({
            "medecin_id": medecin_id,
            "date_rendez_vous": date_str,
            "statut": {"$ne": "annule"}
        }))
        
        return [rdv["heure"] for rdv in existing]
    
    def _estimate_duration_with_ai(self, motif: str, historical_data: Dict) -> int:
        """Estime la durée avec IA basée sur le motif et l'historique"""
        try:
            simplified_motif = self._simplify_motif(motif)
            
            motif_durations = historical_data.get("motif_durations", {})
            if simplified_motif in motif_durations:
                base_duration = motif_durations[simplified_motif]["avg_duration"]
            else:
                prompt = f"""
                Estime la durée typique en minutes pour cette consultation médicale.
                
                Motif: {motif}
                
                Réponds UNIQUEMENT avec un nombre entier représentant les minutes.
                Durées typiques:
                - Consultation de routine/suivi: 15-20 min
                - Première consultation: 30-45 min
                - Consultation complexe: 30-60 min
                - Urgence: 20-30 min
                """
                
                response = self.model.generate_content(prompt)
                try:
                    base_duration = int(response.text.strip())
                    base_duration = max(10, min(60, base_duration))
                except:
                    base_duration = 20
            
            return base_duration
            
        except Exception as e:
            logger.error(f"Erreur estimation durée: {e}", exc_info=True)
            return 20
    
    def _generate_ai_suggestions(self, medecin_id: str, date_str: str, motif: str, 
                                existing_slots: List[str], estimated_duration: int, 
                                historical_data: Dict) -> Dict:
        """Génère les suggestions IA pour la planification"""
        try:
            prompt = self._build_planning_prompt(
                date_str, motif, existing_slots, estimated_duration, historical_data
            )
            
            response = self.model.generate_content(prompt)
            suggestions = self._parse_planning_response(response.text)
            
            return suggestions
            
        except Exception as e:
            logger.error(f"Erreur génération suggestions: {e}", exc_info=True)
            return self._fallback_suggestions(existing_slots, estimated_duration)
    
    def _build_planning_prompt(self, date_str: str, motif: str, existing_slots: List[str], 
                              estimated_duration: int, historical_data: Dict) -> str:
        """Construit le prompt pour l'IA de planification"""
        workload = len(existing_slots)
        
        try:
            date_obj = datetime.strptime(date_str, "%Y-%m-%d")
            day_name = date_obj.strftime("%A")
        except:
            day_name = "Unknown"
        
        prompt = f"""
Tu es un assistant IA spécialisé dans l'optimisation de planification médicale.

CONTEXTE:
- Date: {date_str} ({day_name})
- Motif consultation: {motif}
- Durée estimée: {estimated_duration} minutes
- Créneaux déjà occupés: {existing_slots}
- Charge actuelle: {workload} RDV
- Heures préférées du médecin: {historical_data.get('preferred_hours', [])}
- Charge moyenne quotidienne: {historical_data.get('average_daily_load', 0):.1f}

CONTRAINTES:
- Horaires: 08:00 à 18:45 (créneaux de 15 min)
- Éviter les chevauchements
- Prévoir des pauses appropriées

ANALYSEZ et proposez:
1. 3-5 créneaux optimaux
2. Évaluation de la charge de travail
3. Recommandations d'optimisation

Répondez UNIQUEMENT en JSON:
{{
  "recommended_slots": [
    {{
      "time": "14:30",
      "score": 95,
      "reason": "Créneau optimal après pause déjeuner"
    }}
  ],
  "workload_assessment": "normal|leger|charge|surcharge",
  "optimization_tips": [
    "Recommandation 1",
    "Recommandation 2"
  ],
  "ideal_breaks": ["12:00-13:00"],
  "efficiency_score": 85
}}
"""
        return prompt
    
    def _parse_planning_response(self, response_text: str) -> Dict:
        """Parse la réponse JSON de l'IA de planification"""
        try:
            clean_response = response_text.strip()
            if clean_response.startswith("```json"):
                clean_response = clean_response[7:]
            if clean_response.endswith("```"):
                clean_response = clean_response[:-3]
            
            parsed_data = json.loads(clean_response)
            
            if "recommended_slots" not in parsed_data:
                raise ValueError("Format invalide: 'recommended_slots' manquant")
            
            valid_slots = []
            for slot in parsed_data.get("recommended_slots", []):
                if self._is_valid_time_slot(slot.get("time", "")):
                    valid_slots.append(slot)
            
            parsed_data["recommended_slots"] = valid_slots
            
            return parsed_data
            
        except Exception as e:
            logger.error(f"Erreur parsing planning: {e}", exc_info=True)
            return self._fallback_suggestions([], 20)
    
    def _is_valid_time_slot(self, time_str: str) -> bool:
        """Valide qu'un créneau horaire est dans les heures de travail"""
        try:
            time_obj = datetime.strptime(time_str, "%H:%M").time()
            start_time = time(8, 0)
            end_time = time(18, 45)
            return start_time <= time_obj <= end_time
        except:
            return False
    
    def _fallback_suggestions(self, existing_slots: List[str], duration: int) -> Dict:
        """Suggestions de fallback en cas d'erreur IA"""
        all_slots = []
        for hour in range(8, 19):
            for minute in [0, 15, 30, 45]:
                if hour == 18 and minute > 45:
                    break
                slot_time = f"{hour:02d}:{minute:02d}"
                if slot_time not in existing_slots:
                    all_slots.append({
                        "time": slot_time,
                        "score": 70,
                        "reason": "Créneau disponible"
                    })
        
        return {
            "recommended_slots": all_slots[:5],
            "workload_assessment": "normal",
            "optimization_tips": [
                "Vérifiez les conflits d'horaires",
                "Prévoyez des pauses entre consultations"
            ],
            "ideal_breaks": ["12:00-13:00"],
            "efficiency_score": 70
        }