// College portal tab order and default landing path.
// Keep in sync with CollegeLayout and App routes.

export const COLLEGE_DEFAULT_PATH = "/college/dashboard";

export const COLLEGE_PORTAL_TABS = [
  { n: 1, label: "Intake Dashboard", to: "/college/dashboard" },
  { n: 2, label: "Add Students", to: "/college/add-students" },
  { n: 3, label: "Batch Upload & Ingestion", to: "/college/upload" },
  { n: 4, label: "Validate Records", to: "/college/validate" },
  { n: 5, label: "Issue Workbench", to: "/college/workbench" },
  { n: 6, label: "Compliance Reports", to: "/college/reports" }
];

// Old paths that still resolve (same URL) or redirect to the new default.
export const COLLEGE_ROUTE_REDIRECTS = [
  { from: "/college", to: COLLEGE_DEFAULT_PATH }
];

export const COLLEGE_LEGACY_PATHS_UNCHANGED = [
  "/college/upload",
  "/college/workbench",
  "/college/dashboard",
  "/college/reports"
];
