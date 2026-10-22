import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { colors, spacing, typography } from "../theme";
import { Icon } from "./Icon";
import { setNetworkStateListener } from "../services/api";

export const OfflineBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(true);

  useEffect(() => {
    setNetworkStateListener((online) => {
      setIsOnline(online);
    });
  }, []);

  if (isOnline) return null;

  return (
    <View style={styles.banner} testID="offline-banner" accessibilityRole="alert">
      <Icon name="cloud-offline" size={16} color={colors.status.late} />
      <Text style={styles.text}>Offline Mode • Attempting to reconnect to VorldX...</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  banner: {
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    borderBottomWidth: 1,
    borderBottomColor: colors.status.late,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.md,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  text: {
    ...typography.xs,
    color: colors.status.late,
    fontWeight: "600",
  },
});
