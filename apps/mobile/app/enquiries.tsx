import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  ScrollView,
  TextInput,
  Modal,
  Image,
  RefreshControl,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Stack } from 'expo-router';
import {
  ArrowLeft,
  Clock,
  Calendar,
  Home,
  CreditCard,
  Wrench,
  HelpCircle,
  Send,
  Paperclip,
  X,
  Plus,
  RotateCcw,
  User,
  Image as ImageIcon,
  MessageSquare,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  type LucideIcon,
} from 'lucide-react-native';
import {
  Screen,
  ScreenHeader,
  Card,
  Badge,
  Button,
  Text,
  PressableScale,
  Skeleton,
} from '../src/components';
import { useToast } from '../src/components/Toast';
import { colors, fonts, radii, spacing, type Tone } from '../src/theme/tokens';
import { useResponsive } from '../src/lib/responsive';
import {
  enquiryApi,
  MobileEnquiryItem,
  EnquiryMessageItem,
  EnquiryAttachmentItem,
  subscribeToSocketEvent,
  emitMobileSocketEvent,
} from '../src/services';

type CategoryType = 'ATTENDANCE' | 'LEAVE' | 'WFH' | 'PAYROLL' | 'TECHNICAL' | 'OTHER';
type PriorityType = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type StatusFilterType = 'ALL' | 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';

interface CategoryOption {
  key: CategoryType;
  label: string;
  sub: string;
  icon: LucideIcon;
}

const CATEGORIES: CategoryOption[] = [
  { key: 'ATTENDANCE', label: 'Attendance', sub: 'Punch dispute, late check-in', icon: Clock },
  { key: 'LEAVE', label: 'Leave', sub: 'Emergency leave, balances', icon: Calendar },
  { key: 'WFH', label: 'WFH', sub: 'Remote quota, setup check', icon: Home },
  { key: 'PAYROLL', label: 'Payroll', sub: 'Salary slips, deductions', icon: CreditCard },
  { key: 'TECHNICAL', label: 'Technical', sub: 'App error, device pairing', icon: Wrench },
  { key: 'OTHER', label: 'General', sub: 'Company policy, workplace', icon: HelpCircle },
];

const PRIORITIES: { key: PriorityType; label: string; tone: Tone; color: string }[] = [
  { key: 'LOW', label: 'Low', tone: 'neutral', color: colors.muted },
  { key: 'MEDIUM', label: 'Medium', tone: 'info', color: colors.info },
  { key: 'HIGH', label: 'High', tone: 'warning', color: colors.warning },
  { key: 'URGENT', label: 'Urgent', tone: 'danger', color: colors.danger },
];

interface SocketMessagePayload {
  enquiryId?: string;
  messageId?: string;
  senderId?: string;
  senderRole?: 'EMPLOYEE' | 'HR' | 'ADMIN';
  message?: string;
  attachments?: EnquiryAttachmentItem[];
  createdAt?: string;
}

interface SocketStatusPayload {
  enquiryId?: string;
  status?: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  reopenDeadline?: string | null;
}

interface SocketAssignedPayload {
  enquiryId?: string;
  assigneeId?: string;
  assigneeName?: string;
}

interface SocketTypingPayload {
  enquiryId?: string;
  role?: string;
  isTyping?: boolean;
}

