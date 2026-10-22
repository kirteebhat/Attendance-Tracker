import { Platform } from "react-native";
import { tokenStorage, StoredUserProfile } from "./storage";

/**
 * Resolves the backend API base URL based on environment and runtime platform:
 * - Environment variable EXPO_PUBLIC_API_URL (highest priority)
 * - Android Emulator: http://10.0.2.2:4000
 * - Web & iOS Simulator: http://localhost:4000
 *
 * NOTE FOR PHYSICAL PHONES:
 * When testing on a physical phone via Expo Go on the local network, set:
 * EXPO_PUBLIC_API_URL=http://<YOUR_COMPUTER_LAN_IP>:4000 in apps/mobile/.env
 */
export function getApiBaseUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, "");
  }

  if (Platform.OS === "android") {
    return "http://10.0.2.2:4000";
  }

  return "http://localhost:4000";
}

export class ApiError extends Error {
  public code: string;
  public status: number;
  public details?: unknown;

  constructor(message: string, code: string = "ERR_UNKNOWN", status: number = 500, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.code = code;
    this.status = status;
    this.details = details;
  }
}

let isRefreshing = false;
let refreshSubscribers: ((token: string) => void)[] = [];
let onSessionExpiredCallback: (() => void) | null = null;
let onNetworkStateChangeCallback: ((isOnline: boolean) => void) | null = null;

export function setSessionExpiredListener(callback: () => void): void {
  onSessionExpiredCallback = callback;
}

export function setNetworkStateListener(callback: (isOnline: boolean) => void): void {
  onNetworkStateChangeCallback = callback;
}

function onRefreshed(token: string) {
  refreshSubscribers.forEach((cb) => cb(token));
  refreshSubscribers = [];
}

