import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api, tokenStorage, ApiError } from "../api/client";
import { UserRole } from "@vorldx/shared";

export interface AuthUser {
  id: string;
  employeeId: string;
  email: string;
  role: UserRole | string;
  name?: string;
  department?: string;
  designation?: string;
  workType?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (credentials: { identifier: string; password: string }) => Promise<void>;
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
        };
        employee: {
          name?: string;
          department?: string;
          designation?: string;
          workType?: string;
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

  const logout = async (): Promise<void> => {
    try {
      await api.post("/api/auth/logout", {
        refreshToken: tokenStorage.getRefreshToken(),
      });
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
