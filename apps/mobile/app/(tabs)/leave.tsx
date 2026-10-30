import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  View,
  StyleSheet,
  ScrollView,
  TextInput,
  Modal,
  RefreshControl,
  TouchableOpacity,
  Alert,
  AppState,
  AppStateStatus,
} from 'react-native';
import {
  CalendarCheck,
  Calendar as CalendarIcon,
  ChevronRight,
  Clock,
  Plus,
  CheckCircle2,
  AlertCircle,
  User,
  Check,
  X,
  Sparkles,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import {
  Screen,
  PageHeader,
  Card,
  Badge,
  Button,
  Text,
  PressableScale,
  Skeleton,
  Calendar,
} from '../../src/components';
import { useToast } from '../../src/components/Toast';
import { colors, fonts, radii, spacing, type Tone } from '../../src/theme/tokens';
import { useResponsive } from '../../src/lib/responsive';
import { useAuth } from '../../src/context/AuthContext';
import {
  leaveApi,
  LeaveTypeItem,
  LeaveBalanceItem,
  LeaveRequestItem,
  CreateLeaveRequestPayload,
  ApiError,
  subscribeToSocketEvent,
  subscribeToResync,
} from '../../src/services';

type TabMode = 'overview' | 'my-requests' | 'review-queue';
type StatusFilter = 'ALL' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

function formatDateDisplay(isoString: string): string {
  try {
    const parts = isoString.split('-');
    if (parts.length === 3) {
      const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
      return d.toLocaleDateString(undefined, {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
    }
    const d = new Date(isoString);
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return isoString;
  }
}


const DEFAULT_LEAVE_TYPES: LeaveTypeItem[] = [
  {
    _id: '6ae317bd1dae01ec3c4d1cec',
    name: 'Casual Leave',
    code: 'CL',
    paid: true,
    annualQuota: 12,
    halfDayAllowed: true,
    description: 'Casual leave for personal or urgent matters',
    isActive: true,
  },
  {
    _id: '6ae317be1dae01ec3c4d1cf2',
    name: 'Sick Leave',
    code: 'SL',
    paid: true,
    annualQuota: 10,
    halfDayAllowed: true,
    description: 'Medical and health leave',
    isActive: true,
  },
  {
    _id: '6ae317bf1dae01ec3c4d1cf8',
    name: 'Annual Leave',
    code: 'AL',
    paid: true,
    annualQuota: 15,
    halfDayAllowed: false,
    description: 'Privileged earned time off',
    isActive: true,
  },
  {
    _id: '6ae317c11dae01ec3c4d1cff',
    name: 'Earned Leave',
    code: 'EL',
    paid: true,
    annualQuota: 18,
    halfDayAllowed: false,
    description: 'Privileged earned time off',
    isActive: true,
  },
  {
    _id: '6ae317c21dae01ec3c4d1d05',
    name: 'Maternity/Paternity',
    code: 'ML',
    paid: true,
    annualQuota: 84,
    halfDayAllowed: false,
    description: 'Parental care time off',
    isActive: true,
  },
  {
    _id: '6ae317c31dae01ec3c4d1d0b',
    name: 'Unpaid Leave (LWP)',
    code: 'UL',
    paid: false,
    annualQuota: 30,
    halfDayAllowed: true,
    description: 'Leave without pay',
    isActive: true,
  },
];

export default function LeaveScreen() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const { isWide } = useResponsive();

  const isHrOrAdmin = Boolean(
    user?.role === 'HR' || user?.role === 'ADMIN' || user?.role === 'HR_ADMIN'
  );

  const [activeTab, setActiveTab] = useState<TabMode>('overview');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Leave Data
  const [leaveTypes, setLeaveTypes] = useState<LeaveTypeItem[]>([]);
  const [balances, setBalances] = useState<LeaveBalanceItem[]>([]);
  const [myRequests, setMyRequests] = useState<LeaveRequestItem[]>([]);
  const [teamRequests, setTeamRequests] = useState<LeaveRequestItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');

  // Application Modal State
  const [isApplyModalOpen, setIsApplyModalOpen] = useState(false);
  const [selectedTypeId, setSelectedTypeId] = useState<string>('');
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [isHalfDay, setIsHalfDay] = useState(false);
  const [halfDayType, setHalfDayType] = useState<'FIRST_HALF' | 'SECOND_HALF'>('FIRST_HALF');
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Calendar picker state
  const [calendarPickerTarget, setCalendarPickerTarget] = useState<'start' | 'end' | null>(null);
  const [pickerMonth, setPickerMonth] = useState<Date>(() => new Date());

  // Decision Modal State (for HR/Admin)
  const [decisionModalTarget, setDecisionModalTarget] = useState<{
    id: string;
    action: 'APPROVED' | 'REJECTED';
    employeeName: string;
  } | null>(null);
  const [decisionNote, setDecisionNote] = useState('');
  const [deciding, setDeciding] = useState(false);

  const latestFetchRef = useRef<number>(0);

  const fetchLeaveData = useCallback(async () => {
    const timestamp = Date.now();
    latestFetchRef.current = timestamp;

    try {
      const [typesRes, balancesRes, myReqsRes, allReqsRes] = await Promise.all([
        leaveApi.getLeaveTypes().catch(() => ({ success: false, data: [] as LeaveTypeItem[] })),
        leaveApi.getMyBalances().catch(() => ({ success: false, data: [] as LeaveBalanceItem[] })),
        leaveApi.getMyRequests({ limit: 50 }).catch(() => ({ success: false, data: [] as LeaveRequestItem[], requests: [] as LeaveRequestItem[] })),
        isHrOrAdmin
          ? leaveApi.getAllRequests({ limit: 50 }).catch(() => ({ success: false, data: [] as LeaveRequestItem[], requests: [] as LeaveRequestItem[] }))
          : Promise.resolve({ success: false, data: [] as LeaveRequestItem[], requests: [] as LeaveRequestItem[] }),
      ]);

      if (timestamp < latestFetchRef.current) return;

      if (typesRes?.success && Array.isArray(typesRes.data)) {
        setLeaveTypes(typesRes.data);
      }

      // Safe Extraction for Balances
      let extractedBalances: LeaveBalanceItem[] = [];
      if (balancesRes?.success && balancesRes?.data) {
        if (Array.isArray(balancesRes.data)) {
          extractedBalances = balancesRes.data;
        } else if ('balances' in balancesRes.data && Array.isArray(balancesRes.data.balances)) {
          extractedBalances = balancesRes.data.balances;
        }
      }
      setBalances(extractedBalances);

      // Safe Extraction for My Requests
      const myReqs = Array.isArray(myReqsRes?.data)
        ? myReqsRes.data
        : Array.isArray(myReqsRes?.requests)
          ? myReqsRes.requests
          : [];
      setMyRequests(myReqs);

      if (isHrOrAdmin) {
        const teamReqs = Array.isArray(allReqsRes?.data)
          ? allReqsRes.data
          : Array.isArray(allReqsRes?.requests)
            ? allReqsRes.requests
            : [];
        setTeamRequests(teamReqs);
      }
    } catch (err) {
      console.error('Failed to load leave data:', err);
    } finally {
      if (timestamp >= latestFetchRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [isHrOrAdmin]);

  useEffect(() => {
    fetchLeaveData();

    const unsubRequested = subscribeToSocketEvent('leave.requested', () => {
      fetchLeaveData();
    });

    const unsubDecided = subscribeToSocketEvent('leave.decided', (rawPayload: unknown) => {
      const payload = rawPayload as {
        requestId?: string;
        status?: 'APPROVED' | 'REJECTED';
        decisionNote?: string;
      };

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      showToast({
        title: payload?.status === 'APPROVED' ? 'Leave Request Approved!' : 'Leave Request Decided',
        message: `Your leave application has been ${payload?.status?.toLowerCase() || 'updated'}.`,
        type: payload?.status === 'APPROVED' ? 'success' : 'info',
      });

      fetchLeaveData();
    });

    const unsubBalance = subscribeToSocketEvent('leave.balance_updated', () => {
      fetchLeaveData();
    });

    const unsubResync = subscribeToResync(() => fetchLeaveData());

    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') fetchLeaveData();
    });

    return () => {
      unsubRequested();
      unsubDecided();
      unsubBalance();
      unsubResync();
      appStateSub.remove();
    };
  }, [fetchLeaveData, showToast]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchLeaveData();
  }, [fetchLeaveData]);

  // Handle Apply Submission
  const handleApplyLeave = async () => {
    setFormError(null);
    if (!selectedTypeId) {
      setFormError('Please select a leave type.');
      return;
    }

    const start = startDate.trim();
    const end = isHalfDay ? start : endDate.trim();

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(start) || !dateRegex.test(end)) {
      setFormError('Dates must follow YYYY-MM-DD format (e.g. 2026-11-05).');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (start < todayStr) {
      setFormError('Leave requests cannot be submitted for past dates.');
      return;
    }

    if (start > end) {
      setFormError('Start date cannot be after end date.');
      return;
    }

    if (!reason.trim() || reason.trim().length < 5) {
      setFormError('Please provide a reason (at least 5 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const resolvedType =
        activeLeaveTypeForForm?._id && activeLeaveTypeForForm._id.length === 24
          ? activeLeaveTypeForForm._id
          : (activeLeaveTypeForForm?.code || selectedTypeId);

      const payload: CreateLeaveRequestPayload = {
        type: resolvedType,
        startDate: start,
        endDate: end,
        isHalfDay,
        halfDayType: isHalfDay ? halfDayType : undefined,
        reason: reason.trim(),
      };

      await leaveApi.applyLeave(payload);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      showToast({
        title: 'Leave Submitted',
        message: 'Your leave application is submitted and pending HR review.',
        type: 'success',
      });
      setIsApplyModalOpen(false);
      setReason('');
      setIsHalfDay(false);
      fetchLeaveData();
    } catch (err: unknown) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      if (err instanceof ApiError) {
        setFormError(err.message || 'Failed to apply for leave.');
      } else {
        setFormError('Unable to connect to leave service.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Cancel Request
  const handleCancelRequest = (id: string, dateInfo: string) => {
    Alert.alert(
      'Cancel Leave Request',
      `Are you sure you want to cancel your leave request for ${dateInfo}?`,
      [
        { text: 'No', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveApi.cancelLeave(id, 'Cancelled by employee');
              void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
              showToast({
                title: 'Request Cancelled',
                message: 'Your leave request has been cancelled.',
                type: 'info',
              });
              fetchLeaveData();
            } catch (err: unknown) {
              const msg = err instanceof ApiError ? err.message : 'Failed to cancel leave request.';
              Alert.alert('Cancellation Error', msg);
            }
          },
        },
      ]
    );
  };

  // Handle HR Decision Submission
  const handleConfirmDecision = async () => {
    if (!decisionModalTarget) return;
    setDeciding(true);
    try {
      await leaveApi.decideRequest(
        decisionModalTarget.id,
        decisionModalTarget.action,
        decisionNote.trim() || undefined
      );

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      showToast({
        title: `Request ${decisionModalTarget.action === 'APPROVED' ? 'Approved' : 'Rejected'}`,
        message: `Leave request for ${decisionModalTarget.employeeName} has been decided.`,
        type: decisionModalTarget.action === 'APPROVED' ? 'success' : 'info',
      });

      setDecisionModalTarget(null);
      setDecisionNote('');
      fetchLeaveData();
    } catch (err: unknown) {
      const msg = err instanceof ApiError ? err.message : 'Failed to submit decision.';
      Alert.alert('Decision Error', msg);
    } finally {
      setDeciding(false);
    }
  };

  const getStatusTone = (status: string): Tone => {
    switch (status) {
      case 'APPROVED':
        return 'success';
      case 'PENDING':
        return 'warning';
      case 'REJECTED':
        return 'danger';
      case 'CANCELLED':
      default:
        return 'neutral';
    }
  };

    // Comprehensive list of available leave types with corporate fallbacks
  const availableLeaveTypes = useMemo<LeaveTypeItem[]>(() => {
    const list: LeaveTypeItem[] = [];
    const seen = new Set<string>();

    // 1. From leaveTypes state (fetched from backend)
    for (const lt of leaveTypes) {
      if (lt && (lt._id || lt.code)) {
        const key = (lt.code || lt._id).toUpperCase();
        if (!seen.has(key)) {
          seen.add(key);
          list.push(lt);
        }
      }
    }

    // 2. From balances state (in case types were embedded in balances)
    const balList = Array.isArray(balances) ? balances : [];
    for (const b of balList) {
      if (b?.type && typeof b.type === 'object') {
        const bType = b.type as LeaveTypeItem;
        const code = (bType.code || 'LEAVE').toUpperCase();
        if (!seen.has(code)) {
          seen.add(code);
          list.push({
            _id: bType._id || code,
            name: bType.name || code,
            code,
            paid: bType.paid ?? true,
            annualQuota: b.allotted || 12,
            halfDayAllowed: true,
            isActive: true,
          });
        }
      }
    }

    // 3. Fallback to standard corporate defaults if none loaded yet
    if (list.length === 0) {
      return DEFAULT_LEAVE_TYPES;
    }

    return list;
  }, [leaveTypes, balances]);

  // Synchronize default selected type
  useEffect(() => {
    if (availableLeaveTypes.length > 0) {
      const exists = availableLeaveTypes.some(
        (t) => t._id === selectedTypeId || t.code === selectedTypeId
      );
      if (!exists || !selectedTypeId) {
        setSelectedTypeId(availableLeaveTypes[0]._id || availableLeaveTypes[0].code);
      }
    }
  }, [availableLeaveTypes, selectedTypeId]);

  // Balances to display (safe fallback if backend balance list is empty)
  const displayBalances = useMemo<LeaveBalanceItem[]>(() => {
    const list = Array.isArray(balances) ? balances : [];
    if (list.length > 0) return list;

    return availableLeaveTypes.map((lt) => ({
      id: lt._id,
      _id: lt._id,
      type: lt,
      allotted: lt.annualQuota || 12,
      used: 0,
      pending: 0,
      carriedOver: 0,
      available: lt.annualQuota || 12,
    }));
  }, [balances, availableLeaveTypes]);

  // Aggregated Balance Metrics
  const balanceMetrics = useMemo(() => {
    let totalAllotted = 0;
    let totalUsed = 0;
    let totalPending = 0;

    displayBalances.forEach((b) => {
      totalAllotted += (b.allotted || 0) + (b.carriedOver || 0);
      totalUsed += b.used || 0;
      totalPending += b.pending || 0;
    });

    const totalAvailable = Math.max(0, totalAllotted - totalUsed - totalPending);
    return {
      available: totalAvailable,
      allotted: totalAllotted,
      used: totalUsed,
      pending: totalPending,
    };
  }, [displayBalances]);

  // Filtered Requests
  const filteredMyRequests = useMemo(() => {
    if (statusFilter === 'ALL') return myRequests;
    return myRequests.filter((r) => r.status === statusFilter);
  }, [myRequests, statusFilter]);

  const pendingTeamRequests = useMemo(() => {
    return teamRequests.filter((r) => r.status === 'PENDING');
  }, [teamRequests]);

  const activeLeaveTypeForForm = useMemo(() => {
    return availableLeaveTypes.find((t) => t._id === selectedTypeId || t.code === selectedTypeId);
  }, [availableLeaveTypes, selectedTypeId]);

  return (
    <Screen
      refreshControl={
        <RefreshControl
          colors={[colors.indigoSoft]}
          onRefresh={onRefresh}
          refreshing={refreshing}
          tintColor={colors.indigoSoft}
        />
      }
    >
      <PageHeader
        title="Leave Management"
      />

      <View style={[styles.container, isWide && styles.containerWide]}>
        {/* Navigation Tabs (Overview / My Requests / Team Review) */}
        <View style={styles.segmentWrapper}>
          <View style={styles.segmentedControl}>
            <PressableScale
              onPress={() => setActiveTab('overview')}
              style={[
                styles.segmentButton,
                activeTab === 'overview' && styles.segmentButtonActive,
              ]}
            >
              <CalendarCheck
                size={14}
                color={activeTab === 'overview' ? colors.white : colors.muted}
                strokeWidth={2}
              />
              <Text
                variant="caption"
                weight={activeTab === 'overview' ? 'bold' : 'medium'}
                color={activeTab === 'overview' ? colors.white : colors.muted}
              >
                Balances
              </Text>
            </PressableScale>

            <PressableScale
              onPress={() => setActiveTab('my-requests')}
              style={[
                styles.segmentButton,
                activeTab === 'my-requests' && styles.segmentButtonActive,
              ]}
            >
              <Clock
                size={14}
                color={activeTab === 'my-requests' ? colors.white : colors.muted}
                strokeWidth={2}
              />
              <Text
                variant="caption"
                weight={activeTab === 'my-requests' ? 'bold' : 'medium'}
                color={activeTab === 'my-requests' ? colors.white : colors.muted}
              >
                My Leaves ({myRequests.length})
              </Text>
            </PressableScale>

            {isHrOrAdmin && (
              <PressableScale
                onPress={() => setActiveTab('review-queue')}
                style={[
                  styles.segmentButton,
                  activeTab === 'review-queue' && styles.segmentButtonActive,
                ]}
              >
                <Sparkles
                  size={14}
                  color={activeTab === 'review-queue' ? colors.white : colors.warning}
                  strokeWidth={2}
                />
                <Text
                  variant="caption"
                  weight={activeTab === 'review-queue' ? 'bold' : 'medium'}
                  color={activeTab === 'review-queue' ? colors.white : colors.warning}
                >
                  Review ({pendingTeamRequests.length})
                </Text>
              </PressableScale>
            )}
          </View>
        </View>

        {/* ================================================================= */}
        {/* TAB 1: OVERVIEW & BALANCES */}
        {/* ================================================================= */}
        {activeTab === 'overview' && (
          <View style={styles.tabContent}>
            {/* 1. Global Quota Summary Card */}
            <Card variant="raised" padding={spacing.lg} style={styles.quotaSummaryCard}>
              <View style={styles.quotaSummaryHeader}>
                <View style={styles.quotaTitleBlock}>
                  <Text variant="subheading" weight="bold">
                    Leave Entitlement
                  </Text>
                </View>

                <Button
                  label="Apply"
                  size="sm"
                  variant="primary"
                  fullWidth={false}
                  icon={<Plus size={14} color={colors.white} strokeWidth={2.4} />}
                  onPress={() => {
                    if (availableLeaveTypes.length > 0 && !selectedTypeId) {
                      setSelectedTypeId(availableLeaveTypes[0]._id || availableLeaveTypes[0].code);
                    }
                    setIsApplyModalOpen(true);
                  }}
                  style={styles.applyTopBtn}
                />
              </View>

              {/* Numbers Row */}
              <View style={styles.metricsRow}>
                <View style={styles.metricBox}>
                  <Text variant="number" color={colors.success}>
                    {balanceMetrics.available}
                  </Text>
                  <Text variant="small" color={colors.muted}>
                    Available
                  </Text>
                </View>
                <View style={styles.vDivider} />
                <View style={styles.metricBox}>
                  <Text variant="number" color={colors.info}>
                    {balanceMetrics.used}
                  </Text>
                  <Text variant="small" color={colors.muted}>
                    Used
                  </Text>
                </View>
                <View style={styles.vDivider} />
                <View style={styles.metricBox}>
                  <Text variant="number" color={colors.warning}>
                    {balanceMetrics.pending}
                  </Text>
                  <Text variant="small" color={colors.muted}>
                    Pending
                  </Text>
                </View>
              </View>
            </Card>

            {/* 2. Leave Types Breakdown */}
            <View style={styles.sectionHeaderRow}>
              <Text variant="caption" weight="bold" color={colors.textSecondary} style={styles.sectionTitle}>
                LEAVE CATEGORIES & QUOTAS
              </Text>
            </View>

            {loading && !refreshing ? (
              <View style={styles.skeletonGrid}>
                {[1, 2, 3, 4].map((i) => (
                  <Card key={i} variant="glass" padding={spacing.md} style={styles.skeletonCard}>
                    <Skeleton width="40%" height={14} borderRadius={radii.xs} />
                    <View style={styles.spacerSm} />
                    <Skeleton width="70%" height={24} borderRadius={radii.xs} />
                    <View style={styles.spacerSm} />
                    <Skeleton width="100%" height={12} borderRadius={radii.xs} />
                  </Card>
                ))}
              </View>
            ) : displayBalances.length === 0 ? (
              <Card variant="glass" padding={spacing.xl} style={styles.emptyCard}>
                <CalendarCheck size={36} color={colors.indigoSoft} strokeWidth={1.8} />
                <Text variant="subheading" color={colors.text} style={styles.emptyTitle}>
                  No Leave Types Assigned
                </Text>
                <Text variant="caption" color={colors.muted} style={styles.emptyDesc}>
                  Your department quotas or leave rules will appear here once allocated by HR.
                </Text>
              </Card>
            ) : (
              <View style={styles.typeCardsGrid}>
                {displayBalances.map((item, idx) => {
                  const typeObj = item.type;
                  const total = (item.allotted || 0) + (item.carriedOver || 0);
                  const rem = Math.max(0, total - (item.used || 0) - (item.pending || 0));

                  return (
                    <Card
                      key={item._id || item.id || String(idx)}
                      variant="glass"
                      padding={spacing.md}
                      style={styles.leaveTypeCard}
                    >
                      <View style={styles.typeCardHeader}>
                        <View style={styles.typeCodeBadge}>
                          <Text variant="mono" weight="bold" style={styles.typeCodeText}>
                            {typeObj?.code || 'LV'}
                          </Text>
                        </View>
                        <Badge
                          label={typeObj?.paid ? 'PAID' : 'UNPAID'}
                          tone={typeObj?.paid ? 'success' : 'neutral'}
                          size="sm"
                        />
                      </View>

                      <Text variant="body" weight="bold" color={colors.text} numberOfLines={1}>
                        {typeObj?.name || 'Leave Category'}
                      </Text>

                      <View style={styles.typeRemRow}>
                        <Text variant="title" weight="bold" color={colors.text}>
                          {rem}
                        </Text>
                        <Text variant="small" color={colors.muted}>
                          days left of {total}
                        </Text>
                      </View>

                      <View style={styles.typeCardFooter}>
                        <Text variant="small" color={colors.muted}>
                          Used: {item.used || 0}d • Pending: {item.pending || 0}d
                        </Text>
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ================================================================= */}
        {/* TAB 2: MY LEAVE REQUESTS */}
        {/* ================================================================= */}
        {activeTab === 'my-requests' && (
          <View style={styles.requestsContainer}>
            {/* Status Filter Chips */}
            <View style={styles.filterScrollWrapper}>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.filterPillsScroll}
              >
                {(['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'CANCELLED'] as const).map((st) => {
                  const isActive = statusFilter === st;
                  return (
                    <PressableScale
                      key={st}
                      onPress={() => setStatusFilter(st)}
                      style={[styles.filterPill, isActive && styles.filterPillActive]}
                    >
                      <Text
                        variant="caption"
                        color={isActive ? colors.text : colors.muted}
                        weight={isActive ? 'bold' : 'medium'}
                      >
                        {st.replace('_', ' ')}
                      </Text>
                    </PressableScale>
                  );
                })}
              </ScrollView>
            </View>

            {loading && !refreshing ? (
              <View style={styles.skeletonList}>
                {[1, 2, 3].map((k) => (
                  <Card key={k} variant="glass" padding={spacing.lg} style={styles.skeletonListItem}>
                    <Skeleton width="30%" height={14} borderRadius={radii.xs} />
                    <View style={styles.spacerSm} />
                    <Skeleton width="60%" height={18} borderRadius={radii.xs} />
                    <View style={styles.spacerSm} />
                    <Skeleton width="80%" height={12} borderRadius={radii.xs} />
                  </Card>
                ))}
              </View>
            ) : filteredMyRequests.length === 0 ? (
              <Card variant="glass" padding={spacing.xl} style={styles.emptyCard}>
                <Clock size={36} color={colors.indigoSoft} strokeWidth={1.8} />
                <Text variant="subheading" color={colors.text} style={styles.emptyTitle}>
                  No Leave Requests Found
                </Text>
                <Text variant="caption" color={colors.muted} style={styles.emptyDesc}>
                  {statusFilter === 'ALL'
                    ? 'You have not submitted any leave applications yet.'
                    : `No applications found with status '${statusFilter}'.`}
                </Text>
                <Button
                  label="Apply for Time-Off"
                  size="sm"
                  variant="primary"
                  fullWidth={false}
                  icon={<Plus size={14} color={colors.white} strokeWidth={2.4} />}
                  onPress={() => {
                    if (availableLeaveTypes.length > 0 && !selectedTypeId) {
                      setSelectedTypeId(availableLeaveTypes[0]._id || availableLeaveTypes[0].code);
                    }
                    setIsApplyModalOpen(true);
                  }}
                  style={styles.emptyActionBtn}
                />
              </Card>
            ) : (
              <View style={styles.requestsList}>
                {filteredMyRequests.map((item) => {
                  const typeName =
                    typeof item.type === 'object' && item.type ? item.type.name : 'Leave';
                  const dateInfo =
                    item.startDate === item.endDate
                      ? formatDateDisplay(item.startDate)
                      : `${formatDateDisplay(item.startDate)} → ${formatDateDisplay(item.endDate)}`;

                  const daysLabel = item.isHalfDay
                    ? `0.5 Day (${item.halfDayType === 'SECOND_HALF' ? '2nd Half' : '1st Half'})`
                    : `${item.workingDays} ${item.workingDays === 1 ? 'Day' : 'Days'}`;

                  return (
                    <Card key={item._id} variant="glass" padding={spacing.lg} style={styles.requestCard}>
                      <View style={styles.requestHeader}>
                        <View style={styles.requestTypeBadge}>
                          <Text variant="small" weight="bold" color={colors.indigoSoft}>
                            {typeName}
                          </Text>
                          <Text variant="small" color={colors.muted}>
                            • {daysLabel}
                          </Text>
                        </View>
                        <Badge
                          label={item.status}
                          tone={getStatusTone(item.status)}
                          size="sm"
                          dot
                        />
                      </View>

                      <Text variant="body" weight="semibold" color={colors.text} style={styles.dateRangeText}>
                        {dateInfo}
                      </Text>

                      <Text variant="small" color={colors.textSecondary} style={styles.reasonText}>
                        "{item.reason}"
                      </Text>

                      {/* Decision Note from Reviewer */}
                      {item.decisionNote ? (
                        <View style={styles.decisionNoteBox}>
                          <Text variant="small" color={colors.muted}>
                            HR Note: "{item.decisionNote}"
                          </Text>
                        </View>
                      ) : null}

                      {/* Action to Cancel if Pending */}
                      {item.status === 'PENDING' && (
                        <View style={styles.requestFooterRow}>
                          <PressableScale
                            onPress={() => handleCancelRequest(item._id, dateInfo)}
                            style={styles.cancelRequestBtn}
                          >
                            <X size={13} color={colors.danger} strokeWidth={2.4} />
                            <Text variant="small" weight="bold" color={colors.danger}>
                              Cancel Application
                            </Text>
                          </PressableScale>
                        </View>
                      )}
                    </Card>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {/* ================================================================= */}
        {/* TAB 3: HR / ADMIN REVIEW QUEUE */}
        {/* ================================================================= */}
        {activeTab === 'review-queue' && isHrOrAdmin && (
          <View style={styles.requestsContainer}>
            <View style={styles.reviewQueueHeader}>
              <Text variant="caption" weight="bold" color={colors.warning}>
                PENDING TEAM APPROVALS ({pendingTeamRequests.length})
              </Text>
            </View>

            {pendingTeamRequests.length === 0 ? (
              <Card variant="glass" padding={spacing.xl} style={styles.emptyCard}>
                <CheckCircle2 size={36} color={colors.success} strokeWidth={1.8} />
                <Text variant="subheading" color={colors.text} style={styles.emptyTitle}>
                  All Caught Up!
                </Text>
                <Text variant="caption" color={colors.muted} style={styles.emptyDesc}>
                  There are no pending team leave requests awaiting review.
                </Text>
              </Card>
            ) : (
              <View style={styles.requestsList}>
                {pendingTeamRequests.map((item) => {
                  const empName =
                    typeof item.employee === 'object' && item.employee?.name
                      ? item.employee.name
                      : typeof item.employee === 'object' && item.employee?.employeeId
                        ? item.employee.employeeId
                        : 'Employee';

                  const typeName =
                    typeof item.type === 'object' && item.type ? item.type.name : 'Leave';

                  const dateInfo =
                    item.startDate === item.endDate
                      ? formatDateDisplay(item.startDate)
                      : `${formatDateDisplay(item.startDate)} → ${formatDateDisplay(item.endDate)}`;

                  const daysLabel = item.isHalfDay
                    ? `0.5 Day (${item.halfDayType === 'SECOND_HALF' ? '2nd Half' : '1st Half'})`
                    : `${item.workingDays} Days`;

                  return (
                    <Card key={item._id} variant="glass" padding={spacing.lg} style={styles.reviewCard}>
                      <View style={styles.reviewTopRow}>
                        <View style={styles.reviewEmpInfo}>
                          <View style={styles.empAvatarCircle}>
                            <User size={14} color={colors.indigoSoft} strokeWidth={2} />
                          </View>
                          <View>
                            <Text variant="body" weight="bold" color={colors.text}>
                              {empName}
                            </Text>
                            <Text variant="small" color={colors.muted}>
                              {typeName} • {daysLabel}
                            </Text>
                          </View>
                        </View>
                        <Badge label="PENDING" tone="warning" size="sm" dot />
                      </View>

                      <Text variant="body" weight="semibold" color={colors.indigoSoft} style={styles.dateRangeText}>
                        {dateInfo}
                      </Text>

                      <Text variant="small" color={colors.textSecondary} style={styles.reasonText}>
                        "{item.reason}"
                      </Text>

                      {/* Decision Buttons */}
                      <View style={styles.decisionButtonsRow}>
                        <Button
                          label="Reject"
                          size="sm"
                          variant="secondary"
                          icon={<X size={14} color={colors.danger} strokeWidth={2.4} />}
                          onPress={() => {
                            setDecisionModalTarget({
                              id: item._id,
                              action: 'REJECTED',
                              employeeName: empName,
                            });
                          }}
                          style={{ flex: 1 }}
                        />
                        <Button
                          label="Approve"
                          size="sm"
                          variant="primary"
                          icon={<Check size={14} color={colors.white} strokeWidth={2.4} />}
                          onPress={() => {
                            setDecisionModalTarget({
                              id: item._id,
                              action: 'APPROVED',
                              employeeName: empName,
                            });
                          }}
                          style={{ flex: 1.3 }}
                        />
                      </View>
                    </Card>
                  );
                })}
              </View>
            )}
          </View>
        )}
      </View>

      {/* =================================================================== */}
      {/* APPLY FOR LEAVE MODAL */}
      {/* =================================================================== */}
      <Modal
        visible={isApplyModalOpen}
        animationType="slide"
        transparent
        onRequestClose={() => setIsApplyModalOpen(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text variant="subheading" weight="bold">
                  Apply for Time-Off
                </Text>
              </View>
              <PressableScale onPress={() => setIsApplyModalOpen(false)} style={styles.closeModalBtn}>
                <X size={18} color={colors.muted} strokeWidth={2.2} />
              </PressableScale>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.formScroll}>
              {formError && (
                <View style={styles.formErrorBox}>
                  <AlertCircle size={15} color={colors.danger} strokeWidth={2} />
                  <Text variant="small" color={colors.danger} style={{ flex: 1 }}>
                    {formError}
                  </Text>
                </View>
              )}

              {/* Leave Type Selector */}
              <View style={styles.formField}>
                <View style={styles.fieldLabelRow}>
                  <Text variant="caption" weight="bold" color={colors.textSecondary} style={styles.fieldLabel}>
                    LEAVE CATEGORY
                  </Text>
                </View>

                <View style={styles.categoriesWrapGrid}>
                  {availableLeaveTypes.map((lt) => {
                    const isSelected =
                      selectedTypeId === lt._id ||
                      selectedTypeId === lt.code;
                    return (
                      <PressableScale
                        key={lt._id || lt.code}
                        onPress={() => {
                          setSelectedTypeId(lt._id || lt.code);
                          if (!lt.halfDayAllowed && isHalfDay) {
                            setIsHalfDay(false);
                          }
                        }}
                        style={[
                          styles.categoryChoiceCard,
                          isSelected && styles.categoryChoiceCardSelected,
                        ]}
                      >
                        <View style={styles.choiceCardHeader}>
                          <View
                            style={[
                              styles.choiceCodeTag,
                              isSelected && styles.choiceCodeTagSelected,
                            ]}
                          >
                            <Text
                              variant="caption"
                              weight="bold"
                              color={isSelected ? colors.white : colors.textSecondary}
                            >
                              {lt.code}
                            </Text>
                          </View>
                          <View
                            style={[
                              styles.choiceCheckCircle,
                              isSelected && styles.choiceCheckCircleSelected,
                            ]}
                          >
                            {isSelected && <Check size={10} color={colors.white} strokeWidth={3} />}
                          </View>
                        </View>

                        <Text
                          variant="caption"
                          weight={isSelected ? 'bold' : 'medium'}
                          color={isSelected ? colors.white : colors.textSecondary}
                          numberOfLines={1}
                          style={styles.choiceNameText}
                        >
                          {lt.name}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </View>

              {/* Start Date */}
              <View style={styles.formField}>
                <Text variant="caption" weight="bold" color={colors.textSecondary} style={styles.fieldLabel}>
                  START DATE
                </Text>
                <PressableScale
                  onPress={() => {
                    void Haptics.selectionAsync().catch(() => undefined);
                    try {
                      setPickerMonth(new Date(startDate + 'T00:00:00'));
                    } catch {
                      setPickerMonth(new Date());
                    }
                    setCalendarPickerTarget('start');
                  }}
                  style={styles.dateSelectorBtn}
                  accessibilityRole="button"
                  accessibilityLabel="Choose start date from calendar"
                >
                  <View style={styles.dateSelectorLeft}>
                    <View style={styles.calendarIconBubble}>
                      <CalendarIcon size={16} color={colors.indigoSoft} strokeWidth={2.2} />
                    </View>
                    <Text variant="body" weight="medium" color={colors.text}>
                      {formatDateDisplay(startDate)}
                    </Text>
                  </View>

                  <View style={styles.dateSelectorBadge}>
                    <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2.2} />
                  </View>
                </PressableScale>
              </View>

              {/* End Date (if not half-day) */}
              {!isHalfDay && (
                <View style={styles.formField}>
                  <Text variant="caption" weight="bold" color={colors.textSecondary} style={styles.fieldLabel}>
                    END DATE
                  </Text>
                  <PressableScale
                    onPress={() => {
                      void Haptics.selectionAsync().catch(() => undefined);
                      try {
                        setPickerMonth(new Date(endDate + 'T00:00:00'));
                      } catch {
                        setPickerMonth(new Date());
                      }
                      setCalendarPickerTarget('end');
                    }}
                    style={styles.dateSelectorBtn}
                    accessibilityRole="button"
                    accessibilityLabel="Choose end date from calendar"
                  >
                    <View style={styles.dateSelectorLeft}>
                      <View style={styles.calendarIconBubble}>
                        <CalendarIcon size={16} color={colors.indigoSoft} strokeWidth={2.2} />
                      </View>
                      <Text variant="body" weight="medium" color={colors.text}>
                        {formatDateDisplay(endDate)}
                      </Text>
                    </View>

                    <View style={styles.dateSelectorBadge}>
                      <ChevronRight size={16} color={colors.textSecondary} strokeWidth={2.2} />
                    </View>
                  </PressableScale>
                </View>
              )}

              {/* Half-Day Toggle (if allowed by selected leave type) */}
              {activeLeaveTypeForForm?.halfDayAllowed && (
                <View style={styles.formField}>
                  <View style={styles.halfDayToggleRow}>
                    <Text variant="body" weight="medium" color={colors.text}>
                      Apply as Half-Day?
                    </Text>
                    <PressableScale
                      onPress={() => setIsHalfDay(!isHalfDay)}
                      style={[
                        styles.toggleSwitch,
                        isHalfDay && styles.toggleSwitchActive,
                      ]}
                    >
                      <View style={[styles.toggleThumb, isHalfDay && styles.toggleThumbActive]} />
                    </PressableScale>
                  </View>

                  {isHalfDay && (
                    <View style={styles.halfDaySegmentRow}>
                      <PressableScale
                        onPress={() => setHalfDayType('FIRST_HALF')}
                        style={[
                          styles.halfDayOption,
                          halfDayType === 'FIRST_HALF' && styles.halfDayOptionActive,
                        ]}
                      >
                        <Text
                          variant="caption"
                          weight={halfDayType === 'FIRST_HALF' ? 'bold' : 'medium'}
                          color={halfDayType === 'FIRST_HALF' ? colors.white : colors.muted}
                        >
                          1st Half (Morning)
                        </Text>
                      </PressableScale>
                      <PressableScale
                        onPress={() => setHalfDayType('SECOND_HALF')}
                        style={[
                          styles.halfDayOption,
                          halfDayType === 'SECOND_HALF' && styles.halfDayOptionActive,
                        ]}
                      >
                        <Text
                          variant="caption"
                          weight={halfDayType === 'SECOND_HALF' ? 'bold' : 'medium'}
                          color={halfDayType === 'SECOND_HALF' ? colors.white : colors.muted}
                        >
                          2nd Half (Afternoon)
                        </Text>
                      </PressableScale>
                    </View>
                  )}
                </View>
              )}

              {/* Reason Input */}
              <View style={styles.formField}>
                <Text variant="caption" weight="bold" color={colors.textSecondary} style={styles.fieldLabel}>
                  JUSTIFICATION / REASON
                </Text>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Reason for leave..."
                  placeholderTextColor={colors.muted}
                  value={reason}
                  onChangeText={setReason}
                  multiline
                  numberOfLines={3}
                  maxLength={500}
                />
              </View>

              {/* Submit Button */}
              <Button
                label="Submit Application"
                size="lg"
                variant="primary"
                loading={submitting}
                icon={<CalendarCheck size={17} color={colors.white} strokeWidth={2.2} />}
                onPress={handleApplyLeave}
                style={styles.submitApplyBtn}
              />
            </ScrollView>
          </View>

          {/* Calendar Date Picker Dialog Overlay */}
          {calendarPickerTarget !== null && (
            <View style={styles.calendarModalOverlay}>
              <View style={styles.datePickerModalCard}>
                <View style={styles.datePickerHeader}>
                  <View style={styles.datePickerHeaderTitleWrap}>
                    <CalendarIcon size={18} color={colors.indigoSoft} strokeWidth={2.2} />
                    <Text variant="subheading" weight="bold" color={colors.text}>
                      {calendarPickerTarget === 'start' ? 'Select Start Date' : 'Select End Date'}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => setCalendarPickerTarget(null)}
                    style={styles.datePickerCloseBtn}
                    accessibilityLabel="Close date picker"
                  >
                    <X size={18} color={colors.textSecondary} strokeWidth={2.2} />
                  </TouchableOpacity>
                </View>

                <View style={styles.calendarContainer}>
                  <Calendar
                    month={pickerMonth}
                    onMonthChange={setPickerMonth}
                    selectedDate={calendarPickerTarget === 'start' ? startDate : endDate}
                    onSelectDate={(dateStr) => {
                      void Haptics.selectionAsync().catch(() => undefined);
                      if (calendarPickerTarget === 'start') {
                        setStartDate(dateStr);
                        if (endDate < dateStr) {
                          setEndDate(dateStr);
                        }
                        setCalendarPickerTarget(null);
                      } else {
                        if (dateStr < startDate) {
                          void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
                          showToast({
                            title: 'Invalid Date Range',
                            message: 'End date cannot be earlier than start date.',
                            type: 'warning',
                          });
                          return;
                        }
                        setEndDate(dateStr);
                        setCalendarPickerTarget(null);
                      }
                    }}
                  />
                </View>
              </View>
            </View>
          )}
        </View>
      </Modal>

      {/* =================================================================== */}
      {/* HR DECISION CONFIRMATION MODAL */}
      {/* =================================================================== */}
      <Modal
        visible={decisionModalTarget !== null}
        animationType="fade"
        transparent
        onRequestClose={() => setDecisionModalTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { maxWidth: 400 }]}>
            <View style={styles.modalHeaderRow}>
              <View>
                <Text variant="subheading" weight="bold">
                  {decisionModalTarget?.action === 'APPROVED' ? 'Approve' : 'Reject'} Request
                </Text>
              </View>
              <PressableScale onPress={() => setDecisionModalTarget(null)} style={styles.closeModalBtn}>
                <X size={18} color={colors.muted} strokeWidth={2.2} />
              </PressableScale>
            </View>

            <Text variant="caption" color={colors.textSecondary} style={{ marginBottom: spacing.sm }}>
              Employee: {decisionModalTarget?.employeeName}
            </Text>

            <TextInput
              style={[styles.textInput, styles.textArea, { minHeight: 80 }]}
              placeholder="Add optional decision note for employee..."
              placeholderTextColor={colors.muted}
              value={decisionNote}
              onChangeText={setDecisionNote}
              multiline
            />

            <View style={styles.decisionModalActions}>
              <Button
                label="Cancel"
                size="sm"
                variant="ghost"
                onPress={() => setDecisionModalTarget(null)}
                style={{ flex: 1 }}
              />
              <Button
                label={decisionModalTarget?.action === 'APPROVED' ? 'Confirm Approval' : 'Confirm Rejection'}
                size="sm"
                variant={decisionModalTarget?.action === 'APPROVED' ? 'primary' : 'danger'}
                loading={deciding}
                onPress={handleConfirmDecision}
                style={{ flex: 1.5 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  containerWide: {
    maxWidth: 720,
    width: '100%',
    alignSelf: 'center',
  },
  segmentWrapper: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  segmentedControl: {
    flexDirection: 'row',
    backgroundColor: 'rgba(20, 23, 39, 0.72)',
    borderRadius: radii.full,
    padding: 4,
    borderWidth: 1,
    borderColor: colors.border,
  },
  segmentButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 9,
    borderRadius: radii.full,
  },
  segmentButtonActive: {
    backgroundColor: colors.indigo,
  },
  tabContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.giant,
    gap: spacing.md,
  },
  quotaSummaryCard: {
    gap: spacing.md,
  },
  quotaSummaryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  quotaTitleBlock: {
    flex: 1,
    gap: 2,
  },
  applyTopBtn: {
    flexShrink: 0,
    alignSelf: 'center',
  },
  metricsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingTop: spacing.xs,
  },
  metricBox: {
    alignItems: 'center',
  },
  vDivider: {
    width: 1,
    height: 36,
    backgroundColor: colors.border,
  },
  sectionHeaderRow: {
    marginTop: spacing.xs,
  },
  sectionTitle: {
    letterSpacing: 0.8,
  },
  skeletonGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  skeletonCard: {
    width: '48%',
  },
  spacerSm: {
    height: spacing.sm,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.xxl,
    gap: spacing.xs,
  },
  emptyTitle: {
    marginTop: spacing.xs,
  },
  emptyDesc: {
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
    marginBottom: spacing.sm,
  },
  emptyActionBtn: {
    minWidth: 160,
  },
  typeCardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  leaveTypeCard: {
    width: '48%',
    gap: spacing.xs,
  },
  typeCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  typeCodeBadge: {
    backgroundColor: 'rgba(89, 101, 242, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(89, 101, 242, 0.3)',
  },
  typeCodeText: {
    color: colors.indigoSoft,
    fontSize: 11,
  },
  typeRemRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 6,
    marginTop: 4,
  },
  typeCardFooter: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 6,
    marginTop: 2,
  },

  // Requests List Styles
  requestsContainer: {
    flex: 1,
  },
  filterScrollWrapper: {
    paddingBottom: spacing.sm,
  },
  filterPillsScroll: {
    paddingHorizontal: spacing.lg,
    gap: spacing.sm,
  },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.full,
    backgroundColor: 'rgba(20, 23, 39, 0.72)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  filterPillActive: {
    borderColor: colors.indigoSoft,
    backgroundColor: 'rgba(89, 101, 242, 0.18)',
  },
  skeletonList: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  skeletonListItem: {
    marginBottom: spacing.xs,
  },
  requestsList: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.giant,
    gap: spacing.md,
  },
  requestCard: {
    gap: spacing.xs,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  requestTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateRangeText: {
    marginTop: 2,
  },
  reasonText: {
    fontStyle: 'italic',
    lineHeight: 18,
  },
  decisionNoteBox: {
    backgroundColor: 'rgba(30, 34, 56, 0.65)',
    padding: spacing.sm,
    borderRadius: radii.md,
    marginTop: 4,
  },
  requestFooterRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.xs,
    marginTop: 4,
  },
  cancelRequestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },

  // Review Queue Styles
  reviewQueueHeader: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.sm,
  },
  reviewCard: {
    gap: spacing.sm,
  },
  reviewTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewEmpInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  empAvatarCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(89, 101, 242, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  decisionButtonsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: spacing.sm,
    marginTop: spacing.xs,
  },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
  },
  modalCard: {
    width: '100%',
    maxWidth: 520,
    maxHeight: '90%',
    backgroundColor: '#0D101B',
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.borderActive,
    padding: spacing.xl,
    gap: spacing.md,
  },
  modalHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  closeModalBtn: {
    padding: spacing.xs,
  },
  formScroll: {
    gap: spacing.md,
  },
  formErrorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(255, 107, 131, 0.12)',
    borderWidth: 1,
    borderColor: colors.danger,
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  formField: {
    gap: spacing.xxs,
  },
  fieldLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  fieldLabel: {
    letterSpacing: 0.6,
  },
  categoriesWrapGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  categoryChoiceCard: {
    flexGrow: 1,
    flexBasis: '47%',
    backgroundColor: 'rgba(20, 23, 39, 0.75)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    gap: 6,
  },
  categoryChoiceCardSelected: {
    backgroundColor: 'rgba(89, 101, 242, 0.18)',
    borderColor: colors.indigoSoft,
  },
  choiceCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  choiceCodeTag: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: radii.xs,
  },
  choiceCodeTagSelected: {
    backgroundColor: colors.indigo,
  },
  choiceCheckCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  choiceCheckCircleSelected: {
    borderColor: colors.indigo,
    backgroundColor: colors.indigo,
  },
  choiceNameText: {
    marginTop: 1,
  },
  textInput: {
    backgroundColor: 'rgba(20, 23, 39, 0.85)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  textArea: {
    minHeight: 85,
    textAlignVertical: 'top',
  },
  halfDayToggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  toggleSwitch: {
    width: 44,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(30, 34, 56, 0.8)',
    padding: 2,
  },
  toggleSwitchActive: {
    backgroundColor: colors.indigo,
  },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.white,
  },
  toggleThumbActive: {
    alignSelf: 'flex-end',
  },
  halfDaySegmentRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  halfDayOption: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: radii.md,
    backgroundColor: 'rgba(20, 23, 39, 0.85)',
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
  },
  halfDayOptionActive: {
    borderColor: colors.indigo,
    backgroundColor: 'rgba(89, 101, 242, 0.22)',
  },
  estimateBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    backgroundColor: 'rgba(89, 101, 242, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(140, 149, 255, 0.25)',
    borderRadius: radii.md,
    padding: spacing.sm,
  },
  submitApplyBtn: {
    marginTop: spacing.xs,
  },
  decisionModalActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },

  // Target Date Selector Button Styles
  dateSelectorBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(17, 20, 34, 0.72)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  dateSelectorLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  calendarIconBubble: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(89, 101, 242, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dateSelectorBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: spacing.xs,
  },

  // Calendar Modal Dialog Overlay
  calendarModalOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: spacing.lg,
    zIndex: 999,
  },
  datePickerModalCard: {
    width: '100%',
    maxWidth: 380,
    backgroundColor: '#0D101B',
    borderRadius: radii.xl,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    gap: spacing.md,
  },
  datePickerHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  datePickerHeaderTitleWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  datePickerCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  calendarContainer: {
    paddingVertical: 2,
  },
});
