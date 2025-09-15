import React, { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useForm, SubmitHandler } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { Activity, Eye, EyeOff } from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { LoginRequest } from "../types";
import LoadingSpinner from "../components/common/LoadingSpinner";
import ErrorMessage from "../components/common/ErrorMessage";

// Schema Yup avec email et password
const schema = yup
  .object({
    email: yup
      .string()
      .email("L'email doit être valide")
      .required("L'email est requis"),
    password: yup.string().required("Le mot de passe est requis"),
  })
  .required();

const LoginPage: React.FC = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { login, loading, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || null;

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginRequest>({
    resolver: yupResolver(schema),
  });

  // Fonction pour déterminer la redirection selon le rôle
  const getRedirectPath = (userRole: string) => {
    // IMPORTANT: Toujours rediriger selon le rôle, ignorer 'from' si incompatible
    switch (userRole) {
      case "admin":
        return "/admin/users"; // ou '/admin/dashboard' selon votre préférence
      case "medecin":
        return "/dashboard";
      case "secretaire":
        return "/dashboard";
      default:
        return "/dashboard";
    }
  };

  const onSubmit: SubmitHandler<LoginRequest> = async (data) => {
    try {
      setError(null);
      await login(data);

      // Attendre un peu pour que le user soit mis à jour dans le contexte
      setTimeout(() => {
        // Récupérer l'utilisateur depuis le localStorage si pas encore dans le contexte
        const currentUser =
          user || JSON.parse(localStorage.getItem("user") || "{}");
        const redirectPath = getRedirectPath(currentUser.role);

        console.log("User role:", currentUser.role);
        console.log("Redirect to:", redirectPath);

        // Toujours rediriger selon le rôle, pas selon 'from'
        navigate(redirectPath, { replace: true });
      }, 100);
    } catch (err: any) {
      if (err.response?.status === 401) {
        setError("Email ou mot de passe incorrect");
      } else if (err.response?.data?.detail) {
        setError(err.response.data.detail);
      } else {
        setError("Une erreur est survenue lors de la connexion");
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="bg-white rounded-xl shadow-lg p-8">
          {/* Header */}
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-16 w-16 rounded-full bg-blue-100 mb-4">
              <Activity className="h-8 w-8 text-blue-600" />
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              CHUConnect
            </h2>
            <p className="text-sm text-gray-600">
              Connectez-vous à votre compte
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <ErrorMessage
              message={error}
              onDismiss={() => setError(null)}
              className="mt-6"
            />
          )}

          {/* Form */}
          <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
            <div className="space-y-4">
              {/* Email */}
              <div>
                <label
                  htmlFor="email"
                  className="block text-sm font-medium text-gray-700"
                >
                  Email
                </label>
                <input
                  {...register("email")}
                  type="email"
                  autoComplete="email"
                  id="email"
                  className="mt-1 appearance-none rounded-lg relative block w-full px-3 py-2 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                  placeholder="Votre email"
                />
                {errors.email && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.email.message}
                  </p>
                )}
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="block text-sm font-medium text-gray-700"
                >
                  Mot de passe
                </label>
                <div className="mt-1 relative">
                  <input
                    {...register("password")}
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    id="password"
                    className="appearance-none rounded-lg relative block w-full px-3 py-2 pr-10 border border-gray-300 placeholder-gray-500 text-gray-900 focus:outline-none focus:ring-blue-500 focus:border-blue-500 focus:z-10 sm:text-sm"
                    placeholder="Votre mot de passe"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    aria-label={
                      showPassword
                        ? "Masquer le mot de passe"
                        : "Afficher le mot de passe"
                    }
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-gray-400" />
                    ) : (
                      <Eye className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.password.message}
                  </p>
                )}
              </div>
            </div>

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={isSubmitting || loading}
                className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting || loading ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Connexion...
                  </>
                ) : (
                  "Se connecter"
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
