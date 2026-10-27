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
  const [user, setUser] = useState<AuthUser | null>(() => tokenStorage.getCachedUser<AuthUser>());
  const [isLoading, setIsLoading] = useState<boolean>(() => !tokenStorage.getCachedUser<AuthUser>());

  const fetchProfile = useCallback(async (): Promise<AuthUser | null> => {
    try {
      const res = await api.get<{
        success?: boolean;
        data?: {
          user: {
            _id: string;
            employeeId: string;
            email: string;
            role: string;
            status: string;
            mobileNumber?: string;
          };
          employee?: {
            name?: string;
            department?: string;
            designation?: string;
            workType?: string;
            mobileNumber?: string;
          } | null;
        };
        user?: {
          _id: string;
          employeeId: string;
          email: string;
          role: string;
          status: string;
          mobileNumber?: string;
        };
        employee?: {
          name?: string;
          department?: string;
          designation?: string;
          workType?: string;
          mobileNumber?: string;
        } | null;
      }>("/api/auth/me");

      const resUser = res?.user || res?.data?.user;
      const resEmp = res?.employee || res?.data?.employee;

      if (!resUser) {
        throw new Error("No user in profile response");
      }

      const userData: AuthUser = {
        id: resUser._id,
        employeeId: resUser.employeeId,
        email: resUser.email,
        role: resUser.role,
        name: resEmp?.name || (resUser as any).name || resUser.employeeId,
        department: resEmp?.department || (resUser as any).department,
        designation: resEmp?.designation || (resUser as any).designation,
        workType: resEmp?.workType || (resUser as any).workType,
        mobileNumber: resEmp?.mobileNumber || resUser.mobileNumber,
      };

      setUser(userData);
      tokenStorage.setCachedUser(userData);
      return userData;
    } catch {
      const token = tokenStorage.getAccessToken();
      if (!token) {
        setUser(null);
        tokenStorage.setCachedUser(null);
      }
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
        if (res.user) {
          const userData: AuthUser = {
            id: res.user._id,
            employeeId: res.user.employeeId,
            email: res.user.email,
            role: res.user.role,
            name: res.employee?.name || res.user.employeeId,
            department: res.employee?.department,
            designation: res.employee?.designation,
          };
          setUser(userData);
          tokenStorage.setCachedUser(userData);
          tokenStorage.setCachedUser(userData);
        }
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

      const payload = (res as any)?.data || res;
      const { accessToken, refreshToken, session, user: staffUser, employee: staffEmp } = payload;
      if (accessToken) {
        tokenStorage.setTokens(accessToken, refreshToken, session?.id);
        if (staffUser) {
          const userData: AuthUser = {
            id: staffUser._id || staffUser.id,
            employeeId: staffUser.employeeId,
            email: staffUser.email,
            role: staffUser.role,
            name: staffEmp?.name || staffUser.employeeId,
            department: staffEmp?.department,
            designation: staffEmp?.designation,
            workType: staffEmp?.workType,
            mobileNumber: staffEmp?.mobileNumber || staffUser.mobileNumber,
          };
          setUser(userData);
          tokenStorage.setCachedUser(userData);
        }
        try {
          await fetchProfile();
        } catch {
          // Keep authenticated user state even if background fetch profile is delayed
        }
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
