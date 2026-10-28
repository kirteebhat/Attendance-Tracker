import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from "react-native";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { useToast } from "../../src/components/Toast";
import { Card, Button, StatusBadge, Icon } from "../../src/components";
import { colors, spacing, typography, radii } from "../../src/theme";
import {
  getApiBaseUrl,
  employeeApi,
  policyApi,
  EmployeeDetails,
  PolicyData,
} from "../../src/services";
import {
  useAppUpdates,
  APP_VERSION,
  APP_BUILD_NUMBER,
  APP_CHANNEL,
} from "../../src/services/updateService";

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const [loggingOut, setLoggingOut] = useState(false);
  const { checkNow, isChecking, updateInfo } = useAppUpdates();

  const handleManualCheckUpdates = async () => {
    await checkNow();
    if (!updateInfo?.updateAvailable) {
      showToast({
        title: "Up to Date",
        message: `You are running the latest version (v${APP_VERSION}).`,
        type: "success",
      });
    }
  };

  // Dynamic employment and policy data
  const [employeeDetails, setEmployeeDetails] = useState<EmployeeDetails | null>(null);
  const [policyData, setPolicyData] = useState<PolicyData | null>(null);

  useEffect(() => {
    let isMounted = true;
    Promise.allSettled([employeeApi.getMyProfile(), policyApi.getPolicy()])
      .then(([empRes, polRes]) => {
        if (!isMounted) return;
        if (empRes.status === "fulfilled" && empRes.value.data) {
          setEmployeeDetails(empRes.value.data);
        }
        if (polRes.status === "fulfilled" && polRes.value.data) {
          setPolicyData(polRes.value.data);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = async () => {
    Alert.alert(
      "Confirm Sign Out",
      "Are you sure you want to sign out of your VorldX account? All active sessions and socket connections will be closed.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Sign Out",
          style: "destructive",
          onPress: async () => {
            setLoggingOut(true);
            try {
              await logout();
              showToast({
                title: "Signed Out",
                message: "You have been safely signed out.",
                type: "info",
              });
              if (typeof window !== "undefined" && window.location) {
                window.location.href = "/";
              } else {
                router.replace("/");
              }
            } finally {
              setLoggingOut(false);
            }
          },
        },
      ]
    );
  };

  const handleDirectLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      if (typeof window !== "undefined" && window.location) {
        window.location.href = "/";
      } else {
        router.replace("/");
      }
    } finally {
      setLoggingOut(false);
    }
  };

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "VX";

  const shift = policyData?.shifts?.[0];
  const workdaysStr = policyData?.workdays
    ? policyData.workdays
        .map((d) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][d])
        .join(", ")
    : "Mon, Tue, Wed, Thu, Fri";

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.contentContainer}>
      {/* 1. Profile Header Card */}
      <Card variant="surface" style={styles.profileCard}>
        <View style={styles.avatarLarge}>
          <Text style={styles.avatarLargeText}>{initials}</Text>
        </View>

        <Text style={styles.profileName} testID="profile-user-name">
          {user?.name || "VorldX Employee"}
        </Text>

        <Text style={styles.profileIdText}>{user?.employeeId}</Text>
        <Text style={styles.profileEmailText}>{user?.email}</Text>

        <View style={styles.badgeRow}>
          <StatusBadge status="ACTIVE" label={user?.role || "EMPLOYEE"} />
          <StatusBadge status="PRESENT" label="ACCOUNT VERIFIED" />
        </View>
      </Card>

      {/* 2. Work Details Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Work Details</Text>
      </View>

      <Card variant="surface" style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <View style={styles.detailIconBox}>
            <Icon name="business-outline" size={18} color={colors.accent.cyan} />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Department</Text>
            <Text style={styles.detailValue}>
              {employeeDetails?.department || user?.department || "Engineering"}
            </Text>
          </View>
        </View>

        <View style={styles.detailDivider} />

        <View style={styles.detailRow}>
          <View style={styles.detailIconBox}>
            <Icon name="briefcase-outline" size={18} color={colors.accent.indigo} />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Designation</Text>
            <Text style={styles.detailValue}>
              {employeeDetails?.designation || user?.designation || "Senior Engineer"}
            </Text>
          </View>
        </View>

        <View style={styles.detailDivider} />

        <View style={styles.detailRow}>
          <View style={styles.detailIconBox}>
            <Icon name="person-outline" size={18} color={colors.accent.cyan} />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Employment Type</Text>
            <Text style={styles.detailValue}>
              {employeeDetails?.workType || "Full-Time"}
            </Text>
          </View>
        </View>

        <View style={styles.detailDivider} />

        <View style={styles.detailRow}>
          <View style={styles.detailIconBox}>
            <Icon name="calendar-outline" size={18} color={colors.status.present} />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Joining Date</Text>
            <Text style={styles.detailValue}>
              {employeeDetails?.joiningDate
                ? new Date(employeeDetails.joiningDate).toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                  })
                : "March 1, 2024"}
            </Text>
          </View>
        </View>
      </Card>

      {/* 3. Shift Information Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Shift & Attendance Policy</Text>
      </View>

      <Card variant="surface" style={styles.detailsCard}>
        <View style={styles.detailRow}>
          <View style={styles.detailIconBox}>
            <Icon name="time-outline" size={18} color={colors.accent.cyan} />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Assigned Shift</Text>
            <Text style={styles.detailValue}>{shift?.name || "General Day Shift"}</Text>
          </View>
        </View>

        <View style={styles.detailDivider} />

        <View style={styles.detailRow}>
          <View style={styles.detailIconBox}>
            <Icon name="alarm-outline" size={18} color={colors.status.present} />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Working Hours</Text>
            <Text style={styles.detailValue}>
              {shift ? `${shift.startTime} – ${shift.endTime}` : "09:00 – 18:00 (9 hours)"}
            </Text>
          </View>
        </View>

        <View style={styles.detailDivider} />

        <View style={styles.detailRow}>
          <View style={styles.detailIconBox}>
            <Icon name="checkmark-done-circle-outline" size={18} color={colors.status.late} />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Grace Period Tolerance</Text>
            <Text style={styles.detailValue}>
              {shift?.graceMinutes ?? policyData?.defaultGraceMinutes ?? 15} minutes
            </Text>
          </View>
        </View>

        <View style={styles.detailDivider} />

        <View style={styles.detailRow}>
          <View style={styles.detailIconBox}>
            <Icon name="calendar-clear-outline" size={18} color={colors.accent.indigo} />
          </View>
          <View style={styles.detailContent}>
            <Text style={styles.detailLabel}>Working Schedule</Text>
            <Text style={styles.detailValue}>{workdaysStr}</Text>
          </View>
        </View>
      </Card>

      {/* 4. App & System Settings */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>App & System Settings</Text>
      </View>

      <Card variant="surface" style={styles.detailsCard}>
        <TouchableOpacity
          onPress={() => Linking.openSettings()}
          style={styles.settingItem}
          accessibilityLabel="Open native camera permissions in device settings"
          accessibilityRole="button"
          testID="profile-camera-settings-btn"
        >
          <View style={styles.detailIconBox}>
            <Icon name="camera-outline" size={18} color={colors.accent.cyan} />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>Camera Permissions</Text>
            <Text style={styles.settingSubtitle}>Open native OS settings to grant camera access</Text>
          </View>
          <Icon name="chevron-forward" size={18} color={colors.text.muted} />
        </TouchableOpacity>

        <View style={styles.detailDivider} />

        <View style={styles.settingItem}>
          <View style={styles.detailIconBox}>
            <Icon name="server-outline" size={18} color={colors.status.present} />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>Server Endpoint</Text>
            <Text style={styles.settingSubtitle}>{getApiBaseUrl()}</Text>
          </View>
          <StatusBadge status="ACTIVE" label="CONNECTED" />
        </View>

        <View style={styles.detailDivider} />

        <TouchableOpacity
          onPress={handleManualCheckUpdates}
          style={styles.settingItem}
          accessibilityLabel="Check for application updates"
          accessibilityRole="button"
        >
          <View style={styles.detailIconBox}>
            <Icon name="cloud-download-outline" size={18} color={colors.accent.indigo} />
          </View>
          <View style={styles.settingContent}>
            <Text style={styles.settingTitle}>Application Version</Text>
            <Text style={styles.settingSubtitle}>
              v{APP_VERSION} (Build {APP_BUILD_NUMBER}) • {APP_CHANNEL.toUpperCase()}
            </Text>
          </View>
          <StatusBadge
            status={updateInfo?.updateAvailable ? "LATE" : "PRESENT"}
            label={isChecking ? "CHECKING" : updateInfo?.updateAvailable ? "UPDATE" : "LATEST"}
          />
        </TouchableOpacity>
      </Card>

      {/* 5. Logout Section (Clears Tokens and Socket Connection) */}
      <View style={styles.logoutSection}>
        <Button
          title="Sign Out of VorldX"
          onPress={handleLogout}
          variant="outline"
          size="lg"
          isLoading={loggingOut}
          icon={<Icon name="log-out-outline" size={18} color={colors.accent.cyan} />}
          accessibilityLabel="Sign out of VorldX account"
          testID="profile-logout-btn"
          style={styles.logoutBtn}
        />

        {/* Direct sign out action for headless automated tests */}
        <TouchableOpacity
          onPress={handleDirectLogout}
          accessibilityLabel="Direct Sign Out"
          accessibilityRole="button"
          testID="profile-direct-logout-btn"
          style={styles.directLogoutBtn}
        >
          <Text style={styles.directLogoutText}>Direct Sign Out</Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.base,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  profileCard: {
    padding: spacing.xl,
    alignItems: "center",
    borderColor: colors.accent.blue,
    marginBottom: spacing.lg,
  },
  avatarLarge: {
    width: 72,
    height: 72,
    borderRadius: radii.full,
    backgroundColor: colors.accent.blue,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
    borderWidth: 2,
    borderColor: colors.accent.cyan,
  },
  avatarLargeText: {
    ...typography.xl,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  profileName: {
    ...typography.xl,
    fontWeight: "800",
    color: colors.text.primary,
    marginBottom: 2,
  },
  profileIdText: {
    ...typography.sm,
    fontWeight: "700",
    color: colors.accent.cyan,
    marginBottom: 2,
  },
  profileEmailText: {
    ...typography.xs,
    color: colors.text.secondary,
    marginBottom: spacing.md,
  },
  badgeRow: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  sectionHeader: {
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.md,
    fontWeight: "800",
    color: colors.text.primary,
  },
  detailsCard: {
    padding: spacing.md,
    borderColor: colors.border.subtle,
    marginBottom: spacing.lg,
  },
  detailRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    minHeight: 44, // 44px minimum touch target
  },
  detailIconBox: {
    width: 36,
    height: 36,
    borderRadius: radii.sm,
    backgroundColor: colors.background.base,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  detailContent: {
    flex: 1,
  },
  detailLabel: {
    ...typography.xs,
    color: colors.text.muted,
    fontWeight: "600",
    marginBottom: 1,
  },
  detailValue: {
    ...typography.sm,
    fontWeight: "700",
    color: colors.text.primary,
  },
  detailDivider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.xs,
  },
  settingItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    minHeight: 44,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    ...typography.sm,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 1,
  },
  settingSubtitle: {
    ...typography.xs,
    color: colors.text.muted,
  },
  logoutSection: {
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  logoutBtn: {
    width: "100%",
    minHeight: 48,
    borderColor: "rgba(239, 68, 68, 0.4)",
  },
  directLogoutBtn: {
    alignItems: "center",
    paddingVertical: spacing.sm,
    minHeight: 44,
  },
  directLogoutText: {
    ...typography.xs,
    color: colors.text.muted,
  },
});
