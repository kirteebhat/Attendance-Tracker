import React, { useState, useEffect, useRef, useMemo } from "react";
import {
  LifeBuoy,
  Search,
  CheckCircle2,
  Clock,
  Paperclip,
  Send,
  UserCheck,
  RefreshCw,
  X,
  ArrowRight,
  ExternalLink,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../components/ui/Toast";
import {
  useEnquiries,
  useEnquiryDetails,
  useSendEnquiryMessage,
  useUpdateEnquiryStatus,
  useAssignEnquiry,
  useEmployees,
  EnquiryAttachment,
} from "../api/queries";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Badge } from "../components/ui/Badge";
import { Drawer } from "../components/ui/Drawer";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { ErrorState } from "../components/ui/ErrorState";
import { StatCard } from "../components/ui/StatCard";

type SavedView = "ALL" | "ACTIVE" | "MY_TICKETS" | "UNASSIGNED" | "HIGH_PRIORITY" | "RESOLVED";

const CANNED_MACROS = [
  { label: "Punch Log Corrected", text: "We have reviewed the biometric kiosk logs and corrected your punch record in the attendance ledger." },
  { label: "Leave Balance Adjusted", text: "Your leave request and corresponding quota balance have been manually reconciled and updated." },
  { label: "Screenshot / Proof Requested", text: "Please provide a clear screenshot of the error message or your ticket attachment for further verification." },
  { label: "Escalated to IT", text: "This enquiry has been escalated to the IT infrastructure team for technical diagnosis. We will update you shortly." },
  { label: "Resolved per Confirmation", text: "Thank you for confirming resolution. Marking this enquiry ticket as resolved." },
];

