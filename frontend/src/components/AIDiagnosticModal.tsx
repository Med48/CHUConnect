import React, { useState } from "react";
import { X, Brain, CheckCircle, AlertCircle, Clock, Stethoscope } from "lucide-react";

interface DiagnosticSuggestion {
  nom: string;
  probabilite: number;
  explication: string;
  examens_recommandes: string[];
}

interface DiagnosticResponse {
  diagnostics: DiagnosticSuggestion[];
  recommandations_generales: string;
  niveau_urgence: string;
}

interface AIDiagnosticModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientInfo: any;
  motif: string;
  symptomes: string;
  onSelectDiagnostic: (diagnostic: string) => void;
}

const AIDiagnosticModal: React.FC<AIDiagnosticModalProps> = ({
  isOpen,
  onClose,
  patientInfo,
  motif,
  symptomes,
  onSelectDiagnostic,
}) => {
  const [loading, setLoading] = useState(false);
  const [suggestions, setSuggestions] = useState<DiagnosticResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generateSuggestions = async () => {
    if (!motif.trim() || !symptomes.trim()) {
      setError("Veuillez renseigner le motif et les symptômes avant d'utiliser l'assistant IA");
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/diagnostic`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          patient_info: {
            date_naissance: patientInfo?.date_naissance,
            sexe: patientInfo?.sexe,
          },
          motif,
          symptomes,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Erreur lors de la génération des suggestions");
      }

      const data = await response.json();
      setSuggestions(data);
    } catch (err: any) {
      console.error("❌ Erreur IA:", err);
      setError(err.message || "Erreur lors de l'analyse IA");
    } finally {
      setLoading(false);
    }
  };

  const handleSelectDiagnostic = (diagnostic: DiagnosticSuggestion) => {
    const formattedDiagnostic = `${diagnostic.nom}

Probabilité: ${diagnostic.probabilite}%
${diagnostic.explication}

Examens recommandés: ${diagnostic.examens_recommandes.join(", ")}`;

    onSelectDiagnostic(formattedDiagnostic);
    onClose();
  };

  const getUrgencyColor = (niveau: string) => {
    switch (niveau?.toLowerCase()) {
      case "élevé":
      case "eleve":
        return "text-red-600 bg-red-50 border-red-200";
      case "modéré":
      case "modere":
        return "text-orange-600 bg-orange-50 border-orange-200";
      case "faible":
        return "text-green-600 bg-green-50 border-green-200";
      default:
        return "text-gray-600 bg-gray-50 border-gray-200";
    }
  };

  const getProbabilityColor = (probabilite: number) => {
    if (probabilite >= 80) return "text-red-600 bg-red-50";
    if (probabilite >= 60) return "text-orange-600 bg-orange-50";
    if (probabilite >= 40) return "text-yellow-600 bg-yellow-50";
    return "text-gray-600 bg-gray-50";
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-purple-50">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-3">
              <Brain className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">Assistant IA de Diagnostic</h2>
              <p className="text-sm text-gray-600">Suggestions basées sur l'intelligence artificielle</p>
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
          {/* Résumé des données */}
          <div className="bg-gray-50 rounded-lg p-4 mb-6">
            <h3 className="font-medium text-gray-900 mb-3">Données analysées :</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-700">Motif :</span>
                <p className="text-gray-600 mt-1">{motif || "Non renseigné"}</p>
              </div>
              <div>
                <span className="font-medium text-gray-700">Patient :</span>
                <p className="text-gray-600 mt-1">
                  {patientInfo ? `${patientInfo.prenom} ${patientInfo.nom}` : "Information manquante"}
                </p>
              </div>
            </div>
            <div className="mt-3">
              <span className="font-medium text-gray-700">Symptômes :</span>
              <p className="text-gray-600 mt-1">{symptomes || "Non renseignés"}</p>
            </div>
          </div>

          {/* Bouton de génération */}
          {!suggestions && !loading && (
            <div className="text-center">
              <button
                onClick={generateSuggestions}
                disabled={!motif.trim() || !symptomes.trim()}
                className="inline-flex items-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                <Brain className="w-5 h-5 mr-2" />
                Analyser avec l'IA
              </button>
              <p className="text-sm text-gray-500 mt-2">
                L'IA analysera les symptômes pour proposer des diagnostics différentiels
              </p>
            </div>
          )}

          {/* Loading */}
          {loading && (
            <div className="text-center py-8">
              <div className="inline-flex items-center">
                <div className="w-6 h-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-3"></div>
                <span className="text-gray-600">Analyse en cours avec l'IA...</span>
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
              {/* Niveau d'urgence */}
              <div className={`rounded-lg p-4 border ${getUrgencyColor(suggestions.niveau_urgence)}`}>
                <div className="flex items-center mb-2">
                  <Clock className="w-5 h-5 mr-2" />
                  <span className="font-medium">Niveau d'urgence : {suggestions.niveau_urgence}</span>
                </div>
              </div>

              {/* Diagnostics suggérés */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                  <Stethoscope className="w-5 h-5 mr-2" />
                  Diagnostics différentiels suggérés
                </h3>
                
                <div className="space-y-4">
                  {suggestions.diagnostics.map((diagnostic, index) => (
                    <div
                      key={index}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => handleSelectDiagnostic(diagnostic)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <h4 className="font-medium text-gray-900">{diagnostic.nom}</h4>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getProbabilityColor(diagnostic.probabilite)}`}>
                          {diagnostic.probabilite}%
                        </span>
                      </div>
                      
                      <p className="text-gray-600 text-sm mb-3">{diagnostic.explication}</p>
                      
                      {diagnostic.examens_recommandes.length > 0 && (
                        <div>
                          <span className="text-sm font-medium text-gray-700">Examens recommandés :</span>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {diagnostic.examens_recommandes.map((examen, idx) => (
                              <span
                                key={idx}
                                className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full"
                              >
                                {examen}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      <div className="flex items-center justify-end mt-3 pt-3 border-t border-gray-100">
                        <button className="flex items-center text-blue-600 hover:text-blue-700 text-sm font-medium">
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Sélectionner ce diagnostic
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommandations générales */}
              {suggestions.recommandations_generales && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h4 className="font-medium text-blue-900 mb-2">Recommandations générales</h4>
                  <p className="text-blue-800 text-sm">{suggestions.recommandations_generales}</p>
                </div>
              )}

              {/* Disclaimer */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <div className="flex items-start">
                  <AlertCircle className="w-5 h-5 text-yellow-600 mr-2 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-yellow-800 mb-1">Avertissement médical</h4>
                    <p className="text-yellow-700 text-sm">
                      Ces suggestions sont générées par IA et ne remplacent en aucun cas le jugement médical professionnel. 
                      Toujours valider et adapter selon votre expertise clinique et l'examen du patient.
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

export default AIDiagnosticModal;