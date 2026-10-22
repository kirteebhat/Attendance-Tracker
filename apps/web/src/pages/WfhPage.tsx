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
import { Modal } from "../components/ui/Modal";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toast";
import { useSocket } from "../context/SocketContext";
import {
  Home,
  Check,
  X,
  Search,
  CheckCircle2,
  XCircle,
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

  // Review Modal State
  const [selectedRequest, setSelectedRequest] = useState<WfhRequestItem | null>(null);
  const [reviewAction, setReviewAction] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [reviewerRemarks, setReviewerRemarks] = useState("");
  const [showReviewModal, setShowReviewModal] = useState(false);

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

  const handleOpenReview = (request: WfhRequestItem, action: "APPROVED" | "REJECTED") => {
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Work From Home Review Queue
            </h1>
            <Badge variant="primary" className="text-xs font-semibold px-2.5 py-0.5">
              Live Updates
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Review and decide employee remote work applications with automatic attendance crediting
          </p>
        </div>
      </div>

      {/* Status Tabs Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2 text-sm font-medium">
        {STATUS_TABS.map((tab) => {
          const isActive = (filters.status || "ALL") === tab.value;
          return (
            <button
              key={tab.value}
              onClick={() => setFilters((prev) => ({ ...prev, status: tab.value, page: 1 }))}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                isActive
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs">
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

      {/* Requests Ledger Table */}
      <Card className="border-slate-200 shadow-sm overflow-hidden">
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
                <tr className="border-b border-slate-200 bg-slate-50/80 text-slate-700 font-semibold">
                  <th className="py-3 px-4">Employee</th>
                  <th className="py-3 px-4">Department</th>
                  <th className="py-3 px-4">Target Date</th>
                  <th className="py-3 px-4">Reason</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Reviewer Remarks</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
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

                  return (
                    <tr
                      key={req._id}
                      className={`hover:bg-slate-50/60 transition-colors ${
                        isPulsing ? "bg-blue-50 ring-2 ring-blue-400 ring-inset" : ""
                      }`}
                    >
                      <td className="py-3 px-4">
                        <div className="font-semibold text-slate-900">{empName}</div>
                        <div className="text-[11px] font-mono text-slate-500">{req.employeeId}</div>
                      </td>

                      <td className="py-3 px-4 text-slate-700 font-medium">{empDept}</td>

                      <td className="py-3 px-4 font-mono font-semibold text-slate-800">
                        {req.dateKey}
                      </td>

                      <td className="py-3 px-4 text-slate-600 max-w-xs truncate" title={req.reason}>
                        {req.reason}
                      </td>

                      <td className="py-3 px-4">{getStatusBadge(req.status)}</td>

                      <td className="py-3 px-4 text-slate-500 text-[11px]">
                        {req.reviewerRemarks ? (
                          <span className="italic">"{req.reviewerRemarks}"</span>
                        ) : (
                          "—"
                        )}
                      </td>

                      <td className="py-3 px-4 text-right">
                        {isPending ? (
                          <div className="flex items-center justify-end gap-1.5">
                            <Button
                              type="button"
                              id={`approve-wfh-btn-${req._id}`}
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenReview(req, "APPROVED")}
                              className="text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 border-emerald-300 gap-1 text-[11px] h-7 px-2"
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
                              onClick={() => handleOpenReview(req, "REJECTED")}
                              className="text-red-700 hover:text-red-800 hover:bg-red-50 border-red-300 gap-1 text-[11px] h-7 px-2"
                              disabled={reviewMutation.isPending}
                            >
                              <X className="w-3.5 h-3.5" />
                              Reject
                            </Button>
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 font-medium italic">
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 text-xs text-slate-500">
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
                className="text-xs h-7 px-2.5"
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))}
                className="text-xs h-7 px-2.5"
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* APPROVE / REJECT CONFIRMATION MODAL */}
      <Modal
        isOpen={showReviewModal}
        onClose={() => setShowReviewModal(false)}
        title={reviewAction === "APPROVED" ? "Approve Remote Work Request" : "Reject Remote Work Request"}
        maxWidth="md"
      >
        {selectedRequest && (
          <div className="space-y-4">
            <div
              className={`p-3.5 rounded-lg border text-xs flex items-start gap-3 ${
                reviewAction === "APPROVED"
                  ? "bg-emerald-50 border-emerald-200 text-emerald-900"
                  : "bg-red-50 border-red-200 text-red-900"
              }`}
            >
              {reviewAction === "APPROVED" ? (
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              ) : (
                <XCircle className="w-5 h-5 text-red-600 shrink-0 mt-0.5" />
              )}
              <div>
                <p className="font-semibold">
                  {reviewAction === "APPROVED"
                    ? "Approving will automatically mark the employee's attendance as WFH (Approved) for this date."
                    : "Rejecting will require the employee to punch in at the office."}
                </p>
                <div className="mt-1 font-mono text-[11px] text-slate-700">
                  Employee: {selectedRequest.employeeId} | Date: {selectedRequest.dateKey}
                </div>
              </div>
            </div>

            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
              <div className="text-slate-500 font-semibold uppercase text-[10px]">
                Employee Reason
              </div>
              <p className="text-slate-800 italic">"{selectedRequest.reason}"</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Reviewer Remarks (Optional)
              </label>
              <Input
                id="wfh-reviewer-remarks-input"
                value={reviewerRemarks}
                onChange={(e) => setReviewerRemarks(e.target.value)}
                placeholder="e.g. Approved per monthly quota / Shift coverage required"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
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
                id="confirm-wfh-review-btn"
                variant={reviewAction === "APPROVED" ? "primary" : "outline"}
                size="sm"
                onClick={handleConfirmReview}
                isLoading={reviewMutation.isPending}
                className={
                  reviewAction === "APPROVED"
                    ? "bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                    : "border-red-400 text-red-700 hover:bg-red-50 font-semibold"
                }
              >
                {reviewAction === "APPROVED" ? "Confirm Approval" : "Confirm Rejection"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