function getErrorMessage(err: unknown, fallback: string): string {
  if (err && typeof err === 'object' && 'message' in err && typeof (err as { message: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  return fallback;
}

function formatEnquiryDate(isoString: string): string {
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

export default function EnquiriesScreen() {
  const { showToast } = useToast();
  const { isWide } = useResponsive();

  const [activeTab, setActiveTab] = useState<'list' | 'create'>('list');
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [enquiries, setEnquiries] = useState<MobileEnquiryItem[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilterType>('ALL');
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Form State
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('ATTENDANCE');
  const [selectedPriority, setSelectedPriority] = useState<PriorityType>('MEDIUM');
  const [subject, setSubject] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [selectedAttachment, setSelectedAttachment] = useState<EnquiryAttachmentItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Thread Modal State
  const [selectedEnquiry, setSelectedEnquiry] = useState<MobileEnquiryItem | null>(null);
  const [messages, setMessages] = useState<EnquiryMessageItem[]>([]);
  const [threadLoading, setThreadLoading] = useState<boolean>(false);
  const [replyText, setReplyText] = useState<string>('');
  const [replyAttachment, setReplyAttachment] = useState<EnquiryAttachmentItem | null>(null);
  const [isSendingReply, setIsSendingReply] = useState<boolean>(false);
  const [isHrTyping, setIsHrTyping] = useState<boolean>(false);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const flatListRef = useRef<FlatList>(null);

  // Reopen Modal
  const [showReopenModal, setShowReopenModal] = useState<boolean>(false);
  const [reopenReason, setReopenReason] = useState<string>('');
  const [isReopening, setIsReopening] = useState<boolean>(false);

  // Image Lightbox
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // Fetch list of user's enquiries
  const loadEnquiries = useCallback(async () => {
    try {
      setFetchError(null);
      const params = statusFilter === 'ALL' ? undefined : { status: statusFilter };
      const res = await enquiryApi.getMyEnquiries(params);
      if (res.success) {
        setEnquiries(res.data || []);
      }
    } catch (err: unknown) {
      console.error('Failed to load enquiries:', err);
      setFetchError(getErrorMessage(err, 'Failed to load enquiries.'));
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
      emitMobileSocketEvent('enquiry.join', ticket._id);

      const res = await enquiryApi.getEnquiryById(ticket._id);
      if (res.success) {
        setSelectedEnquiry(res.data);
        setMessages(res.messages || []);
      }
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to open enquiry thread.'), 'error');
    } finally {
      setThreadLoading(false);
    }
  };

  const closeThread = () => {
    if (selectedEnquiry) {
      emitMobileSocketEvent('enquiry.leave', selectedEnquiry._id);
    }
    setSelectedEnquiry(null);
    setMessages([]);
    setReplyText('');
    setReplyAttachment(null);
    setIsHrTyping(false);
  };

  // Socket Subscriptions
  useEffect(() => {
    const unsubCreated = subscribeToSocketEvent('enquiry.created', () => {
      loadEnquiries();
    });

    const unsubMsg = subscribeToSocketEvent('enquiry.message_received', (payload: unknown) => {
      const data = payload as SocketMessagePayload | undefined;
      loadEnquiries();
      if (selectedEnquiry && data?.enquiryId === selectedEnquiry._id) {
        setMessages((prev) => {
          if (prev.some((m) => m._id === data.messageId)) return prev;
          const newMsg: EnquiryMessageItem = {
            _id: data.messageId || String(Date.now()),
            enquiry: data.enquiryId || selectedEnquiry._id,
            sender: data.senderId || 'HR',
            senderRole: data.senderRole || 'HR',
            message: data.message || '',
            attachments: data.attachments || [],
            readByRecipient: true,
            createdAt: data.createdAt || new Date().toISOString(),
          };
          return [...prev, newMsg];
        });
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 150);
      }
    });

    const unsubStatus = subscribeToSocketEvent('enquiry.status_updated', (payload: unknown) => {
      const data = payload as SocketStatusPayload | undefined;
      loadEnquiries();
      if (selectedEnquiry && data?.enquiryId === selectedEnquiry._id) {
        setSelectedEnquiry((prev) =>
          prev ? { ...prev, status: data.status || prev.status, reopenDeadline: data.reopenDeadline } : null
        );
      }
    });

    const unsubAssigned = subscribeToSocketEvent('enquiry.assigned', (payload: unknown) => {
      const data = payload as SocketAssignedPayload | undefined;
      loadEnquiries();
      if (selectedEnquiry && data?.enquiryId === selectedEnquiry._id) {
        setSelectedEnquiry((prev) =>
          prev
            ? {
                ...prev,
                assignee: {
                  _id: data.assigneeId || '',
                  name: data.assigneeName,
                  email: data.assigneeName || 'HR Support',
                },
              }
            : null
        );
      }
    });

    const unsubTyping = subscribeToSocketEvent('enquiry.typing', (payload: unknown) => {
      const data = payload as SocketTypingPayload | undefined;
      if (
        selectedEnquiry &&
        data?.enquiryId === selectedEnquiry._id &&
        data?.role !== 'EMPLOYEE'
      ) {
        setIsHrTyping(Boolean(data.isTyping));
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        if (data.isTyping) {
          typingTimeoutRef.current = setTimeout(() => {
            setIsHrTyping(false);
          }, 4000);
        }
      }
    });

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
      showToast('Please enter an enquiry subject.', 'warning');
      return;
    }
    if (!message.trim()) {
      showToast('Please describe your enquiry in detail.', 'warning');
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
        showToast(`Ticket ${res.data.ticketNumber} submitted!`, 'success');
        setSubject('');
        setMessage('');
        setSelectedAttachment(null);
        setActiveTab('list');
        loadEnquiries();
      }
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to submit enquiry ticket.'), 'error');
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
        setReplyText('');
        setReplyAttachment(null);
        emitMobileSocketEvent('enquiry.typing', {
          enquiryId: selectedEnquiry._id,
          isTyping: false,
        });
        setTimeout(() => {
          flatListRef.current?.scrollToEnd({ animated: true });
        }, 150);
      }
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to send message.'), 'error');
    } finally {
      setIsSendingReply(false);
    }
  };

  // Handle Reopen Ticket
  const handleReopen = async () => {
    if (!selectedEnquiry || !reopenReason.trim()) {
      showToast('Please provide a reason to reopen this ticket.', 'warning');
      return;
    }

    setIsReopening(true);
    try {
      const res = await enquiryApi.reopenEnquiry(selectedEnquiry._id, reopenReason.trim());
      if (res.success) {
        showToast('Ticket successfully reopened!', 'success');
        setShowReopenModal(false);
        setReopenReason('');
        setSelectedEnquiry(res.data);
        openThread(res.data);
      }
    } catch (err: unknown) {
      showToast(getErrorMessage(err, 'Failed to reopen enquiry.'), 'error');
    } finally {
      setIsReopening(false);
    }
  };

  // Mock Attachment Picker
  const pickMockAttachment = (isReply = false) => {
    const timestamp = Date.now().toString().slice(-4);
    const mockAtt: EnquiryAttachmentItem = {
      name: `screenshot_${timestamp}.png`,
      mimeType: 'image/png',
      sizeBytes: 184320,
      url: 'https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=600&auto=format&fit=crop&q=80',
    };

    if (isReply) {
      setReplyAttachment(mockAtt);
      showToast('Image attached to reply.', 'info');
    } else {
      setSelectedAttachment(mockAtt);
      showToast('Screenshot attached successfully.', 'info');
    }
  };

  const getStatusTone = (status: string): Tone => {
    switch (status) {
      case 'OPEN':
        return 'info';
      case 'IN_PROGRESS':
        return 'warning';
      case 'RESOLVED':
        return 'success';
      case 'CLOSED':
      default:
        return 'neutral';
    }
  };

  const getCategoryIcon = (catKey: string): LucideIcon => {
    const found = CATEGORIES.find((c) => c.key === catKey);
    return found ? found.icon : HelpCircle;
  };

  // Status Filter Counts
  const counts = useMemo(() => {
    return {
      all: enquiries.length,
      open: enquiries.filter((e) => e.status === 'OPEN').length,
      inProgress: enquiries.filter((e) => e.status === 'IN_PROGRESS').length,
      resolved: enquiries.filter((e) => e.status === 'RESOLVED').length,
      closed: enquiries.filter((e) => e.status === 'CLOSED').length,
    };
  }, [enquiries]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <Screen
        edges={['left', 'right', 'bottom']}
        refreshControl={
          activeTab === 'list' ? (
            <RefreshControl
              colors={[colors.indigoSoft]}
              onRefresh={() => {
                setRefreshing(true);
                loadEnquiries();
              }}
              refreshing={refreshing}
              tintColor={colors.indigoSoft}
            />
          ) : undefined
        }
      >
        {/* Screen Header */}
        <ScreenHeader
          title="Helpdesk & Enquiries"
          subtitle="HR support, dispute resolution & queries"
          right={
            <Badge
              label={activeTab === 'list' ? `${enquiries.length} TICKETS` : 'NEW'}
              tone={activeTab === 'list' ? 'indigo' : 'info'}
              size="sm"
            />
          }
        />

        <View style={[styles.container, isWide && styles.containerWide]}>
          {/* Main Tab Switcher (Segmented Glass Navigation) */}
          <View style={styles.segmentWrapper}>
            <View style={styles.segmentedControl}>
              <PressableScale
                onPress={() => setActiveTab('list')}
                style={[
                  styles.segmentButton,
                  activeTab === 'list' && styles.segmentButtonActive,
                ]}
              >
                <MessageSquare
                  size={15}
                  color={activeTab === 'list' ? colors.white : colors.muted}
                  strokeWidth={2}
                />
                <Text
                  variant="caption"
                  weight={activeTab === 'list' ? 'bold' : 'medium'}
                  color={activeTab === 'list' ? colors.white : colors.muted}
                >
                  My Tickets ({enquiries.length})
                </Text>
              </PressableScale>

              <PressableScale
                onPress={() => setActiveTab('create')}
                style={[
                  styles.segmentButton,
                  activeTab === 'create' && styles.segmentButtonActive,
                ]}
              >
                <Plus
                  size={15}
                  color={activeTab === 'create' ? colors.white : colors.muted}
                  strokeWidth={2.2}
                />
                <Text
                  variant="caption"
                  weight={activeTab === 'create' ? 'bold' : 'medium'}
                  color={activeTab === 'create' ? colors.white : colors.muted}
                >
                  New Ticket
                </Text>
              </PressableScale>
            </View>
          </View>

          {/* ================================================================= */}
          {/* TAB 1: LIST OF ENQUIRIES */}
          {/* ================================================================= */}
          {activeTab === 'list' && (
            <View style={styles.tabContent}>
              {/* Status Filter Horizontal Pills */}
              <View style={styles.filterBar}>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.filterScroll}
                >
                  {(
                    [
                      { key: 'ALL', label: `All (${counts.all})` },
                      { key: 'OPEN', label: `Open (${counts.open})` },
                      { key: 'IN_PROGRESS', label: `In Progress (${counts.inProgress})` },
                      { key: 'RESOLVED', label: `Resolved (${counts.resolved})` },
                      { key: 'CLOSED', label: `Closed (${counts.closed})` },
                    ] as const
                  ).map((f) => {
                    const isActive = statusFilter === f.key;
                    return (
                      <PressableScale
                        key={f.key}
                        onPress={() => setStatusFilter(f.key)}
                        style={[styles.filterPill, isActive && styles.filterPillActive]}
                      >
                        <Text
                          variant="caption"
                          color={isActive ? colors.text : colors.muted}
                          weight={isActive ? 'bold' : 'medium'}
                        >
                          {f.label}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </ScrollView>
              </View>

              {/* State: Loading */}
              {loading && !refreshing ? (
                <View style={styles.skeletonContainer}>
                  {[1, 2, 3].map((key) => (
                    <Card key={key} variant="glass" padding={spacing.lg} style={styles.cardSpacing}>
                      <View style={styles.rowBetween}>
                        <Skeleton width="30%" height={14} borderRadius={radii.xs} />
                        <Skeleton width="22%" height={18} borderRadius={radii.full} />
                      </View>
                      <View style={styles.skeletonSpacer} />
                      <Skeleton width="85%" height={18} borderRadius={radii.xs} />
                      <View style={styles.skeletonSpacer} />
                      <View style={styles.rowBetween}>
                        <Skeleton width="40%" height={12} borderRadius={radii.xs} />
                        <Skeleton width="20%" height={12} borderRadius={radii.xs} />
                      </View>
                    </Card>
                  ))}
                </View>
              ) : fetchError ? (
                <Card variant="glass" padding={spacing.xl} style={styles.emptyCard}>
                  <AlertCircle size={38} color={colors.danger} strokeWidth={1.8} />
                  <Text variant="subheading" color={colors.text} style={styles.emptyTitle}>
                    Failed to Load Enquiries
                  </Text>
                  <Text variant="caption" color={colors.muted} style={styles.emptyDesc}>
                    {fetchError}
                  </Text>
                  <Button
                    label="Retry"
                    size="sm"
                    variant="secondary"
                    onPress={loadEnquiries}
                    style={styles.retryBtn}
                  />
                </Card>
              ) : enquiries.length === 0 ? (
                <Card variant="glass" padding={spacing.xl} style={styles.emptyCard}>
                  <View style={styles.emptyIconCircle}>
                    <HelpCircle size={32} color={colors.indigoSoft} strokeWidth={1.8} />
                  </View>
                  <Text variant="subheading" color={colors.text} style={styles.emptyTitle}>
                    No Enquiries Found
                  </Text>
                  <Text variant="caption" color={colors.muted} style={styles.emptyDesc}>
                    {statusFilter === 'ALL'
                      ? 'You have not opened any dispute or HR support tickets yet.'
                      : `There are currently no tickets matching '${statusFilter.replace('_', ' ')}'.`}
                  </Text>
                  <Button
                    label="Open Support Ticket"
                    size="sm"
                    variant="primary"
                    icon={<Plus size={16} color={colors.white} strokeWidth={2.4} />}
                    onPress={() => setActiveTab('create')}
                    style={styles.emptyActionBtn}
                  />
                </Card>
              ) : (
                <View style={styles.ticketsList}>
                  {enquiries.map((item) => {
                    const CatIcon = getCategoryIcon(item.category);
                    const statusTone = getStatusTone(item.status);
                    const isUnread =
                      item.firstResponseAt &&
                      item.status !== 'CLOSED' &&
                      new Date(item.lastMessageAt).getTime() >
                        new Date(item.createdAt).getTime();

                    return (
                      <Card
                        key={item._id}
                        variant="glass"
                        padding={spacing.lg}
                        style={styles.ticketCard}
                        onPress={() => openThread(item)}
                      >
                        {/* Header: Ticket Number, Category Pill, Status Badge */}
                        <View style={styles.ticketCardHeader}>
                          <View style={styles.ticketMetaLeft}>
                            <Text variant="mono" style={styles.ticketNumber}>
                              #{item.ticketNumber}
                            </Text>
                            <View style={styles.categoryBadge}>
                              <CatIcon size={12} color={colors.indigoSoft} strokeWidth={2} />
                              <Text variant="caption" color={colors.textSecondary} weight="semibold">
                                {item.category}
                              </Text>
                            </View>
                          </View>

                          <Badge
                            label={item.status.replace('_', ' ')}
                            tone={statusTone}
                            size="sm"
                            dot
                          />
                        </View>

                        {/* Subject */}
                        <Text
                          variant="body"
                          weight="semibold"
                          color={colors.text}
                          numberOfLines={2}
                          style={styles.ticketSubject}
                        >
                          {item.subject}
                        </Text>

                        {/* Footer: Assignee & Date */}
                        <View style={styles.ticketFooter}>
                          <View style={styles.assigneeRow}>
                            <View style={styles.assigneeAvatar}>
                              <User size={11} color={colors.muted} strokeWidth={2} />
                            </View>
                            <Text variant="small" color={colors.muted}>
                              {item.assignee?.name || 'HR Support'}
                            </Text>
                          </View>

                          <View style={styles.footerDateRow}>
                            {isUnread && <View style={styles.unreadPulseDot} />}
                            <Text variant="small" color={colors.muted}>
                              {formatEnquiryDate(item.lastMessageAt)}
                            </Text>
                            <ChevronRight size={14} color={colors.muted} strokeWidth={2} />
                          </View>
                        </View>
                      </Card>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* ================================================================= */}
          {/* TAB 2: CREATE NEW TICKET FORM */}
          {/* ================================================================= */}
          {activeTab === 'create' && (
            <View style={styles.formContent}>
              {/* Category Section */}
              <View style={styles.formSection}>
                <Text variant="caption" weight="bold" color={colors.textSecondary} style={styles.sectionHeading}>
                  SELECT CATEGORY
                </Text>

                <View style={styles.categoriesGrid}>
                  {CATEGORIES.map((cat) => {
                    const isSelected = selectedCategory === cat.key;
                    const IconComp = cat.icon;
                    return (
                      <PressableScale
                        key={cat.key}
                        onPress={() => setSelectedCategory(cat.key)}
                        style={[
                          styles.categoryCard,
                          isSelected && styles.categoryCardSelected,
                        ]}
                      >
                        <View
                          style={[
                            styles.categoryIconCircle,
                            isSelected && styles.categoryIconCircleSelected,
                          ]}
                        >
                          <IconComp
                            size={18}
                            color={isSelected ? colors.white : colors.indigoSoft}
                            strokeWidth={2}
                          />
                        </View>
                        <Text
                          variant="body"
                          weight={isSelected ? 'bold' : 'medium'}
                          color={isSelected ? colors.white : colors.text}
                          numberOfLines={1}
                        >
                          {cat.label}
                        </Text>
                        <Text
                          variant="small"
                          color={isSelected ? colors.lavender : colors.muted}
                          numberOfLines={1}
                        >
                          {cat.sub}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </View>

              {/* Priority Section */}
              <View style={styles.formSection}>
                <Text variant="caption" weight="bold" color={colors.textSecondary} style={styles.sectionHeading}>
                  PRIORITY LEVEL
                </Text>
                <View style={styles.priorityRow}>
                  {PRIORITIES.map((p) => {
                    const isSelected = selectedPriority === p.key;
                    return (
                      <PressableScale
                        key={p.key}
                        onPress={() => setSelectedPriority(p.key)}
                        style={[
                          styles.priorityPill,
                          isSelected && {
                            backgroundColor: `${p.color}22`,
                            borderColor: p.color,
                          },
                        ]}
                      >
                        <Text
                          variant="caption"
                          weight={isSelected ? 'bold' : 'medium'}
                          color={isSelected ? p.color : colors.muted}
                        >
                          {p.label}
                        </Text>
                      </PressableScale>
                    );
                  })}
                </View>
              </View>

              {/* Subject Input */}
              <View style={styles.formSection}>
                <View style={styles.labelRow}>
                  <Text variant="caption" weight="bold" color={colors.textSecondary} style={styles.sectionHeading}>
                    SUBJECT SUMMARY
                  </Text>
                  <Text variant="small" color={colors.muted}>
                    {subject.length}/150
                  </Text>
                </View>
                <TextInput
                  style={styles.textInput}
                  placeholder="e.g. Punch timestamp correction for Oct 28"
                  placeholderTextColor={colors.muted}
                  value={subject}
                  onChangeText={setSubject}
                  maxLength={150}
                />
              </View>

              {/* Message Input */}
              <View style={styles.formSection}>
                <View style={styles.labelRow}>
                  <Text variant="caption" weight="bold" color={colors.textSecondary} style={styles.sectionHeading}>
                    DETAILED DESCRIPTION
                  </Text>
                  <Text variant="small" color={colors.muted}>
                    {message.length}/3000
                  </Text>
                </View>
                <TextInput
                  style={[styles.textInput, styles.textArea]}
                  placeholder="Explain what happened in detail (punch time, system errors, device used)..."
                  placeholderTextColor={colors.muted}
                  value={message}
                  onChangeText={setMessage}
                  multiline
                  numberOfLines={4}
                  maxLength={3000}
                />
              </View>

              {/* Optional Attachment */}
              <View style={styles.formSection}>
                <Text variant="caption" weight="bold" color={colors.textSecondary} style={styles.sectionHeading}>
                  ATTACHMENT (OPTIONAL)
                </Text>

                {selectedAttachment ? (
                  <View style={styles.attachmentCard}>
                    <View style={styles.attachmentIconBox}>
                      <ImageIcon size={20} color={colors.indigoSoft} strokeWidth={2} />
                    </View>
                    <View style={styles.attachmentMeta}>
                      <Text variant="body" weight="semibold" color={colors.text} numberOfLines={1}>
                        {selectedAttachment.name}
                      </Text>
                      <Text variant="small" color={colors.muted}>
                        {(selectedAttachment.sizeBytes / 1024).toFixed(1)} KB • PNG Screenshot
                      </Text>
                    </View>
                    <PressableScale
                      onPress={() => setSelectedAttachment(null)}
                      style={styles.removeAttButton}
                    >
                      <X size={16} color={colors.danger} strokeWidth={2.4} />
                    </PressableScale>
                  </View>
                ) : (
                  <PressableScale
                    onPress={() => pickMockAttachment(false)}
                    style={styles.attachDashedButton}
                  >
                    <Paperclip size={18} color={colors.indigoSoft} strokeWidth={2} />
                    <Text variant="caption" weight="semibold" color={colors.indigoSoft}>
                      Attach Screenshot or Document
                    </Text>
                  </PressableScale>
                )}
              </View>

              {/* Submit Button */}
              <Button
                label="Submit Enquiry Ticket"
                size="lg"
                variant="primary"
                loading={isSubmitting}
                icon={<Send size={18} color={colors.white} strokeWidth={2.2} />}
                onPress={handleCreateSubmit}
                style={styles.submitTicketBtn}
              />
            </View>
          )}
        </View>

        {/* ================================================================= */}
        {/* CHAT THREAD MODAL (REAL-TIME HR CONVERSATION) */}
        {/* ================================================================= */}
        <Modal
          visible={selectedEnquiry !== null}
          animationType="slide"
          onRequestClose={closeThread}
          transparent={false}
        >
          <Screen scroll={false} edges={['left', 'right', 'bottom']}>
            <KeyboardAvoidingView
              style={styles.modalBody}
              behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            >
              {/* Modal Top Navigation Bar */}
              <View style={styles.modalHeader}>
                <PressableScale onPress={closeThread} style={styles.modalBackBtn}>
                  <ArrowLeft size={20} color={colors.text} strokeWidth={2} />
                </PressableScale>

                <View style={styles.modalTitleBlock}>
                  <View style={styles.modalTopMetaRow}>
                    <Text variant="mono" style={styles.modalTicketNumber}>
                      #{selectedEnquiry?.ticketNumber}
                    </Text>
                    <Badge
                      label={selectedEnquiry?.status.replace('_', ' ') || 'OPEN'}
                      tone={getStatusTone(selectedEnquiry?.status || 'OPEN')}
                      size="sm"
                      dot
                    />
                  </View>
                  <Text variant="subheading" color={colors.text} numberOfLines={1}>
                    {selectedEnquiry?.subject}
                  </Text>
                </View>
              </View>

              {/* Thread Content */}
              {threadLoading ? (
                <View style={styles.centerContainer}>
                  <ActivityIndicator size="large" color={colors.indigo} />
                  <Text variant="caption" color={colors.muted} style={styles.loadingText}>
                    Connecting to HR live thread...
                  </Text>
                </View>
              ) : (
                <FlatList
                  ref={flatListRef}
                  data={messages}
                  keyExtractor={(m) => m._id}
                  contentContainerStyle={styles.messagesList}
                  showsVerticalScrollIndicator={false}
                  onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: false })}
                  renderItem={({ item }) => {
                    const isEmployee = item.senderRole === 'EMPLOYEE';
                    return (
                      <View
                        style={[
                          styles.messageRow,
                          isEmployee ? styles.msgRowRight : styles.msgRowLeft,
                        ]}
                      >
                        {!isEmployee && (
                          <View style={styles.senderPill}>
                            <User size={10} color={colors.indigoSoft} strokeWidth={2} />
                            <Text variant="small" weight="bold" color={colors.indigoSoft}>
                              HR Support
                            </Text>
                          </View>
                        )}

                        <View
                          style={[
                            styles.messageBubble,
                            isEmployee ? styles.bubbleEmployee : styles.bubbleHr,
                          ]}
                        >
                          <Text
                            variant="body"
                            color={isEmployee ? colors.white : colors.text}
                            style={styles.messageText}
                          >
                            {item.message}
                          </Text>

                          {/* Message Attachments */}
                          {item.attachments && item.attachments.length > 0 && (
                            <View style={styles.msgAttachments}>
                              {item.attachments.map((att: EnquiryAttachmentItem, idx: number) => (
                                <PressableScale
                                  key={idx}
                                  onPress={() => att.url && setLightboxImage(att.url)}
                                  style={styles.msgAttachmentThumbnail}
                                >
                                  <ImageIcon
                                    size={14}
                                    color={isEmployee ? colors.white : colors.indigoSoft}
                                    strokeWidth={2}
                                  />
                                  <Text
                                    variant="small"
                                    weight="medium"
                                    color={isEmployee ? colors.white : colors.textSecondary}
                                    numberOfLines={1}
                                  >
                                    {att.name}
                                  </Text>
                                </PressableScale>
                              ))}
                            </View>
                          )}

                          <Text
                            variant="small"
                            color={isEmployee ? 'rgba(255, 255, 255, 0.65)' : colors.muted}
                            style={styles.messageTime}
                          >
                            {new Date(item.createdAt).toLocaleTimeString([], {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </Text>
                        </View>
                      </View>
                    );
                  }}
                  ListFooterComponent={
                    isHrTyping ? (
                      <View style={styles.typingIndicator}>
                        <ActivityIndicator size="small" color={colors.indigoSoft} />
                        <Text variant="small" color={colors.indigoSoft} style={styles.typingText}>
                          HR Support is typing...
                        </Text>
                      </View>
                    ) : null
                  }
                />
              )}

              {/* Resolved / Closed Banner */}
              {selectedEnquiry &&
                (selectedEnquiry.status === 'RESOLVED' || selectedEnquiry.status === 'CLOSED') && (
                  <View style={styles.resolvedBanner}>
                    <View style={styles.resolvedInfo}>
                      <CheckCircle2 size={18} color={colors.success} strokeWidth={2} />
                      <Text variant="caption" color={colors.textSecondary} style={styles.resolvedText}>
                        This enquiry is marked as {selectedEnquiry.status}.
                      </Text>
                    </View>
                    <PressableScale
                      onPress={() => setShowReopenModal(true)}
                      style={styles.reopenButton}
                    >
                      <RotateCcw size={13} color={colors.white} strokeWidth={2.4} />
                      <Text variant="caption" weight="bold" color={colors.white}>
                        Reopen Ticket
                      </Text>
                    </PressableScale>
                  </View>
                )}

              {/* Reply Input Bar (Visible when OPEN or IN_PROGRESS) */}
              {selectedEnquiry &&
                selectedEnquiry.status !== 'CLOSED' &&
                selectedEnquiry.status !== 'RESOLVED' && (
                  <View style={styles.replyBar}>
                    {replyAttachment && (
                      <View style={styles.replyAttachmentPill}>
                        <ImageIcon size={14} color={colors.indigoSoft} strokeWidth={2} />
                        <Text variant="small" color={colors.text} numberOfLines={1} style={styles.replyAttText}>
                          {replyAttachment.name}
                        </Text>
                        <PressableScale onPress={() => setReplyAttachment(null)}>
                          <X size={14} color={colors.danger} strokeWidth={2.4} />
                        </PressableScale>
                      </View>
                    )}

                    <View style={styles.replyControls}>
                      <PressableScale
                        onPress={() => pickMockAttachment(true)}
                        style={styles.replyAttachBtn}
                      >
                        <Paperclip size={20} color={colors.indigoSoft} strokeWidth={2} />
                      </PressableScale>

                      <TextInput
                        style={styles.replyInput}
                        placeholder="Type your message to HR..."
                        placeholderTextColor={colors.muted}
                        value={replyText}
                        onChangeText={(txt) => {
                          setReplyText(txt);
                          emitMobileSocketEvent('enquiry.typing', {
                            enquiryId: selectedEnquiry._id,
                            isTyping: txt.length > 0,
                          });
                        }}
                        multiline
                      />

                      <PressableScale
                        onPress={handleSendReply}
                        disabled={!replyText.trim() || isSendingReply}
                        style={[
                          styles.replySendBtn,
                          (!replyText.trim() || isSendingReply) && styles.replySendBtnDisabled,
                        ]}
                      >
                        {isSendingReply ? (
                          <ActivityIndicator size="small" color={colors.white} />
                        ) : (
                          <Send size={16} color={colors.white} strokeWidth={2.4} />
                        )}
                      </PressableScale>
                    </View>
                  </View>
                )}
            </KeyboardAvoidingView>
          </Screen>
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
              <View style={styles.dialogHeader}>
                <RotateCcw size={20} color={colors.warning} strokeWidth={2} />
                <Text variant="subheading" color={colors.text}>
                  Reopen Ticket
                </Text>
              </View>
              <Text variant="caption" color={colors.muted} style={styles.dialogDesc}>
                Please describe why this issue requires further review or assistance from HR:
              </Text>

              <TextInput
                style={[styles.textInput, styles.textArea, { minHeight: 90 }]}
                placeholder="e.g. My attendance records are still not adjusted on Monday..."
                placeholderTextColor={colors.muted}
                value={reopenReason}
                onChangeText={setReopenReason}
                multiline
              />

              <View style={styles.dialogActions}>
                <Button
                  label="Cancel"
                  size="sm"
                  variant="ghost"
                  onPress={() => setShowReopenModal(false)}
                  style={{ flex: 1 }}
                />
                <Button
                  label="Confirm Reopen"
                  size="sm"
                  variant="primary"
                  loading={isReopening}
                  onPress={handleReopen}
                  style={{ flex: 1.4 }}
                />
              </View>
            </View>
          </View>
        </Modal>

        {/* ================================================================= */}
        {/* IMAGE LIGHTBOX MODAL */}
        {/* ================================================================= */}
        <Modal visible={lightboxImage !== null} transparent animationType="fade">
          <View style={styles.lightboxOverlay}>
            <PressableScale
              onPress={() => setLightboxImage(null)}
              style={styles.lightboxCloseBtn}
            >
              <X size={24} color={colors.white} strokeWidth={2.4} />
            </PressableScale>
            {lightboxImage && (
              <Image
                source={{ uri: lightboxImage }}
                style={styles.lightboxImage}
                resizeMode="contain"
              />
            )}
          </View>
        </Modal>
      </Screen>
    </>
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
    flex: 1,
  },
  filterBar: {
    paddingBottom: spacing.sm,
  },
  filterScroll: {
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
  skeletonContainer: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  skeletonSpacer: {
    height: spacing.sm,
  },
  cardSpacing: {
    marginBottom: spacing.xs,
  },
  rowBetween: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  emptyCard: {
    marginHorizontal: spacing.lg,
    marginTop: spacing.xl,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
  },
  emptyIconCircle: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(89, 101, 242, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.sm,
  },
  emptyTitle: {
    marginTop: spacing.xs,
    marginBottom: spacing.xxs,
  },
  emptyDesc: {
    textAlign: 'center',
    maxWidth: 280,
    marginBottom: spacing.lg,
  },
  emptyActionBtn: {
    minWidth: 180,
  },
  retryBtn: {
    marginTop: spacing.md,
    minWidth: 120,
  },
  ticketsList: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md,
  },
  ticketCard: {
    gap: spacing.sm,
  },
  ticketCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketMetaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  ticketNumber: {
    color: colors.indigoSoft,
    fontSize: 12,
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(30, 34, 56, 0.65)',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
  },
  ticketSubject: {
    marginTop: spacing.xxs,
  },
  ticketFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.xs,
    paddingTop: spacing.xs,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  assigneeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  assigneeAvatar: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(30, 34, 56, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerDateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  unreadPulseDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: colors.danger,
  },

  // Form Styles
  formScroll: {
    flex: 1,
  },
  formContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.giant,
    gap: spacing.lg,
  },
  formSection: {
    gap: spacing.xs,
  },
  sectionHeading: {
    letterSpacing: 0.8,
    marginBottom: spacing.xxs,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoriesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  categoryCard: {
    width: '48%',
    backgroundColor: 'rgba(20, 23, 39, 0.72)',
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    gap: 4,
  },
  categoryCardSelected: {
    borderColor: colors.indigo,
    backgroundColor: 'rgba(89, 101, 242, 0.18)',
  },
  categoryIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(30, 34, 56, 0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xxs,
  },
  categoryIconCircleSelected: {
    backgroundColor: colors.indigo,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  priorityPill: {
    flex: 1,
    paddingVertical: 9,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radii.md,
    backgroundColor: 'rgba(20, 23, 39, 0.72)',
    borderWidth: 1,
    borderColor: colors.border,
  },
  textInput: {
    backgroundColor: 'rgba(20, 23, 39, 0.72)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 14,
  },
  textArea: {
    minHeight: 110,
    textAlignVertical: 'top',
  },
  attachDashedButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: 'rgba(140, 149, 255, 0.4)',
    borderRadius: radii.lg,
    paddingVertical: spacing.md,
    backgroundColor: 'rgba(89, 101, 242, 0.06)',
  },
  attachmentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(20, 23, 39, 0.85)',
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.lg,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  attachmentIconBox: {
    width: 38,
    height: 38,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(89, 101, 242, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attachmentMeta: {
    flex: 1,
  },
  removeAttButton: {
    padding: spacing.xs,
  },
  submitTicketBtn: {
    marginTop: spacing.md,
  },

  // Modal / Thread Styles
  modalBody: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: 'rgba(13, 16, 27, 0.95)',
    gap: spacing.md,
  },
  modalBackBtn: {
    padding: spacing.xs,
    marginLeft: -spacing.xs,
  },
  modalTitleBlock: {
    flex: 1,
    gap: 2,
  },
  modalTopMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  modalTicketNumber: {
    fontSize: 12,
    color: colors.indigoSoft,
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  loadingText: {
    textAlign: 'center',
  },
  messagesList: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    gap: spacing.md,
  },
  messageRow: {
    maxWidth: '82%',
  },
  msgRowRight: {
    alignSelf: 'flex-end',
  },
  msgRowLeft: {
    alignSelf: 'flex-start',
  },
  senderPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
    marginLeft: 6,
  },
  messageBubble: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radii.xl,
    gap: 4,
  },
  bubbleEmployee: {
    backgroundColor: colors.indigo,
    borderBottomRightRadius: radii.xs,
  },
  bubbleHr: {
    backgroundColor: 'rgba(22, 25, 43, 0.92)',
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: radii.xs,
  },
  messageText: {
    lineHeight: 20,
  },
  msgAttachments: {
    marginTop: 6,
    gap: 4,
  },
  msgAttachmentThumbnail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.22)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radii.sm,
  },
  messageTime: {
    alignSelf: 'flex-end',
    marginTop: 2,
    fontSize: 10,
  },
  typingIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    alignSelf: 'flex-start',
  },
  typingText: {
    fontStyle: 'italic',
  },
  resolvedBanner: {
    backgroundColor: 'rgba(13, 16, 27, 0.95)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resolvedInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  resolvedText: {
    flex: 1,
  },
  reopenButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: colors.indigo,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.full,
  },
  replyBar: {
    backgroundColor: 'rgba(13, 16, 27, 0.98)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
  },
  replyAttachmentPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(30, 34, 56, 0.9)',
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
    borderRadius: radii.full,
    alignSelf: 'flex-start',
    marginBottom: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  replyAttText: {
    maxWidth: 160,
  },
  replyControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  replyAttachBtn: {
    padding: spacing.xs,
  },
  replyInput: {
    flex: 1,
    backgroundColor: 'rgba(20, 23, 39, 0.8)',
    borderRadius: radii.full,
    paddingHorizontal: spacing.lg,
    paddingVertical: Platform.OS === 'ios' ? spacing.sm : 6,
    color: colors.text,
    fontFamily: fonts.medium,
    fontSize: 14,
    maxHeight: 85,
    borderWidth: 1,
    borderColor: colors.border,
  },
  replySendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.indigo,
    alignItems: 'center',
    justifyContent: 'center',
  },
  replySendBtnDisabled: {
    opacity: 0.4,
  },

  // Dialog Styles
  dialogOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  dialogCard: {
    width: '100%',
    maxWidth: 420,
    backgroundColor: '#0D101B',
    borderRadius: radii.xxl,
    borderWidth: 1,
    borderColor: colors.borderActive,
    padding: spacing.xl,
    gap: spacing.md,
  },
  dialogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  dialogDesc: {
    lineHeight: 18,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },

  // Lightbox Styles
  lightboxOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.92)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  lightboxCloseBtn: {
    position: 'absolute',
    top: 54,
    right: 22,
    zIndex: 10,
    padding: spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: radii.full,
  },
  lightboxImage: {
    width: '92%',
    height: '75%',
  },
});
