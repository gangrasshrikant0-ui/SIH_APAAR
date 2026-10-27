import { APAAR_REGISTRY_MODE, SYNTHETIC_APAAR_REGISTRY } from "../mocks/apaarRegistryMock.js";

export function checkApaar(apaarId, name) {
  if (APAAR_REGISTRY_MODE !== "DEMO") {
    throw new Error(`Unsupported APAAR registry mode: ${APAAR_REGISTRY_MODE}`);
  }
  // Production would call the authorised APAAR / DigiLocker service here.
  const entry = SYNTHETIC_APAAR_REGISTRY.find((item) => item.apaarId === apaarId);
  if (!entry) return "NOT_FOUND";
  if (entry.name === "*") return "FOUND";
  return entry.name.trim().toLowerCase() === String(name || "").trim().toLowerCase()
    ? "FOUND"
    : "NAME_MISMATCH";
}
