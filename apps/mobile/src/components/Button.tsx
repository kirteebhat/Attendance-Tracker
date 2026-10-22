import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  StyleSheet,
  ViewStyle,
  TextStyle,
  View,
  StyleProp,
} from "react-native";
import { colors, spacing, radii, typography } from "../theme";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  isLoading?: boolean;
  disabled?: boolean;
  icon?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  textStyle?: TextStyle;
  testID?: string;
  accessibilityLabel?: string;
}

export const Button: React.FC<ButtonProps> = ({
  title,
  onPress,
  variant = "primary",
  size = "md",
  isLoading = false,
  disabled = false,
  icon,
  style,
  textStyle,
  testID,
  accessibilityLabel,
}) => {
  const isDisabled = disabled || isLoading;

  const containerStyles = [
    styles.base,
    styles[variant],
    styles[`size_${size}`],
    ...(isDisabled ? [styles.disabled] : []),
    ...(style ? [style] : []),
  ];

  const textStyles = [
    styles.textBase,
    styles[`text_${variant}`],
    styles[`textSize_${size}`],
    ...(isDisabled ? [styles.textDisabled] : []),
    ...(textStyle ? [textStyle] : []),
  ];

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={containerStyles}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel || title}
      accessibilityState={{ disabled: isDisabled, busy: isLoading }}
    >
      {isLoading ? (
        <ActivityIndicator
          size="small"
          color={variant === "outline" || variant === "ghost" ? colors.accent.cyan : "#FFFFFF"}
        />
      ) : (
        <View style={styles.contentRow}>
          {icon && <View style={styles.iconContainer}>{icon}</View>}
          <Text style={textStyles}>{title}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
  },
  iconContainer: {
    marginRight: spacing.sm,
  },
  textBase: {
    fontWeight: "700",
    textAlign: "center",
  },
  // Variants
  primary: {
    backgroundColor: colors.accent.blue,
    shadowColor: colors.accent.blue,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 6,
    elevation: 4,
  },
  secondary: {
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.background.border,
  },
  outline: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.accent.cyan,
  },
  ghost: {
    backgroundColor: "transparent",
  },
  danger: {
    backgroundColor: colors.status.absent,
  },
  disabled: {
    opacity: 0.5,
    shadowOpacity: 0,
    elevation: 0,
  },
  // Text colors
  text_primary: {
    color: "#FFFFFF",
  },
  text_secondary: {
    color: colors.text.primary,
  },
  text_outline: {
    color: colors.accent.cyan,
  },
  text_ghost: {
    color: colors.text.accent,
  },
  text_danger: {
    color: "#FFFFFF",
  },
  textDisabled: {
    color: colors.text.muted,
  },
  // Sizes
  size_sm: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  size_md: {
    paddingVertical: spacing.md + 2,
    paddingHorizontal: spacing.xl,
    borderRadius: radii.lg,
  },
  size_lg: {
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.xxl,
    borderRadius: radii.xl,
  },
  textSize_sm: {
    ...typography.sm,
  },
  textSize_md: {
    ...typography.md,
  },
  textSize_lg: {
    ...typography.lg,
  },
});
