import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  Stethoscope,
  X,
  Eye,
} from "lucide-react";
import {
  CalendarAppointment,
  CalendarDay,
  Patient,
  User as UserType,
} from "../types";
import { useAuth } from "../contexts/AuthContext";
import { patientsApi, userService } from "../services/api";

const Calendar: React.FC = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Configuration de l'API - URL hardcodée temporairement
  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  const [currentDate, setCurrentDate] = useState(new Date());
  const [appointments, setAppointments] = useState<CalendarAppointment[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedDayAppointments, setSelectedDayAppointments] = useState<
    CalendarAppointment[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [modalLoading, setModalLoading] = useState(false);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [medecins, setMedecins] = useState<UserType[]>([]);
  const [currentMedecinData, setCurrentMedecinData] = useState<UserType | null>(
    null,
  );

  const months = [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
  ];

  const weekDays = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];

  // Fonction utilitaire pour convertir une date en string sans problème de fuseau horaire
  const dateToString = (date: Date): string => {
    const year = date.getFullYear();
    const month = (date.getMonth() + 1).toString().padStart(2, "0");
    const day = date.getDate().toString().padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  // Fonction pour trier les rendez-vous par heure
  const sortAppointmentsByTime = (
    appointments: CalendarAppointment[],
  ): CalendarAppointment[] => {
    return [...appointments].sort((a, b) => {
      // Convertir les heures au format HH:MM en minutes pour faciliter la comparaison
      const timeToMinutes = (time: string): number => {
        if (!time) return 0;
        const [hours, minutes] = time
          .split(":")
          .map((num) => parseInt(num, 10));
        return hours * 60 + (minutes || 0);
      };

      const timeA = timeToMinutes(a.heure);
      const timeB = timeToMinutes(b.heure);

      return timeA - timeB;
    });
  };

  // Récupérer l'ID du médecin connecté ou du médecin associé à la secrétaire
  const getTargetMedecinId = async (): Promise<string | null> => {
    const userId = (user as any)?._id || user?.id;
    const userRole = user?.role;

    console.log("👤 Utilisateur connecté:", {
      id: userId,
      role: userRole,
      nom: user?.nom,
    });

    // Si c'est un médecin, retourner son ID
    if (userRole === "medecin") {
      console.log("👨‍⚕️ Utilisateur est médecin, ID:", userId);
      return userId;
    }

    // Si c'est une secrétaire, trouver son médecin associé
    if (userRole === "secretaire") {
      try {
        // Récupérer les informations complètes de l'utilisateur
        const response = await fetch(`${API_BASE_URL}/users/${userId}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const userData = await response.json();
        const medecinId =
          userData.medecin_id || userData.medecin?.id || userData.medecin?._id;

        console.log("👩‍💼 Secrétaire - données utilisateur:", userData);
        console.log("👩‍💼 Secrétaire - médecin associé ID:", medecinId);

        if (!medecinId) {
          console.error("❌ Aucun médecin associé trouvé pour la secrétaire");
          return null;
        }

        return medecinId;
      } catch (error) {
        console.error(
          "❌ Erreur lors de la récupération du médecin de la secrétaire:",
          error,
        );
        return null;
      }
    }

    console.log("⚠️ Rôle utilisateur non reconnu ou non autorisé:", userRole);
    return null;
  };

  // Charger les données de référence (patients et médecins)
  const loadReferenceData = async () => {
    try {
      console.log("🔄 Chargement des données de référence...");

      // Obtenir l'ID du médecin cible
      const targetMedecinId = await getTargetMedecinId();
      if (!targetMedecinId) {
        console.error("❌ Impossible de déterminer le médecin cible");
        return { patients: [], medecins: [], targetMedecinId: null };
      }

      const [patientsResponse, medecinsResponse] = await Promise.all([
        patientsApi.getAll(1, 200),
        userService.getAll(),
      ]);

      const allPatients = patientsResponse.items;
      const allMedecins = medecinsResponse.filter(
        (user) => user.role === "medecin",
      );

      // Trouver les données du médecin cible
      const targetMedecin = allMedecins.find(
        (m) => m._id === targetMedecinId || m.id === targetMedecinId,
      );

      // Filtrer les patients qui appartiennent à ce médecin
      const medecinPatients = allPatients.filter((patient) => {
        const patientMedecinId =
          patient.medecin_id || patient.medecin?.id || patient.medecin?._id;
        const matches = patientMedecinId === targetMedecinId;

        if (matches) {
          console.log(
            `✅ Patient ${patient.nom} ${patient.prenom} appartient au médecin`,
          );
        }

        return matches;
      });

      setPatients(medecinPatients);
      setMedecins(allMedecins);
      setCurrentMedecinData(targetMedecin || null);

      console.log("✅ Données de référence chargées:", {
        targetMedecinId,
        targetMedecinNom: targetMedecin?.nom,
        totalPatients: allPatients.length,
        medecinPatients: medecinPatients.length,
        totalMedecins: allMedecins.length,
      });

      return {
        patients: medecinPatients,
        medecins: allMedecins,
        targetMedecinId,
        targetMedecin,
      };
    } catch (error) {
      console.error(
        "❌ Erreur lors du chargement des données de référence:",
        error,
      );
      return {
        patients: [],
        medecins: [],
        targetMedecinId: null,
        targetMedecin: null,
      };
    }
  };

  // Joindre les données des patients et médecins aux rendez-vous
  const enrichAppointments = (
    appointments: any[],
    patients: Patient[],
    medecins: UserType[],
  ): CalendarAppointment[] => {
    return appointments.map((apt) => {
      // Trouver le patient correspondant
      const patient = patients.find((p) => p.id === apt.patient_id);

      // Trouver le médecin correspondant
      const medecin = medecins.find(
        (m) => m._id === apt.medecin_id || m.id === apt.medecin_id,
      );

      const enrichedApt = {
        id: apt.id,
        _id: apt._id,
        date_rendez_vous: apt.date_rendez_vous,
        heure: apt.heure,
        motif: apt.motif,
        statut: apt.statut,
        medecin_id: apt.medecin_id,
        patient_id: apt.patient_id,
        patient_nom: patient
          ? `${patient.prenom} ${patient.nom}`
          : "Patient inconnu",
        medecin_nom: medecin ? medecin.nom : "Médecin inconnu",
        medecin: medecin || apt.medecin,
        patient: patient || apt.patient,
      };

      // Debug pour les cas problématiques
      if (!patient) {
        console.log(
          `⚠️ Patient non trouvé pour RDV ${apt.id}: patient_id=${apt.patient_id}`,
        );
      }
      if (!medecin) {
        console.log(
          `⚠️ Médecin non trouvé pour RDV ${apt.id}: medecin_id=${apt.medecin_id}`,
        );
      }

      return enrichedApt;
    });
  };

  // Filtrer les rendez-vous du médecin connecté (ou du médecin de la secrétaire)
  const filterAppointmentsByMedecin = (
    appointments: CalendarAppointment[],
    targetMedecinId: string,
  ): CalendarAppointment[] => {
    if (!targetMedecinId) {
      console.log("⚠️ Aucun médecin cible, pas de filtrage");
      return [];
    }

    // DEBUG: Voir la structure des données reçues
    if (appointments.length > 0) {
      console.log("🔍 Structure du premier RDV reçu:", {
        id: appointments[0].id,
        _id: appointments[0]._id,
        medecin_id: appointments[0].medecin_id,
        medecin: appointments[0].medecin,
        allKeys: Object.keys(appointments[0]),
      });
    }

    const filtered = appointments.filter((apt) => {
      // Vérifier différentes possibilités pour l'ID du médecin
      let aptMedecinId = apt.medecin_id;

      // Si medecin_id est undefined, essayer d'autres champs
      if (!aptMedecinId && apt.medecin) {
        aptMedecinId = (apt.medecin as any)?._id || (apt.medecin as any)?.id;
        console.log(
          `🔄 medecin_id non trouvé, utilisation de apt.medecin.id: ${aptMedecinId}`,
        );
      }

      // Si toujours pas d'ID médecin, cette approche ne fonctionnera pas
      if (!aptMedecinId) {
        console.log(`⚠️ RDV ${apt.id || apt._id}: Aucun medecin_id trouvé`);
        return false;
      }

      const matches = aptMedecinId === targetMedecinId;
      console.log(
        `🔍 RDV ${apt.id || apt._id}: medecin_id=${aptMedecinId} == ${targetMedecinId} ? ${matches}`,
      );
      return matches;
    });

    console.log(
      `✅ Rendez-vous filtrés: ${filtered.length} sur ${appointments.length} pour le médecin ${targetMedecinId}`,
    );

    return filtered;
  };

  // ========== SERVICES API CORRIGÉS ==========
  const calendarService = {
    // ✅ SOLUTION: Utiliser l'API normale des rendez-vous avec enrichissement des données
    getAppointmentsByMonth: async (
      year: number,
      month: number,
      patients: Patient[],
      medecins: UserType[],
      targetMedecinId: string,
    ): Promise<CalendarAppointment[]> => {
      try {
        console.log(`Récupération des rendez-vous pour ${year}/${month + 1}`);

        // ✅ Utiliser l'API normale des rendez-vous qui contient toutes les données
        const response = await fetch(
          `${API_BASE_URL}/appointments?page=1&size=200`,
        );
        console.log(`Statut de la réponse: ${response.status}`);

        if (!response.ok) {
          const errorText = await response.text();
          console.error(`Erreur HTTP ${response.status}:`, errorText);
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log("Données rendez-vous reçues:", data);

        // Transformer les données et filtrer par mois
        const appointments = data.items || [];
        const monthlyAppointments = appointments.filter((apt) => {
          if (!apt.date_rendez_vous) return false;

          const aptDate = new Date(apt.date_rendez_vous);
          const aptYear = aptDate.getFullYear();
          const aptMonth = aptDate.getMonth(); // 0-indexé

          return aptYear === year && aptMonth === month;
        });

        console.log("Rendez-vous du mois bruts:", monthlyAppointments);

        // ✅ ENRICHIR avec les données des patients et médecins
        const enrichedAppointments = enrichAppointments(
          monthlyAppointments,
          patients,
          medecins,
        );

        // ✅ FILTRER par médecin connecté
        const filteredData = filterAppointmentsByMedecin(
          enrichedAppointments,
          targetMedecinId,
        );
        return filteredData;
      } catch (error) {
        console.error(
          "Erreur lors de la récupération des rendez-vous du mois:",
          error,
        );
        return [];
      }
    },

    // ✅ SOLUTION: Même approche pour les rendez-vous du jour
    getAppointmentsByDate: async (
      dateString: string,
      patients: Patient[],
      medecins: UserType[],
      targetMedecinId: string,
    ): Promise<CalendarAppointment[]> => {
      try {
        console.log(`Récupération des rendez-vous pour: ${dateString}`);

        // ✅ Utiliser l'API normale des rendez-vous
        const response = await fetch(
          `${API_BASE_URL}/appointments?page=1&size=200`,
        );
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();

        // Filtrer par date spécifique
        const appointments = data.items || [];
        const dayAppointments = appointments.filter((apt) => {
          if (!apt.date_rendez_vous) return false;

          // Comparer les dates (format YYYY-MM-DD)
          const aptDateStr = apt.date_rendez_vous.split("T")[0]; // Enlever l'heure si présente
          return aptDateStr === dateString;
        });

        console.log("Rendez-vous du jour bruts:", dayAppointments);

        // ✅ ENRICHIR avec les données des patients et médecins
        const enrichedAppointments = enrichAppointments(
          dayAppointments,
          patients,
          medecins,
        );

        // ✅ FILTRER par médecin connecté
        const filteredData = filterAppointmentsByMedecin(
          enrichedAppointments,
          targetMedecinId,
        );

        // ✅ TRIER par heure
        const sortedData = sortAppointmentsByTime(filteredData);

        return sortedData;
      } catch (error) {
        console.error(
          "Erreur lors de la récupération des rendez-vous du jour:",
          error,
        );
        return [];
      }
    },
  };

  useEffect(() => {
    fetchAppointments();
  }, [currentDate]);

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth(); // JavaScript months sont 0-indexés (0=janvier, 6=juillet)
      console.log(`=== FETCH APPOINTMENTS ===`);
      console.log(`currentDate:`, currentDate);
      console.log(`year: ${year}, month JS: ${month}, month API: ${month + 1}`);

      // ✅ Charger d'abord les données de référence
      const {
        patients: refPatients,
        medecins: refMedecins,
        targetMedecinId,
      } = await loadReferenceData();

      if (!targetMedecinId) {
        console.error(
          "❌ Impossible de charger les rendez-vous sans médecin cible",
        );
        setAppointments([]);
        return;
      }

      // ✅ Puis charger les rendez-vous avec ces données
      const data = await calendarService.getAppointmentsByMonth(
        year,
        month,
        refPatients,
        refMedecins,
        targetMedecinId,
      );
      console.log(`${data.length} rendez-vous chargés pour le médecin:`, data);
      setAppointments(data);
    } catch (error) {
      console.error("Erreur lors du chargement des rendez-vous:", error);
      setAppointments([]); // S'assurer de vider en cas d'erreur
    } finally {
      setLoading(false);
    }
  };

  const handleDateClick = async (date: Date) => {
    const dateString = dateToString(date);
    console.log(`Clic sur la date: ${dateString} (date originale: ${date})`);
    setSelectedDate(dateString);

    try {
      setModalLoading(true);

      // ✅ Utiliser les données de référence déjà chargées (ou les recharger si nécessaire)
      const currentPatients = patients.length > 0 ? patients : [];
      const currentMedecins = medecins.length > 0 ? medecins : [];

      // Obtenir l'ID du médecin cible
      const targetMedecinId = await getTargetMedecinId();
      if (!targetMedecinId) {
        console.error(
          "❌ Impossible de charger les rendez-vous du jour sans médecin cible",
        );
        setSelectedDayAppointments([]);
        return;
      }

      const dayAppointments = await calendarService.getAppointmentsByDate(
        dateString,
        currentPatients,
        currentMedecins,
        targetMedecinId,
      );

      console.log(
        `Rendez-vous reçus pour ${dateString} (triés par heure):`,
        dayAppointments,
      );
      setSelectedDayAppointments(dayAppointments);
    } catch (error) {
      console.error(
        "Erreur lors du chargement des rendez-vous du jour:",
        error,
      );
      setSelectedDayAppointments([]);
    } finally {
      setModalLoading(false);
    }
  };

  // ✅ NOUVEAU: Navigation vers détails RDV
  const handleAppointmentClick = (
    appointment: CalendarAppointment,
    event?: React.MouseEvent,
  ) => {
    if (event) {
      event.stopPropagation(); // Empêcher la fermeture de la modal
    }

    const appointmentId = appointment._id || appointment.id;
    console.log("🔗 Navigation vers détails RDV:", appointmentId);
    navigate(`/rendez-vous/${appointmentId}`);
  };

  const closeModal = () => {
    setSelectedDate(null);
    setSelectedDayAppointments([]);
  };

  const navigateMonth = (direction: "prev" | "next") => {
    const newDate = new Date(currentDate);
    if (direction === "prev") {
      newDate.setMonth(newDate.getMonth() - 1);
    } else {
      newDate.setMonth(newDate.getMonth() + 1);
    }
    setCurrentDate(newDate);
  };

  const generateCalendarDays = (): CalendarDay[] => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const days: CalendarDay[] = [];
    const currentDateObj = new Date(startDate);

    for (let i = 0; i < 42; i++) {
      const dateString = dateToString(currentDateObj);

      // CORRECTION: Filtrer correctement les rendez-vous par date
      const dayAppointments = appointments.filter((apt) => {
        console.log(
          `Comparaison: ${apt.date_rendez_vous} === ${dateString} ?`,
          apt.date_rendez_vous === dateString,
        );
        return apt.date_rendez_vous === dateString;
      });

      console.log(
        `Date ${dateString}: ${dayAppointments.length} rendez-vous trouvés`,
      );

      days.push({
        date: new Date(currentDateObj),
        isCurrentMonth: currentDateObj.getMonth() === month,
        appointments: sortAppointmentsByTime(dayAppointments), // Trier par heure même dans la grille
      });

      currentDateObj.setDate(currentDateObj.getDate() + 1);
    }

    return days;
  };

  const getStatusColor = (status: CalendarAppointment["statut"]) => {
    switch (status) {
      case "programme":
        return "bg-blue-100 text-blue-800";
      case "confirme":
        return "bg-green-100 text-green-800";
      case "termine":
        return "bg-gray-100 text-gray-800";
      case "annule":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusText = (status: CalendarAppointment["statut"]) => {
    switch (status) {
      case "programme":
        return "Programmé";
      case "confirme":
        return "Confirmé";
      case "termine":
        return "Terminé";
      case "annule":
        return "Annulé";
      default:
        return status;
    }
  };

  const calendarDays = generateCalendarDays();

  // Corriger aussi la comparaison pour "aujourd'hui"
  const today = dateToString(new Date());

  // Debug: Afficher le nombre total de rendez-vous chargés
  console.log(
    `Total des rendez-vous du médecin dans le state: ${appointments.length}`,
  );
  console.log("Tous les rendez-vous du médecin:", appointments);

  // Nom à afficher dans le header
  const displayName =
    user?.role === "secretaire" && currentMedecinData
      ? `${currentMedecinData.nom} (via ${user.nom})`
      : user?.nom || "Inconnu";

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <div className="w-12 h-12 bg-indigo-100 rounded-full flex items-center justify-center mr-4">
                <CalendarIcon className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h1 className="text-3xl font-bold text-gray-900">
                  {user?.role === "secretaire"
                    ? "Calendrier Médecin"
                    : "Mon Calendrier"}
                </h1>
                <p className="text-sm text-gray-600 mt-1">Dr. {displayName}</p>
                {user?.role === "secretaire" && (
                  <p className="text-xs text-blue-600 mt-1">
                    Connecté en tant que secrétaire
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={() => navigate("/")}
              className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
            >
              Retour à l'accueil
            </button>
          </div>
        </div>

        {/* Calendar Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          {/* Calendar Header */}
          <div className="bg-indigo-600 text-white p-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => navigateMonth("prev")}
                className="p-2 hover:bg-indigo-700 rounded-lg transition-colors"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>

              <h2 className="text-xl font-semibold">
                {months[currentDate.getMonth()]} {currentDate.getFullYear()}
              </h2>

              <button
                onClick={() => navigateMonth("next")}
                className="p-2 hover:bg-indigo-700 rounded-lg transition-colors"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Week Days Header */}
          <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
            {weekDays.map((day) => (
              <div
                key={day}
                className="p-4 text-center text-sm font-medium text-gray-700"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Grid */}
          {loading ? (
            <div className="p-12 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Chargement de votre calendrier...</p>
            </div>
          ) : (
            <div className="grid grid-cols-7">
              {calendarDays.map((day, index) => {
                const dateString = dateToString(day.date);
                const isToday = dateString === today;
                const hasAppointments = day.appointments.length > 0;

                console.log(
                  `Jour ${dateString}: ${day.appointments.length} rendez-vous, isCurrentMonth: ${day.isCurrentMonth}`,
                );

                return (
                  <div
                    key={index}
                    onClick={() => handleDateClick(day.date)}
                    className={`
                      min-h-[120px] p-2 border-b border-r border-gray-200 cursor-pointer hover:bg-gray-50 transition-colors
                      ${!day.isCurrentMonth ? "bg-gray-50 text-gray-400" : ""}
                      ${isToday ? "bg-blue-50" : ""}
                    `}
                  >
                    <div
                      className={`
                      text-sm font-medium mb-2
                      ${isToday ? "text-blue-600" : day.isCurrentMonth ? "text-gray-900" : "text-gray-400"}
                    `}
                    >
                      {day.date.getDate()}
                      {/* Badge avec nombre de rendez-vous */}
                      {hasAppointments && day.isCurrentMonth && (
                        <span className="ml-1 text-xs bg-indigo-500 text-white rounded-full px-1">
                          {day.appointments.length}
                        </span>
                      )}
                    </div>

                    {hasAppointments && day.isCurrentMonth && (
                      <div className="space-y-1">
                        {day.appointments.slice(0, 2).map((appointment) => (
                          <div
                            key={appointment._id || appointment.id}
                            onClick={(e) =>
                              handleAppointmentClick(appointment, e)
                            }
                            className={`
                              text-xs px-2 py-1 rounded-md truncate cursor-pointer hover:opacity-80 transition-opacity
                              ${getStatusColor(appointment.statut)}
                            `}
                            title={`${appointment.heure} - ${appointment.patient_nom} (Cliquer pour voir les détails)`}
                          >
                            <div className="flex items-center">
                              <Clock className="w-3 h-3 mr-1" />
                              {appointment.heure} - {appointment.patient_nom}
                            </div>
                          </div>
                        ))}
                        {day.appointments.length > 2 && (
                          <div className="text-xs text-gray-500 px-2">
                            +{day.appointments.length - 2} autres
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-4">
          <h3 className="text-sm font-medium text-gray-900 mb-3">
            Légende des statuts
          </h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center">
              <div className="w-3 h-3 bg-blue-100 rounded mr-2"></div>
              <span className="text-sm text-gray-700">Programmé</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-green-100 rounded mr-2"></div>
              <span className="text-sm text-gray-700">Confirmé</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-gray-100 rounded mr-2"></div>
              <span className="text-sm text-gray-700">Terminé</span>
            </div>
            <div className="flex items-center">
              <div className="w-3 h-3 bg-red-100 rounded mr-2"></div>
              <span className="text-sm text-gray-700">Annulé</span>
            </div>
          </div>
        </div>
      </div>

      {/* Modal for day details */}
      {selectedDate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
            {/* Modal Header */}
            <div className="bg-indigo-600 text-white p-6 flex items-center justify-between">
              <h3 className="text-xl font-semibold">
                {user?.role === "secretaire"
                  ? "Rendez-vous du médecin"
                  : "Mes rendez-vous"}{" "}
                du{" "}
                {new Date(selectedDate).toLocaleDateString("fr-FR", {
                  weekday: "long",
                  year: "numeric",
                  month: "long",
                  day: "numeric",
                })}
              </h3>
              <button
                onClick={closeModal}
                className="p-1 hover:bg-indigo-700 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Content */}
            <div className="p-6 overflow-y-auto max-h-[60vh]">
              {modalLoading ? (
                <div className="text-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
                  <p className="text-gray-600">Chargement des rendez-vous...</p>
                </div>
              ) : selectedDayAppointments.length > 0 ? (
                <div className="space-y-4">
                  {selectedDayAppointments.map((appointment) => (
                    <div
                      key={appointment._id || appointment.id}
                      className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => handleAppointmentClick(appointment)}
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center">
                          <Clock className="w-5 h-5 text-indigo-600 mr-2" />
                          <span className="font-bold text-lg text-gray-900">
                            {appointment.heure}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span
                            className={`px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(appointment.statut)}`}
                          >
                            {getStatusText(appointment.statut)}
                          </span>
                          <button
                            onClick={(e) =>
                              handleAppointmentClick(appointment, e)
                            }
                            className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-50 rounded transition-colors"
                            title="Voir les détails"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="flex items-center">
                          <User className="w-4 h-4 text-gray-500 mr-3" />
                          <span className="text-gray-700 font-medium">
                            Patient: {appointment.patient_nom}
                          </span>
                        </div>
                        <div className="flex items-center">
                          <Stethoscope className="w-4 h-4 text-gray-500 mr-3" />
                          <span className="text-gray-700">
                            Médecin: {appointment.medecin_nom}
                          </span>
                        </div>
                        {appointment.motif && (
                          <div className="mt-3 p-3 bg-gray-50 rounded-lg">
                            <span className="text-sm font-medium text-gray-600">
                              Motif de consultation:{" "}
                            </span>
                            <span className="text-sm text-gray-900">
                              {appointment.motif}
                            </span>
                          </div>
                        )}
                      </div>

                      <div className="mt-4 pt-3 border-t border-gray-100 text-xs text-gray-500 flex items-center">
                        <Eye className="w-3 h-3 mr-1" />
                        Cliquer pour voir les détails complets du rendez-vous
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <CalendarIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">
                    Aucun rendez-vous
                  </h4>
                  <p className="text-gray-600">
                    Aucun rendez-vous programmé pour cette date
                  </p>
                  <p className="text-sm text-gray-500 mt-2">
                    Date sélectionnée:{" "}
                    {new Date(selectedDate).toLocaleDateString("fr-FR")}
                  </p>
                  {user?.role === "secretaire" && (
                    <p className="text-xs text-blue-600 mt-2">
                      Affichage des rendez-vous du médecin associé
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Modal Footer */}
            {selectedDayAppointments.length > 0 && (
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between text-sm text-gray-600">
                  <span>
                    {selectedDayAppointments.length} rendez-vous programmé
                    {selectedDayAppointments.length > 1 ? "s" : ""}
                  </span>
                  <span className="text-xs">Triés par heure croissante</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Calendar;
