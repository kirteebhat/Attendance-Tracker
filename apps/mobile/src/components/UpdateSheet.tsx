import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useAppUpdates, APP_VERSION } from "../services/updateService";
import { colors, spacing, typography, radii } from "../theme";

export const UpdateSheet: React.FC = () => {
  const { updateInfo, hasUpdate, isForced, isApplying, applyUpdate, dismissUpdate } =
    useAppUpdates();

  if (!hasUpdate && !isForced) return null;

  const targetVersion = updateInfo?.latestVersion || "1.1.0";
  const minVersion = updateInfo?.minSupportedVersion || "1.0.0";
  const notes = updateInfo?.notes || "Enhancements and stability improvements.";

  return (
    <Modal
      visible={hasUpdate || isForced}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!isForced) dismissUpdate();
      }}
    >
      <View style={styles.overlay}>
        <View style={[styles.container, isForced && styles.forcedContainer]}>
          {/* Header Icon */}
          <View style={[styles.iconWrapper, isForced ? styles.forcedIconWrapper : styles.normalIconWrapper]}>
            <Text style={styles.iconEmoji}>{isForced ? "⚠️" : "🚀"}</Text>
          </View>

          {/* Title & Badges */}
          <View style={styles.headerText}>
            <View style={styles.badgeRow}>
              <Text style={styles.title}>
                {isForced ? "Critical Update Required" : "Update Available"}
              </Text>
              <View style={[styles.versionBadge, isForced ? styles.forcedBadge : styles.normalBadge]}>
                <Text style={styles.versionBadgeText}>v{targetVersion}</Text>
              </View>
            </View>

            <Text style={styles.subtitle}>
              {isForced
                ? `Your installed version (v${APP_VERSION}) is below the required threshold (v${minVersion}). You must apply this update to continue.`
                : `A new version of VorldX Attendance (v${targetVersion}) is ready to download.`}
            </Text>
          </View>

          {/* Release Notes Scrollbox */}
          <View style={styles.notesBox}>
            <Text style={styles.notesHeader}>What's New:</Text>
            <ScrollView style={styles.notesScroll} showsVerticalScrollIndicator={false}>
              <Text style={styles.notesText}>{notes}</Text>
            </ScrollView>
          </View>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.applyButton, isForced ? styles.forcedButton : styles.primaryButton]}
              onPress={applyUpdate}
              disabled={isApplying}
              activeOpacity={0.8}
            >
              {isApplying ? (
                <ActivityIndicator color="#ffffff" size="small" />
              ) : (
                <Text style={styles.applyButtonText}>
                  {isForced ? "Update & Restart Now" : "Update Now"}
                </Text>
              )}
            </TouchableOpacity>

            {!isForced && (
              <TouchableOpacity
                style={styles.laterButton}
                onPress={dismissUpdate}
                disabled={isApplying}
              >
                <Text style={styles.laterButtonText}>Remind Me Later</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.85)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.md,
  },
  container: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: colors.background.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 10,
  },
  forcedContainer: {
    borderColor: "rgba(239, 68, 68, 0.5)",
  },
  iconWrapper: {
    width: 54,
    height: 54,
    borderRadius: radii.lg,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  normalIconWrapper: {
    backgroundColor: "rgba(59, 130, 246, 0.15)",
  },
  forcedIconWrapper: {
    backgroundColor: "rgba(239, 68, 68, 0.15)",
  },
  iconEmoji: {
    fontSize: 26,
  },
  headerText: {
    marginBottom: spacing.md,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs,
  },
  title: {
    ...typography.lg,
    fontWeight: "800",
    color: colors.text.primary,
    flex: 1,
  },
  versionBadge: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radii.full,
    marginLeft: spacing.sm,
  },
  normalBadge: {
    backgroundColor: "rgba(59, 130, 246, 0.2)",
  },
  forcedBadge: {
    backgroundColor: "rgba(239, 68, 68, 0.2)",
  },
  versionBadgeText: {
    ...typography.xs,
    fontWeight: "700",
    color: colors.text.primary,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  subtitle: {
    ...typography.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  notesBox: {
    backgroundColor: colors.background.base,
    borderRadius: radii.md,
    padding: spacing.md,
    maxHeight: 140,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    marginBottom: spacing.lg,
  },
  notesHeader: {
    ...typography.xs,
    fontWeight: "700",
    color: colors.text.muted,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs,
  },
  notesScroll: {
    maxHeight: 90,
  },
  notesText: {
    ...typography.sm,
    color: colors.text.secondary,
    lineHeight: 20,
  },
  actions: {
    gap: spacing.sm,
  },
  applyButton: {
    height: 48,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    backgroundColor: colors.accent.blue,
  },
  forcedButton: {
    backgroundColor: colors.status.absent,
  },
  applyButtonText: {
    ...typography.sm,
    fontWeight: "700",
    color: "#ffffff",
  },
  laterButton: {
    height: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  laterButtonText: {
    ...typography.sm,
    color: colors.text.muted,
    fontWeight: "600",
  },
});
