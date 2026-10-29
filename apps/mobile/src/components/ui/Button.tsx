import React, { type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, fonts, gradients, radii } from '../../theme/tokens';
import { PressableScale } from './PressableScale';
import { Text } from './Text';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft' | 'outline';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps {
  label?: string;
  title?: string; // Colleague compatibility
  onPress?: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: ReactNode;
  rightIcon?: ReactNode;
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  style?: StyleProp<ViewStyle>;
  haptic?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

const sizes: Record<ButtonSize, { height: number; padding: number; font: number; gap: number }> = {
  sm: { height: 38, padding: 13, font: 13, gap: 7 },
  md: { height: 48, padding: 17, font: 14, gap: 8 },
  lg: { height: 54, padding: 20, font: 15, gap: 9 },
};

function radiusFor(size: ButtonSize): number {
  return size === 'sm' ? radii.sm : size === 'lg' ? radii.xl : radii.md;
}

export function Button({
  label,
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  rightIcon,
  loading = false,
  disabled = false,
  fullWidth = true,
  style,
  haptic = true,
  accessibilityLabel,
  testID,
}: ButtonProps) {
  const buttonText = label || title || '';
  const isDisabled = disabled || loading;
  const spec = sizes[size];
  const isPrimary = variant === 'primary';
  const isDanger = variant === 'danger';
  const isGhost = variant === 'ghost';
  const isOutline = variant === 'outline' || variant === 'secondary';

  const foreground = isPrimary
    ? colors.white
    : isDanger
      ? colors.danger
      : isGhost
        ? colors.textSecondary
        : colors.text;

  const renderBtnIcon = (ic?: ReactNode) => {
    if (!ic) return null;
    if (React.isValidElement(ic)) return ic;
    const IconComp = ic as unknown as React.ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
    return <IconComp size={16} color={foreground} strokeWidth={2} />;
  };

  const content = (
    <View pointerEvents="none" style={styles.content}>
      {loading ? (
        <ActivityIndicator size="small" color={foreground} />
      ) : (
        renderBtnIcon(icon)
      )}
      {buttonText ? (
        <Text
          variant="bodyMedium"
          color={foreground}
          numberOfLines={1}
          style={{ fontSize: spec.font, fontFamily: fonts.semibold, letterSpacing: 0.1 }}
        >
          {buttonText}
        </Text>
      ) : null}
      {!loading ? renderBtnIcon(rightIcon) : null}
    </View>
  );

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? buttonText}
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      haptic={haptic ? 'selection' : false}
      onPress={onPress}
      testID={testID}
      style={[
        styles.base,
        {
          height: spec.height,
          paddingHorizontal: spec.padding,
          borderRadius: radiusFor(size),
          gap: spec.gap,
        },
        fullWidth ? styles.fullWidth : null,
        isPrimary ? styles.primaryWrapper : null,
        isOutline ? styles.secondary : null,
        isGhost ? styles.ghost : null,
        isDanger ? styles.danger : null,
        variant === 'soft' ? styles.soft : null,
        style,
      ]}
    >
      {isPrimary ? (
        <LinearGradient
          colors={gradients.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: radiusFor(size) }]}
          pointerEvents="none"
        />
      ) : null}
      {content}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'transparent',
  },
  fullWidth: {
    width: '100%',
  },
  primaryWrapper: {
    shadowColor: colors.indigo,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 4,
  },
  secondary: {
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderColor: 'rgba(184, 190, 255, 0.22)',
  },
  ghost: {
    backgroundColor: 'transparent',
    borderColor: 'transparent',
  },
  danger: {
    backgroundColor: 'rgba(255, 107, 131, 0.1)',
    borderColor: 'rgba(255, 107, 131, 0.3)',
  },
  soft: {
    backgroundColor: colors.surfaceSoft,
    borderColor: 'rgba(184, 190, 255, 0.1)',
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
});

