import React from 'react';
import { StyleSheet, View, TouchableOpacity } from 'react-native';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { colors, fonts, spacing, tones, type Tone } from '../../theme/tokens';
import { useResponsive } from '../../lib/responsive';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export interface CalendarProps {
  month: Date;
  onMonthChange: (month: Date) => void;
  selectedDate?: string | null;
  onSelectDate?: (date: string) => void;
  marks?: Record<string, Tone>;
  markedDates?: Record<string, { tone: Tone; label?: string }>;
}

export function Calendar({
  month,
  onMonthChange,
  selectedDate,
  onSelectDate,
  marks,
  markedDates,
}: CalendarProps) {
  const { isWide } = useResponsive();
  const circleSize = isWide ? 40 : 34;

  const year = month.getFullYear();
  const monthIdx = month.getMonth();

  // First day of month & number of days
  const firstDayOfWeek = new Date(year, monthIdx, 1).getDay();
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();

  // Build grid cells
  const cells: { key: string; dateStr: string; dayNum: number; inMonth: boolean }[] = [];
  
  // Previous month trailing days
  const prevMonthDays = new Date(year, monthIdx, 0).getDate();
  for (let i = firstDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    const prevMonthIdx = monthIdx === 0 ? 11 : monthIdx - 1;
    const prevYear = monthIdx === 0 ? year - 1 : year;
    const dateStr = `${prevYear}-${String(prevMonthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ key: `prev-${d}`, dateStr, dayNum: d, inMonth: false });
  }

  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ key: `curr-${d}`, dateStr, dayNum: d, inMonth: true });
  }

  // Next month leading days to fill remaining week cells
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 1; d <= remaining; d++) {
      const nextMonthIdx = monthIdx === 11 ? 0 : monthIdx + 1;
      const nextYear = monthIdx === 11 ? year + 1 : year;
      const dateStr = `${nextYear}-${String(nextMonthIdx + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ key: `next-${d}`, dateStr, dayNum: d, inMonth: false });
    }
  }

  const prevMonth = () => {
    onMonthChange(new Date(year, monthIdx - 1, 1));
  };

  const nextMonth = () => {
    onMonthChange(new Date(year, monthIdx + 1, 1));
  };

  const monthLabel = month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  const todayStr = new Date().toISOString().split('T')[0];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Previous month"
          haptic="selection"
          onPress={prevMonth}
          style={styles.navButton}
        >
          <ChevronLeft size={19} color={colors.textSecondary} strokeWidth={2} />
        </PressableScale>
        <Text variant="subheading" style={styles.monthLabel}>
          {monthLabel}
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Next month"
          haptic="selection"
          onPress={nextMonth}
          style={styles.navButton}
        >
          <ChevronRight size={19} color={colors.textSecondary} strokeWidth={2} />
        </PressableScale>
      </View>

      <View style={styles.weekRow}>
        {WEEKDAYS.map((weekday) => (
          <View key={weekday} style={styles.weekCell}>
            <Text variant="caption" color={colors.muted} style={styles.weekday}>
              {weekday}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.grid}>
        {cells.map((cell) => {
          const selected = selectedDate === cell.dateStr;
          const isToday = todayStr === cell.dateStr;
          const mark = markedDates?.[cell.dateStr]?.tone ?? marks?.[cell.dateStr];
          const toneStyle = mark ? tones[mark] : null;

          return (
            <TouchableOpacity
              key={cell.key}
              onPress={() => onSelectDate?.(cell.dateStr)}
              style={[styles.dayCell, { height: circleSize + 6 }]}
              disabled={!cell.inMonth}
            >
              <View
                style={[
                  styles.circle,
                  { width: circleSize, height: circleSize, borderRadius: circleSize / 2 },
                  selected ? styles.selectedCircle : null,
                  isToday && !selected ? styles.todayCircle : null,
                  !cell.inMonth ? styles.dimmedCircle : null,
                ]}
              >
                <Text
                  style={[
                    styles.dayText,
                    selected ? styles.selectedDayText : null,
                    !cell.inMonth ? styles.dimmedText : null,
                  ]}
                >
                  {cell.dayNum}
                </Text>
                {cell.inMonth && toneStyle ? (
                  <View style={[styles.dot, { backgroundColor: toneStyle.fg }]} />
                ) : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    paddingVertical: spacing.sm,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
    paddingHorizontal: spacing.sm,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  monthLabel: {
    fontFamily: fonts.semibold,
    color: colors.text,
  },
  weekRow: {
    flexDirection: 'row',
    marginBottom: spacing.sm,
  },
  weekCell: {
    flex: 1,
    alignItems: 'center',
  },
  weekday: {
    fontSize: 10,
    letterSpacing: 0.8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  selectedCircle: {
    backgroundColor: colors.indigo,
    shadowColor: colors.indigo,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.5,
    shadowRadius: 6,
    elevation: 3,
  },
  todayCircle: {
    borderWidth: 1,
    borderColor: colors.indigoSoft,
  },
  dimmedCircle: {
    opacity: 0.25,
  },
  dayText: {
    fontSize: 13,
    fontFamily: fonts.medium,
    color: colors.text,
  },
  selectedDayText: {
    fontFamily: fonts.bold,
    color: colors.white,
  },
  dimmedText: {
    color: colors.muted,
  },
  dot: {
    position: 'absolute',
    bottom: 3,
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});

