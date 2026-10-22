import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

const ACCESS_TOKEN_KEY = "vorldx_access_token";
const REFRESH_TOKEN_KEY = "vorldx_refresh_token";
const USER_PROFILE_KEY = "vorldx_user_profile";

// In-memory fallback for environments without SecureStore or localStorage
const memoryStore = new Map<string, string>();

async function setItem(key: string, value: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.setItem(key, value);
        return;
      }
    } catch {
      // Fallback to memory
    }
    memoryStore.set(key, value);
    return;
  }

  try {
    await SecureStore.setItemAsync(key, value);
  } catch (err) {
    console.warn(`SecureStore setItem failed for key ${key}:`, err);
    memoryStore.set(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (Platform.OS === "web") {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        return window.localStorage.getItem(key);
      }
    } catch {
      // Fallback to memory
    }
    return memoryStore.get(key) || null;
  }

  try {
    return await SecureStore.getItemAsync(key);
  } catch (err) {
    console.warn(`SecureStore getItem failed for key ${key}:`, err);
    return memoryStore.get(key) || null;
  }
}

async function deleteItem(key: string): Promise<void> {
  if (Platform.OS === "web") {
    try {
      if (typeof window !== "undefined" && window.localStorage) {
        window.localStorage.removeItem(key);
        return;
      }
    } catch {
      // Fallback
    }
    memoryStore.delete(key);
    return;
  }

  try {
    await SecureStore.deleteItemAsync(key);
  } catch (err) {
    console.warn(`SecureStore deleteItem failed for key ${key}:`, err);
    memoryStore.delete(key);
  }
}

export interface StoredUserProfile {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  role: string;
  department?: string;
  designation?: string;
  status: string;
}

export const tokenStorage = {
  async getAccessToken(): Promise<string | null> {
    return getItem(ACCESS_TOKEN_KEY);
  },

  async setAccessToken(token: string): Promise<void> {
    return setItem(ACCESS_TOKEN_KEY, token);
  },

  async getRefreshToken(): Promise<string | null> {
    return getItem(REFRESH_TOKEN_KEY);
  },

  async setRefreshToken(token: string): Promise<void> {
    return setItem(REFRESH_TOKEN_KEY, token);
  },

  async getUserProfile(): Promise<StoredUserProfile | null> {
    const raw = await getItem(USER_PROFILE_KEY);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as StoredUserProfile;
    } catch {
      return null;
    }
  },

  async setUserProfile(user: StoredUserProfile): Promise<void> {
    return setItem(USER_PROFILE_KEY, JSON.stringify(user));
  },

  async clearAll(): Promise<void> {
    await deleteItem(ACCESS_TOKEN_KEY);
    await deleteItem(REFRESH_TOKEN_KEY);
    await deleteItem(USER_PROFILE_KEY);
  },
};

