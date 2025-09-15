import React, { useState, useEffect } from "react";
import {
  Plus,
  Calendar,
  Eye,
  Edit,
  Clock,
  User2,
  Search,
  Filter,
  Trash2,
} from "lucide-react";
import { RendezVous, Patient, User } from "../types";
import { rendezVousApi, patientsApi, userService } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "../components/common/LoadingSpinner";
import ErrorMessage from "../components/common/ErrorMessage";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useNavigate } from "react-router-dom";

const RendezVousPage: React.FC = () => {
  const { user } = useAuth();
  const [rendezVous, setRendezVous] = useState<RendezVous[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medecins, setMedecins] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredRendezVous, setFilteredRendezVous] = useState<RendezVous[]>(
    [],
  );
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(
    null,
  );
  const navigate = useNavigate();

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";


  // États pour les filtres
  const [dateFilter, setDateFilter] = useState("");
  const [statutFilter, setStatutFilter] = useState("");
  const [sortBy, setSortBy] = useState<"date_asc" | "date_desc">("date_desc");

  // État du formulaire
  const [formData, setFormData] = useState({
    patient_id: "",
    date_rendez_vous: "",
    heure: "",
    motif: "",
    statut: "programme" as const,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    loadData();
  }, []);

  // Effet pour filtrer et trier les rendez-vous
  useEffect(() => {
    let filtered = [...rendezVous];

    // Filtre par terme de recherche
    if (searchTerm.trim()) {
      filtered = filtered.filter((rdv) => {
        const patientName = rdv.patient
          ? `${rdv.patient.prenom} ${rdv.patient.nom}`.toLowerCase()
          : "";
        const patientCin = rdv.patient?.cin?.toLowerCase() || "";
        const search = searchTerm.toLowerCase();

        return patientName.includes(search) || patientCin.includes(search);
      });
    }

    // Filtre par date
    if (dateFilter) {
      filtered = filtered.filter((rdv) => rdv.date_rendez_vous === dateFilter);
    }

    // Filtre par statut
    if (statutFilter) {
      filtered = filtered.filter((rdv) => rdv.statut === statutFilter);
    }

    // Tri par date et heure
    filtered.sort((a, b) => {
      const dateA = new Date(`${a.date_rendez_vous}T${a.heure}`);
      const dateB = new Date(`${b.date_rendez_vous}T${b.heure}`);

      if (sortBy === "date_asc") {
        return dateA.getTime() - dateB.getTime();
      } else {
        return dateB.getTime() - dateA.getTime();
      }
    });

    setFilteredRendezVous(filtered);
  }, [rendezVous, searchTerm, dateFilter, statutFilter, sortBy]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Charger les rendez-vous et patients en premier
      const [rendezVousResponse, patientsResponse] = await Promise.all([
        rendezVousApi.getAll(1, 50),
        patientsApi.getAll(1, 100),
      ]);

      // Essayer de charger les utilisateurs, mais continuer même en cas d'erreur
      let medecinsOnly: User[] = [];
      try {
        const usersResponse = await userService.getAll();
        medecinsOnly = usersResponse.filter(
          (user: User) => user.role === "medecin",
        );
      } catch (userError) {
        console.warn("⚠️ Impossible de charger les utilisateurs:", userError);
        // Continuer sans les données des médecins
      }

      // Récupérer l'ID du médecin (connecté ou associé à la secrétaire)
      let targetMedecinId;
      if (user?.role === "medecin") {
        targetMedecinId = (user as any)?._id || user?.id;
        console.log(
          "👨‍⚕️ Médecin connecté - affichage de ses RDV:",
          targetMedecinId,
        );
      } else if (user?.role === "secretaire") {
        try {
          const userId = (user as any)?._id || user?.id;
          const userResponse = await fetch(
            `${API_BASE_URL}/users/${userId}`,
          );
          if (userResponse.ok) {
            const userData = await userResponse.json();
            targetMedecinId =
              userData.medecin_id ||
              userData.medecin?.id ||
              userData.medecin?._id;
            console.log(
              "👩‍💼 Secrétaire - affichage des RDV du médecin associé:",
              targetMedecinId,
            );
          } else {
            throw new Error(`Erreur HTTP ${userResponse.status}`);
          }
        } catch (error) {
          console.error(
            "❌ Erreur lors de la récupération du médecin associé:",
            error,
          );
          setError(
            "Impossible de récupérer les informations du médecin associé",
          );
          return;
        }
      } else {
        console.error("❌ Rôle utilisateur non autorisé:", user?.role);
        setError(
          "Rôle utilisateur non autorisé pour consulter les rendez-vous",
        );
        return;
      }

      if (!targetMedecinId) {
        console.error("❌ Impossible de déterminer le médecin cible");
        setError("Erreur: Impossible de déterminer le médecin associé");
        return;
      }

      // Filtrer les rendez-vous du médecin cible
      const rendezVousMedecin = rendezVousResponse.items.filter((rdv: any) => {
        return rdv.medecin_id === targetMedecinId;
      });

      console.log(
        `✅ RDV filtrés: ${rendezVousMedecin.length} sur ${rendezVousResponse.items.length} pour le médecin ${targetMedecinId}`,
      );

      // Joindre les données des patients et médecins aux rendez-vous filtrés
      const rendezVousWithDetails = rendezVousMedecin.map((rdv: any) => {
        const patient = patientsResponse.items.find(
          (p: Patient) => p.id == rdv.patient_id,
        );

        // Trouver le médecin du rendez-vous
        const medecin = medecinsOnly.find(
          (m: any) =>
            m.id == rdv.medecin_id ||
            m._id == rdv.medecin_id ||
            m.userId == rdv.medecin_id ||
            m.user_id == rdv.medecin_id,
        );

        // Si on ne trouve pas le médecin dans la liste, utiliser les données du médecin cible
        const medecinData = medecin || (user?.role === "medecin" ? user : null);

        return {
          ...rdv,
          patient,
          medecin: medecinData,
        };
      });

      setRendezVous(rendezVousWithDetails);
      setPatients(patientsResponse.items);
      setMedecins(medecinsOnly);
    } catch (err: any) {
      console.error("Erreur lors du chargement:", err);
      setError(
        "Impossible de charger les rendez-vous. Vérifiez vos permissions.",
      );
    } finally {
      setLoading(false);
    }
  };

  const validateForm = () => {
    const errors: Record<string, string> = {};

    if (!formData.patient_id) {
      errors.patient_id = "Veuillez sélectionner un patient";
    }
    if (!formData.date_rendez_vous) {
      errors.date_rendez_vous = "La date est requise";
    }
    if (!formData.heure) {
      errors.heure = "L'heure est requise";
    }
    if (!formData.motif.trim()) {
      errors.motif = "Le motif est requis";
    }

    // Vérifier que la date n'est pas dans le passé
    if (formData.date_rendez_vous) {
      const selectedDate = new Date(formData.date_rendez_vous);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        errors.date_rendez_vous = "La date ne peut pas être dans le passé";
      }
    }

    // Vérifier les conflits d'horaires
    if (formData.date_rendez_vous && formData.heure) {
      const conflict = rendezVous.find(
        (rdv) =>
          rdv.date_rendez_vous === formData.date_rendez_vous &&
          rdv.heure === formData.heure &&
          rdv.statut !== "annule",
      );

      if (conflict) {
        errors.heure = "Un rendez-vous existe déjà à cette heure";
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setFormLoading(true);
      setError(null);

      const newRendezVous = {
        ...formData,
        patient_id: parseInt(formData.patient_id),
        medecin_id: user!.id,
      };

      const created = await rendezVousApi.create(newRendezVous);

      // Ajouter le patient et médecin au nouveau RDV
      const createdWithDetails = {
        ...created,
        patient: patients.find((p) => p.id === created.patient_id),
        medecin: medecins.find((m) => m.id === created.medecin_id) || user,
      };

      // Ajouter le nouveau RDV à la liste
      setRendezVous([createdWithDetails, ...rendezVous]);

      // Réinitialiser le formulaire
      setFormData({
        patient_id: "",
        date_rendez_vous: "",
        heure: "",
        motif: "",
        statut: "programme",
      });
      setFormErrors({});
      setShowForm(false);
      setSuccess("Rendez-vous créé avec succès");

      // Masquer le message de succès après 3 secondes
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Erreur lors de la création:", err);
      setError("Erreur lors de la création du rendez-vous");
    } finally {
      setFormLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      return format(new Date(dateString), "dd MMMM yyyy", { locale: fr });
    } catch {
      return dateString;
    }
  };

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case "programme":
        return "bg-blue-100 text-blue-800";
      case "confirme":
        return "bg-green-100 text-green-800";
      case "annule":
        return "bg-red-100 text-red-800";
      case "termine":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusLabel = (statut: string) => {
    switch (statut) {
      case "programme":
        return "Programmé";
      case "confirme":
        return "Confirmé";
      case "annule":
        return "Annulé";
      case "termine":
        return "Terminé";
      default:
        return statut;
    }
  };

  const clearAllFilters = () => {
    setSearchTerm("");
    setDateFilter("");
    setStatutFilter("");
    setSortBy("date_desc");
  };

  const handleDeleteRendezVous = async (rdvId: string) => {
    try {
      setDeletingId(rdvId);
      setError(null);

      await rendezVousApi.delete(rdvId);

      // Retirer le RDV de la liste
      setRendezVous((prev) =>
        prev.filter((rdv) => (rdv._id || rdv.id) !== rdvId),
      );

      setSuccess("Rendez-vous supprimé avec succès");
      setShowDeleteConfirm(null);

      // Masquer le message de succès après 3 secondes
      setTimeout(() => setSuccess(null), 3000);
    } catch (err: any) {
      console.error("Erreur lors de la suppression:", err);
      setError("Erreur lors de la suppression du rendez-vous");
    } finally {
      setDeletingId(null);
    }
  };

  const confirmDelete = (rdv: RendezVous) => {
    const rdvId = rdv._id || rdv.id;
    setShowDeleteConfirm(rdvId);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(null);
  };

  if (loading) {
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
          <h1 className="text-2xl font-bold text-gray-900">Rendez-vous</h1>
          <p className="mt-1 text-sm text-gray-500">
            Gérer les rendez-vous médicaux
          </p>
        </div>
        <div className="mt-4 sm:mt-0">
          <button
            onClick={() => navigate("/rendez-vous/nouveau")}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Nouveau Rendez-vous
          </button>
        </div>
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
            placeholder="Rechercher par nom de patient ou CIN..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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

          {/* Filtre par statut */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Filtrer par statut
            </label>
            <select
              value={statutFilter}
              onChange={(e) => setStatutFilter(e.target.value)}
              className="block w-full text-sm border-gray-300 rounded-md shadow-sm focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="">Tous les statuts</option>
              <option value="programme">Programmé</option>
              <option value="confirme">Confirmé</option>
              <option value="annule">Annulé</option>
              <option value="termine">Terminé</option>
            </select>
          </div>

          {/* Tri */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Trier par
            </label>
            <select
              value={sortBy}
              onChange={(e) =>
                setSortBy(e.target.value as "date_asc" | "date_desc")
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
        {(searchTerm || dateFilter || statutFilter) && (
          <div className="text-sm text-gray-600 bg-gray-50 px-3 py-2 rounded-md">
            <span className="font-medium">{filteredRendezVous.length}</span>{" "}
            résultat(s) trouvé(s)
            {searchTerm && ` pour "${searchTerm}"`}
            {dateFilter && ` le ${formatDate(dateFilter)}`}
            {statutFilter &&
              ` avec le statut "${getStatusLabel(statutFilter)}"`}
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
                  Supprimer le rendez-vous
                </h3>
                <div className="mt-2 px-7 py-3">
                  <p className="text-sm text-gray-500">
                    Êtes-vous sûr de vouloir supprimer ce rendez-vous ? Cette
                    action est irréversible.
                  </p>
                  {(() => {
                    const rdv = rendezVous.find(
                      (r) => (r._id || r.id) === showDeleteConfirm,
                    );
                    return rdv ? (
                      <div className="mt-3 p-3 bg-gray-50 rounded-lg text-left">
                        <div className="text-sm">
                          <div className="font-medium text-gray-900">
                            {rdv.patient
                              ? `${rdv.patient.prenom} ${rdv.patient.nom}`
                              : "Patient inconnu"}
                          </div>
                          <div className="text-gray-500">
                            {formatDate(rdv.date_rendez_vous)} à {rdv.heure}
                          </div>
                          <div className="text-gray-500 truncate">
                            {rdv.motif}
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
                    onClick={() => handleDeleteRendezVous(showDeleteConfirm)}
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

      {/* Messages */}
      {error && (
        <ErrorMessage message={error} onDismiss={() => setError(null)} />
      )}

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

      {/* Formulaire de création */}
      {showForm && (
        <div className="bg-white shadow-sm rounded-lg border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-medium text-gray-900">
              Nouveau rendez-vous
            </h2>
          </div>
          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {/* Patient */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Patient *
                </label>
                <select
                  value={formData.patient_id}
                  onChange={(e) =>
                    setFormData({ ...formData, patient_id: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="">Sélectionner un patient</option>
                  {patients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.prenom} {patient.nom} ({patient.cin})
                    </option>
                  ))}
                </select>
                {formErrors.patient_id && (
                  <p className="mt-1 text-sm text-red-600">
                    {formErrors.patient_id}
                  </p>
                )}
              </div>

              {/* Date */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Date *
                </label>
                <input
                  type="date"
                  value={formData.date_rendez_vous}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      date_rendez_vous: e.target.value,
                    })
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                {formErrors.date_rendez_vous && (
                  <p className="mt-1 text-sm text-red-600">
                    {formErrors.date_rendez_vous}
                  </p>
                )}
              </div>

              {/* Heure */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Heure *
                </label>
                <input
                  type="time"
                  value={formData.heure}
                  onChange={(e) =>
                    setFormData({ ...formData, heure: e.target.value })
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                />
                {formErrors.heure && (
                  <p className="mt-1 text-sm text-red-600">
                    {formErrors.heure}
                  </p>
                )}
              </div>

              {/* Statut */}
              <div>
                <label className="block text-sm font-medium text-gray-700">
                  Statut
                </label>
                <select
                  value={formData.statut}
                  onChange={(e) =>
                    setFormData({ ...formData, statut: e.target.value as any })
                  }
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                >
                  <option value="programme">Programmé</option>
                  <option value="confirme">Confirmé</option>
                </select>
              </div>
            </div>

            {/* Motif */}
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Motif *
              </label>
              <textarea
                value={formData.motif}
                onChange={(e) =>
                  setFormData({ ...formData, motif: e.target.value })
                }
                rows={3}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Motif de la consultation..."
              />
              {formErrors.motif && (
                <p className="mt-1 text-sm text-red-600">{formErrors.motif}</p>
              )}
            </div>

            {/* Boutons */}
            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={formLoading}
                className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {formLoading && <LoadingSpinner size="sm" className="mr-2" />}
                Créer
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Liste des rendez-vous */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        {(filteredRendezVous?.length ?? 0) === 0 ? (
          <div className="text-center py-12">
            <Calendar className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">
              {searchTerm || dateFilter || statutFilter
                ? "Aucun résultat trouvé"
                : "Aucun rendez-vous"}
            </h3>
            <p className="mt-1 text-sm text-gray-500">
              {searchTerm || dateFilter || statutFilter
                ? "Essayez de modifier vos critères de recherche."
                : "Commencez par créer un nouveau rendez-vous."}
            </p>
            {(searchTerm || dateFilter || statutFilter) && (
              <button
                onClick={clearAllFilters}
                className="mt-3 text-blue-600 hover:text-blue-500 text-sm font-medium"
              >
                Effacer tous les filtres
              </button>
            )}
          </div>
        ) : (
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
                    Statut
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
                {filteredRendezVous.map((rdv, index) => {
                  const rdvId = rdv._id || rdv.id;

                  return (
                    <tr
                      key={rdvId || `rdv-${index}`}
                      className="hover:bg-gray-50 cursor-pointer transition-colors"
                      onClick={() => navigate(`/rendez-vous/${rdvId}`)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-8 w-8">
                            <div className="h-8 w-8 rounded-full bg-gray-200 flex items-center justify-center">
                              <User2 className="h-4 w-4 text-gray-500" />
                            </div>
                          </div>
                          <div className="ml-3">
                            <div className="text-sm font-medium text-gray-900">
                              {rdv.patient
                                ? `${rdv.patient.prenom} ${rdv.patient.nom}`
                                : "Patient inconnu"}
                            </div>
                            <div className="text-sm text-gray-500">
                              {rdv.patient?.cin || "CIN non disponible"}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center text-sm text-gray-900">
                          <Calendar className="h-4 w-4 mr-2 text-gray-400" />
                          {formatDate(rdv.date_rendez_vous)}
                        </div>
                        <div className="flex items-center text-sm text-gray-500">
                          <Clock className="h-4 w-4 mr-2 text-gray-400" />
                          {rdv.heure}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900 max-w-xs truncate">
                          {rdv.motif}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(rdv.statut)}`}
                        >
                          {getStatusLabel(rdv.statut)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {rdv.medecin
                          ? `Dr. ${rdv.medecin.nom}`
                          : "Médecin inconnu"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/rendez-vous/${rdvId}`);
                            }}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-blue-50 transition-colors"
                            title="Voir les détails"
                          >
                            <Eye className="h-4 w-4" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/rendez-vous/${rdvId}/modifier`);
                            }}
                            className="text-green-600 hover:text-green-900 p-1 rounded-full hover:bg-green-50 transition-colors"
                            title="Modifier le rendez-vous"
                          >
                            <Edit className="h-4 w-4" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/patients/id/${rdv.patient_id}`);
                            }}
                            className="text-purple-600 hover:text-purple-900 p-1 rounded-full hover:bg-purple-50 transition-colors"
                            title="Voir le patient"
                          >
                            <User2 className="h-4 w-4" />
                          </button>

                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              confirmDelete(rdv);
                            }}
                            className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50 transition-colors"
                            title="Supprimer le rendez-vous"
                            disabled={deletingId === rdvId}
                          >
                            {deletingId === rdvId ? (
                              <LoadingSpinner size="sm" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default RendezVousPage;
