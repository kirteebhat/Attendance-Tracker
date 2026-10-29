import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Modal,
  Image,
  RefreshControl,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Stack } from "expo-router";
import { Icon } from "../src/components/Icon";
import { colors, spacing, typography, radii } from "../src/theme";
import {
  enquiryApi,
  MobileEnquiryItem,
  EnquiryMessageItem,
  EnquiryAttachmentItem,
  subscribeToSocketEvent,
  emitMobileSocketEvent,
} from "../src/services";
import { useToast } from "../src/components/Toast";

type CategoryType = "ATTENDANCE" | "LEAVE" | "WFH" | "PAYROLL" | "TECHNICAL" | "OTHER";
type PriorityType = "LOW" | "MEDIUM" | "HIGH" | "URGENT";

const CATEGORIES: { key: CategoryType; label: string; icon: string }[] = [
  { key: "ATTENDANCE", label: "Attendance", icon: "time-outline" },
  { key: "LEAVE", label: "Leave", icon: "calendar-outline" },
  { key: "WFH", label: "WFH", icon: "home-outline" },
  { key: "PAYROLL", label: "Payroll", icon: "card-outline" },
  { key: "TECHNICAL", label: "Technical", icon: "construct-outline" },
  { key: "OTHER", label: "Other", icon: "help-circle-outline" },
];

const PRIORITIES: { key: PriorityType; label: string; color: string }[] = [
  { key: "LOW", label: "Low", color: colors.text.muted },
  { key: "MEDIUM", label: "Medium", color: colors.accent.cyan },
  { key: "HIGH", label: "High", color: colors.status.warning },
  { key: "URGENT", label: "Urgent", color: colors.status.danger },
];

