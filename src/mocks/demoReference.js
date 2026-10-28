// Central SYNTHETIC / DEMO reference data for EDUVÉRIFY.
// Not real APAAR identities, AICTE accreditation, or live institutional APIs.

export const DEMO_DATA_NOTICE =
  "SYNTHETIC / DEMO data only. Identifiers are generated test values and are not verified by the real APAAR platform.";

export const APAAR_REGISTRY_MODE = "DEMO";

export const VALID_YEARS_OF_STUDY = [
  "FE", "SE", "TE", "BE", "FY", "SY", "TY",
  "1", "2", "3", "4",
  "YEAR 1", "YEAR 2", "YEAR 3", "YEAR 4",
  "2025-2026", "2026-2027"
];

export const VALID_ADMISSION_STATUSES = [
  "ADMITTED", "ENROLLED", "PROVISIONAL", "CONFIRMED", "CANCELLED"
];

export const VALID_CATEGORIES = [
  "GENERAL", "OBC", "SC", "ST", "EWS", "TFWS", "NRI_FN"
];

// Demo-only APAAR-like identifiers. Canonical stored value remains 12 numeric digits
// so existing format checks keep working. DEMO-AP-****** is a labelled alias.
export const SYNTHETIC_APAAR_ALLOWLIST = [
  { demoCode: "DEMO-AP-000001", apaarId: "984251638019", name: "Aarav Sharma", dateOfBirth: "2007-04-12" },
  { demoCode: "DEMO-AP-000002", apaarId: "111122223334", name: "Diya Deshpande", dateOfBirth: "2007-09-21" },
  { demoCode: "DEMO-AP-000003", apaarId: "111122223335", name: "Aditya Mehta", dateOfBirth: "2007-01-18" },
  { demoCode: "DEMO-AP-000004", apaarId: "222233334441", name: "Pooja Hegde", dateOfBirth: "2007-05-30" },
  { demoCode: "DEMO-AP-000005", apaarId: "222233334442", name: "Gaurav Shinde", dateOfBirth: "2007-08-14" },
  { demoCode: "DEMO-AP-000006", apaarId: "333344445551", name: "Meera Nair", dateOfBirth: "2007-02-11" },
  { demoCode: "DEMO-AP-000007", apaarId: "444455556661", name: "Kunal Bansal", dateOfBirth: "2007-11-03" },
  // Registry name is intentionally a near-match so the simulated APAAR check can return NAME_MISMATCH.
  { demoCode: "DEMO-AP-000008", apaarId: "345678901234", name: "Rohan Kulkarny", dateOfBirth: "2005-05-14" },
  { demoCode: "DEMO-AP-000009", apaarId: "987654321098", name: "Rajesh Sharma", dateOfBirth: "2007-07-09" },
  { demoCode: "DEMO-AP-000010", apaarId: "900100200301", name: "Rohan Varma", dateOfBirth: "2006-12-04" },
  { demoCode: "DEMO-AP-000011", apaarId: "900100200302", name: "Ishita Sen", dateOfBirth: "2006-06-19" },
  { demoCode: "DEMO-AP-000012", apaarId: "900100200303", name: "Nisha Rao", dateOfBirth: "2006-03-07" },
  { demoCode: "DEMO-AP-000013", apaarId: "900100200304", name: "Kabir Shah", dateOfBirth: "2006-10-27" },
  { demoCode: "DEMO-AP-000014", apaarId: "900100200305", name: "Leela Menon", dateOfBirth: "2006-08-16" },
  { demoCode: "DEMO-AP-000015", apaarId: "900100200306", name: "Omar Khan", dateOfBirth: "2006-01-22" },
  { demoCode: "DEMO-AP-000016", apaarId: "234567890123", name: "Vikram Joshi", dateOfBirth: "2007-03-01" },
  { demoCode: "DEMO-AP-000017", apaarId: "456789012345", name: "Arjun Deshmukh", dateOfBirth: "2007-03-02" },
  { demoCode: "DEMO-AP-000018", apaarId: "567890123456", name: "Tariq Al-Mansoor", dateOfBirth: "2007-03-03" },
  { demoCode: "DEMO-AP-000019", apaarId: "678901234567", name: "Priya Nambiar", dateOfBirth: "2007-03-04" },
  { demoCode: "DEMO-AP-000020", apaarId: "611122223333", name: "Meera Joshi", dateOfBirth: "2007-03-10" },
  { demoCode: "DEMO-AP-000021", apaarId: "622233334444", name: "Valid Student", dateOfBirth: "2007-03-11" },
  { demoCode: "DEMO-AP-000022", apaarId: "644455556666", name: "Aero Student", dateOfBirth: "2007-03-12" },
  { demoCode: "DEMO-AP-000023", apaarId: "655566667777", name: "Other College Student", dateOfBirth: "2007-03-13" },
  { demoCode: "DEMO-AP-000024", apaarId: "888899990000", name: "Kavya Iyer", dateOfBirth: "2006-09-09" },
  { demoCode: "DEMO-AP-000025", apaarId: "998877665544", name: "*", dateOfBirth: "2007-01-01" },
  { demoCode: "DEMO-AP-000026", apaarId: "887766554433", name: "*", dateOfBirth: "2007-01-01" },
  { demoCode: "DEMO-AP-000027", apaarId: "121212121212", name: "Anjali Desai", dateOfBirth: "2006-04-04" },
  { demoCode: "DEMO-AP-000032", apaarId: "982345678901", name: "Ananya Patil", dateOfBirth: "2006-08-12" },
  { demoCode: "DEMO-AP-000028", apaarId: "111122223336", name: "Sana Kulkarni", dateOfBirth: "2007-04-04" },
  { demoCode: "DEMO-AP-000029", apaarId: "111122223337", name: "Harsh Vyas", dateOfBirth: "2007-04-05" },
  { demoCode: "DEMO-AP-000030", apaarId: "111122223338", name: "Neel Kapoor", dateOfBirth: "2007-04-06" },
  { demoCode: "DEMO-AP-000031", apaarId: "111122223339", name: "Sara Qureshi", dateOfBirth: "2007-04-07" }
];

