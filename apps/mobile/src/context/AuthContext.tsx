import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import {
  tokenStorage,
  StoredUserProfile,
} from "../services/storage";
import {
  authApi,
  setSessionExpiredListener,
  RegisterStartResponse,
  RegisterVerifyResponse,
} from "../services/api";
import { disconnectMobileSocket } from "../services/socket";

interface AuthContextValue {
  user: StoredUserProfile | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionExpired: boolean;
  login: (emailOrEmployeeId: string, password: string) => Promise<void>;
  registerStart: (employeeId: string) => Promise<RegisterStartResponse>;
  registerVerify: (employeeId: string, otp: string) => Promise<RegisterVerifyResponse>;
  registerComplete: (employeeId: string, verificationToken: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  dismissSessionExpired: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<StoredUserProfile | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [sessionExpired, setSessionExpired] = useState<boolean>(false);

  // Initial check on mount
  const checkAuth = useCallback(async () => {
    try {
      const token = await tokenStorage.getAccessToken();
      const storedUser = await tokenStorage.getUserProfile();

      if (token && storedUser) {
        setUser(storedUser);
        // Optionally fetch authoritative profile in background
        try {
          const res = await authApi.getMe();
          if (res.data?.user) {
            setUser(res.data.user);
            await tokenStorage.setUserProfile(res.data.user);
          }
        } catch {
          // If offline or initial check failed, rely on stored user
        }
      } else {
        setUser(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    checkAuth();

    // Listen for session expiry events triggered by API client
    setSessionExpiredListener(() => {
      setUser(null);
      setSessionExpired(true);
    });
  }, [checkAuth]);

  const login = async (emailOrEmployeeId: string, password: string): Promise<void> => {
    const res = await authApi.login(emailOrEmployeeId, password);
    const { user: userProfile, accessToken, refreshToken } = res.data;

    await tokenStorage.setAccessToken(accessToken);
    await tokenStorage.setRefreshToken(refreshToken);
    await tokenStorage.setUserProfile(userProfile);

    setUser(userProfile);
    setSessionExpired(false);
  };

  const registerStart = async (employeeId: string): Promise<RegisterStartResponse> => {
    return authApi.registerStart(employeeId);
  };

  const registerVerify = async (employeeId: string, otp: string): Promise<RegisterVerifyResponse> => {
    return authApi.registerVerify(employeeId, otp);
  };

  const registerComplete = async (
    employeeId: string,
    verificationToken: string,
    password: string
  ): Promise<void> => {
    const res = await authApi.registerComplete(employeeId, verificationToken, password);
    const data = res?.data || (res as unknown as { user: StoredUserProfile; accessToken: string; refreshToken: string });
    const { user: userProfile, accessToken, refreshToken } = data;

    await tokenStorage.setAccessToken(accessToken);
    await tokenStorage.setRefreshToken(refreshToken);
    await tokenStorage.setUserProfile(userProfile);

    setUser(userProfile);
    setSessionExpired(false);
  };

  const logout = async (): Promise<void> => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      await tokenStorage.clearAll();
      disconnectMobileSocket();
    }
  };

  const refreshProfile = async (): Promise<void> => {
    try {
      const res = await authApi.getMe();
      if (res.data?.user) {
        setUser(res.data.user);
        await tokenStorage.setUserProfile(res.data.user);
      }
    } catch {
      // Ignore
    }
  };

  const dismissSessionExpired = () => {
    setSessionExpired(false);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        sessionExpired,
        login,
        registerStart,
        registerVerify,
        registerComplete,
        logout,
        dismissSessionExpired,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
