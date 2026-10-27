// Student records for the three demo colleges (synthetic data only).
// Do NOT use real data. IDs are 12‑digit numeric strings.

export const STUDENT_RECORDS = {
  "INST-001": [
    { name: "Aarav Mehta", apaarId: "111122223331", dateOfBirth: "2005-04-12", gender: "Male", programme: "Computer Engineering", admissionYear: "2022", category: "GENERAL", admissionStatus: "ENROLLED" },
    { name: "Diya Patil", apaarId: "111122223332", dateOfBirth: "2005-09-21", gender: "Female", programme: "Information Technology", admissionYear: "2022", category: "OBC", admissionStatus: "ENROLLED" },
    { name: "Aditya Shah", apaarId: "111122223333", dateOfBirth: "2005-01-18", gender: "Male", programme: "Electronics", admissionYear: "2022", category: "SC", admissionStatus: "ENROLLED" },
    { name: "Pooja Singh", apaarId: "111122223334", dateOfBirth: "2005-05-30", gender: "Female", programme: "Mechanical", admissionYear: "2022", category: "ST", admissionStatus: "ENROLLED" },
    { name: "Gaurav Kumar", apaarId: "111122223335", dateOfBirth: "2005-08-14", gender: "Male", programme: "Civil Engineering", admissionYear: "2022", category: "EWS", admissionStatus: "ENROLLED" },
    { name: "Meera Nair", apaarId: "111122223336", dateOfBirth: "2005-02-11", gender: "Female", programme: "Computer Engineering", admissionYear: "2022", category: "GENERAL", admissionStatus: "ENROLLED" },
    { name: "Kunal Bansal", apaarId: "111122223337", dateOfBirth: "2005-11-03", gender: "Male", programme: "Computer Engineering", admissionYear: "2022", category: "OBC", admissionStatus: "ENROLLED" },
    { name: "Rohan Kulkarny", apaarId: "111122223338", dateOfBirth: "2005-12-04", gender: "Male", programme: "Information Technology", admissionYear: "2022", category: "GENERAL", admissionStatus: "ENROLLED" },
    { name: "Ishita Sen", apaarId: "111122223339", dateOfBirth: "2005-06-19", gender: "Female", programme: "Electronics", admissionYear: "2022", category: "SC", admissionStatus: "ENROLLED" },
    { name: "Nisha Rao", apaarId: "111122223340", dateOfBirth: "2005-03-07", gender: "Female", programme: "Mechanical", admissionYear: "2022", category: "ST", admissionStatus: "ENROLLED" },
    // New problematic records for INST-001
    { name: "Missing DOB", apaarId: "111122223351", dateOfBirth: "", gender: "Female", programme: "Information Technology", admissionYear: "2022", category: "OBC", admissionStatus: "ENROLLED" },
    { name: "Invalid ID", apaarId: "ABCDEF", dateOfBirth: "2005-07-15", gender: "Male", programme: "Mechanical", admissionYear: "2022", category: "SC", admissionStatus: "ENROLLED" },
    { name: "Bad Category", apaarId: "111122223352", dateOfBirth: "2005-09-01", gender: "Male", programme: "Civil Engineering", admissionYear: "2022", category: "UNKNOWN", admissionStatus: "ENROLLED" },
    { name: "Complete Record", apaarId: "111122223353", dateOfBirth: "2005-10-10", gender: "Female", programme: "Electronics", admissionYear: "2022", category: "ST", admissionStatus: "ENROLLED" }
  ],
  "INST-002": [
    { name: "Rohan Kulkarni", apaarId: "111122223331", dateOfBirth: "2005-04-12", gender: "Male", programme: "Computer Engineering", admissionYear: "2022", category: "GENERAL", admissionStatus: "ENROLLED" }, // overlapping with INST-001
    { name: "Sneha Roy", apaarId: "111122223341", dateOfBirth: "2005-09-21", gender: "Female", programme: "Information Technology", admissionYear: "2022", category: "OBC", admissionStatus: "ENROLLED" },
    { name: "Vikram Joshi", apaarId: "111122223342", dateOfBirth: "2005-01-18", gender: "Male", programme: "Civil Engineering", admissionYear: "2022", category: "SC", admissionStatus: "ENROLLED" },
    { name: "Priya Nambiar", apaarId: "111122223343", dateOfBirth: "2005-05-30", gender: "Female", programme: "Mechanical", admissionYear: "2022", category: "ST", admissionStatus: "ENROLLED" },
    { name: "Arjun Deshmukh", apaarId: "111122223344", dateOfBirth: "2005-08-14", gender: "Male", programme: "Computer Engineering", admissionYear: "2022", category: "GENERAL", admissionStatus: "ENROLLED" },
    { name: "Tariq Al-Mansoor", apaarId: "111122223345", dateOfBirth: "2005-02-11", gender: "Male", programme: "Information Technology", admissionYear: "2022", category: "OBC", admissionStatus: "ENROLLED" },
    { name: "Leela Menon", apaarId: "111122223346", dateOfBirth: "2005-11-03", gender: "Female", programme: "Electronics", admissionYear: "2022", category: "SC", admissionStatus: "ENROLLED" },
    { name: "Omar Khan", apaarId: "111122223347", dateOfBirth: "2005-12-04", gender: "Male", programme: "Civil Engineering", admissionYear: "2022", category: "GENERAL", admissionStatus: "ENROLLED" },
    { name: "Vikram Joshi", apaarId: "111122223342", dateOfBirth: "2005-01-18", gender: "Male", programme: "Mechanical", admissionYear: "2022", category: "ST", admissionStatus: "ENROLLED" }, // duplicate within same college as earlier entry (intentional test)
    { name: "Kavya Iyer", apaarId: "111122223348", dateOfBirth: "2005-03-07", gender: "Female", programme: "Computer Engineering", admissionYear: "2022", category: "EWS", admissionStatus: "ENROLLED" }
  ],
  "INST-003": [
    { name: "Rohan Kulkarni", apaarId: "111122223331", dateOfBirth: "2005-04-12", gender: "Male", programme: "Information Technology", admissionYear: "2022", category: "GENERAL", admissionStatus: "ENROLLED" }, // overlapping with both other colleges
    { name: "Anjali Desai", apaarId: "111122223349", dateOfBirth: "2005-09-21", gender: "Female", programme: "Computer Engineering", admissionYear: "2022", category: "OBC", admissionStatus: "ENROLLED" },
    { name: "Kabir Shah", apaarId: "111122223350", dateOfBirth: "2005-01-18", gender: "Male", programme: "Electronics", admissionYear: "2022", category: "SC", admissionStatus: "ENROLLED" },
    { name: "Leela Menon", apaarId: "111122223346", dateOfBirth: "2005-11-03", gender: "Female", programme: "Mechanical", admissionYear: "2022", category: "ST", admissionStatus: "ENROLLED" }, // overlapping with INST-002
    { name: "Omar Khan", apaarId: "111122223347", dateOfBirth: "2005-12-04", gender: "Male", programme: "Civil Engineering", admissionYear: "2022", category: "GENERAL", admissionStatus: "ENROLLED" }, // overlapping with INST-002
    { name: "Maya Patel", apaarId: "111122223351", dateOfBirth: "2005-02-11", gender: "Female", programme: "Computer Engineering", admissionYear: "2022", category: "EWS", admissionStatus: "ENROLLED" },
    { name: "Sanjay Rao", apaarId: "111122223352", dateOfBirth: "2005-05-30", gender: "Male", programme: "Information Technology", admissionYear: "2022", category: "GENERAL", admissionStatus: "ENROLLED" },
    { name: "Neel Kapoor", apaarId: "111122223353", dateOfBirth: "2005-08-14", gender: "Male", programme: "Mechanical", admissionYear: "2022", category: "OBC", admissionStatus: "ENROLLED" },
    { name: "Sara Qureshi", apaarId: "111122223354", dateOfBirth: "2005-02-11", gender: "Female", programme: "Civil Engineering", admissionYear: "2022", category: "SC", admissionStatus: "ENROLLED" },
    { name: "Kavya Iyer", apaarId: "111122223348", dateOfBirth: "2005-03-07", gender: "Female", programme: "Electronics", admissionYear: "2022", category: "ST", admissionStatus: "ENROLLED" }
  ]
};
