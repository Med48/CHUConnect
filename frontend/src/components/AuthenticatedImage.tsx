// components/AuthenticatedImage.tsx - Composant pour charger les images avec authentification

import React, { useState, useEffect } from "react";
import { Camera } from "lucide-react";

interface AuthenticatedImageProps {
  src: string;
  alt: string;
  className?: string;
  fallback?: React.ReactNode;
}

const AuthenticatedImage: React.FC<AuthenticatedImageProps> = ({
  src,
  alt,
  className = "",
  fallback,
}) => {
  const [imageSrc, setImageSrc] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";


  useEffect(() => {
    const loadImage = async () => {
      try {
        setLoading(true);
        setError(false);

        console.log("📸 Chargement image authentifiée:", src);

        // ✅ Construire l'URL complète
        const fullUrl = src.startsWith("http")
          ? src
          : `${API_BASE_URL}${src}`;
        console.log("📸 URL complète:", fullUrl);

        // Récupérer l'image avec authentification
        const response = await fetch(fullUrl, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("access_token")}`,
          },
        });

        console.log("📸 Statut de la réponse:", response.status);

        if (!response.ok) {
          console.error(
            "❌ Erreur serveur image:",
            response.status,
            response.statusText,
          );

          // ✅ AFFICHER le détail de l'erreur
          const errorText = await response
            .text()
            .catch(() => "Erreur inconnue");
          console.error("❌ Détail erreur:", errorText);

          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        // Convertir en blob puis en URL
        const blob = await response.blob();
        const imageUrl = URL.createObjectURL(blob);

        console.log(
          "✅ Image chargée avec succès, taille blob:",
          blob.size,
          "bytes",
        );
        setImageSrc(imageUrl);
      } catch (err) {
        console.error("❌ Erreur chargement image:", err);
        setError(true);
      } finally {
        setLoading(false);
      }
    };

    if (src) {
      loadImage();
    }

    // Cleanup: libérer l'URL blob
    return () => {
      if (imageSrc && imageSrc.startsWith("blob:")) {
        URL.revokeObjectURL(imageSrc);
      }
    };
  }, [src]);

  if (loading) {
    return (
      <div
        className={`${className} flex items-center justify-center bg-gray-100 rounded-lg`}
      >
        <div className="text-center">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2"></div>
          <p className="text-xs text-gray-500">Chargement...</p>
        </div>
      </div>
    );
  }

  if (error || !imageSrc) {
    return (
      fallback || (
        <div
          className={`${className} flex items-center justify-center bg-gray-100 rounded-lg`}
        >
          <div className="text-center">
            <Camera className="h-8 w-8 text-gray-400 mx-auto mb-2" />
            <p className="text-xs text-gray-500">Photo indisponible</p>
          </div>
        </div>
      )
    );
  }

  return (
    <img
      src={imageSrc}
      alt={alt}
      className={className}
      onError={() => {
        console.error("❌ Erreur affichage image");
        setError(true);
      }}
      onLoad={() => {
        console.log("✅ Image affichée avec succès dans le DOM");
      }}
    />
  );
};

export default AuthenticatedImage;
