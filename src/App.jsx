import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { GovHeader } from "./components/GovHeader";
import { GovFooter } from "./components/GovFooter";
import { ProtectedRoute } from "./components/ProtectedRoute";

import { LandingPage } from "./pages/LandingPage";
import { RoleSelectionPage } from "./pages/RoleSelectionPage";
import { LoginPage } from "./pages/LoginPage";
import { CollegeLayout } from "./pages/college/CollegeLayout";
import { CollegeUpload } from "./pages/college/CollegeUpload";
import { CollegeWorkbench } from "./pages/college/CollegeWorkbench";
import { CollegeDashboard } from "./pages/college/CollegeDashboard";
import { CollegeReports } from "./pages/college/CollegeReports";
import { COLLEGE_DEFAULT_PATH } from "./pages/college/collegeNav";

import { AicteLayout } from "./pages/aicte/AicteLayout";
import { AicteDashboard } from "./pages/aicte/AicteDashboard";
import { AicteReviewQueue } from "./pages/aicte/AicteReviewQueue";
import { AicteReports } from "./pages/aicte/AicteReports";
import { AicteCreateUser } from "./pages/aicte/AicteCreateUser";
import { AicteRepository } from "./pages/aicte/AicteRepository";
import { StudentJourney } from "./pages/shared/StudentJourney";

import { ExternalVerifierLayout } from "./pages/external/ExternalVerifierLayout";
import { ExternalVerifierVerify } from "./pages/external/ExternalVerifierVerify";
import { ExternalVerifierHistory } from "./pages/external/ExternalVerifierHistory";
import { StudentPortal } from "./pages/student/StudentPortal";

import { getCurrentUser, initializeStore } from "./mocks/mockStore";
import { repairStoredAcceptedRecords } from "./api/collegeApi";
import { getBackendMeta, isBackendConfigured } from "./api/ingestionApi";

function LegacyStudentRoute() {
  const currentUser = getCurrentUser();
  if (currentUser?.role === "EXTERNAL_VERIFIER") {
    return <Navigate to="/external/verify" replace />;
  }
  if (currentUser?.role === "COLLEGE") {
    return <Navigate to="/college/upload" replace />;
  }
  if (currentUser?.role === "AICTE") {
    return <Navigate to="/aicte/dashboard" replace />;
  }
  if (currentUser?.role === "STUDENT") {
    return <Navigate to="/student/portal" replace />;
  }
  return <Navigate to="/" replace />;
}

function App() {
  const currentUser = getCurrentUser();

  useEffect(() => {
    initializeStore();
    repairStoredAcceptedRecords().catch((error) => console.error("Failed to repair accepted record references", error));
    if (isBackendConfigured()) {
      getBackendMeta().then((meta) => {
        if (!meta?.seedVersion || typeof localStorage === "undefined") return;
        const key = "apaar_backend_seed_version";
        const previous = localStorage.getItem(key);
        if (previous && previous !== meta.seedVersion && !sessionStorage.getItem("apaar_seed_reloaded")) {
          sessionStorage.setItem("apaar_seed_reloaded", "1");
          Object.keys(localStorage).filter((keyName) => keyName.startsWith("apaar_")).forEach((keyName) => localStorage.removeItem(keyName));
          localStorage.setItem(key, meta.seedVersion);
          window.location.reload();
        } else {
          localStorage.setItem(key, meta.seedVersion);
          sessionStorage.removeItem("apaar_seed_reloaded");
        }
      }).catch(() => {});
    }
  }, []);

  return (
    <BrowserRouter>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        {/* Government Header with Logo & Role Controls */}
        {currentUser?.role !== "AICTE" && <GovHeader />}

        {/* Dynamic Route Content */}
        <div style={{ flex: 1 }}>
          <Routes>
            {/* Public Landing Page */}
            <Route path="/" element={<LandingPage />} />
            <Route path="/roles" element={<RoleSelectionPage />} />
            <Route path="/login/external" element={<Navigate to="/external/verify" replace />} />
            <Route path="/login/:role" element={<LoginPage />} />

            {/* College Portal Protected Routes */}
            <Route
              path="/college"
              element={
                <ProtectedRoute allowedRoles={["COLLEGE"]}>
                  <CollegeLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to={COLLEGE_DEFAULT_PATH} replace />} />
              <Route path="dashboard" element={<CollegeDashboard />} />
              <Route path="add-students" element={<Navigate to="/college/upload?mode=manual" replace />} />
              <Route path="upload" element={<CollegeUpload />} />
              <Route path="validate" element={<Navigate to="/college/workbench" replace />} />
              <Route path="workbench" element={<CollegeWorkbench />} />
              <Route path="reports" element={<CollegeReports />} />
              <Route path="student-journey" element={<StudentJourney role="COLLEGE" />} />
            </Route>

            {/* AICTE Portal Protected Routes */}
            <Route
              path="/aicte"
              element={
                <ProtectedRoute allowedRoles={["AICTE"]}>
                  <AicteLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/aicte/dashboard" replace />} />
              <Route path="dashboard" element={<AicteDashboard />} />
              <Route path="workbench" element={<AicteReviewQueue />} />
              <Route path="review" element={<Navigate to="/aicte/workbench" replace />} />
              <Route path="audit" element={<Navigate to="/aicte/reports?view=audit" replace />} />
              <Route path="reports" element={<AicteReports />} />
              <Route path="audit-rails" element={<AicteReports />} />
              <Route path="repository" element={<AicteRepository />} />
              <Route path="student-journey" element={<StudentJourney role="AICTE" />} />
              <Route path="create-user" element={<AicteCreateUser />} />
            </Route>

            {/* External Verifier Portal - public access, no login required */}
            <Route path="/external" element={<ExternalVerifierLayout />}>
              <Route index element={<Navigate to="/external/verify" replace />} />
              <Route path="verify" element={<ExternalVerifierVerify />} />
              <Route path="history" element={<ExternalVerifierHistory />} />
            </Route>

            {/* Removed Student portal URLs */}
            <Route
              path="/student"
              element={
                <ProtectedRoute allowedRoles={["STUDENT"]}>
                  <StudentPortal />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/student/portal" replace />} />
            </Route>
            <Route
              path="/student/portal"
              element={
                <ProtectedRoute allowedRoles={["STUDENT"]}>
                  <StudentPortal />
                </ProtectedRoute>
              }
            />

            {/* Legacy Student portal URLs */}
            <Route path="/student/*" element={<LegacyStudentRoute />} />

            {/* Fallback to Home */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>

        {/* Government Footer */}
        <GovFooter />
      </div>
    </BrowserRouter>
  );
}

export default App;
