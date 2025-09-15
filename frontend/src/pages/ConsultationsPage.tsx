import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Plus,
  Search,
  Eye,
  Edit,
  Calendar,
  User,
  Filter,
  Trash2,
  UserPlus,
} from "lucide-react";
import { Consultation, Patient, User as UserType } from "../types";
import { consultationsApi, patientsApi, userService } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "../components/common/LoadingSpinner";
import ErrorMessage from "../components/common/ErrorMessage";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const ConsultationsPage: React.FC = () => {
  const { isMedecin } = useAuth();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [consultations, setConsultations] = useState<Consultation[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medecins, setMedecins] = useState<UserType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredConsultations, setFilteredConsultations] = useState<
    Consultation[]
  >([]);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null,
  );

  // États pour les filtres
  const [dateFilter, setDateFilter] = useState("");
  const [medecinFilter, setMedecinFilter] = useState("");
  const [diagnosticFilter, setDiagnosticFilter] = useState("");
  const [sortBy, setSortBy] = useState<"date_desc" | "date_asc">("date_desc");

  useEffect(() => {
    loadData();
  }, [currentPage]);

  // Effet pour filtrer et trier les consultations
  useEffect(() => {
    let filtered = [...consultations];

    // Filtre par terme de recherche
    if (searchTerm.trim()) {
      filtered = filtered.filter((consultation) => {
        const patientName = consultation.patient
          ? `${consultation.patient.prenom} ${consultation.patient.nom}`.toLowerCase()
          : "";
        const patientCin = consultation.patient?.cin?.toLowerCase() || "";
        const diagnostic = consultation.diagnostic?.toLowerCase() || "";
        const medecinName = consultation.medecin?.nom?.toLowerCase() || "";
        const search = searchTerm.toLowerCase();

        return (
          patientName.includes(search) ||
          patientCin.includes(search) ||
          diagnostic.includes(search) ||
          medecinName.includes(search)
        );
      });
    }

    // Filtre par date
    if (dateFilter) {
      filtered = filtered.filter((consultation) => {
        const consultationDate = new Date(consultation.date_consultation)
          .toISOString()
          .split("T")[0];
        return consultationDate === dateFilter;
      });
    }

    // Filtre par médecin
    if (medecinFilter) {
      filtered = filtered.filter(
        (consultation) => consultation.medecin_id === medecinFilter,
      );
    }

    // Filtre par diagnostic (recherche partielle)
    if (diagnosticFilter.trim()) {
      filtered = filtered.filter((consultation) =>
        consultation.diagnostic
          ?.toLowerCase()
          .includes(diagnosticFilter.toLowerCase()),
      );
    }

    // Tri par date
    filtered.sort((a, b) => {
      const dateA = new Date(a.date_consultation);
      const dateB = new Date(b.date_consultation);

      if (sortBy === "date_asc") {
        return dateA.getTime() - dateB.getTime();
      } else {
        return dateB.getTime() - dateA.getTime();
      }
    });

    setFilteredConsultations(filtered);
  }, [
    consultations,
    searchTerm,
    dateFilter,
    medecinFilter,
    diagnosticFilter,
    sortBy,
  ]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("=== DEBUG CONSULTATIONS ===");
      console.log("Appel API:", `/consultations?page=${currentPage}&size=10`);

      const [consultationsResponse, patientsResponse, usersResponse] =
        await Promise.all([
          consultationsApi.getAll(currentPage, 10),
          patientsApi.getAll(1, 200), // Charger plus de patients
          userService.getAll(), // Récupérer tous les utilisateurs
        ]);

      console.log("Réponse consultations:", consultationsResponse);
      console.log("Réponse patients:", patientsResponse);
      console.log("Réponse users:", usersResponse);

      // DEBUG : Afficher les informations du médecin connecté
      console.log("🩺 Médecin connecté:", {
        id: user?.id,
        _id: (user as any)?._id,
        nom: user?.nom,
        role: user?.role,
      });

      // Récupérer l'ID du médecin connecté (priorité à _id)
      const userMedecinId = (user as any)?._id || user?.id;
      console.log(
        "🆔 ID du médecin connecté utilisé pour le filtrage:",
        userMedecinId,
      );

      // DEBUG : Afficher toutes les consultations avant filtrage
      console.log(
        "📋 Toutes les consultations (avant filtrage):",
        consultationsResponse.items.map((c) => ({
          id: c.id,
          medecin_id: c.medecin_id,
          patient_id: c.patient_id,
          date: c.date_consultation,
        })),
      );

      // Dans le filtrage, remplacez par le code original :
      const consultationsMedecin = consultationsResponse.items.filter(
        (consultation: any) => {
          // Ignorer les consultations avec medecin_id par défaut ou invalide
          if (
            !consultation.medecin_id ||
            consultation.medecin_id === "default_medecin_id"
          ) {
            console.log(
              `⚠️ Consultation ${consultation.id} ignorée: medecin_id invalide (${consultation.medecin_id})`,
            );
            return false;
          }

          const match = consultation.medecin_id === userMedecinId;
          console.log(
            `🔍 Consultation ${consultation.id}: medecin_id=${consultation.medecin_id} == user=${userMedecinId} ? ${match}`,
          );
          return match;
        },
      );

      console.log(
        `✅ Consultations filtrées: ${consultationsMedecin.length} sur ${consultationsResponse.items.length}`,
      );

      // Filtrer seulement les médecins
      const medecinsOnly = usersResponse.filter(
        (user: UserType) => user.role === "medecin",
      );

      // Joindre les données des patients et médecins aux consultations filtrées
      const consultationsWithDetails = consultationsMedecin.map(
        (consultation: any) => {
          const patient = patientsResponse.items.find(
            (p: Patient) => p.id == consultation.patient_id,
          );

          // Le médecin est forcément celui connecté puisqu'on a filtré
          const medecin = usersResponse.find(
            (m: any) =>
              m._id == consultation.medecin_id ||
              m.id == consultation.medecin_id,
          );

          // Debug pour vérification
          if (!patient && consultation.patient_id) {
            console.log(
              "Patient non trouvé pour consultation:",
              consultation.id,
              "patient_id:",
              consultation.patient_id,
            );
          }

          if (!medecin) {
            console.log(
              "Médecin non trouvé pour consultation:",
              consultation.id,
              "medecin_id:",
              consultation.medecin_id,
            );
          }

          return {
            ...consultation,
            patient,
            medecin,
          };
        },
      );

      setConsultations(consultationsWithDetails);
      setPatients(patientsResponse.items);
      setMedecins(medecinsOnly);

      // IMPORTANT: Adapter le nombre de pages selon les consultations filtrées
      // Note: Ceci est une approximation, idéalement le filtrage devrait se faire côté serveur
      const estimatedTotalFiltered = Math.ceil(
        (consultationsMedecin.length / 10) * consultationsResponse.pages,
      );
      setTotalPages(Math.max(1, estimatedTotalFiltered));
    } catch (err: any) {
      console.error("Erreur lors du chargement des consultations:", err);
      console.log("Détails de l'erreur:", err.response?.data);
      console.log("Status de l'erreur:", err.response?.status);
      setError("Impossible de charger la liste des consultations");
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    // La recherche se fait automatiquement via useEffect
    console.log("Recherche:", searchTerm);
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMMM yyyy", { locale: fr });
    } catch {
      return dateString;
    }
  };

  const formatTime = (dateString: string) => {
    try {
      return format(new Date(dateString), "HH:mm");
    } catch {
      return "";
    }
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setDateFilter("");
    setMedecinFilter("");
    setDiagnosticFilter("");
    setSortBy("date_desc");
  };

  const handleDeleteConsultation = async (consultationId: string) => {
    try {
      setDeletingId(consultationId);
      setError(null);

      await consultationsApi.delete(consultationId);

      // Retirer la consultation de la liste
      setConsultations((prev) =>
        prev.filter((consultation) => consultation.id !== consultationId),
      );

      setSuccess("Consultation supprimée avec succès");
      setShowDeleteConfirm(null);

      // Masquer le message de succès après 3 secondes
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Erreur lors de la suppression:", err);
      setError("Erreur lors de la suppression de la consultation");
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDelete = (consultation: Consultation) => {
    // Utiliser _id en priorité, puis id comme fallback
    const consultationId = (consultation as any)._id || consultation.id;
    if (consultationId) {
      setShowDeleteConfirm(consultationId);
    } else {
      console.error(
        "❌ Impossible de supprimer: ID consultation manquant",
        consultation,
      );
    }
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(null);
  };

  // Obtenir les diagnostics uniques pour le filtre
  const uniqueDiagnostics = Array.from(
    new Set(
      consultations.map((c) => c.diagnostic).filter((d) => d && d.trim()),
    ),
  ).slice(0, 10); // Limiter à 10 pour éviter une liste trop longue

  if (loading && consultations.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Consultations</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gérer les consultations médicales
          </p>
        </div>
        {isMedecin && (
          <div className="mt-4 sm:mt-0">
            <Link
              to="/consultations/nouvelle"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouvelle Consultation
            </Link>
          </div>
        )}
      </div>

      {/* Barre de recherche et filtres */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-4 space-y-4">
        {/* Recherche */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search className="h-5 w-5 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Rechercher par nom de patient, CIN, diagnostic ou médecin..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && handleSearch()}
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
          />
          {searchTerm && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
              <button
                onClick={() => setSearchTerm("")}
                className="text-gray-400 hover:text-gray-600"
              >
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
          )}
        </div>

        {/* Filtres */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
          {/* Filtre par date */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Filtrer par date
            </label>
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            />
          </div>

          {/* Filtre par diagnostic */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Filtrer par Diagnostic
            </label>
            <input
              type="text"
              placeholder="Diagnostic..."
              value={diagnosticFilter}
              onChange={(e) => setDiagnosticFilter(e.target.value)}
              className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
              list="diagnostics-list"
            />
            <datalist id="diagnostics-list">
              {uniqueDiagnostics.map((diagnostic, index) => (
                <option key={index} value={diagnostic} />
              ))}
            </datalist>
          </div>

          {/* Tri */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Trier par
            </label>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "date_desc" | "date_asc")
              }
              className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="date_desc">Plus récent d'abord</option>
              <option value="date_asc">Plus ancien d'abord</option>
            </select>
          </div>

          {/* Bouton effacer filtres */}
          <div className="flex items-end">
            <button
              onClick={clearAllFilters}
              className="w-full inline-flex items-center justify-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              <Filter className="h-4 w-4 mr-2" />
              Effacer
            </button>
          </div>
        </div>

        {/* Indicateur de résultats */}
        {(searchTerm || dateFilter || medecinFilter || diagnosticFilter) && (
          <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-md">
            <span className="font-medium">{filteredConsultations.length}</span>{" "}
            résultat(s) trouvé(s)
            {searchTerm && ` pour "${searchTerm}"`}
            {dateFilter && ` le ${formatDate(dateFilter)}`}
            {medecinFilter &&
              ` pour Dr. ${medecins.find((m) => m.id === medecinFilter)?.nom}`}
            {diagnosticFilter && ` avec diagnostic "${diagnosticFilter}"`}
          </div>
        )}
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
                  {(() => {
                    const consultation = consultations.find(
                      (c) => c.id === showDeleteConfirm,
                    );
                    return consultation ? (
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
                    ) : null;
                  })()}
                </div>
                <div className="flex gap-3 justify-center">
                  <button
                    onClick={cancelDelete}
                    disabled={deletingId === showDeleteConfirm}
                    className="px-4 py-2 bg-gray-300 text-gray-800 text-base font-medium rounded-md shadow-sm hover:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => handleDeleteConsultation(showDeleteConfirm)}
                    disabled={deletingId === showDeleteConfirm}
                    className="px-4 py-2 bg-red-600 text-white text-base font-medium rounded-md shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 disabled:opacity-50 inline-flex items-center"
                  >
                    {deletingId === showDeleteConfirm ? (
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

      {/* Error Message */}
      {error && (
        <ErrorMessage message={error} onDismiss={() => setError(null)} />
      )}

      {/* Success Message */}
      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-green-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          </div>
        </div>
      )}

      {/* Consultations List */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        {(filteredConsultations?.length ?? 0) === 0 ? (
          <div className="text-center py-12">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {searchTerm || dateFilter || medecinFilter || diagnosticFilter
                ? "Aucun résultat trouvé"
                : "Aucune consultation"}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || dateFilter || medecinFilter || diagnosticFilter
                ? "Essayez de modifier vos critères de recherche."
                : "Commencez par créer une nouvelle consultation."}
            </p>
            {(searchTerm ||
              dateFilter ||
              medecinFilter ||
              diagnosticFilter) && (
              <button
                onClick={clearAllFilters}
                className="mt-3 text-blue-600 hover:text-blue-500 text-sm font-medium"
              >
                Effacer tous les filtres
              </button>
            )}
            {isMedecin &&
              !(
                searchTerm ||
                dateFilter ||
                medecinFilter ||
                diagnosticFilter
              ) && (
                <div className="mt-6">
                  <Link
                    to="/consultations/nouvelle"
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Nouvelle Consultation
                  </Link>
                </div>
              )}
          </div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Patient
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Heure
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Motif
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Médecin
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredConsultations.map((consultation, index) => {
                    // 🔧 Correction prioritaire
                    const consultationId = consultation._id || consultation.id;

                    if (!consultationId) {
                      console.error("❌ Consultation sans ID:", consultation);
                      return null;
                    }

                    return (
                      <tr
                        key={consultationId}
                        className="hover:bg-gray-50 cursor-pointer transition-colors"
                        onClick={() => {
                          console.log(
                            "🔗 Navigation vers consultation:",
                            consultationId,
                          );
                          navigate(`/consultations/${consultationId}`);
                        }}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 h-8 w-8">
                              <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                                <User className="h-4 w-4 text-gray-500" />
                              </div>
                            </div>
                            <div className="ml-3">
                              <div className="text-sm font-medium text-gray-900">
                                {consultation.patient
                                  ? `${consultation.patient.prenom} ${consultation.patient.nom}`
                                  : "Patient inconnu"}
                              </div>
                              <div className="text-sm text-gray-500">
                                {consultation.patient?.cin ||
                                  "CIN non disponible"}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm text-gray-900">
                            {formatDate(consultation.date_consultation)}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm text-gray-900 max-w-xs truncate">
                            {consultation.motif || "Motif non disponible"}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {consultation.medecin
                            ? `Dr. ${consultation.medecin.nom}`
                            : "Médecin inconnu"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex items-center justify-end space-x-2">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/consultations/${consultationId}`);
                              }}
                              className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-blue-50 transition-colors"
                              title="Voir les détails"
                            >
                              <Eye className="h-4 w-4" />
                            </button>

                            {isMedecin && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(
                                    `/consultations/${consultation.id}/modifier`,
                                  );
                                }}
                                className="text-green-600 hover:text-green-900 p-1 rounded-full hover:bg-green-50 transition-colors"
                                title="Modifier la consultation"
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            )}

                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(
                                  `/patients/id/${consultation.patient_id}`,
                                );
                              }}
                              className="text-purple-600 hover:text-purple-900 p-1 rounded-full hover:bg-purple-50 transition-colors"
                              title="Voir le patient"
                            >
                              <User className="h-4 w-4" />
                            </button>

                            {isMedecin && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  confirmDelete(consultation);
                                }}
                                className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50 transition-colors"
                                title="Supprimer la consultation"
                                disabled={deletingId === consultation.id}
                              >
                                {deletingId === consultation.id ? (
                                  <LoadingSpinner size="sm" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                <div className="flex-1 flex justify-between sm:hidden">
                  <button
                    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1}
                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Précédent
                  </button>
                  <button
                    onClick={() =>
                      setCurrentPage(Math.min(totalPages, currentPage + 1))
                    }
                    disabled={currentPage === totalPages}
                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                  >
                    Suivant
                  </button>
                </div>
                <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm text-gray-700">
                      Page <span className="font-medium">{currentPage}</span>{" "}
                      sur <span className="font-medium">{totalPages}</span>
                    </p>
                  </div>
                  <div>
                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                      <button
                        onClick={() =>
                          setCurrentPage(Math.max(1, currentPage - 1))
                        }
                        disabled={currentPage === 1}
                        className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Précédent
                      </button>
                      <button
                        onClick={() =>
                          setCurrentPage(Math.min(totalPages, currentPage + 1))
                        }
                        disabled={currentPage === totalPages}
                        className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Suivant
                      </button>
                    </nav>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default ConsultationsPage;
