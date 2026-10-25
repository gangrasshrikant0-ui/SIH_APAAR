// Student API (Simulated REST /api/v1/student/*)
export const studentApi = {
  async getStudentProfile(apaarId) {
    await new Promise((res) => setTimeout(res, 120));
    return {
      name: "Aarav Sharma",
      apaarId: apaarId || "111122223333",
      studentId: "SE-COMP-001",
      institutionName: "Pune Institute of Computer Technology (PICT)",
      programme: "B.Tech Computer Engineering",
      status: "ACCEPTED",
      statusDescription: "Accepted into central student enrolment repository. Format-checked, not identity-verified.",
      consentGranted: true,
      lastConsentUpdate: new Date().toISOString()
    };
  }
};
