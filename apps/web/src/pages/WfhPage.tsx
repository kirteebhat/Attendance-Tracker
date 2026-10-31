import React, { useState, useEffect } from "react";
import {
  useWfhRequests,
  useReviewWfhRequest,
  WfhRequestItem,
  WfhFilters,
} from "../api/queries";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import { Drawer } from "../components/ui/Drawer";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toast";
import { useSocket } from "../context/SocketContext";
import {
  Home,
  Check,
  X,
  Search,
  Calendar,
  Building2,
  CheckSquare,
  Square,
} from "lucide-react";

const DEPARTMENT_OPTIONS = [
  { value: "", label: "All Departments" },
  { value: "Engineering", label: "Engineering" },
  { value: "Product", label: "Product" },
  { value: "Operations", label: "Operations" },
  { value: "Marketing", label: "Marketing" },
  { value: "HR", label: "HR" },
];

const STATUS_TABS = [
  { value: "ALL", label: "All Requests" },
  { value: "PENDING", label: "Pending Review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
];

export const WfhPage: React.FC = () => {
  const { toast } = useToast();
  const { socket } = useSocket();

  // Filters State
  const [filters, setFilters] = useState<WfhFilters>({
    page: 1,
    limit: 10,
    status: "ALL",
    department: "",
    search: "",
  });

  const [searchInput, setSearchInput] = useState("");
  const [pulsingRowId, setPulsingRowId] = useState<string | null>(null);

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const {
    data: response,
    isLoading,
    refetch,
  } = useWfhRequests(filters);

  const requests = response?.data || [];
  const pagination = response?.pagination || { total: 0, page: 1, limit: 10, totalPages: 1 };

  const reviewMutation = useReviewWfhRequest();

  // Selection & Bulk Actions
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"APPROVED" | "REJECTED" | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // Row Details Drawer State
  const [detailRequest, setDetailRequest] = useState<WfhRequestItem | null>(null);

  // Review Modal State
  const [selectedRequest, setSelectedRequest] = useState<WfhRequestItem | null>(null);
  const [reviewAction, setReviewAction] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [reviewerRemarks, setReviewerRemarks] = useState("");
  const [showReviewModal, setShowReviewModal] = useState(false);

  // Pending requests on the current page
  const pendingRequests = requests.filter((r) => r.status === "PENDING");
  const isAllPendingSelected =
    pendingRequests.length > 0 && pendingRequests.every((r) => selectedIds.includes(r._id));

  const handleToggleSelectAll = () => {
    if (isAllPendingSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(pendingRequests.map((r) => r._id));
    }
  };

  const handleToggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Real-Time Socket.IO Subscriptions
  useEffect(() => {
    if (!socket) return;

    const handleWfhCreated = (payload: {
      requestId: string;
      employeeName: string;
      dateKey: string;
    }) => {
      refetch();
      setPulsingRowId(payload.requestId);
      setTimeout(() => setPulsingRowId(null), 3000);

      toast({
        title: "New WFH Request",
        description: `${payload.employeeName || "An employee"} requested WFH for ${payload.dateKey}.`,
        type: "info",
      });
    };

    const handleWfhDecided = (payload: {
      requestId: string;
      status: string;
    }) => {
      refetch();
      setPulsingRowId(payload.requestId);
      setTimeout(() => setPulsingRowId(null), 3000);
    };

    socket.on("wfh.created", handleWfhCreated);
    socket.on("wfh.decided", handleWfhDecided);

    return () => {
      socket.off("wfh.created", handleWfhCreated);
      socket.off("wfh.decided", handleWfhDecided);
    };
  }, [socket, refetch, toast]);

  const handleOpenReview = (
    request: WfhRequestItem,
    action: "APPROVED" | "REJECTED",
    e?: React.MouseEvent
  ) => {
    e?.stopPropagation();
    setSelectedRequest(request);
    setReviewAction(action);
    setReviewerRemarks(action === "APPROVED" ? "Approved per remote work policy quota" : "");
    setShowReviewModal(true);
  };

  const handleConfirmReview = async () => {
    if (!selectedRequest) return;
    try {
      await reviewMutation.mutateAsync({
        id: selectedRequest._id,
        status: reviewAction,
        remarks: reviewerRemarks.trim() || undefined,
      });

      toast({
        title: reviewAction === "APPROVED" ? "Request Approved" : "Request Rejected",
        description: `WFH for ${selectedRequest.employeeId} on ${selectedRequest.dateKey} marked as ${reviewAction}.`,
        type: reviewAction === "APPROVED" ? "success" : "info",
      });

      setShowReviewModal(false);
      if (detailRequest?._id === selectedRequest._id) {
        setDetailRequest(null);
      }
      setSelectedRequest(null);
      setReviewerRemarks("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to record review";
      toast({
        title: "Review Action Failed",
        description: message,
        type: "error",
      });
    }
  };

  const handleExecuteBulkReview = async () => {
    if (!bulkAction || selectedIds.length === 0) return;
    setIsBulkProcessing(true);
    const action = bulkAction;

    try {
      const remarks =
        action === "APPROVED"
          ? "Bulk approved per remote work policy quota"
          : "Bulk rejected by administrative review";

      const results = await Promise.allSettled(
        selectedIds.map((id) =>
          reviewMutation.mutateAsync({
            id,
            status: action,
            remarks,
          })
        )
      );

      const fulfilled = results.filter((r) => r.status === "fulfilled").length;
      const rejected = results.filter((r) => r.status === "rejected").length;

      if (fulfilled > 0) {
        toast({
          title: "Bulk Decisions Recorded",
          description: `Successfully ${action.toLowerCase()} ${fulfilled} WFH request(s).${
            rejected > 0 ? ` (${rejected} failed)` : ""
          }`,
          type: "success",
        });
      } else {
        toast({
          title: "Bulk Action Failed",
          description: "None of the selected requests could be updated.",
          type: "error",
        });
      }

      setSelectedIds([]);
      setBulkAction(null);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "An unexpected error occurred.";
      toast({
        title: "Bulk Review Error",
        description: msg,
        type: "error",
      });
    } finally {
      setIsBulkProcessing(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "APPROVED":
        return <Badge variant="success">Approved</Badge>;
      case "REJECTED":
        return <Badge variant="danger">Rejected</Badge>;
      case "PENDING":
        return <Badge variant="warning">Pending Review</Badge>;
      case "CANCELLED":
        return <Badge variant="neutral">Cancelled</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              WFH Requests
            </h1>
            <Badge variant="primary" className="text-xs font-semibold px-2.5 py-0.5">
              Live Updates
            </Badge>
          </div>
        </div>
      </div>

      {/* Status Tabs Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 dark:border-slate-800 pb-2 text-sm font-medium">
        {STATUS_TABS.map((tab) => {
          const isActive = (filters.status || "ALL") === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => {
                setFilters((prev) => ({ ...prev, status: tab.value, page: 1 }));
                setSelectedIds([]);
              }}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="flex-1 max-w-sm relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search employee, ID, reason..."
            className="pl-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-2">
          <Select
            value={filters.department || ""}
            onChange={(e) =>
              setFilters((prev) => ({ ...prev, department: e.target.value, page: 1 }))
            }
            options={DEPARTMENT_OPTIONS}
            className="text-xs w-44"
          />
        </div>
      </div>

      {/* Bulk Selection Action Bar */}
      {selectedIds.length > 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 rounded-xl text-xs text-blue-900 dark:text-blue-100 shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2 font-semibold">
            <span className="px-2 py-0.5 bg-blue-600 text-white rounded-md text-[11px]">
              {selectedIds.length}
            </span>
            <span>pending request(s) selected</span>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkAction("APPROVED")}
              className="text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-xs h-7 px-2.5"
            >
              Bulk Approve
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkAction("REJECTED")}
              className="text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-xs h-7 px-2.5"
            >
              Bulk Reject
            </Button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="p-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              title="Clear selection"
              aria-label="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Requests Ledger Table */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900">
        {isLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : requests.length === 0 ? (
          <EmptyState
            icon={<Home className="w-6 h-6 text-slate-400" />}
            title="No WFH Requests Found"
            description="There are no remote work requests matching your selected status and filter criteria."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300 font-semibold uppercase tracking-wider text-[11px] select-none z-10">
                  <th className="py-3 px-3 w-10 text-center">
                    {pendingRequests.length > 0 && (
                      <button
                        type="button"
                        onClick={handleToggleSelectAll}
                        className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 inline-flex items-center"
                        title={
                          isAllPendingSelected
                            ? "Deselect all pending requests"
                            : "Select all pending requests"
                        }
                        aria-label={
                          isAllPendingSelected
                            ? "Deselect all pending requests"
                            : "Select all pending requests"
                        }
                      >
                        {isAllPendingSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    )}
                  </th>
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Target Date</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Reviewer Remarks</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {requests.map((req) => {
                  const empName =
                    typeof req.employee === "object" && req.employee !== null
                      ? req.employee.name
                      : req.employeeId;
                  const empDept =
                    typeof req.employee === "object" && req.employee !== null
                      ? req.employee.department
                      : req.department;

                  const isPending = req.status === "PENDING";
                  const isPulsing = pulsingRowId === req._id;
                  const isSelected = selectedIds.includes(req._id);
                  const isDetailActive = detailRequest?._id === req._id;

                  return (
                    <tr
                      key={req._id}
                      onClick={() => setDetailRequest(req)}
                      className={`cursor-pointer transition-colors ${
                        isDetailActive
                          ? "bg-blue-50/90 dark:bg-blue-950/50 ring-1 ring-blue-500/30"
                          : isPulsing
                          ? "bg-blue-50 dark:bg-blue-950/50 ring-2 ring-blue-400 ring-inset"
                          : isSelected
                          ? "bg-blue-50/50 dark:bg-blue-950/30"
                          : "hover:bg-slate-50/60 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      {/* Checkbox column */}
                      <td className="py-3 px-3 text-center" onClick={(e) => e.stopPropagation()}>
                        {isPending ? (
                          <button
                            type="button"
                            onClick={(e) => handleToggleSelectRow(req._id, e)}
                            className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                            aria-label={`Select request from ${empName}`}
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                            ) : (
                              <Square className="w-4 h-4" />
                            )}
                          </button>
                        ) : null}
                      </td>

                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900 dark:text-slate-100">{empName}</div>
                        <div className="text-[11px] font-mono text-slate-500 dark:text-slate-400">{req.employeeId}</div>
                      </td>

                      <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">{empDept}</td>

                      <td className="py-3 px-4 font-mono font-semibold text-slate-800 dark:text-slate-200">
                        {req.dateKey}
                      </td>

                      <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={req.reason}>
                        {req.reason}
                      </td>

                      <td className="py-3 px-4">{getStatusBadge(req.status)}</td>

                      <td className="py-3 px-4 text-slate-500 dark:text-slate-400 text-[11px]">
                        {req.reviewerRemarks ? (
                          <span className="italic">&ldquo;{req.reviewerRemarks}&rdquo;</span>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              id={`approve-wfh-btn-${req._id}`}
                              size="sm"
                              variant="outline"
                              onClick={(e) => handleOpenReview(req, "APPROVED", e)}
                              className="text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 gap-1 text-[11px] h-7 px-2"
                              disabled={reviewMutation.isPending}
                            >
                              <Check className="w-3.5 h-3.5" />
                              Approve
                            </Button>

                            <Button
                              type="button"
                              id={`reject-wfh-btn-${req._id}`}
                              size="sm"
                              variant="outline"
                              onClick={(e) => handleOpenReview(req, "REJECTED", e)}
                              className="text-red-700 dark:text-red-400 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-950/40 border-red-300 dark:border-red-800 gap-1 text-[11px] h-7 px-2"
                              disabled={reviewMutation.isPending}
                            >
                              <X className="w-3.5 h-3.5" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 dark:text-slate-500 font-medium italic">
                            Decided
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Toolbar */}
        {!isLoading && requests.length > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-900/80">
            <div>
              Showing {requests.length} of {pagination.total} requests (Page {pagination.page} of{" "}
              {pagination.totalPages})
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) - 1 }))}
                className="h-7 text-xs px-2"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))}
                className="h-7 text-xs px-2"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ======================================================== */}
      {/* Drawer: WFH Request Detail Slide-Over                    */}
      {/* ======================================================== */}
      <Drawer
        isOpen={Boolean(detailRequest)}
        onClose={() => setDetailRequest(null)}
        title="WFH Application Details"
        description={`Request on ${detailRequest?.dateKey} • ${detailRequest?.employeeId}`}
        width="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <Button
              variant="outline"
              size="md"
              onClick={() => setDetailRequest(null)}
            >
              Close
            </Button>
            {detailRequest?.status === "PENDING" && (
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="md"
                  onClick={() => handleOpenReview(detailRequest, "REJECTED")}
                  className="text-rose-600 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                >
                  Reject
                </Button>
                <Button
                  variant="primary"
                  size="md"
                  onClick={() => handleOpenReview(detailRequest, "APPROVED")}
                >
                  Approve Application
                </Button>
              </div>
            )}
          </div>
        }
      >
        {detailRequest && (
          <div className="space-y-6">
            {/* Header info */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base">
                    {typeof detailRequest.employee === "object" && detailRequest.employee !== null
                      ? detailRequest.employee.name
                      : detailRequest.employeeId}
                  </h3>
                  <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2 mt-0.5">
                    <span className="font-mono font-medium">{detailRequest.employeeId}</span>
                    <span>&bull;</span>
                    <span>
                      {typeof detailRequest.employee === "object" && detailRequest.employee !== null
                        ? detailRequest.employee.department
                        : detailRequest.department}
                    </span>
                  </div>
                </div>

                {getStatusBadge(detailRequest.status)}
              </div>
            </div>

            {/* Request Meta */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Target Date</span>
                <span className="font-mono font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  {detailRequest.dateKey}
                </span>
              </div>

              <div className="p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Department</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  {detailRequest.department}
                </span>
              </div>
            </div>

            {/* Justification Reason */}
            <div>
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5 uppercase tracking-wide">
                Employee Justification
              </span>
              <div className="p-3.5 bg-slate-50 dark:bg-slate-800/60 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 text-xs leading-relaxed">
                {detailRequest.reason || "No specific details provided."}
              </div>
            </div>

            {/* Review Decision notes */}
            {detailRequest.reviewerRemarks && (
              <div>
                <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1.5 uppercase tracking-wide">
                  Reviewer Decision Notes
                </span>
                <div className="p-3.5 bg-blue-50 dark:bg-blue-950/40 rounded-xl border border-blue-200 dark:border-blue-900 text-blue-950 dark:text-blue-200 text-xs italic">
                  &ldquo;{detailRequest.reviewerRemarks}&rdquo;
                </div>
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* ======================================================== */}
      {/* Modal: Single Review Action                              */}
      {/* ======================================================== */}
      <Modal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        title={reviewAction === "APPROVED" ? "Approve WFH Request" : "Reject WFH Request"}
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            You are about to <strong>{reviewAction.toLowerCase()}</strong> the remote work application for{" "}
            <strong>{selectedRequest?.employeeId}</strong> on <strong>{selectedRequest?.dateKey}</strong>.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Reviewer Remarks / Reason (Optional)
            </label>
            <Input
              value={reviewerRemarks}
              onChange={(e) => setReviewerRemarks(e.target.value)}
              placeholder="Review remarks (optional)..."
              className="text-xs"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowReviewModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant={reviewAction === "APPROVED" ? "primary" : "danger"}
              size="sm"
              isLoading={reviewMutation.isPending}
              onClick={handleConfirmReview}
            >
              Confirm {reviewAction === "APPROVED" ? "Approval" : "Rejection"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ======================================================== */}
      {/* ConfirmDialog: Bulk Review                               */}
      {/* ======================================================== */}
      <ConfirmDialog
        isOpen={Boolean(bulkAction)}
        onClose={() => setBulkAction(null)}
        onConfirm={handleExecuteBulkReview}
        title={
          bulkAction === "APPROVED"
            ? `Approve ${selectedIds.length} Selected Requests?`
            : `Reject ${selectedIds.length} Selected Requests?`
        }
        message={
          bulkAction === "APPROVED"
            ? `This action will mark ${selectedIds.length} remote work requests as APPROVED and auto-credit full attendance.`
            : `This action will mark ${selectedIds.length} remote work requests as REJECTED.`
        }
        variant={bulkAction === "REJECTED" ? "danger" : "primary"}
        confirmText={bulkAction === "APPROVED" ? "Approve All" : "Reject All"}
        isLoading={isBulkProcessing}
      />
    </div>
  );
};
