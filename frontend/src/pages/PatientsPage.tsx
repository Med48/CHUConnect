import React, { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { Plus, Search, Eye, Edit, Trash2, X, Users } from "lucide-react";
import { Patient } from "../types";
import { patientsApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "../components/common/LoadingSpinner";
import ErrorMessage from "../components/common/ErrorMessage";

const PatientsPage: React.FC = () => {
  const { isMedecin, user } = useAuth();
  const [allPatients, setAllPatients] = useState<Patient[]>([]);
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  useEffect(() => {
    console.log("✅ PatientsPage chargé !");
    console.log("Utilisateur connecté:", user);
    console.log("Est médecin:", isMedecin);
    loadPatients();
  }, [currentPage, user]);

  // Recherche en temps réel
  useEffect(() => {
    handleSearch();
  }, [searchTerm, allPatients]);

  const loadPatients = async () => {
    try {
      setLoading(true);
      setError(null);

      console.log("=== DEBUG loadPatients ===");
      console.log("user:", user);
      console.log("isMedecin:", isMedecin);

      // ✅ SOLUTION SIMPLIFIÉE : Utiliser toujours la route principale
      // Le backend gère automatiquement médecins et secrétaires
      const response = await patientsApi.getAll(currentPage, 50);

      console.log("✅ Patients chargés:", response.items);
      setAllPatients(response.items || []);
      setTotalPages(response.pages || 1);
    } catch (err: any) {
      console.error("❌ Erreur lors du chargement des patients:", err);
      console.error("❌ Message d'erreur:", err.message);

      // Afficher un message d'erreur plus précis
      if (err.message.includes("403")) {
        setError("Accès non autorisé - Vérifiez vos permissions");
      } else if (err.message.includes("400")) {
        setError(
          "Données utilisateur incomplètes - Contactez l'administrateur",
        );
      } else {
        setError(`Impossible de charger les patients: ${err.message}`);
      }

      setAllPatients([]);
    } finally {
      setLoading(false);
    }
  };

  // Fonction de recherche optimisée
  const handleSearch = useCallback(() => {
    if (!searchTerm.trim()) {
      setFilteredPatients(allPatients);
      return;
    }

    const search = searchTerm.toLowerCase().trim();

    const filtered = allPatients.filter((patient) => {
      // Recherche dans le nom complet
      const fullName = `${patient.prenom} ${patient.nom}`.toLowerCase();
      const reverseName = `${patient.nom} ${patient.prenom}`.toLowerCase();

      // Recherche dans le CIN
      const cin = patient.cin?.toLowerCase() || "";

      // Recherche dans le téléphone
      const telephone = patient.telephone?.toLowerCase() || "";

      return (
        fullName.includes(search) ||
        reverseName.includes(search) ||
        cin.includes(search) ||
        telephone.includes(search) ||
        patient.nom.toLowerCase().includes(search) ||
        patient.prenom.toLowerCase().includes(search)
      );
    });

    setFilteredPatients(filtered);
  }, [searchTerm, allPatients]);

  const clearSearch = () => {
    setSearchTerm("");
  };

  // ✅ TOUTES LES FONCTIONNALITÉS pour médecins ET secrétaires
  const canModifyPatients = isMedecin || (user && user.role === "secretaire"); // Médecins ET secrétaires
  const canViewPatients = isMedecin || (user && user.role === "secretaire"); // Médecins ET secrétaires
  const canAddPatients = isMedecin || (user && user.role === "secretaire"); // Médecins ET secrétaires

  const handleDelete = async (id: string) => {
    if (!canModifyPatients) return;

    if (window.confirm("Êtes-vous sûr de vouloir supprimer ce patient ?")) {
      try {
        await patientsApi.delete(id);
        // Mettre à jour les deux listes
        setAllPatients((prev) => prev.filter((p) => p.id !== id));
        setFilteredPatients((prev) => prev.filter((p) => p.id !== id));
      } catch (err: any) {
        console.error("Erreur lors de la suppression:", err);
        setError("Impossible de supprimer le patient");
      }
    }
  };

  // Titre de la page selon le rôle
  const getPageTitle = () => {
    if (isMedecin) {
      return "Mes Patients";
    } else if (user && user.role === "secretaire") {
      return `Gestion des Patients`; // Titre générique pour secrétaire
    }
    return "Patients";
  };

  // Description selon le rôle
  const getPageDescription = () => {
    if (isMedecin) {
      return "Gérer les informations de vos patients";
    } else if (user && user.role === "secretaire") {
      return "Gérer les patients du cabinet"; // Même description que pour médecin
    }
    return "Consulter les patients";
  };

  // Calculer les statistiques de recherche
  const searchStats = {
    total: allPatients.length,
    filtered: filteredPatients.length,
    isSearching: searchTerm.trim().length > 0,
  };

  // Vérification d'autorisation
  if (!canViewPatients) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">
            Accès non autorisé
          </h3>
          <p className="mt-1 text-sm text-gray-500">
            Vous n'avez pas l'autorisation de voir cette page.
          </p>
        </div>
      </div>
    );
  }

  if (loading && allPatients.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header avec statistiques */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{getPageTitle()}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {searchStats.isSearching ? (
              <>
                {searchStats.filtered} résultat
                {searchStats.filtered !== 1 ? "s" : ""} sur {searchStats.total}{" "}
                patient{searchStats.total !== 1 ? "s" : ""}
              </>
            ) : (
              <>
                {getPageDescription()} ({searchStats.total} patient
                {searchStats.total !== 1 ? "s" : ""})
              </>
            )}
          </p>
        </div>
        {/* ✅ Médecins ET secrétaires peuvent ajouter des patients */}
        {canAddPatients && (
          <div className="mt-4 sm:mt-0">
            <Link
              to="/patients/nouveau"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 transition-colors"
            >
              <Plus className="h-4 w-4 mr-2" />
              Nouveau Patient
            </Link>
          </div>
        )}
      </div>

      {/* Barre de recherche améliorée */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 p-6">
        <div className="space-y-4">
          <div className="flex items-center space-x-2">
            <Users className="h-5 w-5 text-gray-400" />
            <h3 className="text-lg font-medium text-gray-900">
              Rechercher un patient
            </h3>
          </div>

          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Rechercher par nom, prénom, CIN ou téléphone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="block w-full pl-10 pr-10 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 text-sm"
            />
            {searchTerm && (
              <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
                <button
                  onClick={clearSearch}
                  className="text-gray-400 hover:text-gray-600 focus:outline-none"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            )}
          </div>

          {/* Indicateurs de recherche */}
          {searchStats.isSearching && (
            <div className="flex items-center justify-between text-sm">
              <div className="text-gray-600">
                <span className="font-medium text-blue-600">
                  {searchStats.filtered}
                </span>{" "}
                résultat{searchStats.filtered !== 1 ? "s" : ""} trouvé
                {searchStats.filtered !== 1 ? "s" : ""} pour "{searchTerm}"
              </div>
              {searchStats.filtered === 0 && (
                <div className="text-gray-500">
                  Essayez avec d'autres termes de recherche
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <ErrorMessage message={error} onDismiss={() => setError(null)} />
      )}

      {/* Patients List */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200 overflow-hidden">
        {filteredPatients.length === 0 ? (
          <div className="text-center py-12">
            {searchStats.isSearching ? (
              <>
                <Search className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  Aucun résultat trouvé
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Aucun patient ne correspond à votre recherche "{searchTerm}"
                </p>
                <div className="mt-6">
                  <button
                    onClick={clearSearch}
                    className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                  >
                    Voir tous les patients
                  </button>
                </div>
              </>
            ) : (
              <>
                <Users className="mx-auto h-12 w-12 text-gray-400" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">
                  Aucun patient
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                  Commencez par ajouter votre premier patient
                </p>
                {/* ✅ Médecins ET secrétaires voient le bouton d'ajout */}
                {canAddPatients && (
                  <div className="mt-6">
                    <Link
                      to="/patients/nouveau"
                      className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700"
                    >
                      <Plus className="h-4 w-4 mr-2" />
                      Ajouter le premier patient
                    </Link>
                  </div>
                )}
              </>
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
                    CIN
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Genre
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date de naissance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredPatients.map((patient, index) => {
                  // Mise en évidence des termes de recherche
                  const highlightText = (text: string) => {
                    if (!searchTerm.trim()) return text;

                    const regex = new RegExp(`(${searchTerm.trim()})`, "gi");
                    const parts = text.split(regex);

                    return parts.map((part, i) =>
                      regex.test(part) ? (
                        <mark key={i} className="bg-yellow-200 px-1 rounded">
                          {part}
                        </mark>
                      ) : (
                        part
                      ),
                    );
                  };

                  return (
                    <tr
                      key={patient.id || `patient-${index}`}
                      className="hover:bg-gray-50 transition-colors"
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {highlightText(`${patient.prenom} ${patient.nom}`)}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {highlightText(patient.cin)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {patient.genre === "M" ? "Masculin" : "Féminin"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(patient.date_naissance).toLocaleDateString(
                          "fr-FR",
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {patient.telephone
                          ? highlightText(patient.telephone)
                          : "-"}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center justify-end space-x-2">
                          <Link
                            to={`/patients/id/${patient.id}`}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded-full hover:bg-blue-50 transition-colors"
                            title="Voir les détails"
                          >
                            <Eye className="h-4 w-4" />
                          </Link>
                          {/* ✅ Médecins ET secrétaires peuvent modifier/supprimer */}
                          {canModifyPatients && (
                            <>
                              <Link
                                to={`/patients/id/${patient.id}/modifier`}
                                className="text-green-600 hover:text-green-900 p-1 rounded-full hover:bg-green-50 transition-colors"
                                title="Modifier le patient"
                              >
                                <Edit className="h-4 w-4" />
                              </Link>
                              <button
                                onClick={() =>
                                  patient.id && handleDelete(patient.id)
                                }
                                className="text-red-600 hover:text-red-900 p-1 rounded-full hover:bg-red-50 transition-colors"
                                title="Supprimer le patient"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </>
                          )}
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

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6 rounded-lg shadow-sm">
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
                Page <span className="font-medium">{currentPage}</span> sur{" "}
                <span className="font-medium">{totalPages}</span>
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
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
    </div>
  );
};

export default PatientsPage;
