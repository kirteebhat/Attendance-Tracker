import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { Stack } from "expo-router";
import { Icon } from "../src/components/Icon";
import { colors, spacing, typography, radii } from "../src/theme";
import {
  announcementsApi,
  MobileAnnouncementItem,
  subscribeToSocketEvent,
} from "../src/services";

export default function AnnouncementsScreen() {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [announcements, setAnnouncements] = useState<MobileAnnouncementItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);

  const loadAnnouncements = useCallback(async () => {
    try {
      const [listRes, countRes] = await Promise.allSettled([
        announcementsApi.getAnnouncements(40),
        announcementsApi.getUnreadCount(),
      ]);

      if (listRes.status === "fulfilled" && listRes.value.success) {
        setAnnouncements(listRes.value.data || []);
      }
      if (countRes.status === "fulfilled" && countRes.value.success) {
        setUnreadCount(countRes.value.unreadCount || 0);
      }
    } catch (err) {
      console.error("Failed to fetch announcements:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();

    const unsubPublish = subscribeToSocketEvent("announcement.published", () => {
      loadAnnouncements();
    });
    const unsubPin = subscribeToSocketEvent("announcement.pinned", () => {
      loadAnnouncements();
    });

    return () => {
      unsubPublish();
      unsubPin();
    };
  }, [loadAnnouncements]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    loadAnnouncements();
  }, [loadAnnouncements]);

  // Tap to read & toggle expand
  const handleItemPress = async (item: MobileAnnouncementItem) => {
    if (expandedId === item._id) {
      setExpandedId(null);
    } else {
      setExpandedId(item._id);
    }

    if (!item.isRead) {
      // Mark as read in state optimistically
      setAnnouncements((prev) =>
        prev.map((a) => (a._id === item._id ? { ...a, isRead: true } : a))
      );
      setUnreadCount((c) => Math.max(0, c - 1));

      // Call API
      try {
        await announcementsApi.markAsRead(item._id);
      } catch (err) {
        // silent fail
      }
    }
  };

  const renderItem = ({ item }: { item: MobileAnnouncementItem }) => {
    const isExpanded = expandedId === item._id;
    const isUrgent = item.priority === "URGENT";
    const isHigh = item.priority === "HIGH";
    const isAuto = item.source === "auto" || Boolean(item.isAuto);

    const getPriorityColor = () => {
      if (isUrgent) return colors.status.absent;
      if (isHigh) return colors.status.late;
      if (item.priority === "LOW") return colors.text.muted;
      return colors.accent.cyan;
    };

    const getPriorityBg = () => {
      if (isUrgent) return "rgba(239, 68, 68, 0.15)";
      if (isHigh) return "rgba(245, 158, 11, 0.15)";
      if (item.priority === "LOW") return "rgba(100, 116, 139, 0.15)";
      return "rgba(6, 182, 212, 0.15)";
    };

    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => handleItemPress(item)}
        style={[
          styles.itemCard,
          item.pinned && styles.pinnedCard,
          !item.isRead && styles.unreadCard,
        ]}
      >
        <View style={styles.cardHeader}>
          <View style={styles.badgeRow}>
            {item.pinned && (
              <View style={styles.pinnedBadge}>
                <Icon name="pin" size={11} color="#F59E0B" />
                <Text style={styles.pinnedText}>PINNED</Text>
              </View>
            )}

            <View style={[styles.priorityBadge, { backgroundColor: getPriorityBg() }]}>
              <Text style={[styles.priorityText, { color: getPriorityColor() }]}>
                {item.priority}
              </Text>
            </View>

            {isAuto && (
              <View style={styles.autoBadge}>
                <Icon name="sparkles" size={10} color="#818CF8" />
                <Text style={styles.autoText}>AUTO</Text>
              </View>
            )}

            {!item.isRead && <View style={styles.unreadIndicator} />}
          </View>

          <Text style={styles.dateText}>
            {new Date(item.startsAt).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            })}
          </Text>
        </View>

        <Text style={styles.itemTitle}>{item.title}</Text>

        <Text
          style={styles.itemBody}
          numberOfLines={isExpanded ? undefined : 2}
        >
          {item.body}
        </Text>

        <View style={styles.footerRow}>
          <Text style={styles.tapPrompt}>
            {isExpanded ? "Tap to collapse" : "Tap to expand details"}
          </Text>

          {item.isRead ? (
            <View style={styles.readStatusRow}>
              <Icon name="checkmark-done" size={14} color={colors.status.present} />
              <Text style={styles.readText}>Read</Text>
            </View>
          ) : (
            <Text style={styles.unreadPrompt}>Tap to mark read</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Announcements",
          headerTitle: "Announcements & Alerts",
          headerBackTitle: "Home",
          headerStyle: {
            backgroundColor: colors.background.surface,
          },
          headerTintColor: colors.text.primary,
          headerRight: () =>
            unreadCount > 0 ? (
              <View style={styles.headerBadge}>
                <Text style={styles.headerBadgeText}>{unreadCount} new</Text>
              </View>
            ) : null,
        }}
      />

      {loading ? (
        <View style={styles.centerContainer}>
          <ActivityIndicator size="large" color={colors.accent.cyan} />
          <Text style={styles.loadingText}>Fetching announcements...</Text>
        </View>
      ) : announcements.length === 0 ? (
        <View style={styles.centerContainer}>
          <View style={styles.emptyIconBg}>
            <Icon name="megaphone-outline" size={36} color={colors.accent.cyan} />
          </View>
          <Text style={styles.emptyTitle}>No Announcements</Text>
          <Text style={styles.emptySubtitle}>
            You are all caught up! When new company broadcasts or automated alerts are published, they will show up here.
          </Text>
        </View>
      ) : (
        <FlatList
          data={announcements}
          keyExtractor={(item) => item._id}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.accent.cyan}
              colors={[colors.accent.cyan]}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.base,
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  loadingText: {
    ...typography.sm,
    color: colors.text.secondary,
    marginTop: spacing.md,
  },
  emptyIconBg: {
    width: 72,
    height: 72,
    borderRadius: 24,
    backgroundColor: "rgba(6, 182, 212, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.lg,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.sm,
    color: colors.text.muted,
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 280,
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  itemCard: {
    backgroundColor: colors.background.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  pinnedCard: {
    borderColor: "rgba(245, 158, 11, 0.4)",
    backgroundColor: "rgba(17, 28, 56, 0.95)",
  },
  unreadCard: {
    borderColor: "rgba(6, 182, 212, 0.35)",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.sm,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pinnedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(245, 158, 11, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  pinnedText: {
    ...typography.xs,
    fontSize: 9,
    fontWeight: "800",
    color: "#F59E0B",
  },
  priorityBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  priorityText: {
    ...typography.xs,
    fontSize: 9,
    fontWeight: "800",
  },
  autoBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(99, 102, 241, 0.2)",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  autoText: {
    ...typography.xs,
    fontSize: 9,
    fontWeight: "700",
    color: "#C7D2FE",
  },
  unreadIndicator: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.accent.cyan,
  },
  dateText: {
    ...typography.xs,
    color: colors.text.muted,
  },
  itemTitle: {
    ...typography.md,
    fontWeight: "700",
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  itemBody: {
    ...typography.sm,
    color: colors.text.secondary,
    lineHeight: 20,
    marginBottom: spacing.md,
  },
  footerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "rgba(255, 255, 255, 0.06)",
    paddingTop: spacing.sm,
  },
  tapPrompt: {
    ...typography.xs,
    color: colors.text.muted,
  },
  readStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  readText: {
    ...typography.xs,
    color: colors.status.present,
    fontWeight: "600",
  },
  unreadPrompt: {
    ...typography.xs,
    color: colors.accent.cyan,
    fontWeight: "600",
  },
  headerBadge: {
    backgroundColor: colors.accent.cyan,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
  },
  headerBadgeText: {
    ...typography.xs,
    fontSize: 10,
    fontWeight: "800",
    color: colors.background.base,
  },
});
