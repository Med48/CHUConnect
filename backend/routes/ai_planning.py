from fastapi import APIRouter, HTTPException, status
from typing import Dict, List, Optional
from datetime import datetime, timedelta
from pydantic import BaseModel

from ai.planning_service import PlanningService
from database import db
import logging

logger = logging.getLogger(__name__)

# Modèles Pydantic
class SmartDateTimeRequest(BaseModel):
    medecin_id: str
    motif: str
    patient_info: Optional[Dict] = None

class DateTimeSlotSuggestion(BaseModel):
    date: str
    time: str
    score: int
    category: str
    reasoning: str
    workload_impact: str
    day_context: str

class SmartDateTimeResponse(BaseModel):
    suggested_slots: List[DateTimeSlotSuggestion]
    global_recommendations: List[str]
    urgency_advice: str
    optimal_strategy: str
    motif_analysis: Dict
    next_available: Dict

class PlanningRequest(BaseModel):
    medecin_id: str
    date_rendez_vous: str
    motif: str

class SlotSuggestion(BaseModel):
    time: str
    score: int
    reason: str

class PlanningResponse(BaseModel):
    recommended_slots: List[SlotSuggestion]
    workload_assessment: str
    optimization_tips: List[str]
    ideal_breaks: List[str]
    efficiency_score: int
    estimated_duration: int

class WorkloadAnalysis(BaseModel):
    date: str
    total_appointments: int
    occupied_hours: List[str]
    available_slots: int
    workload_level: str
    recommendations: List[str]

# Router
planning_router = APIRouter(
    prefix="/planning",
    tags=["Planification IA"]
)

# Instance du service
planning_service = PlanningService()

@planning_router.post("/suggest-smart-datetime", response_model=SmartDateTimeResponse)
async def suggest_smart_datetime(request: SmartDateTimeRequest):
    """
    🆕 NOUVELLE ROUTE : Suggère automatiquement date ET heure basé sur le motif seulement
    """
    try:
        print(f"🤖 Suggestion intelligente date+heure:")
        print(f"- Médecin: {request.medecin_id}")
        print(f"- Motif: {request.motif}")
        
        # Validation du motif
        if not request.motif.strip():
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Le motif de consultation est requis pour l'analyse IA"
            )
        
        # Appeler le service IA
        result = planning_service.suggest_smart_datetime(
            request.medecin_id,
            request.motif,
            request.patient_info
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erreur IA Smart Planning: {result.get('error', 'Erreur inconnue')}"
            )
        
        suggestions = result["suggestions"]
        
        response = SmartDateTimeResponse(
            suggested_slots=[
                DateTimeSlotSuggestion(**slot) for slot in suggestions.get("suggested_slots", [])
            ],
            global_recommendations=suggestions.get("global_recommendations", []),
            urgency_advice=suggestions.get("urgency_advice", ""),
            optimal_strategy=suggestions.get("optimal_strategy", ""),
            motif_analysis=result.get("motif_analysis", {}),
            next_available=result.get("next_available", {})
        )
        
        logger.info(f"Suggestions générées: {len(response.suggested_slots)} créneaux date+heure")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur smart datetime: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la génération des suggestions: {str(e)}"
        )

