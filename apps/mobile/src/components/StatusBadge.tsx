import React from "react";
import { View, Text, StyleSheet, ViewStyle } from "react-native";
import { colors, spacing, radii, typography } from "../theme";

export type BadgeStatus =
  | "ACTIVE"
  | "INACTIVE"
  | "PRESENT"
  | "LATE"
  | "WFH"
  | "ABSENT"
  | "DEMO"
  | "PENDING"
  | "APPROVED"
  | "REJECTED";

interface StatusBadgeProps {
  status: BadgeStatus | string;
  label?: string;
  style?: ViewStyle;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status, label, style }) => {
  const normalized = status.toUpperCase();

  let bgColor: string = colors.background.elevated;
  let textColor: string = colors.text.secondary;
  let dotColor: string = colors.text.muted;

  switch (normalized) {
    case "PRESENT":
    case "ACTIVE":
    case "APPROVED":
      bgColor = colors.status.presentBg;
      textColor = colors.status.present;
      dotColor = colors.status.present;
      break;
    case "LATE":
    case "PENDING":
      bgColor = colors.status.lateBg;
      textColor = colors.status.late;
      dotColor = colors.status.late;
      break;
    case "ABSENT":
    case "INACTIVE":
    case "REJECTED":
      bgColor = colors.status.absentBg;
      textColor = colors.status.absent;
      dotColor = colors.status.absent;
      break;
    case "WFH":
      bgColor = colors.status.wfhBg;
      textColor = colors.status.wfh;
      dotColor = colors.status.wfh;
      break;
    case "DEMO":
      bgColor = colors.status.demoBg;
      textColor = colors.status.demo;
      dotColor = colors.status.demo;
      break;
  }

  const displayText = label || normalized.replace(/_/g, " ");

  return (
    <View style={[styles.container, { backgroundColor: bgColor }, style]}>
      <View style={[styles.dot, { backgroundColor: dotColor }]} />
      <Text style={[styles.text, { color: textColor }]}>{displayText}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: spacing.xs + 2,
  },
  text: {
    ...typography.xs,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
});

