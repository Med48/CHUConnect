import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Save, UserPlus, Eye, EyeOff } from "lucide-react";
import { userService } from "../services/api";
import { CreateUserData } from "../types";
import { useAuth } from "../contexts/AuthContext"; // ✅ Ajouter cet import

const AddUser: React.FC = () => {
  const navigate = useNavigate();
  const { user: currentUser } = useAuth(); // ✅ Récupérer l'utilisateur connecté
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [formData, setFormData] = useState<CreateUserData>({
    nom: "",
    email: "",
    password: "",
    role: "secretaire",
    medecin_id: "", // Sera rempli automatiquement
  });
  const [error, setError] = useState<string | null>(null);

  // ✅ Effet pour assigner automatiquement l'ID du médecin connecté
  useEffect(() => {
    console.log("Médecin connecté:", currentUser); // Debug
    console.log("Structure complète:", JSON.stringify(currentUser, null, 2)); // ✅ Debug détaillé

    if (currentUser) {
      // ✅ Vérifier différentes propriétés possibles pour l'ID
      const userId = currentUser.id || currentUser._id || currentUser.user_id;
      console.log("ID trouvé:", userId); // Debug

      if (userId) {
        setFormData((prev) => ({
          ...prev,
          medecin_id: userId,
        }));
        setError(null); // ✅ Effacer l'erreur si ID trouvé
      } else {
        console.log("ID non trouvé dans:", Object.keys(currentUser));
        setError(
          "Erreur: ID du médecin non trouvé dans les données utilisateur",
        );
      }
    } else {
      console.log("Aucun utilisateur connecté");
      setError(
        "Erreur: Impossible de récupérer les informations du médecin connecté",
      );
    }
  }, [currentUser]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    // Clear error when user starts typing
    if (error) setError(null);
  };

  const validateForm = () => {
    if (!formData.nom.trim()) {
      setError("Le nom est obligatoire");
      return false;
    }
    if (!formData.email.trim()) {
      setError("L'email est obligatoire");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      setError("Format d'email invalide");
      return false;
    }
    if (!formData.password) {
      setError("Le mot de passe est obligatoire");
      return false;
    }
    if (formData.password.length < 6) {
      setError("Le mot de passe doit contenir au moins 6 caractères");
      return false;
    }
    // ✅ Vérifier que medecin_id est présent
    if (!formData.medecin_id) {
      setError("Erreur: ID du médecin manquant. Veuillez vous reconnecter.");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) return;

    try {
      setLoading(true);
      setError(null);

      // ✅ Debug: Afficher les données envoyées
      console.log("Données envoyées:", formData);

      await userService.create(formData);

      // Redirection vers la page d'accueil ou liste des utilisateurs
      navigate("/");
    } catch (err) {
      console.error("Erreur complète:", err);
      setError(
        err instanceof Error
          ? err.message
          : "Erreur lors de la création de l'utilisateur",
      );
    } finally {
      setLoading(false);
    }
  };

  // ✅ Inclure medecin_id dans la validation du formulaire
  const isFormValid =
    formData.nom &&
    formData.email &&
    formData.password &&
    formData.role &&
    formData.medecin_id && // ✅ S'assurer que medecin_id est présent
    currentUser; // ✅ S'assurer que l'utilisateur est connecté

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center text-gray-600 hover:text-gray-800 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Retour à l'accueil
          </button>
          <div className="flex items-center">
            <div className="w-12 h-12 bg-purple-100 rounded-full flex items-center justify-center mr-4">
              <UserPlus className="w-6 h-6 text-purple-600" />
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
              Ajouter Secrétaire
            </h1>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 text-sm">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label
                htmlFor="nom"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Nom complet *
              </label>
              <input
                type="text"
                id="nom"
                name="nom"
                value={formData.nom}
                onChange={handleInputChange}
                placeholder="Ex: Marie Dupont"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
              />
            </div>

            {/* Email */}
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Adresse email *
              </label>
              <input
                type="email"
                id="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="exemple@clinic.fr"
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
              />
            </div>

            {/* Mot de passe */}
            <div>
              <label
                htmlFor="password"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Mot de passe *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  placeholder="Minimum 6 caractères"
                  required
                  className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700 transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <Eye className="w-5 h-5" />
                  )}
                </button>
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Le mot de passe doit contenir au moins 6 caractères
              </p>
            </div>

            {/* Rôle */}
            <div>
              <label
                htmlFor="role"
                className="block text-sm font-medium text-gray-700 mb-2"
              >
                Rôle *
              </label>
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent transition-colors"
              >
                <option value="secretaire">Secrétaire</option>
              </select>
            </div>

            {/* ✅ Médecin associé - Affichage informatif */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Médecin associé
              </label>
              <div className="w-full px-4 py-3 border border-gray-200 rounded-lg bg-gray-50">
                {currentUser ? (
                  <p className="text-gray-700">
                    <span className="font-medium">Dr. {currentUser.nom}</span>
                    <span className="text-gray-500 ml-2">
                      ({currentUser.email})
                    </span>
                  </p>
                ) : (
                  <p className="text-gray-500">Chargement...</p>
                )}
              </div>
              <p className="mt-1 text-sm text-gray-500">
                Ce secrétaire sera automatiquement associé à votre compte
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <button
                type="submit"
                disabled={!isFormValid || loading}
                className="flex items-center justify-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors shadow-sm"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                ) : (
                  <Save className="w-5 h-5 mr-2" />
                )}
                {loading ? "Création..." : "Créer Secrétaire"}
              </button>

              <button
                type="button"
                onClick={() => navigate("/")}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AddUser;
