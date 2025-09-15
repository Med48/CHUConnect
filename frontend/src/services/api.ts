import axios, { AxiosResponse, AxiosError } from "axios";
import { CalendarAppointment } from "../types"; // Ajustez le chemin selon votre structure
import type {
  User,
  LoginRequest,
  LoginResponse,
  Patient,
  Consultation,
  RendezVous,
  ApiError,
  PaginatedResponse,
  CreateUserData,
} from "../types";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("access_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  },
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("user");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  },
);

export const authApi = {
  login: async (credentials: LoginRequest): Promise<LoginResponse> => {
    const response: AxiosResponse<LoginResponse> = await api.post(
      "/auth/login",
      {
        email: credentials.email, // <-- envoyer email ici
        password: credentials.password,
      },
    );
    return response.data;
  },

  getCurrentUser: async (): Promise<User> => {
    const token = localStorage.getItem("access_token");
    if (!token) throw new Error("Token manquant");

    const response: AxiosResponse<User> = await api.get("/users/me", {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    return response.data;
  },

  logout: () => {
    localStorage.removeItem("access_token");
    localStorage.removeItem("user");
  },
};

export const patientsApi = {
  getAll: async (page = 1, size = 10): Promise<PaginatedResponse<Patient>> => {
    const response: AxiosResponse<PaginatedResponse<Patient>> = await api.get(
      `/patients?page=${page}&size=${size}`,
    );
    return response.data;
  },

  getById: async (id: string): Promise<Patient> => {
    // Changez number en string
    const response: AxiosResponse<Patient> = await api.get(
      `/patients/id/${id}`,
    ); // Ajoutez /id/
    return response.data;
  },

  getByCin: async (cin: string): Promise<Patient> => {
    const response: AxiosResponse<Patient> = await api.get(
      `/patients/cin/${cin}`,
    );
    return response.data;
  },

  create: async (
    patient: Omit<Patient, "id" | "created_at" | "updated_at">,
  ): Promise<Patient> => {
    const response: AxiosResponse<Patient> = await api.post(
      "/patients",
      patient,
    );
    return response.data;
  },

  update: async (id: string, patient: Partial<Patient>): Promise<Patient> => {
    console.log("🔧 API update appelé avec ID:", id); // Debug temporaire
    const response: AxiosResponse<Patient> = await api.put(
      `/patients/id/${id}`,
      patient,
    );
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    // Changez number en string
    await api.delete(`/patients/id/${id}`); // Ajoutez /id/
  },

  search: async (query: string): Promise<Patient[]> => {
    const response: AxiosResponse<Patient[]> = await api.get(
      `/patients/search?q=${encodeURIComponent(query)}`,
    );
    return response.data;
  },

  // NOUVELLES FONCTIONS À AJOUTER :
  getPatientConsultations: async (
    patientId: string,
  ): Promise<Consultation[]> => {
    const response: AxiosResponse<Consultation[]> = await api.get(
      `/patients/id/${patientId}/consultations`,
    );
    return response.data;
  },

  getPatientAppointments: async (patientId: string): Promise<RendezVous[]> => {
    const response: AxiosResponse<RendezVous[]> = await api.get(
      `/patients/id/${patientId}/appointments`,
    );
    return response.data;
  },

  // ✅ Nouvelle méthode pour récupérer les patients d'un médecin spécifique
  getByMedecin: async (
    medecinId: string,
    page: number = 1,
    limit: number = 50,
  ) => {
    const response = await fetch(
      `${API_BASE_URL}/patients/medecin/${medecinId}?page=${page}&limit=${limit}`,
      {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("access_token")}`, // Ajustez selon votre méthode d'auth
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || `Erreur ${response.status}`);
    }

    return response.json();
  },

  async uploadPhoto(
    patientId: string,
    photo: File,
  ): Promise<{ message: string; photo_url: string; file_id: string }> {
    const formData = new FormData();
    formData.append("photo", photo);

    // ✅ URL CORRIGÉE avec /id/
    const response = await fetch(
      `${API_BASE_URL}/patients/id/${patientId}/photo`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
        },
        body: formData,
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || "Erreur lors de l'upload de la photo",
      );
    }

    return response.json();
  },

  // Méthode pour obtenir l'URL de la photo
  getPhotoUrl(patientId: string): string {
    // ✅ URL CORRIGÉE avec /id/
    return `${API_BASE_URL}/patients/id/${patientId}/photo`;
  },

  // Méthode pour supprimer une photo
  async deletePhoto(patientId: string): Promise<{ message: string }> {
    // ✅ URL CORRIGÉE avec /id/
    const response = await fetch(
      `${API_BASE_URL}/patients/id/${patientId}/photo`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${getAuthToken()}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.detail || "Erreur lors de la suppression de la photo",
      );
    }

    return response.json();
  },

  // Méthode pour vérifier si une photo existe
  async hasPhoto(patientId: string): Promise<boolean> {
    try {
      // ✅ URL CORRIGÉE avec /id/
      const response = await fetch(
        `${API_BASE_URL}/patients/id/${patientId}/photo`,
        {
          method: "HEAD",
          headers: {
            Authorization: `Bearer ${getAuthToken()}`,
          },
        },
      );
      return response.ok;
    } catch {
      return false;
    }
  },
};

export const consultationsApi = {
  getAll: async (
    page = 1,
    size = 10,
  ): Promise<PaginatedResponse<Consultation>> => {
    const response: AxiosResponse<PaginatedResponse<Consultation>> =
      await api.get(`/consultations?page=${page}&size=${size}`);
    return response.data;
  },

  getByPatient: async (patientId: number): Promise<Consultation[]> => {
    const response: AxiosResponse<Consultation[]> = await api.get(
      `/consultations/patient/${patientId}`,
    );
    return response.data;
  },

  getById: async (id: number): Promise<Consultation> => {
    const response: AxiosResponse<Consultation> = await api.get(
      `/consultations/${id}`,
    );
    return response.data;
  },

  create: async (
    consultation: Omit<Consultation, "id" | "created_at" | "updated_at">,
  ): Promise<Consultation> => {
    const response: AxiosResponse<Consultation> = await api.post(
      "/consultations",
      consultation,
    );
    return response.data;
  },

  update: async (
    id: number,
    consultation: Partial<Consultation>,
  ): Promise<Consultation> => {
    const response: AxiosResponse<Consultation> = await api.put(
      `/consultations/${id}`,
      consultation,
    );
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/consultations/${id}`);
  },
};

export const rendezVousApi = {
  getAll: async (
    page = 1,
    size = 10,
  ): Promise<PaginatedResponse<RendezVous>> => {
    const response: AxiosResponse<PaginatedResponse<RendezVous>> =
      await api.get(
        `/appointments?page=${page}&size=${size}`, // ← Revenez à /appointments !
      );
    return response.data;
  },

  getByDate: async (date: string): Promise<RendezVous[]> => {
    const response: AxiosResponse<RendezVous[]> = await api.get(
      `/appointments/date/${date}`,
    );
    return response.data;
  },

  getById: async (id: string): Promise<RendezVous> => {
    // ← string au lieu de number
    const response: AxiosResponse<RendezVous> = await api.get(
      `/appointments/${id}`,
    );
    return response.data;
  },

  create: async (
    rendezVous: Omit<RendezVous, "id" | "created_at">,
  ): Promise<RendezVous> => {
    const response: AxiosResponse<RendezVous> = await api.post(
      "/appointments",
      rendezVous,
    );
    return response.data;
  },

  update: async (
    id: string,
    rendezVous: Partial<RendezVous>,
  ): Promise<RendezVous> => {
    // ← string
    const response: AxiosResponse<RendezVous> = await api.put(
      `/appointments/${id}`,
      rendezVous,
    );
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    // ← string
    await api.delete(`/appointments/${id}`);
  },
};

export default api;

// Dans services/api.ts, ajoutez :
export const userService = {
  create: async (userData: CreateUserData): Promise<User> => {
    const response: AxiosResponse<User> = await api.post("/users", userData);
    return response.data;
  },

  getAll: async (): Promise<User[]> => {
    console.log("🔑 Token dans localStorage:", localStorage.getItem("access_token"));
    const response: AxiosResponse<User[]> = await api.get("/users/");
    return response.data;
  },

  getById: async (id: string): Promise<User> => {
    const response: AxiosResponse<User> = await api.get(`/users/${id}`);
    return response.data;
  },

  update: async (id: string, userData: Partial<User>): Promise<User> => {
    const response: AxiosResponse<User> = await api.put(
      `/users/${id}`,
      userData,
    );
    return response.data;
  },

  delete: async (id: string): Promise<void> => {
    await api.delete(`/users/${id}`);
  },
};

export const calendarService = {
  getAppointmentsByMonth: async (
    year: number,
    month: number,
  ): Promise<CalendarAppointment[]> => {
    try {
      const response = await api.get(
        `/appointments/calendar/${year}/${month + 1}`,
      );
      return response.data;
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des rendez-vous du mois:",
        error,
      );
      throw error;
    }
  },

  getAppointmentsByDate: async (
    date: string,
  ): Promise<CalendarAppointment[]> => {
    try {
      const response = await api.get(`/appointments/calendar/date/${date}`);
      return response.data;
    } catch (error) {
      console.error(
        "Erreur lors de la récupération des rendez-vous du jour:",
        error,
      );
      throw error;
    }
  },
};

// Fonction utilitaire pour obtenir le token
function getAuthToken(): string {
  return localStorage.getItem("access_token") || "";
}
