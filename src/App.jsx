import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { TopGovStrip } from "./components/TopGovStrip";
import { GovHeader } from "./components/GovHeader";
import { GovFooter } from "./components/GovFooter";
import { ProtectedRoute } from "./components/ProtectedRoute";

import { LandingPage } from "./pages/LandingPage";
import { CollegeLayout } from "./pages/college/CollegeLayout";
import { CollegeUpload } from "./pages/college/CollegeUpload";
import { CollegeWorkbench } from "./pages/college/CollegeWorkbench";
import { CollegeDashboard } from "./pages/college/CollegeDashboard";
import { CollegeReports } from "./pages/college/CollegeReports";
import { CollegeValidate } from "./pages/college/CollegeValidate";
import { COLLEGE_DEFAULT_PATH } from "./pages/college/collegeNav";

import { AicteLayout } from "./pages/aicte/AicteLayout";
import { AicteDashboard } from "./pages/aicte/AicteDashboard";
import { AicteReviewQueue } from "./pages/aicte/AicteReviewQueue";
import { AicteReports } from "./pages/aicte/AicteReports";
import { AicteRepository } from "./pages/aicte/AicteRepository";
import { StudentJourney } from "./pages/shared/StudentJourney";

import { ExternalVerifierLayout } from "./pages/external/ExternalVerifierLayout";
import { ExternalVerifierVerify } from "./pages/external/ExternalVerifierVerify";
import { ExternalVerifierHistory } from "./pages/external/ExternalVerifierHistory";

import { getCurrentUser, initializeStore } from "./mocks/mockStore";
import { repairStoredAcceptedRecords } from "./api/collegeApi";
import { getBackendMeta, isBackendConfigured } from "./api/ingestionApi";

function ExternalVerifierEntry() {
  const location = useLocation();
  const currentUser = getCurrentUser();
  const target = `/external/verify?reference=${encodeURIComponent(location.pathname.split("/").pop() || "")}`;

  if (!currentUser) {
    return <Navigate to={`/?returnTo=${encodeURIComponent(target)}`} replace />;
  }

  return <Navigate to={target} replace />;
}

function LegacyStudentRoute() {
  const currentUser = getCurrentUser();
  if (currentUser?.role === "EXTERNAL_VERIFIER") {
    return <Navigate to="/external/verify" replace />;
  }
  if (currentUser?.role === "COLLEGE") {
    return <Navigate to="/college/dashboard" replace />;
  }
  if (currentUser?.role === "AICTE") {
    return <Navigate to="/aicte/dashboard" replace />;
  }
  return <Navigate to="/" replace />;
}

function App() {
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
        {/* Government UX4G Accessibility Top Strip */}
        <TopGovStrip />

        {/* Government Header with Logo & Role Controls */}
        <GovHeader />

        {/* Dynamic Route Content */}
        <div style={{ flex: 1 }}>
          <Routes>
            {/* Public Landing Page */}
            <Route path="/" element={<LandingPage />} />

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
              <Route path="validate" element={<CollegeValidate />} />
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
              {/* Old /aicte/audit route → redirect to National Reports with audit view open */}
              <Route path="audit" element={<Navigate to="/aicte/reports?view=audit" replace />} />
              <Route path="reports" element={<AicteReports />} />
              <Route path="repository" element={<AicteRepository />} />
              <Route path="student-journey" element={<StudentJourney role="AICTE" />} />
            </Route>

            {/* External Verifier Portal Protected Routes */}
            <Route
              path="/external"
              element={
                <ProtectedRoute allowedRoles={["EXTERNAL_VERIFIER"]}>
                  <ExternalVerifierLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/external/verify" replace />} />
              <Route path="verify" element={<ExternalVerifierVerify />} />
              <Route path="history" element={<ExternalVerifierHistory />} />
            </Route>

            {/* Existing QR/link entry point now requires External Verifier login */}
            <Route path="/verify/:token" element={<ExternalVerifierEntry />} />
            <Route path="/verify" element={<Navigate to="/" replace />} />

            {/* Removed Student portal URLs */}
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
