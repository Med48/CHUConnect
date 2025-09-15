# Architecture détaillée du projet Frontend Médical

## 🏗️ Structure générale du projet

```
medical-app-frontend/
├── public/                          # Fichiers statiques
│   ├── vite.svg                    # Logo Vite par défaut
│   └── favicon.ico                 # Icône du site
├── src/                            # Code source principal
│   ├── components/                 # Composants réutilisables
│   │   ├── common/                # Composants communs à toute l'app
│   │   │   ├── Layout.tsx         # Layout principal avec sidebar
│   │   │   ├── ProtectedRoute.tsx # Protection des routes
│   │   │   ├── LoadingSpinner.tsx # Composant de chargement
│   │   │   └── ErrorMessage.tsx   # Affichage des erreurs
│   │   ├── forms/                 # Composants de formulaires
│   │   │   ├── PatientForm.tsx    # Formulaire patient
│   │   │   ├── ConsultationForm.tsx # Formulaire consultation
│   │   │   └── AppointmentForm.tsx # Formulaire RDV
│   │   ├── ui/                    # Composants UI de base
│   │   │   ├── Button.tsx         # Bouton personnalisé
│   │   │   ├── Input.tsx          # Input personnalisé
│   │   │   ├── Modal.tsx          # Modal réutilisable
│   │   │   └── Card.tsx           # Carte réutilisable
│   │   └── calendar/              # Composants calendrier
│   │       ├── Calendar.tsx       # Calendrier principal
│   │       └── AppointmentCard.tsx # Carte RDV
│   ├── contexts/                  # Contexts React
│   │   ├── AuthContext.tsx        # Gestion authentification
│   │   └── ThemeContext.tsx       # Gestion du thème (optionnel)
│   ├── hooks/                     # Hooks personnalisés
│   │   ├── useAuth.ts            # Hook d'authentification
│   │   ├── useApi.ts             # Hook pour appels API
│   │   └── useLocalStorage.ts    # Hook localStorage
│   ├── pages/                     # Pages de l'application
│   │   ├── LoginPage.tsx         # Page de connexion
│   │   ├── DashboardPage.tsx     # Tableau de bord
│   │   ├── PatientsPage.tsx      # Liste des patients
│   │   ├── PatientDetailPage.tsx # Détail d'un patient
│   │   ├── PatientFormPage.tsx   # Ajout/modification patient
│   │   ├── ConsultationsPage.tsx # Liste des consultations
│   │   ├── ConsultationDetailPage.tsx # Détail consultation
│   │   ├── ConsultationFormPage.tsx # Ajout/modification consultation
│   │   ├── AppointmentsPage.tsx  # Calendrier des RDV
│   │   └── ProfilePage.tsx       # Profil utilisateur
│   ├── services/                  # Services et logique métier
│   │   ├── api.ts                # Client API principal
│   │   ├── auth.service.ts       # Service d'authentification
│   │   ├── patients.service.ts   # Service patients
│   │   ├── consultations.service.ts # Service consultations
│   │   └── appointments.service.ts # Service rendez-vous
│   ├── types/                     # Types TypeScript
│   │   ├── index.ts              # Types principaux
│   │   ├── api.types.ts          # Types pour les API
│   │   └── form.types.ts         # Types pour les formulaires
│   ├── utils/                     # Utilitaires et helpers
│   │   ├── constants.ts          # Constantes de l'app
│   │   ├── formatters.ts         # Fonctions de formatage
│   │   ├── validators.ts         # Validateurs personnalisés
│   │   └── helpers.ts            # Fonctions utilitaires
│   ├── styles/                    # Styles personnalisés
│   │   ├── globals.css           # Styles globaux
│   │   └── components.css        # Styles des composants
│   ├── App.tsx                    # Composant racine
│   ├── main.tsx                   # Point d'entrée
│   ├── index.css                  # Styles Tailwind
│   └── vite-env.d.ts             # Types Vite
├── .env.example                   # Variables d'environnement exemple
├── .env                          # Variables d'environnement (local)
├── .gitignore                    # Fichiers ignorés par Git
├── package.json                  # Dépendances et scripts
├── package-lock.json             # Lock des dépendances
├── tsconfig.json                 # Configuration TypeScript
├── tsconfig.app.json             # Config TS pour l'app
├── tsconfig.node.json            # Config TS pour Node
├── tailwind.config.js            # Configuration Tailwind
├── postcss.config.js             # Configuration PostCSS
├── vite.config.ts                # Configuration Vite
├── eslint.config.js              # Configuration ESLint
├── index.html                    # Template HTML
├── README.md                     # Documentation principale
└── ARCHITECTURE.md               # Ce fichier
```

