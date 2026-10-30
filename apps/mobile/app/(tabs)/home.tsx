import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  Bell,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
  HelpCircle,
  House,
  QrCode,
} from 'lucide-react-native';
import { useAuth } from '../../src/context/AuthContext';
import {
  Screen,
  Card,
  Button,
  Badge,
  StatusBadge,
  StatTile,
  PageHeader,
  SectionHeader,
  DonutChart,
  DonutLegend,
  DashboardSkeleton,
  Avatar,
  Text,
  PressableScale,
  AnnouncementBanner,
} from '../../src/components';
import { colors, radii, spacing } from '../../src/theme/tokens';
import {
  attendanceApi,
  announcementsApi,
  MobileAnnouncementItem,
  TodayAttendanceResponse,
  AttendanceHistoryResponse,
  subscribeToSocketEvent,
  subscribeToResync,
} from '../../src/services';

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function getFormattedDate(): string {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function formatTime(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '—';
  }
}

function formatDuration(mins?: number, checkInIso?: string | null): string {
  if (mins && mins > 0) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  }
  if (checkInIso) {
    const elapsedMins = Math.max(0, Math.floor((Date.now() - new Date(checkInIso).getTime()) / 60000));
    const h = Math.floor(elapsedMins / 60);
    const m = elapsedMins % 60;
    if (h === 0) return `${m}m`;
    return `${h}h ${m}m`;
  }
  return '—';
}

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useAuth();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [todayData, setTodayData] = useState<TodayAttendanceResponse | null>(null);
  const [historyData, setHistoryData] = useState<AttendanceHistoryResponse | null>(null);
  const [topAnnouncement, setTopAnnouncement] = useState<MobileAnnouncementItem | null>(null);
  const [unreadAnnouncementsCount, setUnreadAnnouncementsCount] = useState<number>(0);

  const fetchHomeData = useCallback(async () => {
    try {
      const [todayRes, historyRes, announceRes, countRes] = await Promise.allSettled([
        attendanceApi.getTodayAttendance(),
        attendanceApi.getMyAttendance({ limit: 5 }),
        announcementsApi.getAnnouncements(1),
        announcementsApi.getUnreadCount(),
      ]);

      if (todayRes.status === 'fulfilled') setTodayData(todayRes.value);
      if (historyRes.status === 'fulfilled') setHistoryData(historyRes.value);
      if (announceRes.status === 'fulfilled' && announceRes.value?.success && announceRes.value?.data?.length > 0) {
        setTopAnnouncement(announceRes.value.data[0]);
      }
      if (countRes.status === 'fulfilled' && countRes.value?.success) {
        setUnreadAnnouncementsCount(countRes.value.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to load home dashboard data', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchHomeData();

    const unsubAttendance = subscribeToSocketEvent('attendance.updated', () => fetchHomeData());
    const unsubWfhDecided = subscribeToSocketEvent('wfh.decided', () => fetchHomeData());
    const unsubWfhCreated = subscribeToSocketEvent('wfh.created', () => fetchHomeData());
    const unsubAnnouncePub = subscribeToSocketEvent('announcement.published', () => fetchHomeData());
    const unsubAnnouncePin = subscribeToSocketEvent('announcement.pinned', () => fetchHomeData());
    const unsubResync = subscribeToResync(() => fetchHomeData());

    return () => {
      unsubAttendance();
      unsubWfhDecided();
      unsubWfhCreated();
      unsubAnnouncePub();
      unsubAnnouncePin();
      unsubResync();
    };
  }, [fetchHomeData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHomeData();
  }, [fetchHomeData]);

  const record = todayData?.record;
  const isCheckedIn = Boolean(record?.checkInTime && !record?.checkOutTime);
  const isCheckedOut = Boolean(record?.checkOutTime);
  const isWfhToday = Boolean(record?.isWfh || record?.status === 'WFH_APPROVED');

  const punchStatusLabel = isWfhToday
    ? 'WFH Active'
    : isCheckedIn
      ? 'Punched In'
      : isCheckedOut
        ? 'Punched Out'
        : 'Not Checked In';

  const punchStatusTone = isWfhToday
    ? 'leave'
    : isCheckedIn
      ? 'success'
      : isCheckedOut
        ? 'neutral'
        : 'warning';

  const firstName = user?.name ? user.name.split(' ')[0] : 'there';

  const stats = historyData?.stats;
  const presentCount = stats?.presentDays ?? 0;
  const lateCount = stats?.lateDays ?? 0;
  const absentCount = stats?.absentDays ?? 0;
  const wfhCount = stats?.wfhDays ?? 0;

  const donutSegments = useMemo(
    () => [
      { label: 'Present', value: presentCount, color: colors.success },
      { label: 'Late', value: lateCount, color: colors.warning },
      { label: 'Absent', value: absentCount, color: colors.danger },
      { label: 'WFH', value: wfhCount, color: colors.info },
    ],
    [presentCount, lateCount, absentCount, wfhCount]
  );

  const totalRecordedDays = presentCount + lateCount + absentCount + wfhCount;
  const recentRecords = historyData?.data ?? [];

  if (loading && !refreshing) {
    return (
      <Screen edges={['top', 'bottom']}>
        <DashboardSkeleton />
      </Screen>
    );
  }

  return (
    <Screen
      edges={['top', 'bottom']}
      refreshControl={
        <RefreshControl
          colors={[colors.indigoSoft]}
          onRefresh={onRefresh}
          refreshing={refreshing}
          tintColor={colors.indigoSoft}
        />
      }
    >
      <PageHeader
        title={`${getGreeting()}, ${firstName}`}
        subtitle={getFormattedDate()}
        right={
          <View style={styles.headerRight}>
            {/* Contact HR / Help */}
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push('/enquiries' as any)}
              accessibilityLabel="Contact HR & Enquiries"
            >
              <HelpCircle size={18} color={colors.indigoSoft} strokeWidth={2} />
            </TouchableOpacity>

            {/* Announcements Bell */}
            <TouchableOpacity
              style={styles.iconButton}
              onPress={() => router.push('/announcements' as any)}
              accessibilityLabel="View Announcements"
            >
              <Bell size={18} color={colors.indigoSoft} strokeWidth={2} />
              {unreadAnnouncementsCount > 0 && (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>
                    {unreadAnnouncementsCount > 9 ? '9+' : unreadAnnouncementsCount}
                  </Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Profile Avatar */}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Open profile"
              haptic="selection"
              onPress={() => router.navigate('/(tabs)/profile')}
            >
              <Avatar name={user?.name ?? 'VX'} showRing size={40} />
            </PressableScale>
          </View>
        }
      />

      {/* Top Live Announcement Banner */}
      {topAnnouncement && (
        <AnnouncementBanner
          announcement={topAnnouncement}
          unreadCount={unreadAnnouncementsCount}
          onDismiss={() => setTopAnnouncement(null)}
        />
      )}

      {/* 1. Hero Punch Status Card */}
      <Card style={styles.heroCard} variant="raised" padding={20}>
        <View style={styles.heroHeader}>
          <View style={styles.heroCopy}>
            <Text variant="caption" color={colors.muted}>
              {record ? "Today's Attendance" : 'Today · Not Checked In'}
            </Text>
            <Text variant="title" style={styles.heroTitle}>
              {isCheckedIn
                ? 'On the clock'
                : isCheckedOut
                  ? 'Shift completed'
                  : isWfhToday
                    ? 'Working from home'
                    : 'Ready to punch in'}
            </Text>
            {record?.checkInTime ? (
              <Text variant="small" color={colors.textSecondary}>
                Punched in at {formatTime(record.checkInTime)}
              </Text>
            ) : null}
          </View>
          <Badge label={punchStatusLabel} tone={punchStatusTone} dot />
        </View>

        {/* Time Strip */}
        <View style={styles.timeStrip}>
          <View style={styles.timeCell}>
            <Text variant="caption" color={colors.muted}>
              Check in
            </Text>
            <Text variant="monoSmall" color={colors.text}>
              {formatTime(record?.checkInTime)}
            </Text>
          </View>
          <View style={styles.timeDivider} />
          <View style={styles.timeCell}>
            <Text variant="caption" color={colors.muted}>
              Check out
            </Text>
            <Text variant="monoSmall" color={colors.text}>
              {formatTime(record?.checkOutTime)}
            </Text>
          </View>
          <View style={styles.timeDivider} />
          <View style={styles.timeCell}>
            <Text variant="caption" color={colors.muted}>
              Duration
            </Text>
            <Text variant="monoSmall" color={colors.indigoSoft}>
              {formatDuration(record?.durationMinutes, record?.checkInTime)}
            </Text>
          </View>
        </View>

        {/* Assigned Shift Strip */}
        <View style={styles.shiftStrip}>
          <View style={styles.shiftIcon}>
            <Clock3 size={15} color={colors.indigoSoft} strokeWidth={1.9} />
          </View>
          <View style={styles.shiftCopy}>
            <Text variant="small" color={colors.textSecondary}>
              Standard Shift
            </Text>
            <Text variant="monoSmall" color={colors.text}>
              09:30 AM – 06:30 PM · Mon to Fri
            </Text>
          </View>
          <Badge label="15m grace" tone="neutral" />
        </View>

        {/* Quick Actions */}
        <View style={styles.heroActions}>
          <Button
            icon={<QrCode size={16} color={colors.white} strokeWidth={2} />}
            label="Scan office QR"
            onPress={() => router.navigate('/(tabs)/scan')}
            size="sm"
            style={styles.heroButton}
          />
          <Button
            icon={<House size={16} color={colors.text} strokeWidth={1.9} />}
            label="Work from home"
            onPress={() => router.navigate('/(tabs)/wfh')}
            size="sm"
            style={styles.heroButton}
            variant="secondary"
          />
        </View>
      </Card>

      {/* 2. Monthly Stats Row */}
      <View style={styles.statSection}>
        <Text variant="caption" weight="bold" color={colors.textSecondary} style={styles.statSectionLabel}>
          THIS MONTH
        </Text>
        <View style={styles.statGrid}>
          <StatTile
            icon={CheckCircle2}
            label="Present"
            tone="success"
            value={presentCount}
          />
          <StatTile
            icon={AlertCircle}
            label="Absent"
            tone="danger"
            value={absentCount}
          />
          <StatTile
            icon={Clock3}
            label="Late"
            tone="warning"
            value={lateCount}
          />
          <StatTile
            icon={House}
            label="WFH"
            tone="info"
            value={wfhCount}
          />
        </View>
      </View>

      {/* 3. Month Mix Donut Chart */}
      <Card style={styles.chartCard} padding={18}>
        <View style={styles.chartHeader}>
          <Text variant="subheading">Month Attendance Mix</Text>
        </View>
        {totalRecordedDays > 0 ? (
          <View style={styles.donutRow}>
            <DonutChart
              centerLabel="total days"
              centerValue={String(totalRecordedDays)}
              segments={donutSegments}
              size={124}
            />
            <DonutLegend segments={donutSegments} />
          </View>
        ) : (
          <View style={styles.emptyChart}>
            <CalendarDays size={22} color={colors.muted} strokeWidth={1.6} />
            <Text variant="small" color={colors.muted} align="center">
              Your monthly statistics will show here after your first attendance punch.
            </Text>
          </View>
        )}
      </Card>

      {/* 4. Recent Attendance Activity */}
      {recentRecords.length > 0 && (
        <View style={styles.recentSection}>
          <SectionHeader
            actionLabel="View all"
            onAction={() => router.navigate('/(tabs)/history')}
            title="Recent activity"
          />
          <Card padding={0}>
            {recentRecords.map((item, index) => (
              <PressableScale
                key={item._id}
                accessibilityRole="button"
                haptic="selection"
                onPress={() => router.navigate('/(tabs)/history')}
                style={[styles.recordRow, index > 0 ? styles.rowDivider : null]}
              >
                <View style={styles.recordLeft}>
                  <Text variant="small" color={colors.text} weight="semibold">
                    {item.dateKey}
                  </Text>
                  <Text variant="small" color={colors.muted}>
                    {item.checkInTime ? formatTime(item.checkInTime) : '—'} →{' '}
                    {item.checkOutTime ? formatTime(item.checkOutTime) : '—'}
                  </Text>
                </View>
                <StatusBadge status={item.status} />
                <ChevronRight size={15} color={colors.muted} />
              </PressableScale>
            ))}
          </Card>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(89, 101, 242, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(89, 101, 242, 0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  bellBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: colors.indigo,
    borderRadius: 8,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  heroCard: {
    gap: spacing.md,
  },
  heroHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  heroCopy: {
    flex: 1,
    gap: 3,
  },
  heroTitle: {
    fontSize: 20,
    marginTop: 2,
  },
  timeStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: 'rgba(11, 14, 25, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(184, 190, 255, 0.08)',
  },
  timeCell: {
    flex: 1,
    alignItems: 'center',
    gap: 3,
  },
  timeDivider: {
    width: 1,
    height: 24,
    backgroundColor: colors.border,
  },
  shiftStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  shiftIcon: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: 'rgba(89, 101, 242, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shiftCopy: {
    flex: 1,
  },
  heroActions: {
    flexDirection: 'row',
    gap: 10,
    marginTop: spacing.xs,
  },
  heroButton: {
    flex: 1,
  },
  statSection: {
    gap: 8,
  },
  statSectionLabel: {
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    fontSize: 11,
    paddingHorizontal: 2,
  },
  statGrid: {
    flexDirection: 'row',
    alignItems: 'stretch',
    gap: 8,
  },
  chartCard: {
    gap: spacing.md,
  },
  chartHeader: {
    gap: 2,
  },
  donutRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.xs,
  },
  emptyChart: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xl,
    gap: spacing.sm,
  },
  recentSection: {
    gap: spacing.sm,
    paddingBottom: spacing.lg,
  },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  recordLeft: {
    flex: 1,
    gap: 2,
  },
});
