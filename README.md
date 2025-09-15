# 🏥 Application de Gestion Médicale Intelligente - CHUConnect

Ce projet est une **application de gestion médicale complète** composée d’un **frontend React TypeScript** et d’un **backend FastAPI Python**.  
Elle permet à un cabinet médical de gérer efficacement ses **patients, consultations, rendez-vous**, tout en intégrant une **IA médicale** pour assister les praticiens.

---

## 🚀 Fonctionnalités principales

### 🔐 Authentification & Sécurité
- Connexion sécurisée via **JWT**
- Gestion des rôles (**médecin, secrétaire, admin**)
- Protection des routes selon le rôle
- Expiration automatique des sessions

### 👨‍⚕️ Gestion des Patients
- Liste paginée et recherche avancée (générale, par **CIN**)
- Ajout / modification / suppression de patients (médecin uniquement)
- Affichage détaillé des informations patient

### 🩺 Consultations
- Création et modification de consultations médicales
- Historique complet par patient
- Gestion des diagnostics, symptômes et traitements

### 📅 Rendez-vous
- Calendrier interactif pour la planification des RDV
- Création, modification et suppression
- Suivi des statuts et notifications

### 📊 Dashboard
- Statistiques en temps réel sur l’activité médicale
- Actions rapides (ajout patient, consultation, RDV)
- Vue d’ensemble de l’activité du cabinet

### 🤖 IA Médicale
- Génération automatique de **résumés médicaux intelligents** pour chaque patient
- Diagnostic basé sur le motif de consultation et les symptômes
- Synthèse clinique, historique thérapeutique, recommandations, points d’attention
- Suggestion d’horaires optimaux pour la planification des rendez-vous

### 🔄 Synchronisation Backend / Frontend
- Schémas synchronisés (**Pydantic ↔ TypeScript**)
- API RESTful pour toutes les opérations (patients, consultations, RDV, IA)

### 🎨 Design & UX
- Design moderne avec **Tailwind CSS**
- Responsive sur tous les appareils
- Composants réutilisables (modals, boutons, formulaires, calendrier)
- Gestion centralisée des erreurs et des chargements

---

## 🛠️ Technologies utilisées

### Frontend
- ⚛️ React 18 + TypeScript
- 🎨 Tailwind CSS
- 📝 React Hook Form + Yup (validation)
- 🌐 Axios (appels API)

### Backend
- ⚡ FastAPI + Pydantic
- 🗄️ MongoDB
- 🔬 Services IA

---

## 👥 Rôles et gestion des utilisateurs

- **Médecin**
  - Créer et gérer les patients
  - Créer des consultations et rendez-vous
  - Ajouter une secrétaire associée
- **Secrétaire**
  - Gérer les patients et rendez-vous
  - **Ne peut pas accéder aux consultations médicales** (confidentiel)
- **Admin**
  - Gérer les utilisateurs (médecins et secrétaires)
  - Ajouter, supprimer, modifier

---

## 📌 Objectif

Cette application permet à un **cabinet médical** de :
- Centraliser la gestion des patients, consultations et rendez-vous  
- Améliorer la productivité grâce à un **dashboard en temps réel**  
- Offrir une **assistance IA** pour l’analyse médicale et la génération de synthèses cliniques  
- Garantir la **sécurité des données médicales** via un système de rôles et permissions  

---

## ✨ Auteur
Projet réalisé par **Mohammed RHOUATI** dans le cadre du développement d’une solution innovante pour la gestion médicale intelligente.
