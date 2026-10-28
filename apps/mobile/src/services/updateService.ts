import { useState, useEffect, useCallback, useRef } from "react";
import { AppState, AppStateStatus, Platform } from "react-native";
import * as Linking from "expo-linking";
import { getApiBaseUrl } from "./api";
import { subscribeToSocketEvent } from "./socket";
import { isBelowMinSupportedVersion } from "@vorldx/shared";

export const APP_VERSION = "1.0.0";
export const APP_BUILD_NUMBER = 1;
export const APP_CHANNEL = "production";

export interface MobileUpdateInfo {
  updateAvailable: boolean;
  forceUpdate: boolean;
  currentVersion: string;
  latestVersion?: string;
  minSupportedVersion?: string;
  notes?: string;
  downloadUrl?: string;
  bundleUrl?: string;
  channel?: string;
  publishedAt?: string;
  otaUpdatesEnabled: boolean;
  message?: string;
}

/**
 * Checks backend and Expo update service for available releases
 */
export async function checkForAppUpdateAsync(): Promise<MobileUpdateInfo> {
  const baseUrl = getApiBaseUrl();
  const platform = Platform.OS === "ios" ? "IOS" : "ANDROID";

  try {
    const res = await fetch(
      `${baseUrl}/api/updates/check?platform=${platform}&version=${APP_VERSION}&channel=${APP_CHANNEL}`,
      {
        headers: { Accept: "application/json" },
      }
    );

    if (!res.ok) {
      return {
        updateAvailable: false,
        forceUpdate: false,
        currentVersion: APP_VERSION,
        otaUpdatesEnabled: false,
      };
    }

    const data = (await res.json()) as { success: boolean; data?: MobileUpdateInfo } & MobileUpdateInfo;
    const info = data.data || data;

    // Check if client is below minimum supported version
    if (info.minSupportedVersion && isBelowMinSupportedVersion(APP_VERSION, info.minSupportedVersion)) {
      info.forceUpdate = true;
      info.updateAvailable = true;
    }

    return info;
  } catch (err: unknown) {
    return {
      updateAvailable: false,
      forceUpdate: false,
      currentVersion: APP_VERSION,
      otaUpdatesEnabled: true,
      message: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Downloads and applies the update.
 * If expo-updates is available, reloads the bundle via Updates.reloadAsync().
 * If a native download URL is provided, launches the external store/download URL.
 */
export async function applyUpdateAsync(downloadUrl?: string): Promise<void> {
  if (downloadUrl && downloadUrl.startsWith("http")) {
    const canOpen = await Linking.canOpenURL(downloadUrl);
    if (canOpen) {
      await Linking.openURL(downloadUrl);
      return;
    }
  }

  // Attempt dynamic expo-updates reload
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updatesModule: any = await (Function('return import("expo-updates")')() as Promise<any>).catch(() => null);
    if (updatesModule?.reloadAsync) {
      await updatesModule.fetchUpdateAsync?.().catch(() => {});
      await updatesModule.reloadAsync();
      return;
    }
  } catch {
    // expo-updates not linked or running in development client
  }

  // Fallback for web or dev preview
  if (typeof window !== "undefined" && window.location) {
    window.location.reload();
  }
}

/**
 * Hook to manage app start & resume update checking
 */
export function useAppUpdates() {
  const [updateInfo, setUpdateInfo] = useState<MobileUpdateInfo | null>(null);
  const [isChecking, setIsChecking] = useState<boolean>(false);
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const lastCheckTime = useRef<number>(0);

  const check = useCallback(async (isManual = false) => {
    // Debounce background checks (minimum 30 seconds apart unless manual)
    const now = Date.now();
    if (!isManual && now - lastCheckTime.current < 30000) return;
    lastCheckTime.current = now;

    setIsChecking(true);
    try {
      const info = await checkForAppUpdateAsync();
      setUpdateInfo(info);
      if (info.updateAvailable) {
        setIsDismissed(false);
      }
    } finally {
      setIsChecking(false);
    }
  }, []);

  // 1. Initial check on mount
  useEffect(() => {
    check();
  }, [check]);

  // 2. Check on app resume (AppState active)
  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      if (nextState === "active") {
        check();
      }
    };

    const sub = AppState.addEventListener("change", handleAppStateChange);
    return () => {
      sub.remove();
    };
  }, [check]);

  // 3. Realtime socket listener for new release
  useEffect(() => {
    const unsubscribe = subscribeToSocketEvent("app_release.published", (data: unknown) => {
      const payload = data as { platform?: string } | undefined;
      const myPlatform = Platform.OS === "ios" ? "IOS" : "ANDROID";
      if (!payload?.platform || payload.platform === "MOBILE" || payload.platform === myPlatform) {
        check(true);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [check]);

  const apply = useCallback(async () => {
    setIsApplying(true);
    try {
      await applyUpdateAsync(updateInfo?.downloadUrl);
    } finally {
      setIsApplying(false);
    }
  }, [updateInfo]);

  const dismiss = useCallback(() => {
    if (!updateInfo?.forceUpdate) {
      setIsDismissed(true);
    }
  }, [updateInfo]);

  return {
    updateInfo,
    isChecking,
    isApplying,
    isDismissed,
    checkNow: () => check(true),
    applyUpdate: apply,
    dismissUpdate: dismiss,
    hasUpdate: !!updateInfo?.updateAvailable && !isDismissed,
    isForced: !!updateInfo?.forceUpdate,
  };
}
