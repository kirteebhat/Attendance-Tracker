import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  StyleSheet,
  RefreshControl,
  TouchableOpacity,
  Alert,
  AppState,
  AppStateStatus,
} from 'react-native';
import {
  Calendar as CalendarIcon,
  House,
  Plus,
  X,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useToast } from '../../src/components/Toast';
import {
  Screen,
  Card,
  Button,
  Badge,
  StatusBadge,
  PageHeader,
  SectionHeader,
  Input,
  Field,
  Notice,
  Text,
} from '../../src/components';
import { colors, radii, spacing } from '../../src/theme/tokens';
import { useResponsive } from '../../src/lib/responsive';
import {
  wfhApi,
  WfhEligibilityResponse,
  WfhRequestItem,
  ApiError,
  subscribeToSocketEvent,
  subscribeToResync,
} from '../../src/services';

export default function WfhScreen() {
  const { showToast } = useToast();
  const { isWide } = useResponsive();

  const [refreshing, setRefreshing] = useState(false);
  const [eligibility, setEligibility] = useState<WfhEligibilityResponse | null>(null);
  const [requests, setRequests] = useState<WfhRequestItem[]>([]);

  // Request form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [requestDate, setRequestDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [requestReason, setRequestReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const latestFetchTimestampRef = useRef<number>(0);

  const fetchWfhData = useCallback(async () => {
    const fetchTimestamp = Date.now();
    latestFetchTimestampRef.current = fetchTimestamp;

    try {
      const [eligRes, myReqsRes] = await Promise.all([
        wfhApi.getEligibility(),
        wfhApi.getMyRequests(),
      ]);

      if (fetchTimestamp < latestFetchTimestampRef.current) return;

      setEligibility(eligRes);
      setRequests(myReqsRes.data || []);
    } catch (err) {
      console.error('Failed to load WFH data', err);
    } finally {
      if (fetchTimestamp >= latestFetchTimestampRef.current) {
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchWfhData();

    const unsubDecided = subscribeToSocketEvent('wfh.decided', (rawPayload: unknown) => {
      const payload = rawPayload as {
        requestId?: string;
        dateKey?: string;
        status?: 'APPROVED' | 'REJECTED';
        reviewerRemarks?: string | null;
      };

      if (payload?.requestId || payload?.dateKey) {
        setRequests((prev) =>
          prev.map((r) => {
            if (r._id === payload.requestId || (r.dateKey || r.date) === payload.dateKey) {
              return {
                ...r,
                status: (payload.status as 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED') || r.status,
                reviewerRemarks: payload.reviewerRemarks ?? r.reviewerRemarks,
                reviewerComment: payload.reviewerRemarks ?? r.reviewerComment,
              };
            }
            return r;
          })
        );

        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        showToast({
          title: payload.status === 'APPROVED' ? 'WFH Request Approved!' : 'WFH Request Decided',
          message: `HR has ${payload.status === 'APPROVED' ? 'approved' : 'rejected'} your request for ${payload.dateKey || 'remote work'}.`,
          type: payload.status === 'APPROVED' ? 'success' : 'info',
        });
      }

      fetchWfhData();
    });

    const unsubStatusUpdated = subscribeToSocketEvent('wfh.status_updated', () => fetchWfhData());
    const unsubCreated = subscribeToSocketEvent('wfh.created', () => fetchWfhData());
    const unsubResync = subscribeToResync(() => fetchWfhData());

    const appStateSub = AppState.addEventListener('change', (nextState: AppStateStatus) => {
      if (nextState === 'active') fetchWfhData();
    });

    return () => {
      unsubDecided();
      unsubStatusUpdated();
      unsubCreated();
      unsubResync();
      appStateSub.remove();
    };
  }, [fetchWfhData, showToast]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchWfhData();
  }, [fetchWfhData]);

  const handleCreateRequest = async () => {
    const cleanDate = requestDate.trim();
    const cleanReason = requestReason.trim();

    if (!cleanDate) {
      setFormError('Please enter a valid date (YYYY-MM-DD).');
      return;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(cleanDate)) {
      setFormError('Date must follow YYYY-MM-DD format (e.g. 2026-10-30).');
      return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (cleanDate < todayStr) {
      setFormError('Remote work requests cannot be submitted for past dates.');
      return;
    }

    if (!cleanReason || cleanReason.length < 5) {
      setFormError('Please provide a justification (at least 5 characters).');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      await wfhApi.createRequest(cleanDate, cleanReason);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      showToast({
        title: 'Request Submitted',
        message: `WFH request for ${cleanDate} submitted for HR review.`,
        type: 'success',
      });
      setIsFormOpen(false);
      setRequestReason('');
      fetchWfhData();
    } catch (err: unknown) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      if (err instanceof ApiError) {
        if (err.code === 'ERR_DUPLICATE_WFH_REQUEST') {
          setFormError('You have already submitted a request for this date.');
        } else if (err.code === 'ERR_QUOTA_EXCEEDED') {
          setFormError('Monthly WFH quota limit reached.');
        } else if (
          err.code === 'ERR_WFH_CURRENTLY_IN_OFFICE' ||
          err.code === 'ERR_WFH_ALREADY_WORKED'
        ) {
          setFormError('Cannot apply for WFH: You have already punched into the office for this date.');
        } else {
          setFormError(err.message || 'Failed to submit WFH request.');
        }
      } else {
        setFormError('Unable to connect to attendance server.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = (id: string, date: string) => {
    const doCancel = async () => {
      try {
        await wfhApi.cancelRequest(id);
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        showToast({
          title: 'Request Cancelled',
          message: 'Your pending WFH request has been cancelled.',
          type: 'info',
        });
        fetchWfhData();
      } catch (err: unknown) {
        const msg = err instanceof ApiError ? err.message : 'Failed to cancel request.';
        Alert.alert('Cancellation Error', msg);
      }
    };

    Alert.alert(
      'Cancel WFH Request',
      `Are you sure you want to cancel your remote request for ${date}?`,
      [
        { text: 'No', style: 'cancel' },
        { text: 'Yes, Cancel', style: 'destructive', onPress: doCancel },
      ]
    );
  };

  const isEligible = Boolean(eligibility?.isEligible ?? eligibility?.eligible);
  const remainingDays = eligibility?.remainingQuota ?? 0;
  const usedDays = eligibility?.usedDays ?? eligibility?.approvedCountThisMonth ?? 0;
  const totalQuota = eligibility?.monthlyQuota ?? eligibility?.policyQuota ?? 4;
  const pendingDays = eligibility?.pendingCountThisMonth ?? 0;

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
        eyebrow="Remote Work Policy"
        title="Work From Home"
        subtitle="Submit remote requests and check your monthly quota balance."
      />

      <View style={[styles.container, isWide && styles.containerWide]}>
        {/* 1. WFH Entitlement Quota Card */}
        <Card variant="raised" padding={20} style={styles.quotaCard}>
          <View style={styles.quotaHeader}>
            <View style={styles.quotaTitleWrap}>
              <Text variant="caption" color={colors.muted}>
                Entitlement & Policy
              </Text>
              <Text variant="title">Monthly WFH Quota</Text>
            </View>
            <Badge
              label={isEligible ? 'Eligible' : 'Ineligible'}
              tone={isEligible ? 'success' : 'danger'}
              dot
            />
          </View>

          {/* Numbers Strip */}
          <View style={styles.numbersRow}>
            <View style={styles.numberBox}>
              <Text variant="number" color={colors.text}>
                {remainingDays}
              </Text>
              <Text variant="small" color={colors.muted}>
                Available
              </Text>
            </View>
            <View style={styles.vDivider} />
            <View style={styles.numberBox}>
              <Text variant="number" color={colors.info}>
                {usedDays}
              </Text>
              <Text variant="small" color={colors.muted}>
                Approved
              </Text>
            </View>
            <View style={styles.vDivider} />
            <View style={styles.numberBox}>
              <Text variant="number" color={colors.warning}>
                {pendingDays}
              </Text>
              <Text variant="small" color={colors.muted}>
                Pending
              </Text>
            </View>
          </View>

          {/* Quota Progress Bar */}
          <View style={styles.progressWrap}>
            <View style={styles.progressBarBg}>
              <View
                style={[
                  styles.progressBarFill,
                  {
                    width: `${Math.min(100, (usedDays / (totalQuota || 1)) * 100)}%`,
                  },
                ]}
              />
            </View>
            <Text variant="small" color={colors.muted} align="center">
              {usedDays} of {totalQuota} days used ({remainingDays} available)
            </Text>
          </View>

          {isEligible && (
            <Button
              icon={isFormOpen ? <X size={16} color={colors.text} /> : <Plus size={16} color={colors.white} />}
              label={isFormOpen ? 'Close Form' : 'Request Work From Home'}
              onPress={() => setIsFormOpen(!isFormOpen)}
              variant={isFormOpen ? 'secondary' : 'primary'}
              size="md"
            />
          )}
        </Card>

        {/* 2. New Request Form Card */}
        {isFormOpen && (
          <Card variant="glass" padding={20} style={styles.formCard}>
            <View style={styles.formHeader}>
              <House size={18} color={colors.indigoSoft} />
              <Text variant="subheading">Submit Remote Work Request</Text>
            </View>

            {formError ? <Notice tone="danger" title="Invalid Request" message={formError} /> : null}

            <Field label="Target Date" required hint="Format: YYYY-MM-DD">
              <Input
                placeholder="2026-10-30"
                value={requestDate}
                onChangeText={setRequestDate}
                leftIcon={CalendarIcon}
              />
            </Field>

            <Field label="Business Justification" required hint="At least 5 characters">
              <Input
                placeholder="Describe reason for remote work..."
                value={requestReason}
                onChangeText={setRequestReason}
                multiline
                numberOfLines={3}
              />
            </Field>

            <Button
              label={submitting ? 'Submitting...' : 'Submit Request to HR'}
              loading={submitting}
              onPress={handleCreateRequest}
            />
          </Card>
        )}

        {/* 3. Requests Feed */}
        <SectionHeader
          title="My requests"
          caption={`${requests.length} applications on record`}
        />

        {requests.length === 0 ? (
          <Card variant="soft" padding={24} style={styles.emptyCard}>
            <House size={28} color={colors.muted} strokeWidth={1.6} />
            <Text variant="subheading" align="center">
              No remote requests yet
            </Text>
            <Text variant="small" color={colors.muted} align="center">
              Tap "Request Work From Home" to submit your first remote request.
            </Text>
          </Card>
        ) : (
          <Card padding={0}>
            {requests.map((item, index) => {
              const dateVal = item.dateKey || item.date || 'Remote day';
              const isPending = item.status === 'PENDING';

              return (
                <View
                  key={item._id}
                  style={[styles.requestRow, index > 0 ? styles.rowDivider : null]}
                >
                  <View style={styles.requestLeft}>
                    <View style={styles.requestDateRow}>
                      <Text variant="bodyMedium" weight="semibold">
                        {dateVal}
                      </Text>
                      <StatusBadge status={item.status} />
                    </View>
                    <Text variant="small" color={colors.textSecondary}>
                      {item.reason}
                    </Text>
                    {item.reviewerRemarks || item.reviewerComment ? (
                      <Text variant="caption" color={colors.indigoSoft} style={styles.remarks}>
                        HR Note: {item.reviewerRemarks || item.reviewerComment}
                      </Text>
                    ) : null}
                  </View>

                  {isPending && (
                    <TouchableOpacity
                      onPress={() => handleCancelRequest(item._id, dateVal)}
                      style={styles.cancelBtn}
                    >
                      <Text variant="small" color={colors.danger} weight="medium">
                        Cancel
                      </Text>
                    </TouchableOpacity>
                  )}
                </View>
              );
            })}
          </Card>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: spacing.lg,
  },
  containerWide: {
    maxWidth: 580,
    alignSelf: 'center',
  },
  quotaCard: {
    gap: spacing.lg,
  },
  quotaHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  quotaTitleWrap: {
    gap: 3,
  },
  numbersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
    backgroundColor: 'rgba(11, 14, 25, 0.7)',
    borderWidth: 1,
    borderColor: 'rgba(184, 190, 255, 0.08)',
  },
  numberBox: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
  },
  vDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border,
  },
  progressWrap: {
    gap: spacing.xs,
  },
  progressBarBg: {
    width: '100%',
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: colors.indigo,
    borderRadius: 3,
  },
  formCard: {
    gap: spacing.md,
  },
  formHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: spacing.xs,
  },
  emptyCard: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  requestRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    padding: spacing.lg,
    gap: spacing.md,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  requestLeft: {
    flex: 1,
    gap: 5,
  },
  requestDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  remarks: {
    marginTop: 2,
  },
  cancelBtn: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255, 107, 131, 0.1)',
  },
});
