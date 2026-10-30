import React from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import type { LucideIcon } from 'lucide-react-native';
import { colors, radii, tones, type Tone } from '../../theme/tokens';
import { Text } from './Text';

export function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'indigo',
  style,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon?: LucideIcon;
  tone?: Tone;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = tones[tone] || tones.neutral;
  return (
    <View style={[styles.tile, { borderColor: palette.border }, style]}>
      {Icon ? (
        <View style={[styles.icon, { backgroundColor: palette.bg }]}>
          <Icon size={12} color={palette.fg} strokeWidth={2.2} />
        </View>
      ) : null}
      <Text variant="numberSmall" numberOfLines={1} style={styles.value}>
        {value}
      </Text>
      <Text variant="caption" numberOfLines={1} style={styles.label}>
        {label}
      </Text>
      {hint ? (
        <Text variant="small" color={colors.muted} numberOfLines={1} style={styles.hint}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: radii.md,
    borderWidth: 1,
    backgroundColor: 'rgba(18, 21, 36, 0.66)',
    gap: 3,
  },
  icon: {
    width: 22,
    height: 22,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 2,
  },
  value: {
    color: colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  label: {
    fontSize: 11,
    color: colors.muted,
  },
  hint: {
    fontSize: 10,
    marginTop: 1,
  },
});

