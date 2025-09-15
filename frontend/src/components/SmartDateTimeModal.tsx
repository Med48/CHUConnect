import React, { useState } from "react";
import { X, Calendar, Clock, Brain, Zap, AlertTriangle, CheckCircle, Star, Target } from "lucide-react";

interface DateTimeSlotSuggestion {
  date: string;
  time: string;
  score: number;
  category: string;
  reasoning: string;
  workload_impact: string;
  day_context: string;
}

interface SmartDateTimeResponse {
  suggested_slots: DateTimeSlotSuggestion[];
  global_recommendations: string[];
  urgency_advice: string;
  optimal_strategy: string;
  motif_analysis: {
    urgency_level: string;
    consultation_type: string;
    optimal_time: string;
    recommended_duration: number;
    recommended_delay: string;
    reasoning: string;
  };
  next_available: {
    date: string;
    time: string;
    day_name: string;
  };
}

interface SmartDateTimeModalProps {
  isOpen: boolean;
  onClose: () => void;
  medecinId: string;
  motif: string;
  onSelectDateTime: (date: string, time: string) => void;
  patientInfo?: any;
}

const SmartDateTimeModal: React.FC<SmartDateTimeModalProps> = ({
  isOpen,
  onClose,
  medecinId,
  motif,
  onSelectDateTime,
  patientInfo,
}) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<SmartDateTimeResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateSmartSuggestions = async () => {
    if (!motif.trim()) {
      setError("Veuillez renseigner le motif avant d'utiliser l'assistant IA");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/planning/suggest-smart-datetime`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          medecin_id: medecinId,
          motif: motif,
          patient_info: patientInfo,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Erreur lors de la génération des suggestions");
      }

      const data = await response.json();
      setSuggestions(data);
    } catch (err: any) {
      console.error("❌ Erreur Smart DateTime:", err);
      setError(err.message || "Erreur lors de l'analyse IA de planification");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDateTime = (slot: DateTimeSlotSuggestion) => {
    onSelectDateTime(slot.date, slot.time);
    
    // Enregistrer la validation pour l'apprentissage IA
    fetch(`${import.meta.env.VITE_API_URL}/api/planning/validate-planning`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        medecin_id: medecinId,
        date: slot.date,
        selected_slot: slot.time,
      }),
    }).catch(console.error);
    
    onClose();
  };

  const getUrgencyColor = (level: string) => {
    switch (level?.toLowerCase()) {
      case "urgent":
        return "text-red-600 bg-red-50 border-red-200";
      case "modere":
        return "text-orange-600 bg-orange-50 border-orange-200";
      case "routine":
        return "text-green-600 bg-green-50 border-green-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case "optimal":
        return <Star className="w-4 h-4 text-yellow-500" />;
      case "recommande":
        return <Target className="w-4 h-4 text-blue-500" />;
      case "urgence":
        return <Zap className="w-4 h-4 text-red-500" />;
      default:
        return <CheckCircle className="w-4 h-4 text-green-500" />;
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category?.toLowerCase()) {
      case "optimal":
        return "bg-gradient-to-r from-yellow-50 to-orange-50 border-yellow-200";
      case "recommande":
        return "bg-gradient-to-r from-blue-50 to-indigo-50 border-blue-200";
      case "urgence":
        return "bg-gradient-to-r from-red-50 to-pink-50 border-red-200";
      default:
        return "bg-gray-50 border-gray-200";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600 bg-green-100 border-green-300";
    if (score >= 75) return "text-blue-600 bg-blue-100 border-blue-300";
    if (score >= 60) return "text-orange-600 bg-orange-100 border-orange-300";
    return "text-red-600 bg-red-100 border-red-300";
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('fr-FR', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  const formatUrgencyText = (level: string) => {
    switch (level?.toLowerCase()) {
      case "urgent": return "Urgence";
      case "modere": return "Modéré";
      case "routine": return "Routine";
      default: return "Normal";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
              <Brain className="w-6 h-6 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Planification Intelligente</h2>
              <p className="text-sm text-gray-600">Suggestion automatique de date et heure optimales</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {/* Analyse du motif */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-3 flex items-center">
              <Target className="w-5 h-5 mr-2" />
              Analyse du motif de consultation :
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Motif :</span>
                <p className="text-gray-600 mt-1 italic">"{motif}"</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Patient :</span>
                <p className="text-gray-600 mt-1">
                  {patientInfo ? `${patientInfo.prenom} ${patientInfo.nom}` : "Information générale"}
                </p>
              </div>
            </div>
          </div>

          {/* Bouton de génération */}
          {!suggestions && !loading && (
            <div className="text-center">
              <button
                onClick={generateSmartSuggestions}
                disabled={!motif.trim()}
                className="inline-flex items-center px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <Brain className="w-5 h-5 mr-2" />
                Analyser et suggérer date + heure
              </button>
              <p className="text-sm text-gray-500 mt-2">
                L'IA analysera le motif pour suggérer les meilleurs créneaux disponibles
              </p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-8">
              <div className="inline-flex items-center">
                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin mr-3"></div>
                <span className="text-gray-600">Analyse intelligente en cours...</span>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                Analyse du motif • Évaluation de l'urgence • Recherche des créneaux optimaux
              </p>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <AlertTriangle className="w-5 h-5 text-red-600 mr-2" />
                <span className="text-red-700 font-medium">Erreur</span>
              </div>
              <p className="text-red-600 mt-1">{error}</p>
              <button
                onClick={() => setError(null)}
                className="mt-3 px-4 py-2 bg-red-100 text-red-700 rounded-lg hover:bg-red-200 transition-colors"
              >
                Réessayer
              </button>
            </div>
          )}

          {/* Suggestions */}
          {suggestions && (
            <div className="space-y-6">
              {/* Analyse du motif détaillée */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className={`rounded-lg p-4 border ${getUrgencyColor(suggestions.motif_analysis.urgency_level)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <AlertTriangle className="w-5 h-5" />
                    <span className="text-xs font-medium">URGENCE</span>
                  </div>
                  <div className="font-semibold">{formatUrgencyText(suggestions.motif_analysis.urgency_level)}</div>
                </div>

                <div className="rounded-lg p-4 border border-blue-200 bg-blue-50 text-blue-600">
                  <div className="flex items-center justify-between mb-2">
                    <Clock className="w-5 h-5" />
                    <span className="text-xs font-medium">DURÉE</span>
                  </div>
                  <div className="font-semibold">{suggestions.motif_analysis.recommended_duration} min</div>
                </div>

                <div className="rounded-lg p-4 border border-purple-200 bg-purple-50 text-purple-600">
                  <div className="flex items-center justify-between mb-2">
                    <Calendar className="w-5 h-5" />
                    <span className="text-xs font-medium">DÉLAI</span>
                  </div>
                  <div className="font-semibold text-xs">{suggestions.motif_analysis.recommended_delay}</div>
                </div>

                <div className="rounded-lg p-4 border border-green-200 bg-green-50 text-green-600">
                  <div className="flex items-center justify-between mb-2">
                    <Target className="w-5 h-5" />
                    <span className="text-xs font-medium">TYPE</span>
                  </div>
                  <div className="font-semibold text-xs">{suggestions.motif_analysis.consultation_type}</div>
                </div>
              </div>

              {/* Stratégie recommandée */}
              {suggestions.urgency_advice && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h4 className="font-medium text-amber-900 mb-2 flex items-center">
                    <Zap className="w-4 h-4 mr-2" />
                    Conseil d'urgence
                  </h4>
                  <p className="text-amber-800 text-sm">{suggestions.urgency_advice}</p>
                </div>
              )}

              {/* Créneaux suggérés */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Calendar className="w-5 h-5 mr-2" />
                  Créneaux optimaux recommandés ({suggestions.suggested_slots.length})
                </h3>
                
                <div className="grid gap-4">
                  {suggestions.suggested_slots.map((slot, index) => (
                    <div
                      key={index}
                      className={`border rounded-lg p-4 transition-all hover:shadow-md cursor-pointer group ${getCategoryColor(slot.category)}`}
                      onClick={() => handleSelectDateTime(slot)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-12 h-12 bg-white rounded-lg flex items-center justify-center mr-4 shadow-sm">
                            {getCategoryIcon(slot.category)}
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center space-x-3 mb-1">
                              <h4 className="font-semibold text-lg text-gray-900">
                                {formatDate(slot.date)}
                              </h4>
                              <span className="text-2xl font-bold text-indigo-600">
                                {slot.time}
                              </span>
                            </div>
                            <p className="text-gray-600 text-sm mb-2">{slot.reasoning}</p>
                            <div className="flex items-center space-x-4 text-xs text-gray-500">
                              <span>• Impact: {slot.workload_impact}</span>
                              <span>• {slot.day_context}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getScoreColor(slot.score)}`}>
                            {slot.score}%
                          </div>
                          <button className="opacity-0 group-hover:opacity-100 flex items-center text-indigo-600 hover:text-indigo-700 text-sm font-medium transition-opacity">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Sélectionner
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {suggestions.suggested_slots.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    <Calendar className="w-16 h-16 mx-auto mb-4 text-gray-300" />
                    <h3 className="text-lg font-medium mb-2">Aucun créneau optimal trouvé</h3>
                    <p className="text-sm">L'agenda semble complet. Consultez le prochain créneau disponible ci-dessous.</p>
                  </div>
                )}
              </div>

              {/* Prochain créneau disponible */}
              {suggestions.next_available.date && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2 flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    Prochain créneau disponible
                  </h4>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-blue-800 font-medium">
                        {suggestions.next_available.day_name} {formatDate(suggestions.next_available.date)} à {suggestions.next_available.time}
                      </p>
                    </div>
                    <button
                      onClick={() => handleSelectDateTime({
                        date: suggestions.next_available.date,
                        time: suggestions.next_available.time,
                        score: 0,
                        category: "",
                        reasoning: "",
                        workload_impact: "",
                        day_context: ""
                      })}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
                    >
                      Sélectionner
                    </button>
                  </div>
                </div>
              )}

              {/* Stratégie optimale */}
              {suggestions.optimal_strategy && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-2 flex items-center">
                    <Target className="w-4 h-4 mr-2" />
                    Stratégie de planification recommandée
                  </h4>
                  <p className="text-green-800 text-sm">{suggestions.optimal_strategy}</p>
                </div>
              )}

              {/* Recommandations globales */}
              {suggestions.global_recommendations.length > 0 && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <h4 className="font-medium text-purple-900 mb-3 flex items-center">
                    <Brain className="w-4 h-4 mr-2" />
                    Recommandations intelligentes
                  </h4>
                  <ul className="space-y-2">
                    {suggestions.global_recommendations.map((rec, index) => (
                      <li key={index} className="flex items-start text-purple-800 text-sm">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-purple-600 flex-shrink-0" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Disclaimer */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-yellow-800 mb-1">Assistant IA de planification</h4>
                    <p className="text-yellow-700 text-sm">
                      Ces suggestions sont générées par IA en analysant le motif de consultation. 
                      Adaptez selon vos contraintes spécifiques et l'urgence réelle du patient.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 bg-gray-50 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default SmartDateTimeModal;