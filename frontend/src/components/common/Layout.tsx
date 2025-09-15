import React, { ReactNode } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import {
  User,
  LogOut,
  Users,
  UserPlus,
  CalendarIcon,
  Calendar,
  FileText,
  Activity,
  Menu,
  X,
  Shield,
  MessageSquare,
} from "lucide-react";
import { useState } from "react";

interface LayoutProps {
  children: ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const { user, logout, isMedecin, isAdmin, isSecretaire } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // Fonction pour obtenir les éléments de navigation selon le rôle
  const getNavigationItems = () => {
    if (isAdmin) {
      return [
        {
          name: "Dashboard Admin",
          href: "/admin/dashboard",
          icon: Activity,
        },
        {
          name: "Gestion Utilisateurs",
          href: "/admin/users",
          icon: Users,
        },
      ];
    }

    if (isMedecin) {
      return [
        {
          name: "Tableau de bord",
          href: "/dashboard",
          icon: Activity,
        },
        {
          name: "Patients",
          href: "/patients",
          icon: Users,
        },
        {
          name: "Consultations",
          href: "/consultations",
          icon: FileText,
        },
        {
          name: "Rendez-vous",
          href: "/rendez-vous",
          icon: Calendar,
        },
        {
          name: "Calendrier",
          href: "/calendar",
          icon: CalendarIcon,
        },
        {
          name: "Ajouter Secrétaire",
          href: "/users/nouveau",
          icon: UserPlus,
        },
      ];
    }

    if (isSecretaire) {
      return [
        {
          name: "Tableau de bord",
          href: "/dashboard",
          icon: Activity,
        },
        {
          name: "Patients",
          href: "/patients",
          icon: Users,
        },
        {
          name: "Rendez-vous",
          href: "/rendez-vous",
          icon: Calendar,
        },
        {
          name: "Calendrier",
          href: "/calendar",
          icon: CalendarIcon,
        },
      ];
    }

    return [];
  };

  const navigationItems = getNavigationItems();

  // Fonction pour obtenir le titre selon le rôle
  const getAppTitle = () => {
    if (isAdmin) return "CHU Admin";
    if (isMedecin) return `Dr. ${user?.nom || 'Médecin'}`;
    if (isSecretaire) return `Sc. ${user?.nom}`;
    return "CHU Connect"; // Fallback pour autres cas
  };

  // Fonction pour obtenir la couleur de l'icône selon le rôle
  const getIconColor = () => {
    if (isAdmin) return "text-red-600";
    if (isMedecin) return "text-blue-600";
    if (isSecretaire) return "text-green-600";
    return "text-blue-600";
  };

  // Fonction pour obtenir la couleur active selon le rôle
  const getActiveColor = () => {
    if (isAdmin) return "bg-red-100 text-red-700";
    if (isMedecin) return "bg-blue-100 text-blue-700";
    if (isSecretaire) return "bg-green-100 text-green-700";
    return "bg-blue-100 text-blue-700";
  };

  // Fonction pour obtenir l'icône du rôle
  const getRoleIcon = () => {
    if (isAdmin) return Shield;
    return User;
  };

  const RoleIcon = getRoleIcon();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation mobile */}
      <div className="lg:hidden">
        <div className="flex items-center justify-between bg-white px-4 py-3 shadow-sm">
          <div className="flex items-center space-x-2">
            {isAdmin ? (
              <Shield className={`h-6 w-6 ${getIconColor()}`} />
            ) : (
              <Activity className={`h-6 w-6 ${getIconColor()}`} />
            )}
            <span className="text-lg font-semibold text-gray-900">
              {getAppTitle()}
            </span>
          </div>
          <button
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
            className="rounded-md p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-500"
          >
            {isMobileMenuOpen ? (
              <X className="h-6 w-6" />
            ) : (
              <Menu className="h-6 w-6" />
            )}
          </button>
        </div>

        {/* Menu mobile */}
        {isMobileMenuOpen && (
          <div className="bg-white shadow-lg">
            <nav className="px-4 py-2">
              {navigationItems.map((item) => {
                const Icon = item.icon;
                const isActive = location.pathname === item.href;
                return (
                  <Link
                    key={item.name}
                    to={item.href}
                    onClick={() => setIsMobileMenuOpen(false)}
                    className={`flex items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                      isActive
                        ? getActiveColor()
                        : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    <span>{item.name}</span>
                  </Link>
                );
              })}
              <div className="border-t border-gray-200 pt-2 mt-2">
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center space-x-3 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                >
                  <LogOut className="h-5 w-5" />
                  <span>Déconnexion</span>
                </button>
              </div>
            </nav>
          </div>
        )}
      </div>

      <div className="hidden lg:flex h-screen">
        {/* Sidebar */}
        <div className="flex flex-col w-64 bg-white shadow-lg">
          {/* Logo */}
          <div className="flex items-center px-6 py-4 border-b border-gray-200">
            {isAdmin ? (
              <Shield className={`h-8 w-8 ${getIconColor()}`} />
            ) : (
              <Activity className={`h-8 w-8 ${getIconColor()}`} />
            )}
            <span className="ml-2 text-xl font-bold text-gray-900">
              {getAppTitle()}
            </span>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-2">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center space-x-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                    isActive
                      ? getActiveColor()
                      : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                  }`}
                >
                  <Icon className="h-5 w-5" />
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>

          {/* User info */}
          <div className="border-t border-gray-200 p-4">
            <div className="flex items-center space-x-3 mb-3">
              <div className="flex-shrink-0">
                <div
                  className={`flex items-center justify-center w-8 h-8 rounded-full ${
                    isAdmin
                      ? "bg-red-100"
                      : isMedecin
                        ? "bg-blue-100"
                        : "bg-green-100"
                  }`}
                >
                  <RoleIcon className={`h-4 w-4 ${getIconColor()}`} />
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {user?.nom}
                </p>
                <p className="text-xs text-gray-500 capitalize flex items-center">
                  {isAdmin && <Shield className="h-3 w-3 mr-1" />}
                  {user?.role === "admin"
                    ? "Administrateur"
                    : user?.role === "medecin"
                      ? "Médecin"
                      : "Secrétaire"}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="flex w-full items-center space-x-2 rounded-md px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <LogOut className="h-4 w-4" />
              <span>Déconnexion</span>
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-auto">
          <main className="p-6">{children}</main>
        </div>
      </div>

      {/* Main content pour mobile */}
      <div className="lg:hidden">
        <main className="p-4">{children}</main>
      </div>
    </div>
  );
};

export default Layout;
