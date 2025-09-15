import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Save, FileText, User, Search, Brain } from "lucide-react";
import { consultationsApi, patientsApi } from "../services/api";
import { Consultation, ConsultationFormData, Patient } from "../types";
import { useAuth } from "../contexts/AuthContext";
import AIDiagnosticModal from "../components/AIDiagnosticModal";

const AddConsultation: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // ID du patient (si venant des détails patient)
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  // ✅ Récupérer le paramètre patient de l'URL ET de l'état de navigation
  const urlParams = new URLSearchParams(location.search);
  const patientFromUrl = urlParams.get("patient");
  const patientFromState = location.state?.patientId; // ← NOUVEAU: Récupérer depuis l'état

  // États
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [patientSearch, setPatientSearch] = useState<string>("");
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [selectedPatientInfo, setSelectedPatientInfo] = useState<Patient | null>(null);

  // 🤖 NOUVEAUX ÉTATS POUR L'IA
  const [isAIModalOpen, setIsAIModalOpen] = useState(false);

  // Vérifier toutes les sources possibles de patient
  const isFromPatientDetails = !!id;
  const hasPatientParam = !!(patientFromUrl || patientFromState);
  const finalPatientId = id || patientFromUrl || patientFromState;

  console.log("🔍 DEBUG CONSULTATION PARAMS:", {
    id,
    patientFromUrl,
    patientFromState,
    finalPatientId,
    isFromPatientDetails,
    hasPatientParam,
    currentUrl: location.pathname + location.search,
    locationState: location.state,
  });

  const [formData, setFormData] = useState({
    date_consultation: new Date().toISOString().split("T")[0],
    motif: "",
    diagnostic: "",
    symptomes: "",
    traitement: "",
    notes: "",
  });

  // Filtrer les patients selon la recherche
  useEffect(() => {
    if (!patientSearch.trim()) {
      setFilteredPatients(patients);
    } else {
      const filtered = patients.filter((patient) => {
        const fullName = `${patient.prenom} ${patient.nom}`.toLowerCase();
        const cin = patient.cin?.toLowerCase() || "";
        const search = patientSearch.toLowerCase();

        return fullName.includes(search) || cin.includes(search);
      });
      setFilteredPatients(filtered);
    }
  }, [patients, patientSearch]);

  // Charger les patients et définir le patient sélectionné
  useEffect(() => {
    const initializeData = async () => {
      // Charger les patients
      const loadedPatients = await loadPatients();

      // Définir le patient sélectionné selon le contexte
      if (finalPatientId) {
        console.log("🎯 Patient ID détecté:", finalPatientId);
        setSelectedPatient(finalPatientId);

        // Trouver les infos du patient dans la liste chargée
        if (loadedPatients.length > 0) {
          const patientInfo = loadedPatients.find(
            (p) => p.id === finalPatientId,
          );
          if (patientInfo) {
            setSelectedPatientInfo(patientInfo);
            console.log("✅ Patient pré-sélectionné:", patientInfo);
          } else {
            console.log("⚠️ Patient non trouvé dans la liste:", finalPatientId);
          }
        }
      }
    };

    initializeData();
  }, [finalPatientId]);

  // Récupérer les infos du patient sélectionné quand la sélection change
  useEffect(() => {
    if (selectedPatient && patients.length > 0) {
      console.log("🔍 Recherche patient dans liste:", {
        selectedPatient,
        totalPatients: patients.length,
      });

      const patientInfo = patients.find((p) => p.id === selectedPatient);
      setSelectedPatientInfo(patientInfo || null);

      if (patientInfo) {
        console.log("✅ Patient sélectionné trouvé:", patientInfo);
      } else {
        console.log("❌ Patient sélectionné NON trouvé dans la liste");
      }
    }
  }, [selectedPatient, patients]);

  const loadPatients = async () => {
    try {
      console.log("🔄 Chargement des patients...");
      const response = await patientsApi.getAll(1, 200); // Augmenter la limite
      setPatients(response.items);
      setFilteredPatients(response.items);
      console.log("✅ Patients chargés:", response.items.length);
      return response.items; // Retourner les patients pour usage immédiat
    } catch (error) {
      console.error("❌ Erreur lors du chargement des patients:", error);
      setError("Impossible de charger la liste des patients");
      return [];
    }
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePatientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const patientId = e.target.value;
    setSelectedPatient(patientId);
    setPatientSearch(""); // Reset search when selecting
  };

  const handlePatientSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPatientSearch(e.target.value);
  };

  const handlePatientSelect = (patientId: string) => {
    setSelectedPatient(patientId);
    setPatientSearch("");
  };

  // 🤖 NOUVELLE FONCTION: Gérer la sélection de diagnostic IA
  const handleAIDiagnosticSelect = (diagnostic: string) => {
    setFormData((prev) => ({
      ...prev,
      diagnostic: diagnostic,
    }));
    setIsAIModalOpen(false);
  };

  // 🤖 NOUVELLE FONCTION: Ouvrir le modal IA
  const handleOpenAIAssistant = () => {
    if (!formData.motif.trim() || !formData.symptomes.trim()) {
      setError("Veuillez renseigner le motif et les symptômes avant d'utiliser l'assistant IA");
      return;
    }
    setError(null);
    setIsAIModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validation du patient
    if (!selectedPatient) {
      setError("Veuillez sélectionner un patient");
      return;
    }

    // Récupérer l'ID du médecin connecté (priorité à _id pour MongoDB)
    const medecinId = (user as any)?._id || user?.id;

    if (!medecinId) {
      console.error("❌ Aucun médecin connecté trouvé");
      setError("Erreur: Aucun médecin connecté");
      return;
    }

    console.log("👨‍⚕️ DEBUG CREATION CONSULTATION:");
    console.log("- User connecté:", user);
    console.log("- ID du médecin utilisé:", medecinId);
    console.log("- Patient sélectionné:", selectedPatient);
    console.log("- Patient info:", selectedPatientInfo);

    try {
      setLoading(true);
      setError(null);

      const consultationData: ConsultationFormData = {
        patient_id: selectedPatient,
        medecin_id: medecinId,
        date_consultation: formData.date_consultation,
        motif: formData.motif,
        symptomes: formData.symptomes,
        diagnostic: formData.diagnostic || undefined,
        traitement: formData.traitement || undefined,
        notes: formData.notes || undefined,
        medecin: undefined,
        patient: undefined,
      };

      console.log("📤 Données à envoyer:", consultationData);

      await consultationsApi.create(consultationData);

      // Redirection selon le contexte
      if (isFromPatientDetails && id) {
        navigate(`/patients/id/${id}`);
      } else if (hasPatientParam) {
        navigate("/rendez-vous"); // Retour vers RDV si vient d'un RDV
      } else {
        navigate("/consultations");
      }
    } catch (error) {
      console.error("❌ Erreur lors de la création de la consultation:", error);
      setError("Erreur lors de l'enregistrement de la consultation");
    } finally {
      setLoading(false);
    }
  };

  const isFormValid =
    formData.date_consultation &&
    formData.motif &&
    formData.symptomes &&
    formData.diagnostic &&
    selectedPatient;

  // Déterminer le contexte pour les boutons de retour
  const getReturnPath = () => {
    if (isFromPatientDetails && id) return `/patients/id/${id}`;
    if (hasPatientParam) return "/rendez-vous";
    return "/consultations";
  };

  const getReturnLabel = () => {
    if (isFromPatientDetails) return "Retour aux détails du patient";
    if (hasPatientParam) return "Retour aux rendez-vous";
    return "Retour aux consultations";
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(getReturnPath())}
            className="flex items-center text-gray-600 hover:text-gray-800 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            {getReturnLabel()}
          </button>
          <div className="flex items-center">
            <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
              <FileText className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Ajouter une consultation
              </h1>
              {selectedPatientInfo && (
                <p className="text-gray-600 mt-1">
                  Patient: {selectedPatientInfo.prenom}{" "}
                  {selectedPatientInfo.nom} ({selectedPatientInfo.cin})
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
            {error}
          </div>
        )}

        {/* Form Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Sélection du patient */}
            {!finalPatientId ? (
              <div className="space-y-4">
                <label className="block text-sm font-medium text-gray-700">
                  Patient *
                </label>

                {/* Barre de recherche de patient */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Rechercher par nom ou CIN..."
                    value={patientSearch}
                    onChange={handlePatientSearch}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Liste des patients filtrés */}
                {patientSearch && (
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                    {filteredPatients.length > 0 ? (
                      filteredPatients.map((patient) => (
                        <button
                          key={patient.id}
                          type="button"
                          onClick={() => handlePatientSelect(patient.id)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                        >
                          <div className="font-medium text-gray-900">
                            {patient.prenom} {patient.nom}
                          </div>
                          <div className="text-sm text-gray-500">
                            CIN: {patient.cin}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-gray-500 text-center">
                        Aucun patient trouvé
                      </div>
                    )}
                  </div>
                )}

                {/* Sélection par dropdown si pas de recherche */}
                {!patientSearch && (
                  <select
                    value={selectedPatient}
                    onChange={handlePatientChange}
                    required
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                  >
                    <option value="">Sélectionner un patient</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.prenom} {patient.nom} - {patient.cin}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              /* Patient pré-sélectionné */
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="flex items-center">
                  <User className="w-5 h-5 text-blue-600 mr-2" />
                  <div>
                    <span className="text-sm font-medium text-blue-800">
                      Patient sélectionné:
                    </span>
                    {selectedPatientInfo ? (
                      <div className="text-blue-700">
                        {selectedPatientInfo.prenom} {selectedPatientInfo.nom} (
                        {selectedPatientInfo.cin})
                      </div>
                    ) : (
                      <div className="text-blue-700">
                        Chargement des informations...
                      </div>
                    )}
                  </div>
                </div>
                {/* Option pour changer de patient */}
                <button
                  type="button"
                  onClick={() => {
                    setSelectedPatient("");
                    setSelectedPatientInfo(null);
                  }}
                  className="mt-2 text-sm text-blue-600 hover:text-blue-800 underline"
                >
                  Changer de patient
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Date */}
              <div>
                <label
                  htmlFor="date_consultation"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Date de consultation *
                </label>
                <input
                  type="date"
                  id="date_consultation"
                  name="date_consultation"
                  value={formData.date_consultation}
                  onChange={handleInputChange}
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
              </div>

              {/* Motif */}
              <div>
                <label
                  htmlFor="motif"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Motif de consultation *
                </label>
                <input
                  type="text"
                  id="motif"
                  name="motif"
                  value={formData.motif}
                  onChange={handleInputChange}
                  placeholder="Décrivez le motif de la consultation"
                  required
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
                />
              </div>

              {/* Symptômes */}
              <div>
                <label
                  htmlFor="symptomes"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Symptômes *
                </label>
                <textarea
                  id="symptomes"
                  name="symptomes"
                  value={formData.symptomes}
                  onChange={handleInputChange}
                  placeholder="Décrivez les symptômes observés"
                  required
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-vertical"
                />
              </div>

              {/* 🤖 DIAGNOSTIC AVEC ASSISTANT IA */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="diagnostic"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Diagnostic *
                  </label>
                  {/* 🤖 BOUTON ASSISTANT IA - POSITION OPTIMALE */}
                  <button
                    type="button"
                    onClick={handleOpenAIAssistant}
                    disabled={!formData.motif.trim() || !formData.symptomes.trim()}
                    className="inline-flex items-center px-3 py-1.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white text-sm rounded-lg hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                    title={
                      !formData.motif.trim() || !formData.symptomes.trim()
                        ? "Renseignez d'abord le motif et les symptômes"
                        : "Obtenir des suggestions de diagnostic IA"
                    }
                  >
                    <Brain className="w-4 h-4 mr-1.5" />
                    Assistant IA
                  </button>
                </div>
                <textarea
                  id="diagnostic"
                  name="diagnostic"
                  value={formData.diagnostic}
                  onChange={handleInputChange}
                  placeholder="Saisissez le diagnostic ou utilisez l'assistant IA pour obtenir des suggestions"
                  required
                  rows={4}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-vertical"
                />
                {/* 🤖 INDICATEUR IA */}
                {formData.diagnostic.includes("Probabilité:") && (
                  <div className="mt-2 flex items-center text-sm text-purple-600">
                    <Brain className="w-4 h-4 mr-1" />
                    <span>Diagnostic suggéré par l'IA - Validez et adaptez selon votre expertise</span>
                  </div>
                )}
              </div>

              {/* Traitements */}
              <div>
                <label
                  htmlFor="traitement"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Traitements prescrits
                </label>
                <textarea
                  id="traitement"
                  name="traitement"
                  value={formData.traitement}
                  onChange={handleInputChange}
                  placeholder="Listez les traitements prescrits"
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-vertical"
                />
              </div>

              {/* Notes */}
              <div>
                <label
                  htmlFor="notes"
                  className="block text-sm font-medium text-gray-700 mb-2"
                >
                  Notes complémentaires
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  value={formData.notes}
                  onChange={handleInputChange}
                  placeholder="Ajoutez des notes supplémentaires si nécessaire"
                  rows={3}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors resize-vertical"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <button
                type="submit"
                disabled={!isFormValid || loading}
                className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                ) : (
                  <Save className="w-5 h-5 mr-2" />
                )}
                {loading ? "Enregistrement..." : "Enregistrer la consultation"}
              </button>

              <button
                type="button"
                onClick={() => navigate(getReturnPath())}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>

        {/* Required fields notice */}
        <div className="mt-4 text-sm text-gray-500">* Champs obligatoires</div>

        {/* Info box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0">
              ℹ️
            </div>
            <div>
              <h4 className="text-sm font-medium text-blue-800 mb-2">
                Informations sur la consultation
              </h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>
                  • Tous les champs marqués d'un astérisque (*) sont
                  obligatoires
                </li>
                <li>
                  • La date peut être antérieure à aujourd'hui pour saisir des
                  consultations passées
                </li>
                <li>
                  • Les traitements et notes sont optionnels mais recommandés
                </li>
                <li>
                  • L'assistant IA peut vous aider à générer des suggestions de diagnostic basées sur les symptômes
                </li>
                {finalPatientId && (
                  <li>
                    • Le patient a été automatiquement sélectionné selon le
                    contexte
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* 🤖 MODAL ASSISTANT IA */}
      <AIDiagnosticModal
        isOpen={isAIModalOpen}
        onClose={() => setIsAIModalOpen(false)}
        patientInfo={selectedPatientInfo}
        motif={formData.motif}
        symptomes={formData.symptomes}
        onSelectDiagnostic={handleAIDiagnosticSelect}
      />
    </div>
  );
};

export default AddConsultation;