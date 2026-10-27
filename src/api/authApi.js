// Authentication API
// Simulates REST endpoint /api/v1/auth/*

import {
  getCurrentUser,
  setCollegeConsent,
  setCurrentUser
} from "../mocks/mockStore.js";
import { authenticateDemoUser } from "../mocks/demoReference.js";
import { logAuditEvent } from "../mocks/mockAuditLog.js";

export const authApi = {
  // Login method supporting College, AICTE, and External Verifier
  async login({ role, identifier, password }) {
    await new Promise((res) => setTimeout(res, 250));
    const user = authenticateDemoUser({ role, identifier, password });
    setCurrentUser(user);
    if (user.role === "COLLEGE") setCollegeConsent(user.id, false);
    return { success: true, user };
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
