// Authentication API
// Simulates REST endpoint /api/v1/auth/*

import { DEMO_ACCOUNTS, getCurrentUser, setCurrentUser } from "../mocks/mockStore.js";
import { logAuditEvent } from "../mocks/mockAuditLog.js";

export const authApi = {
  // Login method supporting College, AICTE, and External Verifier
  async login({ role }) {
    // Artificial latency for realistic REST API simulation
    await new Promise((res) => setTimeout(res, 250));

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

    if (role === "EXTERNAL_VERIFIER") {
      const verifierUser = DEMO_ACCOUNTS.EXTERNAL_VERIFIER;
      setCurrentUser(verifierUser);
      return { success: true, user: verifierUser };
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