## 📁 Détail des dossiers principaux

### `/src/components/`
Contient tous les composants React réutilisables organisés par catégorie :

#### `/common/` - Composants transversaux
- **Layout.tsx** : Structure principale avec sidebar, header, navigation
- **ProtectedRoute.tsx** : HOC pour protéger les routes selon l'authentification
- **LoadingSpinner.tsx** : Indicateur de chargement réutilisable
- **ErrorMessage.tsx** : Affichage standardisé des erreurs

#### `/forms/` - Composants de formulaires
- **PatientForm.tsx** : Formulaire d'ajout/modification de patient
- **ConsultationForm.tsx** : Formulaire de consultation médicale
- **AppointmentForm.tsx** : Formulaire de prise de rendez-vous

#### `/ui/` - Composants UI de base
- **Button.tsx** : Bouton avec variantes (primary, secondary, danger)
- **Input.tsx** : Champ de saisie avec validation visuelle
- **Modal.tsx** : Modal réutilisable avec overlay
- **Card.tsx** : Carte avec header, body, footer

### `/src/contexts/`
Gestion de l'état global de l'application :

#### **AuthContext.tsx**
```typescript
interface AuthContextType {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (credentials: LoginRequest) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isMedecin: boolean;
  isSecretaire: boolean;
}
```

### `/src/services/`
Couche de services pour les appels API :

#### **api.ts** - Client HTTP principal
- Configuration Axios avec intercepteurs
- Gestion automatique des tokens JWT
- Gestion centralisée des erreurs HTTP
- Types de retour strictement typés

#### Services spécialisés
- **auth.service.ts** : Login, logout, refresh token
- **patients.service.ts** : CRUD patients, recherche par CIN
- **consultations.service.ts** : CRUD consultations, historique
- **appointments.service.ts** : CRUD rendez-vous, calendrier

### `/src/types/`
Définitions TypeScript synchronisées avec le backend :

#### **index.ts** - Types principaux
```typescript
export interface User {
  id: number;
  username: string;
  email: string;
  role: 'medecin' | 'secretaire';
  created_at: string;
}

export interface Patient {
  id?: number;
  nom: string;
  prenom: string;
  cin: string;
  genre: 'M' | 'F';
  date_naissance: string;
  telephone?: string;
  adresse?: string;
}

export interface Consultation {
  id?: number;
  patient_id: number;
  medecin_id: number;
  date_consultation: string;
  diagnostic: string;
  medicaments: string;
  traitement: string;
  notes?: string;
}
```

### `/src/pages/`
Pages principales de l'application :

#### **LoginPage.tsx**
- Formulaire de connexion avec validation
- Gestion des erreurs d'authentification
- Redirection après connexion réussie

#### **DashboardPage.tsx**
- Vue d'ensemble avec statistiques
- Actions rapides (nouveau patient, consultation, RDV)
- Widgets informatifs selon le rôle

#### **PatientsPage.tsx**
- Liste paginée des patients
- Recherche par nom, prénom, CIN
- Actions CRUD selon les permissions

### `/src/utils/`
Fonctions utilitaires :

#### **constants.ts**
```typescript
export const API_ENDPOINTS = {
  AUTH: '/auth',
  PATIENTS: '/patients',
  CONSULTATIONS: '/consultations',
  APPOINTMENTS: '/appointments'
};

export const USER_ROLES = {
  MEDECIN: 'medecin',
  SECRETAIRE: 'secretaire'
} as const;
```