export const EnquiriesPage: React.FC = () => {
  const { user } = useAuth();
  const { socket } = useSocket();
  const { toast } = useToast();

  // Navigation & Filter State
  const [activeView, setActiveView] = useState<SavedView>("ACTIVE");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [categoryFilter, setCategoryFilter] = useState<string>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<string>("ALL");
  const [page, setPage] = useState<number>(1);

  // Bulk Selection
  const [selectedTicketIds, setSelectedTicketIds] = useState<string[]>([]);
  const [showBulkCloseConfirm, setShowBulkCloseConfirm] = useState<boolean>(false);
  const [isBulkClosing, setIsBulkClosing] = useState<boolean>(false);

  // Drawer & Thread State
  const [activeTicketId, setActiveTicketId] = useState<string | null>(null);
  const [quickReplyText, setQuickReplyText] = useState<string>("");
  const [quickReplyAttachment, setQuickReplyAttachment] = useState<EnquiryAttachment | null>(null);
  const [statusNote, setStatusNote] = useState<string>("");
  const [isEmployeeTyping, setIsEmployeeTyping] = useState<boolean>(false);
  const employeeTypingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Lightbox
  const [lightboxImg, setLightboxImg] = useState<string | null>(null);

  // Derive Query Filters based on Saved View
  const derivedFilters = useMemo(() => {
    const filters: any = { page, limit: 30 };

    if (searchQuery.trim()) {
      filters.search = searchQuery.trim();
    }

    if (statusFilter !== "ALL") {
      filters.status = statusFilter;
    }

    if (categoryFilter !== "ALL") {
      filters.category = categoryFilter;
    }

    if (priorityFilter !== "ALL") {
      filters.priority = priorityFilter;
    }

    // Apply Saved Views shortcuts
    switch (activeView) {
      case "ACTIVE":
        if (statusFilter === "ALL") filters.status = "OPEN";
        break;
      case "MY_TICKETS":
        if (user?.id) filters.assigneeId = user.id;
        break;
      case "UNASSIGNED":
        filters.assigneeId = "UNASSIGNED";
        break;
      case "HIGH_PRIORITY":
        filters.priority = "HIGH";
        break;
      case "RESOLVED":
        filters.status = "RESOLVED";
        break;
      case "ALL":
      default:
        break;
    }

    return filters;
  }, [activeView, searchQuery, statusFilter, categoryFilter, priorityFilter, page, user?.id]);

  // Queries
  const { data: enquiriesData, isLoading, isError, refetch } = useEnquiries(derivedFilters);
  const { data: activeTicketData, isLoading: isTicketLoading } = useEnquiryDetails(activeTicketId);
  const { data: employeesData } = useEmployees({ limit: 100 });

  // Mutations
  const sendMessageMutation = useSendEnquiryMessage();
  const updateStatusMutation = useUpdateEnquiryStatus();
  const assignEnquiryMutation = useAssignEnquiry();

  const enquiries = enquiriesData?.data || [];
  const totalCount = enquiriesData?.total || 0;
  const currentTicket = activeTicketData?.data;
  const currentMessages = activeTicketData?.messages || [];

  // HR Staff list for assignment
  const hrStaffMembers = useMemo(() => {
    return (employeesData?.data || []).filter(
      (emp) =>
        emp.department?.toLowerCase().includes("hr") ||
        emp.department?.toLowerCase().includes("human") ||
        (emp as any).role === "HR" ||
        (emp as any).role === "ADMIN" ||
        emp.userId?.role === "HR" ||
        emp.userId?.role === "ADMIN"
    );
  }, [employeesData]);

  // Real-time socket room and typing listeners
  useEffect(() => {
    if (!socket || !activeTicketId) return;

    socket.emit("enquiry.join", activeTicketId);

    const handleTyping = (data: any) => {
      if (data?.enquiryId === activeTicketId && data?.role === "EMPLOYEE") {
        setIsEmployeeTyping(Boolean(data.isTyping));
        if (employeeTypingTimeoutRef.current) clearTimeout(employeeTypingTimeoutRef.current);
        if (data.isTyping) {
          employeeTypingTimeoutRef.current = setTimeout(() => {
            setIsEmployeeTyping(false);
          }, 4000);
        }
      }
    };

    socket.on("enquiry.typing", handleTyping);

    return () => {
      socket.emit("enquiry.leave", activeTicketId);
      socket.off("enquiry.typing", handleTyping);
      if (employeeTypingTimeoutRef.current) clearTimeout(employeeTypingTimeoutRef.current);
    };
  }, [socket, activeTicketId]);

  // Scroll to bottom when messages update
  useEffect(() => {
    if (activeTicketId && currentMessages.length > 0) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [activeTicketId, currentMessages.length]);

  // Emit typing indicator as HR types
  const handleTypingChange = (text: string) => {
    setQuickReplyText(text);
    if (socket && activeTicketId) {
      socket.emit("enquiry.typing", {
        enquiryId: activeTicketId,
        isTyping: text.length > 0,
        userName: user?.name || "HR Staff",
      });
    }
  };

  // Send Reply
  const handleSendReply = async () => {
    if (!activeTicketId || !quickReplyText.trim()) return;

    try {
      await sendMessageMutation.mutateAsync({
        id: activeTicketId,
        payload: {
          message: quickReplyText.trim(),
          attachment: quickReplyAttachment || undefined,
        },
      });

      setQuickReplyText("");
      setQuickReplyAttachment(null);
      if (socket && activeTicketId) {
        socket.emit("enquiry.typing", { enquiryId: activeTicketId, isTyping: false });
      }
      toast({ type: "success", title: "Reply Sent", description: "Message added to conversation thread." });
    } catch (err: any) {
      toast({ type: "error", title: "Failed to Send", description: err.message || "Could not post message." });
    }
  };

  // Change Status
  const handleStatusChange = async (newStatus: "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED") => {
    if (!activeTicketId) return;

    try {
      await updateStatusMutation.mutateAsync({
        id: activeTicketId,
        status: newStatus,
        note: statusNote.trim() || undefined,
      });

      setStatusNote("");
      toast({
        type: "success",
        title: "Status Updated",
        description: `Ticket status set to ${newStatus}.`,
      });
    } catch (err: any) {
      toast({ type: "error", title: "Update Failed", description: err.message || "Could not update status." });
    }
  };

  // Assign to Me
  const handleAssignToMe = async () => {
    if (!activeTicketId || !user?.id) return;

    try {
      await assignEnquiryMutation.mutateAsync({
        id: activeTicketId,
        assigneeId: user.id,
      });

      toast({
        type: "success",
        title: "Ticket Assigned",
        description: "Enquiry assigned to your queue.",
      });
    } catch (err: any) {
      toast({ type: "error", title: "Assignment Failed", description: err.message || "Could not assign ticket." });
    }
  };

  // Bulk Selection Toggles
  const handleToggleSelectAll = () => {
    if (selectedTicketIds.length === enquiries.length) {
      setSelectedTicketIds([]);
    } else {
      setSelectedTicketIds(enquiries.map((t) => t._id));
    }
  };

  const handleToggleSelect = (id: string) => {
    setSelectedTicketIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  // Execute Bulk Close
  const handleExecuteBulkClose = async () => {
    if (selectedTicketIds.length === 0) return;

    setIsBulkClosing(true);
    let successCount = 0;

    for (const id of selectedTicketIds) {
      try {
        await updateStatusMutation.mutateAsync({
          id,
          status: "CLOSED",
          note: "Bulk closed by HR Administrator",
        });
        successCount++;
      } catch (err) {
        console.error(`Failed to close ticket ${id}:`, err);
      }
    }

    setIsBulkClosing(false);
    setShowBulkCloseConfirm(false);
    setSelectedTicketIds([]);
    refetch();

    toast({
      type: "success",
      title: "Bulk Close Completed",
      description: `Successfully closed ${successCount} of ${selectedTicketIds.length} tickets.`,
    });
  };

  // Helper badges
  const renderStatusBadge = (status: string) => {
    switch (status) {
      case "OPEN":
        return <Badge variant="info">Open</Badge>;
      case "IN_PROGRESS":
        return <Badge variant="warning">In Progress</Badge>;
      case "RESOLVED":
        return <Badge variant="success">Resolved</Badge>;
      case "CLOSED":
        return <Badge variant="neutral">Closed</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const renderPriorityBadge = (priority: string) => {
    switch (priority) {
      case "URGENT":
        return <Badge variant="danger" className="animate-pulse">Urgent</Badge>;
      case "HIGH":
        return <Badge variant="danger">High</Badge>;
      case "MEDIUM":
        return <Badge variant="warning">Medium</Badge>;
      case "LOW":
      default:
        return <Badge variant="neutral">Low</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Live Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
            Support Enquiries
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()} isLoading={isLoading}>
            <RefreshCw className="w-4 h-4 mr-1.5" />
            Refresh
          </Button>
        </div>
      </div>

      {/* 2. Stat Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Enquiries"
          value={totalCount}
          color="blue"
          icon={LifeBuoy}
        />
        <StatCard
          label="Active & Open"
          value={enquiries.filter((t) => t.status === "OPEN" || t.status === "IN_PROGRESS").length}
          color="amber"
          icon={Clock}
        />
        <StatCard
          label="Assigned to Me"
          value={enquiries.filter((t) => t.assignee?._id === user?.id).length}
          color="default"
          icon={UserCheck}
        />
        <StatCard
          label="Resolved / Closed"
          value={enquiries.filter((t) => t.status === "RESOLVED" || t.status === "CLOSED").length}
          color="emerald"
          icon={CheckCircle2}
        />
      </div>

      {/* 3. Saved Views & Quick Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1 border-b border-slate-200 dark:border-slate-800">
        {[
          { key: "ACTIVE", label: "Open & Active" },
          { key: "ALL", label: "All Tickets" },
          { key: "MY_TICKETS", label: "Assigned to Me" },
          { key: "UNASSIGNED", label: "Unassigned" },
          { key: "HIGH_PRIORITY", label: "High & Urgent" },
          { key: "RESOLVED", label: "Resolved / Closed" },
        ].map((view) => (
          <button
            key={view.key}
            onClick={() => {
              setActiveView(view.key as SavedView);
              setPage(1);
            }}
            className={`px-3.5 py-2 text-xs font-semibold rounded-lg transition-colors shrink-0 ${
              activeView === view.key
                ? "bg-blue-600 text-white shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>

      {/* 4. Filters & Search Bar */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            <Input
              placeholder="Search by ticket number, subject, or employee name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 text-xs"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Filter tickets by category"
              className="h-9 px-3 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">All Categories</option>
              <option value="ATTENDANCE">Attendance</option>
              <option value="LEAVE">Leave</option>
              <option value="WFH">WFH</option>
              <option value="PAYROLL">Payroll</option>
              <option value="TECHNICAL">Technical</option>
              <option value="OTHER">Other</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              aria-label="Filter tickets by status"
              className="h-9 px-3 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">All Statuses</option>
              <option value="OPEN">Open</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="RESOLVED">Resolved</option>
              <option value="CLOSED">Closed</option>
            </select>

            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              aria-label="Filter tickets by priority"
              className="h-9 px-3 text-xs rounded-md border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
            >
              <option value="ALL">All Priorities</option>
              <option value="URGENT">Urgent</option>
              <option value="HIGH">High</option>
              <option value="MEDIUM">Medium</option>
              <option value="LOW">Low</option>
            </select>
          </div>
        </div>

        {/* Bulk Action Bar (when rows selected) */}
        {selectedTicketIds.length > 0 && (
          <div className="flex items-center justify-between p-2.5 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-900 rounded-lg text-xs animate-in fade-in">
            <div className="flex items-center gap-2 text-blue-900 dark:text-blue-300 font-medium">
              <CheckCircle2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <span>{selectedTicketIds.length} tickets selected</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedTicketIds([])}
                className="h-7 text-xs"
              >
                Deselect All
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={() => setShowBulkCloseConfirm(true)}
                className="h-7 text-xs bg-rose-600 hover:bg-rose-700 text-white"
              >
                Bulk Close ({selectedTicketIds.length})
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* 5. Main Inbox Table */}
      {isLoading ? (
        <Card className="p-6">
          <div className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </Card>
      ) : isError ? (
        <ErrorState
          title="Failed to Load Enquiries"
          message="Could not retrieve enquiries from the backend service. Check your connection or feature flag configuration."
          onRetry={refetch}
        />
      ) : enquiries.length === 0 ? (
        <EmptyState
          title="No Enquiries Found"
          description="No support tickets match the current filter criteria."
          action={
            <Button
              size="sm"
              onClick={() => {
                setActiveView("ALL");
                setStatusFilter("ALL");
                setCategoryFilter("ALL");
                setPriorityFilter("ALL");
                setSearchQuery("");
              }}
            >
              Clear Filters
            </Button>
          }
        />
      ) : (
        <Card className="overflow-hidden border border-slate-200 dark:border-slate-800">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold select-none">
                <tr>
                  <th className="py-3 px-3 w-10 text-center">
                    <input
                      type="checkbox"
                      checked={selectedTicketIds.length === enquiries.length && enquiries.length > 0}
                      onChange={handleToggleSelectAll}
                      aria-label="Select all tickets"
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="py-3 px-3">Ticket ID</th>
                  <th className="py-3 px-3">Employee</th>
                  <th className="py-3 px-3">Category</th>
                  <th className="py-3 px-3">Subject</th>
                  <th className="py-3 px-3">Priority</th>
                  <th className="py-3 px-3">Status</th>
                  <th className="py-3 px-3">Assignee</th>
                  <th className="py-3 px-3">Last Message</th>
                  <th className="py-3 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {enquiries.map((ticket) => {
                  const isSelected = selectedTicketIds.includes(ticket._id);
                  const isAwaitingReply =
                    ticket.status === "OPEN" ||
                    (ticket.status === "IN_PROGRESS" && !ticket.firstResponseAt);

                  return (
                    <tr
                      key={ticket._id}
                      onClick={() => setActiveTicketId(ticket._id)}
                      className={`hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer transition-colors ${
                        isSelected ? "bg-blue-50/50 dark:bg-blue-950/20" : ""
                      }`}
                    >
                      <td
                        className="py-3 px-3 text-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleToggleSelect(ticket._id);
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleSelect(ticket._id)}
                          aria-label={`Select ticket ${ticket.ticketNumber}`}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                        />
                      </td>

                      <td className="py-3 px-3 font-mono font-bold text-blue-600 dark:text-cyan-400">
                        {ticket.ticketNumber}
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-slate-200 dark:bg-slate-700 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 text-[10px]">
                            {ticket.employee?.name?.charAt(0) || "E"}
                          </div>
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-white leading-tight">
                              {ticket.employee?.name || "Staff Member"}
                            </p>
                            <p className="text-[10px] text-slate-400 leading-tight">
                              {ticket.employee?.employeeId} • {ticket.employee?.department}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3">
                        <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-slate-800 font-semibold text-[11px] text-slate-700 dark:text-slate-300">
                          {ticket.category}
                        </span>
                      </td>

                      <td className="py-3 px-3 max-w-xs">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-slate-900 dark:text-slate-100 truncate">
                            {ticket.subject}
                          </span>
                          {ticket.attachments && ticket.attachments.length > 0 && (
                            <Paperclip className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3">{renderPriorityBadge(ticket.priority)}</td>

                      <td className="py-3 px-3">{renderStatusBadge(ticket.status)}</td>

                      <td className="py-3 px-3">
                        {ticket.assignee ? (
                          <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                            <UserCheck className="w-3.5 h-3.5 text-emerald-500" />
                            <span className="truncate max-w-[100px]">
                              {ticket.assignee.name || ticket.assignee.email}
                            </span>
                          </div>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 text-[10px]">
                            Unassigned
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="text-slate-600 dark:text-slate-400">
                            {new Date(ticket.lastMessageAt).toLocaleDateString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                          {isAwaitingReply && (
                            <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                              Awaiting first response
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="py-3 px-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveTicketId(ticket._id);
                          }}
                          className="h-7 px-2 text-xs"
                        >
                          View Thread
                          <ArrowRight className="w-3 h-3 ml-1" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ================================================================= */}
      {/* 6. ROW-CLICK DRAWER: CHAT THREAD & MANAGEMENT */}
      {/* ================================================================= */}
      <Drawer
        isOpen={activeTicketId !== null}
        onClose={() => setActiveTicketId(null)}
        title={currentTicket ? `${currentTicket.ticketNumber} - ${currentTicket.subject}` : "Enquiry Thread"}
        width="xl"
      >
        {isTicketLoading || !currentTicket ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-64 w-full" />
          </div>
        ) : (
          <div className="flex flex-col h-[calc(100vh-140px)]">
            {/* Top Employee & Meta Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/40 border-b border-slate-200 dark:border-slate-800 space-y-3 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-sm">
                    {currentTicket.employee?.name?.charAt(0) || "E"}
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                      {currentTicket.employee?.name}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {currentTicket.employee?.employeeId} • {currentTicket.employee?.department} • {currentTicket.employee?.designation}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {renderPriorityBadge(currentTicket.priority)}
                  {renderStatusBadge(currentTicket.status)}
                </div>
              </div>

              {/* Action Toolbar (Assign & Status) */}
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                {/* Status Switcher */}
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400 mb-1">
                    Change Status
                  </label>
                  <select
                    value={currentTicket.status}
                    onChange={(e) =>
                      handleStatusChange(e.target.value as "OPEN" | "IN_PROGRESS" | "RESOLVED" | "CLOSED")
                    }
                    aria-label="Change Status"
                    className="w-full h-8 px-2 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 font-semibold"
                  >
                    <option value="OPEN">OPEN</option>
                    <option value="IN_PROGRESS">IN PROGRESS</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>

                {/* Assignee Switcher */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                      Assignee
                    </label>
                    {currentTicket.assignee?._id !== user?.id && (
                      <button
                        onClick={handleAssignToMe}
                        className="text-[11px] font-semibold text-blue-600 dark:text-cyan-400 hover:underline"
                      >
                        Assign to Me
                      </button>
                    )}
                  </div>
                  <select
                    value={currentTicket.assignee?._id || "UNASSIGNED"}
                    onChange={(e) => {
                      if (e.target.value !== "UNASSIGNED") {
                        assignEnquiryMutation.mutate({
                          id: currentTicket._id,
                          assigneeId: e.target.value,
                        });
                      }
                    }}
                    aria-label="Assignee"
                    className="w-full h-8 px-2 text-xs rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <option value="UNASSIGNED">Unassigned</option>
                    {user?.id && (
                      <option value={user.id}>
                        {user.name || user.email} (You)
                      </option>
                    )}
                    {hrStaffMembers.map((hr) => (
                      <option key={hr._id} value={typeof hr.userId === "string" ? hr.userId : hr.userId?._id || hr._id}>
                        {hr.name} ({hr.department})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Conversation Messages Thread */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-slate-100/50 dark:bg-slate-900/50">
              {currentMessages.length === 0 ? (
                <div className="p-8 text-center text-slate-400 text-xs">
                  No messages recorded in this enquiry.
                </div>
              ) : (
                currentMessages.map((msg) => {
                  const isHr = msg.senderRole === "HR" || msg.senderRole === "ADMIN";
                  return (
                    <div
                      key={msg._id}
                      className={`flex flex-col max-w-[85%] ${
                        isHr ? "ml-auto items-end" : "mr-auto items-start"
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-[10px] text-slate-400">
                        <span className="font-semibold">
                          {isHr ? "HR Support Staff" : currentTicket.employee?.name}
                        </span>
                        <span>•</span>
                        <span>
                          {new Date(msg.createdAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <div
                        className={`p-3 rounded-xl text-xs leading-relaxed shadow-xs ${
                          isHr
                            ? "bg-blue-600 text-white rounded-br-xs"
                            : "bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700 rounded-bl-xs"
                        }`}
                      >
                        <p className="whitespace-pre-wrap">{msg.message}</p>

                        {/* Attachments */}
                        {msg.attachments && msg.attachments.length > 0 && (
                          <div className="mt-2.5 pt-2 border-t border-white/20 dark:border-slate-700 space-y-1.5">
                            {msg.attachments.map((att, i) => (
                              <button
                                key={i}
                                onClick={() => att.url && setLightboxImg(att.url)}
                                className={`flex items-center gap-1.5 px-2 py-1 rounded text-[11px] font-medium transition-colors ${
                                  isHr
                                    ? "bg-white/10 hover:bg-white/20 text-white"
                                    : "bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 text-slate-800 dark:text-slate-200"
                                }`}
                              >
                                <Paperclip className="w-3.5 h-3.5" />
                                <span className="truncate max-w-[180px]">{att.name}</span>
                                <ExternalLink className="w-3 h-3 ml-1 opacity-70" />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })
              )}

              {/* Typing Indicator */}
              {isEmployeeTyping && (
                <div className="flex items-center gap-2 p-2 text-xs text-slate-400 italic">
                  <div className="flex space-x-1">
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce" />
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <div className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                  <span>{currentTicket.employee?.name} is typing...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Reply & Canned Responses Composer */}
            <div className="p-3 bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 space-y-2 shrink-0">
              {/* Canned Macro Shortcuts */}
              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider shrink-0">
                  Quick Macro:
                </span>
                {CANNED_MACROS.map((macro, idx) => (
                  <button
                    key={idx}
                    onClick={() => setQuickReplyText(macro.text)}
                    className="px-2.5 py-1 text-[11px] bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-md font-medium text-slate-700 dark:text-slate-300 shrink-0 whitespace-nowrap transition-colors"
                  >
                    {macro.label}
                  </button>
                ))}
              </div>

              {/* Reply Attachment Chip */}
              {quickReplyAttachment && (
                <div className="flex items-center justify-between px-2.5 py-1 bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800 rounded-md text-xs text-blue-900 dark:text-blue-300">
                  <span className="flex items-center gap-1.5 truncate max-w-xs">
                    <Paperclip className="w-3.5 h-3.5" />
                    {quickReplyAttachment.name}
                  </span>
                  <button
                    onClick={() => setQuickReplyAttachment(null)}
                    className="text-slate-400 hover:text-rose-500"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}

              {/* Input Box */}
              <div className="flex gap-2">
                <textarea
                  value={quickReplyText}
                  onChange={(e) => handleTypingChange(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
                      e.preventDefault();
                      handleSendReply();
                    }
                  }}
                  placeholder="Type an official HR reply (Ctrl+Enter to send)..."
                  rows={2}
                  className="flex-1 px-3 py-2 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white resize-none focus:outline-none focus:ring-1 focus:ring-blue-500"
                />

                <div className="flex items-end shrink-0">
                  <Button
                    type="button"
                    variant="primary"
                    size="sm"
                    onClick={handleSendReply}
                    isLoading={sendMessageMutation.isPending}
                    disabled={!quickReplyText.trim()}
                    className="h-9 px-4 bg-blue-600 hover:bg-blue-700 font-semibold shadow-xs"
                  >
                    <Send className="w-3.5 h-3.5 mr-1.5" />
                    Send
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* ================================================================= */}
      {/* 7. BULK CLOSE CONFIRM DIALOG */}
      {/* ================================================================= */}
      <ConfirmDialog
        isOpen={showBulkCloseConfirm}
        onClose={() => setShowBulkCloseConfirm(false)}
        onConfirm={handleExecuteBulkClose}
        title="Confirm Bulk Close"
        message={`Are you sure you want to close ${selectedTicketIds.length} enquiries? Employees will still be able to reopen them within 7 days if their issue persists.`}
        confirmText={`Close ${selectedTicketIds.length} Tickets`}
        variant="danger"
        isLoading={isBulkClosing}
      />

      {/* ================================================================= */}
      {/* 8. IMAGE LIGHTBOX MODAL */}
      {/* ================================================================= */}
      <Modal
        isOpen={lightboxImg !== null}
        onClose={() => setLightboxImg(null)}
        title="Attachment Preview"
        maxWidth="2xl"
      >
        <div className="flex items-center justify-center p-2 bg-slate-950 rounded-lg">
          {lightboxImg && (
            <img
              src={lightboxImg}
              alt="Enquiry attachment"
              className="max-h-[70vh] object-contain rounded"
            />
          )}
        </div>
      </Modal>
    </div>
  );
};

export default EnquiriesPage;
