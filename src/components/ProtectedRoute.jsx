import React, { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { getCurrentUser } from "../mocks/mockStore";
import { authApi } from "../api/authApi";
import { AccessDenied } from "./AccessDenied";

export function ProtectedRoute({ allowedRoles, children }) {
  const location = useLocation();
  const currentUser = getCurrentUser();
  const loggedRef = useRef(false);

  const isAllowed = currentUser && allowedRoles.includes(currentUser.role);

  useEffect(() => {
    if (!isAllowed && !loggedRef.current) {
      loggedRef.current = true;
      authApi.logUnauthorizedAccess(
        location.pathname,
        currentUser ? currentUser.role : "GUEST",
        allowedRoles.join(" or ")
      );
    }
  }, [isAllowed, location.pathname, currentUser, allowedRoles]);

  if (!isAllowed) {
    return (
      <AccessDenied
        requiredRole={allowedRoles.join(" or ")}
        attemptedPath={location.pathname}
      />
    );
  }

  return children;
}
