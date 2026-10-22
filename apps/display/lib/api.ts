import { StoredDisplayCredentials } from "./storage";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000";

export interface PairResponse {
  success: boolean;
  displayId: string;
  terminalId: string;
  credential: string;
  name: string;
  location: string;
  code?: string;
  message?: string;
}

export interface QrTokenResponse {
  success: boolean;
  token: string;
  qrPayload: string;
  displayId: string;
  terminalId: string;
  issuedAt: string;
  expiresAt: string;
  ttlSeconds: number;
  serverTime: number;
  code?: string;
  message?: string;
}

export class DisplayApiError extends Error {
  public code?: string;
  public status?: number;

  constructor(message: string, code?: string, status?: number) {
    super(message);
    this.name = "DisplayApiError";
    this.code = code;
    this.status = status;
  }
}

/**
 * Pairs a physical display terminal with a one-time pairing code
 */
export async function pairDisplayTerminal(pairingCode: string): Promise<PairResponse> {
  const normalizedCode = pairingCode.trim().toUpperCase();
  const url = `${API_BASE}/api/displays/pair`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ pairingCode: normalizedCode }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.success) {
    throw new DisplayApiError(
      data.message || "Failed to pair display terminal",
      data.code,
      res.status
    );
  }

  return {
    success: true,
    displayId: data.displayId || data.terminalId,
    terminalId: data.terminalId || data.displayId,
    credential: data.credential,
    name: data.name || "Office Display",
    location: data.location || "Office Lobby",
  };
}

/**
 * Requests a new rotating challenge token for an authorized display
 */
export async function fetchRotatingChallenge(
  creds: StoredDisplayCredentials
): Promise<QrTokenResponse> {
  const url = `${API_BASE}/api/displays/token`;

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-display-id": creds.displayId || creds.terminalId,
      "x-display-credential": creds.credential,
      "x-terminal-id": creds.displayId || creds.terminalId,
      "x-terminal-secret": creds.credential,
    },
    body: JSON.stringify({}),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok || !data.success) {
    throw new DisplayApiError(
      data.message || "Failed to fetch QR challenge",
      data.code,
      res.status
    );
  }

  return data as QrTokenResponse;
}
