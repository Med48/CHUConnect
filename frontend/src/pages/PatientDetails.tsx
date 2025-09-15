import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  Calendar,
  User,
  FileText,
  Clock,
  Plus,
  ArrowLeft,
  Camera,
  Edit,
  Eye,
  Trash2,
} from "lucide-react";
import { Patient, Consultation, RendezVous } from "../types";
import { patientsApi, userService } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import AuthenticatedImage from "../components/AuthenticatedImage";
import PatientSummaryModal from "../components/PatientSummaryModal";

const PatientDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [appointments, setAppointments] = useState<RendezVous[]>([]);
  const [medecins, setMedecins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState<{
    type: "consultation" | "appointment";
    id: string;
  } | null>(null);
  const [targetMedecinId, setTargetMedecinId] = useState<string | null>(null);
  const [showSummaryModal, setShowSummaryModal] = useState(false);

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  // Fonction pour récupérer l'ID du médecin cible (connecté ou associé)
  const getTargetMedecinId = async (): Promise<string | null> => {
    const userId = (user as any)?._id || user?.id;
    const userRole = user?.role;

    console.log("🎯 Détermination du médecin cible:", { userId, userRole });

    // Si c'est un médecin, retourner son ID
    if (userRole === "medecin") {
      console.log("👨‍⚕️ Utilisateur est médecin, ID:", userId);
      return userId;
    }

    // Si c'est une secrétaire, trouver son médecin associé
    if (userRole === "secretaire") {
      try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const userData = await response.json();
        const medecinId =
          userData.medecin_id || userData.medecin?.id || userData.medecin?._id;

        console.log("👩‍💼 Secrétaire - médecin associé ID:", medecinId);

        if (!medecinId) {
          console.error("❌ Aucun médecin associé trouvé pour la secrétaire");
          return null;
        }

        return medecinId;
      } catch (error) {
        console.error(
          "❌ Erreur lors de la récupération du médecin associé:",
          error,
        );
        return null;
      }
    }

    console.log("⚠️ Rôle utilisateur non reconnu:", userRole);
    return null;
  };

  // ✅ DEBUG - Vérifier l'ID récupéré depuis l'URL
  useEffect(() => {
    console.log("🔍 ID patient depuis URL:", id);
    console.log("🔍 URL actuelle:", window.location.pathname);
  }, [id]);

  useEffect(() => {
    const fetchPatientData = async () => {
      if (!id) {
        console.error("❌ ID patient manquant dans l'URL");
        setError("ID patient manquant dans l'URL");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError(null);

        // Récupérer l'ID du médecin cible
        const medecinId = await getTargetMedecinId();
        if (!medecinId) {
          setError("Impossible de déterminer le médecin associé");
          return;
        }

        setTargetMedecinId(medecinId);

        console.log("🩺 Médecin cible ID:", medecinId);
        console.log("📋 Chargement patient ID:", id);

        console.log("1️⃣ Chargement des données du patient...");
        let patientData;
        try {
          patientData = await patientsApi.getById(id);
          console.log("✅ Patient chargé avec succès:", patientData);

          console.log("📸 Debug photo du patient:");
          console.log("📸 - photo_url:", patientData.photo_url);
          console.log("📸 - photo_file_id:", patientData.photo_file_id);
          console.log(
            "📸 - photo_data:",
            patientData.photo_data ? "PRÉSENT" : "ABSENT",
          );
        } catch (patientError: any) {
          console.error(
            "❌ Erreur lors du chargement du patient:",
            patientError,
          );
          throw new Error(
            `Erreur patient: ${patientError.message} (Status: ${patientError.response?.status})`,
          );
        }

        console.log("2️⃣ Chargement des consultations...");
        let consultationsData;
        try {
          consultationsData = await patientsApi.getPatientConsultations(id);
          console.log("✅ Consultations chargées:", consultationsData);
        } catch (consultError: any) {
          console.warn(
            "⚠️ Erreur consultations (non bloquante):",
            consultError.message,
          );
          consultationsData = [];
        }

        console.log("3️⃣ Chargement des rendez-vous...");
        let appointmentsData;
        try {
          appointmentsData = await patientsApi.getPatientAppointments(id);
          console.log("✅ RDV chargés:", appointmentsData);
        } catch (appointmentError: any) {
          console.warn(
            "⚠️ Erreur RDV (non bloquante):",
            appointmentError.message,
          );
          appointmentsData = [];
        }

        setMedecins([]);

        // Filtrer les consultations du médecin cible
        const consultationsFiltrees = consultationsData.filter(
          (consultation: any) => {
            if (
              !consultation.medecin_id ||
              consultation.medecin_id === "default_medecin_id"
            ) {
              return false;
            }
            const belongs = consultation.medecin_id === medecinId;

            if (belongs) {
              console.log(
                `✅ Consultation ${consultation.id} appartient au médecin cible`,
              );
            }

            return belongs;
          },
        );

        // Filtrer les rendez-vous du médecin cible
        const rdvFiltres = appointmentsData.filter((rdv: any) => {
          const belongs = rdv.medecin_id === medecinId;

          if (belongs) {
            console.log(`✅ RDV ${rdv.id} appartient au médecin cible`);
          }

          return belongs;
        });

        // Enrichir avec le nom du médecin
        const consultationsAvecMedecins = consultationsFiltrees.map(
          (consultation: any) => ({
            ...consultation,
            medecin_nom:
              user?.role === "medecin"
                ? user?.nom || "Vous"
                : "Médecin associé",
          }),
        );

        const rdvAvecMedecins = rdvFiltres.map((rdv: any) => ({
          ...rdv,
          medecin_nom:
            user?.role === "medecin" ? user?.nom || "Vous" : "Médecin associé",
        }));

        console.log(
          `✅ Consultations filtrées: ${consultationsAvecMedecins.length} sur ${consultationsData.length}`,
        );
        console.log(
          `✅ RDV filtrés: ${rdvAvecMedecins.length} sur ${appointmentsData.length}`,
        );

        setPatient(patientData);
        setConsultations(consultationsAvecMedecins);
        setAppointments(rdvAvecMedecins);

        console.log("🎉 Toutes les données chargées avec succès !");
      } catch (err: any) {
        console.error("❌ Erreur chargement patient:", err);

        let errorMessage =
          err.message || "Erreur lors du chargement des données du patient";
        if (err.response?.status === 403) {
          errorMessage =
            "Accès refusé : vous n'avez pas les autorisations pour voir ce patient";
        } else if (err.response?.status === 404) {
          errorMessage = "Patient non trouvé";
        } else if (err.response?.status === 401) {
          errorMessage = "Session expirée, veuillez vous reconnecter";
        }

        setError(errorMessage);
      } finally {
        setLoading(false);
      }
    };

    fetchPatientData();
  }, [id, user]);

  // Fonctions pour les actions (seulement pour médecins)
  const handleViewConsultation = (consultationId: string) => {
    navigate(`/consultations/${consultationId}`);
  };

  const handleEditConsultation = (consultationId: string) => {
    navigate(`/consultations/${consultationId}/modifier`);
  };

  const handleViewAppointment = (appointmentId: string) => {
    navigate(`/rendez-vous/${appointmentId}`);
  };

  const handleEditAppointment = (appointmentId: string) => {
    navigate(`/rendez-vous/${appointmentId}/modifier`);
  };

  const handleDeleteConsultation = async (consultationId: string) => {
    try {
      // Appel API pour supprimer la consultation
      // await patientsApi.deleteConsultation(consultationId);
      setConsultations((prev) => prev.filter((c) => c.id !== consultationId));
      setShowDeleteModal(null);
      // Afficher un message de succès
    } catch (error) {
      console.error("Erreur lors de la suppression de la consultation:", error);
      // Afficher un message d'erreur
    }
  };

  const handleDeleteAppointment = async (appointmentId: string) => {
    try {
      // Appel API pour supprimer le rendez-vous
      // await patientsApi.deleteAppointment(appointmentId);
      setAppointments((prev) => prev.filter((a) => a.id !== appointmentId));
      setShowDeleteModal(null);
      // Afficher un message de succès
    } catch (error) {
      console.error("Erreur lors de la suppression du rendez-vous:", error);
      // Afficher un message d'erreur
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Vérifier si l'utilisateur peut effectuer des actions (seulement médecins)
  const canPerformActions = user?.role === "medecin";

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des données du patient...</p>
        </div>
      </div>
    );
  }

  if (error || !patient) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || "Patient non trouvé"}</p>

          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-4 max-w-md">
            <h3 className="text-sm font-medium text-yellow-800 mb-2">
              Informations de debug :
            </h3>
            <ul className="text-xs text-yellow-700 space-y-1 text-left">
              <li>ID depuis URL : {id || "undefined"}</li>
              <li>URL actuelle : {window.location.pathname}</li>
              <li>Erreur : {error}</li>
            </ul>
          </div>

          <button
            onClick={() => navigate(-1)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retour
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-600 hover:text-gray-800 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Retour
          </button>
          <h1 className="text-3xl font-bold text-gray-900">
            Détails du Patient
          </h1>
          <p className="text-gray-600 mt-2">
            {user?.role === "medecin"
              ? `Consultations et rendez-vous avec Dr. ${user?.nom}`
              : "Informations patient et rendez-vous du médecin associé"}
          </p>
        </div>

        {/* Patient Info Card avec Photo */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col lg:flex-row items-start mb-6">
            {/* SECTION PHOTO */}
            <div className="flex-shrink-0 mb-6 lg:mb-0 lg:mr-8">
              <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50 relative">
                {patient.photo_url ? (
                  <>
                    <AuthenticatedImage
                      src={patient.photo_url}
                      alt={`Photo de ${patient.nom} ${patient.prenom}`}
                      className="w-28 h-28 object-cover rounded-lg"
                      fallback={
                        <div className="text-center">
                          <Camera className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                          <p className="text-xs text-gray-500">
                            Photo indisponible
                          </p>
                        </div>
                      }
                    />
                    <div className="absolute bottom-0 right-0 bg-blue-600 text-white rounded-full p-1">
                      <Camera className="w-3 h-3" />
                    </div>
                  </>
                ) : (
                  <div className="text-center">
                    <Camera className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-xs text-gray-500">Aucune photo</p>
                  </div>
                )}
              </div>
            </div>

            {/* INFO PATIENT */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                    <User className="w-6 h-6 text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-semibold text-gray-900">
                      {patient.nom} {patient.prenom}
                    </h2>
                    <p className="text-gray-600">CIN N° {patient.cin}</p>
                  </div>
                </div>

                {/* Bouton modifier */}
                <button
                  onClick={() => navigate(`/patients/id/${id}/modifier`)}
                  className="flex items-center px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  <Edit className="w-4 h-4 mr-2" />
                  Modifier
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Date de naissance
                  </label>
                  <p className="text-gray-900">
                    {formatDate(patient.date_naissance)}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Sexe
                  </label>
                  <p className="text-gray-900">
                    {patient.genre === "M" ? "Masculin" : "Féminin"}
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Téléphone
                  </label>
                  <p className="text-gray-900">
                    {patient.telephone || "Non renseigné"}
                  </p>
                </div>
              </div>

              {(patient.email || patient.adresse) && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 pt-4 border-t border-gray-200">
                  {patient.email && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Email
                      </label>
                      <p className="text-gray-900">{patient.email}</p>
                    </div>
                  )}
                  {patient.adresse && (
                    <div>
                      <label className="block text-sm font-medium text-gray-500 mb-1">
                        Adresse
                      </label>
                      <p className="text-gray-900 whitespace-pre-line">
                        {patient.adresse}
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {canPerformActions && (
            <>
              <button
                onClick={() => navigate(`/patients/id/${id}/consultation`)}
                className="flex items-center justify-center px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors shadow-sm"
              >
                <Plus className="w-5 h-5 mr-2" />
                Nouvelle consultation
              </button>
              
              <button
                onClick={() => setShowSummaryModal(true)}
                disabled={consultations.length === 0}
                className="flex items-center justify-center px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                title={consultations.length === 0 ? "Aucune consultation disponible pour générer un résumé" : "Générer un résumé intelligent avec l'IA"}
              >
                <FileText className="w-5 h-5 mr-2" />
                Résumé IA
              </button>
            </>
          )}
          
          <button
            onClick={() => navigate(`/rendez-vous/nouveau?patient=${id}`)}
            className="flex items-center justify-center px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors shadow-sm"
          >
            <Plus className="w-5 h-5 mr-2" />
            Nouveau RDV
          </button>
          
          <button
            onClick={() => navigate(`/patients/id/${id}/modifier`)}
            className="flex items-center justify-center px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors shadow-sm"
          >
            <Edit className="w-5 h-5 mr-2" />
            Modifier patient
          </button>
        </div>

        {/* Consultations Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 mb-8">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <FileText className="w-6 h-6 text-blue-600 mr-3" />
                <h3 className="text-xl font-semibold text-gray-900">
                  {user?.role === "medecin"
                    ? "Mes Consultations"
                    : "Consultations"}{" "}
                  ({consultations.length})
                </h3>
              </div>
              {user?.role === "secretaire" && consultations.length > 0 && (
                <div className="text-sm text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                  Aperçu uniquement
                </div>
              )}
            </div>
          </div>

          {consultations.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <FileText className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-400 mb-2">
                Aucune consultation
              </h4>
              <p className="text-sm">
                {user?.role === "medecin"
                  ? "Aucune consultation enregistrée avec ce patient"
                  : "Aucune consultation du médecin associé avec ce patient"}
              </p>
              {user?.role === "medecin" && (
                <p className="text-sm">
                  Créez une nouvelle consultation pour commencer.
                </p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Diagnostic
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Médecin
                    </th>
                    {/* Actions seulement pour les médecins */}
                    {canPerformActions && (
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {consultations.map((consultation, index) => (
                    <tr
                      key={consultation.id || `consultation-${index}`}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatDate(consultation.date_consultation)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="max-w-xs">
                          <p
                            className="truncate"
                            title={consultation.diagnostic}
                          >
                            {consultation.diagnostic}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        Dr. {(consultation as any).medecin_nom}
                      </td>
                      {/* Actions seulement pour les médecins */}
                      {canPerformActions && (
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={() =>
                                handleViewConsultation(consultation.id)
                              }
                              className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-blue-50 transition-colors"
                              title="Voir les détails"
                            >
                              <Eye className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() =>
                                handleEditConsultation(consultation.id)
                              }
                              className="text-green-600 hover:text-green-900 p-1 rounded-full hover:bg-green-50 transition-colors"
                              title="Modifier la consultation"
                            >
                              <Edit className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() =>
                                setShowDeleteModal({
                                  type: "consultation",
                                  id: consultation.id,
                                })
                              }
                              className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50 transition-colors"
                              title="Supprimer la consultation"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Rendez-vous Section */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <Clock className="w-6 h-6 text-green-600 mr-3" />
                <h3 className="text-xl font-semibold text-gray-900">
                  {user?.role === "medecin" ? "Mes Rendez-vous" : "Rendez-vous"}{" "}
                  ({appointments.length})
                </h3>
              </div>
            </div>
          </div>

          {appointments.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Clock className="w-16 h-16 text-gray-300 mx-auto mb-4" />
              <h4 className="text-lg font-medium text-gray-400 mb-2">
                Aucun rendez-vous
              </h4>
              <p className="text-sm">
                {user?.role === "medecin"
                  ? "Aucun rendez-vous planifié avec ce patient"
                  : "Aucun rendez-vous du médecin associé avec ce patient"}
              </p>
              {user?.role === "medecin" && (
                <p className="text-sm">Planifiez un nouveau rendez-vous.</p>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Heure
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Motif
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Médecin
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Statut
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {appointments.map((appointment, index) => (
                    <tr
                      key={appointment.id || `appointment-${index}`}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {formatDate(appointment.date_rendez_vous)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {appointment.heure}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <div className="max-w-xs">
                          <p className="truncate" title={appointment.motif}>
                            {appointment.motif}
                          </p>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        Dr. {(appointment as any).medecin_nom}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span
                          className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                            appointment.statut === "confirme" ||
                            appointment.statut === "confirmé"
                              ? "bg-green-100 text-green-800"
                              : appointment.statut === "programme" ||
                                  appointment.statut === "en_attente"
                                ? "bg-yellow-100 text-yellow-800"
                                : appointment.statut === "annule" ||
                                    appointment.statut === "annulé"
                                  ? "bg-red-100 text-red-800"
                                  : appointment.statut === "termine"
                                    ? "bg-blue-100 text-blue-800"
                                    : "bg-gray-100 text-gray-800"
                          }`}
                        >
                          {(appointment.statut === "confirme" ||
                            appointment.statut === "confirmé") &&
                            "Confirmé"}
                          {(appointment.statut === "programme" ||
                            appointment.statut === "en_attente") &&
                            "Programmé"}
                          {(appointment.statut === "annule" ||
                            appointment.statut === "annulé") &&
                            "Annulé"}
                          {appointment.statut === "termine" && "Terminé"}
                          {!appointment.statut && "Non défini"}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() =>
                              handleViewAppointment(appointment.id)
                            }
                            className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-blue-50 transition-colors"
                            title="Voir les détails"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              handleEditAppointment(appointment.id)
                            }
                            className="text-green-600 hover:text-green-900 p-1 rounded-full hover:bg-green-50 transition-colors"
                            title="Modifier le rendez-vous"
                          >
                            <Edit className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() =>
                              setShowDeleteModal({
                                type: "appointment",
                                id: appointment.id,
                              })
                            }
                            className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50 transition-colors"
                            title="Supprimer le rendez-vous"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal de confirmation de suppression - Seulement pour les médecins */}
      {showDeleteModal && canPerformActions && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg max-w-md w-full">
            <div className="p-6">
              <div className="flex items-center mb-4">
                <div className="mx-auto flex-shrink-0 flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
              </div>

              <div className="text-center">
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  Confirmer la suppression
                </h3>
                <p className="text-sm text-gray-500 mb-6">
                  Êtes-vous sûr de vouloir supprimer cette{" "}
                  {showDeleteModal.type === "consultation"
                    ? "consultation"
                    : "rendez-vous"}{" "}
                  ? Cette action est irréversible.
                </p>

                <div className="flex space-x-3 justify-center">
                  <button
                    onClick={() => setShowDeleteModal(null)}
                    className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => {
                      if (showDeleteModal.type === "consultation") {
                        handleDeleteConsultation(showDeleteModal.id);
                      } else {
                        handleDeleteAppointment(showDeleteModal.id);
                      }
                    }}
                    className="px-4 py-2 bg-red-600 border border-transparent rounded-md text-sm font-medium text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
                  >
                    Supprimer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal Résumé IA */}
      <PatientSummaryModal
        isOpen={showSummaryModal}
        onClose={() => setShowSummaryModal(false)}
        patientId={id!}
        patientName={`${patient.nom} ${patient.prenom}`}
      />
    </div>
  );
};

export default PatientDetails;