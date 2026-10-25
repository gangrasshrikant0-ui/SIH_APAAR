// Authentication API
// Simulates REST endpoint /api/v1/auth/*

import { DEMO_ACCOUNTS, getCurrentUser, setCurrentUser } from "../mocks/mockStore";
import { logAuditEvent } from "../mocks/mockAuditLog";

export const authApi = {
  // Login method supporting Student, College, and AICTE
  async login({ role, identifier, password, otp }) {
    // Artificial latency for realistic REST API simulation
    await new Promise((res) => setTimeout(res, 250));

    if (role === "STUDENT") {
      const demoStudent = DEMO_ACCOUNTS.STUDENT;
      // Allow demo login with demo APAAR or any 12 digit input
      const cleanApaar = (identifier || "").replace(/\s+/g, "");
      if (cleanApaar.length === 12 || cleanApaar === demoStudent.apaarId) {
        const studentUser = {
          ...demoStudent,
          apaarId: cleanApaar || demoStudent.apaarId
        };
        setCurrentUser(studentUser);
        return { success: true, user: studentUser };
      }
      throw new Error("Invalid APAAR ID format. APAAR ID must be exactly 12 digits (format-checked, not identity-verified).");
    }

    if (role === "COLLEGE") {
      const collegeUser = DEMO_ACCOUNTS.COLLEGE;
      // Accept demo login
      setCurrentUser(collegeUser);
      return { success: true, user: collegeUser };
    }

    if (role === "AICTE") {
      const aicteUser = DEMO_ACCOUNTS.AICTE;
      // Accept demo login
      setCurrentUser(aicteUser);
      return { success: true, user: aicteUser };
    }

    throw new Error("Unknown role specified.");
  },

  async logout() {
    await new Promise((res) => setTimeout(res, 100));
    setCurrentUser(null);
    return { success: true };
  },

  async getCurrentUser() {
    return getCurrentUser();
  },

  // Log unauthorized access attempts (route guards)
  async logUnauthorizedAccess(path, userRole, requiredRole) {
    const user = getCurrentUser();
    logAuditEvent({
      actorName: user ? user.name : "Anonymous Guest",
      actorRole: user ? user.role : "GUEST",
      actorEmail: user ? user.email : "guest@unauthenticated.local",
      actionType: "UNAUTHORIZED_ACCESS_ATTEMPT",
      resourceType: "ROUTE_GUARD",
      resourceId: path,
      details: `Attempted access to protected path '${path}' requiring '${requiredRole}'. Current role is '${userRole || "GUEST"}'.`,
      changeSummary: "Access blocked by route guard",
      severity: "CRITICAL"
    });
  }
};
