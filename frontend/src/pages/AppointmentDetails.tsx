import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  Clock,
  User,
  Stethoscope,
  FileText,
  Save,
} from "lucide-react";
import { RendezVous, Patient, User as UserType } from "../types";
import { rendezVousApi, patientsApi, userService } from "../services/api";

const AppointmentDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState<RendezVous | null>(null);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [medecin, setMedecin] = useState<UserType | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [selectedStatus, setSelectedStatus] =
    useState<RendezVous["statut"]>("programme");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchAppointmentDetails();
  }, [id]);

  const fetchAppointmentDetails = async () => {
    if (!id) return;

    try {
      setLoading(true);
      console.log("🔍 Fetching RDV details for ID:", id);

      // ✅ Pour MongoDB, l'ID peut être une string, pas besoin de parseInt
      // Essayer d'abord avec l'ID tel quel (string pour MongoDB)
      let appointmentData;
      try {
        // Si c'est un ID MongoDB (string), utiliser tel quel
        appointmentData = await rendezVousApi.getById(id as any);
      } catch (firstError) {
        console.log(
          "Première tentative échouée, essai avec parseInt:",
          firstError,
        );
        // Si ça échoue, essayer avec parseInt (pour les ID numériques)
        appointmentData = await rendezVousApi.getById(parseInt(id));
      }

      console.log("✅ RDV chargé:", appointmentData);
      setAppointment(appointmentData);
      setSelectedStatus(appointmentData.statut);

      // ✅ NOUVEAU: Charger les données patient et médecin si elles ne sont pas populées
      await loadRelatedData(appointmentData);
    } catch (err: any) {
      console.error("❌ Erreur complète:", err);
      setError(
        `Erreur lors du chargement des détails du rendez-vous: ${err.message || "Inconnu"}`,
      );
    } finally {
      setLoading(false);
    }
  };

  const loadRelatedData = async (appointmentData: RendezVous) => {
    try {
      // Charger les données patient si pas populées
      if (
        appointmentData.patient_id &&
        (!appointmentData.patient || !appointmentData.patient.nom)
      ) {
        console.log(
          "🔄 Chargement données patient:",
          appointmentData.patient_id,
        );
        try {
          const patientData = await patientsApi.getById(
            appointmentData.patient_id,
          );
          console.log("✅ Patient chargé:", patientData);
          setPatient(patientData);
        } catch (patientError) {
          console.warn("⚠️ Erreur chargement patient:", patientError);
        }
      } else {
        setPatient(appointmentData.patient || null);
      }

      // Charger les données médecin si pas populées
      if (
        appointmentData.medecin_id &&
        (!appointmentData.medecin || !appointmentData.medecin.nom)
      ) {
        console.log(
          "🔄 Chargement données médecin:",
          appointmentData.medecin_id,
        );
        try {
          const medecins = await userService.getAll();
          const medecinData = medecins.find(
            (m) =>
              m._id === appointmentData.medecin_id ||
              m.id === appointmentData.medecin_id,
          );
          console.log("✅ Médecin trouvé:", medecinData);
          setMedecin(medecinData || null);
        } catch (medecinError) {
          console.warn("⚠️ Erreur chargement médecin:", medecinError);
        }
      } else {
        setMedecin(appointmentData.medecin || null);
      }
    } catch (err) {
      console.warn("⚠️ Erreur chargement données liées:", err);
    }
  };

  const handleStatusChange = async () => {
    if (!appointment || selectedStatus === appointment.statut) return;

    try {
      setUpdating(true);
      console.log("🔄 Mise à jour statut:", {
        appointmentId: appointment.id || appointment._id,
        newStatus: selectedStatus,
      });

      // ✅ Gérer l'ID MongoDB ou numérique
      const appointmentId = appointment._id || appointment.id;
      let updateResult;

      try {
        // Essayer d'abord avec l'ID tel quel (string pour MongoDB)
        updateResult = await rendezVousApi.update(appointmentId as any, {
          statut: selectedStatus,
        });
      } catch (firstError) {
        console.log(
          "Première tentative échouée, essai avec parseInt:",
          firstError,
        );
        // Si ça échoue, essayer avec parseInt (pour les ID numériques)
        updateResult = await rendezVousApi.update(parseInt(appointmentId), {
          statut: selectedStatus,
        });
      }

      // Mettre à jour l'état local
      setAppointment((prev) =>
        prev ? { ...prev, statut: selectedStatus } : null,
      );

      // Message de succès
      alert("Statut mis à jour avec succès");
    } catch (err: any) {
      console.error("❌ Erreur mise à jour:", err);
      setError(
        `Erreur lors de la mise à jour du statut: ${err.message || "Inconnu"}`,
      );
    } finally {
      setUpdating(false);
    }
  };

  const getStatusColor = (status: RendezVous["statut"]) => {
    switch (status) {
      case "programme":
        return "bg-blue-100 text-blue-800 border-blue-200";
      case "confirme":
        return "bg-green-100 text-green-800 border-green-200";
      case "termine":
        return "bg-gray-100 text-gray-800 border-gray-200";
      case "annule":
        return "bg-red-100 text-red-800 border-red-200";
      default:
        return "bg-gray-100 text-gray-800 border-gray-200";
    }
  };

  const getStatusText = (status: RendezVous["statut"]) => {
    switch (status) {
      case "programme":
        return "Programmé";
      case "termine":
        return "Terminé";
      case "annule":
        return "Annulé";
      default:
        return status;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("fr-FR", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des détails...</p>
        </div>
      </div>
    );
  }

  if (error || !appointment) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">
            {error || "Rendez-vous non trouvé"}
          </p>
          <button
            onClick={() => navigate("/rendez-vous")}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
          >
            Retour aux rendez-vous
          </button>
        </div>
      </div>
    );
  }

  const hasStatusChanged = selectedStatus !== appointment.statut;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-600 hover:text-gray-800 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Retour
          </button>
          <div className="flex items-center">
            <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mr-4">
              <Calendar className="w-6 h-6 text-indigo-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
              Détails du Rendez-vous
            </h1>
          </div>
        </div>

        {/* Main Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Header with current status */}
          <div className="bg-gradient-to-r from-indigo-600 to-indigo-700 text-white p-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold mb-2">
                  Rendez-vous #{appointment._id || appointment.id}
                </h2>
                <p className="text-indigo-100">
                  {formatDate(appointment.date_rendez_vous)} à{" "}
                  {appointment.heure}
                </p>
              </div>
              <div
                className={`px-4 py-2 rounded-full border ${getStatusColor(appointment.statut)}`}
              >
                <span className="font-medium">
                  {getStatusText(appointment.statut)}
                </span>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Patient Information */}
              <div className="space-y-6">
                <div className="flex items-center mb-4">
                  <User className="w-5 h-5 text-gray-500 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Informations Patient
                  </h3>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Nom du patient
                  </label>
                  <p className="text-lg text-gray-900 font-medium">
                    {patient
                      ? `${patient.prenom} ${patient.nom}`
                      : appointment?.patient
                        ? `${appointment.patient.prenom} ${appointment.patient.nom}`
                        : "Non renseigné"}
                  </p>
                  {(patient?.cin || appointment?.patient?.cin) && (
                    <p className="text-sm text-gray-600 mt-1">
                      CIN: {patient?.cin || appointment?.patient?.cin}
                    </p>
                  )}
                </div>
              </div>

              {/* Doctor Information */}
              <div className="space-y-6">
                <div className="flex items-center mb-4">
                  <Stethoscope className="w-5 h-5 text-gray-500 mr-2" />
                  <h3 className="text-lg font-semibold text-gray-900">
                    Informations Médecin
                  </h3>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Nom du médecin
                  </label>
                  <p className="text-lg text-gray-900 font-medium">
                    {medecin
                      ? medecin.nom
                      : appointment?.medecin
                        ? appointment.medecin.nom
                        : "Non renseigné"}
                  </p>
                </div>
              </div>
            </div>

            {/* Appointment Details */}
            <div className="mt-8 space-y-6">
              <div className="flex items-center mb-4">
                <FileText className="w-5 h-5 text-gray-500 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Détails du Rendez-vous
                </h3>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Date
                  </label>
                  <div className="flex items-center">
                    <Calendar className="w-4 h-4 text-gray-500 mr-2" />
                    <p className="text-gray-900">
                      {formatDate(appointment.date_rendez_vous)}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Heure
                  </label>
                  <div className="flex items-center">
                    <Clock className="w-4 h-4 text-gray-500 mr-2" />
                    <p className="text-gray-900">{appointment.heure}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <label className="block text-sm font-medium text-gray-500 mb-1">
                  Motif de consultation
                </label>
                <p className="text-gray-900">{appointment.motif}</p>
              </div>

              {appointment.created_at && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <label className="block text-sm font-medium text-gray-500 mb-1">
                    Date de création
                  </label>
                  <p className="text-gray-700">
                    {new Date(appointment.created_at).toLocaleDateString(
                      "fr-FR",
                      {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      },
                    )}
                  </p>
                </div>
              )}
            </div>

            {/* Status Management */}
            <div className="mt-8 border-t border-gray-200 pt-8">
              <div className="flex items-center mb-4">
                <h3 className="text-lg font-semibold text-gray-900">
                  Gestion du Statut
                </h3>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                  <div>
                    <label
                      htmlFor="status"
                      className="block text-sm font-medium text-gray-700 mb-2"
                    >
                      Modifier le statut du rendez-vous
                    </label>
                    <select
                      id="status"
                      value={selectedStatus}
                      onChange={(e) =>
                        setSelectedStatus(
                          e.target.value as RendezVous["statut"],
                        )
                      }
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-colors"
                    >
                      <option value="programme">Programmé</option>
                      <option value="termine">Terminé</option>
                      <option value="annule">Annulé</option>
                    </select>
                  </div>

                  {hasStatusChanged && (
                    <button
                      onClick={handleStatusChange}
                      disabled={updating}
                      className="flex items-center px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                    >
                      {updating ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                      ) : (
                        <Save className="w-4 h-4 mr-2" />
                      )}
                      {updating ? "Mise à jour..." : "Sauvegarder"}
                    </button>
                  )}
                </div>

                {hasStatusChanged && (
                  <div className="mt-3 text-sm text-amber-700">
                    <p>
                      ⚠️ Le statut sera modifié de "
                      {getStatusText(appointment.statut)}" vers "
                      {getStatusText(selectedStatus)}"
                    </p>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="mt-8 border-t border-gray-200 pt-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <button
                  onClick={() =>
                    navigate(`/patients/id/${appointment.patient_id}`)
                  }
                  className="flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <User className="w-4 h-4 mr-2" />
                  Voir le patient
                </button>

                <button
                  onClick={() =>
                    navigate(
                      `/consultations/nouvelle?patient=${appointment.patient_id}`,
                    )
                  }
                  className="flex items-center justify-center px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                >
                  <FileText className="w-4 h-4 mr-2" />
                  Nouvelle consultation
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AppointmentDetails;
