import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Calendar,
  User,
  Stethoscope,
  FileText,
  Edit,
  Trash2,
  Plus,
  Clock,
  Pill,
  AlertCircle,
  CheckCircle,
  UserCheck,
  Activity,
} from "lucide-react";
import { consultationsApi, patientsApi, userService } from "../services/api";
import { Consultation } from "../types";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "../components/common/LoadingSpinner";
import ErrorMessage from "../components/common/ErrorMessage";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const ConsultationDetailsPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user, isMedecin } = useAuth();

  const [consultation, setConsultation] = useState<Consultation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (id) {
      loadConsultation();
    }
  }, [id]);

  const loadConsultation = async () => {
    try {
      setLoading(true);
      setError(null);

      // Charger la consultation
      const consultationData = await consultationsApi.getById(id!);

      // Enrichir avec les données patient et médecin
      const [patientsResponse, usersResponse] = await Promise.all([
        patientsApi.getAll(1, 200),
        userService.getAll(),
      ]);

      // Trouver le patient
      const patient = patientsResponse.items.find(
        (p) => p.id === consultationData.patient_id,
      );

      // Trouver le médecin
      const medecin = usersResponse.find(
        (u) =>
          u.id === consultationData.medecin_id ||
          u._id === consultationData.medecin_id,
      );

      // Enrichir la consultation
      const enrichedConsultation = {
        ...consultationData,
        patient,
        medecin,
      };

      setConsultation(enrichedConsultation);
    } catch (err: any) {
      console.error("❌ Erreur chargement consultation:", err);
      setError("Impossible de charger les détails de la consultation");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!consultation) return;

    try {
      setDeleting(true);
      await consultationsApi.delete(consultation.id);
      navigate("/consultations");
    } catch (err: any) {
      console.error("❌ Erreur suppression:", err);
      setError("Erreur lors de la suppression de la consultation");
    } finally {
      setDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMMM yyyy", { locale: fr });
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMMM yyyy à HH:mm", {
        locale: fr,
      });
    } catch {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-600">
          Chargement de la consultation...
        </span>
      </div>
    );
  }

  if (!consultation) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Consultation introuvable
          </h1>
          <p className="text-gray-600 mb-6">
            La consultation demandée n'existe pas ou n'est plus disponible.
          </p>
          <button
            onClick={() => navigate("/consultations")}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retour aux consultations
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/consultations")}
            className="flex items-center text-gray-600 hover:text-gray-800 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Retour aux consultations
          </button>

          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center mb-4 lg:mb-0">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                <Stethoscope className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Détails de la consultation
                </h1>
                <p className="text-gray-600">
                  {formatDate(consultation.date_consultation)}
                </p>
              </div>
            </div>

            {/* Actions */}
            {isMedecin && (
              <div className="flex flex-wrap gap-3">
                <button
                  onClick={() =>
                    navigate(`/consultations/${consultation.id}/modifier`)
                  }
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 transition-colors"
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Modifier
                </button>

                <button
                  onClick={() =>
                    navigate("/consultations/nouvelle", {
                      state: { patientId: consultation.patient_id },
                    })
                  }
                  className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Nouvelle consultation
                </button>

                <button
                  onClick={() => setShowDeleteConfirm(true)}
                  className="inline-flex items-center px-4 py-2 border border-red-300 text-sm font-medium rounded-md shadow-sm text-red-700 bg-white hover:bg-red-50 transition-colors"
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Supprimer
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <ErrorMessage message={error} onDismiss={() => setError(null)} />
        )}

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Informations principales */}
          <div className="lg:col-span-2 space-y-6">
            {/* Informations patient */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-4">
                <User className="w-5 h-5 text-gray-400 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Informations patient
                </h2>
              </div>

              {consultation.patient ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      Nom complet
                    </label>
                    <p className="mt-1 text-sm text-gray-900">
                      {consultation.patient.prenom} {consultation.patient.nom}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      CIN
                    </label>
                    <p className="mt-1 text-sm text-gray-900">
                      {consultation.patient.cin}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      Date de naissance
                    </label>
                    <p className="mt-1 text-sm text-gray-900">
                      {consultation.patient.date_naissance
                        ? formatDate(consultation.patient.date_naissance)
                        : "Non renseignée"}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      Téléphone
                    </label>
                    <p className="mt-1 text-sm text-gray-900">
                      {consultation.patient.telephone || "Non renseigné"}
                    </p>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-sm font-medium text-gray-500">
                      Adresse
                    </label>
                    <p className="mt-1 text-sm text-gray-900">
                      {consultation.patient.adresse || "Non renseignée"}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-gray-500">
                  Informations patient non disponibles
                </p>
              )}

              {/* Bouton voir patient */}
              {consultation.patient && (
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <button
                    onClick={() =>
                      navigate(`/patients/id/${consultation.patient_id}`)
                    }
                    className="inline-flex items-center text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    <UserCheck className="w-4 h-4 mr-1" />
                    Voir le dossier complet du patient
                  </button>
                </div>
              )}
            </div>

            {/* Consultation détails */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-4">
                <Activity className="w-5 h-5 text-gray-400 mr-2" />
                <h2 className="text-lg font-semibold text-gray-900">
                  Détails de la consultation
                </h2>
              </div>

              <div className="space-y-6">
                {/* Motif */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    Motif de consultation
                  </label>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-900">{consultation.motif}</p>
                  </div>
                </div>

                {/* Symptômes */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    Symptômes
                  </label>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-gray-900 whitespace-pre-wrap">
                      {consultation.symptomes}
                    </p>
                  </div>
                </div>

                {/* Diagnostic */}
                <div>
                  <label className="block text-sm font-medium text-gray-500 mb-2">
                    Diagnostic
                  </label>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                    <p className="text-blue-900 font-medium whitespace-pre-wrap">
                      {consultation.diagnostic}
                    </p>
                  </div>
                </div>

                {/* Traitement */}
                {consultation.traitement && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">
                      <Pill className="w-4 h-4 inline mr-1" />
                      Traitement prescrit
                    </label>
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <p className="text-green-900 whitespace-pre-wrap">
                        {consultation.traitement}
                      </p>
                    </div>
                  </div>
                )}

                {/* Notes */}
                {consultation.notes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500 mb-2">
                      <FileText className="w-4 h-4 inline mr-1" />
                      Notes complémentaires
                    </label>
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                      <p className="text-yellow-900 whitespace-pre-wrap">
                        {consultation.notes}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Informations médicales */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-4">
                <Stethoscope className="w-5 h-5 text-gray-400 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">
                  Informations médicales
                </h3>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Médecin
                  </label>
                  <p className="mt-1 text-sm text-gray-900">
                    {consultation.medecin
                      ? `Dr. ${consultation.medecin.nom}`
                      : "Médecin non spécifié"}
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-500">
                    Date de consultation
                  </label>
                  <div className="mt-1 flex items-center text-sm text-gray-900">
                    <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                    {formatDate(consultation.date_consultation)}
                  </div>
                </div>

                {consultation.created_at && (
                  <div>
                    <label className="block text-sm font-medium text-gray-500">
                      Créée le
                    </label>
                    <div className="mt-1 flex items-center text-sm text-gray-500">
                      <Clock className="w-4 h-4 mr-2 text-gray-400" />
                      {formatDateTime(consultation.created_at)}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Statut et actions rapides */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center mb-4">
                <CheckCircle className="w-5 h-5 text-green-500 mr-2" />
                <h3 className="text-lg font-semibold text-gray-900">Statut</h3>
              </div>

              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                  <span className="text-sm text-gray-900">
                    Consultation terminée
                  </span>
                </div>

                <div className="pt-4 border-t border-gray-200">
                  <p className="text-xs text-gray-500 mb-3">Actions rapides</p>
                  <div className="space-y-2">
                    <button
                      onClick={() =>
                        navigate("/consultations/nouvelle", {
                          state: { patientId: consultation.patient_id },
                        })
                      }
                      className="w-full text-left px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                    >
                      Nouvelle consultation pour ce patient
                    </button>

                    <button
                      onClick={() =>
                        navigate("/rendez-vous/nouveau", {
                          state: { patientId: consultation.patient_id },
                        })
                      }
                      className="w-full text-left px-3 py-2 text-sm text-green-600 hover:bg-green-50 rounded-md transition-colors"
                    >
                      Programmer un rendez-vous
                    </button>

                    <button
                      onClick={() =>
                        navigate(`/patients/id/${consultation.patient_id}`)
                      }
                      className="w-full text-left px-3 py-2 text-sm text-purple-600 hover:bg-purple-50 rounded-md transition-colors"
                    >
                      Voir le dossier patient
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Informations système */}
            <div className="bg-gray-50 rounded-xl border border-gray-200 p-6">
              <h3 className="text-sm font-semibold text-gray-700 mb-3">
                Informations système
              </h3>
              <div className="space-y-2 text-xs text-gray-500">
                <div>ID Consultation: {consultation.id}</div>
                <div>ID Patient: {consultation.patient_id}</div>
                <div>ID Médecin: {consultation.medecin_id}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Modal de confirmation de suppression */}
        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
            <div className="relative top-20 mx-auto p-5 border w-96 shadow-lg rounded-md bg-white">
              <div className="mt-3">
                <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
                  <Trash2 className="h-6 w-6 text-red-600" />
                </div>
                <div className="mt-5 text-center">
                  <h3 className="text-lg font-medium text-gray-900">
                    Supprimer la consultation
                  </h3>
                  <div className="mt-2 px-7 py-3">
                    <p className="text-sm text-gray-500">
                      Êtes-vous sûr de vouloir supprimer cette consultation ?
                      Cette action est irréversible.
                    </p>
                    <div className="mt-3 p-3 bg-gray-50 rounded-lg text-left">
                      <div className="text-sm">
                        <div className="font-medium text-gray-900">
                          {consultation.patient
                            ? `${consultation.patient.prenom} ${consultation.patient.nom}`
                            : "Patient inconnu"}
                        </div>
                        <div className="text-gray-500">
                          {formatDate(consultation.date_consultation)}
                        </div>
                        <div className="text-gray-500 truncate">
                          {consultation.motif}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 justify-center">
                    <button
                      onClick={() => setShowDeleteConfirm(false)}
                      disabled={deleting}
                      className="px-4 py-2 bg-gray-300 text-gray-800 text-base font-medium rounded-md shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
                    >
                      Annuler
                    </button>
                    <button
                      onClick={handleDelete}
                      disabled={deleting}
                      className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 inline-flex items-center"
                    >
                      {deleting ? (
                        <>
                          <LoadingSpinner size="sm" className="mr-2" />
                          Suppression...
                        </>
                      ) : (
                        <>
                          <Trash2 className="h-4 w-4 mr-2" />
                          Supprimer
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ConsultationDetailsPage;
