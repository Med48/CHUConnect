import React from "react";
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import Layout from "./components/common/Layout";
import ProtectedRoute from "./components/common/ProtectedRoute";

// Pages existantes
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import PatientsPage from "./pages/PatientsPage";
import PatientFormPage from "./pages/PatientFormPage";
import ConsultationsPage from "./pages/ConsultationsPage";
import RendezVousPage from "./pages/RendezVousPage";
import PatientDetails from "./pages/PatientDetails";
import AddConsultation from "./pages/AddConsultation";
import AddAppointment from "./pages/AddAppointment";
import AddUser from "./pages/AddUser";
import Calendar from "./pages/Calendar";
import AppointmentDetails from "./pages/AppointmentDetails";
import AdminUsers from "./pages/AdminUsers";
import ModifierRendezVous from "./pages/ModifierRendezVous";
import ConsultationDetailsPage from "./pages/ConsultationDetailsPage";

// Composant principal avec chatbot
const AppContent: React.FC = () => {

  return (
    <div className="app">
      <Routes>
        {/* Route publique */}
        <Route path="/login" element={<LoginPage />} />

        {/* Dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Layout>
                <DashboardPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Patients */}
        <Route
          path="/patients"
          element={
            <ProtectedRoute>
              <Layout>
                <PatientsPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/patients/nouveau"
          element={
            <ProtectedRoute>
              <Layout>
                <PatientFormPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/patients/id/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <PatientDetails />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/patients/id/:id/modifier"
          element={
            <ProtectedRoute allowedRoles={["medecin", "secretaire"]}>
              <Layout>
                <PatientFormPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/patients/id/:id/consultation"
          element={
            <ProtectedRoute allowedRoles={["medecin"]}>
              <Layout>
                <AddConsultation />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/patients/id/:id/appointment"
          element={
            <ProtectedRoute allowedRoles={["medecin", "secretaire"]}>
              <Layout>
                <AddAppointment />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Consultations */}
        <Route
          path="/consultations"
          element={
            <ProtectedRoute>
              <Layout>
                <ConsultationsPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/consultations/nouvelle"
          element={
            <ProtectedRoute allowedRoles={["medecin"]}>
              <Layout>
                <AddConsultation />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/consultations/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <ConsultationDetailsPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Rendez-vous */}
        <Route
          path="/rendez-vous"
          element={
            <ProtectedRoute>
              <Layout>
                <RendezVousPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/rendez-vous/nouveau"
          element={
            <ProtectedRoute allowedRoles={["medecin", "secretaire"]}>
              <Layout>
                <AddAppointment />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/rendez-vous/:id"
          element={
            <ProtectedRoute>
              <Layout>
                <AppointmentDetails />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/rendez-vous/:id/modifier"
          element={
            <ProtectedRoute allowedRoles={["medecin", "secretaire"]}>
              <Layout>
                <ModifierRendezVous />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Calendrier */}
        <Route
          path="/calendar"
          element={
            <ProtectedRoute allowedRoles={["medecin", "secretaire"]}>
              <Layout>
                <Calendar />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Utilisateurs */}
        <Route
          path="/users/nouveau"
          element={
            <ProtectedRoute allowedRoles={["medecin"]}>
              <Layout>
                <AddUser />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Admin */}
        <Route
          path="/admin/users"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <Layout>
                <AdminUsers />
              </Layout>
            </ProtectedRoute>
          }
        />

        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute allowedRoles={["admin"]}>
              <Layout>
                <div className="p-6">
                  <h1 className="text-2xl font-bold">Dashboard Admin</h1>
                  <p>Page en construction...</p>
                </div>
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* Redirection par défaut */}
        <Route path="/" element={<Navigate to="/dashboard" replace />} />

        {/* Route 404 */}
        <Route
          path="*"
          element={
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
              <div className="text-center">
                <h1 className="text-4xl font-bold text-gray-900">404</h1>
                <p className="text-gray-500 mt-2">Page non trouvée</p>
              </div>
            </div>
          }
        />
      </Routes>

    </div>
  );
};

function App() {
  return (
    <AuthProvider>
      <Router>
        <AppContent />
      </Router>
    </AuthProvider>
  );
}

export default App;