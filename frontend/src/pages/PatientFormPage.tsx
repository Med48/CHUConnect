import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { yupResolver } from "@hookform/resolvers/yup";
import * as yup from "yup";
import { Save, ArrowLeft, User, Camera, X, Upload } from "lucide-react";
import { Patient } from "../types";
import { patientsApi } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import LoadingSpinner from "../components/common/LoadingSpinner";
import ErrorMessage from "../components/common/ErrorMessage";

// ✅ CONFIGURATION CORRECTE de l'API selon votre structure de routes
const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const schema = yup.object({
  nom: yup
    .string()
    .required("Le nom est requis")
    .min(2, "Le nom doit contenir au moins 2 caractères"),
  prenom: yup
    .string()
    .required("Le prénom est requis")
    .min(2, "Le prénom doit contenir au moins 2 caractères"),
  cin: yup
    .string()
    .required("Le CIN est requis")
    .matches(/^[A-Z]{1,2}[0-9]{6}$/, "Format CIN invalide (ex: A123456)"),
  genre: yup
    .string()
    .required("Le genre est requis")
    .oneOf(["M", "F"], "Genre invalide"),
  date_naissance: yup.string().required("La date de naissance est requise"),
  telephone: yup
    .string()
    .matches(/^[0-9+\-\s()]*$/, "Format de téléphone invalide")
    .nullable(),
  adresse: yup.string().nullable(),
  email: yup.string().email("Format email invalide").nullable(),
});

type PatientFormData = Omit<Patient, "id" | "created_at" | "updated_at">;

const PatientFormPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { isMedecin, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [initialLoading, setInitialLoading] = useState(!!id);
  const [completeMedecinId, setCompleteMedecinId] = useState<string | null>(
    null,
  );

  // États pour la photo
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [existingPhotoUrl, setExistingPhotoUrl] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!id;
  const pageTitle = isEditing ? "Modifier le patient" : "Nouveau patient";

  // ✅ RÉCUPÉRER LE MEDECIN_ID COMPLET AU CHARGEMENT
  useEffect(() => {
    const fetchCompleteMedecinId = async () => {
      console.log("=== RÉCUPÉRATION MEDECIN_ID ===");
      console.log("user:", user);
      console.log("user.role:", user?.role);
      console.log("user.medecin_id:", user?.medecin_id);

      try {
        if (isMedecin) {
          // Pour un médecin, utiliser son propre ID
          const medecinId = (user as any)?._id || user?.id;
          console.log("👨‍⚕️ Médecin - ID:", medecinId);
          setCompleteMedecinId(medecinId);
        } else if (user && user.role === "secretaire") {
          // Pour une secrétaire, récupérer les données complètes depuis l'API
          if (user.medecin_id && user.medecin_id !== null) {
            console.log(
              "👩‍💼 Secrétaire - medecin_id depuis contexte:",
              user.medecin_id,
            );
            setCompleteMedecinId(user.medecin_id);
          } else {
            console.log("⚠️ medecin_id null - récupération depuis API");

            // Récupérer les données complètes depuis /users/me
            const response = await fetch(`${API_BASE_URL}/users/me`, {
              headers: {
                Authorization: `Bearer ${localStorage.getItem("access_token")}`,
                "Content-Type": "application/json",
              },
            });

            if (response.ok) {
              const completeUserData = await response.json();
              console.log("✅ Données complètes:", completeUserData);

              if (completeUserData.medecin_id) {
                setCompleteMedecinId(completeUserData.medecin_id);
                console.log(
                  "✅ medecin_id récupéré:",
                  completeUserData.medecin_id,
                );
              } else {
                console.log("❌ medecin_id toujours null dans les données API");
                setError(
                  "Erreur: Secrétaire non associée à un médecin. Contactez l'administrateur.",
                );
              }
            } else {
              console.log(
                "❌ Erreur lors de la récupération des données utilisateur",
              );
              setError(
                "Erreur lors de la récupération des données utilisateur",
              );
            }
          }
        }
      } catch (error) {
        console.error("❌ Erreur fetchCompleteMedecinId:", error);
        setError("Erreur lors de la récupération des informations du médecin");
      }
    };

    if (user) {
      fetchCompleteMedecinId();
    }
  }, [user, isMedecin]);

  // ✅ VÉRIFICATION D'AUTORISATION
  useEffect(() => {
    console.log("=== VÉRIFICATION D'ACCÈS PATIENT FORM ===");
    console.log("user:", user);
    console.log("isMedecin:", isMedecin);
    console.log("user.role:", user?.role);

    const canAccess = isMedecin || (user && user.role === "secretaire");

    if (!canAccess) {
      console.log("❌ Accès refusé - redirection vers /patients");
      navigate("/patients");
      return;
    }

    console.log("✅ Accès autorisé");
  }, [user, isMedecin, navigate]);

  // Gestion de la sélection de photo
  const handlePhotoSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Vérifications du fichier
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ["image/jpeg", "image/jpg", "image/png"];

    if (!allowedTypes.includes(file.type)) {
      setError("Format de fichier non supporté. Utilisez JPG, JPEG ou PNG.");
      return;
    }

    if (file.size > maxSize) {
      setError("La taille du fichier ne doit pas dépasser 5MB.");
      return;
    }

    setSelectedPhoto(file);

    // Créer l'aperçu
    const reader = new FileReader();
    reader.onload = (e) => {
      setPhotoPreview(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Supprimer la photo sélectionnée
  const handleRemovePhoto = () => {
    setSelectedPhoto(null);
    setPhotoPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Upload de la photo - ✅ UTILISER le service API
  const uploadPhoto = async (patientId: string): Promise<string | null> => {
    if (!selectedPhoto) return null;

    setPhotoUploading(true);
    try {
      const result = await patientsApi.uploadPhoto(patientId, selectedPhoto);
      return result.photo_url;
    } catch (error) {
      console.error("Erreur upload photo:", error);
      throw error;
    } finally {
      setPhotoUploading(false);
    }
  };

  // ✅ AFFICHER les informations de debug dans l'interface
  const getHeaderInfo = () => {
    if (isMedecin) {
      return `Médecin connecté : Dr. ${user?.nom} (ID: ${completeMedecinId})`;
    } else if (user && user.role === "secretaire") {
      return `Secrétaire : ${user?.nom} - Médecin associé ID: ${completeMedecinId || "Chargement..."}`;
    }
    return "";
  };

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    reset,
    setValue,
  } = useForm<PatientFormData>({
    resolver: yupResolver(schema),
    defaultValues: {
      nom: "",
      prenom: "",
      cin: "",
      genre: "M",
      date_naissance: "",
      telephone: "",
      adresse: "",
      email: "",
    },
  });

  // Charger les données du patient si modification
  useEffect(() => {
    if (isEditing && id) {
      loadPatient(id);
    }
  }, [id, isEditing]);

  const loadPatient = async (patientId: string) => {
    try {
      setInitialLoading(true);
      const patient = await patientsApi.getById(patientId);

      console.log("📋 Patient chargé pour édition:", patient);
      console.log("📸 Photo URL du patient:", patient.photo_url);

      // Remplir le formulaire avec les données existantes
      setValue("nom", patient.nom);
      setValue("prenom", patient.prenom);
      setValue("cin", patient.cin);
      setValue("genre", patient.genre);
      setValue("date_naissance", patient.date_naissance);
      setValue("telephone", patient.telephone || "");
      setValue("adresse", patient.adresse || "");
      setValue("email", patient.email || "");

      // ✅ CHARGER LA PHOTO EXISTANTE CORRECTEMENT
      if (patient.photo_url) {
        console.log("📸 Photo existante trouvée:", patient.photo_url);
        // ✅ Construire l'URL complète pour l'aperçu
        const fullPhotoUrl = patient.photo_url.startsWith("http")
          ? patient.photo_url
          : `${API_BASE_URL}${patient.photo_url}`;

        setExistingPhotoUrl(fullPhotoUrl);
        console.log("📸 URL complète de la photo:", fullPhotoUrl);
      } else {
        console.log("📸 Aucune photo existante");
        setExistingPhotoUrl(null);
      }
    } catch (err: any) {
      console.error("Erreur lors du chargement du patient:", err);
      setError("Impossible de charger les données du patient");
    } finally {
      setInitialLoading(false);
    }
  };

  const onSubmit = async (data: PatientFormData) => {
    try {
      setLoading(true);
      setError(null);
      setSuccess(null);

      console.log("💾 onSubmit - Données du formulaire:", data);
      console.log("💾 onSubmit - completeMedecinId:", completeMedecinId);
      console.log("💾 onSubmit - user:", user);
      console.log("💾 onSubmit - isMedecin:", isMedecin);

      // Nettoyer les champs optionnels vides
      const cleanData = {
        ...data,
        telephone: data.telephone || undefined,
        adresse: data.adresse || undefined,
        email: data.email || undefined,
      };

      let patientId: string;

      if (isEditing && id) {
        console.log("💾 Mise à jour du patient ID:", id);
        await patientsApi.update(id, cleanData);
        patientId = id;

        // Upload de la nouvelle photo si sélectionnée
        if (selectedPhoto) {
          await uploadPhoto(patientId);
        }

        setSuccess("Patient modifié avec succès");
      } else {
        // ✅ CRÉATION - UTILISER LE MEDECIN_ID CORRECT
        if (!completeMedecinId) {
          setError(
            "Erreur: Impossible de déterminer le médecin responsable. Veuillez réessayer.",
          );
          return;
        }

        const patientData = {
          ...cleanData,
          medecin_id: completeMedecinId,
        };

        console.log("💾 === CRÉATION PATIENT ===");
        console.log("💾 medecin_id utilisé:", completeMedecinId);
        console.log("💾 Utilisateur connecté:", user?.nom, `(${user?.role})`);
        console.log("💾 Données patient complètes:", patientData);

        const newPatient = await patientsApi.create(patientData);
        console.log(
          "💾 Patient créé avec ID:",
          newPatient.id || newPatient._id,
        );

        // ✅ RÉCUPÉRER l'ID du patient créé
        patientId = newPatient.id || newPatient._id || newPatient.insertedId;

        if (!patientId) {
          console.error(
            "❌ Impossible de récupérer l'ID du patient créé:",
            newPatient,
          );
          throw new Error("Erreur: ID du patient non retourné après création");
        }

        // Upload de la photo si sélectionnée
        if (selectedPhoto) {
          console.log("📸 Upload de la photo pour le patient:", patientId);
          await uploadPhoto(patientId);
        }

        setSuccess("Patient créé avec succès");
      }

      // Redirection après succès
      setTimeout(() => {
        navigate("/patients");
      }, 1500);
    } catch (err: any) {
      console.error("❌ Erreur lors de la sauvegarde:", err);
      if (err.response?.status === 400) {
        setError(err.response.data.detail || "Données invalides");
      } else if (err.response?.status === 409) {
        setError("Un patient avec ce CIN existe déjà");
      } else {
        setError("Erreur lors de la sauvegarde du patient");
      }
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header avec informations de debug */}
      <div className="flex items-center space-x-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-gray-400 hover:text-gray-600 rounded-md hover:bg-gray-100 transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{pageTitle}</h1>
          <p className="text-sm text-gray-500">
            {isEditing
              ? "Modifier les informations du patient"
              : "Saisir les informations du nouveau patient"}
          </p>
          <p className="text-xs text-blue-600 mt-1">{getHeaderInfo()}</p>
          {!isEditing && (
            <p className="text-xs text-green-600 mt-1">
              Patient sera associé au médecin ID:{" "}
              {completeMedecinId || "Chargement..."}
            </p>
          )}
        </div>
      </div>

      {/* Messages */}
      {error && (
        <ErrorMessage message={error} onDismiss={() => setError(null)} />
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-green-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-green-700">{success}</p>
            </div>
          </div>
        </div>
      )}

      {/* ✅ BLOQUEUR SI MEDECIN_ID PAS PRÊT */}
      {!isEditing && !completeMedecinId && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg
                className="h-5 w-5 text-yellow-400"
                viewBox="0 0 20 20"
                fill="currentColor"
              >
                <path
                  fillRule="evenodd"
                  d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                Chargement des informations du médecin en cours...
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Section Photo */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <Camera className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-medium text-gray-900">
              Photo du patient
            </h2>
          </div>
        </div>

        <div className="p-6">
          <div className="flex items-center space-x-6">
            {/* Aperçu de la photo */}
            <div className="flex-shrink-0">
              <div className="w-32 h-32 border-2 border-dashed border-gray-300 rounded-lg flex items-center justify-center bg-gray-50">
                {photoPreview || existingPhotoUrl ? (
                  <div className="relative">
                    {photoPreview ? (
                      // ✅ Nouvelle photo sélectionnée - aperçu local
                      <img
                        src={photoPreview}
                        alt="Aperçu nouvelle photo"
                        className="w-28 h-28 object-cover rounded-lg"
                      />
                    ) : existingPhotoUrl ? (
                      // ✅ Photo existante - utiliser AuthenticatedImage
                      <img
                        src={existingPhotoUrl}
                        alt="Photo existante"
                        className="w-28 h-28 object-cover rounded-lg"
                        onLoad={() => console.log("✅ Photo existante chargée")}
                        onError={(e) => {
                          console.error(
                            "❌ Erreur chargement photo existante:",
                            existingPhotoUrl,
                          );
                          // Optionnel : masquer l'image en cas d'erreur
                          (e.target as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : null}

                    {/* Bouton supprimer (seulement pour nouvelle photo) */}
                    {photoPreview && (
                      <button
                        type="button"
                        onClick={handleRemovePhoto}
                        className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-center">
                    <Camera className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Aucune photo</p>
                  </div>
                )}
              </div>
            </div>

            {/* Contrôles de la photo */}
            <div className="flex-1">
              <div className="space-y-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/jpg,image/png"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
                >
                  <Upload className="h-4 w-4 mr-2" />
                  {photoPreview
                    ? "Changer la nouvelle photo"
                    : existingPhotoUrl
                      ? "Remplacer la photo actuelle"
                      : "Ajouter une photo"}
                </button>

                {selectedPhoto && (
                  <p className="text-sm text-gray-600">
                    Nouveau fichier sélectionné: {selectedPhoto.name}
                  </p>
                )}

                {existingPhotoUrl && !photoPreview && (
                  <p className="text-sm text-green-600">
                    Photo actuelle chargée
                  </p>
                )}

                <p className="text-xs text-gray-500">
                  Formats acceptés: JPG, JPEG, PNG. Taille max: 5MB
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Formulaire */}
      <div className="bg-white shadow-sm rounded-lg border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <div className="flex items-center space-x-2">
            <User className="h-5 w-5 text-gray-400" />
            <h2 className="text-lg font-medium text-gray-900">
              Informations du patient
            </h2>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
          {/* Nom et Prénom */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label
                htmlFor="nom"
                className="block text-sm font-medium text-gray-700"
              >
                Nom *
              </label>
              <input
                {...register("nom")}
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Nom de famille"
              />
              {errors.nom && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.nom.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="prenom"
                className="block text-sm font-medium text-gray-700"
              >
                Prénom *
              </label>
              <input
                {...register("prenom")}
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="Prénom"
              />
              {errors.prenom && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.prenom.message}
                </p>
              )}
            </div>
          </div>

          {/* CIN et Genre */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label
                htmlFor="cin"
                className="block text-sm font-medium text-gray-700"
              >
                CIN *
              </label>
              <input
                {...register("cin")}
                type="text"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="A123456"
                style={{ textTransform: "uppercase" }}
              />
              {errors.cin && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.cin.message}
                </p>
              )}
            </div>

            <div>
              <label
                htmlFor="genre"
                className="block text-sm font-medium text-gray-700"
              >
                Genre *
              </label>
              <select
                {...register("genre")}
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              >
                <option value="M">Masculin</option>
                <option value="F">Féminin</option>
              </select>
              {errors.genre && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.genre.message}
                </p>
              )}
            </div>
          </div>

          {/* Date de naissance */}
          <div>
            <label
              htmlFor="date_naissance"
              className="block text-sm font-medium text-gray-700"
            >
              Date de naissance *
            </label>
            <input
              {...register("date_naissance")}
              type="date"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
            />
            {errors.date_naissance && (
              <p className="mt-1 text-sm text-red-600">
                {errors.date_naissance.message}
              </p>
            )}
          </div>

          {/* Téléphone et Email */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label
                htmlFor="telephone"
                className="block text-sm font-medium text-gray-700"
              >
                Téléphone
              </label>
              <input
                {...register("telephone")}
                type="tel"
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="+212 6 12 34 56 78"
              />
              {errors.telephone && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.telephone.message}
                </p>
              )}
            </div>

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
                className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
                placeholder="patient@example.com"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-600">
                  {errors.email.message}
                </p>
              )}
            </div>
          </div>

          {/* Adresse */}
          <div>
            <label
              htmlFor="adresse"
              className="block text-sm font-medium text-gray-700"
            >
              Adresse
            </label>
            <textarea
              {...register("adresse")}
              rows={3}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm"
              placeholder="Adresse complète du patient"
            />
            {errors.adresse && (
              <p className="mt-1 text-sm text-red-600">
                {errors.adresse.message}
              </p>
            )}
          </div>

          {/* Boutons */}
          <div className="flex justify-end space-x-3 pt-6 border-t border-gray-200">
            <button
              type="button"
              onClick={() => navigate("/patients")}
              className="px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={
                isSubmitting ||
                loading ||
                photoUploading ||
                (!isEditing && !completeMedecinId)
              }
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {(isSubmitting || loading || photoUploading) && (
                <LoadingSpinner size="sm" className="mr-2" />
              )}
              <Save className="h-4 w-4 mr-2" />
              {photoUploading
                ? "Upload en cours..."
                : isEditing
                  ? "Modifier"
                  : "Enregistrer"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PatientFormPage;