export default function EnquiriesScreen() {
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<"list" | "create">("list");
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [enquiries, setEnquiries] = useState<MobileEnquiryItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form State
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>("ATTENDANCE");
  const [selectedPriority, setSelectedPriority] = useState<PriorityType>("MEDIUM");
  const [subject, setSubject] = useState<string>("");
  const [message, setMessage] = useState<string>("");
  const [selectedAttachment, setSelectedAttachment] = useState<EnquiryAttachmentItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Thread Modal State
  const [selectedEnquiry, setSelectedEnquiry] = useState<MobileEnquiryItem | null>(null);
  const [messages, setMessages] = useState<EnquiryMessageItem[]>([]);
  const [threadLoading, setThreadLoading] = useState<boolean>(false);
  const [replyText, setReplyText] = useState<string>("");
  const [replyAttachment, setReplyAttachment] = useState<EnquiryAttachmentItem | null>(null);
  const [isSendingReply, setIsSendingReply] = useState<boolean>(false);
  const [isHrTyping, setIsHrTyping] = useState<boolean>(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Reopen Modal
  const [showReopenModal, setShowReopenModal] = useState<boolean>(false);
  const [reopenReason, setReopenReason] = useState<string>("");
  const [isReopening, setIsReopening] = useState<boolean>(false);

  // Image Lightbox
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Fetch list of user's enquiries
  const loadEnquiries = useCallback(async () => {
    try {
      setFetchError(null);
      const params = statusFilter === "ALL" ? undefined : { status: statusFilter };
      const res = await enquiryApi.getMyEnquiries(params);
      if (res.success) {
        setEnquiries(res.data || []);
      }
    } catch (err: any) {
      console.error("Failed to load enquiries:", err);
      setFetchError(err.message || "Failed to load enquiries.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadEnquiries();
  }, [loadEnquiries]);

  // Open Thread
  const openThread = async (ticket: MobileEnquiryItem) => {
    setSelectedEnquiry(ticket);
    setThreadLoading(true);
    setMessages([]);
    setIsHrTyping(false);

    try {
      // Join socket room
      emitMobileSocketEvent("enquiry.join", ticket._id);

      const res = await enquiryApi.getEnquiryById(ticket._id);
      if (res.success) {
        setSelectedEnquiry(res.data);
        setMessages(res.messages || []);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to open enquiry thread.", "error");
    } finally {
      setThreadLoading(false);
    }
  };

  const closeThread = () => {
    if (selectedEnquiry) {
      emitMobileSocketEvent("enquiry.leave", selectedEnquiry._id);
    }
    setSelectedEnquiry(null);
    setMessages([]);
    setReplyText("");
    setReplyAttachment(null);
    setIsHrTyping(false);
  };

  // Socket Subscriptions
  useEffect(() => {
    const unsubCreated = subscribeToSocketEvent("enquiry.created", () => {
      loadEnquiries();
    });

    const unsubMsg = subscribeToSocketEvent(
      "enquiry.message_received",
      (data: any) => {
        loadEnquiries();
        if (selectedEnquiry && data?.enquiryId === selectedEnquiry._id) {
          setMessages((prev) => {
            if (prev.some((m) => m._id === data.messageId)) return prev;
            const newMsg: EnquiryMessageItem = {
              _id: data.messageId || String(Date.now()),
              enquiry: data.enquiryId,
              sender: data.senderId,
              senderRole: data.senderRole,
              message: data.message,
              attachments: data.attachments || [],
              readByRecipient: true,
              createdAt: data.createdAt || new Date().toISOString(),
            };
            return [...prev, newMsg];
          });
        }
      }
    );

    const unsubStatus = subscribeToSocketEvent(
      "enquiry.status_updated",
      (data: any) => {
        loadEnquiries();
        if (selectedEnquiry && data?.enquiryId === selectedEnquiry._id) {
          setSelectedEnquiry((prev) =>
            prev ? { ...prev, status: data.status, reopenDeadline: data.reopenDeadline } : null
          );
        }
      }
    );

    const unsubAssigned = subscribeToSocketEvent(
      "enquiry.assigned",
      (data: any) => {
        loadEnquiries();
        if (selectedEnquiry && data?.enquiryId === selectedEnquiry._id) {
          setSelectedEnquiry((prev) =>
            prev
              ? {
                  ...prev,
                  assignee: {
                    _id: data.assigneeId,
                    name: data.assigneeName,
                    email: data.assigneeName || "HR Support",
                  },
                }
              : null
          );
        }
      }
    );

    const unsubTyping = subscribeToSocketEvent(
      "enquiry.typing",
      (data: any) => {
        if (
          selectedEnquiry &&
          data?.enquiryId === selectedEnquiry._id &&
          data?.role !== "EMPLOYEE"
        ) {
          setIsHrTyping(Boolean(data.isTyping));
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          if (data.isTyping) {
            typingTimeoutRef.current = setTimeout(() => {
              setIsHrTyping(false);
            }, 4000);
          }
        }
      }
    );

    return () => {
      unsubCreated();
      unsubMsg();
      unsubStatus();
      unsubAssigned();
      unsubTyping();
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    };
  }, [loadEnquiries, selectedEnquiry]);

  // Handle Create Ticket Submit
  const handleCreateSubmit = async () => {
    if (!subject.trim()) {
      showToast("Please enter an enquiry subject.", "warning");
      return;
    }
    if (!message.trim()) {
      showToast("Please explain your enquiry message.", "warning");
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        category: selectedCategory,
        subject: subject.trim(),
        message: message.trim(),
        priority: selectedPriority,
        attachment: selectedAttachment || undefined,
      };

      const res = await enquiryApi.createEnquiry(payload);
      if (res.success) {
        showToast(`Ticket ${res.data.ticketNumber} submitted!`, "success");
        setSubject("");
        setMessage("");
        setSelectedAttachment(null);
        setActiveTab("list");
        loadEnquiries();
      }
    } catch (err: any) {
      showToast(err.message || "Failed to submit enquiry ticket.", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle Send Reply
  const handleSendReply = async () => {
    if (!selectedEnquiry || !replyText.trim()) return;

    setIsSendingReply(true);
    try {
      const payload = {
        message: replyText.trim(),
        attachment: replyAttachment || undefined,
      };

      const res = await enquiryApi.sendMessage(selectedEnquiry._id, payload);
      if (res.success) {
        setReplyText("");
        setReplyAttachment(null);
        emitMobileSocketEvent("enquiry.typing", {
          enquiryId: selectedEnquiry._id,
          isTyping: false,
        });
      }
    } catch (err: any) {
      showToast(err.message || "Failed to send message.", "error");
    } finally {
      setIsSendingReply(false);
    }
  };

  // Handle Reopen Ticket
  const handleReopen = async () => {
    if (!selectedEnquiry || !reopenReason.trim()) {
      showToast("Please provide a reason to reopen this ticket.", "warning");
      return;
    }

    setIsReopening(true);
    try {
      const res = await enquiryApi.reopenEnquiry(selectedEnquiry._id, reopenReason.trim());
      if (res.success) {
        showToast("Ticket successfully reopened!", "success");
        setShowReopenModal(false);
        setReopenReason("");
        setSelectedEnquiry(res.data);
        openThread(res.data);
      }
    } catch (err: any) {
      showToast(err.message || "Failed to reopen enquiry.", "error");
    } finally {
      setIsReopening(false);
    }
  };

  // Mock Attachment Picker (creates sample PNG attachment for preview/submission)
  const pickMockAttachment = (isReply = false) => {
    const timestamp = Date.now().toString().slice(-4);
    const mockAtt: EnquiryAttachmentItem = {
      name: `screenshot_${timestamp}.png`,
      mimeType: "image/png",
      sizeBytes: 184320, // ~180 KB
      url: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&auto=format&fit=crop&q=80",
    };

    if (isReply) {
      setReplyAttachment(mockAtt);
      showToast("Image attached to reply.", "info");
    } else {
      setSelectedAttachment(mockAtt);
      showToast("Image screenshot attached.", "info");
    }
  };

  // Status Badge Colors
  const getStatusColor = (status: string) => {
    switch (status) {
      case "OPEN":
        return colors.accent.cyan;
      case "IN_PROGRESS":
        return colors.status.warning;
      case "RESOLVED":
        return colors.status.success;
      case "CLOSED":
        return colors.text.muted;
      default:
        return colors.text.muted;
    }
  };

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: "Contact HR & Enquiries",
          headerStyle: { backgroundColor: colors.background.surface },
          headerTintColor: colors.text.primary,
        }}
      />

      {/* 1. Sub-Header Navigation Tabs */}
      <View style={styles.tabBar}>
        <TouchableOpacity
          style={[styles.tabButton, activeTab === "list" && styles.tabButtonActive]}
          onPress={() => setActiveTab("list")}
        >
          <Icon
            name="chatbubbles-outline"
            size={18}
            color={activeTab === "list" ? colors.accent.cyan : colors.text.muted}
          />
          <Text style={[styles.tabText, activeTab === "list" && styles.tabTextActive]}>
            My Enquiries ({enquiries.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabButton, activeTab === "create" && styles.tabButtonActive]}
          onPress={() => setActiveTab("create")}
        >
          <Icon
            name="create-outline"
            size={18}
            color={activeTab === "create" ? colors.accent.cyan : colors.text.muted}
          />
          <Text style={[styles.tabText, activeTab === "create" && styles.tabTextActive]}>
            New Ticket
          </Text>
        </TouchableOpacity>
      </View>

      {/* ================================================================= */}
      {/* TAB 1: LIST OF ENQUIRIES */}
      {/* ================================================================= */}
      {activeTab === "list" && (
        <View style={styles.tabContent}>
          {/* Status Filter Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.filterScroll}
            contentContainerStyle={styles.filterScrollContent}
          >
            {["ALL", "OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"].map((st) => (
              <TouchableOpacity
                key={st}
                style={[
                  styles.filterChip,
                  statusFilter === st && styles.filterChipActive,
                ]}
                onPress={() => setStatusFilter(st)}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    statusFilter === st && styles.filterChipTextActive,
                  ]}
                >
                  {st.replace("_", " ")}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {/* List States */}
          {loading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.accent.cyan} />
              <Text style={styles.mutedText}>Loading your enquiries...</Text>
            </View>
          ) : fetchError ? (
            <View style={styles.centerContainer}>
              <Icon name="alert-circle-outline" size={44} color={colors.status.danger} />
              <Text style={styles.errorText}>{fetchError}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={loadEnquiries}>
                <Text style={styles.retryButtonText}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : enquiries.length === 0 ? (
            <View style={styles.centerContainer}>
              <Icon name="file-tray-outline" size={48} color={colors.text.muted} />
              <Text style={styles.emptyTitle}>No Enquiries Found</Text>
              <Text style={styles.mutedText}>
                {statusFilter === "ALL"
                  ? "You haven't opened any support or HR enquiries yet."
                  : `No enquiries matching '${statusFilter}'.`}
              </Text>
              <TouchableOpacity
                style={styles.ctaButton}
                onPress={() => setActiveTab("create")}
              >
                <Icon name="add-circle-outline" size={18} color="#FFFFFF" />
                <Text style={styles.ctaButtonText}>Open Support Ticket</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <FlatList
              data={enquiries}
              keyExtractor={(item) => item._id}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={() => {
                    setRefreshing(true);
                    loadEnquiries();
                  }}
                  tintColor={colors.accent.cyan}
                />
              }
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const isUnread =
                  item.firstResponseAt &&
                  item.status !== "CLOSED" &&
                  new Date(item.lastMessageAt).getTime() >
                    new Date(item.createdAt).getTime();

                return (
                  <TouchableOpacity
                    style={styles.ticketCard}
                    onPress={() => openThread(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.ticketHeader}>
                      <View style={styles.ticketHeaderLeft}>
                        <Text style={styles.ticketNumber}>{item.ticketNumber}</Text>
                        <View style={styles.categoryPill}>
                          <Text style={styles.categoryPillText}>{item.category}</Text>
                        </View>
                      </View>
                      <View
                        style={[
                          styles.statusBadge,
                          { backgroundColor: `${getStatusColor(item.status)}20` },
                        ]}
                      >
                        <View
                          style={[
                            styles.statusDot,
                            { backgroundColor: getStatusColor(item.status) },
                          ]}
                        />
                        <Text
                          style={[
                            styles.statusBadgeText,
                            { color: getStatusColor(item.status) },
                          ]}
                        >
                          {item.status.replace("_", " ")}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.ticketSubject} numberOfLines={2}>
                      {item.subject}
                    </Text>

                    <View style={styles.ticketFooter}>
                      <View style={styles.footerLeft}>
                        <Icon name="person-outline" size={14} color={colors.text.muted} />
                        <Text style={styles.footerAssignee}>
                          {item.assignee?.name || "Support Team"}
                        </Text>
                      </View>
                      <View style={styles.footerRight}>
                        {isUnread && <View style={styles.unreadDot} />}
                        <Text style={styles.footerDate}>
                          {new Date(item.lastMessageAt).toLocaleDateString(undefined, {
                            month: "short",
                            day: "numeric",
                          })}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      )}

      {/* ================================================================= */}
      {/* TAB 2: CREATE NEW TICKET FORM */}
      {/* ================================================================= */}
      {activeTab === "create" && (
        <ScrollView style={styles.formScroll} contentContainerStyle={styles.formContent}>
          <Text style={styles.formSectionHeader}>Select Category</Text>
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => {
              const isSelected = selectedCategory === cat.key;
              return (
                <TouchableOpacity
                  key={cat.key}
                  style={[styles.categoryCard, isSelected && styles.categoryCardActive]}
                  onPress={() => setSelectedCategory(cat.key)}
                >
                  <Icon
                    name={cat.icon}
                    size={20}
                    color={isSelected ? colors.accent.cyan : colors.text.muted}
                  />
                  <Text
                    style={[styles.categoryCardText, isSelected && styles.categoryCardTextActive]}
                  >
                    {cat.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.formSectionHeader}>Priority</Text>
          <View style={styles.priorityRow}>
            {PRIORITIES.map((p) => {
              const isSelected = selectedPriority === p.key;
              return (
                <TouchableOpacity
                  key={p.key}
                  style={[
                    styles.priorityChip,
                    isSelected && { borderColor: p.color, backgroundColor: `${p.color}15` },
                  ]}
                  onPress={() => setSelectedPriority(p.key)}
                >
                  <Text
                    style={[
                      styles.priorityChipText,
                      isSelected && { color: p.color, fontWeight: "700" },
                    ]}
                  >
                    {p.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={styles.formSectionHeader}>Subject</Text>
          <TextInput
            style={styles.textInput}
            placeholder="e.g. Missing punch correction on Monday"
            placeholderTextColor={colors.text.muted}
            value={subject}
            onChangeText={setSubject}
            maxLength={150}
          />

          <Text style={styles.formSectionHeader}>Message</Text>
          <TextInput
            style={[styles.textInput, styles.textArea]}
            placeholder="Describe your issue or request in detail..."
            placeholderTextColor={colors.text.muted}
            value={message}
            onChangeText={setMessage}
            multiline
            numberOfLines={4}
            maxLength={3000}
          />

          {/* Attachment Section */}
          <Text style={styles.formSectionHeader}>Attachment (Optional image, max 5MB)</Text>
          {selectedAttachment ? (
            <View style={styles.attachmentPreviewBox}>
              <Icon name="image-outline" size={24} color={colors.accent.cyan} />
              <View style={styles.attachmentInfo}>
                <Text style={styles.attachmentName} numberOfLines={1}>
                  {selectedAttachment.name}
                </Text>
                <Text style={styles.attachmentSize}>
                  {(selectedAttachment.sizeBytes / 1024).toFixed(1)} KB (Image)
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setSelectedAttachment(null)}
                style={styles.removeAttBtn}
              >
                <Icon name="close-circle" size={22} color={colors.status.danger} />
              </TouchableOpacity>
            </View>
          ) : (
            <TouchableOpacity
              style={styles.attachmentButton}
              onPress={() => pickMockAttachment(false)}
            >
              <Icon name="attach-outline" size={20} color={colors.accent.cyan} />
              <Text style={styles.attachmentButtonText}>Upload Image / Screenshot</Text>
            </TouchableOpacity>
          )}

          {/* Submit Button */}
          <TouchableOpacity
            style={[styles.submitButton, isSubmitting && styles.submitButtonDisabled]}
            onPress={handleCreateSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Icon name="paper-plane-outline" size={18} color="#FFFFFF" />
                <Text style={styles.submitButtonText}>Submit Enquiry Ticket</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      )}

      {/* ================================================================= */}
      {/* THREAD MODAL: CHAT CONVERSATION */}
      {/* ================================================================= */}
      <Modal
        visible={selectedEnquiry !== null}
        animationType="slide"
        onRequestClose={closeThread}
      >
        <KeyboardAvoidingView
          style={styles.modalContainer}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          {/* Thread Header */}
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={closeThread} style={styles.closeBtn}>
              <Icon name="arrow-back" size={22} color={colors.text.primary} />
            </TouchableOpacity>
            <View style={styles.modalTitleBlock}>
              <Text style={styles.modalTicketNum}>{selectedEnquiry?.ticketNumber}</Text>
              <Text style={styles.modalSubject} numberOfLines={1}>
                {selectedEnquiry?.subject}
              </Text>
            </View>
            <View
              style={[
                styles.modalStatusPill,
                { backgroundColor: `${getStatusColor(selectedEnquiry?.status || "OPEN")}25` },
              ]}
            >
              <Text
                style={[
                  styles.modalStatusText,
                  { color: getStatusColor(selectedEnquiry?.status || "OPEN") },
                ]}
              >
                {selectedEnquiry?.status.replace("_", " ")}
              </Text>
            </View>
          </View>

          {/* Thread Body */}
          {threadLoading ? (
            <View style={styles.centerContainer}>
              <ActivityIndicator size="large" color={colors.accent.cyan} />
              <Text style={styles.mutedText}>Loading conversation...</Text>
            </View>
          ) : (
            <FlatList
              data={messages}
              keyExtractor={(m) => m._id}
              contentContainerStyle={styles.messagesList}
              renderItem={({ item }) => {
                const isEmployee = item.senderRole === "EMPLOYEE";
                return (
                  <View
                    style={[
                      styles.messageBubbleContainer,
                      isEmployee ? styles.msgRight : styles.msgLeft,
                    ]}
                  >
                    {!isEmployee && (
                      <Text style={styles.senderRoleLabel}>HR Support</Text>
                    )}
                    <View
                      style={[
                        styles.bubble,
                        isEmployee ? styles.bubbleEmployee : styles.bubbleHr,
                      ]}
                    >
                      <Text
                        style={[
                          styles.messageText,
                          isEmployee ? styles.msgTextEmp : styles.msgTextHr,
                        ]}
                      >
                        {item.message}
                      </Text>

                      {/* Attachment Thumbnails */}
                      {item.attachments && item.attachments.length > 0 && (
                        <View style={styles.msgAttachmentGrid}>
                          {item.attachments.map((att, idx) => (
                            <TouchableOpacity
                              key={idx}
                              style={styles.thumbBox}
                              onPress={() => att.url && setLightboxImage(att.url)}
                            >
                              <Icon
                                name="image"
                                size={18}
                                color={isEmployee ? "#FFFFFF" : colors.accent.cyan}
                              />
                              <Text
                                style={[
                                  styles.thumbText,
                                  isEmployee ? { color: "#FFFFFF" } : { color: colors.text.primary },
                                ]}
                                numberOfLines={1}
                              >
                                {att.name}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      )}

                      <Text
                        style={[
                          styles.messageTime,
                          isEmployee ? styles.msgTimeEmp : styles.msgTimeHr,
                        ]}
                      >
                        {new Date(item.createdAt).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </Text>
                    </View>
                  </View>
                );
              }}
              ListFooterComponent={
                isHrTyping ? (
                  <View style={styles.typingIndicatorBox}>
                    <ActivityIndicator size="small" color={colors.accent.cyan} />
                    <Text style={styles.typingText}>HR Support is typing...</Text>
                  </View>
                ) : null
              }
            />
          )}

          {/* Banner if Closed or Resolved */}
          {selectedEnquiry &&
            (selectedEnquiry.status === "RESOLVED" || selectedEnquiry.status === "CLOSED") && (
              <View style={styles.resolvedBanner}>
                <View style={styles.resolvedInfo}>
                  <Icon name="checkmark-circle" size={18} color={colors.status.success} />
                  <Text style={styles.resolvedText}>
                    This enquiry was marked as {selectedEnquiry.status}.
                  </Text>
                </View>
                <TouchableOpacity
                  style={styles.reopenButton}
                  onPress={() => setShowReopenModal(true)}
                >
                  <Text style={styles.reopenButtonText}>Reopen Ticket</Text>
                </TouchableOpacity>
              </View>
            )}

          {/* Quick Reply Bar (Only active if OPEN or IN_PROGRESS) */}
          {selectedEnquiry &&
            selectedEnquiry.status !== "CLOSED" &&
            selectedEnquiry.status !== "RESOLVED" && (
              <View style={styles.replyBar}>
                {replyAttachment && (
                  <View style={styles.replyAttPill}>
                    <Icon name="attach" size={14} color={colors.accent.cyan} />
                    <Text style={styles.replyAttText} numberOfLines={1}>
                      {replyAttachment.name}
                    </Text>
                    <TouchableOpacity onPress={() => setReplyAttachment(null)}>
                      <Icon name="close" size={14} color={colors.status.danger} />
                    </TouchableOpacity>
                  </View>
                )}

                <View style={styles.replyInputRow}>
                  <TouchableOpacity
                    style={styles.attachIconBtn}
                    onPress={() => pickMockAttachment(true)}
                  >
                    <Icon name="attach" size={22} color={colors.accent.cyan} />
                  </TouchableOpacity>

                  <TextInput
                    style={styles.replyInput}
                    placeholder="Type your reply to HR..."
                    placeholderTextColor={colors.text.muted}
                    value={replyText}
                    onChangeText={(txt) => {
                      setReplyText(txt);
                      emitMobileSocketEvent("enquiry.typing", {
                        enquiryId: selectedEnquiry._id,
                        isTyping: txt.length > 0,
                      });
                    }}
                    multiline
                  />

                  <TouchableOpacity
                    style={[
                      styles.sendBtn,
                      (!replyText.trim() || isSendingReply) && styles.sendBtnDisabled,
                    ]}
                    onPress={handleSendReply}
                    disabled={!replyText.trim() || isSendingReply}
                  >
                    {isSendingReply ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Icon name="send" size={18} color="#FFFFFF" />
                    )}
                  </TouchableOpacity>
                </View>
              </View>
            )}
        </KeyboardAvoidingView>
      </Modal>

      {/* ================================================================= */}
      {/* REOPEN MODAL */}
      {/* ================================================================= */}
      <Modal
        visible={showReopenModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowReopenModal(false)}
      >
        <View style={styles.dialogOverlay}>
          <View style={styles.dialogCard}>
            <Text style={styles.dialogTitle}>Reopen Ticket</Text>
            <Text style={styles.dialogSubtitle}>
              Please provide the reason why this issue requires further assistance:
            </Text>
            <TextInput
              style={[styles.textInput, styles.textArea, { minHeight: 80 }]}
              placeholder="e.g. Punch record still appears absent..."
              placeholderTextColor={colors.text.muted}
              value={reopenReason}
              onChangeText={setReopenReason}
              multiline
            />
            <View style={styles.dialogButtons}>
              <TouchableOpacity
                style={styles.dialogCancel}
                onPress={() => setShowReopenModal(false)}
              >
                <Text style={styles.dialogCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.dialogConfirm, isReopening && styles.submitButtonDisabled]}
                onPress={handleReopen}
                disabled={isReopening}
              >
                {isReopening ? (
                  <ActivityIndicator size="small" color="#FFFFFF" />
                ) : (
                  <Text style={styles.dialogConfirmText}>Confirm Reopen</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================================================================= */}
      {/* IMAGE LIGHTBOX MODAL */}
      {/* ================================================================= */}
      <Modal visible={lightboxImage !== null} transparent animationType="fade">
        <View style={styles.lightboxOverlay}>
          <TouchableOpacity
            style={styles.lightboxClose}
            onPress={() => setLightboxImage(null)}
          >
            <Icon name="close" size={28} color="#FFFFFF" />
          </TouchableOpacity>
          {lightboxImage && (
            <Image
              source={{ uri: lightboxImage }}
              style={styles.lightboxImg}
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background.base,
  },
  tabBar: {
    flexDirection: "row",
    backgroundColor: colors.background.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  tabButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    paddingVertical: spacing.md,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabButtonActive: {
    borderBottomColor: colors.accent.cyan,
  },
  tabText: {
    fontSize: typography.sizes.sm,
    color: colors.text.muted,
    fontWeight: "600",
  },
  tabTextActive: {
    color: colors.accent.cyan,
  },
  tabContent: {
    flex: 1,
  },
  filterScroll: {
    maxHeight: 50,
    backgroundColor: colors.background.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
  },
  filterScrollContent: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: spacing.sm,
  },
  filterChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
    backgroundColor: colors.background.elevated,
  },
  filterChipActive: {
    backgroundColor: colors.accent.cyan,
  },
  filterChipText: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
    fontWeight: "600",
  },
  filterChipTextActive: {
    color: "#FFFFFF",
  },
  centerContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
    gap: spacing.sm,
  },
  mutedText: {
    fontSize: typography.sizes.sm,
    color: colors.text.muted,
    textAlign: "center",
  },
  emptyTitle: {
    fontSize: typography.sizes.md,
    fontWeight: "700",
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  ctaButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    backgroundColor: colors.accent.cyan,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    marginTop: spacing.md,
  },
  ctaButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: typography.sizes.sm,
  },
  errorText: {
    color: colors.status.danger,
    fontSize: typography.sizes.sm,
    textAlign: "center",
  },
  retryButton: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xs,
    backgroundColor: colors.background.elevated,
    borderRadius: radii.md,
    marginTop: spacing.sm,
  },
  retryButtonText: {
    color: colors.text.primary,
    fontWeight: "600",
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  ticketCard: {
    backgroundColor: colors.background.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    gap: spacing.xs,
  },
  ticketHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  ticketHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  ticketNumber: {
    fontSize: typography.sizes.xs,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: colors.accent.cyan,
  },
  categoryPill: {
    backgroundColor: colors.background.elevated,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  categoryPillText: {
    fontSize: 10,
    color: colors.text.secondary,
    fontWeight: "600",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  statusBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  ticketSubject: {
    fontSize: typography.sizes.sm,
    fontWeight: "600",
    color: colors.text.primary,
    marginTop: spacing.xs,
  },
  ticketFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  footerAssignee: {
    fontSize: typography.sizes.xs,
    color: colors.text.muted,
  },
  footerRight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.status.danger,
  },
  footerDate: {
    fontSize: typography.sizes.xs,
    color: colors.text.muted,
  },

  // Form Styles
  formScroll: {
    flex: 1,
  },
  formContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  formSectionHeader: {
    fontSize: typography.sizes.xs,
    fontWeight: "700",
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginTop: spacing.sm,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.sm,
  },
  categoryCard: {
    width: "31%",
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    alignItems: "center",
    gap: 4,
  },
  categoryCardActive: {
    borderColor: colors.accent.cyan,
    backgroundColor: `${colors.accent.cyan}15`,
  },
  categoryCardText: {
    fontSize: 11,
    color: colors.text.muted,
    fontWeight: "600",
  },
  categoryCardTextActive: {
    color: colors.accent.cyan,
  },
  priorityRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  priorityChip: {
    flex: 1,
    paddingVertical: spacing.xs,
    alignItems: "center",
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    backgroundColor: colors.background.surface,
  },
  priorityChipText: {
    fontSize: typography.sizes.xs,
    color: colors.text.muted,
  },
  textInput: {
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radii.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    color: colors.text.primary,
    fontSize: typography.sizes.sm,
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: "top",
  },
  attachmentButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.accent.cyan,
    borderRadius: radii.md,
    paddingVertical: spacing.md,
    backgroundColor: `${colors.accent.cyan}10`,
  },
  attachmentButtonText: {
    color: colors.accent.cyan,
    fontWeight: "600",
    fontSize: typography.sizes.xs,
  },
  attachmentPreviewBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderRadius: radii.md,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentName: {
    fontSize: typography.sizes.xs,
    fontWeight: "600",
    color: colors.text.primary,
  },
  attachmentSize: {
    fontSize: 10,
    color: colors.text.muted,
  },
  removeAttBtn: {
    padding: 2,
  },
  submitButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    backgroundColor: colors.accent.cyan,
    paddingVertical: spacing.md,
    borderRadius: radii.md,
    marginTop: spacing.md,
  },
  submitButtonDisabled: {
    opacity: 0.6,
  },
  submitButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: typography.sizes.sm,
  },

  // Modal / Thread Styles
  modalContainer: {
    flex: 1,
    backgroundColor: colors.background.base,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.surface,
    paddingHorizontal: spacing.md,
    paddingTop: Platform.OS === "ios" ? spacing.xl : spacing.md,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border.subtle,
    gap: spacing.sm,
  },
  closeBtn: {
    padding: 4,
  },
  modalTitleBlock: {
    flex: 1,
  },
  modalTicketNum: {
    fontSize: 11,
    fontWeight: "700",
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
    color: colors.accent.cyan,
  },
  modalSubject: {
    fontSize: typography.sizes.sm,
    fontWeight: "700",
    color: colors.text.primary,
  },
  modalStatusPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  modalStatusText: {
    fontSize: 10,
    fontWeight: "700",
  },
  messagesList: {
    padding: spacing.md,
    gap: spacing.md,
  },
  messageBubbleContainer: {
    maxWidth: "80%",
  },
  msgRight: {
    alignSelf: "flex-end",
  },
  msgLeft: {
    alignSelf: "flex-start",
  },
  senderRoleLabel: {
    fontSize: 10,
    color: colors.text.muted,
    marginBottom: 2,
    marginLeft: 4,
    fontWeight: "600",
  },
  bubble: {
    padding: spacing.sm,
    borderRadius: radii.lg,
  },
  bubbleEmployee: {
    backgroundColor: colors.accent.cyan,
    borderBottomRightRadius: radii.xs,
  },
  bubbleHr: {
    backgroundColor: colors.background.surface,
    borderWidth: 1,
    borderColor: colors.border.subtle,
    borderBottomLeftRadius: radii.xs,
  },
  messageText: {
    fontSize: typography.sizes.sm,
    lineHeight: 18,
  },
  msgTextEmp: {
    color: "#FFFFFF",
  },
  msgTextHr: {
    color: colors.text.primary,
  },
  msgAttachmentGrid: {
    marginTop: spacing.xs,
    gap: spacing.xs,
  },
  thumbBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.15)",
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  thumbText: {
    fontSize: 10,
    fontWeight: "600",
  },
  messageTime: {
    fontSize: 9,
    alignSelf: "flex-end",
    marginTop: 4,
  },
  msgTimeEmp: {
    color: "rgba(255,255,255,0.7)",
  },
  msgTimeHr: {
    color: colors.text.muted,
  },
  typingIndicatorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.sm,
    alignSelf: "flex-start",
  },
  typingText: {
    fontSize: 11,
    color: colors.text.muted,
    fontStyle: "italic",
  },
  resolvedBanner: {
    backgroundColor: colors.background.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    padding: spacing.md,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  resolvedInfo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
    flex: 1,
  },
  resolvedText: {
    fontSize: typography.sizes.xs,
    color: colors.text.secondary,
  },
  reopenButton: {
    backgroundColor: colors.accent.cyan,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
  },
  reopenButtonText: {
    color: "#FFFFFF",
    fontSize: typography.sizes.xs,
    fontWeight: "700",
  },
  replyBar: {
    backgroundColor: colors.background.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border.subtle,
    padding: spacing.sm,
  },
  replyAttPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.background.elevated,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radii.full,
    alignSelf: "flex-start",
    marginBottom: 6,
  },
  replyAttText: {
    fontSize: 10,
    color: colors.text.primary,
    maxWidth: 160,
  },
  replyInputRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  attachIconBtn: {
    padding: 6,
  },
  replyInput: {
    flex: 1,
    backgroundColor: colors.background.elevated,
    borderRadius: radii.full,
    paddingHorizontal: spacing.md,
    paddingVertical: Platform.OS === "ios" ? spacing.sm : 6,
    color: colors.text.primary,
    fontSize: typography.sizes.sm,
    maxHeight: 90,
  },
  sendBtn: {
    backgroundColor: colors.accent.cyan,
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: {
    opacity: 0.4,
  },

  // Dialog Styles
  dialogOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  dialogCard: {
    width: "100%",
    backgroundColor: colors.background.surface,
    borderRadius: radii.xl,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  dialogTitle: {
    fontSize: typography.sizes.md,
    fontWeight: "700",
    color: colors.text.primary,
  },
  dialogSubtitle: {
    fontSize: typography.sizes.xs,
    color: colors.text.muted,
  },
  dialogButtons: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  dialogCancel: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  dialogCancelText: {
    color: colors.text.muted,
    fontWeight: "600",
  },
  dialogConfirm: {
    backgroundColor: colors.accent.cyan,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  dialogConfirmText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },

  // Lightbox Styles
  lightboxOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
    alignItems: "center",
  },
  lightboxClose: {
    position: "absolute",
    top: 50,
    right: 20,
    zIndex: 10,
    padding: 8,
  },
  lightboxImg: {
    width: "90%",
    height: "70%",
  },
});
