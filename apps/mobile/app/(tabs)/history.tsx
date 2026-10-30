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
  CalendarDays,
  CheckCircle2,
  Clock3,
  House,
  RefreshCw,
  MapPin,
  Clock,
  ChevronRight,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  Screen,
  Card,
  Button,
  StatusBadge,
  StatTile,
  PageHeader,
  SectionHeader,
  Calendar,
  Notice,
  Text,
  PressableScale,
} from '../../src/components';
import { colors, radii, spacing, type Tone } from '../../src/theme/tokens';
import { useResponsive } from '../../src/lib/responsive';
import {
  attendanceApi,
  AttendanceRecordItem,
  AttendanceStats,
  holidayApi,
} from '../../src/services';
import { DEFAULT_CORPORATE_HOLIDAYS_2026 } from '../holidays';

function formatTime(isoString?: string | null): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
  } catch {
    return '—';
  }
}

function formatDuration(mins?: number): string {
  if (!mins || mins <= 0) return '0 hrs';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

type FilterType = 'ALL' | 'PRESENT' | 'LATE' | 'WFH' | 'ABSENT';

export default function HistoryScreen() {
  const router = useRouter();
  const { isWide } = useResponsive();

  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedMonth, setSelectedMonth] = useState(() => new Date());
  const [selectedDateKey, setSelectedDateKey] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');

  const [records, setRecords] = useState<AttendanceRecordItem[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [calendarEvents, setCalendarEvents] = useState<any[]>(DEFAULT_CORPORATE_HOLIDAYS_2026);

  useEffect(() => {
    let isMounted = true;
    holidayApi.getCalendarEvents(new Date().getFullYear())
      .then((res) => {
        if (!isMounted || !res.success || !Array.isArray(res.data) || res.data.length === 0) return;
        const list: any[] = [];
        for (const evt of res.data) {
          const dateKey = new Date(evt.startDate).toISOString().split('T')[0];
          list.push({
            _id: evt._id,
            name: evt.title,
            dateKey,
            type: evt.type,
            description: evt.description,
          });
        }
        if (list.length > 0) setCalendarEvents(list);
      })
      .catch(() => {});
    return () => {
      isMounted = false;
    };
  }, []);

  // Next upcoming corporate calendar teaser (dynamically derived from backend events)
  const nextCalendarTeaser = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const upcoming = calendarEvents
      .map((h) => {
        const parts = h.dateKey.split('-');
        const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
        const diffDays = Math.ceil((d.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return { ...h, dateObj: d, diffDays };
      })
      .filter((h) => h.diffDays >= 0)
      .sort((a, b) => a.diffDays - b.diffDays);

    const next = upcoming[0];
    if (!next) {
      return {
        subtitle: 'Holidays, hackathons, sessions & town halls',
      };
    }

    const dayStr = next.dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    const typeLabel =
      next.type === 'event'
        ? 'Hackathon / Session'
        : next.type === 'meeting'
        ? 'Town Hall'
        : next.type === 'companyOffDay'
        ? 'Company Off-Day'
        : 'Public Holiday';

    const isLongWeekend = (next.type === 'holiday' || next.type === 'companyOffDay') && (next.dateObj.getDay() === 1 || next.dateObj.getDay() === 5);
    const subtitle = `${next.name} (${dayStr}) • ${typeLabel}${isLongWeekend ? ' • Long Weekend' : ''}`;

    return { subtitle };
  }, [calendarEvents]);

  const monthKey = `${selectedMonth.getFullYear()}-${String(selectedMonth.getMonth() + 1).padStart(2, '0')}`;

  const fetchHistory = useCallback(async () => {
    setError(null);
    try {
      const res = await attendanceApi.getMyAttendance({ month: monthKey, limit: 100 });
      setRecords(res.data || []);
      setStats(res.stats || null);
    } catch {
      setError('Failed to load attendance records. Please check your connection.');
    } finally {
      setRefreshing(false);
    }
  }, [monthKey]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchHistory();
  }, [fetchHistory]);

  const goToToday = () => {
    const today = new Date();
    setSelectedMonth(today);
    setSelectedDateKey(today.toISOString().split('T')[0]);
    void Haptics.selectionAsync().catch(() => undefined);
  };

  // Build calendar marks
  const calendarMarks = useMemo(() => {
    const marks: Record<string, Tone> = {};
    for (const r of records) {
      if (r.dateKey) {
        if (r.isWfh || r.status === 'WFH_APPROVED') marks[r.dateKey] = 'info';
        else if (r.status === 'ABSENT') marks[r.dateKey] = 'danger';
        else if (r.isLate || r.status === 'LATE') marks[r.dateKey] = 'warning';
        else marks[r.dateKey] = 'success';
      }
    }
    return marks;
  }, [records]);

  // Selected date record
  const selectedRecord = useMemo(() => {
    return records.find((r) => r.dateKey === selectedDateKey) || null;
  }, [records, selectedDateKey]);

  // Filtered records
  const filteredRecords = useMemo(() => {
    return records.filter((r) => {
      if (activeFilter === 'ALL') return true;
      if (activeFilter === 'PRESENT') {
        return (
          r.status === 'PRESENT' ||
          r.status === 'CHECKED_OUT' ||
          r.status === 'CHECKED_IN'
        );
      }
      if (activeFilter === 'LATE') return r.isLate || r.status === 'LATE';
      if (activeFilter === 'WFH') return r.isWfh || r.status === 'WFH_APPROVED';
      if (activeFilter === 'ABSENT') return r.status === 'ABSENT';
      return true;
    });
  }, [records, activeFilter]);

  const monthDisplayName = selectedMonth.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });

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
        title="Attendance Activity"
        subtitle={monthDisplayName}
        right={
          <Button
            icon={<RefreshCw size={13} color={colors.text} />}
            label="Today"
            onPress={goToToday}
            size="sm"
            variant="secondary"
            fullWidth={false}
          />
        }
      />

      <View style={[styles.container, isWide && styles.containerWide]}>
        {error ? <Notice tone="danger" title="Load Error" message={error} /> : null}

        {/* ============================================================= */}
        {/* COMPANY CALENDAR, SESSIONS & EVENTS BUTTON */}
        {/* ============================================================= */}
        <PressableScale
          onPress={() => {
            void Haptics.selectionAsync().catch(() => undefined);
            router.push('/holidays' as any);
          }}
          style={styles.upcomingHolidaysBtn}
          haptic="selection"
          accessibilityRole="button"
          accessibilityLabel="View Company Calendar, Sessions, Hackathons and Holidays"
        >
          <View style={styles.holidaysBtnContent}>
            <View style={styles.holidaysBtnLeft}>
              <View style={styles.holidaysIconPill}>
                <CalendarDays size={18} color={colors.white} strokeWidth={2.2} />
              </View>
              <View style={styles.holidaysBtnTexts}>
                <Text variant="body" weight="bold" color={colors.white} style={styles.holidaysBtnTitle}>
                  Company Calendar & Events
                </Text>
                <Text variant="caption" color="rgba(255, 255, 255, 0.88)" numberOfLines={1}>
                  {nextCalendarTeaser.subtitle}
                </Text>
              </View>
            </View>

            <View style={styles.holidaysBtnArrow}>
              <ChevronRight size={18} color={colors.white} strokeWidth={2.4} />
            </View>
          </View>
        </PressableScale>

        {/* 1. Monthly Stats Grid */}
        <View style={styles.statSection}>
          <Text variant="caption" weight="bold" color={colors.textSecondary} style={styles.statSectionLabel}>
            THIS MONTH
          </Text>
          <View style={styles.statGrid}>
            <StatTile
              icon={CheckCircle2}
              label="Present"
              tone="success"
              value={stats?.presentDays ?? 0}
            />
            <StatTile
              icon={AlertCircle}
              label="Absent"
              tone="danger"
              value={stats?.absentDays ?? 0}
            />
            <StatTile
              icon={Clock3}
              label="Late"
              tone="warning"
              value={stats?.lateDays ?? 0}
            />
            <StatTile
              icon={House}
              label="WFH"
              tone="info"
              value={stats?.wfhDays ?? 0}
            />
          </View>
        </View>

        {/* 2. Interactive Calendar Card */}
        <Card variant="raised" padding={18} style={styles.calendarCard}>
          <Calendar
            month={selectedMonth}
            onMonthChange={setSelectedMonth}
            selectedDate={selectedDateKey}
            onSelectDate={(date) => {
              setSelectedDateKey(date);
              void Haptics.selectionAsync().catch(() => undefined);
            }}
            marks={calendarMarks}
          />
        </Card>

        {/* 3. Selected Day Details */}
        {selectedRecord ? (
          <Card variant="glass" padding={18} style={styles.selectedDayCard}>
            <View style={styles.selectedHeader}>
              <View style={styles.selectedHeaderLeft}>
                <Text variant="subheading" weight="semibold">
                  {selectedRecord.dateKey}
                </Text>
              </View>
              <StatusBadge status={selectedRecord.status} />
            </View>

            <View style={styles.timeStrip}>
              <View style={styles.timeCell}>
                <Text variant="caption" color={colors.muted}>
                  Check In
                </Text>
                <Text variant="monoSmall" color={colors.text}>
                  {formatTime(selectedRecord.checkInTime)}
                </Text>
              </View>
              <View style={styles.timeDivider} />
              <View style={styles.timeCell}>
                <Text variant="caption" color={colors.muted}>
                  Check Out
                </Text>
                <Text variant="monoSmall" color={colors.text}>
                  {formatTime(selectedRecord.checkOutTime)}
                </Text>
              </View>
              <View style={styles.timeDivider} />
              <View style={styles.timeCell}>
                <Text variant="caption" color={colors.muted}>
                  Duration
                </Text>
                <Text variant="monoSmall" color={colors.indigoSoft}>
                  {formatDuration(selectedRecord.durationMinutes)}
                </Text>
              </View>
            </View>

            {selectedRecord.isLate && selectedRecord.lateMinutes > 0 ? (
              <View style={styles.noteRow}>
                <Clock size={13} color={colors.warning} />
                <Text variant="small" color={colors.warning}>
                  Arrived {selectedRecord.lateMinutes} minutes past shift grace period
                </Text>
              </View>
            ) : null}

            {selectedRecord.terminalId ? (
              <View style={styles.noteRow}>
                <MapPin size={13} color={colors.muted} />
                <Text variant="small" color={colors.muted}>
                  Terminal: {selectedRecord.terminalId}
                </Text>
              </View>
            ) : null}
          </Card>
        ) : null}

        {/* 4. Filter Pills */}
        <View style={styles.filterRow}>
          {(['ALL', 'PRESENT', 'LATE', 'WFH', 'ABSENT'] as FilterType[]).map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <TouchableOpacity
                key={filter}
                onPress={() => {
                  setActiveFilter(filter);
                  void Haptics.selectionAsync().catch(() => undefined);
                }}
                style={[styles.filterPill, isActive ? styles.filterPillActive : null]}
              >
                <Text
                  variant="caption"
                  color={isActive ? colors.white : colors.muted}
                  style={styles.filterText}
                >
                  {filter}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* 5. Records Ledger */}
        <SectionHeader
          title="Attendance records"
          caption={`${filteredRecords.length} records in ${monthDisplayName}`}
        />

        {filteredRecords.length === 0 ? (
          <Card variant="soft" padding={22} style={styles.emptyCard}>
            <CalendarDays size={26} color={colors.muted} strokeWidth={1.6} />
            <Text variant="subheading" align="center">
              No records found
            </Text>
            <Text variant="small" color={colors.muted} align="center">
              No punch records match the selected month and filter.
            </Text>
          </Card>
        ) : (
          <Card padding={0}>
            {filteredRecords.map((item, index) => (
              <PressableScale
                key={item._id}
                accessibilityRole="button"
                haptic="selection"
                onPress={() => {
                  setSelectedDateKey(item.dateKey);
                }}
                style={[
                  styles.recordItem,
                  index > 0 ? styles.rowDivider : null,
                  selectedDateKey === item.dateKey ? styles.recordItemSelected : null,
                ]}
              >
                <View style={styles.recordItemLeft}>
                  <Text variant="bodyMedium" weight="semibold">
                    {item.dateKey}
                  </Text>
                  <Text variant="small" color={colors.muted}>
                    {item.checkInTime ? formatTime(item.checkInTime) : '—'} →{' '}
                    {item.checkOutTime ? formatTime(item.checkOutTime) : '—'} ·{' '}
                    {formatDuration(item.durationMinutes)}
                  </Text>
                </View>
                <StatusBadge status={item.status} />
              </PressableScale>
            ))}
          </Card>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: spacing.lg,
  },
  containerWide: {
    maxWidth: 620,
    alignSelf: 'center',
  },
  // Upcoming Holidays Button (Same color as selected date)
  upcomingHolidaysBtn: {
    backgroundColor: colors.indigo,
    borderRadius: radii.xl,
    paddingHorizontal: spacing.lg,
    paddingVertical: 14,
    shadowColor: colors.indigo,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.38,
    shadowRadius: 10,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  holidaysBtnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  holidaysBtnLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  holidaysIconPill: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  holidaysBtnTexts: {
    flex: 1,
    gap: 2,
  },
  holidaysBtnTitle: {
    fontSize: 15,
  },
  holidaysBtnArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
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
  calendarCard: {
    gap: spacing.sm,
  },
  selectedDayCard: {
    gap: spacing.md,
  },
  selectedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  selectedHeaderLeft: {
    gap: 2,
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
  noteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  filterRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  filterPill: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: colors.indigo,
    borderColor: colors.indigo,
  },
  filterText: {
    letterSpacing: 0.6,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  recordItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.lg,
  },
  recordItemSelected: {
    backgroundColor: 'rgba(89, 101, 242, 0.08)',
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  recordItemLeft: {
    flex: 1,
    gap: 3,
  },
});
