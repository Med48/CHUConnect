import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";
import { User, LoginRequest } from "../types";
import { authApi } from "../services/api";
// ❌ Retirez cette ligne :
// import { useNavigate } from 'react-router-dom';

interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isMedecin: boolean;
  isSecretaire: boolean;
  isAdmin: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  // ❌ Retirez cette ligne qui cause l'erreur :
  // const navigate = useNavigate();

  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Initialisation : vérifier si un token existe au démarrage
  useEffect(() => {
    const initAuth = async () => {
      try {
        const savedToken = localStorage.getItem("access_token");

        if (savedToken) {
          setToken(savedToken);

          // Toujours vérifier avec le backend, ne pas faire confiance au localStorage
          try {
            const currentUser = await authApi.getCurrentUser();
            setUser(currentUser);
            localStorage.setItem("user", JSON.stringify(currentUser));
          } catch (error) {
            console.error("Token invalide:", error);
            logout();
          }
        }
      } catch (error) {
        console.error("Erreur lors de l'initialisation:", error);
        logout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, []);

  const login = async (credentials: LoginRequest) => {
    try {
      setLoading(true);
      const response = await authApi.login(credentials);

      // 1. Stocker d'abord le token
      localStorage.setItem("access_token", response.access_token);
      setToken(response.access_token);

      // 2. Récupérer les données complètes de l'utilisateur
      const currentUser = await authApi.getCurrentUser();

      // 3. Stocker l'utilisateur complet
      localStorage.setItem("user", JSON.stringify(currentUser));
      setUser(currentUser);
    } catch (error) {
      // En cas d'erreur, nettoyer le localStorage
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      console.error("Erreur de connexion:", error);
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    authApi.logout();
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
    setToken(null);
    setUser(null);

    // ✅ Remplacez navigate() par window.location.href
    window.location.href = "/login";
  };

  const value: AuthContextType = {
    user,
    token,
    loading,
    login,
    logout,
    isAuthenticated: !!user && !!token,
    isMedecin: user?.role === "medecin",
    isSecretaire: user?.role === "secretaire",
    isAdmin: user?.role === "admin",
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