export const SYNTHETIC_APAAR_REGISTRY = SYNTHETIC_APAAR_ALLOWLIST.map(({ apaarId, name, dateOfBirth }) => ({
  apaarId,
  name,
  dateOfBirth,
  synthetic: true
}));

export const DEMO_INSTITUTIONS = [
  {
    id: "INST-001",
    aicteId: "AICTE-1-1029384",
    name: "Pune Institute of Computer Technology (PICT)",
    shortName: "PICT Pune",
    campus: "Dhankawadi, Pune, Maharashtra - 411043",
    type: "Private Autonomous (demo)",
    username: "pict_admin",
    email: "pict.admin@college.edu",
    password: "demo123",
    adminName: "Dr. Arvind Kulkarni",
    adminTitle: "Registrar / Institutional Nodal Officer",
    avatar: "PICT"
  },
  {
    id: "INST-002",
    aicteId: "AICTE-1-1099231",
    name: "College of Engineering Pune (COEP Technological University)",
    shortName: "COEP Tech",
    campus: "Shivajinagar, Pune, Maharashtra - 411005",
    type: "State University (demo)",
    username: "coep_admin",
    email: "coep.admin@college.edu",
    password: "demo123",
    adminName: "Dr. Sunita Pawar",
    adminTitle: "Registrar / Institutional Nodal Officer",
    avatar: "COEP"
  },
  {
    id: "INST-003",
    aicteId: "AICTE-1-1088421",
    name: "Veermata Jijabai Technological Institute (VJTI Mumbai)",
    shortName: "VJTI Mumbai",
    campus: "Matunga, Mumbai, Maharashtra - 400019",
    type: "Autonomous State Institute (demo)",
    username: "vjti_admin",
    email: "vjti.admin@college.edu",
    password: "demo123",
    adminName: "Dr. Ramesh Kulkarni",
    adminTitle: "Registrar / Institutional Nodal Officer",
    avatar: "VJTI"
  }
];

function collegeUserFromInstitution(institution) {
  return {
    role: "COLLEGE",
    id: institution.id,
    name: institution.adminName,
    title: institution.adminTitle,
    institutionName: institution.name,
    aicteId: institution.aicteId,
    email: institution.email,
    avatar: institution.avatar,
    username: institution.username,
    passwordHint: institution.password,
    synthetic: true
  };
}

export const DEMO_STAFF_ACCOUNTS = {
  AICTE: {
    role: "AICTE",
    id: "AICTE-HQ",
    name: "Dr. M. Jagadesh Kumar",
    title: "AICTE Central Review Bureau Chief (demo persona)",
    institutionName: "All India Council for Technical Education (HQ New Delhi) — DEMO",
    aicteId: "AICTE-HQ-CENTRAL",
    email: "aicte.central@gov.in",
    avatar: "AICTE",
    username: "aicte_officer",
    passwordHint: "demo123",
    synthetic: true
  },
  EXTERNAL_VERIFIER: {
    role: "EXTERNAL_VERIFIER",
    id: "VERIFIER-001",
    name: "Meera Kapoor",
    title: "Authorised External Verifier (demo persona)",
    institutionName: "National Credential Review Office — DEMO",
    email: "verifier@credential-review.example",
    avatar: "EV",
    username: "external_verifier",
    passwordHint: "demo123",
    synthetic: true
  }
};

export const DEMO_STUDENT_ACCOUNTS = [
  {
    role: "STUDENT",
    id: "STU-001",
    name: "Aarav Sharma",
    apaarId: "984251638019",
    prn: "PRN-2026001",
    institutionName: "Pune Institute of Computer Technology",
    email: "aarav.sharma@student.edu",
    username: "aarav.sharma",
    passwordHint: "PRN-2026001",
    synthetic: true
  },
  {
    role: "STUDENT",
    id: "STU-002",
    name: "Diya Deshpande",
    apaarId: "111122223334",
    prn: "PRN-2026002",
    institutionName: "Pune Institute of Computer Technology",
    email: "diya.deshpande@student.edu",
    username: "diya.deshpande",
    passwordHint: "PRN-2026002",
    synthetic: true
  }
];

