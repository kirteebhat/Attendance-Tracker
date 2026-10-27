import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, tokenStorage, ApiError } from "../api/client";
import { UserRole } from "@vorldx/shared";
import {
  getDeviceFingerprint,
  getDeviceName,
  getDevicePlatform,
} from "../utils/deviceFingerprint";

export interface AuthUser {
  id: string;
  employeeId: string;
  email: string;
  role: UserRole | string;
  name?: string;
  department?: string;
  designation?: string;
  workType?: string;
  mobileNumber?: string;
}

export interface StaffOtpStartResponse {
  success: boolean;
  message: string;
  expiresInSeconds: number;
  cooldownSeconds: number;
  simulatedDemoOtp?: string;
  demoNotice?: string;
}

export interface StaffOtpVerifyParams {
  mobileNumber: string;
  otp: string;
  purpose?: "LOGIN" | "DEVICE_REGISTRATION" | "PASSWORD_RESET";
  rememberDevice?: boolean;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { identifier: string; password: string }) => Promise<void>;
  requestStaffOtp: (params: { mobileNumber: string; password?: string }) => Promise<StaffOtpStartResponse>;
  verifyStaffOtp: (params: StaffOtpVerifyParams) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const fetchProfile = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const res = await api.get<{
        user: {
          _id: string;
          employeeId: string;
          email: string;
          role: string;
          status: string;
          mobileNumber?: string;
        };
        employee: {
          name?: string;
          department?: string;
          designation?: string;
          workType?: string;
          mobileNumber?: string;
        } | null;
      }>("/api/auth/me");

      const userData: AuthUser = {
        id: res.user._id,
        employeeId: res.user.employeeId,
        email: res.user.email,
        role: res.user.role,
        name: res.employee?.name || res.user.employeeId,
        department: res.employee?.department,
        designation: res.employee?.designation,
        workType: res.employee?.workType,
        mobileNumber: res.employee?.mobileNumber || res.user.mobileNumber,
      };

      setUser(userData);
      return userData;
    } catch {
      setUser(null);
      tokenStorage.clearTokens();
      return null;
    }
  }, []);

  useEffect(() => {
    const token = tokenStorage.getAccessToken();
    if (token) {
      fetchProfile().finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [fetchProfile]);

  const login = async (credentials: { identifier: string; password: string }): Promise<void> => {
    setIsLoading(true);
    try {
      // API supports login via either email or employeeId in identifier/email field
      const isEmail = credentials.identifier.includes("@");
      const payload = isEmail
        ? { email: credentials.identifier.trim(), password: credentials.password }
        : {
            employeeId: credentials.identifier.trim().toUpperCase(),
            password: credentials.password,
          };

      const res = await api.post<{
        accessToken: string;
        refreshToken?: string;
        user: { _id: string; employeeId: string; email: string; role: string };
        employee?: { name?: string; department?: string; designation?: string };
      }>("/api/auth/login", payload);

      if (res.accessToken) {
        tokenStorage.setTokens(res.accessToken, res.refreshToken);
        await fetchProfile();
      }
    } catch (err) {
      tokenStorage.clearTokens();
      setUser(null);
      if (err instanceof ApiError) {
        throw err;
      }
      throw new ApiError(400, "Unable to sign in. Please verify your credentials.");
    } finally {
      setIsLoading(false);
    }
  };

  const requestStaffOtp = async (params: {
    mobileNumber: string;
    password?: string;
  }): Promise<StaffOtpStartResponse> => {
    const fp = getDeviceFingerprint();
    const res = await api.post<StaffOtpStartResponse>("/api/auth/staff/otp-start", {
      mobileNumber: params.mobileNumber,
      password: params.password,
      deviceFingerprint: fp,
      deviceName: getDeviceName(),
      platform: getDevicePlatform(),
      purpose: "LOGIN",
    });
    return res;
  };

  const verifyStaffOtp = async (params: StaffOtpVerifyParams): Promise<void> => {
    setIsLoading(true);
    try {
      const fp = getDeviceFingerprint();
      const res = await api.post<{
        success: boolean;
        message: string;
        data: {
          accessToken: string;
          refreshToken?: string;
          session: {
            id: string;
            expiresAt: string;
          };
          user: {
            _id: string;
            employeeId: string;
            email: string;
            role: string;
          };
          employee?: {
            name?: string;
            department?: string;
            designation?: string;
            workType?: string;
          } | null;
        };
      }>("/api/auth/staff/otp-verify", {
        mobileNumber: params.mobileNumber,
        otp: params.otp,
        purpose: params.purpose || "LOGIN",
        deviceFingerprint: fp,
        deviceName: getDeviceName(),
        platform: getDevicePlatform(),
        rememberDevice: params.rememberDevice ?? true,
      });

      const { accessToken, refreshToken, session } = res.data;
      if (accessToken) {
        tokenStorage.setTokens(accessToken, refreshToken, session?.id);
        await fetchProfile();
      }
    } catch (err) {
      tokenStorage.clearTokens();
      setUser(null);
      if (err instanceof ApiError) {
        throw err;
      }
      throw new ApiError(400, "Unable to verify authentication code.");
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    try {
      const sessionId = tokenStorage.getSessionId();
      if (sessionId) {
        await api.delete(`/api/auth/staff/sessions/${sessionId}`).catch(() => {});
      }
      await api.post("/api/auth/logout", {
        refreshToken: tokenStorage.getRefreshToken(),
      }).catch(() => {});
    } catch {
      // Ignore network errors on logout
    } finally {
      tokenStorage.clearTokens();
      setUser(null);
      window.location.href = "/login";
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        requestStaffOtp,
        verifyStaffOtp,
        logout,
        refreshProfile: async () => {
          await fetchProfile();
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
