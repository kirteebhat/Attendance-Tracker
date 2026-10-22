export interface StoredDisplayCredentials {
  displayId: string;
  terminalId: string;
  credential: string;
  name: string;
  location: string;
  pairedAt?: string;
}

const STORAGE_KEY = "vorldx_display_credentials";

export function getStoredCredentials(): StoredDisplayCredentials | null {
  if (typeof window === "undefined") {
    return null;
  }
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && (parsed.displayId || parsed.terminalId) && parsed.credential) {
      return {
        displayId: parsed.displayId || parsed.terminalId,
        terminalId: parsed.terminalId || parsed.displayId,
        credential: parsed.credential,
        name: parsed.name || "Office Display",
        location: parsed.location || "Office Lobby",
        pairedAt: parsed.pairedAt || new Date().toISOString(),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function saveStoredCredentials(creds: StoredDisplayCredentials): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(creds));
  } catch (err) {
    console.error("Failed to save credentials to localStorage:", err);
  }
}

export function clearStoredCredentials(): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.error("Failed to clear credentials from localStorage:", err);
  }
}