#### **formatters.ts**
```typescript
export const formatDate = (date: string) => {
  return new Date(date).toLocaleDateString('fr-FR');
};

export const formatCIN = (cin: string) => {
  return cin.toUpperCase().replace(/\s/g, '');
};
```

## 🔧 Fichiers de configuration

### **package.json**
```json
{
  "name": "medical-app-frontend",
  "dependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^7.7.0",
    "axios": "^1.10.0",
    "react-hook-form": "^7.60.0",
    "@hookform/resolvers": "^5.1.1",
    "yup": "^1.6.1",
    "date-fns": "^4.1.0",
    "lucide-react": "^0.344.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.5.3",
    "vite": "^5.4.2",
    "tailwindcss": "^3.4.1",
    "eslint": "^9.9.1"
  }
}
```

### **tailwind.config.js**
```javascript
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#eff6ff',
          500: '#3b82f6',
          600: '#2563eb',
          700: '#1d4ed8'
        },
        medical: {
          blue: '#2563EB',
          green: '#16A34A',
          red: '#DC2626'
        }
      }
    }
  }
};
```

### **vite.config.ts**
```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, '')
      }
    }
  }
});
```

## 🔐 Sécurité et authentification

### Flux d'authentification
1. **Login** : POST `/auth/login` avec credentials
2. **Stockage** : Token JWT dans localStorage
3. **Intercepteur** : Ajout automatique du token dans les headers
4. **Validation** : Vérification du token à chaque requête
5. **Expiration** : Déconnexion automatique si token expiré

### Protection des routes
```typescript
// Route protégée pour médecins uniquement
<ProtectedRoute allowedRoles={['medecin']}>
  <ConsultationFormPage />
</ProtectedRoute>

// Route protégée pour tous les utilisateurs connectés
<ProtectedRoute>
  <DashboardPage />
</ProtectedRoute>
```

## 📱 Responsive Design

### Breakpoints Tailwind
- **Mobile** : < 640px (sm)
- **Tablet** : 640px - 1024px (md/lg)
- **Desktop** : > 1024px (xl)

### Adaptations
- Navigation hamburger sur mobile
- Sidebar collapsible sur tablet
- Grilles adaptatives pour les listes
- Modals plein écran sur mobile

## 🎨 Design System

### Palette de couleurs
```css
:root {
  --color-primary: #2563EB;    /* Bleu médical */
  --color-success: #16A34A;    /* Vert validation */
  --color-danger: #DC2626;     /* Rouge alerte */
  --color-warning: #D97706;    /* Orange attention */
  --color-gray-50: #F9FAFB;    /* Arrière-plan clair */
  --color-gray-900: #111827;   /* Texte principal */
}
```

### Composants standardisés
- Boutons avec états hover/focus/disabled
- Inputs avec validation visuelle
- Cards avec ombres subtiles
- Modals avec animations fluides

## 🔄 Synchronisation Backend

### Endpoints mappés
```typescript
// Authentification
POST /auth/login → authApi.login()
GET /users/me → authApi.getCurrentUser()

// Patients
GET /patients → patientsApi.getAll()
POST /patients → patientsApi.create()
GET /patients/{id} → patientsApi.getById()
GET /patients/cin/{cin} → patientsApi.getByCin()

// Consultations
GET /consultations → consultationsApi.getAll()
POST /consultations → consultationsApi.create()
GET /consultations/patient/{id} → consultationsApi.getByPatient()

// Rendez-vous
GET /appointments → rendezVousApi.getAll()
POST /appointments → rendezVousApi.create()
GET /appointments/date/{date} → rendezVousApi.getByDate()
```

### Format des données
Tous les types TypeScript correspondent exactement aux schémas Pydantic du backend FastAPI, garantissant une synchronisation parfaite.

## 🚀 Déploiement

### Build de production
```bash
npm run build    # Génère le dossier dist/
npm run preview  # Prévisualise la build
```

### Variables d'environnement
```env
VITE_API_URL=http://localhost:8000
VITE_APP_NAME=MediApp
VITE_APP_VERSION=1.0.0
```

Cette architecture modulaire garantit une maintenance facile, une évolutivité optimale et une synchronisation parfaite avec votre backend FastAPI.