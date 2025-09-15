import React, { useState } from "react";
import { X, Calendar, Clock, Brain, TrendingUp, AlertCircle, CheckCircle, Zap } from "lucide-react";

interface SlotSuggestion {
  time: string;
  score: number;
  reason: string;
}

interface PlanningResponse {
  recommended_slots: SlotSuggestion[];
  workload_assessment: string;
  optimization_tips: string[];
  ideal_breaks: string[];
  efficiency_score: number;
  estimated_duration: number;
}

interface AIPlanningModalProps {
  isOpen: boolean;
  onClose: () => void;
  medecinId: string;
  dateRendezVous: string;
  motif: string;
  onSelectSlot: (slot: string) => void;
  existingSlots: string[];
}

const AIPlanningModal: React.FC<AIPlanningModalProps> = ({
  isOpen,
  onClose,
  medecinId,
  dateRendezVous,
  motif,
  onSelectSlot,
  existingSlots,
}) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<PlanningResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateSuggestions = async () => {
    if (!dateRendezVous || !motif.trim()) {
      setError("Veuillez renseigner la date et le motif avant d'utiliser l'assistant IA");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/planning/suggest-slots`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          medecin_id: medecinId,
          date_rendez_vous: dateRendezVous,
          motif: motif,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Erreur lors de la génération des suggestions");
      }

      const data = await response.json();
      setSuggestions(data);
    } catch (err: any) {
      console.error("❌ Erreur Planning IA:", err);
      setError(err.message || "Erreur lors de l'analyse IA de planification");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSlot = (slot: SlotSuggestion) => {
    onSelectSlot(slot.time);
    
    // Enregistrer la validation pour l'apprentissage IA (optionnel)
    fetch(`${import.meta.env.VITE_API_URL}/api/planning/validate-planning`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        medecin_id: medecinId,
        date: dateRendezVous,
        selected_slot: slot.time,
      }),
    }).catch(console.error);
    
    onClose();
  };

  const getWorkloadColor = (assessment: string) => {
    switch (assessment?.toLowerCase()) {
      case "leger":
        return "text-green-600 bg-green-50 border-green-200";
      case "normal":
        return "text-blue-600 bg-blue-50 border-blue-200";
      case "charge":
        return "text-orange-600 bg-orange-50 border-orange-200";
      case "surcharge":
        return "text-red-600 bg-red-50 border-red-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return "text-green-600 bg-green-100 border-green-300";
    if (score >= 70) return "text-blue-600 bg-blue-100 border-blue-300";
    if (score >= 50) return "text-orange-600 bg-orange-100 border-orange-300";
    return "text-red-600 bg-red-100 border-red-300";
  };

  const formatWorkloadText = (assessment: string) => {
    switch (assessment?.toLowerCase()) {
      case "leger": return "Journée légère";
      case "normal": return "Charge normale";
      case "charge": return "Journée chargée";
      case "surcharge": return "Surcharge détectée";
      default: return "Évaluation en cours";
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center mr-3">
              <Calendar className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Planification Intelligente</h2>
              <p className="text-sm text-gray-600">Optimisation IA des créneaux de rendez-vous</p>
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
          {/* Résumé de la planification */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-3 flex items-center">
              <Brain className="w-5 h-5 mr-2" />
              Analyse de la planification :
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Date :</span>
                <p className="text-gray-600 mt-1">{dateRendezVous || "Non sélectionnée"}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Motif :</span>
                <p className="text-gray-600 mt-1">{motif || "Non renseigné"}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Créneaux occupés :</span>
                <p className="text-gray-600 mt-1">{existingSlots.length} / 44 créneaux</p>
              </div>
            </div>
          </div>

          {/* Bouton de génération */}
          {!suggestions && !loading && (
            <div className="text-center">
              <button
                onClick={generateSuggestions}
                disabled={!dateRendezVous || !motif.trim()}
                className="inline-flex items-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <Calendar className="w-5 h-5 mr-2" />
                Analyser la planification
              </button>
              <p className="text-sm text-gray-500 mt-2">
                L'IA analysera votre planning pour suggérer les créneaux optimaux
              </p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-8">
              <div className="inline-flex items-center">
                <div className="w-6 h-6 border-2 border-purple-600 border-t-transparent rounded-full animate-spin mr-3"></div>
                <span className="text-gray-600">Analyse de la planification en cours...</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
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
              {/* Tableau de bord de la planification */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Charge de travail */}
                <div className={`rounded-lg p-4 border ${getWorkloadColor(suggestions.workload_assessment)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <TrendingUp className="w-5 h-5" />
                    <span className="text-xs font-medium">CHARGE</span>
                  </div>
                  <div className="font-semibold">{formatWorkloadText(suggestions.workload_assessment)}</div>
                </div>

                {/* Score d'efficacité */}
                <div className={`rounded-lg p-4 border ${getScoreColor(suggestions.efficiency_score)}`}>
                  <div className="flex items-center justify-between mb-2">
                    <Zap className="w-5 h-5" />
                    <span className="text-xs font-medium">EFFICACITÉ</span>
                  </div>
                  <div className="font-semibold">{suggestions.efficiency_score}%</div>
                </div>

                {/* Durée estimée */}
                <div className="rounded-lg p-4 border border-blue-200 bg-blue-50 text-blue-600">
                  <div className="flex items-center justify-between mb-2">
                    <Clock className="w-5 h-5" />
                    <span className="text-xs font-medium">DURÉE</span>
                  </div>
                  <div className="font-semibold">{suggestions.estimated_duration} min</div>
                </div>
              </div>

              {/* Créneaux recommandés */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Clock className="w-5 h-5 mr-2" />
                  Créneaux optimaux recommandés
                </h3>
                
                <div className="grid gap-3">
                  {suggestions.recommended_slots.map((slot, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer group"
                      onClick={() => handleSelectSlot(slot)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center mr-4">
                            <Clock className="w-6 h-6 text-purple-600" />
                          </div>
                          <div>
                            <div className="font-semibold text-lg text-gray-900">{slot.time}</div>
                            <p className="text-gray-600 text-sm">{slot.reason}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center space-x-3">
                          <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getScoreColor(slot.score)}`}>
                            {slot.score}%
                          </div>
                          <button className="opacity-0 group-hover:opacity-100 flex items-center text-purple-600 hover:text-purple-700 text-sm font-medium transition-opacity">
                            <CheckCircle className="w-4 h-4 mr-1" />
                            Sélectionner
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {suggestions.recommended_slots.length === 0 && (
                  <div className="text-center py-6 text-gray-500">
                    <Calendar className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p>Aucun créneau optimal disponible</p>
                    <p className="text-sm">Essayez une autre date ou consultez les conseils d'optimisation</p>
                  </div>
                )}
              </div>

              {/* Pauses idéales */}
              {suggestions.ideal_breaks.length > 0 && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2 flex items-center">
                    <Clock className="w-4 h-4 mr-2" />
                    Pauses recommandées
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.ideal_breaks.map((break_time, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-blue-100 text-blue-700 text-sm rounded-full"
                      >
                        {break_time}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Conseils d'optimisation */}
              {suggestions.optimization_tips.length > 0 && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h4 className="font-medium text-green-900 mb-3 flex items-center">
                    <TrendingUp className="w-4 h-4 mr-2" />
                    Conseils d'optimisation
                  </h4>
                  <ul className="space-y-2">
                    {suggestions.optimization_tips.map((tip, index) => (
                      <li key={index} className="flex items-start text-green-800 text-sm">
                        <CheckCircle className="w-4 h-4 mr-2 mt-0.5 text-green-600 flex-shrink-0" />
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Disclaimer */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-yellow-800 mb-1">Avertissement</h4>
                    <p className="text-yellow-700 text-sm">
                      Ces suggestions sont générées par IA pour optimiser votre planning. 
                      Adaptez selon vos contraintes spécifiques et les besoins des patients.
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

export default AIPlanningModal;