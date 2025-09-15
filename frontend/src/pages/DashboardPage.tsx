import React, { useState, useEffect } from "react";
import {
  Users,
  Calendar,
  FileText,
  TrendingUp,
  Clock,
  CheckCircle,
  XCircle,
} from "lucide-react";
import { useAuth } from "../contexts/AuthContext";
import { patientsApi, consultationsApi, rendezVousApi } from "../services/api";
import LoadingSpinner from "../components/common/LoadingSpinner";
import ErrorMessage from "../components/common/ErrorMessage";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface DashboardStats {
  totalPatients: number;
  consultationsToday: number;
  rendezVousToday: number;
  totalConsultations: number;
}

interface RecentActivity {
  id: string;
  type: "consultation" | "rendez-vous" | "patient";
  title: string;
  subtitle: string;
  time: string;
  icon: React.ReactNode;
}

const DashboardPage: React.FC = () => {
  const { user, isMedecin } = useAuth();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [recentActivities, setRecentActivities] = useState<RecentActivity[]>(
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [patients, setPatients] = useState<any[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    loadDashboardData();
  }, []);

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  // Fonction pour récupérer l'ID du médecin cible (connecté ou associé)
  const getTargetMedecinId = async (): Promise<string | null> => {
    const userId = (user as any)?._id || user?.id;
    const userRole = user?.role;

    console.log("🎯 Détermination du médecin cible:", { userId, userRole });

    // Si c'est un médecin, retourner son ID
    if (userRole === "medecin") {
      console.log("👨‍⚕️ Utilisateur est médecin, ID:", userId);
      return userId;
    }

    // Si c'est une secrétaire, trouver son médecin associé
    if (userRole === "secretaire") {
      try {
        const response = await fetch(`${API_BASE_URL}/users/${userId}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const userData = await response.json();
        const medecinId =
          userData.medecin_id || userData.medecin?.id || userData.medecin?._id;

        console.log("👩‍💼 Secrétaire - médecin associé ID:", medecinId);

        if (!medecinId) {
          console.error("❌ Aucun médecin associé trouvé pour la secrétaire");
          return null;
        }

        return medecinId;
      } catch (error) {
        console.error(
          "❌ Erreur lors de la récupération du médecin associé:",
          error,
        );
        return null;
      }
    }

    console.log("⚠️ Rôle utilisateur non reconnu:", userRole);
    return null;
  };

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Récupérer l'ID du médecin cible
      const targetMedecinId = await getTargetMedecinId();

      if (!targetMedecinId) {
        setError("Impossible de déterminer le médecin associé");
        return;
      }

      console.log("📊 DASHBOARD DEBUG START:");
      console.log("- Utilisateur connecté:", user);
      console.log("- ID médecin cible:", targetMedecinId);

      // Date d'aujourd'hui
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      console.log("- Date aujourd'hui:", todayStr);

      // Initialiser les statistiques par défaut
      const dashboardStats = {
        totalPatients: 0,
        consultationsToday: 0,
        rendezVousToday: 0,
        totalConsultations: 0,
      };

      const activities: RecentActivity[] = [];

      // === ÉTAPE 1: CHARGER LES PATIENTS DU MÉDECIN ===
      try {
        console.log("🔄 Chargement des patients du médecin...");
        const patientsResponse = await patientsApi.getAll(1, 200);
        console.log("✅ Tous les patients chargés:", patientsResponse);

        // Filtrer les patients qui appartiennent au médecin cible
        const medecinPatients = patientsResponse.items.filter(
          (patient: any) => {
            const patientMedecinId =
              patient.medecin_id || patient.medecin?.id || patient.medecin?._id;
            const belongs = patientMedecinId === targetMedecinId;

            if (belongs) {
              console.log(
                `✅ Patient ${patient.nom} ${patient.prenom} appartient au médecin`,
              );
            }

            return belongs;
          },
        );

        console.log(
          `📊 Patients du médecin: ${medecinPatients.length} sur ${patientsResponse.items.length}`,
        );
        dashboardStats.totalPatients = medecinPatients.length;
        setPatients(medecinPatients); // Stocker pour utilisation ultérieure
      } catch (patientsError) {
        console.error("❌ Erreur patients:", patientsError);
        dashboardStats.totalPatients = 0;
        setPatients([]);
      }

      // === ÉTAPE 2: CHARGER LES CONSULTATIONS DU MÉDECIN ===
      try {
        console.log("🔄 Chargement des consultations du médecin...");
        const allConsultationsResponse = await consultationsApi.getAll(1, 200);
        console.log(
          "✅ Toutes les consultations chargées:",
          allConsultationsResponse,
        );

        if (allConsultationsResponse && allConsultationsResponse.items) {
          // FILTRAGE DES CONSULTATIONS DU MÉDECIN CIBLE
          const consultationsMedecin = allConsultationsResponse.items.filter(
            (consultation: any) => {
              // Ignorer les consultations avec medecin_id invalide
              if (
                !consultation.medecin_id ||
                consultation.medecin_id === "default_medecin_id"
              ) {
                return false;
              }
              const belongs = consultation.medecin_id === targetMedecinId;

              if (belongs) {
                console.log(
                  `✅ Consultation ${consultation.id} appartient au médecin`,
                );
              }

              return belongs;
            },
          );

          console.log(
            `📊 Consultations du médecin: ${consultationsMedecin.length} sur ${allConsultationsResponse.items.length}`,
          );
          dashboardStats.totalConsultations = consultationsMedecin.length;

          // FILTRAGE DES CONSULTATIONS D'AUJOURD'HUI
          const consultationsToday = consultationsMedecin.filter(
            (consultation: any) => {
              try {
                if (!consultation.date_consultation) {
                  return false;
                }

                const dateObj = new Date(consultation.date_consultation);
                if (isNaN(dateObj.getTime())) {
                  return false;
                }

                const consultationDate = dateObj.toISOString().split("T")[0];
                return consultationDate === todayStr;
              } catch (dateError) {
                return false;
              }
            },
          );

          console.log(
            `📅 Consultations du médecin aujourd'hui: ${consultationsToday.length}`,
          );
          dashboardStats.consultationsToday = consultationsToday.length;

          // AJOUTER LES CONSULTATIONS À L'ACTIVITÉ RÉCENTE
          consultationsMedecin.slice(0, 3).forEach((consultation: any) => {
            try {
              if (!consultation.date_consultation) {
                return;
              }

              const dateObj = new Date(consultation.date_consultation);
              if (isNaN(dateObj.getTime())) {
                return;
              }

              // Trouver le patient dans notre liste filtrée
              const patient =
                patients.find((p) => p.id === consultation.patient_id) ||
                consultation.patient;

              const patientName = patient
                ? `${patient.prenom || "Prénom"} ${patient.nom || "Nom"}`
                : "Patient inconnu";

              activities.push({
                id:
                  consultation.id ||
                  consultation._id ||
                  `consultation-${Date.now()}`,
                type: "consultation",
                title: "Consultation ajoutée",
                subtitle: `Patient: ${patientName}`,
                time: format(dateObj, "dd MMM yyyy à HH:mm", { locale: fr }),
                icon: <FileText className="h-4 w-4 text-purple-600" />,
              });
            } catch (activityError) {
              console.warn(
                "Erreur lors de l'ajout de consultation à l'activité:",
                activityError,
              );
            }
          });
        }
      } catch (consultationsError) {
        console.error("❌ Erreur consultations:", consultationsError);
        dashboardStats.totalConsultations = 0;
        dashboardStats.consultationsToday = 0;
      }

      // === ÉTAPE 3: CHARGER LES RENDEZ-VOUS DU MÉDECIN ===
      try {
        console.log("🔄 Chargement des rendez-vous du médecin...");
        const allRendezVousResponse = await rendezVousApi.getAll(1, 200);
        console.log("✅ Tous les rendez-vous chargés:", allRendezVousResponse);

        if (allRendezVousResponse && allRendezVousResponse.items) {
          // FILTRAGE DES RENDEZ-VOUS DU MÉDECIN CIBLE
          const rendezVousMedecin = allRendezVousResponse.items.filter(
            (rdv: any) => {
              const belongs = rdv.medecin_id === targetMedecinId;

              if (belongs) {
                console.log(`✅ RDV ${rdv.id} appartient au médecin`);
              }

              return belongs;
            },
          );

          console.log(
            `📊 Rendez-vous du médecin: ${rendezVousMedecin.length} sur ${allRendezVousResponse.items.length}`,
          );

          // FILTRAGE DES RENDEZ-VOUS D'AUJOURD'HUI (STATUT PROGRAMMÉ UNIQUEMENT)
          const rendezVousToday = rendezVousMedecin.filter((rdv: any) => {
            try {
              if (!rdv.date_rendez_vous) {
                return false;
              }

              const dateObj = new Date(rdv.date_rendez_vous);
              if (isNaN(dateObj.getTime())) {
                return false;
              }

              const rdvDate = dateObj.toISOString().split("T")[0];
              const isToday = rdvDate === todayStr;
              const isProgramme =
                rdv.statut === "programme" || rdv.statut === "programmé";

              console.log(
                `🔍 RDV ${rdv.id}: date=${rdvDate}, today=${todayStr}, isToday=${isToday}, statut=${rdv.statut}, isProgramme=${isProgramme}`,
              );

              return isToday && isProgramme;
            } catch (rdvError) {
              return false;
            }
          });

          console.log(
            `📅 RDV du médecin aujourd'hui (programmés): ${rendezVousToday.length}`,
          );
          dashboardStats.rendezVousToday = rendezVousToday.length;

          // AJOUTER LES RDV DU MÉDECIN À L'ACTIVITÉ RÉCENTE
          rendezVousMedecin.slice(0, 2).forEach((rdv: any) => {
            try {
              if (!rdv.date_rendez_vous) {
                return;
              }

              const dateObj = new Date(rdv.date_rendez_vous);

              // Si on a une heure, l'ajouter à la date
              if (rdv.heure && typeof rdv.heure === "string") {
                const [hours, minutes] = rdv.heure.split(":");
                if (hours && minutes) {
                  dateObj.setHours(parseInt(hours), parseInt(minutes), 0, 0);
                }
              }

              if (isNaN(dateObj.getTime())) {
                return;
              }

              // Trouver le patient dans notre liste filtrée
              const patient =
                patients.find((p) => p.id === rdv.patient_id) || rdv.patient;

              const patientName = patient
                ? `${patient.prenom || "Prénom"} ${patient.nom || "Nom"}`
                : "Patient inconnu";

              const statusIcon =
                rdv.statut === "programme" || rdv.statut === "programmé" ? (
                  <Clock className="h-4 w-4 text-blue-600" />
                ) : rdv.statut === "termine" ? (
                  <CheckCircle className="h-4 w-4 text-green-600" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-600" />
                );

              activities.push({
                id: rdv.id || rdv._id || `rdv-${Date.now()}`,
                type: "rendez-vous",
                title: `RDV ${rdv.statut || "statut inconnu"}`,
                subtitle: `Patient: ${patientName}`,
                time: format(dateObj, "dd MMM yyyy à HH:mm", { locale: fr }),
                icon: statusIcon,
              });
            } catch (activityError) {
              console.warn(
                "Erreur lors de l'ajout de RDV à l'activité:",
                activityError,
              );
            }
          });
        }
      } catch (rendezVousError) {
        console.error("❌ Erreur rendez-vous:", rendezVousError);
        dashboardStats.rendezVousToday = 0;
      }

      // === FINALISATION ===
      console.log("📊 Statistiques finales du médecin:", dashboardStats);

      // Trier les activités par date (plus récent en premier)
      try {
        activities.sort(
          (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
        );
      } catch (sortError) {
        console.warn("Erreur lors du tri des activités:", sortError);
      }

      setStats(dashboardStats);
      setRecentActivities(activities.slice(0, 5));
    } catch (err: any) {
      console.error("💥 ERREUR GLOBALE DASHBOARD:", err);

      let errorMessage = "Impossible de charger les données du tableau de bord";
      if (err.message) {
        errorMessage += ` (${err.message})`;
      }

      setError(errorMessage);
    } finally {
      setLoading(false);
    }
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
      <div className="border-b border-gray-200 pb-4">
        <h1 className="text-2xl font-bold text-gray-900">Tableau de bord</h1>
        <p className="mt-1 text-sm text-gray-500">
          Bienvenue, {user?.nom} ({user?.role})
          {user?.role === "secretaire" && (
            <span className="ml-2 text-blue-600">
              - Données du médecin associé
            </span>
          )}
        </p>
      </div>

      {/* Error Message */}
      {error && (
        <ErrorMessage message={error} onDismiss={() => setError(null)} />
      )}

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* Total Patients du médecin */}
          <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Users className="h-8 w-8 text-blue-600" />
                </div>
                <div className="ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      {user?.role === "secretaire"
                        ? "Patients du Médecin"
                        : "Mes Patients"}
                    </dt>
                    <dd className="text-2xl font-semibold text-gray-900">
                      {stats.totalPatients}
                    </dd>
                  </dl>
                </div>
              </div>
              <div className="mt-2">
                <button
                  onClick={() => navigate("/patients")}
                  className="text-xs text-blue-600 hover:text-blue-800"
                >
                  Voir tous les patients →
                </button>
              </div>
            </div>
          </div>

          {/* Rendez-vous du médecin aujourd'hui */}
          <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
            <div className="p-6">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Calendar className="h-8 w-8 text-green-600" />
                </div>
                <div className="ml-4 w-0 flex-1">
                  <dl>
                    <dt className="text-sm font-medium text-gray-500 truncate">
                      RDV Aujourd'hui
                    </dt>
                    <dd className="text-2xl font-semibold text-gray-900">
                      {stats.rendezVousToday}
                    </dd>
                  </dl>
                </div>
              </div>
              <div className="mt-2">
                <span className="text-xs text-gray-500">Statut: Programmé</span>
                <button
                  onClick={() => navigate("/rendez-vous")}
                  className="block text-xs text-green-600 hover:text-green-800 mt-1"
                >
                  Voir tous les RDV →
                </button>
              </div>
            </div>
          </div>

          {/* Total Consultations du médecin */}
          {isMedecin && (
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <FileText className="h-8 w-8 text-purple-600" />
                  </div>
                  <div className="ml-4 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Mes Consultations
                      </dt>
                      <dd className="text-2xl font-semibold text-gray-900">
                        {stats.totalConsultations}
                      </dd>
                    </dl>
                  </div>
                </div>
                <div className="mt-2">
                  <button
                    onClick={() => navigate("/consultations")}
                    className="text-xs text-purple-600 hover:text-purple-800"
                  >
                    Voir mes consultations →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Consultations du médecin aujourd'hui */}
          {isMedecin && (
            <div className="bg-white overflow-hidden shadow-sm rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
              <div className="p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <TrendingUp className="h-8 w-8 text-orange-600" />
                  </div>
                  <div className="ml-4 w-0 flex-1">
                    <dl>
                      <dt className="text-sm font-medium text-gray-500 truncate">
                        Consultations Aujourd'hui
                      </dt>
                      <dd className="text-2xl font-semibold text-gray-900">
                        {stats.consultationsToday}
                      </dd>
                    </dl>
                  </div>
                </div>
                <div className="mt-2">
                  <span className="text-xs text-gray-500">
                    {format(new Date(), "dd MMMM yyyy", { locale: fr })}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">Actions rapides</h2>
        </div>
        <div className="p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <button
              onClick={() => navigate("/patients/nouveau")}
              className="relative rounded-lg border border-gray-200 bg-white px-6 py-4 shadow-sm hover:border-gray-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center space-x-3">
                <Users className="h-6 w-6 text-blue-600" />
                <span className="text-sm font-medium text-gray-900">
                  Nouveau Patient
                </span>
              </div>
            </button>

            {isMedecin && (
              <button
                onClick={() => navigate("/consultations/nouvelle")}
                className="relative rounded-lg border border-gray-200 bg-white px-6 py-4 shadow-sm hover:border-gray-300 hover:shadow-md transition-all"
              >
                <div className="flex items-center space-x-3">
                  <FileText className="h-6 w-6 text-purple-600" />
                  <span className="text-sm font-medium text-gray-900">
                    Nouvelle Consultation
                  </span>
                </div>
              </button>
            )}

            <button
              onClick={() => navigate("/rendez-vous/nouveau")}
              className="relative rounded-lg border border-gray-200 bg-white px-6 py-4 shadow-sm hover:border-gray-300 hover:shadow-md transition-all"
            >
              <div className="flex items-center space-x-3">
                <Calendar className="h-6 w-6 text-green-600" />
                <span className="text-sm font-medium text-gray-900">
                  Nouveau RDV
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-medium text-gray-900">
            Activité récente
            {user?.role === "secretaire" && (
              <span className="ml-2 text-sm text-blue-600 font-normal">
                (du médecin associé)
              </span>
            )}
          </h2>
        </div>
        <div className="p-6">
          {recentActivities.length > 0 ? (
            <div className="space-y-4">
              {recentActivities.map((activity) => (
                <div
                  key={activity.id}
                  className="flex items-start space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex-shrink-0 mt-1">{activity.icon}</div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">
                      {activity.title}
                    </p>
                    <p className="text-sm text-gray-500 truncate">
                      {activity.subtitle}
                    </p>
                    <p className="text-xs text-gray-400 mt-1">
                      {activity.time}
                    </p>
                  </div>
                  <div className="flex-shrink-0">
                    <span
                      className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        activity.type === "consultation"
                          ? "bg-purple-100 text-purple-800"
                          : activity.type === "rendez-vous"
                            ? "bg-blue-100 text-blue-800"
                            : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {activity.type === "consultation"
                        ? "Consultation"
                        : activity.type === "rendez-vous"
                          ? "RDV"
                          : "Patient"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Clock className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">
                Aucune activité récente
              </h3>
              <p className="mt-1 text-sm text-gray-500">
                {user?.role === "secretaire"
                  ? "Les activités récentes du médecin associé apparaîtront ici"
                  : "Vos activités récentes apparaîtront ici"}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