/**
 * Core HTTP fetch wrapper with authorization header injection,
 * automatic token refresh on ERR_TOKEN_EXPIRED, and network offline detection.
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  isRetry: boolean = false
): Promise<T> {
  const baseUrl = getApiBaseUrl();
  const url = endpoint.startsWith("http") ? endpoint : `${baseUrl}${endpoint}`;

  const headers = new Headers(options.headers || {});
  if (!headers.has("Content-Type") && !(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  // Attach access token if present and not already specified
  const accessToken = await tokenStorage.getAccessToken();
  if (accessToken && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${accessToken}`);
  }

  let response: Response;
  try {
    response = await fetch(url, {
      ...options,
      headers,
    });
    // If request succeeded, notify online
    if (onNetworkStateChangeCallback) {
      onNetworkStateChangeCallback(true);
    }
  } catch (err: unknown) {
    // Network connectivity failure
    if (onNetworkStateChangeCallback) {
      onNetworkStateChangeCallback(false);
    }
    throw new ApiError(
      "Unable to connect to VorldX attendance server. Please check your network connection.",
      "ERR_NETWORK_UNAVAILABLE",
      0,
      err
    );
  }

  const data = await response.json().catch(() => ({}));

  // Handle Token Expiry & Silent Refresh
  if (response.status === 401 && !isRetry) {
    const errorCode = data.code || "";
    if (errorCode === "ERR_TOKEN_EXPIRED" || errorCode === "ERR_UNAUTHORIZED") {
      const refreshToken = await tokenStorage.getRefreshToken();
      if (refreshToken) {
        if (!isRefreshing) {
          isRefreshing = true;
          try {
            const refreshRes = await fetch(`${baseUrl}/api/auth/refresh`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ refreshToken }),
            });
            const refreshData = await refreshRes.json();

            if (refreshRes.ok && refreshData.data?.accessToken) {
              const newAccessToken = refreshData.data.accessToken;
              await tokenStorage.setAccessToken(newAccessToken);
              if (refreshData.data.refreshToken) {
                await tokenStorage.setRefreshToken(refreshData.data.refreshToken);
              }
              isRefreshing = false;
              onRefreshed(newAccessToken);
              return apiRequest<T>(endpoint, options, true);
            } else {
              throw new Error("Refresh failed");
            }
          } catch {
            isRefreshing = false;
            await tokenStorage.clearAll();
            if (onSessionExpiredCallback) {
              onSessionExpiredCallback();
            }
            throw new ApiError("Session has expired. Please log in again.", "ERR_SESSION_EXPIRED", 401);
          }
        } else {
          // Wait for the active refresh to finish
          return new Promise<T>((resolve, reject) => {
            refreshSubscribers.push(async (newToken) => {
              try {
                headers.set("Authorization", `Bearer ${newToken}`);
                const retryRes = await fetch(url, { ...options, headers });
                const retryData = await retryRes.json();
                if (!retryRes.ok) {
                  reject(new ApiError(retryData.message || "Request failed", retryData.code, retryRes.status));
                } else {
                  resolve(retryData);
                }
              } catch (retryErr) {
                reject(retryErr);
              }
            });
          });
        }
      } else {
        // No refresh token available
        await tokenStorage.clearAll();
        if (onSessionExpiredCallback) {
          onSessionExpiredCallback();
        }
      }
    }
  }

  if (!response.ok || data.success === false) {
    throw new ApiError(
      data.message || `Request failed with status ${response.status}`,
      data.code || "ERR_REQUEST_FAILED",
      response.status,
      data.errors
    );
  }

  return data as T;
}

// -----------------------------------------------------------------------------
// Authentication Endpoints
// -----------------------------------------------------------------------------

export interface RegisterStartResponse {
  success: boolean;
  message: string;
  data: {
    employeeId: string;
    email: string;
    maskedEmail: string;
    expiresInMinutes: number;
    simulatedOtp?: string;
  };
}

export interface RegisterVerifyResponse {
  success: boolean;
  message: string;
  data: {
    employeeId: string;
    verificationToken: string;
    expiresInMinutes: number;
  };
}

export interface RegisterCompleteResponse {
  success: boolean;
  message: string;
  data: {
    user: StoredUserProfile;
    accessToken: string;
    refreshToken: string;
  };
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: {
    user: StoredUserProfile;
    accessToken: string;
    refreshToken: string;
  };
}

export const authApi = {
  /**
   * Step 1: Initiate registration with employeeId
   */
  async registerStart(employeeId: string): Promise<RegisterStartResponse> {
    return apiRequest<RegisterStartResponse>("/api/auth/register-start", {
      method: "POST",
      body: JSON.stringify({ employeeId: employeeId.trim().toUpperCase() }),
    });
  },

  /**
   * Step 2: Verify 6-digit OTP
   */
  async registerVerify(employeeId: string, otp: string): Promise<RegisterVerifyResponse> {
    return apiRequest<RegisterVerifyResponse>("/api/auth/register-verify", {
      method: "POST",
      body: JSON.stringify({
        employeeId: employeeId.trim().toUpperCase(),
        otp: otp.trim(),
      }),
    });
  },

  /**
   * Step 3: Complete registration by setting password
   */
  async registerComplete(
    employeeId: string,
    verificationToken: string,
    password: string
  ): Promise<RegisterCompleteResponse> {
    return apiRequest<RegisterCompleteResponse>("/api/auth/register-complete", {
      method: "POST",
      body: JSON.stringify({
        employeeId: employeeId.trim().toUpperCase(),
        verificationToken,
        password,
      }),
    });
  },

  /**
   * Log in with email or employee ID and password
   */
  async login(emailOrEmployeeId: string, password: string): Promise<LoginResponse> {
    return apiRequest<LoginResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({
        email: emailOrEmployeeId.trim(),
        password,
      }),
    });
  },

  /**
   * Get current authenticated user profile
   */
  async getMe(): Promise<{ success: boolean; data: { user: StoredUserProfile } }> {
    return apiRequest<{ success: boolean; data: { user: StoredUserProfile } }>("/api/auth/me");
  },

  /**
   * Log out and invalidate refresh token on backend
   */
  async logout(): Promise<void> {
    const refreshToken = await tokenStorage.getRefreshToken();
    try {
      await apiRequest("/api/auth/logout", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });
    } catch {
      // Ignore logout backend errors
    } finally {
      await tokenStorage.clearAll();
    }
  },
};

export interface AttendanceRecordItem {
  _id: string;
  employeeId: string;
  dateKey: string;
  checkInTime: string | null;
  checkOutTime: string | null;
  durationMinutes: number;
  status: string;
  isLate: boolean;
  lateMinutes: number;
  isWfh: boolean;
  isMissingCheckout: boolean;
  isManuallyCorrected: boolean;
  terminalId?: string;
}

export interface TodayAttendanceResponse {
  success: boolean;
  dateKey: string;
  hasPunched: boolean;
  punchType: "CHECKED_IN" | "CHECKED_OUT" | null;
  status: string;
  record: AttendanceRecordItem | null;
  canCheckIn: boolean;
  canCheckOut: boolean;
}

export interface AttendanceStats {
  totalDays: number;
  presentDays: number;
  lateDays: number;
  halfDays: number;
  wfhDays: number;
  absentDays: number;
  totalWorkMinutes: number;
  attendancePercentage: number;
}

