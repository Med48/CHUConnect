import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { User } from "../../types";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: User["role"][];
}

const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedRoles,
}) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // ✅ CORRECTION : Rediriger vers la page par défaut du rôle au lieu d'afficher une erreur
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Déterminer la page par défaut selon le rôle de l'utilisateur
    let defaultPath = "/dashboard";

    switch (user.role) {
      case "admin":
        defaultPath = "/admin/users";
        break;
      case "medecin":
        defaultPath = "/dashboard";
        break;
      case "secretaire":
        defaultPath = "/dashboard";
        break;
      default:
        defaultPath = "/dashboard";
    }

    console.log(
      `Accès refusé à ${location.pathname} pour ${user.role}, redirection vers ${defaultPath}`,
    );
    return <Navigate to={defaultPath} replace />;
  }

  return <>{children}</>;
};

export default ProtectedRoute;