@planning_router.post("/suggest-slots", response_model=PlanningResponse)
async def suggest_optimal_slots(request: PlanningRequest):
    """
    Suggère les créneaux optimaux pour un rendez-vous
    """
    try:
        print(f"🤖 Demande de suggestions de planification:")
        print(f"- Médecin: {request.medecin_id}")
        print(f"- Date: {request.date_rendez_vous}")
        print(f"- Motif: {request.motif}")
        
        # Validation de la date
        try:
            date_obj = datetime.strptime(request.date_rendez_vous, "%Y-%m-%d")
            if date_obj.date() < datetime.now().date():
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="La date ne peut pas être dans le passé"
                )
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Format de date invalide. Utilisez YYYY-MM-DD"
            )
        
        # Appeler le service IA
        result = planning_service.suggest_optimal_slots(
            request.medecin_id,
            request.date_rendez_vous,
            request.motif
        )
        
        if not result["success"]:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=f"Erreur IA Planning: {result.get('error', 'Erreur inconnue')}"
            )
        
        suggestions = result["suggestions"]
        
        response = PlanningResponse(
            recommended_slots=[
                SlotSuggestion(**slot) for slot in suggestions.get("recommended_slots", [])
            ],
            workload_assessment=suggestions.get("workload_assessment", "normal"),
            optimization_tips=suggestions.get("optimization_tips", []),
            ideal_breaks=suggestions.get("ideal_breaks", []),
            efficiency_score=suggestions.get("efficiency_score", 70),
            estimated_duration=result.get("estimated_duration", 20)
        )
        
        logger.info(f"Suggestions générées: {len(response.recommended_slots)} créneaux")
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur suggestions planning: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la génération des suggestions: {str(e)}"
        )

@planning_router.get("/workload-analysis/{medecin_id}/{date}", response_model=WorkloadAnalysis)
async def analyze_daily_workload(medecin_id: str, date: str):
    """
    Analyse la charge de travail pour une date donnée
    """
    try:
        print(f"📊 Analyse de charge pour médecin {medecin_id} le {date}")
        
        # Validation de la date
        try:
            datetime.strptime(date, "%Y-%m-%d")
        except ValueError:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Format de date invalide"
            )
        
        # Récupérer les RDV existants
        rendezvous_collection = db["rendezvous"]
        existing_rdv = list(rendezvous_collection.find({
            "medecin_id": medecin_id,
            "date_rendez_vous": date,
            "statut": {"$ne": "annule"}
        }).sort("heure", 1))
        
        # Calculer les statistiques
        total_appointments = len(existing_rdv)
        occupied_hours = [rdv["heure"] for rdv in existing_rdv]
        
        # Générer tous les créneaux possibles (8h-18h45, par 15min)
        all_possible_slots = []
        for hour in range(8, 19):
            for minute in [0, 15, 30, 45]:
                if hour == 18 and minute > 45:
                    break
                all_possible_slots.append(f"{hour:02d}:{minute:02d}")
        
        available_slots = len([slot for slot in all_possible_slots if slot not in occupied_hours])
        
        # Déterminer le niveau de charge
        occupancy_rate = total_appointments / len(all_possible_slots)
        if occupancy_rate < 0.3:
            workload_level = "leger"
        elif occupancy_rate < 0.6:
            workload_level = "normal"
        elif occupancy_rate < 0.8:
            workload_level = "charge"
        else:
            workload_level = "surcharge"
        
        # Générer des recommandations
        recommendations = []
        if workload_level == "leger":
            recommendations.append("Journée légère - Possibilité d'ajouter des RDV")
            recommendations.append("Idéal pour les consultations longues ou complexes")
        elif workload_level == "normal":
            recommendations.append("Charge équilibrée")
            recommendations.append("Maintenir les pauses pour optimiser la qualité")
        elif workload_level == "charge":
            recommendations.append("Journée bien remplie")
            recommendations.append("Éviter les nouveaux RDV non urgents")
            recommendations.append("Prévoir des pauses courtes entre consultations")
        else:
            recommendations.append("Surcharge détectée")
            recommendations.append("Envisager de reporter certains RDV")
            recommendations.append("Prévoir du temps supplémentaire")
        
        return WorkloadAnalysis(
            date=date,
            total_appointments=total_appointments,
            occupied_hours=occupied_hours,
            available_slots=available_slots,
            workload_level=workload_level,
            recommendations=recommendations
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Erreur analyse charge: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de l'analyse: {str(e)}"
        )

