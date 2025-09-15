import React, { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Calendar,
  User,
  Clock,
  Search,
  AlertTriangle,
  CheckCircle,
  Brain,
  Sparkles
} from "lucide-react";
import { rendezVousApi, patientsApi } from "../services/api";
import { RendezVous, Patient } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import AIPlanningModal from "../components/AIPlanningModal";
import SmartDateTimeModal from "../components/SmartDateTimeModal";

const AddRendezVous: React.FC = () => {
  const { id } = useParams<{ id: string }>(); // ID du patient (si venant des détails patient)
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  // ✅ CORRECTION : Récupérer le paramètre patient de l'URL ET de l'état de navigation
  const urlParams = new URLSearchParams(location.search);
  const patientFromUrl = urlParams.get("patient");
  const patientFromState = location.state?.patientId;

  // États
  const [loading, setLoading] = useState(false);
  const [loadingValidation, setLoadingValidation] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [patientSearch, setPatientSearch] = useState<string>("");
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [existingRendezVous, setExistingRendezVous] = useState<RendezVous[]>(
    [],
  );
  const [occupiedSlots, setOccupiedSlots] = useState<Set<string>>(new Set());
  const [selectedPatientInfo, setSelectedPatientInfo] =
    useState<Patient | null>(null);

  // ✅ CORRECTION : Vérifier toutes les sources possibles de patient
  const isFromPatientDetails = !!id;
  const hasPatientParam = !!(patientFromUrl || patientFromState);
  const finalPatientId = id || patientFromUrl || patientFromState;

  console.log("🔍 DEBUG RDV PARAMS:", {
    id,
    patientFromUrl,
    patientFromState,
    finalPatientId,
    isFromPatientDetails,
    hasPatientParam,
    currentUrl: location.pathname + location.search,
    locationState: location.state,
  });

  const [formData, setFormData] = useState({
    date_rendez_vous: "",
    heure: "",
    motif: "",
  });

  // Validation en temps réel
  const [fieldValidation, setFieldValidation] = useState({
    patient: { valid: false, message: "" },
    date: { valid: false, message: "" },
    heure: { valid: false, message: "" },
    motif: { valid: false, message: "" },
  });

  const [isAIPlanningModalOpen, setIsAIPlanningModalOpen] = useState(false);
  const [isSmartDateTimeModalOpen, setIsSmartDateTimeModalOpen] = useState(false);

  // ✅ CORRECTION : Charger les données initiales avec patient pré-sélectionné
  useEffect(() => {
    const initializeData = async () => {
      // Charger les patients
      const loadedPatients = await loadPatients();

      // Définir le patient sélectionné selon le contexte
      if (finalPatientId) {
        console.log("🎯 Patient ID détecté:", finalPatientId);
        setSelectedPatient(finalPatientId);

        // Mettre à jour la validation du patient
        setFieldValidation((prev) => ({
          ...prev,
          patient: {
            valid: true,
            message: "Patient sélectionné automatiquement",
          },
        }));

        // Trouver les infos du patient dans la liste chargée
        if (loadedPatients.length > 0) {
          const patientInfo = loadedPatients.find(
            (p) => p.id === finalPatientId,
          );
          if (patientInfo) {
            setSelectedPatientInfo(patientInfo);
            console.log("✅ Patient pré-sélectionné pour RDV:", patientInfo);
          } else {
            console.log("⚠️ Patient non trouvé dans la liste:", finalPatientId);
          }
        }
      }
    };

    initializeData();
    loadExistingRendezVous();
  }, [finalPatientId]);

  // ✅ CORRECTION : Récupérer les infos du patient sélectionné quand la sélection change
  useEffect(() => {
    if (selectedPatient && patients.length > 0) {
      console.log("🔍 Recherche patient dans liste RDV:", {
        selectedPatient,
        totalPatients: patients.length,
      });

      const patientInfo = patients.find((p) => p.id === selectedPatient);
      setSelectedPatientInfo(patientInfo || null);

      if (patientInfo) {
        console.log("✅ Patient sélectionné trouvé pour RDV:", patientInfo);
      } else {
        console.log("❌ Patient sélectionné NON trouvé dans la liste");
      }
    }
  }, [selectedPatient, patients]);

  // Filtrer les patients selon la recherche
  useEffect(() => {
    if (!patientSearch.trim()) {
      setFilteredPatients(patients);
    } else {
      const filtered = patients.filter((patient) => {
        const fullName = `${patient.prenom} ${patient.nom}`.toLowerCase();
        const cin = patient.cin?.toLowerCase() || "";
        const search = patientSearch.toLowerCase();

        return fullName.includes(search) || cin.includes(search);
      });
      setFilteredPatients(filtered);
    }
  }, [patients, patientSearch]);

  // Mettre à jour les créneaux occupés quand la date change
  useEffect(() => {
    if (formData.date_rendez_vous) {
      updateOccupiedSlots();
    }
  }, [formData.date_rendez_vous, existingRendezVous]);

  // Validation du patient
  useEffect(() => {
    if (selectedPatient) {
      const patient = patients.find((p) => p.id === selectedPatient);
      setFieldValidation((prev) => ({
        ...prev,
        patient: {
          valid: true,
          message: patient
            ? `${patient.prenom} ${patient.nom} sélectionné`
            : "Patient sélectionné",
        },
      }));
    } else if (!finalPatientId) {
      setFieldValidation((prev) => ({
        ...prev,
        patient: { valid: false, message: "Sélectionnez un patient" },
      }));
    }
  }, [selectedPatient, patients, finalPatientId]);

  // Validation de la date
  useEffect(() => {
    if (formData.date_rendez_vous) {
      const selectedDate = new Date(formData.date_rendez_vous);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        setFieldValidation((prev) => ({
          ...prev,
          date: {
            valid: false,
            message: "La date ne peut pas être dans le passé",
          },
        }));
      } else {
        const dayOfWeek = selectedDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          setFieldValidation((prev) => ({
            ...prev,
            date: {
              valid: false,
              message: "Les rendez-vous ne sont pas disponibles le week-end",
            },
          }));
        } else {
          setFieldValidation((prev) => ({
            ...prev,
            date: {
              valid: true,
              message: `Date sélectionnée: ${format(selectedDate, "dd MMMM yyyy", { locale: fr })}`,
            },
          }));
        }
      }
    } else {
      setFieldValidation((prev) => ({
        ...prev,
        date: { valid: false, message: "Sélectionnez une date" },
      }));
    }
  }, [formData.date_rendez_vous]);

  // Validation de l'heure
  useEffect(() => {
    if (formData.heure && formData.date_rendez_vous) {
      const slotKey = `${formData.date_rendez_vous}-${formData.heure}`;
      if (occupiedSlots.has(slotKey)) {
        setFieldValidation((prev) => ({
          ...prev,
          heure: { valid: false, message: "Ce créneau est déjà occupé" },
        }));
      } else {
        setFieldValidation((prev) => ({
          ...prev,
          heure: {
            valid: true,
            message: `Créneau disponible: ${formData.heure}`,
          },
        }));
      }
    } else if (formData.heure) {
      setFieldValidation((prev) => ({
        ...prev,
        heure: {
          valid: true,
          message: `Heure sélectionnée: ${formData.heure}`,
        },
      }));
    } else {
      setFieldValidation((prev) => ({
        ...prev,
        heure: { valid: false, message: "Sélectionnez une heure" },
      }));
    }
  }, [formData.heure, formData.date_rendez_vous, occupiedSlots]);

  // Validation du motif
  useEffect(() => {
    if (formData.motif.trim()) {
      if (formData.motif.trim().length < 10) {
        setFieldValidation((prev) => ({
          ...prev,
          motif: {
            valid: false,
            message: "Le motif doit contenir au moins 10 caractères",
          },
        }));
      } else {
        setFieldValidation((prev) => ({
          ...prev,
          motif: { valid: true, message: "Motif valide" },
        }));
      }
    } else {
      setFieldValidation((prev) => ({
        ...prev,
        motif: { valid: false, message: "Décrivez le motif du rendez-vous" },
      }));
    }
  }, [formData.motif]);

  // ✅ CORRECTION : Modifier la fonction loadPatients pour retourner les données
  const loadPatients = async () => {
    try {
      console.log("🔄 Chargement des patients pour RDV...");
      const response = await patientsApi.getAll(1, 200);
      setPatients(response.items);
      setFilteredPatients(response.items);
      console.log("✅ Patients chargés pour RDV:", response.items.length);
      return response.items; // ✅ Retourner les patients pour usage immédiat
    } catch (error) {
      console.error("Erreur lors du chargement des patients:", error);
      setError("Impossible de charger la liste des patients");
      return [];
    }
  };

  const loadExistingRendezVous = async () => {
    try {
      setLoadingValidation(true);
      const response = await rendezVousApi.getAll(1, 200);

      // Récupérer l'ID du médecin (connecté ou associé à la secrétaire)
      let targetMedecinId;
      if (user?.role === "medecin") {
        targetMedecinId = (user as any)?._id || user?.id;
      } else if (user?.role === "secretaire") {
        try {
          const userId = (user as any)?._id || user?.id;
          const userResponse = await fetch(
            `${API_BASE_URL}/users/${userId}`,
          );
          if (userResponse.ok) {
            const userData = await userResponse.json();
            targetMedecinId =
              userData.medecin_id ||
              userData.medecin?.id ||
              userData.medecin?._id;
          }
        } catch (error) {
          console.error(
            "Erreur lors de la récupération du médecin associé:",
            error,
          );
        }
      }

      // Filtrer seulement les rendez-vous du médecin cible et non annulés
      const rendezVousMedecin = response.items.filter(
        (rdv: any) =>
          rdv.medecin_id === targetMedecinId && rdv.statut !== "annule",
      );

      setExistingRendezVous(rendezVousMedecin);
      console.log(
        `✅ ${rendezVousMedecin.length} rendez-vous existants chargés pour validation`,
      );
    } catch (error) {
      console.error(
        "Erreur lors du chargement des rendez-vous existants:",
        error,
      );
    } finally {
      setLoadingValidation(false);
    }
  };

  const updateOccupiedSlots = () => {
    const occupied = new Set<string>();

    existingRendezVous.forEach((rdv) => {
      if (rdv.date_rendez_vous === formData.date_rendez_vous) {
        const slotKey = `${rdv.date_rendez_vous}-${rdv.heure}`;
        occupied.add(slotKey);
      }
    });

    setOccupiedSlots(occupied);
    console.log(
      `📅 Créneaux occupés le ${formData.date_rendez_vous}:`,
      Array.from(occupied),
    );
  };

  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handlePatientChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setSelectedPatient(e.target.value);
    setPatientSearch(""); // Reset search when selecting
  };

  const handlePatientSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPatientSearch(e.target.value);
    setSelectedPatient(""); // Reset selection when searching
  };

  const handlePatientSelect = (patientId: string) => {
    setSelectedPatient(patientId);
    setPatientSearch("");
  };

    // 3. NOUVELLE FONCTION - Gérer la sélection smart date+heure
  const handleSmartDateTimeSelect = (selectedDate: string, selectedTime: string) => {
    setFormData((prev) => ({
      ...prev,
      date_rendez_vous: selectedDate,
      heure: selectedTime,
    }));
    setIsSmartDateTimeModalOpen(false);
    
    // Mettre à jour les validations
    setFieldValidation((prev) => ({
      ...prev,
      date: {
        valid: true,
        message: `Date sélectionnée par IA: ${selectedDate}`,
      },
      heure: {
        valid: true,
        message: `Heure optimale suggérée: ${selectedTime}`,
      },
    }));
  };

  // 4. NOUVELLE FONCTION - Ouvrir l'assistant smart
  const handleOpenSmartDateTime = () => {
    if (!formData.motif.trim()) {
      setError("Veuillez renseigner le motif avant d'utiliser l'assistant IA");
      return;
    }
    
    // Récupérer l'ID du médecin
    let medecinId;
    if (user?.role === "medecin") {
      medecinId = (user as any)?._id || user?.id;
    } else if (user?.role === "secretaire") {
      // Pour une secrétaire, récupérer l'ID du médecin associé
      // Cette logique peut être adaptée selon votre implémentation
      setError("Fonction Smart IA temporairement indisponible pour les secrétaires");
      return;
    }
    
    if (!medecinId) {
      setError("Impossible de déterminer le médecin pour l'analyse IA");
      return;
    }
    
    setError(null);
    setIsSmartDateTimeModalOpen(true);
  };

  const handleAISlotSelect = (selectedTime: string) => {
    setFormData((prev) => ({
      ...prev,
      heure: selectedTime,
    }));
    setIsAIPlanningModalOpen(false);
  };

  const handleOpenAIPlanningAssistant = () => {
    if (!formData.date_rendez_vous || !formData.motif.trim()) {
      setError("Veuillez renseigner la date et le motif avant d'utiliser l'assistant IA");
      return;
    }
    
    // Récupérer l'ID du médecin
    let medecinId;
    if (user?.role === "medecin") {
      medecinId = (user as any)?._id || user?.id;
    } else if (user?.role === "secretaire") {
      // Pour une secrétaire, il faudrait récupérer l'ID du médecin associé
      // Pour l'instant, on peut utiliser un médecin par défaut ou implémenter la logique
      setError("Fonction IA non disponible pour les secrétaires pour le moment");
      return;
    }
    
    if (!medecinId) {
      setError("Impossible de déterminer le médecin pour l'analyse IA");
      return;
    }
    
    setError(null);
    setIsAIPlanningModalOpen(true);
  };

  const validateForm = (): boolean => {
    // Vérifications de base
    if (!selectedPatient) {
      setError("Veuillez sélectionner un patient");
      return false;
    }

    if (
      !formData.date_rendez_vous ||
      !formData.heure ||
      !formData.motif.trim()
    ) {
      setError("Tous les champs sont obligatoires");
      return false;
    }

    // Vérifier que la date n'est pas dans le passé
    const selectedDate = new Date(formData.date_rendez_vous);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    if (selectedDate < today) {
      setError("La date ne peut pas être dans le passé");
      return false;
    }

    // Vérifier les week-ends
    const dayOfWeek = selectedDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      setError("Les rendez-vous ne sont pas disponibles le week-end");
      return false;
    }

    // Vérifier les conflits d'horaires
    const slotKey = `${formData.date_rendez_vous}-${formData.heure}`;
    if (occupiedSlots.has(slotKey)) {
      setError("Ce créneau est déjà occupé. Veuillez choisir une autre heure.");
      return false;
    }

    // Vérifier si le patient a déjà un RDV le même jour
    const patientRdvSameDay = existingRendezVous.find(
      (rdv) =>
        rdv.patient_id === selectedPatient &&
        rdv.date_rendez_vous === formData.date_rendez_vous &&
        rdv.statut !== "annule",
    );

    if (patientRdvSameDay) {
      const patientName = patients.find((p) => p.id === selectedPatient);
      setError(
        `${patientName?.prenom} ${patientName?.nom} a déjà un rendez-vous le ${format(selectedDate, "dd MMMM yyyy", { locale: fr })} à ${patientRdvSameDay.heure}`,
      );
      return false;
    }

    // Vérifier la longueur du motif
    if (formData.motif.trim().length < 10) {
      setError("Le motif du rendez-vous doit contenir au moins 10 caractères");
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Récupérer l'ID du médecin connecté ou du médecin associé à la secrétaire
    let medecinId;
    if (user?.role === "medecin") {
      medecinId = (user as any)?._id || user?.id;
    } else if (user?.role === "secretaire") {
      // Pour une secrétaire, récupérer l'ID du médecin associé
      try {
        const userId = (user as any)?._id || user?.id;
        const response = await fetch(`${API_BASE_URL}/users/${userId}`);
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const userData = await response.json();
        medecinId =
          userData.medecin_id || userData.medecin?.id || userData.medecin?._id;

        if (!medecinId) {
          console.error("❌ Aucun médecin associé trouvé pour la secrétaire");
          setError("Erreur: Aucun médecin associé trouvé pour votre compte");
          return;
        }

        console.log("👩‍💼 Secrétaire - création RDV pour le médecin:", medecinId);
      } catch (error) {
        console.error(
          "❌ Erreur lors de la récupération du médecin associé:",
          error,
        );
        setError(
          "Erreur lors de la récupération des informations du médecin associé",
        );
        return;
      }
    } else {
      console.error("❌ Rôle utilisateur non autorisé:", user?.role);
      setError("Erreur: Rôle utilisateur non autorisé");
      return;
    }

    if (!medecinId) {
      console.error("❌ Aucun médecin trouvé");
      setError("Erreur: Aucun médecin trouvé");
      return;
    }

    console.log("👨‍⚕️ DEBUG CREATION RDV:");
    console.log("- User connecté:", user);
    console.log("- ID du médecin utilisé:", medecinId);
    console.log("- Patient sélectionné:", selectedPatient);
    console.log("- Date:", formData.date_rendez_vous);
    console.log("- Heure:", formData.heure);

    try {
      setLoading(true);
      setError(null);

      const rendezVousData: Omit<
        RendezVous,
        "id" | "created_at" | "patient" | "medecin"
      > = {
        patient_id: selectedPatient,
        medecin_id: medecinId,
        date_rendez_vous: formData.date_rendez_vous,
        heure: formData.heure,
        motif: formData.motif.trim(),
        statut: "programme",
      };

      console.log("📤 Données RDV à envoyer:", rendezVousData);

      await rendezVousApi.create(rendezVousData);

      // Message de succès
      setValidationMessage("Rendez-vous créé avec succès !");

      // Redirection après un court délai
      setTimeout(() => {
        if (finalPatientId) {
          navigate(`/patients/id/${finalPatientId}`);
        } else {
          navigate("/rendez-vous");
        }
      }, 1500);
    } catch (error) {
      console.error("❌ Erreur lors de la création du rendez-vous:", error);
      setError("Erreur lors de l'enregistrement du rendez-vous");
    } finally {
      setLoading(false);
    }
  };

  const isFormValid = Object.values(fieldValidation).every(
    (field) => field.valid,
  );

  // Générer les créneaux horaires
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 18; hour++) {
      for (let minute = 0; minute < 60; minute += 15) {
        const timeString = `${hour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
        slots.push(timeString);
      }
    }
    return slots;
  };

  const timeSlots = generateTimeSlots();

  // Fonction pour vérifier si un créneau est occupé
  const isSlotOccupied = (time: string) => {
    if (!formData.date_rendez_vous) return false;
    const slotKey = `${formData.date_rendez_vous}-${time}`;
    return occupiedSlots.has(slotKey);
  };

  const renderValidationIcon = (field: keyof typeof fieldValidation) => {
    const validation = fieldValidation[field];
    if (!validation.message) return null;

    return validation.valid ? (
      <CheckCircle className="w-4 h-4 text-green-500" />
    ) : (
      <AlertTriangle className="w-4 h-4 text-red-500" />
    );
  };

  const renderValidationMessage = (field: keyof typeof fieldValidation) => {
    const validation = fieldValidation[field];
    if (!validation.message) return null;

    return (
      <p
        className={`text-xs mt-1 ${validation.valid ? "text-green-600" : "text-red-600"}`}
      >
        {validation.message}
      </p>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() =>
              finalPatientId
                ? navigate(`/patients/id/${finalPatientId}`)
                : navigate(-1)
            }
            className="flex items-center text-gray-600 hover:text-gray-800 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            {finalPatientId ? "Retour aux détails du patient" : "Retour"}
          </button>
          <div className="flex items-center">
            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mr-4">
              <Calendar className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Programmer un rendez-vous
              </h1>
              {selectedPatientInfo && (
                <p className="text-gray-600 mt-1">
                  Patient: {selectedPatientInfo.prenom}{" "}
                  {selectedPatientInfo.nom} ({selectedPatientInfo.cin})
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Loading validation */}
        {loadingValidation && (
          <div className="mb-6 bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg flex items-center">
            <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-2"></div>
            Vérification des créneaux disponibles...
          </div>
        )}

        {/* Success Message */}
        {validationMessage && (
          <div className="mb-6 bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg flex items-center">
            <CheckCircle className="w-5 h-5 mr-2" />
            {validationMessage}
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg flex items-center">
            <AlertTriangle className="w-5 h-5 mr-2" />
            {error}
          </div>
        )}

        {/* Form Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Sélection du patient */}
            {!finalPatientId ? (
              <div className="space-y-4">
                <div className="flex items-center">
                  <label className="block text-sm font-medium text-gray-700 mr-2">
                    Patient *
                  </label>
                  {renderValidationIcon("patient")}
                </div>

                {/* Barre de recherche de patient */}
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-5 w-5 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Rechercher par nom ou CIN..."
                    value={patientSearch}
                    onChange={handlePatientSearch}
                    className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-green-500 focus:border-green-500"
                  />
                </div>

                {/* Liste des patients filtrés */}
                {patientSearch && (
                  <div className="max-h-48 overflow-y-auto border border-gray-200 rounded-lg">
                    {filteredPatients.length > 0 ? (
                      filteredPatients.map((patient) => (
                        <button
                          key={patient.id}
                          type="button"
                          onClick={() => handlePatientSelect(patient.id)}
                          className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b border-gray-100 last:border-b-0 transition-colors"
                        >
                          <div className="font-medium text-gray-900">
                            {patient.prenom} {patient.nom}
                          </div>
                          <div className="text-sm text-gray-500">
                            CIN: {patient.cin}
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="px-4 py-3 text-gray-500 text-center">
                        Aucun patient trouvé
                      </div>
                    )}
                  </div>
                )}

                {/* Sélection par dropdown si pas de recherche */}
                {!patientSearch && (
                  <select
                    value={selectedPatient}
                    onChange={handlePatientChange}
                    required
                    className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors ${
                      fieldValidation.patient.valid
                        ? "border-green-300"
                        : fieldValidation.patient.message
                          ? "border-red-300"
                          : "border-gray-300"
                    }`}
                  >
                    <option value="">Sélectionner un patient</option>
                    {patients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.prenom} {patient.nom} - {patient.cin}
                      </option>
                    ))}
                  </select>
                )}

                {renderValidationMessage("patient")}
              </div>
            ) : (
              /* Patient pré-sélectionné */
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <User className="w-5 h-5 text-green-600 mr-2" />
                    <CheckCircle className="w-4 h-4 text-green-600 mr-2" />
                    <div>
                      <span className="text-sm font-medium text-green-800">
                        Patient sélectionné:
                      </span>
                      {selectedPatientInfo ? (
                        <div className="text-green-700">
                          {selectedPatientInfo.prenom} {selectedPatientInfo.nom}{" "}
                          ({selectedPatientInfo.cin})
                        </div>
                      ) : (
                        <div className="text-green-700">
                          Chargement des informations...
                        </div>
                      )}
                    </div>
                  </div>
                  {/* Option pour changer de patient */}
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedPatient("");
                      setSelectedPatientInfo(null);
                      setFieldValidation((prev) => ({
                        ...prev,
                        patient: {
                          valid: false,
                          message: "Sélectionnez un patient",
                        },
                      }));
                    }}
                    className="text-sm text-green-600 hover:text-green-800 underline"
                  >
                    Changer de patient
                  </button>
                </div>
              </div>
            )}

            {/* 🆕 ASSISTANT SMART DATE+HEURE */}
            <div className="col-span-full">
              <div className="bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center mr-3">
                      <Sparkles className="w-6 h-6 text-indigo-600" />
                    </div>
                    <div>
                      <h3 className="font-medium text-indigo-900">Assistant IA Intelligent</h3>
                      <p className="text-sm text-indigo-700">
                        Laissez l'IA suggérer automatiquement la date et l'heure optimales selon le motif
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleOpenSmartDateTime}
                    disabled={!formData.motif.trim()}
                    className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-indigo-600 to-purple-600 text-white font-medium rounded-lg hover:from-indigo-700 hover:to-purple-700 disabled:from-gray-400 disabled:to-gray-400 disabled:cursor-not-allowed transition-all duration-200 shadow-sm"
                    title={
                      !formData.motif.trim()
                        ? "Renseignez d'abord le motif de consultation"
                        : "L'IA analysera le motif pour suggérer les meilleurs créneaux"
                    }
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Suggestion Intelligente
                  </button>
                </div>
                
                {/* Indicateur si date/heure sélectionnées par IA */}
                {formData.date_rendez_vous && formData.heure && (
                  <div className="mt-3 flex items-center text-sm text-indigo-600">
                    <Sparkles className="w-4 h-4 mr-1" />
                    <span>
                      Créneau sélectionné par IA : {formData.date_rendez_vous} à {formData.heure}
                    </span>
                  </div>
                )}
              </div>
            </div>

            {/* Motif - Déplacé avant Date/Heure pour logique IA */}
            <div>
              <div className="flex items-center mb-2">
                <label
                  htmlFor="motif"
                  className="block text-sm font-medium text-gray-700 mr-2"
                >
                  Motif du rendez-vous *
                </label>
                {renderValidationIcon("motif")}
              </div>
              <textarea
                id="motif"
                name="motif"
                value={formData.motif}
                onChange={handleInputChange}
                placeholder="Décrivez le motif du rendez-vous (minimum 10 caractères)"
                required
                rows={4}
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors resize-vertical ${
                  fieldValidation.motif.valid
                    ? "border-green-300"
                    : fieldValidation.motif.message
                      ? "border-red-300"
                      : "border-gray-300"
                }`}
              />
              <div className="flex justify-between items-center mt-1">
                {renderValidationMessage("motif")}
                <span className="text-xs text-gray-400">
                  {formData.motif.length} / 10 min.
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Date - Version améliorée */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="date_rendez_vous"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Date du rendez-vous *
                  </label>
                  <div className="flex items-center space-x-1">
                    {renderValidationIcon("date")}
                    {formData.date_rendez_vous && (
                      <button
                        type="button"
                        onClick={handleOpenSmartDateTime}
                        disabled={!formData.motif.trim()}
                        className="text-xs text-indigo-600 hover:text-indigo-700 underline"
                        title="Réoptimiser avec l'IA"
                      >
                        Réoptimiser
                      </button>
                    )}
                  </div>
                </div>
                <input
                  type="date"
                  id="date_rendez_vous"
                  name="date_rendez_vous"
                  value={formData.date_rendez_vous}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split("T")[0]}
                  required
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors ${
                    fieldValidation.date.valid
                      ? "border-green-300 bg-green-50"
                      : fieldValidation.date.message
                        ? "border-red-300"
                        : "border-gray-300"
                  }`}
                />
                {renderValidationMessage("date")}
              </div>

              {/* Heure - Version améliorée avec double fonctionnalité */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label
                    htmlFor="heure"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Heure *
                  </label>
                  <div className="flex items-center space-x-2">
                    {renderValidationIcon("heure")}
                    {/* Bouton Planification IA classique (pour date spécifique) */}
                    {formData.date_rendez_vous && (
                      <button
                        type="button"
                        onClick={handleOpenAIPlanningAssistant}
                        disabled={!formData.date_rendez_vous || !formData.motif.trim()}
                        className="inline-flex items-center px-2 py-1 bg-purple-600 text-white text-xs rounded hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                        title="Optimiser les créneaux pour cette date"
                      >
                        <Brain className="w-3 h-3 mr-1" />
                        Optimiser
                      </button>
                    )}
                  </div>
                </div>
                
                <select
                  id="heure"
                  name="heure"
                  value={formData.heure}
                  onChange={handleInputChange}
                  required
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent transition-colors ${
                    fieldValidation.heure.valid
                      ? "border-green-300 bg-green-50"
                      : fieldValidation.heure.message
                        ? "border-red-300"
                        : "border-gray-300"
                  }`}
                >
                  <option value="">Sélectionnez une heure</option>
                  {timeSlots.map((slot) => {
                    const isOccupied = isSlotOccupied(slot);
                    return (
                      <option
                        key={slot}
                        value={slot}
                        disabled={isOccupied}
                        className={
                          isOccupied ? "text-gray-400 bg-gray-100" : ""
                        }
                      >
                        {slot} {isOccupied ? "(Occupé)" : ""}
                      </option>
                    );
                  })}
                </select>
                
                {renderValidationMessage("heure")}
                
                {/* 🆕 INDICATEUR IA SMART */}
                {formData.date_rendez_vous && formData.heure && (
                  <div className="mt-2 p-2 bg-indigo-50 border border-indigo-200 rounded text-sm">
                    <div className="flex items-center text-indigo-700">
                      <Sparkles className="w-4 h-4 mr-1" />
                      <span className="font-medium">Suggestion IA active</span>
                    </div>
                    <div className="text-indigo-600 text-xs mt-1">
                      Créneau optimisé selon l'analyse du motif de consultation
                    </div>
                  </div>
                )}

                {/* Affichage des créneaux occupés */}
                {formData.date_rendez_vous && occupiedSlots.size > 0 && (
                  <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                    <div className="flex items-center mb-2">
                      <Clock className="w-4 h-4 text-yellow-600 mr-2" />
                      <span className="text-xs font-medium text-yellow-800">
                        Créneaux occupés le{" "}
                        {format(
                          new Date(formData.date_rendez_vous),
                          "dd MMMM yyyy",
                          { locale: fr },
                        )}{" "}
                        :
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(occupiedSlots)
                        .filter((slot) =>
                          slot.startsWith(formData.date_rendez_vous),
                        )
                        .map((slot) => {
                          const time = slot.split("-")[1];
                          return (
                            <span
                              key={slot}
                              className="text-xs bg-yellow-100 text-yellow-700 px-2 py-1 rounded"
                            >
                              {time}
                            </span>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <button
                type="submit"
                disabled={!isFormValid || loading || loadingValidation}
                className={`flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-colors shadow-sm ${
                  isFormValid && !loading && !loadingValidation
                    ? "bg-green-600 text-white hover:bg-green-700"
                    : "bg-gray-400 text-white cursor-not-allowed"
                }`}
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                ) : (
                  <Save className="w-5 h-5 mr-2" />
                )}
                {loading ? "Programmation..." : "Programmer le rendez-vous"}
              </button>

              <button
                type="button"
                onClick={() =>
                  finalPatientId
                    ? navigate(`/patients/id/${finalPatientId}`)
                    : navigate("/rendez-vous")
                }
                disabled={loading}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Annuler
              </button>
            </div>
          </form>
        </div>

        {/* Required fields notice */}
        <div className="mt-4 text-sm text-gray-500 flex items-center">
          <span className="mr-2">* Champs obligatoires</span>
          {isFormValid && (
            <div className="flex items-center text-green-600">
              <CheckCircle className="w-4 h-4 mr-1" />
              <span>Formulaire valide</span>
            </div>
          )}
        </div>

        {/* Validation Summary */}
        {!isFormValid && (
          <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-orange-800 mb-2">
                  Vérifications requises :
                </h4>
                <ul className="text-sm text-orange-700 space-y-1">
                  {!fieldValidation.patient.valid && (
                    <li>
                      •{" "}
                      {fieldValidation.patient.message ||
                        "Sélectionnez un patient"}
                    </li>
                  )}
                  {!fieldValidation.date.valid && (
                    <li>
                      •{" "}
                      {fieldValidation.date.message ||
                        "Sélectionnez une date valide"}
                    </li>
                  )}
                  {!fieldValidation.heure.valid && (
                    <li>
                      •{" "}
                      {fieldValidation.heure.message ||
                        "Choisissez une heure disponible"}
                    </li>
                  )}
                  {!fieldValidation.motif.valid && (
                    <li>
                      •{" "}
                      {fieldValidation.motif.message ||
                        "Décrivez le motif (min. 10 caractères)"}
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Info box */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0">
              ℹ️
            </div>
            <div>
              <h4 className="text-sm font-medium text-blue-800 mb-2">
                Informations importantes
              </h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>
                  • Les créneaux disponibles sont de 8h00 à 18h45 par tranches
                  de 15 minutes
                </li>
                <li>• Les rendez-vous ne sont pas disponibles le week-end</li>
                <li>
                  • Le système vérifie automatiquement les conflits d'horaires
                </li>
                <li>
                  • Un patient ne peut avoir qu'un seul rendez-vous par jour
                </li>
                <li>
                  • 🧠 L'assistant IA intelligent peut suggérer automatiquement la date et l'heure optimales
                </li>
                <li>
                  • ⚡ Deux modes : Suggestion globale (motif seul) ou optimisation d'une date spécifique
                </li>
                {!finalPatientId && (
                  <li>
                    • Utilisez la barre de recherche pour trouver rapidement un
                    patient
                  </li>
                )}
                {finalPatientId && (
                  <li>
                    • Le patient a été automatiquement sélectionné selon le
                    contexte
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>

        {/* Statistics */}
        {formData.date_rendez_vous && existingRendezVous.length > 0 && (
          <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <Calendar className="w-5 h-5 text-gray-600 mr-2" />
              <h4 className="text-sm font-medium text-gray-800">
                Activité du{" "}
                {format(new Date(formData.date_rendez_vous), "dd MMMM yyyy", {
                  locale: fr,
                })}
              </h4>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-gray-900">
                  {
                    Array.from(occupiedSlots).filter((slot) =>
                      slot.startsWith(formData.date_rendez_vous),
                    ).length
                  }
                </div>
                <div className="text-xs text-gray-500">Créneaux occupés</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {timeSlots.length -
                    Array.from(occupiedSlots).filter((slot) =>
                      slot.startsWith(formData.date_rendez_vous),
                    ).length}
                </div>
                <div className="text-xs text-gray-500">
                  Créneaux disponibles
                </div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {timeSlots.length}
                </div>
                <div className="text-xs text-gray-500">Total créneaux</div>
              </div>
            </div>
          </div>
        )}

        {/* Guide d'utilisation IA */}
        <div className="mt-6 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-lg p-4">
          <div className="flex items-start">
            <div className="w-6 h-6 text-indigo-600 mt-0.5 mr-3 flex-shrink-0">
              <Sparkles className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-medium text-indigo-800 mb-2">
                Guide d'utilisation de l'Assistant IA
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-indigo-700">
                <div>
                  <h5 className="font-medium mb-1">🧠 Suggestion Intelligente</h5>
                  <ul className="space-y-1 text-xs">
                    <li>• Analysez le motif pour suggérer date + heure</li>
                    <li>• Détection automatique de l'urgence</li>
                    <li>• Optimisation globale du planning</li>
                  </ul>
                </div>
                <div>
                  <h5 className="font-medium mb-1">⚡ Optimisation Ciblée</h5>
                  <ul className="space-y-1 text-xs">
                    <li>• Optimise les créneaux d'une date précise</li>
                    <li>• Analyse de la charge de travail</li>
                    <li>• Suggestions de pauses optimales</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 🆕 MODAL SMART DATE+HEURE */}
      <SmartDateTimeModal
        isOpen={isSmartDateTimeModalOpen}
        onClose={() => setIsSmartDateTimeModalOpen(false)}
        medecinId={(user?.role === "medecin" ? (user as any)?._id || user?.id : "") || ""}
        motif={formData.motif}
        onSelectDateTime={handleSmartDateTimeSelect}
        patientInfo={selectedPatientInfo}
      />
      
      {/* 🤖 MODAL PLANIFICATION IA */}
      <AIPlanningModal
        isOpen={isAIPlanningModalOpen}
        onClose={() => setIsAIPlanningModalOpen(false)}
        medecinId={(user?.role === "medecin" ? (user as any)?._id || user?.id : "") || ""}
        dateRendezVous={formData.date_rendez_vous}
        motif={formData.motif}
        onSelectSlot={handleAISlotSelect}
        existingSlots={Array.from(occupiedSlots)
          .filter((slot) => slot.startsWith(formData.date_rendez_vous))
          .map((slot) => slot.split("-")[1])
        }
      />
    </div>
  );
};

export default AddRendezVous;