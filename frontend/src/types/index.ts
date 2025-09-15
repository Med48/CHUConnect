// Types TypeScript pour synchronisation avec le backend FastAPI

export interface User {
  id: string;
  nom: string;
  email: string;
  role: "medecin" | "secretaire" | "admin";
  created_at: string;
  medecin_id?: string; // ✅ Ajouter cette ligne
}

export interface LoginRequest {
  email: string;
  password: string;
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
  user_id: string;
  role: string;
}

export interface Patient {
  id?: string;
  nom: string;
  prenom: string;
  cin: string;
  genre: "M" | "F";
  date_naissance: string;
  telephone?: string;
  adresse?: string;
  email?: string;
  medecin_id: string; // ✅ AJOUTER ce champ

  // ✅ NOUVEAUX CHAMPS POUR LA PHOTO
  photo_file_id?: string;
  photo_url?: string;

  created_at?: string;
  updated_at?: string;
}

// ✅ NOUVEAU TYPE pour la réponse d'upload de photo
export interface PhotoUploadResponse {
  message: string;
  photo_url: string;
  file_id: string;
}

// ✅ NOUVEAU TYPE pour les données de création d'un patient
export interface PatientCreateData {
  nom: string;
  prenom: string;
  cin: string;
  genre: "M" | "F";
  date_naissance: string;
  telephone?: string;
  adresse?: string;
  email?: string;
  medecin_id: string;
}

// ✅ NOUVEAU TYPE pour les données de mise à jour d'un patient
export interface PatientUpdateData {
  nom: string;
  prenom: string;
  cin: string;
  genre: "M" | "F";
  date_naissance: string;
  telephone?: string;
  adresse?: string;
  email?: string;
}

export interface Consultation {
  medecin: any;
  patient: any;
  id?: string;
  patient_id: string;
  medecin_id: string;
  date_consultation: string;
  motif: string;
  symptomes: string;
  diagnostic?: string;
  traitement?: string;
  notes?: string;
  created_at?: string;
  updated_at?: string;
}

export type ConsultationFormData = Omit<
  Consultation,
  "id" | "created_at" | "updated_at"
>;

export interface RendezVous {
  id?: string;
  patient_id: string;
  medecin_id: string;
  date_rendez_vous: string;
  heure: string;
  motif?: string;
  statut: "programme" | "confirme" | "annule" | "termine";
  created_at?: string;
  patient?: Patient;
  medecin?: User;
}

export interface ApiError {
  detail: string;
  status_code?: number;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface CreateUserData {
  id?: string;
  nom: string;
  email: string;
  password: string;
  role: "medecin" | "secretaire" | "admin";
  medecin_id?: string;
}

export interface CalendarAppointment {
  id: string;
  date_rendez_vous: string;
  heure: string;
  patient_nom: string;
  medecin_nom: string;
  motif: string;
  statut: "programme" | "confirme" | "termine" | "annule";
}

export interface CalendarDay {
  date: Date;
  isCurrentMonth: boolean;
  appointments: CalendarAppointment[];
}