export interface AttendanceHistoryResponse {
  success: boolean;
  data: AttendanceRecordItem[];
  stats: AttendanceStats;
  pagination: {
    page: number;
    limit: number;
    total: number;
    pages: number;
  };
}

export interface ScanAttendanceResult {
  success: boolean;
  punchType: "CHECK_IN" | "CHECK_OUT";
  status: string;
  isLate: boolean;
  lateMinutes: number;
  durationMinutes: number;
  record: AttendanceRecordItem;
  message: string;
}

export const attendanceApi = {
  async getTodayAttendance(): Promise<TodayAttendanceResponse> {
    return apiRequest<TodayAttendanceResponse>("/api/attendance/today");
  },

  async getMyAttendance(params?: {
    month?: string;
    dateKey?: string;
    page?: number;
    limit?: number;
  }): Promise<AttendanceHistoryResponse> {
    const query = new URLSearchParams();
    if (params?.month) query.set("month", params.month);
    if (params?.dateKey) query.set("dateKey", params.dateKey);
    if (params?.page) query.set("page", String(params.page));
    if (params?.limit) query.set("limit", String(params.limit));
    const qs = query.toString();
    return apiRequest<AttendanceHistoryResponse>(`/api/attendance/me${qs ? `?${qs}` : ""}`);
  },

  /**
   * Submits ONLY the QR token to the backend.
   * STRICT SECURITY REQUIREMENT: Never sends a client timestamp!
   */
  async scanAttendance(token: string): Promise<ScanAttendanceResult> {
    return apiRequest<ScanAttendanceResult>("/api/attendance/scan", {
      method: "POST",
      body: JSON.stringify({ token: token.trim() }),
    });
  },
};

export interface WfhEligibilityResponse {
  success?: boolean;
  isEligible?: boolean;
  eligible?: boolean;
  reason?: string;
  department?: string;
  workType?: string;
  monthlyQuota?: number;
  policyQuota?: number;
  usedDays?: number;
  approvedCountThisMonth?: number;
  pendingCountThisMonth?: number;
  remainingQuota?: number;
}

export interface WfhRequestItem {
  _id: string;
  employeeId: string;
  employeeName?: string;
  department?: string;
  dateKey?: string;
  date?: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reviewedBy?: string;
  reviewedAt?: string;
  reviewerRemarks?: string;
  reviewerComment?: string;
  createdAt: string;
}

export interface WfhMyRequestsResponse {
  success: boolean;
  data: WfhRequestItem[];
}

export const wfhApi = {
  async getEligibility(): Promise<WfhEligibilityResponse> {
    return apiRequest<WfhEligibilityResponse>("/api/wfh/eligibility");
  },

  async getMyRequests(): Promise<WfhMyRequestsResponse> {
    return apiRequest<WfhMyRequestsResponse>("/api/wfh/my-requests");
  },

  async createRequest(
    dateKey: string,
    reason: string
  ): Promise<{ success: boolean; message: string; data?: WfhRequestItem; request?: WfhRequestItem }> {
    return apiRequest<{ success: boolean; message: string; data?: WfhRequestItem; request?: WfhRequestItem }>(
      "/api/wfh/requests",
      {
        method: "POST",
        body: JSON.stringify({
          dateKey: dateKey.trim(),
          date: dateKey.trim(),
          reason: reason.trim(),
        }),
      }
    );
  },

  async cancelRequest(requestId: string): Promise<{ success: boolean; message: string }> {
    return apiRequest<{ success: boolean; message: string }>(
      `/api/wfh/requests/${requestId}/cancel`,
      {
        method: "PATCH",
      }
    );
  },
};

export interface EmployeeDetails {
  _id: string;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  workType: string;
  joiningDate: string;
  status: string;
  isActive: boolean;
}

export interface ShiftInfo {
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  checkInWindowStartMinutes: number;
  checkInWindowEndMinutes: number;
  checkOutWindowStartMinutes: number;
  checkOutWindowEndMinutes: number;
  isOvernight?: boolean;
}

export interface PolicyData {
  _id: string;
  name: string;
  version: number;
  timezone: string;
  defaultGraceMinutes: number;
  minFullDayHours: number;
  minHalfDayHours: number;
  monthlyWfhQuota: number;
  workdays: number[];
  shifts: ShiftInfo[];
}

export const employeeApi = {
  async getMyProfile(): Promise<{ success: boolean; data: EmployeeDetails }> {
    return apiRequest<{ success: boolean; data: EmployeeDetails }>("/api/employees/me");
  },
};

export const policyApi = {
  async getPolicy(): Promise<{ success: boolean; data: PolicyData }> {
    return apiRequest<{ success: boolean; data: PolicyData }>("/api/policy");
  },
};


