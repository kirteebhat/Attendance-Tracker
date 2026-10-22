import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  Alert,
  Platform,
  AppState,
  AppStateStatus,
} from "react-native";
import { Card, Button, StatusBadge, Skeleton, Icon } from "../../src/components";
import { useToast } from "../../src/components/Toast";
import { colors, spacing, typography, radii } from "../../src/theme";
import {
  wfhApi,
  WfhEligibilityResponse,
  WfhRequestItem,
  ApiError,
  subscribeToSocketEvent,
  subscribeToResync,
} from "../../src/services";

export default function WfhScreen() {
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [eligibility, setEligibility] = useState<WfhEligibilityResponse | null>(null);
  const [requests, setRequests] = useState<WfhRequestItem[]>([]);

  // Request form state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [requestDate, setRequestDate] = useState(() => {
    // Tomorrow's date as default (YYYY-MM-DD)
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split("T")[0];
  });
  const [requestReason, setRequestReason] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // In-flight sequence tracking to prevent stale cache overwriting newer authoritative data
  const latestFetchTimestampRef = useRef<number>(0);

  const fetchWfhData = useCallback(async () => {
    const fetchTimestamp = Date.now();
    latestFetchTimestampRef.current = fetchTimestamp;

    try {
      const [eligRes, myReqsRes] = await Promise.all([
        wfhApi.getEligibility(),
        wfhApi.getMyRequests(),
      ]);

      // If a newer request was dispatched after this one, discard this response
      if (fetchTimestamp < latestFetchTimestampRef.current) {
        return;
      }

      setEligibility(eligRes);
      setRequests(myReqsRes.data || []);
    } catch (err) {
      console.error("Failed to load WFH data", err);
    } finally {
      if (fetchTimestamp >= latestFetchTimestampRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, []);

  useEffect(() => {
    fetchWfhData();

    // 1. Live Socket.IO Updates: Real-time decision events from HR
    const unsubDecided = subscribeToSocketEvent("wfh.decided", (rawPayload: unknown) => {
      const payload = rawPayload as {
        requestId?: string;
        dateKey?: string;
        status?: "APPROVED" | "REJECTED";
        reviewerRemarks?: string | null;
      };

      // Optimistically patch UI state immediately on socket packet arrival
      if (payload?.requestId || payload?.dateKey) {
        setRequests((prev) =>
          prev.map((r) => {
            if (r._id === payload.requestId || (r.dateKey || r.date) === payload.dateKey) {
              return {
                ...r,
                status: (payload.status as any) || r.status,
                reviewerRemarks: payload.reviewerRemarks ?? r.reviewerRemarks,
                reviewerComment: payload.reviewerRemarks ?? r.reviewerComment,
              };
            }
            return r;
          })
        );

        showToast({
          title: payload.status === "APPROVED" ? "WFH Request Approved!" : "WFH Request Decided",
          message: `HR has ${payload.status === "APPROVED" ? "approved" : "rejected"} your request for ${payload.dateKey || "remote work"}.`,
          type: payload.status === "APPROVED" ? "success" : "info",
        });
      }

      // Re-fetch authoritative eligibility and quota in background
      fetchWfhData();
    });

    const unsubStatusUpdated = subscribeToSocketEvent("wfh.status_updated", () => {
      fetchWfhData();
    });

    const unsubCreated = subscribeToSocketEvent("wfh.created", () => {
      fetchWfhData();
    });

    // 2. Resync on socket reconnection
    const unsubResync = subscribeToResync(() => {
      fetchWfhData();
    });

    // 3. Resync on app foreground / resume
    const appStateSubscription = AppState.addEventListener(
      "change",
      (nextState: AppStateStatus) => {
        if (nextState === "active") {
          fetchWfhData();
        }
      }
    );

    return () => {
      unsubDecided();
      unsubStatusUpdated();
      unsubCreated();
      unsubResync();
      appStateSubscription.remove();
    };
  }, [fetchWfhData, showToast]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchWfhData();
  }, [fetchWfhData]);

  const handleCreateRequest = async () => {
    const cleanDate = requestDate.trim();
    const cleanReason = requestReason.trim();

    // Comprehensive client-side validation
    if (!cleanDate) {
      setFormError("Please enter a valid date (YYYY-MM-DD).");
      return;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(cleanDate)) {
      setFormError("Date must strictly follow YYYY-MM-DD format (e.g., 2026-10-30).");
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    if (cleanDate < todayStr) {
      setFormError("Remote work requests cannot be submitted for past dates.");
      return;
    }

    if (!cleanReason || cleanReason.length < 5) {
      setFormError("Please provide a business justification (at least 5 characters).");
      return;
    }

    if (cleanReason.length > 500) {
      setFormError("Justification reason cannot exceed 500 characters.");
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      await wfhApi.createRequest(cleanDate, cleanReason);
      showToast({
        title: "Request Submitted",
        message: `WFH request for ${cleanDate} submitted for HR review.`,
        type: "success",
      });
      setIsFormOpen(false);
      setRequestReason("");
      fetchWfhData();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code === "ERR_DUPLICATE_WFH_REQUEST") {
          setFormError("You have already submitted a request for this date.");
        } else if (err.code === "ERR_QUOTA_EXCEEDED") {
          setFormError("Monthly WFH quota limit reached. Additional remote days are not allowed.");
        } else if (
          err.code === "ERR_WFH_CURRENTLY_IN_OFFICE" ||
          err.code === "ERR_WFH_ALREADY_WORKED"
        ) {
          setFormError("Cannot apply for WFH: You have already punched into the office for this date.");
        } else {
          setFormError(err.message || "Failed to submit WFH request.");
        }
      } else {
        setFormError("Network error: Unable to connect to attendance server.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelRequest = (id: string, date: string) => {
    const doCancel = async () => {
      try {
        await wfhApi.cancelRequest(id);
        showToast({
          title: "Request Cancelled",
          message: "Your pending WFH request has been cancelled.",
          type: "info",
        });
        fetchWfhData();
      } catch (err: unknown) {
        const msg = err instanceof ApiError ? err.message : "Failed to cancel request.";
        Alert.alert("Cancellation Error", msg);
      }
    };

    if (Platform.OS === "web") {
      // In web browser or headless automated tests
      if (typeof window !== "undefined" && typeof window.confirm === "function") {
        if (window.confirm(`Are you sure you want to cancel your remote request for ${date}?`)) {
          doCancel();
        }
      } else {
        doCancel();
      }
      return;
    }

    Alert.alert(
      "Cancel WFH Request",
      `Are you sure you want to cancel your remote request for ${date}?`,
      [
        { text: "No", style: "cancel" },
        {
          text: "Yes, Cancel",
          style: "destructive",
          onPress: doCancel,
        },
      ]
    );
  };

  const isEligible = Boolean(eligibility?.isEligible ?? eligibility?.eligible);
  const remainingDays = eligibility?.remainingQuota ?? 0;
  const usedDays = eligibility?.usedDays ?? eligibility?.approvedCountThisMonth ?? 0;
  const totalQuota = eligibility?.monthlyQuota ?? eligibility?.policyQuota ?? 4;
  const pendingDays = eligibility?.pendingCountThisMonth ?? 0;

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.contentContainer}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.accent.cyan}
          colors={[colors.accent.cyan]}
        />
      }
    >
      {/* 1. WFH Eligibility & Quota Overview Card */}
      <Card variant="elevated" style={styles.quotaCard}>
        <View style={styles.quotaHeaderRow}>
          <View>
            <Text style={styles.quotaCategoryTag}>REMOTE WORK ENTITLEMENT</Text>
            <Text style={styles.quotaTitle}>Monthly Remote Policy</Text>
          </View>
          <StatusBadge
            status={isEligible ? "PRESENT" : "ABSENT"}
            label={isEligible ? "ELIGIBLE" : "INELIGIBLE"}
          />
        </View>

        <View style={styles.quotaNumbersRow}>
          <View style={styles.quotaNumberBox}>
            <Text style={styles.quotaNumberValue}>{remainingDays}</Text>
            <Text style={styles.quotaNumberLabel}>Days Available</Text>
          </View>

          <View style={styles.quotaDivider} />

          <View style={styles.quotaNumberBox}>
            <Text style={[styles.quotaNumberValue, { color: colors.status.wfh }]}>
              {usedDays}
            </Text>
            <Text style={styles.quotaNumberLabel}>Days Approved</Text>
          </View>

          <View style={styles.quotaDivider} />

          <View style={styles.quotaNumberBox}>
            <Text style={[styles.quotaNumberValue, { color: colors.status.late }]}>
              {pendingDays}
            </Text>
            <Text style={styles.quotaNumberLabel}>Pending</Text>
          </View>
        </View>

        {/* Quota Progress Bar */}
        {eligibility && (
          <View style={styles.progressBarWrapper}>
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
            <Text style={styles.progressBarText}>
              {usedDays} of {totalQuota} monthly quota used ({remainingDays} available)
            </Text>
          </View>
        )}

        {/* Toggle Request Form Button */}
        {isEligible && (
          <Button
            title={isFormOpen ? "Close Request Form" : "Request Work From Home"}
            onPress={() => setIsFormOpen(!isFormOpen)}
            variant={isFormOpen ? "outline" : "primary"}
            size="lg"
            icon={<Icon name={isFormOpen ? "close" : "add"} size={18} color="#FFFFFF" />}
            accessibilityLabel={isFormOpen ? "Close remote request form" : "Open remote request form"}
            testID="wfh-toggle-form-btn"
            style={{ marginTop: spacing.md }}
          />
        )}
      </Card>

      {/* 2. New Request Form Card */}
      {isFormOpen && (
        <Card variant="surface" style={styles.formCard} testID="wfh-request-form-card">
          <View style={styles.formHeader}>
            <Icon name="calendar-outline" size={20} color={colors.accent.cyan} />
            <Text style={styles.formTitle}>Submit Remote Work Request</Text>
          </View>

          <Text style={styles.inputLabel}>Requested Date (YYYY-MM-DD)</Text>
          <TextInput
            placeholder="YYYY-MM-DD"
            placeholderTextColor={colors.text.muted}
            value={requestDate}
            onChangeText={(val) => {
              setRequestDate(val);
              if (formError) setFormError(null);
            }}
            style={styles.textInput}
            accessibilityLabel="Requested remote work date in YYYY-MM-DD format"
            testID="wfh-date-input"
          />

          <Text style={styles.inputLabel}>Business Reason / Justification</Text>
          <TextInput
            placeholder="Explain why you are requesting remote work..."
            placeholderTextColor={colors.text.muted}
            value={requestReason}
            onChangeText={(val) => {
              setRequestReason(val);
              if (formError) setFormError(null);
            }}
            multiline
            numberOfLines={3}
            style={[styles.textInput, styles.textArea]}
            accessibilityLabel="Business justification for remote work"
            testID="wfh-reason-input"
          />

          {formError && (
            <View style={styles.formErrorBanner} testID="wfh-form-error-banner">
              <Icon name="alert-circle" size={16} color={colors.text.danger} />
              <Text style={styles.formErrorText}>{formError}</Text>
            </View>
          )}

          <Button
            title="Submit for Approval"
            onPress={handleCreateRequest}
            isLoading={submitting}
            variant="primary"
            size="lg"
            accessibilityLabel="Submit remote work request for HR approval"
            testID="wfh-submit-request-btn"
            style={{ marginTop: spacing.sm }}
          />
        </Card>
      )}

      {/* 3. My Submitted Requests Section */}
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>My Remote Requests</Text>
        <Text style={styles.sectionSubtitle}>
          Real-time updates via Socket.IO ({requests.length} total)
        </Text>
      </View>

      {/* Skeletons while loading */}
      {loading && !refreshing && (
        <View style={{ gap: spacing.sm }}>
          {[1, 2].map((i) => (
            <Card key={i} variant="surface" style={{ padding: spacing.lg }}>
              <Skeleton width="40%" height={18} />
              <Skeleton width="80%" height={14} style={{ marginTop: spacing.sm }} />
            </Card>
          ))}
        </View>
      )}

      {/* Requests List */}
      {!loading && requests.length > 0 ? (
        requests.map((item) => {
          const status = item.status;
          const remarks = item.reviewerRemarks || item.reviewerComment;
          const dateStr = item.dateKey || item.date || "";

          return (
            <Card key={item._id} variant="surface" style={styles.requestCard}>
              <View style={styles.requestHeaderRow}>
                <View style={styles.requestDateBox}>
                  <Text style={styles.requestDateText}>
                    {dateStr
                      ? new Date(dateStr + "T00:00:00").toLocaleDateString(undefined, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })
                      : "Pending Date"}
                  </Text>
                  <Text style={styles.requestCreatedSubtext}>
                    Requested on {new Date(item.createdAt).toLocaleDateString()}
                  </Text>
                </View>

                <StatusBadge
                  status={
                    status === "APPROVED"
                      ? "PRESENT"
                      : status === "PENDING"
                        ? "LATE"
                        : "ABSENT"
                  }
                  label={status}
                />
              </View>

              <View style={styles.requestReasonBox}>
                <Text style={styles.requestReasonLabel}>Reason:</Text>
                <Text style={styles.requestReasonText}>{item.reason}</Text>
              </View>

              {/* Decision comment from HR */}
              {remarks ? (
                <View
                  style={[
                    styles.reviewerCommentBox,
                    status === "APPROVED" && styles.reviewerCommentBoxApproved,
                    status === "REJECTED" && styles.reviewerCommentBoxRejected,
                  ]}
                >
                  <Icon
                    name={status === "APPROVED" ? "checkmark-circle" : "information-circle"}
                    size={16}
                    color={status === "APPROVED" ? colors.status.present : colors.text.danger}
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.reviewerCommentTitle}>
                      HR Decision Note:
                    </Text>
                    <Text style={styles.reviewerCommentText}>{remarks}</Text>
                  </View>
                </View>
              ) : null}

              {/* One-tap cancel for pending requests */}
              {status === "PENDING" && (
                <View style={styles.cardActionRow}>
                  <TouchableOpacity
                    onPress={() => handleCancelRequest(item._id, dateStr)}
                    style={styles.cancelBtn}
                    accessibilityLabel={`Cancel remote request for ${dateStr}`}
                    accessibilityRole="button"
                    testID={`wfh-cancel-btn-${item._id}`}
                  >
                    <Icon name="close-circle-outline" size={18} color={colors.text.danger} />
                    <Text style={styles.cancelBtnText}>Cancel Request</Text>
                  </TouchableOpacity>
                </View>
              )}
            </Card>
          );
        })
      ) : (
        !loading && (
          <Card variant="surface" style={styles.emptyCard} testID="wfh-empty-state">
            <View style={styles.emptyIconCircle}>
              <Icon name="briefcase-outline" size={32} color={colors.text.muted} />
            </View>
            <Text style={styles.emptyTitle}>No Remote Requests</Text>
            <Text style={styles.emptySubtitle}>
              You have not submitted any work-from-home requests for this period.
            </Text>
          </Card>
        )
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.base,
  },
  contentContainer: {
    padding: spacing.lg,
    paddingBottom: spacing.xxl * 2,
  },
  quotaCard: {
    padding: spacing.lg,
    borderColor: colors.accent.blue,
    marginBottom: spacing.lg,
  },
  quotaHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.md,
  },
  quotaCategoryTag: {
    ...typography.xs,
    fontWeight: "700",
    color: colors.accent.cyan,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  quotaTitle: {
    ...typography.lg,
    fontWeight: "800",
    color: colors.text.primary,
    marginTop: 2,
  },
  quotaNumbersRow: {
    flexDirection: "row",
    backgroundColor: colors.background.base,
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: "center",
    justifyContent: "space-around",
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  quotaNumberBox: {
    alignItems: "center",
  },
  quotaNumberValue: {
    ...typography.xxl,
    fontWeight: "900",
    color: colors.text.primary,
  },
  quotaNumberLabel: {
    ...typography.xs,
    color: colors.text.secondary,
    marginTop: 2,
    fontWeight: "600",
  },
  quotaDivider: {
    width: 1,
    height: 32,
    backgroundColor: colors.border.subtle,
  },
  progressBarWrapper: {
    marginTop: spacing.md,
  },
  progressBarBg: {
    height: 6,
    backgroundColor: colors.background.base,
    borderRadius: radii.full,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: colors.accent.cyan,
    borderRadius: radii.full,
  },
  progressBarText: {
    ...typography.xs,
    color: colors.text.muted,
    marginTop: spacing.xs,
    textAlign: "right",
  },
  formCard: {
    padding: spacing.lg,
    borderColor: colors.accent.cyan,
    marginBottom: spacing.lg,
  },
  formHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  formTitle: {
    ...typography.md,
    fontWeight: "800",
    color: colors.text.primary,
  },
  inputLabel: {
    ...typography.xs,
    fontWeight: "700",
    color: colors.text.secondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },
  textInput: {
    backgroundColor: colors.background.base,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text.primary,
    ...typography.sm,
    minHeight: 44, // 44px minimum touch target
  },
  textArea: {
    minHeight: 80,
    textAlignVertical: "top",
    paddingTop: spacing.sm,
  },
  formErrorBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.status.absentBg,
    borderRadius: radii.md,
    padding: spacing.sm,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  formErrorText: {
    ...typography.xs,
    color: colors.text.danger,
    fontWeight: "600",
    flex: 1,
  },
  sectionHeader: {
    marginBottom: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionTitle: {
    ...typography.md,
    fontWeight: "800",
    color: colors.text.primary,
  },
  sectionSubtitle: {
    ...typography.xs,
    color: colors.text.secondary,
    marginTop: 2,
    marginBottom: spacing.xs,
  },
  requestCard: {
    padding: spacing.md,
    marginBottom: spacing.sm,
    borderColor: colors.border.subtle,
  },
  requestHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  requestDateBox: {
    flex: 1,
  },
  requestDateText: {
    ...typography.sm,
    fontWeight: "800",
    color: colors.text.primary,
  },
  requestCreatedSubtext: {
    ...typography.xs,
    color: colors.text.muted,
    marginTop: 2,
  },
  requestReasonBox: {
    marginTop: spacing.sm,
    backgroundColor: colors.background.base,
    padding: spacing.sm,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border.subtle,
  },
  requestReasonLabel: {
    ...typography.xs,
    fontWeight: "700",
    color: colors.text.muted,
    marginBottom: 2,
  },
  requestReasonText: {
    ...typography.xs,
    color: colors.text.secondary,
    lineHeight: 18,
  },
  reviewerCommentBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.xs,
    backgroundColor: colors.accent.cyanMuted,
    padding: spacing.sm,
    borderRadius: radii.sm,
    marginTop: spacing.sm,
    borderWidth: 1,
    borderColor: "rgba(6, 182, 212, 0.3)",
  },
  reviewerCommentBoxApproved: {
    backgroundColor: colors.status.presentBg,
    borderColor: "rgba(16, 185, 129, 0.3)",
  },
  reviewerCommentBoxRejected: {
    backgroundColor: colors.status.absentBg,
    borderColor: "rgba(239, 68, 68, 0.3)",
  },
  reviewerCommentTitle: {
    ...typography.xs,
    fontWeight: "800",
    color: colors.text.primary,
    marginBottom: 2,
  },
  reviewerCommentText: {
    ...typography.xs,
    color: colors.text.primary,
    fontWeight: "600",
  },
  cardActionRow: {
    marginTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    paddingTop: spacing.xs,
    alignItems: "flex-end",
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    paddingVertical: spacing.xs + 2,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.sm,
    minHeight: 44, // 44px minimum touch target
  },
  cancelBtnText: {
    ...typography.xs,
    color: colors.text.danger,
    fontWeight: "700",
  },
  emptyCard: {
    padding: spacing.xxl,
    alignItems: "center",
    borderColor: colors.border.subtle,
    marginTop: spacing.md,
  },
  emptyIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.background.base,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  emptyTitle: {
    ...typography.md,
    fontWeight: "800",
    color: colors.text.primary,
    marginBottom: spacing.xs,
  },
  emptySubtitle: {
    ...typography.xs,
    color: colors.text.secondary,
    textAlign: "center",
    lineHeight: 18,
    maxWidth: 240,
  },
});
