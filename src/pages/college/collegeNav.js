// College portal tab order and default landing path.
// Keep in sync with CollegeLayout and App routes.

export const COLLEGE_DEFAULT_PATH = "/college/dashboard";

export const COLLEGE_PORTAL_TABS = [
  { n: 1, label: "Intake Dashboard", to: "/college/dashboard" },
  { n: 2, label: "Batch Upload & Ingestion", to: "/college/upload" },
  { n: 3, label: "Validate Records", to: "/college/validate" },
  { n: 4, label: "Issue Workbench", to: "/college/workbench" },
  { n: 5, label: "Compliance Reports", to: "/college/reports" },
  { n: 6, label: "Student Journey", to: "/college/student-journey" }
];

// Old paths that still resolve (same URL) or redirect to the new default.
export const COLLEGE_ROUTE_REDIRECTS = [
  { from: "/college", to: COLLEGE_DEFAULT_PATH },
  { from: "/college/add-students", to: "/college/upload?mode=manual" }
];

export const COLLEGE_LEGACY_PATHS_UNCHANGED = [
  "/college/upload",
  "/college/workbench",
  "/college/dashboard",
  "/college/reports"
];
