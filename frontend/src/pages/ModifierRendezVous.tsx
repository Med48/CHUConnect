import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Save,
  Calendar,
  User,
  Clock,
  Search,
  AlertTriangle,
  CheckCircle,
  Edit,
} from "lucide-react";
import { rendezVousApi, patientsApi } from "../services/api";
import { RendezVous, Patient } from "../types";
import { useAuth } from "../contexts/AuthContext";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import LoadingSpinner from "../components/common/LoadingSpinner";
import ErrorMessage from "../components/common/ErrorMessage";

const ModifierRendezVous: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

  // États
  const [loading, setLoading] = useState(true);
  const [loadingValidation, setLoadingValidation] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validationMessage, setValidationMessage] = useState<string | null>(
    null,
  );
  const [rendezVous, setRendezVous] = useState<RendezVous | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<string>("");
  const [patientSearch, setPatientSearch] = useState<string>("");
  const [filteredPatients, setFilteredPatients] = useState<Patient[]>([]);
  const [existingRendezVous, setExistingRendezVous] = useState<RendezVous[]>(
    [],
  );
  const [occupiedSlots, setOccupiedSlots] = useState<Set<string>>(new Set());

  const [formData, setFormData] = useState({
    date_rendez_vous: "",
    heure: "",
    motif: "",
    statut: "programme" as "programme" | "confirme" | "annule" | "termine",
  });

  const [originalData, setOriginalData] = useState({
    date_rendez_vous: "",
    heure: "",
    motif: "",
    statut: "programme" as "programme" | "confirme" | "annule" | "termine",
    patient_id: "",
  });

  // Validation en temps réel
  const [fieldValidation, setFieldValidation] = useState({
    patient: { valid: true, message: "" },
    date: { valid: true, message: "" },
    heure: { valid: true, message: "" },
    motif: { valid: true, message: "" },
    statut: { valid: true, message: "" },
  });

  // Charger les données initiales
  useEffect(() => {
    if (id) {
      loadRendezVousData();
    }
  }, [id]);

  // Charger les patients quand nécessaire
  useEffect(() => {
    loadPatients();
    loadExistingRendezVous();
  }, []);

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
  }, [formData.date_rendez_vous, existingRendezVous, id]);

  // Validation en temps réel
  useEffect(() => {
    validateFields();
  }, [formData, selectedPatient, occupiedSlots]);

  const loadRendezVousData = async () => {
    try {
      setLoading(true);
      console.log("📋 Chargement du rendez-vous ID:", id);

      const rdvData = await rendezVousApi.getById(id!);
      console.log("✅ Données RDV reçues:", rdvData);
      console.log(
        "🔍 Type de date_rendez_vous:",
        typeof rdvData.date_rendez_vous,
        rdvData.date_rendez_vous,
      );

      // Vérifier les permissions selon le rôle
      let hasPermission = false;

      if (user?.role === "medecin") {
        // Pour un médecin, vérifier que c'est son rendez-vous
        const medecinId = (user as any)?._id || user?.id;
        hasPermission = rdvData.medecin_id === medecinId;
      } else if (user?.role === "secretaire") {
        // Pour une secrétaire, vérifier que c'est un rendez-vous de son médecin associé
        try {
          const userId = (user as any)?._id || user?.id;
          const userResponse = await fetch(
            `${API_BASE_URL}/users/${userId}`,
          );
          if (userResponse.ok) {
            const userData = await userResponse.json();
            const medecinAssocie =
              userData.medecin_id ||
              userData.medecin?.id ||
              userData.medecin?._id;
            hasPermission = rdvData.medecin_id === medecinAssocie;
            console.log("👩‍💼 Secrétaire - vérification permission RDV:", {
              rdvMedecinId: rdvData.medecin_id,
              medecinAssocie: medecinAssocie,
              hasPermission,
            });
          }
        } catch (error) {
          console.error(
            "❌ Erreur lors de la vérification des permissions:",
            error,
          );
          hasPermission = false;
        }
      }

      if (!hasPermission) {
        setError("Vous n'êtes pas autorisé à modifier ce rendez-vous");
        return;
      }

      // Convertir la date en format string si nécessaire
      let dateString = rdvData.date_rendez_vous;
      if (rdvData.date_rendez_vous instanceof Date) {
        // Si c'est un objet Date, convertir en format YYYY-MM-DD
        dateString = rdvData.date_rendez_vous.toISOString().split("T")[0];
        console.log("📅 Date convertie de Date vers string:", dateString);
      } else if (typeof rdvData.date_rendez_vous === "string") {
        // Si c'est une string, extraire la partie date (YYYY-MM-DD)
        dateString = rdvData.date_rendez_vous.split("T")[0];
        console.log("📅 Date extraite de string:", dateString);
      } else {
        // Essayer de créer une date à partir de la valeur reçue
        try {
          const date = new Date(rdvData.date_rendez_vous);
          dateString = date.toISOString().split("T")[0];
          console.log("📅 Date créée et convertie:", dateString);
        } catch (dateError) {
          console.error(
            "❌ Impossible de convertir la date:",
            rdvData.date_rendez_vous,
          );
          dateString = "";
        }
      }

      setRendezVous(rdvData);

      // Pré-remplir le formulaire avec les données existantes
      const initialData = {
        date_rendez_vous: dateString,
        heure: rdvData.heure,
        motif: rdvData.motif,
        statut: rdvData.statut as
          | "programme"
          | "confirme"
          | "annule"
          | "termine",
      };

      setFormData(initialData);
      setOriginalData({
        ...initialData,
        patient_id: rdvData.patient_id,
      });
      setSelectedPatient(rdvData.patient_id);

      console.log("✅ Formulaire pré-rempli:", initialData);
    } catch (error) {
      console.error("❌ Erreur lors du chargement du rendez-vous:", error);
      setError("Impossible de charger les données du rendez-vous");
    } finally {
      setLoading(false);
    }
  };

  const loadPatients = async () => {
    try {
      const response = await patientsApi.getAll(1, 200);
      setPatients(response.items);
      setFilteredPatients(response.items);
    } catch (error) {
      console.error("Erreur lors du chargement des patients:", error);
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
          rdv.medecin_id === targetMedecinId &&
          rdv.statut !== "annule" &&
          rdv.id !== id, // Exclure le RDV en cours de modification
      );

      setExistingRendezVous(rendezVousMedecin);
      console.log(
        `✅ ${rendezVousMedecin.length} autres rendez-vous chargés pour validation`,
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

  const validateFields = () => {
    const newValidation = { ...fieldValidation };

    // Validation du patient
    if (selectedPatient) {
      const patient = patients.find((p) => p.id === selectedPatient);
      newValidation.patient = {
        valid: true,
        message: patient
          ? `${patient.prenom} ${patient.nom}`
          : "Patient sélectionné",
      };
    } else {
      newValidation.patient = {
        valid: false,
        message: "Sélectionnez un patient",
      };
    }

    // Validation de la date
    if (formData.date_rendez_vous) {
      const selectedDate = new Date(formData.date_rendez_vous);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (selectedDate < today) {
        newValidation.date = {
          valid: false,
          message: "La date ne peut pas être dans le passé",
        };
      } else {
        const dayOfWeek = selectedDate.getDay();
        if (dayOfWeek === 0 || dayOfWeek === 6) {
          newValidation.date = {
            valid: false,
            message: "Pas de RDV le week-end",
          };
        } else {
          newValidation.date = {
            valid: true,
            message: format(selectedDate, "dd MMMM yyyy", { locale: fr }),
          };
        }
      }
    } else {
      newValidation.date = { valid: false, message: "Sélectionnez une date" };
    }

    // Validation de l'heure
    if (formData.heure && formData.date_rendez_vous) {
      const slotKey = `${formData.date_rendez_vous}-${formData.heure}`;
      const isOriginalSlot =
        originalData.date_rendez_vous === formData.date_rendez_vous &&
        originalData.heure === formData.heure;

      if (occupiedSlots.has(slotKey) && !isOriginalSlot) {
        newValidation.heure = {
          valid: false,
          message: "Ce créneau est déjà occupé",
        };
      } else {
        newValidation.heure = {
          valid: true,
          message: `Créneau: ${formData.heure}`,
        };
      }
    } else if (formData.heure) {
      newValidation.heure = {
        valid: true,
        message: `Heure: ${formData.heure}`,
      };
    } else {
      newValidation.heure = { valid: false, message: "Sélectionnez une heure" };
    }

    // Validation du motif
    if (formData.motif.trim()) {
      if (formData.motif.trim().length < 10) {
        newValidation.motif = {
          valid: false,
          message: "Minimum 10 caractères requis",
        };
      } else {
        newValidation.motif = { valid: true, message: "Motif valide" };
      }
    } else {
      newValidation.motif = { valid: false, message: "Décrivez le motif" };
    }

    // Validation du statut
    newValidation.statut = {
      valid: true,
      message: `Statut: ${getStatusLabel(formData.statut)}`,
    };

    setFieldValidation(newValidation);
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
    setPatientSearch("");
  };

  const handlePatientSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setPatientSearch(e.target.value);
  };

  const handlePatientSelect = (patientId: string) => {
    setSelectedPatient(patientId);
    setPatientSearch("");
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

    // Vérifier les conflits d'horaires (sauf si c'est le créneau original)
    const slotKey = `${formData.date_rendez_vous}-${formData.heure}`;
    const isOriginalSlot =
      originalData.date_rendez_vous === formData.date_rendez_vous &&
      originalData.heure === formData.heure;

    if (occupiedSlots.has(slotKey) && !isOriginalSlot) {
      setError("Ce créneau est déjà occupé. Veuillez choisir une autre heure.");
      return false;
    }

    // Vérifier si le patient a un autre RDV le même jour (sauf le RDV actuel)
    if (
      selectedPatient !== originalData.patient_id ||
      formData.date_rendez_vous !== originalData.date_rendez_vous
    ) {
      const patientRdvSameDay = existingRendezVous.find(
        (rdv) =>
          rdv.patient_id === selectedPatient &&
          rdv.date_rendez_vous === formData.date_rendez_vous &&
          rdv.statut !== "annule" &&
          rdv.id !== id,
      );

      if (patientRdvSameDay) {
        const patientName = patients.find((p) => p.id === selectedPatient);
        setError(
          `${patientName?.prenom} ${patientName?.nom} a déjà un autre rendez-vous le ${format(selectedDate, "dd MMMM yyyy", { locale: fr })} à ${patientRdvSameDay.heure}`,
        );
        return false;
      }
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

    try {
      setSaving(true);
      setError(null);

      const updatedData = {
        patient_id: selectedPatient,
        medecin_id: rendezVous!.medecin_id, // Garder le même médecin
        date_rendez_vous: formData.date_rendez_vous,
        heure: formData.heure,
        motif: formData.motif.trim(),
        statut: formData.statut,
      };

      console.log("📤 Données de modification à envoyer:", updatedData);

      await rendezVousApi.update(id!, updatedData);

      setValidationMessage("Rendez-vous modifié avec succès !");

      // Redirection après un court délai
      setTimeout(() => {
        navigate("/rendez-vous");
      }, 1500);
    } catch (error) {
      console.error("❌ Erreur lors de la modification:", error);
      setError("Erreur lors de la modification du rendez-vous");
    } finally {
      setSaving(false);
    }
  };

  const getStatusLabel = (statut: string) => {
    switch (statut) {
      case "programme":
        return "Programmé";
      case "confirme":
        return "Confirmé";
      case "annule":
        return "Annulé";
      case "termine":
        return "Terminé";
      default:
        return statut;
    }
  };

  const getStatusColor = (statut: string) => {
    switch (statut) {
      case "programme":
        return "bg-blue-100 text-blue-800";
      case "confirme":
        return "bg-green-100 text-green-800";
      case "annule":
        return "bg-red-100 text-red-800";
      case "termine":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const formatDateForDisplay = (dateValue: any): string => {
    try {
      if (!dateValue) return "Date inconnue";

      let date: Date;
      if (dateValue instanceof Date) {
        date = dateValue;
      } else {
        date = new Date(dateValue);
      }

      if (isNaN(date.getTime())) {
        return "Date invalide";
      }

      return format(date, "dd MMMM yyyy", { locale: fr });
    } catch (error) {
      console.error("Erreur de formatage de date:", error);
      return "Date invalide";
    }
  };

  const isFormValid = Object.values(fieldValidation).every(
    (field) => field.valid,
  );
  const hasChanges =
    JSON.stringify({ ...formData, patient_id: selectedPatient }) !==
    JSON.stringify(originalData);

  // Générer les créneaux horaires
  const generateTimeSlots = () => {
    const slots = [];
    for (let hour = 8; hour <= 18; hour++) {
      for (let minute = 0; minute < 60; minute += 30) {
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
    const isOriginalSlot =
      originalData.date_rendez_vous === formData.date_rendez_vous &&
      originalData.heure === time;
    return occupiedSlots.has(slotKey) && !isOriginalSlot;
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

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
        <span className="ml-3 text-gray-600">Chargement du rendez-vous...</span>
      </div>
    );
  }

  if (!rendezVous) {
    return (
      <div className="min-h-screen bg-gray-50 py-8 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Rendez-vous introuvable
          </h1>
          <p className="text-gray-600 mb-6">
            Le rendez-vous demandé n'existe pas ou n'est plus disponible.
          </p>
          <button
            onClick={() => navigate("/rendez-vous")}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Retour aux rendez-vous
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center text-gray-600 hover:text-gray-800 mb-4 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2" />
            Retour
          </button>
          <div className="flex items-center">
            <div className="w-12 h-12 bg-orange-100 rounded-full flex items-center justify-center mr-4">
              <Edit className="w-6 h-6 text-orange-600" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-gray-900">
                Modifier le rendez-vous
              </h1>
              {rendezVous.patient && (
                <p className="text-gray-600">
                  Patient: {rendezVous.patient.prenom} {rendezVous.patient.nom}{" "}
                  •{formatDateForDisplay(rendezVous.date_rendez_vous)} à{" "}
                  {rendezVous.heure}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Current Status */}
        <div className="mb-6 bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <span className="text-sm font-medium text-gray-700 mr-3">
                Statut actuel:
              </span>
              <span
                className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(rendezVous.statut)}`}
              >
                {getStatusLabel(rendezVous.statut)}
              </span>
            </div>
            {hasChanges && (
              <div className="flex items-center text-orange-600">
                <AlertTriangle className="w-4 h-4 mr-1" />
                <span className="text-sm">Modifications non sauvegardées</span>
              </div>
            )}
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
          <ErrorMessage message={error} onDismiss={() => setError(null)} />
        )}

        {/* Form Card */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Sélection du patient */}
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
                  className="block w-full pl-10 pr-3 py-3 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-orange-500 focus:border-orange-500"
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
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors ${
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

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Date */}
              <div>
                <div className="flex items-center mb-2">
                  <label
                    htmlFor="date_rendez_vous"
                    className="block text-sm font-medium text-gray-700 mr-2"
                  >
                    Date du rendez-vous *
                  </label>
                  {renderValidationIcon("date")}
                </div>
                <input
                  type="date"
                  id="date_rendez_vous"
                  name="date_rendez_vous"
                  value={formData.date_rendez_vous}
                  onChange={handleInputChange}
                  min={new Date().toISOString().split("T")[0]}
                  required
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors ${
                    fieldValidation.date.valid
                      ? "border-green-300"
                      : fieldValidation.date.message
                        ? "border-red-300"
                        : "border-gray-300"
                  }`}
                />
                {renderValidationMessage("date")}
              </div>

              {/* Heure */}
              <div>
                <div className="flex items-center mb-2">
                  <label
                    htmlFor="heure"
                    className="block text-sm font-medium text-gray-700 mr-2"
                  >
                    Heure *
                  </label>
                  {renderValidationIcon("heure")}
                </div>
                <select
                  id="heure"
                  name="heure"
                  value={formData.heure}
                  onChange={handleInputChange}
                  required
                  className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors ${
                    fieldValidation.heure.valid
                      ? "border-green-300"
                      : fieldValidation.heure.message
                        ? "border-red-300"
                        : "border-gray-300"
                  }`}
                >
                  <option value="">Sélectionnez une heure</option>
                  {timeSlots.map((slot) => {
                    const isOccupied = isSlotOccupied(slot);
                    const isOriginal = originalData.heure === slot;
                    return (
                      <option
                        key={slot}
                        value={slot}
                        disabled={isOccupied}
                        className={
                          isOccupied
                            ? "text-gray-400 bg-gray-100"
                            : isOriginal
                              ? "font-medium"
                              : ""
                        }
                      >
                        {slot}{" "}
                        {isOccupied ? "(Occupé)" : isOriginal ? "(Actuel)" : ""}
                      </option>
                    );
                  })}
                </select>
                {renderValidationMessage("heure")}
              </div>
            </div>

            {/* Statut */}
            <div>
              <div className="flex items-center mb-2">
                <label
                  htmlFor="statut"
                  className="block text-sm font-medium text-gray-700 mr-2"
                >
                  Statut *
                </label>
                {renderValidationIcon("statut")}
              </div>
              <select
                id="statut"
                name="statut"
                value={formData.statut}
                onChange={handleInputChange}
                required
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors"
              >
                <option value="programme">Programmé</option>
                <option value="confirme">Confirmé</option>
                <option value="annule">Annulé</option>
                <option value="termine">Terminé</option>
              </select>
              {renderValidationMessage("statut")}
            </div>

            {/* Motif */}
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
                className={`w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-colors resize-vertical ${
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

            {/* Actions */}
            <div className="flex flex-col sm:flex-row gap-4 pt-6">
              <button
                type="submit"
                disabled={
                  !isFormValid || !hasChanges || saving || loadingValidation
                }
                className={`flex items-center justify-center px-6 py-3 rounded-lg font-medium transition-colors shadow-sm ${
                  isFormValid && hasChanges && !saving && !loadingValidation
                    ? "bg-orange-600 text-white hover:bg-orange-700"
                    : "bg-gray-400 text-white cursor-not-allowed"
                }`}
              >
                {saving ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                ) : (
                  <Save className="w-5 h-5 mr-2" />
                )}
                {saving ? "Sauvegarde..." : "Sauvegarder les modifications"}
              </button>

              <button
                type="button"
                onClick={() => navigate("/rendez-vous")}
                disabled={saving}
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Annuler
              </button>

              {/* Bouton de réinitialisation */}
              {hasChanges && (
                <button
                  type="button"
                  onClick={() => {
                    setFormData({
                      date_rendez_vous: originalData.date_rendez_vous,
                      heure: originalData.heure,
                      motif: originalData.motif,
                      statut: originalData.statut,
                    });
                    setSelectedPatient(originalData.patient_id);
                    setPatientSearch("");
                  }}
                  disabled={saving}
                  className="px-6 py-3 border border-orange-300 text-orange-700 rounded-lg hover:bg-orange-50 transition-colors disabled:opacity-50"
                >
                  Réinitialiser
                </button>
              )}
            </div>
          </form>
        </div>

        {/* Status Information */}
        <div className="mt-4 flex items-center justify-between text-sm text-gray-500">
          <div className="flex items-center">
            <span className="mr-2">* Champs obligatoires</span>
            {isFormValid && hasChanges && (
              <div className="flex items-center text-orange-600">
                <CheckCircle className="w-4 h-4 mr-1" />
                <span>Prêt à sauvegarder</span>
              </div>
            )}
            {isFormValid && !hasChanges && (
              <div className="flex items-center text-green-600">
                <CheckCircle className="w-4 h-4 mr-1" />
                <span>Aucune modification</span>
              </div>
            )}
          </div>
          <div className="text-xs text-gray-400">ID: {rendezVous.id}</div>
        </div>

        {/* Validation Summary */}
        {!isFormValid && (
          <div className="mt-4 bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start">
              <AlertTriangle className="w-5 h-5 text-orange-600 mt-0.5 mr-3 flex-shrink-0" />
              <div>
                <h4 className="text-sm font-medium text-orange-800 mb-2">
                  Corrections nécessaires :
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

        {/* Changes Summary */}
        {hasChanges && isFormValid && (
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start">
              <div className="w-5 h-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0">
                📝
              </div>
              <div>
                <h4 className="text-sm font-medium text-blue-800 mb-2">
                  Modifications détectées :
                </h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  {selectedPatient !== originalData.patient_id && (
                    <li>• Patient modifié</li>
                  )}
                  {formData.date_rendez_vous !==
                    originalData.date_rendez_vous && (
                    <li>
                      • Date modifiée:{" "}
                      {format(
                        new Date(formData.date_rendez_vous),
                        "dd MMMM yyyy",
                        { locale: fr },
                      )}
                    </li>
                  )}
                  {formData.heure !== originalData.heure && (
                    <li>• Heure modifiée: {formData.heure}</li>
                  )}
                  {formData.motif !== originalData.motif && (
                    <li>• Motif modifié</li>
                  )}
                  {formData.statut !== originalData.statut && (
                    <li>• Statut modifié: {getStatusLabel(formData.statut)}</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Affichage des créneaux occupés */}
        {formData.date_rendez_vous && occupiedSlots.size > 0 && (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-center mb-3">
              <Clock className="w-5 h-5 text-yellow-600 mr-2" />
              <h4 className="text-sm font-medium text-yellow-800">
                Créneaux occupés le{" "}
                {format(new Date(formData.date_rendez_vous), "dd MMMM yyyy", {
                  locale: fr,
                })}
              </h4>
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from(occupiedSlots)
                .filter((slot) => slot.startsWith(formData.date_rendez_vous))
                .map((slot) => {
                  const time = slot.split("-")[1];
                  const isOriginal =
                    originalData.date_rendez_vous ===
                      formData.date_rendez_vous && originalData.heure === time;
                  return (
                    <span
                      key={slot}
                      className={`text-xs px-2 py-1 rounded ${
                        isOriginal
                          ? "bg-blue-100 text-blue-700 font-medium"
                          : "bg-yellow-100 text-yellow-700"
                      }`}
                    >
                      {time} {isOriginal ? "(Actuel)" : ""}
                    </span>
                  );
                })}
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
                Informations sur la modification
              </h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Vous pouvez modifier tous les détails du rendez-vous</li>
                <li>
                  • Le système vérifie automatiquement les conflits d'horaires
                </li>
                <li>
                  • Votre créneau actuel reste disponible durant la modification
                </li>
                <li>• Les modifications sont sauvegardées immédiatement</li>
                <li>
                  • Un patient ne peut avoir qu'un seul rendez-vous par jour
                </li>
              </ul>
            </div>
          </div>
        </div>

        {/* History/Audit Trail (optionnel) */}
        <div className="mt-6 bg-gray-50 border border-gray-200 rounded-lg p-4">
          <div className="flex items-center mb-3">
            <Calendar className="w-5 h-5 text-gray-600 mr-2" />
            <h4 className="text-sm font-medium text-gray-800">
              Informations du rendez-vous
            </h4>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
            <div>
              <span className="font-medium">Créé le:</span>{" "}
              {format(
                new Date(rendezVous.created_at || new Date()),
                "dd/MM/yyyy à HH:mm",
                { locale: fr },
              )}
            </div>
            <div>
              <span className="font-medium">Médecin:</span> Dr. {user?.nom}
            </div>
            <div>
              <span className="font-medium">ID:</span> {rendezVous.id}
            </div>
            <div>
              <span className="font-medium">Statut original:</span>
              <span
                className={`ml-2 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(rendezVous.statut)}`}
              >
                {getStatusLabel(rendezVous.statut)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModifierRendezVous;
