import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Eye,
  EyeOff,
  Shield,
} from "lucide-react";
import { User, CreateUserData } from "../types";
import { userService } from "../services/api";

interface EditingUser extends User {
  password?: string;
}

const AdminUsers: React.FC = () => {
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingUser, setEditingUser] = useState<EditingUser | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newUser, setNewUser] = useState<CreateUserData>({
    nom: "",
    email: "",
    password: "",
    role: "medecin",
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);

      // Récupérer les vraies données depuis l'API
      const data = await userService.getAll();
      console.log("Raw data from API:", data);

      // Nettoyer et filtrer les données
      const validUsers = data
        .map((user) => {
          // Corriger le problème _id vs id si nécessaire
          if (user._id && !user.id) {
            return {
              ...user,
              id: user._id,
              _id: undefined,
            };
          }
          return user;
        })
        .filter(
          (user) =>
            user &&
            typeof user === "object" &&
            user.id &&
            user.nom &&
            user.email &&
            user.role &&
            user.role !== "admin", // Exclure les admins
        );

      console.log("Valid users after filtering:", validUsers);
      setUsers(validUsers);
    } catch (err: any) {
      console.error("API Error:", err);
      if (err.response?.status === 403) {
        setError(
          "Accès interdit. Vous devez être administrateur pour voir cette page.",
        );
      } else if (err.response?.status === 401) {
        setError("Non autorisé. Veuillez vous reconnecter.");
      } else {
        setError(
          "Erreur lors du chargement des utilisateurs. Vérifiez votre connexion.",
        );
      }
      setUsers([]);
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (user: User) => {
    // Inclure le medecin_id dans les données d'édition si disponible
    const userWithMedecinId = {
      ...user,
      password: "",
      medecin_id: "medecin_id" in user ? user.medecin_id : undefined,
    };
    setEditingUser(userWithMedecinId as EditingUser);
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingUser(null);
    setError(null);
  };

  const handleSaveEdit = async () => {
    if (!editingUser) return;

    try {
      setError(null);

      // Préparer les données selon le rôle
      const updateData: any = {
        nom: editingUser.nom,
        email: editingUser.email,
        role: editingUser.role,
      };

      // ✅ SOLUTION : Toujours envoyer un password
      if (
        (editingUser as any).changePassword &&
        editingUser.password &&
        editingUser.password.trim() !== ""
      ) {
        // L'admin veut changer le mot de passe - envoyer le nouveau
        updateData.password = editingUser.password;
      } else {
        // L'admin ne veut pas changer le mot de passe - envoyer une chaîne vide
        // Le backend gardera l'ancien mot de passe grâce à cette ligne :
        // update_dict["password"] = existing_user["password"]
        updateData.password = ""; // ou updateData.password = " ";
      }

      // Gérer medecin_id selon le rôle
      if (editingUser.role === "secretaire") {
        // Pour les secrétaires, utiliser le medecin_id sélectionné ou l'ancien
        const selectedMedecinId = (editingUser as any).medecin_id;
        const originalUser = users.find((u) => u.id === editingUser.id);
        const originalMedecinId =
          originalUser && "medecin_id" in originalUser
            ? originalUser.medecin_id
            : null;

        const medecinId = selectedMedecinId || originalMedecinId;

        if (!medecinId) {
          setError("Veuillez sélectionner un médecin pour ce secrétaire");
          return;
        }

        updateData.medecin_id = medecinId;
      } else {
        // Pour les médecins, medecin_id doit être null
        updateData.medecin_id = null;
      }

      console.log("Sending update data:", updateData);

      // Appeler l'API pour mettre à jour l'utilisateur
      const updatedUser = await userService.update(editingUser.id, updateData);
      console.log("Updated user from API:", updatedUser);

      // Nettoyer les données reçues (même logique que fetchUsers)
      const cleanUpdatedUser = {
        ...updatedUser,
        id: updatedUser._id ? updatedUser._id : updatedUser.id,
      };
      if (cleanUpdatedUser._id) {
        delete cleanUpdatedUser._id;
      }

      // Mettre à jour l'état local seulement si ce n'est pas un admin
      if (cleanUpdatedUser.role !== "admin") {
        setUsers((prev) =>
          prev.map((user) =>
            user.id === editingUser.id ? cleanUpdatedUser : user,
          ),
        );
      } else {
        // Si l'utilisateur est devenu admin, le retirer de la liste
        setUsers((prev) => prev.filter((user) => user.id !== editingUser.id));
      }

      setEditingUser(null);
      alert("Utilisateur mis à jour avec succès");
    } catch (err: any) {
      console.error("Update error:", err);
      console.error("Error response:", err.response?.data);

      if (err.response?.data?.detail) {
        if (Array.isArray(err.response.data.detail)) {
          // Erreurs de validation Pydantic
          const errorMessages = err.response.data.detail
            .map((error: any) => `${error.loc?.join(".")}: ${error.msg}`)
            .join(", ");
          setError(`Erreur de validation: ${errorMessages}`);
        } else {
          setError(`Erreur: ${err.response.data.detail}`);
        }
      } else {
        setError("Erreur lors de la mise à jour");
      }
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer cet utilisateur ?")) {
      return;
    }

    try {
      setError(null);

      // Appeler l'API pour supprimer l'utilisateur
      await userService.delete(userId);

      // Mettre à jour l'état local
      setUsers((prev) => prev.filter((user) => user.id !== userId));
      alert("Utilisateur supprimé avec succès");
    } catch (err: any) {
      console.error("Delete error:", err);
      if (err.response?.data?.detail) {
        setError(`Erreur: ${err.response.data.detail}`);
      } else {
        setError("Erreur lors de la suppression");
      }
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      setError(null);

      // Appeler l'API pour créer l'utilisateur
      const createdUser = await userService.create(newUser);

      // Ajouter à l'état local seulement si ce n'est pas un admin
      if (createdUser.role !== "admin") {
        setUsers((prev) => [...prev, createdUser]);
      }

      // Réinitialiser le formulaire
      setNewUser({ nom: "", email: "", password: "", role: "medecin" });
      setShowAddForm(false);
      alert("Utilisateur créé avec succès");
    } catch (err: any) {
      console.error("Create error:", err);
      if (err.response?.data?.detail) {
        setError(`Erreur: ${err.response.data.detail}`);
      } else {
        setError(
          err instanceof Error ? err.message : "Erreur lors de la création",
        );
      }
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800";
      case "medecin":
        return "bg-blue-100 text-blue-800";
      case "secretaire":
        return "bg-green-100 text-green-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case "admin":
        return "Administrateur";
      case "medecin":
        return "Médecin";
      case "secretaire":
        return "Secrétaire";
      default:
        return role;
    }
  };

  if (loading) {
    return (
      <div className="bg-gray-50 py-8 px-4 min-h-96 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-red-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Chargement des utilisateurs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mr-4">
                <Shield className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  Administration des Utilisateurs
                </h1>
                <p className="text-gray-600">
                  Gérer les médecins et secrétaires
                </p>
              </div>
            </div>

            <div className="flex gap-4">
              <button
                onClick={() => setShowAddForm(true)}
                className="flex items-center px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors shadow-sm"
              >
                <Plus className="w-5 h-5 mr-2" />
                Ajouter un utilisateur
              </button>
              <button
                onClick={() => navigate("/admin/dashboard")}
                className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
              >
                Retour au dashboard
              </button>
            </div>
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-700 text-sm">{error}</p>
            <button
              onClick={() => setError(null)}
              className="mt-2 text-red-600 hover:text-red-800 text-sm underline"
            >
              Fermer
            </button>
          </div>
        )}

        {/* Add User Form Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
              <div className="p-6 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold text-gray-900">
                    Ajouter un utilisateur
                  </h3>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <form onSubmit={handleAddUser} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Nom complet *
                  </label>
                  <input
                    type="text"
                    value={newUser.nom}
                    onChange={(e) =>
                      setNewUser((prev) => ({ ...prev, nom: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email *
                  </label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) =>
                      setNewUser((prev) => ({ ...prev, email: e.target.value }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Mot de passe *
                  </label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={newUser.password}
                      onChange={(e) =>
                        setNewUser((prev) => ({
                          ...prev,
                          password: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 pr-10 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Rôle *
                  </label>
                  <select
                    value={newUser.role}
                    onChange={(e) =>
                      setNewUser((prev) => ({
                        ...prev,
                        role: e.target.value as "medecin" | "secretaire",
                      }))
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                    required
                  >
                    <option value="medecin">Médecin</option>
                    <option value="secretaire">Secrétaire</option>
                  </select>
                </div>

                {/* Sélection du médecin si c'est un secrétaire */}
                {newUser.role === "secretaire" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Médecin associé *
                    </label>
                    <select
                      value={(newUser as any).medecin_id || ""}
                      onChange={(e) =>
                        setNewUser((prev) => ({
                          ...prev,
                          medecin_id: e.target.value,
                        }))
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent"
                      required={newUser.role === "secretaire"}
                    >
                      <option value="">Sélectionner un médecin</option>
                      {users
                        .filter((u) => u.role === "medecin")
                        .map((medecin) => (
                          <option key={medecin.id} value={medecin.id}>
                            {medecin.nom}
                          </option>
                        ))}
                    </select>
                  </div>
                )}

                <div className="flex gap-3 pt-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                  >
                    Créer
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Annuler
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Users Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center">
              <Users className="w-6 h-6 text-red-600 mr-3" />
              <h2 className="text-xl font-semibold text-gray-900">
                Liste des Utilisateurs ({users.length})
              </h2>
            </div>
          </div>

          {users.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Utilisateur
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Email
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Rôle
                    </th>
                    {/* <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date de création
                    </th> */}
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users
                    .map((user, index) => {
                      // Protection robuste contre les données nulles
                      if (!user || !user.id || !user.nom || !user.email) {
                        console.warn("Invalid user data skipped:", user);
                        return null;
                      }

                      return (
                        <tr
                          key={user.id}
                          className={
                            index % 2 === 0 ? "bg-white" : "bg-gray-50"
                          }
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            {editingUser?.id === user.id ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={editingUser.nom || ""}
                                  onChange={(e) =>
                                    setEditingUser((prev) =>
                                      prev
                                        ? { ...prev, nom: e.target.value }
                                        : null,
                                    )
                                  }
                                  className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                />
                                <div className="text-xs">
                                  <label className="flex items-center">
                                    <input
                                      type="checkbox"
                                      checked={
                                        (editingUser as any).changePassword ||
                                        false
                                      }
                                      onChange={(e) =>
                                        setEditingUser((prev) =>
                                          prev
                                            ? {
                                                ...prev,
                                                changePassword:
                                                  e.target.checked,
                                                password: e.target.checked
                                                  ? prev.password
                                                  : "",
                                              }
                                            : null,
                                        )
                                      }
                                      className="mr-2"
                                    />
                                    Changer le mot de passe
                                  </label>
                                </div>
                                {(editingUser as any).changePassword && (
                                  <input
                                    type="password"
                                    placeholder="Nouveau mot de passe"
                                    value={editingUser.password || ""}
                                    onChange={(e) =>
                                      setEditingUser((prev) =>
                                        prev
                                          ? {
                                              ...prev,
                                              password: e.target.value,
                                            }
                                          : null,
                                      )
                                    }
                                    className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-transparent text-xs"
                                  />
                                )}
                              </div>
                            ) : (
                              <div className="text-sm font-medium text-gray-900">
                                {user.nom}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {editingUser?.id === user.id ? (
                              <input
                                type="email"
                                value={editingUser.email || ""}
                                onChange={(e) =>
                                  setEditingUser((prev) =>
                                    prev
                                      ? { ...prev, email: e.target.value }
                                      : null,
                                  )
                                }
                                className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-transparent"
                              />
                            ) : (
                              <div className="text-sm text-gray-900">
                                {user.email}
                              </div>
                            )}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            {editingUser?.id === user.id ? (
                              <div className="space-y-2">
                                <select
                                  value={editingUser.role || "medecin"}
                                  onChange={(e) =>
                                    setEditingUser((prev) =>
                                      prev
                                        ? {
                                            ...prev,
                                            role: e.target.value as
                                              | "medecin"
                                              | "secretaire",
                                          }
                                        : null,
                                    )
                                  }
                                  className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-transparent"
                                >
                                  <option value="medecin">Médecin</option>
                                  <option value="secretaire">Secrétaire</option>
                                </select>

                                {/* Sélection du médecin si c'est un secrétaire */}
                                {/* {editingUser.role === 'secretaire' && (
                                <select
                                  value={(() => {
                                    // Récupérer le medecin_id de l'utilisateur original ou de l'editing
                                    const originalUser = users.find(u => u.id === editingUser.id);
                                    const currentMedecinId = (editingUser as any).medecin_id || 
                                                           (originalUser && 'medecin_id' in originalUser ? originalUser.medecin_id : '');
                                    return currentMedecinId || '';
                                  })()}
                                  onChange={(e) => {
                                    setEditingUser(prev => prev ? { ...prev, medecin_id: e.target.value } : null);
                                  }}
                                  className="w-full px-2 py-1 border border-gray-300 rounded focus:ring-2 focus:ring-red-500 focus:border-transparent text-xs"
                                >
                                  <option value="">Sélectionner un médecin</option>
                                  {users.filter(u => u.role === 'medecin').map(medecin => (
                                    <option key={medecin.id} value={medecin.id}>
                                      {medecin.nom}
                                    </option>
                                  ))}
                                </select>
                              )} */}
                              </div>
                            ) : (
                              <div className="space-y-1">
                                <span
                                  className={`px-2 py-1 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}
                                >
                                  {getRoleText(user.role)}
                                </span>
                                {/* Afficher le médecin associé pour les secrétaires */}
                                {user.role === "secretaire" &&
                                  "medecin_id" in user &&
                                  user.medecin_id && (
                                    <div className="text-xs text-gray-500">
                                      Médecin:{" "}
                                      {(() => {
                                        const medecin = users.find(
                                          (u) => u.id === user.medecin_id,
                                        );
                                        return medecin
                                          ? medecin.nom
                                          : "Médecin introuvable";
                                      })()}
                                    </div>
                                  )}
                              </div>
                            )}
                          </td>
                          {/* <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {user.created_at ? new Date(user.created_at).toLocaleDateString('fr-FR') : 'N/A'}
                        </td> */}
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                            {editingUser?.id === user.id ? (
                              <div className="flex gap-2">
                                <button
                                  onClick={handleSaveEdit}
                                  className="text-green-600 hover:text-green-800 transition-colors"
                                  title="Sauvegarder"
                                >
                                  <Save className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  className="text-gray-600 hover:text-gray-800 transition-colors"
                                  title="Annuler"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleEdit(user)}
                                  className="text-red-600 hover:text-red-800 transition-colors"
                                  title="Modifier"
                                >
                                  <Edit className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => handleDelete(user.id)}
                                  className="text-red-600 hover:text-red-800 transition-colors"
                                  title="Supprimer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })
                    .filter(Boolean)}{" "}
                  {/* Filtrer les éléments null */}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="p-12 text-center">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">
                {error
                  ? "Impossible de charger les utilisateurs"
                  : "Aucun utilisateur trouvé"}
              </p>
              {error && (
                <button
                  onClick={fetchUsers}
                  className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  Réessayer
                </button>
              )}
            </div>
          )}
        </div>

        {/* Stats Cards */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center mr-4">
                <Users className="w-5 h-5 text-gray-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Total</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mr-4">
                <Users className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Médecins</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter((u) => u.role === "medecin").length}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-4">
                <Users className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-gray-600">Secrétaires</p>
                <p className="text-2xl font-bold text-gray-900">
                  {users.filter((u) => u.role === "secretaire").length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminUsers;
