// Mock AICTE Approval Master (Rulebook)
// Represents official government sanctions. Colleges cannot modify this master data.

export const APPROVAL_MASTER = {
  academicYear: "2026-2027",
  lastUpdated: "2026-08-15T10:00:00Z",
  institutions: [
    {
      id: "INST-001",
      aicteId: "AICTE-1-1029384",
      name: "Pune Institute of Computer Technology (PICT)",
      shortName: "PICT Pune",
      campus: "Dhankawadi, Pune, Maharashtra - 411043",
      type: "Private Autonomous",
      programmes: [
        {
          code: "COMP",
          name: "Computer Engineering",
          degree: "B.Tech",
          approvedIntake: 120,
          categoryLimits: {
            GENERAL: 60,
            OBC: 32,
            SC: 16,
            ST: 8,
            EWS: 12, // Supernumerary 10%
            TFWS: 6, // Supernumerary 5%
            NRI_FN: 5 // Supernumerary NRI/OCI/FN limit
          }
        },
        {
          code: "IT",
          name: "Information Technology",
          degree: "B.Tech",
          approvedIntake: 120,
          categoryLimits: {
            GENERAL: 60,
            OBC: 32,
            SC: 16,
            ST: 8,
            EWS: 12,
            TFWS: 6,
            NRI_FN: 5
          }
        },
        {
          code: "ENTC",
          name: "Electronics & Telecommunication Engineering",
          degree: "B.Tech",
          approvedIntake: 120,
          categoryLimits: {
            GENERAL: 60,
            OBC: 32,
            SC: 16,
            ST: 8,
            EWS: 12,
            TFWS: 6,
            NRI_FN: 5
          }
        },
        {
          code: "AIDS",
          name: "Artificial Intelligence & Data Science",
          degree: "B.Tech",
          approvedIntake: 60,
          categoryLimits: {
            GENERAL: 30,
            OBC: 16,
            SC: 8,
            ST: 4,
            EWS: 6,
            TFWS: 3,
            NRI_FN: 3
          }
        }
      ]
    },
    {
      id: "INST-002",
      aicteId: "AICTE-1-1099231",
      name: "College of Engineering Pune (COEP Technological University)",
      shortName: "COEP Tech",
      campus: "Shivajinagar, Pune, Maharashtra - 411005",
      type: "State University",
      programmes: [
        {
          code: "COMP",
          name: "Computer Engineering",
          degree: "B.Tech",
          approvedIntake: 150,
          categoryLimits: { NRI_FN: 10 }
        },
        {
          code: "MECH",
          name: "Mechanical Engineering",
          degree: "B.Tech",
          approvedIntake: 120,
          categoryLimits: { NRI_FN: 5 }
        }
      ]
    },
    {
      id: "INST-003",
      aicteId: "AICTE-1-1088421",
      name: "Veermata Jijabai Technological Institute (VJTI Mumbai)",
      shortName: "VJTI Mumbai",
      campus: "Matunga, Mumbai, Maharashtra - 400019",
      type: "Autonomous State Institute",
      programmes: [
        {
          code: "COMP",
          name: "Computer Engineering",
          degree: "B.Tech",
          approvedIntake: 120,
          categoryLimits: { NRI_FN: 5 }
        }
      ]
    }
  ]
};
