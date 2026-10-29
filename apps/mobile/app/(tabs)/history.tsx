import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from "react-native";
import { Card, StatusBadge, Skeleton, Button, Icon } from "../../src/components";
import { colors, spacing, typography, radii } from "../../src/theme";
import { attendanceApi, AttendanceRecordItem, AttendanceStats } from "../../src/services";

export default function HistoryScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Month navigation: current date initialized to current month
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<"ALL" | "PRESENT" | "LATE" | "WFH" | "ABSENT">(
    "ALL"
  );

  const [records, setRecords] = useState<AttendanceRecordItem[]>([]);
  const [stats, setStats] = useState<AttendanceStats | null>(null);

  const monthKey = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}`;

  const recordsByDateKey = useMemo(() => {
    const map = new Map<string, AttendanceRecordItem>();
    records.forEach((r) => {
      if (r.dateKey) {
        map.set(r.dateKey, r);
      }
    });
    return map;
  }, [records]);

  const calendarDays = useMemo(() => {
    const year = selectedDate.getFullYear();
    const month = selectedDate.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    // Monday = 0, Sunday = 6
    const firstDayIndex = (new Date(year, month, 1).getDay() + 6) % 7;

    const days: Array<{
      key: string;
      dayNumber?: number;
      dateKey?: string;
      record?: AttendanceRecordItem;
      isWeekend?: boolean;
      isToday?: boolean;
      isBlank: boolean;
      statusColor?: string;
      statusLabel?: string;
    }> = [];

    // Blank cells before month starts
    for (let i = 0; i < firstDayIndex; i++) {
      days.push({ key: `blank-${i}`, isBlank: true });
    }

    const todayStr = new Date().toISOString().split("T")[0];

    for (let d = 1; d <= daysInMonth; d++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const rec = recordsByDateKey.get(dateKey);
      const dayOfWeek = (firstDayIndex + d - 1) % 7;
      const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
      const isToday = dateKey === todayStr;

      let statusColor: string = colors.border.subtle;
      let statusLabel = isWeekend ? "Weekend" : "Not Logged";

      if (rec) {
        if (rec.isWfh || rec.status === "WFH_APPROVED") {
          statusColor = colors.status.wfh;
          statusLabel = "WFH";
        } else if (rec.isLate || rec.status === "LATE") {
          statusColor = colors.status.late;
          statusLabel = "Late";
        } else if (
          rec.status === "PRESENT" ||
          rec.status === "CHECKED_OUT" ||
          rec.status === "CHECKED_IN"
        ) {
          statusColor = colors.status.present;
          statusLabel = "Present";
        } else if (rec.status === "ABSENT") {
          statusColor = colors.status.absent;
          statusLabel = "Absent";
        } else {
          statusColor = colors.accent.cyan;
          statusLabel = rec.status;
        }
      }

      days.push({
        key: dateKey,
        dayNumber: d,
        dateKey,
        record: rec,
        isWeekend,
        isToday,
        isBlank: false,
        statusColor,
        statusLabel,
      });
    }

    return days;
  }, [selectedDate, recordsByDateKey]);

  const selectedDayRecord = selectedDayKey ? recordsByDateKey.get(selectedDayKey) : null;

  const fetchHistory = useCallback(async () => {
    setError(null);
    try {
      const res = await attendanceApi.getMyAttendance({ month: monthKey, limit: 100 });
      setRecords(res.data || []);
      setStats(res.stats || null);
    } catch (err: unknown) {
      setError("Failed to load attendance records. Please check your connection.");
    } finally {
      setLoading(false);
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

  const handlePrevMonth = () => {
    setSelectedDate((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
    setLoading(true);
  };

  const handleNextMonth = () => {
    setSelectedDate((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
    setLoading(true);
  };

  // Filter records based on selected filter pill
  const filteredRecords = records.filter((r) => {
    if (activeFilter === "ALL") return true;
    if (activeFilter === "PRESENT") {
      return (
        r.status === "PRESENT" ||
        r.status === "CHECKED_OUT" ||
        r.status === "CHECKED_IN"
      );
    }
    if (activeFilter === "LATE") return r.isLate || r.status === "LATE";
    if (activeFilter === "WFH") return r.isWfh || r.status === "WFH_APPROVED";
    if (activeFilter === "ABSENT") return r.status === "ABSENT";
    return true;
  });

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
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
  };

  const monthDisplayName = selectedDate.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

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
      {/* 1. Month Navigation Stepper */}
      <Card variant="surface" style={styles.monthStepperCard}>
        <TouchableOpacity
          onPress={handlePrevMonth}
          style={styles.monthNavBtn}
          testID="history-prev-month-btn"
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          accessibilityHint="Navigates to the previous month's attendance records"
        >
          <Icon name="chevron-back" size={20} color={colors.accent.cyan} />
        </TouchableOpacity>

        <View style={styles.monthDisplayBox}>
          <Icon name="calendar" size={16} color={colors.accent.cyan} />
          <Text style={styles.monthDisplayText} testID="history-month-display">
            {monthDisplayName}
          </Text>
        </View>

        <TouchableOpacity
          onPress={handleNextMonth}
          style={styles.monthNavBtn}
          testID="history-next-month-btn"
          accessibilityRole="button"
          accessibilityLabel="Next month"
          accessibilityHint="Navigates to the next month's attendance records"
        >
          <Icon name="chevron-forward" size={20} color={colors.accent.cyan} />
        </TouchableOpacity>
      </Card>

      {/* 2. Monthly Summary Stats Strip */}
      {stats && (
        <Card variant="surface" style={styles.summaryStripCard}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{stats.presentDays}</Text>
            <Text style={styles.summaryLabel}>Present</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.status.late }]}>
              {stats.lateDays}
            </Text>
            <Text style={styles.summaryLabel}>Late</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.status.wfh }]}>
              {stats.wfhDays}
            </Text>
            <Text style={styles.summaryLabel}>WFH</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, { color: colors.accent.cyan }]}>
              {stats.attendancePercentage}%
            </Text>
            <Text style={styles.summaryLabel}>Rate</Text>
          </View>
        </Card>
      )}

      {/* 2.5 Monthly Calendar Matrix */}
      <Card variant="surface" style={styles.calendarCard} testID="history-calendar-card">
        <View style={styles.calendarHeaderRow}>
          <Text style={styles.calendarTitle}>Month at a Glance</Text>
          <View style={styles.calendarLegendRow}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.status.present }]} />
              <Text style={styles.legendText}>Present</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.status.late }]} />
              <Text style={styles.legendText}>Late</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.status.wfh }]} />
              <Text style={styles.legendText}>WFH</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.status.absent }]} />
              <Text style={styles.legendText}>Absent</Text>
            </View>
          </View>
        </View>

        {/* Days of Week Header */}
        <View style={styles.weekDaysRow}>
          {["M", "T", "W", "T", "F", "S", "S"].map((dayName, idx) => (
            <View key={`weekday-${idx}`} style={styles.weekDayHeaderCell}>
              <Text style={[styles.weekDayHeaderText, (idx === 5 || idx === 6) && styles.weekendHeaderText]}>
                {dayName}
              </Text>
            </View>
          ))}
        </View>

        {/* Calendar Day Grid */}
        <View style={styles.calendarGrid}>
          {calendarDays.map((item) => {
            if (item.isBlank) {
              return <View key={item.key} style={styles.calendarCellBlank} />;
            }

            const isSelected = selectedDayKey === item.dateKey;

            return (
              <TouchableOpacity
                key={item.key}
                onPress={() => setSelectedDayKey(isSelected ? null : (item.dateKey || null))}
                style={[
                  styles.calendarCell,
                  isSelected && styles.calendarCellSelected,
                  item.isToday && styles.calendarCellToday,
                ]}
                accessibilityRole="button"
                accessibilityLabel={`Day ${item.dayNumber}, ${item.statusLabel}${item.isToday ? ", Today" : ""}`}
                accessibilityHint="Tap to inspect punch details for this day"
                testID={`calendar-day-${item.dayNumber}`}
              >
                <Text
                  style={[
                    styles.dayNumberText,
                    item.isWeekend && styles.weekendDayNumberText,
                    isSelected && styles.selectedDayNumberText,
                  ]}
                >
                  {item.dayNumber}
                </Text>

                {/* Status Dot / Marker */}
                {item.record ? (
                  <View style={[styles.dayStatusMarker, { backgroundColor: item.statusColor }]} />
                ) : (
                  <View style={styles.dayStatusMarkerEmpty} />
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Selected Day Inspection Banner */}
        {selectedDayKey && (
          <View style={styles.selectedDayDetailBox} testID="history-selected-day-preview">
            <View style={styles.selectedDayHeader}>
              <View>
                <Text style={styles.selectedDayDateText}>
                  {new Date(selectedDayKey + "T00:00:00").toLocaleDateString(undefined, {
                    weekday: "long",
                    month: "short",
                    day: "numeric",
                  })}
                </Text>
                <Text style={styles.selectedDaySubtext}>{selectedDayKey}</Text>
              </View>
              {selectedDayRecord ? (
                <StatusBadge
                  status={selectedDayRecord.isWfh ? "WFH" : (selectedDayRecord.status as any)}
                  label={selectedDayRecord.isWfh ? "WFH" : selectedDayRecord.status}
                />
              ) : (
                <Text style={styles.noPunchText}>No Punch Logged</Text>
              )}
            </View>

            {selectedDayRecord && (
              <View style={styles.selectedDayPunchRow}>
                <View style={styles.punchTimeMiniBox}>
                  <Text style={styles.punchMiniLabel}>In</Text>
                  <Text style={styles.punchMiniValue}>{formatTime(selectedDayRecord.checkInTime)}</Text>
                </View>
                <View style={styles.punchTimeMiniBox}>
                  <Text style={styles.punchMiniLabel}>Out</Text>
                  <Text style={styles.punchMiniValue}>{formatTime(selectedDayRecord.checkOutTime)}</Text>
                </View>
                <View style={styles.punchTimeMiniBox}>
                  <Text style={styles.punchMiniLabel}>Duration</Text>
                  <Text style={styles.punchMiniValue}>{formatDuration(selectedDayRecord.durationMinutes)}</Text>
                </View>
                {selectedDayRecord.isLate && (
                  <View style={styles.lateMiniTag}>
                    <Text style={styles.lateMiniText}>+{selectedDayRecord.lateMinutes}m</Text>
                  </View>
                )}
              </View>
            )}
          </View>
        )}
      </Card>

      {/* 3. Filter Pills */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterPillsContainer}
      >
        {(["ALL", "PRESENT", "LATE", "WFH", "ABSENT"] as const).map((f) => (
          <TouchableOpacity
            key={f}
            onPress={() => setActiveFilter(f)}
            style={[styles.filterPill, activeFilter === f && styles.filterPillActive]}
            testID={`history-filter-${f.toLowerCase()}`}
            accessibilityRole="button"
            accessibilityLabel={`Filter by ${f}`}
          >
            <Text style={[styles.filterPillText, activeFilter === f && styles.filterPillTextActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* 4. Error State */}
      {error && (
        <Card variant="surface" style={styles.errorCard} testID="history-error-state">
          <Icon name="alert-circle-outline" size={32} color={colors.text.danger} />
          <Text style={styles.errorText}>{error}</Text>
          <Button
            title="Retry"
            onPress={fetchHistory}
            variant="outline"
            size="sm"
            testID="history-retry-btn"
          />
        </Card>
      )}

      {/* 5. Loading Skeletons */}
      {loading && !refreshing && (
        <View style={styles.loadingList}>
          {[1, 2, 3, 4].map((i) => (
            <Card key={i} variant="surface" style={styles.skeletonCard}>
              <Skeleton width="40%" height={18} borderRadius={radii.sm} />
              <Skeleton width="70%" height={14} style={{ marginTop: spacing.sm }} />
            </Card>
          ))}
        </View>
      )}

      {/* 6. Attendance Record List */}
      {!loading && !error && filteredRecords.length > 0 && (
        <View style={styles.recordsList} testID="history-records-list">
          {filteredRecords.map((item) => (
            <Card key={item._id} variant="surface" style={styles.recordCard}>
              <View style={styles.recordHeaderRow}>
                <View style={styles.recordDateBox}>
                  <Text style={styles.recordDateText}>
                    {new Date(item.dateKey + "T00:00:00").toLocaleDateString(undefined, {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}
                  </Text>
                  <Text style={styles.recordKeySubtext}>{item.dateKey}</Text>
                </View>

                <StatusBadge
                  status={item.isWfh ? "WFH" : (item.status as any)}
                  label={item.isWfh ? "WFH" : item.status}
                />
              </View>

              <View style={styles.recordDivider} />

              <View style={styles.recordDetailsRow}>
                <View style={styles.punchTimeItem}>
                  <Icon name="log-in-outline" size={16} color={colors.status.present} />
                  <View>
                    <Text style={styles.punchTimeLabel}>In</Text>
                    <Text style={styles.punchTimeValue}>{formatTime(item.checkInTime)}</Text>
                  </View>
                </View>

                <View style={styles.punchTimeItem}>
                  <Icon name="log-out-outline" size={16} color={colors.accent.indigo} />
                  <View>
                    <Text style={styles.punchTimeLabel}>Out</Text>
                    <Text style={styles.punchTimeValue}>{formatTime(item.checkOutTime)}</Text>
                  </View>
                </View>

                <View style={styles.punchTimeItem}>
                  <Icon name="time-outline" size={16} color={colors.accent.cyan} />
                  <View>
                    <Text style={styles.punchTimeLabel}>Duration</Text>
                    <Text style={styles.durationValueText}>
                      {formatDuration(item.durationMinutes)}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Late or Correction Notice Badges */}
              {(item.isLate || item.isManuallyCorrected) && (
                <View style={styles.metaRow}>
                  {item.isLate && (
                    <View style={styles.lateTag}>
                      <Icon name="warning-outline" size={12} color={colors.status.late} />
                      <Text style={styles.lateTagText}>Late (+{item.lateMinutes}m)</Text>
                    </View>
                  )}
                  {item.isManuallyCorrected && (
                    <View style={styles.correctedTag}>
                      <Icon name="create-outline" size={12} color={colors.accent.cyan} />
                      <Text style={styles.correctedTagText}>HR Corrected</Text>
                    </View>
                  )}
                </View>
              )}
            </Card>
          ))}
        </View>
      )}

      {/* 7. Empty State */}
      {!loading && !error && filteredRecords.length === 0 && (
        <Card variant="surface" style={styles.emptyCard} testID="history-empty-state">
          <View style={styles.emptyIconBox}>
            <Icon name="calendar-outline" size={36} color={colors.text.muted} />
          </View>
          <Text style={styles.emptyTitle}>No Attendance Records</Text>
          <Text style={styles.emptySubtitle}>
            No punch records were found for {monthDisplayName} with the selected &quot;{activeFilter}&quot;
            filter.
          </Text>
        </Card>
      )}
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
  monthStepperCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  monthNavBtn: {
    width: 44,
    height: 44,
    minWidth: 44,
    minHeight: 44,
    borderRadius: radii.md,
    backgroundColor: "rgba(6, 182, 212, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  monthDisplayBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  monthDisplayText: {
    ...typography.md,
    fontWeight: "800",
    color: colors.text.primary,
  },
  summaryStripCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  summaryItem: {
    alignItems: "center",
  },
  summaryValue: {
    ...typography.lg,
    fontWeight: "900",
    color: colors.text.primary,
  },
  summaryLabel: {
    ...typography.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  summaryDivider: {
    width: 1,
    height: 30,
    backgroundColor: colors.border.subtle,
  },
  calendarCard: {
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  calendarHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  calendarTitle: {
    ...typography.sm,
    fontWeight: "800",
    color: colors.text.primary,
  },
  calendarLegendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  legendDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  legendText: {
    fontSize: 10,
    color: colors.text.muted,
    fontWeight: "600",
  },
  weekDaysRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    paddingBottom: 6,
    marginBottom: 6,
  },
  weekDayHeaderCell: {
    flex: 1,
    alignItems: "center",
  },
  weekDayHeaderText: {
    fontSize: 11,
    fontWeight: "700",
    color: colors.text.muted,
  },
  weekendHeaderText: {
    color: colors.status.late,
  },
  calendarGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "flex-start",
  },
  calendarCellBlank: {
    width: "14.285%",
    height: 44,
  },
  calendarCell: {
    width: "14.285%",
    height: 44,
    minHeight: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: "transparent",
    position: "relative",
  },
  calendarCellSelected: {
    borderColor: colors.accent.cyan,
    backgroundColor: "rgba(6, 182, 212, 0.15)",
  },
  calendarCellToday: {
    backgroundColor: "rgba(255, 255, 255, 0.05)",
  },
  dayNumberText: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text.primary,
  },
  weekendDayNumberText: {
    color: colors.text.muted,
  },
  selectedDayNumberText: {
    color: colors.accent.cyan,
    fontWeight: "900",
  },
  dayStatusMarker: {
    width: 5,
    height: 5,
    borderRadius: 2.5,
    marginTop: 2,
  },
  dayStatusMarkerEmpty: {
    width: 5,
    height: 5,
    marginTop: 2,
  },
  selectedDayDetailBox: {
    marginTop: spacing.md,
    padding: spacing.md,
    backgroundColor: colors.background.elevated,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  selectedDayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  selectedDayDateText: {
    ...typography.sm,
    fontWeight: "800",
    color: colors.text.primary,
  },
  selectedDaySubtext: {
    ...typography.xs,
    color: colors.text.muted,
    marginTop: 2,
  },
  noPunchText: {
    ...typography.xs,
    color: colors.text.muted,
    fontStyle: "italic",
  },
  selectedDayPunchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  punchTimeMiniBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  punchMiniLabel: {
    fontSize: 10,
    color: colors.text.muted,
    textTransform: "uppercase",
  },
  punchMiniValue: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.text.primary,
  },
  lateMiniTag: {
    backgroundColor: colors.status.lateBg,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  lateMiniText: {
    fontSize: 10,
    fontWeight: "800",
    color: colors.status.late,
  },
  filterPillsContainer: {
    flexDirection: "row",
    gap: spacing.xs,
    marginBottom: spacing.lg,
  },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    minHeight: 44,
    justifyContent: "center",
    borderRadius: radii.full,
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  filterPillActive: {
    backgroundColor: "rgba(6, 182, 212, 0.2)",
    borderColor: colors.accent.cyan,
  },
  filterPillText: {
    ...typography.xs,
    fontWeight: "700",
    color: colors.text.secondary,
  },
  filterPillTextActive: {
    color: colors.accent.cyan,
  },
  loadingList: {
    gap: spacing.sm,
  },
  skeletonCard: {
    padding: spacing.lg,
  },
  recordsList: {
    gap: spacing.sm,
  },
  recordCard: {
    padding: spacing.md,
  },
  recordHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  recordDateBox: {
    gap: 2,
  },
  recordDateText: {
    ...typography.sm,
    fontWeight: "800",
    color: colors.text.primary,
  },
  recordKeySubtext: {
    ...typography.xs,
    color: colors.text.muted,
  },
  recordDivider: {
    height: 1,
    backgroundColor: colors.border.subtle,
    marginVertical: spacing.sm,
  },
  recordDetailsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  punchTimeItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  punchTimeLabel: {
    ...typography.xs,
    color: colors.text.muted,
    fontSize: 10,
  },
  punchTimeValue: {
    ...typography.xs,
    fontWeight: "700",
    color: colors.text.primary,
  },
  durationValueText: {
    ...typography.xs,
    fontWeight: "800",
    color: colors.accent.cyan,
  },
  metaRow: {
    flexDirection: "row",
    gap: spacing.xs,
    marginTop: spacing.sm,
  },
  lateTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  lateTagText: {
    ...typography.xs,
    fontSize: 11,
    fontWeight: "700",
    color: colors.status.late,
  },
  correctedTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(6, 182, 212, 0.12)",
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  correctedTagText: {
    ...typography.xs,
    fontSize: 11,
    fontWeight: "700",
    color: colors.accent.cyan,
  },
  emptyCard: {
    padding: spacing.xxl,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyIconBox: {
    width: 64,
    height: 64,
    borderRadius: radii.full,
    backgroundColor: "rgba(148, 163, 184, 0.08)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.md,
    fontWeight: "800",
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.xs,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 260,
  },
  errorCard: {
    padding: spacing.xl,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  errorText: {
    ...typography.sm,
    color: colors.text.danger,
    textAlign: "center",
  },
});

