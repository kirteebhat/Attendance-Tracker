import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  ScrollView,
} from 'react-native';
import { Stack } from 'expo-router';
import {
  AlertTriangle,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  Megaphone,
  Pin,
  Sparkles,
} from 'lucide-react-native';
import {
  Screen,
  ScreenHeader,
  Card,
  Badge,
  Text,
  PressableScale,
  Skeleton,
} from '../src/components';
import { colors, radii, spacing, type Tone } from '../src/theme/tokens';
import { useResponsive } from '../src/lib/responsive';
import {
  announcementsApi,
  MobileAnnouncementItem,
  subscribeToSocketEvent,
} from '../src/services';

type FilterType = 'all' | 'unread' | 'pinned' | 'urgent';

function formatDate(isoString: string): string {
  try {
    const date = new Date(isoString);
    const now = new Date();
    const isToday =
      date.getDate() === now.getDate() &&
      date.getMonth() === now.getMonth() &&
      date.getFullYear() === now.getFullYear();

    if (isToday) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      date.getDate() === yesterday.getDate() &&
      date.getMonth() === yesterday.getMonth() &&
      date.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return 'Yesterday';
    }

    return date.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Recent';
  }
}

export default function AnnouncementsScreen() {
  const { isWide } = useResponsive();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [announcements, setAnnouncements] = useState<MobileAnnouncementItem[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState<number>(0);
  const [activeFilter, setActiveFilter] = useState<FilterType>('all');

  const loadAnnouncements = useCallback(async () => {
    try {
      const [listRes, countRes] = await Promise.allSettled([
        announcementsApi.getAnnouncements(40),
        announcementsApi.getUnreadCount(),
      ]);

      if (listRes.status === 'fulfilled' && listRes.value.success) {
        setAnnouncements(listRes.value.data || []);
      }
      if (countRes.status === 'fulfilled' && countRes.value.success) {
        setUnreadCount(countRes.value.unreadCount || 0);
      }
    } catch (err) {
      console.error('Failed to fetch announcements:', err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadAnnouncements();

    const unsubPublish = subscribeToSocketEvent('announcement.published', () => {
      loadAnnouncements();
    });
    const unsubPin = subscribeToSocketEvent('announcement.pinned', () => {
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

  // Handle tap: toggle expansion & optimistically mark as read
  const handleItemPress = async (item: MobileAnnouncementItem) => {
    setExpandedId((prev) => (prev === item._id ? null : item._id));

    if (!item.isRead) {
      setAnnouncements((prev) =>
        prev.map((a) => (a._id === item._id ? { ...a, isRead: true } : a))
      );
      setUnreadCount((c) => Math.max(0, c - 1));

      try {
        await announcementsApi.markAsRead(item._id);
      } catch {
        // Silent failure for read receipt
      }
    }
  };

  const pinnedCount = useMemo(
    () => announcements.filter((a) => a.pinned).length,
    [announcements]
  );

  const urgentCount = useMemo(
    () => announcements.filter((a) => a.priority === 'URGENT').length,
    [announcements]
  );

  // Filtered dataset
  const filteredAnnouncements = useMemo(() => {
    switch (activeFilter) {
      case 'unread':
        return announcements.filter((a) => !a.isRead);
      case 'pinned':
        return announcements.filter((a) => a.pinned);
      case 'urgent':
        return announcements.filter((a) => a.priority === 'URGENT');
      case 'all':
      default:
        return announcements;
    }
  }, [activeFilter, announcements]);

  const getPriorityTone = (priority: string): Tone => {
    switch (priority) {
      case 'URGENT':
        return 'danger';
      case 'HIGH':
        return 'warning';
      case 'LOW':
        return 'neutral';
      case 'NORMAL':
      default:
        return 'info';
    }
  };

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        edges={['left', 'right', 'bottom']}
        refreshControl={
          <RefreshControl
            colors={[colors.indigoSoft]}
            onRefresh={onRefresh}
            refreshing={refreshing}
            tintColor={colors.indigoSoft}
          />
        }
      >
        <ScreenHeader
          title="Announcements"
          subtitle="Company broadcasts & operational alerts"
          right={
            unreadCount > 0 ? (
              <Badge dot label={`${unreadCount} NEW`} tone="indigo" size="sm" />
            ) : (
              <Badge label="ALL READ" tone="neutral" size="sm" />
            )
          }
        />

        <View style={[styles.container, isWide && styles.containerWide]}>
          {/* Segmented Filter Bar */}
          <View style={styles.filterBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.filterScroll}
            >
              <PressableScale
                onPress={() => setActiveFilter('all')}
                style={[
                  styles.filterPill,
                  activeFilter === 'all' && styles.filterPillActive,
                ]}
              >
                <Text
                  variant="caption"
                  color={activeFilter === 'all' ? colors.text : colors.muted}
                  weight={activeFilter === 'all' ? 'bold' : 'medium'}
                >
                  All ({announcements.length})
                </Text>
              </PressableScale>

              <PressableScale
                onPress={() => setActiveFilter('unread')}
                style={[
                  styles.filterPill,
                  activeFilter === 'unread' && styles.filterPillActive,
                ]}
              >
                <Text
                  variant="caption"
                  color={activeFilter === 'unread' ? colors.indigoSoft : colors.muted}
                  weight={activeFilter === 'unread' ? 'bold' : 'medium'}
                >
                  Unread ({unreadCount})
                </Text>
              </PressableScale>

              {pinnedCount > 0 && (
                <PressableScale
                  onPress={() => setActiveFilter('pinned')}
                  style={[
                    styles.filterPill,
                    activeFilter === 'pinned' && styles.filterPillActive,
                  ]}
                >
                  <Text
                    variant="caption"
                    color={activeFilter === 'pinned' ? colors.warning : colors.muted}
                    weight={activeFilter === 'pinned' ? 'bold' : 'medium'}
                  >
                    Pinned ({pinnedCount})
                  </Text>
                </PressableScale>
              )}

              {urgentCount > 0 && (
                <PressableScale
                  onPress={() => setActiveFilter('urgent')}
                  style={[
                    styles.filterPill,
                    activeFilter === 'urgent' && styles.filterPillActive,
                  ]}
                >
                  <Text
                    variant="caption"
                    color={activeFilter === 'urgent' ? colors.danger : colors.muted}
                    weight={activeFilter === 'urgent' ? 'bold' : 'medium'}
                  >
                    Urgent ({urgentCount})
                  </Text>
                </PressableScale>
              )}
            </ScrollView>
          </View>

          {/* Body Content */}
          {loading && !refreshing ? (
            <View style={styles.loadingContainer}>
              <Card variant="glass" padding={18}>
                <Skeleton width="40%" height={14} borderRadius={radii.xs} />
                <View style={styles.skeletonSpacer} />
                <Skeleton width="90%" height={20} borderRadius={radii.xs} />
                <View style={styles.skeletonSpacer} />
                <Skeleton width="100%" height={38} borderRadius={radii.xs} />
              </Card>
              <Card variant="glass" padding={18}>
                <Skeleton width="35%" height={14} borderRadius={radii.xs} />
                <View style={styles.skeletonSpacer} />
                <Skeleton width="80%" height={20} borderRadius={radii.xs} />
                <View style={styles.skeletonSpacer} />
                <Skeleton width="100%" height={38} borderRadius={radii.xs} />
              </Card>
            </View>
          ) : filteredAnnouncements.length === 0 ? (
            <Card variant="glass" style={styles.emptyCard} padding={28}>
              <View style={styles.emptyIconWrapper}>
                <Megaphone size={32} color={colors.indigoSoft} strokeWidth={1.8} />
              </View>
              <Text variant="subheading" align="center" style={styles.emptyTitle}>
                {activeFilter === 'unread'
                  ? 'All Caught Up!'
                  : activeFilter === 'pinned'
                    ? 'No Pinned Announcements'
                    : 'No Announcements'}
              </Text>
              <Text variant="small" color={colors.muted} align="center" style={styles.emptySubtitle}>
                {activeFilter === 'unread'
                  ? 'You have read all company broadcasts. Check back later for updates.'
                  : 'Important notices, schedule adjustments, and corporate broadcasts will appear here.'}
              </Text>
            </Card>
          ) : (
            <View style={styles.listContainer}>
              {filteredAnnouncements.map((item) => {
                const isExpanded = expandedId === item._id;
                const isUrgent = item.priority === 'URGENT';
                const isAuto = item.source === 'auto' || Boolean(item.isAuto);

                return (
                  <Card
                    key={item._id}
                    variant={item.pinned ? 'raised' : 'glass'}
                    tone={item.pinned ? 'warning' : !item.isRead ? 'indigo' : undefined}
                    padding={18}
                    style={[
                      styles.card,
                      item.pinned && styles.cardPinned,
                      !item.isRead && styles.cardUnread,
                    ]}
                    onPress={() => handleItemPress(item)}
                  >
                    {/* Header Badges & Date */}
                    <View style={styles.cardHeader}>
                      <View style={styles.badgeGroup}>
                        {item.pinned && (
                          <Badge
                            label="PINNED"
                            tone="warning"
                            size="sm"
                            icon={<Pin size={10} color={colors.warning} strokeWidth={2.2} />}
                          />
                        )}

                        <Badge
                          label={item.priority}
                          tone={getPriorityTone(item.priority)}
                          size="sm"
                          icon={
                            isUrgent ? (
                              <AlertTriangle size={10} color={colors.danger} strokeWidth={2.2} />
                            ) : undefined
                          }
                        />

                        {isAuto && (
                          <Badge
                            label="AUTO"
                            tone="leave"
                            size="sm"
                            icon={<Sparkles size={10} color={colors.leave} strokeWidth={2.2} />}
                          />
                        )}

                        {!item.isRead && <View style={styles.unreadBeacon} />}
                      </View>

                      <Text variant="caption" color={colors.muted}>
                        {formatDate(item.startsAt)}
                      </Text>
                    </View>

                    {/* Title */}
                    <Text
                      variant="heading"
                      color={colors.text}
                      weight="bold"
                      style={styles.announcementTitle}
                    >
                      {item.title}
                    </Text>

                    {/* Body */}
                    <Text
                      variant="body"
                      color={colors.textSecondary}
                      style={styles.announcementBody}
                      numberOfLines={isExpanded ? undefined : 2}
                    >
                      {item.body}
                    </Text>

                    {/* Footer Row */}
                    <View style={styles.cardFooter}>
                      <View style={styles.expandPrompt}>
                        <Text variant="caption" color={colors.indigoSoft}>
                          {isExpanded ? 'Collapse' : 'Read details'}
                        </Text>
                        {isExpanded ? (
                          <ChevronUp size={13} color={colors.indigoSoft} strokeWidth={2} />
                        ) : (
                          <ChevronDown size={13} color={colors.indigoSoft} strokeWidth={2} />
                        )}
                      </View>

                      {item.isRead ? (
                        <View style={styles.readStatus}>
                          <CheckCheck size={13} color={colors.muted} strokeWidth={2} />
                          <Text variant="caption" color={colors.muted}>
                            Read
                          </Text>
                        </View>
                      ) : (
                        <Badge label="MARK READ" tone="indigo" size="sm" dot />
                      )}
                    </View>
                  </Card>
                );
              })}
            </View>
          )}
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingBottom: spacing.xxl,
    gap: spacing.md,
  },
  containerWide: {
    maxWidth: 680,
    alignSelf: 'center',
    width: '100%',
  },
  filterBar: {
    marginBottom: spacing.xs,
  },
  filterScroll: {
    flexDirection: 'row',
    gap: 8,
    paddingVertical: 2,
  },
  filterPill: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: radii.full,
    backgroundColor: 'rgba(20, 23, 39, 0.65)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    backgroundColor: 'rgba(89, 101, 242, 0.16)',
    borderColor: 'rgba(133, 145, 255, 0.45)',
  },
  listContainer: {
    gap: spacing.md,
  },
  loadingContainer: {
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  skeletonSpacer: {
    height: spacing.sm,
  },
  card: {
    borderRadius: radii.lg,
  },
  cardPinned: {
    borderWidth: 1.2,
    borderColor: 'rgba(245, 199, 107, 0.38)',
  },
  cardUnread: {
    borderWidth: 1.2,
    borderColor: 'rgba(89, 101, 242, 0.35)',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  badgeGroup: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unreadBeacon: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.info,
  },
  announcementTitle: {
    marginBottom: 6,
    fontSize: 16,
    lineHeight: 22,
  },
  announcementBody: {
    lineHeight: 21,
    marginBottom: spacing.md,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(184, 190, 255, 0.08)',
  },
  expandPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  readStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    marginVertical: spacing.md,
    borderRadius: radii.xl,
  },
  emptyIconWrapper: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: 'rgba(89, 101, 242, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(89, 101, 242, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  emptyTitle: {
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    maxWidth: 300,
    lineHeight: 20,
  },
});
