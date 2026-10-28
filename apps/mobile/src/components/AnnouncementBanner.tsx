import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from "react-native";
import { useRouter } from "expo-router";
import { Icon } from "./Icon";
import { colors, spacing, typography, radii } from "../theme";
import { MobileAnnouncementItem } from "../services";

interface AnnouncementBannerProps {
  announcement: MobileAnnouncementItem | null;
  unreadCount?: number;
  onDismiss?: (id: string) => void;
}

export const AnnouncementBanner: React.FC<AnnouncementBannerProps> = ({
  announcement,
  unreadCount = 0,
  onDismiss,
}) => {
  const router = useRouter();
  const [dismissed, setDismissed] = useState(false);

  if (!announcement || dismissed) {
    return null;
  }

  const isUrgent = announcement.priority === "URGENT";
  const isHigh = announcement.priority === "HIGH";
  const isAuto = announcement.source === "auto" || Boolean(announcement.isAuto);

  const getBorderColor = () => {
    if (isUrgent) return colors.status.absent;
    if (isHigh) return colors.status.late;
    return colors.accent.cyan;
  };

  const getBgColor = () => {
    if (isUrgent) return "rgba(239, 68, 68, 0.12)";
    if (isHigh) return "rgba(245, 158, 11, 0.12)";
    return "rgba(6, 182, 212, 0.10)";
  };

  const getIconName = () => {
    if (isUrgent) return "flame";
    if (isHigh) return "alert-circle";
    if (announcement.pinned) return "pin";
    if (isAuto) return "sparkles";
    return "megaphone";
  };

  const getIconColor = () => {
    if (isUrgent) return colors.status.absent;
    if (isHigh) return colors.status.late;
    return colors.accent.cyan;
  };

  const handlePress = () => {
    router.push("/announcements" as any);
  };

  const handleClose = () => {
    setDismissed(true);
    if (onDismiss) {
      onDismiss(announcement._id);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.85}
      onPress={handlePress}
      style={[
        styles.container,
        {
          borderColor: getBorderColor(),
          backgroundColor: getBgColor(),
        },
      ]}
      accessibilityRole="button"
      accessibilityLabel={`Announcement: ${announcement.title}`}
    >
      <View style={styles.contentRow}>
        {/* Left Icon Pill */}
        <View style={[styles.iconContainer, { backgroundColor: getBorderColor() + "25" }]}>
          <Icon name={getIconName()} size={18} color={getIconColor()} />
        </View>

        {/* Text Container */}
        <View style={styles.textContainer}>
          <View style={styles.badgeRow}>
            {announcement.pinned && (
              <View style={styles.pinBadge}>
                <Icon name="pin" size={10} color="#F59E0B" />
                <Text style={styles.pinText}>PINNED</Text>
              </View>
            )}

            <View
              style={[
                styles.priorityBadge,
                {
                  backgroundColor:
                    isUrgent
                      ? "rgba(239, 68, 68, 0.25)"
                      : isHigh
                      ? "rgba(245, 158, 11, 0.25)"
                      : "rgba(6, 182, 212, 0.2)",
                },
              ]}
            >
              <Text
                style={[
                  styles.priorityText,
                  {
                    color: isUrgent
                      ? "#FCA5A5"
                      : isHigh
                      ? "#FDE68A"
                      : "#A5F3FC",
                  },
                ]}
              >
                {announcement.priority}
              </Text>
            </View>

            {isAuto && (
              <View style={styles.autoBadge}>
                <Text style={styles.autoText}>AUTO</Text>
              </View>
            )}

            {unreadCount > 1 && (
              <View style={styles.unreadCountBadge}>
                <Text style={styles.unreadCountText}>+{unreadCount - 1} more</Text>
              </View>
            )}

            {!announcement.isRead && (
              <View style={styles.unreadDot} />
            )}
          </View>

          <Text style={styles.title} numberOfLines={1}>
            {announcement.title}
          </Text>

          <Text style={styles.body} numberOfLines={2}>
            {announcement.body}
          </Text>
        </View>

        {/* Right Action / Arrow */}
        <View style={styles.rightActions}>
          <TouchableOpacity
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            onPress={handleClose}
            style={styles.closeButton}
            accessibilityLabel="Dismiss announcement banner"
          >
            <Icon name="close" size={16} color={colors.text.muted} />
          </TouchableOpacity>

          <Icon name="chevron-forward" size={16} color={colors.text.secondary} />
        </View>
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    marginHorizontal: spacing.lg,
    marginBottom: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  contentRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  iconContainer: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.sm + 2,
    marginTop: 2,
  },
  textContainer: {
    flex: 1,
    marginRight: spacing.xs,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: 4,
  },
  pinBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  pinText: {
    ...typography.xs,
    fontSize: 9,
    fontWeight: "800",
    color: "#F59E0B",
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  priorityText: {
    ...typography.xs,
    fontSize: 9,
    fontWeight: "800",
  },
  autoBadge: {
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  autoText: {
    ...typography.xs,
    fontSize: 9,
    fontWeight: "700",
    color: "#C7D2FE",
  },
  unreadCountBadge: {
    backgroundColor: "rgba(6, 182, 212, 0.2)",
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 4,
  },
  unreadCountText: {
    ...typography.xs,
    fontSize: 9,
    fontWeight: "700",
    color: colors.accent.cyan,
  },
  unreadDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.accent.cyan,
  },
  title: {
    ...typography.sm,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: 2,
  },
  body: {
    ...typography.xs,
    color: colors.text.secondary,
    lineHeight: 16,
  },
  rightActions: {
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "stretch",
    paddingLeft: spacing.xs,
  },
  closeButton: {
    padding: 2,
    marginBottom: 8,
  },
});
