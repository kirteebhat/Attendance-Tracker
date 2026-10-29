import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  AlertCircle,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock3,
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
} from '../../src/components';
import { colors, radii, spacing } from '../../src/theme/tokens';
import {
  attendanceApi,
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

  const fetchHomeData = useCallback(async () => {
    try {
      const [todayRes, historyRes] = await Promise.allSettled([
        attendanceApi.getTodayAttendance(),
        attendanceApi.getMyAttendance({ limit: 5 }),
      ]);

      if (todayRes.status === 'fulfilled') setTodayData(todayRes.value);
      if (historyRes.status === 'fulfilled') setHistoryData(historyRes.value);
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
    const unsubResync = subscribeToResync(() => fetchHomeData());

    return () => {
      unsubAttendance();
      unsubWfhDecided();
      unsubWfhCreated();
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
    : isCheckedOut
      ? 'Completed'
      : isCheckedIn
        ? 'Punched In'
        : 'Not Punched';

  const punchStatusTone = isWfhToday
    ? 'info'
    : isCheckedOut || isCheckedIn
      ? 'success'
      : 'neutral';

  const stats = historyData?.stats;
  const presentCount = stats?.presentDays ?? 0;
  const lateCount = stats?.lateDays ?? 0;
  const wfhCount = stats?.wfhDays ?? 0;
  const absentCount = stats?.absentDays ?? 0;
  const totalRecordedDays = presentCount + lateCount + wfhCount + absentCount;

  const donutSegments = useMemo(
    () => [
      { label: 'Present', value: presentCount, color: colors.success },
      { label: 'Late', value: lateCount, color: colors.warning },
      { label: 'WFH', value: wfhCount, color: colors.info },
      { label: 'Absent', value: absentCount, color: colors.danger },
    ],
    [presentCount, lateCount, wfhCount, absentCount]
  );

  const recentRecords = historyData?.data?.slice(0, 4) || [];

  const firstName = user?.name ? user.name.split(' ')[0] : 'there';

  if (loading && !todayData) {
    return (
      <Screen>
        <PageHeader
          eyebrow="VorldX Operations"
          title={`${getGreeting()}, ${firstName}`}
          subtitle={getFormattedDate()}
        />
        <DashboardSkeleton />
      </Screen>
    );
  }

  return (
    <Screen
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
        eyebrow="VorldX Operations"
        title={`${getGreeting()}, ${firstName}`}
        subtitle={getFormattedDate()}
        right={
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Open profile"
            haptic="selection"
            onPress={() => router.navigate('/(tabs)/profile')}
          >
            <Avatar name={user?.name ?? 'VX'} showRing size={44} />
          </PressableScale>
        }
      />

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
            <Text variant="small" color={colors.textSecondary}>
              {record?.checkInTime
                ? `Punched in at ${formatTime(record.checkInTime)}`
                : 'Scan office display QR or verify WFH request.'}
            </Text>
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
      <View style={styles.statGrid}>
        <StatTile
          hint="this month"
          icon={CheckCircle2}
          label="Present"
          tone="success"
          value={presentCount}
        />
        <StatTile hint="this month" icon={Clock3} label="Late" tone="warning" value={lateCount} />
        <StatTile hint="this month" icon={AlertCircle} label="Absent" tone="danger" value={absentCount} />
        <StatTile hint="this month" icon={House} label="WFH" tone="info" value={wfhCount} />
      </View>

      {/* 3. Month Mix Donut Chart */}
      <Card style={styles.chartCard} padding={18}>
        <View style={styles.chartHeader}>
          <Text variant="subheading">Month Attendance Mix</Text>
          <Text variant="small" color={colors.muted}>
            {totalRecordedDays} recorded days
          </Text>
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
            caption="Latest attendance punches"
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
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