@planning_router.get("/optimization-report/{medecin_id}")
async def get_weekly_optimization_report(medecin_id: str):
    """
    Génère un rapport d'optimisation hebdomadaire
    """
    try:
        print(f"📈 Génération rapport d'optimisation pour médecin {medecin_id}")
        
        # Analyser la semaine actuelle (lundi à vendredi)
        today = datetime.now()
        monday = today - timedelta(days=today.weekday())
        
        weekly_analysis = []
        for i in range(5):  # Lundi à vendredi
            day = monday + timedelta(days=i)
            date_str = day.strftime("%Y-%m-%d")
            
            # Analyser chaque jour
            rendezvous_collection = db["rendezvous"]
            daily_rdv = list(rendezvous_collection.find({
                "medecin_id": medecin_id,
                "date_rendez_vous": date_str,
                "statut": {"$ne": "annule"}
            }))
            
            daily_analysis = {
                "date": date_str,
                "day_name": day.strftime("%A"),
                "appointments_count": len(daily_rdv),
                "first_appointment": daily_rdv[0]["heure"] if daily_rdv else None,
                "last_appointment": daily_rdv[-1]["heure"] if daily_rdv else None,
                "gaps": []
            }
            
            # Analyser les gaps
            if len(daily_rdv) > 1:
                times = sorted([rdv["heure"] for rdv in daily_rdv])
                for j in range(1, len(times)):
                    try:
                        t1 = datetime.strptime(times[j-1], "%H:%M")
                        t2 = datetime.strptime(times[j], "%H:%M")
                        gap_minutes = (t2 - t1).seconds // 60
                        if gap_minutes > 30:  # Gaps > 30 min
                            daily_analysis["gaps"].append({
                                "start": times[j-1],
                                "end": times[j],
                                "duration": gap_minutes
                            })
                    except:
                        continue
            
            weekly_analysis.append(daily_analysis)
        
        # Générer des recommandations globales
        total_appointments = sum(day["appointments_count"] for day in weekly_analysis)
        avg_daily_load = total_appointments / 5 if total_appointments > 0 else 0
        
        global_recommendations = []
        if avg_daily_load < 5:
            global_recommendations.append("Charge hebdomadaire légère - Possibilité d'optimiser")
        elif avg_daily_load > 15:
            global_recommendations.append("Charge hebdomadaire élevée - Attention au surmenage")
        
        # Identifier les jours déséquilibrés
        loads = [day["appointments_count"] for day in weekly_analysis]
        if max(loads) - min(loads) > 8:
            global_recommendations.append("Répartition déséquilibrée - Rééquilibrer la charge")
        
        return {
            "week_start": monday.strftime("%Y-%m-%d"),
            "total_appointments": total_appointments,
            "average_daily_load": round(avg_daily_load, 1),
            "daily_analysis": weekly_analysis,
            "global_recommendations": global_recommendations,
            "efficiency_tips": [
                "Regrouper les consultations similaires",
                "Optimiser les pauses déjeuner",
                "Prévoir du temps pour les urgences"
            ]
        }
        
    except Exception as e:
        logger.error(f"Erreur génération rapport: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la génération du rapport: {str(e)}"
        )

@planning_router.post("/validate-planning")
async def validate_planning_decision(
    medecin_id: str,
    date: str,
    selected_slot: str,
    ai_suggestion_id: str = None
):
    """
    Valide une décision de planification pour l'apprentissage IA
    """
    try:
        # Enregistrer la validation pour améliorer l'IA
        validation_data = {
            "medecin_id": medecin_id,
            "date": date,
            "selected_slot": selected_slot,
            "ai_suggestion_id": ai_suggestion_id,
            "validated_at": datetime.utcnow(),
            "type": "planning_validation"
        }
        
        # Sauvegarder dans une collection de feedback
        feedback_collection = db["ai_feedback"]
        feedback_collection.insert_one(validation_data)
        
        logger.info(f"Validation planification enregistrée: {validation_data}")
        
        return {
            "message": "Validation enregistrée avec succès",
            "feedback_id": str(validation_data.get("_id")),
            "learning_impact": "Les futures suggestions seront améliorées"
        }
        
    except Exception as e:
        logger.error(f"Erreur validation planning: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Erreur lors de la validation: {str(e)}"
        )