import React, { type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { radii, tones, type Tone } from '../../theme/tokens';
import { Text } from './Text';

export interface BadgeProps {
  label: string;
  tone?: Tone;
  icon?: ReactNode;
  dot?: boolean;
  size?: 'sm' | 'md';
}

const statusToTone: Record<string, Tone> = {
  present: 'success',
  checked_in: 'success',
  checked_out: 'success',
  completed: 'success',
  late: 'warning',
  absent: 'danger',
  approved: 'success',
  pending: 'warning',
  rejected: 'danger',
  cancelled: 'neutral',
  office: 'indigo',
  wfh: 'info',
  wfh_approved: 'info',
  active: 'indigo',
  inactive: 'neutral',
  not_punched: 'neutral',
};

export function toneForStatus(status: string): Tone {
  return statusToTone[status.toLowerCase()] ?? 'neutral';
}

export function Badge({ label, tone = 'neutral', icon, dot = false, size = 'sm' }: BadgeProps) {
  const palette = tones[tone] || tones.neutral;
  const isSmall = size === 'sm';

  const renderBadgeIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) return icon;
    const IconComp = icon as unknown as React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
    return <IconComp size={isSmall ? 10 : 12} color={palette.fg} strokeWidth={2} />;
  };

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: palette.bg,
          borderColor: palette.border,
          paddingVertical: isSmall ? 4 : 6,
          paddingHorizontal: isSmall ? 8 : 10,
          gap: isSmall ? 5 : 6,
        },
      ]}
    >
      {renderBadgeIcon()}
      {dot ? <View style={[styles.dot, { backgroundColor: palette.fg }]} /> : null}
      <Text
        variant="caption"
        color={palette.fg}
        style={{
          fontSize: isSmall ? 9 : 10,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
        }}
      >
        {label}
      </Text>
    </View>
  );
}

export function StatusBadge({
  status,
  label,
  dot = true,
  size = 'sm',
}: {
  status: string;
  label?: string;
  dot?: boolean;
  size?: 'sm' | 'md';
}) {
  const tone = toneForStatus(status);
  const displayLabel = label || status.replace(/_/g, ' ');
  return <Badge label={displayLabel} tone={tone} dot={dot} size={size} />;
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
});