export const DEMO_ACCOUNTS = {
  COLLEGE: collegeUserFromInstitution(DEMO_INSTITUTIONS[0]),
  AICTE: DEMO_STAFF_ACCOUNTS.AICTE,
  EXTERNAL_VERIFIER: DEMO_STAFF_ACCOUNTS.EXTERNAL_VERIFIER,
  STUDENT: DEMO_STUDENT_ACCOUNTS[0]
};

export function listDemoCollegeUsers() {
  return DEMO_INSTITUTIONS.map(collegeUserFromInstitution);
}

export function listDemoLoginHints() {
  return [
    ...DEMO_INSTITUTIONS.map((institution) => ({
      role: "COLLEGE",
      label: institution.shortName,
      identifier: institution.email,
      username: institution.username,
      password: institution.password
    })),
    {
      role: "AICTE",
      label: "AICTE HQ (demo)",
      identifier: DEMO_STAFF_ACCOUNTS.AICTE.email,
      username: DEMO_STAFF_ACCOUNTS.AICTE.username,
      password: DEMO_STAFF_ACCOUNTS.AICTE.passwordHint
    },
    {
      role: "EXTERNAL_VERIFIER",
      label: "External verifier (demo)",
      identifier: DEMO_STAFF_ACCOUNTS.EXTERNAL_VERIFIER.email,
      username: DEMO_STAFF_ACCOUNTS.EXTERNAL_VERIFIER.username,
      password: DEMO_STAFF_ACCOUNTS.EXTERNAL_VERIFIER.passwordHint
    },
    ...DEMO_STUDENT_ACCOUNTS.map((student) => ({
      role: "STUDENT",
      label: `${student.name} (student demo)`,
      identifier: student.email,
      username: student.username,
      password: student.passwordHint
    }))
  ];
}

function publicUser(user) {
  if (!user) return null;
  const { passwordHint, ...rest } = user;
  return { ...rest, passwordHint };
}

export function authenticateDemoUser({ role, identifier, password }) {
  const id = String(identifier || "").trim().toLowerCase();
  const pwd = String(password || "");
  if (!id || !pwd) {
    throw new Error("Enter the demo email/username and password.");
  }

  if (role === "COLLEGE") {
    const institution = DEMO_INSTITUTIONS.find((item) =>
      item.email.toLowerCase() === id || item.username.toLowerCase() === id || item.id.toLowerCase() === id
    );
    if (!institution || institution.password !== pwd) {
      throw new Error("Unknown demo institution credentials. Use a listed SYNTHETIC college account.");
    }
    return publicUser(collegeUserFromInstitution(institution));
  }

  if (role === "AICTE") {
    const account = DEMO_STAFF_ACCOUNTS.AICTE;
    if ((account.email.toLowerCase() !== id && account.username.toLowerCase() !== id) || account.passwordHint !== pwd) {
      throw new Error("Unknown AICTE demo credentials.");
    }
    return publicUser(account);
  }

  if (role === "EXTERNAL_VERIFIER") {
    const account = DEMO_STAFF_ACCOUNTS.EXTERNAL_VERIFIER;
    if ((account.email.toLowerCase() !== id && account.username.toLowerCase() !== id) || account.passwordHint !== pwd) {
      throw new Error("Unknown external verifier demo credentials.");
    }
    return publicUser(account);
  }

  if (role === "STUDENT") {
    const account = DEMO_STUDENT_ACCOUNTS.find((item) =>
      item.email.toLowerCase() === id ||
      item.username.toLowerCase() === id ||
      item.apaarId.toLowerCase() === id ||
      item.prn.toLowerCase() === id
    );
    if (!account || account.passwordHint !== pwd) {
      throw new Error("Unknown student demo credentials. Use the listed APAAR student account.");
    }
    return publicUser(account);
  }

  throw new Error("Unknown role specified.");
}

export function demoInstitutionById(institutionId) {
  return DEMO_INSTITUTIONS.find((item) => item.id === institutionId) || null;
}

export function normalizeSyntheticApaar(value) {
  const raw = String(value || "").trim();
  if (!raw) return "";
  const upper = raw.toUpperCase();
  const byCode = SYNTHETIC_APAAR_ALLOWLIST.find((item) => item.demoCode === upper);
  if (byCode) return byCode.apaarId;
  return raw.replace(/\s+/g, "");
}

export function demoCodeForApaar(apaarId) {
  return SYNTHETIC_APAAR_ALLOWLIST.find((item) => item.apaarId === apaarId)?.demoCode || null;
}

export function isValidYearOfStudy(value) {
  return VALID_YEARS_OF_STUDY.includes(String(value || "").trim().toUpperCase());
}

export function isValidAdmissionStatus(value) {
  if (value === undefined || value === null) return true;
  const normalized = String(value).trim().toUpperCase();
  if (!normalized) return false;
  return VALID_ADMISSION_STATUSES.includes(normalized);
}

export function isValidCategory(value) {
  return VALID_CATEGORIES.includes(String(value || "").trim().toUpperCase());
}
