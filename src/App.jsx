import React, { useEffect } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
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

import { AicteLayout } from "./pages/aicte/AicteLayout";
import { AicteDashboard } from "./pages/aicte/AicteDashboard";
import { AicteReviewQueue } from "./pages/aicte/AicteReviewQueue";
import { AicteAuditLog } from "./pages/aicte/AicteAuditLog";
import { AicteReports } from "./pages/aicte/AicteReports";

import { StudentRecord } from "./pages/student/StudentRecord";
import { PublicVerify } from "./pages/public/PublicVerify";

import { initializeStore } from "./mocks/mockStore";

function App() {
  useEffect(() => {
    initializeStore();
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
              <Route index element={<Navigate to="/college/workbench" replace />} />
              <Route path="upload" element={<CollegeUpload />} />
              <Route path="workbench" element={<CollegeWorkbench />} />
              <Route path="dashboard" element={<CollegeDashboard />} />
              <Route path="reports" element={<CollegeReports />} />
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
              <Route path="audit" element={<AicteAuditLog />} />
              <Route path="reports" element={<AicteReports />} />
            </Route>

            {/* Student Portal Protected Routes */}
            <Route
              path="/student/*"
              element={
                <ProtectedRoute allowedRoles={["STUDENT"]}>
                  <StudentRecord />
                </ProtectedRoute>
              }
            />

            {/* Public Token Verification */}
            <Route path="/verify/:token" element={<PublicVerify />} />
            <Route path="/verify" element={<Navigate to="/verify/111122223333" replace />} />

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
