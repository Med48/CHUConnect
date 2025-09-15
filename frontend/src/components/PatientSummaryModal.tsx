import React, { useState } from "react";
import { X, FileText, Download, Printer, Clock, User } from "lucide-react";

interface PatientSummaryModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: string;
  patientName: string;
}

interface SummaryData {
  success: boolean;
  patient_id: string;
  patient_nom: string;
  generated_at: string;
  resume_content: string;
  statistics: {
    nb_consultations: number;
    nb_rendez_vous: number;
    periode_suivi: {
      premiere_consultation: string | null;
      derniere_consultation: string | null;
    };
  };
  medecin_nom: string;
}

const PatientSummaryModal: React.FC<PatientSummaryModalProps> = ({
  isOpen,
  onClose,
  patientId,
  patientName
}) => {
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  const generateSummary = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const token = localStorage.getItem("access_token");
      console.log("Debug token:", token ? "PRÉSENT" : "ABSENT");
      
      if (!token) {
        throw new Error("Session expirée, veuillez vous reconnecter");
      }

      const response = await fetch(
        `${API_BASE_URL}/api/ai/patient-summary/${patientId}`,
        {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      console.log("Réponse API:", response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        
        if (response.status === 401) {
          localStorage.removeItem("access_token");
          throw new Error("Session expirée, veuillez vous reconnecter");
        }
        
        throw new Error(
          errorData.detail || `Erreur ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json();
      console.log("Résumé généré avec succès");
      setSummaryData(data);
    } catch (err: any) {
      console.error("Erreur génération résumé:", err);
      setError(err.message || "Erreur lors de la génération du résumé");
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = () => {
    if (summaryData) {
      const printWindow = window.open("", "_blank");
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Résumé Patient - ${summaryData.patient_nom}</title>
              <style>
                body { font-family: Arial, sans-serif; margin: 20px; }
                h1, h2, h3 { color: #2563eb; }
                .header { border-bottom: 2px solid #2563eb; margin-bottom: 20px; padding-bottom: 10px; }
                .stats { background: #f3f4f6; padding: 15px; border-radius: 8px; margin: 20px 0; }
                .content { line-height: 1.6; }
              </style>
            </head>
            <body>
              <div class="header">
                <h1>Résumé Patient - ${summaryData.patient_nom}</h1>
                <p>Généré le ${new Date(summaryData.generated_at).toLocaleDateString('fr-FR')} par ${summaryData.medecin_nom}</p>
              </div>
              <div class="stats">
                <p><strong>Consultations:</strong> ${summaryData.statistics.nb_consultations} | <strong>Rendez-vous:</strong> ${summaryData.statistics.nb_rendez_vous}</p>
                <p><strong>Période de suivi:</strong> ${summaryData.statistics.periode_suivi.premiere_consultation} - ${summaryData.statistics.periode_suivi.derniere_consultation}</p>
              </div>
              <div class="content">
                ${summaryData.resume_content.replace(/\n/g, '<br>').replace(/## /g, '<h2>').replace(/<h2>/g, '</p><h2>').replace(/<\/h2>/g, '</h2><p>').replace(/- /g, '<br>• ')}
              </div>
            </body>
          </html>
        `);
        printWindow.document.close();
        printWindow.print();
      }
    }
  };

  const formatMarkdown = (text: string) => {
    return text
      .replace(/## (.*$)/gm, '<h2 class="text-xl font-semibold text-blue-600 mt-6 mb-3">$1</h2>')
      .replace(/### (.*$)/gm, '<h3 class="text-lg font-medium text-gray-800 mt-4 mb-2">$1</h3>')
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/- (.*$)/gm, '<div class="ml-4 mb-1">• $1</div>')
      .replace(/\n\n/g, '</p><p class="mb-3">')
      .replace(/\n/g, '<br>');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 flex items-center justify-between bg-gradient-to-r from-blue-50 to-purple-50 flex-shrink-0">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center mr-3">
              <FileText className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-xl font-semibold text-gray-900">
                Résumé Intelligent IA
              </h3>
              <p className="text-sm text-gray-600">{patientName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content - Zone scrollable */}
        <div className="flex-1 overflow-y-auto min-h-0">
          <div className="p-6">
            {!summaryData && !isLoading && !error && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-gradient-to-r from-blue-100 to-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileText className="w-8 h-8 text-blue-600" />
                </div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">
                  Générer un résumé intelligent
                </h4>
                <p className="text-gray-600 mb-6">
                  L'IA analysera l'historique médical complet du patient pour créer un résumé structuré et des recommandations cliniques.
                </p>
                <button
                  onClick={generateSummary}
                  className="px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all duration-200 shadow-sm"
                >
                  Générer le résumé IA
                </button>
              </div>
            )}

            {isLoading && (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <h4 className="text-lg font-medium text-gray-900 mb-2">
                  Génération en cours...
                </h4>
                <p className="text-gray-600">
                  L'IA analyse l'historique médical du patient
                </p>
              </div>
            )}

            {error && (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <X className="w-8 h-8 text-red-600" />
                </div>
                <h4 className="text-lg font-medium text-red-900 mb-2">
                  Erreur de génération
                </h4>
                <p className="text-red-600 mb-6">{error}</p>
                <button
                  onClick={generateSummary}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Réessayer
                </button>
              </div>
            )}

            {summaryData && (
              <div className="space-y-6">
                {/* Statistics */}
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
                    <div>
                      <div className="text-2xl font-bold text-blue-600">
                        {summaryData.statistics.nb_consultations}
                      </div>
                      <div className="text-sm text-gray-600">Consultations</div>
                    </div>
                    <div>
                      <div className="text-2xl font-bold text-purple-600">
                        {summaryData.statistics.nb_rendez_vous}
                      </div>
                      <div className="text-sm text-gray-600">Rendez-vous</div>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-gray-700">
                        Suivi depuis
                      </div>
                      <div className="text-sm text-gray-600">
                        {summaryData.statistics.periode_suivi.premiere_consultation}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Generated info */}
                <div className="flex items-center text-sm text-gray-500 pb-4 border-b border-gray-200">
                  <Clock className="w-4 h-4 mr-2" />
                  Généré le{" "}
                  {new Date(summaryData.generated_at).toLocaleDateString("fr-FR")}{" "}
                  à{" "}
                  {new Date(summaryData.generated_at).toLocaleTimeString("fr-FR")}
                  <User className="w-4 h-4 ml-4 mr-2" />
                  par {summaryData.medecin_nom}
                </div>

                {/* Summary content */}
                <div className="prose prose-sm max-w-none">
                  <div
                    className="space-y-4 text-gray-700 leading-relaxed"
                    dangerouslySetInnerHTML={{
                      __html: formatMarkdown(summaryData.resume_content),
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer - Fixe */}
        {summaryData && (
          <div className="p-6 border-t border-gray-200 bg-gray-50 flex justify-end space-x-3 flex-shrink-0">
            <button
              onClick={handlePrint}
              className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              <Printer className="w-4 h-4 mr-2" />
              Imprimer
            </button>
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Fermer
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientSummaryModal;