import React from "react";
import { View, StyleSheet, ViewStyle } from "react-native";
import { colors, spacing, radii, shadows } from "../theme";

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: "surface" | "elevated" | "outlined";
  testID?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  style,
  variant = "surface",
  testID,
}) => {
  return (
    <View style={[styles.base, styles[variant], style]} testID={testID}>
      {children}
    </View>
  );
};

const styles = StyleSheet.create({
  base: {
    borderRadius: radii.xl,
    padding: spacing.xl,
    ...shadows.card,
  },
  surface: {
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.background.border,
  },
  elevated: {
    backgroundColor: colors.background.elevated,
    borderWidth: 1,
    borderColor: colors.background.border,
  },
  outlined: {
    backgroundColor: "transparent",
    borderWidth: 1.5,
    borderColor: colors.background.border,
  },
});

