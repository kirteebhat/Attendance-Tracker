import { ApiErrorCode } from "@vorldx/shared";

const TOKEN_KEY = "vorldx_access_token";
const REFRESH_TOKEN_KEY = "vorldx_refresh_token";
const SESSION_ID_KEY = "vorldx_session_id";
const USER_KEY = "vorldx_cached_user";

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  code?: string;
  errors?: Record<string, unknown>;
  [key: string]: unknown;
}

export class ApiError extends Error {
  public code?: string;
  public status: number;
  public errors?: Record<string, unknown>;

  constructor(status: number, message: string, code?: string, errors?: Record<string, unknown>) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.errors = errors;
  }
}

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (value?: unknown) => void;
  reject: (reason?: unknown) => void;
}> = [];

const processQueue = (error: unknown, token: string | null = null) => {
  failedQueue.forEach((promise) => {
    if (error) {
      promise.reject(error);
    } else {
      promise.resolve(token);
    }
  });
  failedQueue = [];
};

export const tokenStorage = {
  getAccessToken: (): string | null => {
    return localStorage.getItem(TOKEN_KEY);
  },
  setTokens: (accessToken: string, refreshToken?: string, sessionId?: string): void => {
    localStorage.setItem(TOKEN_KEY, accessToken);
    if (refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
    }
    if (sessionId) {
      localStorage.setItem(SESSION_ID_KEY, sessionId);
    }
  },
  getSessionId: (): string | null => {
    return localStorage.getItem(SESSION_ID_KEY);
  },
  setSessionId: (sessionId: string): void => {
    localStorage.setItem(SESSION_ID_KEY, sessionId);
  },
  getRefreshToken: (): string | null => {
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },
  getCachedUser: <U = unknown>(): U | null => {
    try {
      const raw = localStorage.getItem(USER_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },
  setCachedUser: <U = unknown>(user: U | null): void => {
    if (user) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  },
  clearTokens: (): void => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem(SESSION_ID_KEY);
    localStorage.removeItem(USER_KEY);
  },
};

const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");

const DEFAULT_PROD_API = "https://attendance-tracker-56du.onrender.com";

const API_BASE_URL = (
  import.meta.env.VITE_API_URL ||
  import.meta.env.NEXT_PUBLIC_API_URL ||
  (isLocalhost ? "" : DEFAULT_PROD_API)
).replace(/\/$/, "");

export function getFullApiUrl(endpoint: string): string {
  if (endpoint.startsWith("http://") || endpoint.startsWith("https://")) {
    return endpoint;
  }
  const cleanEndpoint = endpoint.startsWith("/") ? endpoint : `/${endpoint}`;
  return API_BASE_URL ? `${API_BASE_URL}${cleanEndpoint}` : cleanEndpoint;
}

/**
 * Standard HTTP Fetch wrapper with automatic Bearer token injection,
 * automatic token rotation on ERR_TOKEN_EXPIRED, and typed responses.
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = getFullApiUrl(endpoint);
  const token = tokenStorage.getAccessToken();
  const sessionId = tokenStorage.getSessionId();

  const headers = new Headers(options.headers || {});
  headers.set("Content-Type", "application/json");
  headers.set("Accept", "application/json");

  if (token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  if (sessionId && !headers.has("x-session-id")) {
    headers.set("x-session-id", sessionId);
  }

  let response: Response;

  try {
    response = await fetch(url, {
      ...options,
      headers,
      credentials: "include", // send httpOnly cookies
    });
  } catch {
    throw new ApiError(0, "Network connection error. Please check your internet connection.");
  }

  // Handle Token Expiration and Auto-Refresh
  if (response.status === 401) {
    const errorBody = await response
      .clone()
      .json()
      .catch(() => ({}));

    // If session has been revoked, immediately clear and redirect
    if (errorBody.code === ApiErrorCode.ERR_SESSION_REVOKED || errorBody.code === "ERR_SESSION_REVOKED") {
      tokenStorage.clearTokens();
      if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
        window.location.href = `/login?reason=session_revoked`;
      }
      throw new ApiError(401, errorBody.message || "Your session has been revoked. Please sign in again.", ApiErrorCode.ERR_SESSION_REVOKED);
    }

    const isTokenExpired =
      errorBody.code === ApiErrorCode.ERR_TOKEN_EXPIRED ||
      errorBody.code === "ERR_TOKEN_EXPIRED" ||
      (errorBody.message && errorBody.message.toLowerCase().includes("token expired"));

    // If token expired, attempt transparent refresh
    if (isTokenExpired) {
      if (isRefreshing) {
        // Queue concurrent requests while token is refreshing
        return new Promise<T>((resolve, reject) => {
          failedQueue.push({
            resolve: () => {
              apiRequest<T>(endpoint, options).then(resolve).catch(reject);
            },
            reject: (err) => reject(err),
          });
        });
      }

      isRefreshing = true;

      try {
        const storedRefreshToken = tokenStorage.getRefreshToken();
        const refreshRes = await fetch(getFullApiUrl("/api/auth/refresh"), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: storedRefreshToken }),
          credentials: "include",
        });

        if (!refreshRes.ok) {
          throw new Error("Refresh failed");
        }

        const refreshData = await refreshRes.json();
        const newAccessToken = refreshData.accessToken || refreshData.data?.accessToken;
        const newRefreshToken = refreshData.refreshToken || refreshData.data?.refreshToken;

        if (newAccessToken) {
          tokenStorage.setTokens(newAccessToken, newRefreshToken);
          processQueue(null, newAccessToken);
          isRefreshing = false;
          // Retry the original request
          return apiRequest<T>(endpoint, options);
        } else {
          throw new Error("No access token in refresh response");
        }
      } catch (refreshErr) {
        processQueue(refreshErr, null);
        isRefreshing = false;
        tokenStorage.clearTokens();
        // Redirect to login if session has truly expired
        if (typeof window !== "undefined" && !window.location.pathname.includes("/login")) {
          window.location.href = `/login?reason=session_expired`;
        }
        throw new ApiError(401, "Your session has expired. Please sign in again.", ApiErrorCode.ERR_UNAUTHORIZED);
      }
    }
  }

  // Parse JSON response body
  let data: unknown;
  const contentType = response.headers.get("content-type");
  if (contentType && contentType.includes("application/json")) {
    data = await response.json().catch(() => ({}));
  } else {
    data = await response.text();
  }

  if (!response.ok) {
    const errorObj = (typeof data === "object" && data !== null ? data : {}) as Record<
      string,
      unknown
    >;
    const errorMessage =
      typeof errorObj.message === "string"
        ? errorObj.message
        : `Request failed with status ${response.status}`;
    const errorCode = typeof errorObj.code === "string" ? errorObj.code : undefined;
    const errorDetails =
      typeof errorObj.errors === "object" && errorObj.errors !== null
        ? (errorObj.errors as Record<string, unknown>)
        : undefined;

    throw new ApiError(response.status, errorMessage, errorCode, errorDetails);
  }

  return data as T;
}

export const api = {
  get: <T = unknown>(endpoint: string, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...options, method: "GET" }),

  post: <T = unknown>(endpoint: string, body?: unknown, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "POST",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  patch: <T = unknown>(endpoint: string, body?: unknown, options?: RequestInit) =>
    apiRequest<T>(endpoint, {
      ...options,
      method: "PATCH",
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),

  delete: <T = unknown>(endpoint: string, options?: RequestInit) =>
    apiRequest<T>(endpoint, { ...options, method: "DELETE" }),
};

