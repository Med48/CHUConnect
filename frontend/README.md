# Frontend MediApp - Application Médicale

Une application frontend React TypeScript moderne pour la gestion médicale, conçue pour se synchroniser parfaitement avec un backend FastAPI.

## 🚀 Fonctionnalités

### Authentification & Sécurité
- Connexion sécurisée avec JWT
- Gestion des rôles (Médecin/Secrétaire)
- Protection automatique des routes
- Gestion de l'expiration des tokens

### Gestion des Patients
- Liste complète des patients avec pagination
- Recherche avancée (générale ou par CIN)
- Ajout/modification de patients (médecin uniquement)
- Affichage détaillé des informations patient

### Consultations (Médecins)
- Créer et modifier des consultations
- Historique complet par patient
- Gestion des diagnostics et traitements

### Rendez-vous
- Calendrier interactif
- Planification et gestion des RDV
- Suivi des statuts

### Dashboard
- Statistiques en temps réel
- Actions rapides
- Vue d'ensemble de l'activité

## 🛠 Technologies Utilisées

- **React 18** avec TypeScript
- **React Router v6** pour la navigation
- **Tailwind CSS** pour le design
- **React Hook Form + Yup** pour la validation
- **Axios** pour les appels API
- **Lucide React** pour les icônes
- **Date-fns** pour la gestion des dates

## 📦 Installation et Démarrage

### Prérequis
- Node.js 16+ 
- npm ou yarn
- Backend FastAPI fonctionnel

### Installation
```bash
# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp .env.example .env

# Modifier .env avec l'URL de votre backend
VITE_API_URL=http://localhost:8000
```

### Démarrage en développement
```bash
npm run dev
```

L'application sera disponible sur `http://localhost:5173`

### Build pour la production
```bash
npm run build
npm run preview
```

## 🏗 Architecture du Projet

```
src/
├── components/          # Composants réutilisables
│   ├── common/         # Composants communs (Layout, Spinner, etc.)
│   ├── forms/          # Composants de formulaires
│   └── ui/             # Composants UI de base
├── contexts/           # Contexts React (Auth, etc.)
├── pages/              # Pages de l'application
├── services/           # Services API et logique métier
├── types/              # Types TypeScript
├── utils/              # Utilitaires et helpers
└── hooks/              # Hooks personnalisés
```

## 🔧 Configuration API

### Structure des endpoints attendus

Le frontend s'attend à ce que votre backend FastAPI expose les endpoints suivants :

```
POST /auth/login          - Authentification
GET  /users/me           - Profil utilisateur
GET  /patients           - Liste des patients
POST /patients           - Créer un patient
GET  /patients/{id}      - Détail patient
PUT  /patients/{id}      - Modifier patient
GET  /patients/cin/{cin} - Recherche par CIN
GET  /consultations      - Liste consultations
POST /consultations      - Créer consultation
GET  /appointments       - Liste rendez-vous
POST /appointments       - Créer rendez-vous
```

### Format des données

Les types TypeScript dans `src/types/index.ts` définissent exactement le format attendu pour chaque entité. Assurez-vous que votre backend renvoie des données dans ce format.

## 🔒 Sécurité

### Gestion des tokens
- Stockage automatique du JWT dans localStorage
- Ajout automatique du token dans les headers HTTP
- Déconnexion automatique à l'expiration
- Nettoyage sécurisé lors de la déconnexion

### Protection des routes
- Routes protégées par authentification
- Contrôle d'accès basé sur les rôles
- Redirection automatique vers login

## 🎨 Design System

### Couleurs principales
- **Bleu primaire** : `#2563EB` (actions principales)
- **Vert accent** : `#16A34A` (succès, validation)
- **Rouge alerte** : `#DC2626` (erreurs, suppressions)
- **Gris neutre** : Palette complète pour les textes et arrière-plans

### Composants
- Design responsive (mobile-first)
- Animations subtiles et micro-interactions
- États de chargement et d'erreur
- Feedbacks utilisateur clairs

## 🧪 Validation des formulaires

Utilisation de Yup pour la validation côté client :
- Validation des champs obligatoires
- Format du CIN
- Validation des emails
- Contrôle des dates

## 📱 Responsive Design

- **Mobile** : < 768px - Navigation hamburger
- **Tablet** : 768px - 1024px - Layout adaptatif  
- **Desktop** : > 1024px - Sidebar fixe

## 🐛 Gestion d'erreurs

- Gestion centralisée des erreurs HTTP
- Messages d'erreur contextuels
- Fallback pour les erreurs réseau
- Logging côté client pour le debug

## 🤝 Synchronisation Backend

### Points d'attention pour l'intégration :

1. **Authentification** : Le frontend envoie les credentials en `multipart/form-data` pour `/auth/login`
2. **Headers** : Token JWT automatiquement ajouté comme `Bearer {token}`
3. **Erreurs HTTP** : Gestion des codes 400, 401, 403, 404, 500
4. **Pagination** : Format `{items, total, page, size, pages}`
5. **Dates** : Format ISO 8601 attendu
6. **CIN** : Recherche exacte par CIN unique

## 📝 Comptes de démonstration

Pour tester l'application :
- **Médecin** : `medecin` / `password123`
- **Secrétaire** : `secretaire` / `password123`

## 🚀 Déploiement

L'application peut être déployée sur :
- Netlify
- Vercel  
- GitHub Pages
- Serveur web classique (Apache/Nginx)

## 📄 Licence

Ce projet est sous licence MIT.