import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../../src/context/AuthContext";
import { useToast } from "../../src/components/Toast";
import {
  Button,
  Card,
  StatusBadge,
  Skeleton,
  Icon,
  AnnouncementBanner,
} from "../../src/components";
import { colors, spacing, typography, radii } from "../../src/theme";
import {
  attendanceApi,
  wfhApi,
  announcementsApi,
  MobileAnnouncementItem,
  TodayAttendanceResponse,
  AttendanceHistoryResponse,
  WfhEligibilityResponse,
  subscribeToSocketEvent,
  subscribeToResync,
} from "../../src/services";

export default function HomeScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayData, setTodayData] = useState<TodayAttendanceResponse | null>(null);
  const [historyData, setHistoryData] = useState<AttendanceHistoryResponse | null>(null);
  const [wfhEligibility, setWfhEligibility] = useState<WfhEligibilityResponse | null>(null);
  const [topAnnouncement, setTopAnnouncement] = useState<MobileAnnouncementItem | null>(null);
  const [unreadAnnouncementsCount, setUnreadAnnouncementsCount] = useState<number>(0);
  const [loggingOut, setLoggingOut] = useState(false);

  const fetchHomeData = useCallback(async () => {
    try {
      const [todayRes, historyRes, wfhRes, announceRes, countRes] = await Promise.allSettled([
        attendanceApi.getTodayAttendance(),
        attendanceApi.getMyAttendance({ limit: 5 }),
        wfhApi.getEligibility(),
        announcementsApi.getAnnouncements(1),
        announcementsApi.getUnreadCount(),
      ]);

      if (todayRes.status === "fulfilled") {
        setTodayData(todayRes.value);
      }
      if (historyRes.status === "fulfilled") {
        setHistoryData(historyRes.value);
      }
      if (wfhRes.status === "fulfilled") {
        setWfhEligibility(wfhRes.value);
      }
      if (announceRes.status === "fulfilled" && announceRes.value.success) {
        setTopAnnouncement(announceRes.value.data?.[0] || null);
      }
      if (countRes.status === "fulfilled" && countRes.value.success) {
        setUnreadAnnouncementsCount(countRes.value.unreadCount || 0);
      }
    } catch (err) {
      console.error("Failed to load home dashboard data", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHomeData();

    // Listen to real-time events via Socket.IO
    const unsubscribeAttendance = subscribeToSocketEvent("attendance.updated", () => {
      fetchHomeData();
    });

    const unsubscribeWfhDecided = subscribeToSocketEvent("wfh.decided", () => {
      fetchHomeData();
    });

    const unsubscribeWfhCreated = subscribeToSocketEvent("wfh.created", () => {
      fetchHomeData();
    });

    const unsubscribeAnnouncePub = subscribeToSocketEvent("announcement.published", () => {
      fetchHomeData();
    });

    const unsubscribeAnnouncePin = subscribeToSocketEvent("announcement.pinned", () => {
      fetchHomeData();
    });

    const unsubscribeResync = subscribeToResync(() => {
      fetchHomeData();
    });

    return () => {
      unsubscribeAttendance();
      unsubscribeWfhDecided();
      unsubscribeWfhCreated();
      unsubscribeAnnouncePub();
      unsubscribeAnnouncePin();
      unsubscribeResync();
    };
  }, [fetchHomeData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHomeData();
  }, [fetchHomeData]);

  const handleLogout = async () => {
    Alert.alert("Confirm Sign Out", "Are you sure you want to sign out of your account?", [
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
            router.replace("/");
          } finally {
            setLoggingOut(false);
          }
        },
      },
    ]);
  };

  const handleDirectLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
      router.replace("/");
    } finally {
      setLoggingOut(false);
    }
  };

  const record = todayData?.record;
  const isCheckedIn = Boolean(record?.checkInTime && !record?.checkOutTime);
  const isCheckedOut = Boolean(record?.checkOutTime);
  const isWfhToday = Boolean(record?.isWfh || record?.status === "WFH_APPROVED");

  const formatTime = (isoString?: string | null) => {
    if (!isoString) return "--:--";
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: true });
    } catch {
      return "--:--";
    }
  };

  const formatDuration = (mins?: number) => {
    if (!mins || mins <= 0) return "0 hrs";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} mins`;
    if (m === 0) return `${h} hrs`;
    return `${h}h ${m}m`;
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent.cyan}
          colors={[colors.accent.cyan]}
        />
      }
    >
      {/* 0. Top Live Announcement Banner */}
      {topAnnouncement && (
        <AnnouncementBanner
          announcement={topAnnouncement}
          unreadCount={unreadAnnouncementsCount}
          onDismiss={() => setTopAnnouncement(null)}
        />
      )}

      {/* 1. Header Profile & Status Strip */}
      <Card variant="surface" style={styles.profileCard}>
        <View style={styles.profileHeader}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.name
                ? user.name
                    .split(" ")
                    .map((n) => n[0])
                    .join("")
                    .slice(0, 2)
                    .toUpperCase()
                : "VX"}
            </Text>
          </View>

          <View style={styles.profileInfo}>
            <View style={styles.badgeRow}>
              <StatusBadge status="ACTIVE" label={user?.role || "EMPLOYEE"} />
              <StatusBadge status="PRESENT" label="ACCOUNT VERIFIED" />
            </View>

            <Text style={styles.userName} testID="home-user-name">
              {user?.name || "VorldX Employee"}
            </Text>

            <Text style={styles.userSubtext}>
              {user?.employeeId} • {user?.department || "Operations"}
            </Text>
          </View>

          {/* Announcement Feed Shortcut Bell */}
          <TouchableOpacity
            style={styles.bellButton}
            onPress={() => router.push("/announcements" as any)}
            accessibilityLabel="View Announcements"
          >
            <Icon name="megaphone-outline" size={20} color={colors.accent.cyan} />
            {unreadAnnouncementsCount > 0 && (
              <View style={styles.bellBadge}>
                <Text style={styles.bellBadgeText}>
                  {unreadAnnouncementsCount > 9 ? "9+" : unreadAnnouncementsCount}
                </Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </Card>

      {/* 2. Today's Attendance State Card */}
      <Card variant="elevated" style={styles.todayCard} testID="home-today-card">
        <View style={styles.cardHeaderRow}>
          <View>
            <Text style={styles.cardSectionTag}>TODAY&apos;S PUNCH STATE</Text>
            <Text style={styles.todayDateText}>
              {todayData?.dateKey
                ? new Date(todayData.dateKey + "T00:00:00").toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })
                : "Today"}
            </Text>
          </View>
          <StatusBadge
            status={
              isWfhToday
                ? "WFH"
                : isCheckedOut
                  ? "PRESENT"
                  : isCheckedIn
                    ? "CHECKED_IN"
                    : "NOT_PUNCHED"
            }
            label={
              isWfhToday
                ? "WFH ACTIVE"
                : isCheckedOut
                  ? "COMPLETED"
                  : isCheckedIn
                    ? "PUNCHED IN"
                    : "NOT PUNCHED"
            }
          />
        </View>

        {loading ? (
          <View style={{ paddingVertical: spacing.md }}>
            <Skeleton width="100%" height={60} borderRadius={radii.md} />
          </View>
        ) : (
          <View style={styles.punchTimesGrid}>
            <View style={styles.timeBox}>
              <Text style={styles.timeBoxLabel}>Check-In</Text>
              <Text style={styles.timeBoxValue}>{formatTime(record?.checkInTime)}</Text>
              {record?.isLate && (
                <Text style={styles.lateWarningText}>Late (+{record.lateMinutes}m)</Text>
              )}
            </View>

            <View style={styles.timeDivider} />

            <View style={styles.timeBox}>
              <Text style={styles.timeBoxLabel}>Check-Out</Text>
              <Text style={styles.timeBoxValue}>{formatTime(record?.checkOutTime)}</Text>
              <Text style={styles.durationSubtext}>
                Total: {formatDuration(record?.durationMinutes)}
              </Text>
            </View>
          </View>
        )}

        {/* Scan Call to Action Button */}
        {!isWfhToday && !isCheckedOut && (
          <Button
            title={isCheckedIn ? "Scan QR to Check Out" : "Scan QR to Check In"}
            variant="primary"
            size="lg"
            icon={<Icon name="qr-code-outline" size={20} color="#FFFFFF" />}
            onPress={() => router.push("/(tabs)/scan")}
            testID="home-scan-cta-btn"
            style={styles.scanCtaBtn}
          />
        )}
      </Card>

      {/* 3. WFH Status Card */}
      <Card variant="surface" style={styles.wfhSummaryCard}>
        <View style={styles.wfhRow}>
          <View style={[styles.iconPill, { backgroundColor: colors.accent.indigoMuted }]}>
            <Icon name="briefcase" size={20} color={colors.accent.indigo} />
          </View>
          <View style={styles.wfhInfo}>
            <Text style={styles.wfhTitle}>Work From Home Quota</Text>
            <Text style={styles.wfhSubtitle}>
              {wfhEligibility?.remainingQuota !== undefined
                ? `${wfhEligibility.remainingQuota} of ${wfhEligibility.monthlyQuota || wfhEligibility.policyQuota || 4} remote days remaining this month`
                : "Monthly remote allowance active"}
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => router.push("/(tabs)/wfh")}
            style={styles.wfhActionBtn}
            testID="home-goto-wfh-btn"
          >
            <Text style={styles.wfhActionText}>Apply</Text>
            <Icon name="chevron-forward" size={14} color={colors.accent.cyan} />
          </TouchableOpacity>
        </View>
      </Card>

      {/* 4. Personal Monthly Statistics Grid */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Monthly Attendance Overview</Text>
        <Text style={styles.sectionSubtitle}>Current Month Performance</Text>
      </View>

      <View style={styles.statsGrid}>
        <Card variant="surface" style={styles.statCard}>
          <Text style={styles.statNumber}>{historyData?.stats?.presentDays ?? 0}</Text>
          <Text style={styles.statLabel}>Days Present</Text>
        </Card>

        <Card variant="surface" style={styles.statCard}>
          <Text style={[styles.statNumber, { color: colors.status.late }]}>
            {historyData?.stats?.lateDays ?? 0}
          </Text>
          <Text style={styles.statLabel}>Late Arrivals</Text>
        </Card>

        <Card variant="surface" style={styles.statCard}>
          <Text style={[styles.statNumber, { color: colors.status.wfh }]}>
            {historyData?.stats?.wfhDays ?? 0}
          </Text>
          <Text style={styles.statLabel}>WFH Days</Text>
        </Card>

        <Card variant="surface" style={styles.statCard}>
          <Text style={[styles.statNumber, { color: colors.accent.cyan }]}>
            {historyData?.stats?.attendancePercentage ?? 0}%
          </Text>
          <Text style={styles.statLabel}>Punctuality</Text>
        </Card>
      </View>

      {/* 5. Recent History Feed */}
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionTitle}>Recent Punch Activity</Text>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/history")}
          style={styles.seeAllBtn}
          testID="home-view-all-history-btn"
        >
          <Text style={styles.seeAllText}>View All</Text>
          <Icon name="arrow-forward" size={14} color={colors.accent.cyan} />
        </TouchableOpacity>
      </View>

      {historyData?.data && historyData.data.length > 0 ? (
        historyData.data.slice(0, 4).map((item) => (
          <Card key={item._id} variant="surface" style={styles.recentItemCard}>
            <View style={styles.recentItemRow}>
              <View>
                <Text style={styles.recentDateText}>
                  {new Date(item.dateKey + "T00:00:00").toLocaleDateString(undefined, {
                    weekday: "short",
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
                <Text style={styles.recentTimesText}>
                  {formatTime(item.checkInTime)} - {formatTime(item.checkOutTime)}
                </Text>
              </View>

              <View style={styles.recentItemRight}>
                <StatusBadge
                  status={item.isWfh ? "WFH" : (item.status as any)}
                  label={item.isWfh ? "WFH" : item.status}
                />
                <Text style={styles.recentDurationText}>
                  {formatDuration(item.durationMinutes)}
                </Text>
              </View>
            </View>
          </Card>
        ))
      ) : (
        <Card variant="surface" style={styles.emptyCard}>
          <Icon name="calendar-outline" size={28} color={colors.text.muted} />
          <Text style={styles.emptyText}>No recent punch logs found</Text>
        </Card>
      )}

      {/* Sign Out for Automated Test Harness & Security */}
      <View style={styles.logoutWrapper}>
        <Button
          title="Sign Out"
          onPress={handleLogout}
          variant="outline"
          size="md"
          isLoading={loggingOut}
          icon={<Icon name="log-out-outline" size={16} color={colors.accent.cyan} />}
          testID="home-logout-btn"
          style={styles.logoutBtn}
        />
        {/* Direct programmatic logout for automated Puppeteer test runner */}
        <TouchableOpacity
          onPress={handleDirectLogout}
          testID="home-direct-logout-btn"
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
    marginBottom: spacing.md,
    padding: spacing.lg,
    borderColor: colors.accent.blue,
  },
  profileHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: radii.full,
    backgroundColor: colors.accent.blue,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  avatarText: {
    ...typography.md,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  profileInfo: {
    flex: 1,
  },
  bellButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "rgba(6, 182, 212, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: spacing.sm,
    position: "relative",
  },
  bellBadge: {
    position: "absolute",
    top: -2,
    right: -2,
    backgroundColor: colors.accent.cyan,
    borderRadius: 9,
    minWidth: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: colors.background.surface,
  },
  bellBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: colors.background.base,
  },
  badgeRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: 4,
  },
  userName: {
    ...typography.lg,
    fontWeight: "800",
    color: colors.text.primary,
  },
  userSubtext: {
    ...typography.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  todayCard: {
    marginBottom: spacing.md,
    padding: spacing.lg,
    backgroundColor: colors.background.elevated,
    borderColor: colors.border.accent,
  },
  cardHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  cardSectionTag: {
    ...typography.xs,
    fontWeight: "800",
    color: colors.accent.cyan,
    letterSpacing: 1,
  },
  todayDateText: {
    ...typography.md,
    fontWeight: "700",
    color: colors.text.primary,
    marginTop: 2,
  },
  punchTimesGrid: {
    flexDirection: "row",
    backgroundColor: colors.background.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: "center",
    marginBottom: spacing.md,
  },
  timeBox: {
    flex: 1,
    alignItems: "center",
  },
  timeBoxLabel: {
    ...typography.xs,
    color: colors.text.secondary,
    marginBottom: 4,
  },
  timeBoxValue: {
    ...typography.xl,
    fontWeight: "900",
    color: colors.text.primary,
  },
  lateWarningText: {
    ...typography.xs,
    color: colors.status.late,
    fontWeight: "700",
    marginTop: 2,
  },
  durationSubtext: {
    ...typography.xs,
    color: colors.text.muted,
    marginTop: 2,
  },
  timeDivider: {
    width: 1,
    height: 40,
    backgroundColor: colors.border.subtle,
  },
  scanCtaBtn: {
    marginTop: spacing.xs,
  },
  wfhSummaryCard: {
    marginBottom: spacing.lg,
    padding: spacing.md,
  },
  wfhRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  iconPill: {
    width: 40,
    height: 40,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  wfhInfo: {
    flex: 1,
  },
  wfhTitle: {
    ...typography.sm,
    fontWeight: "700",
    color: colors.text.primary,
  },
  wfhSubtitle: {
    ...typography.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  wfhActionBtn: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(6, 182, 212, 0.12)",
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.sm,
    gap: 2,
  },
  wfhActionText: {
    ...typography.xs,
    fontWeight: "700",
    color: colors.accent.cyan,
  },
  sectionHeader: {
    marginBottom: spacing.sm,
  },
  sectionTitle: {
    ...typography.md,
    fontWeight: "800",
    color: colors.text.primary,
  },
  sectionSubtitle: {
    ...typography.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
    marginBottom: spacing.xl,
  },
  statCard: {
    flex: 1,
    minWidth: "45%",
    padding: spacing.md,
    alignItems: "center",
  },
  statNumber: {
    ...typography.xxl,
    fontWeight: "900",
    color: colors.text.primary,
  },
  statLabel: {
    ...typography.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  seeAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  seeAllText: {
    ...typography.xs,
    fontWeight: "700",
    color: colors.accent.cyan,
  },
  recentItemCard: {
    marginBottom: spacing.sm,
    padding: spacing.md,
  },
  recentItemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  recentDateText: {
    ...typography.sm,
    fontWeight: "700",
    color: colors.text.primary,
  },
  recentTimesText: {
    ...typography.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  recentItemRight: {
    alignItems: "flex-end",
    gap: 4,
  },
  recentDurationText: {
    ...typography.xs,
    color: colors.text.muted,
  },
  emptyCard: {
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  emptyText: {
    ...typography.sm,
    color: colors.text.muted,
  },
  logoutWrapper: {
    marginTop: spacing.xl,
    alignItems: "center",
  },
  logoutBtn: {
    width: "100%",
  },
  directLogoutBtn: {
    marginTop: spacing.sm,
    padding: spacing.xs,
  },
  directLogoutText: {
    ...typography.xs,
    color: colors.text.muted,
  },
});
