import React, { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import {
  useLeaveRequests,
  useDecideLeaveRequest,
  useBulkDecideLeaveRequests,
  useLeaveTypes,
  useCreateLeaveType,
  useUpdateLeaveType,
  useDeleteLeaveType,
  useAllLeaveBalances,
  useEmployeeLeaveBalances,
  useAdjustLeaveBalance,
  useCarryForwardLeave,
  LeaveRequestPopulated,
  LeaveTypeItem,
  EmployeeBalanceGroup,
  BulkDecisionResponse,
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
import { ErrorState } from "../components/ui/ErrorState";
import { useToast } from "../components/ui/Toast";
import { useSocket } from "../context/SocketContext";
import {
  CalendarCheck,
  Check,
  X,
  Search,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Calendar,
  Layers,
  Settings2,
  RotateCcw,
  Sliders,
  ChevronLeft,
  ChevronRight,
  Plus,
  Users,
} from "lucide-react";

const DEPARTMENT_OPTIONS = [
  { value: "", label: "All Departments" },
  { value: "Engineering", label: "Engineering" },
  { value: "Product", label: "Product" },
  { value: "Operations", label: "Operations" },
  { value: "Marketing", label: "Marketing" },
  { value: "HR", label: "Human Resources" },
];

const STATUS_TABS = [
  { value: "ALL", label: "All Requests" },
  { value: "PENDING", label: "Pending Review" },
  { value: "APPROVED", label: "Approved" },
  { value: "REJECTED", label: "Rejected" },
  { value: "CANCELLED", label: "Cancelled" },
];

export const LeavePage: React.FC = () => {
  const { toast } = useToast();
  const { socket } = useSocket();
  const [searchParams, setSearchParams] = useSearchParams();

  // Active Hub Tab: "requests" | "balances" | "settings" | "calendar"
  const activeTab = searchParams.get("tab") || "requests";
  const setActiveTab = (tab: string) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.set("tab", tab);
      return next;
    });
  };

  // ============================================================================
  // TAB 1: LEAVE REQUESTS STATE & FILTERS
  // ============================================================================
  const [filters, setFilters] = useState({
    page: 1,
    limit: 15,
    status: "PENDING",
    type: "",
    department: "",
    startDate: "",
    endDate: "",
    search: "",
  });

  const [searchInput, setSearchInput] = useState("");
  const [pulsingRowId, setPulsingRowId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters((prev) => ({ ...prev, search: searchInput, page: 1 }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const {
    data: requestsResponse,
    isLoading: isRequestsLoading,
    isError: isRequestsError,
    refetch: refetchRequests,
  } = useLeaveRequests(filters);

  const requests = requestsResponse?.data || [];
  const pagination = requestsResponse?.pagination || { total: 0, page: 1, limit: 15, totalPages: 1 };

  // Leave Types for filter dropdowns & settings
  const { data: typesResponse, isLoading: isTypesLoading } = useLeaveTypes(true);
  const leaveTypes = typesResponse?.data || [];

  // Mutations
  const decideMutation = useDecideLeaveRequest();
  const bulkDecideMutation = useBulkDecideLeaveRequests();

  // Multi-Row Selection for Bulk Decision
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkAction, setBulkAction] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [showBulkConfirm, setShowBulkConfirm] = useState(false);
  const [bulkDecisionNote, setBulkDecisionNote] = useState("");
  const [bulkResult, setBulkResult] = useState<BulkDecisionResponse["data"] | null>(null);
  const [showBulkResultModal, setShowBulkResultModal] = useState(false);

  // Row-Click Slide-Over Drawer State
  const [selectedRequest, setSelectedRequest] = useState<LeaveRequestPopulated | null>(null);
  const [drawerDecisionNote, setDrawerDecisionNote] = useState("");
  const [confirmSingleAction, setConfirmSingleAction] = useState<"APPROVED" | "REJECTED" | null>(null);

  // Helper to resolve employee ID from request
  const selectedEmpId = useMemo(() => {
    if (!selectedRequest?.employee) return "";
    return typeof selectedRequest.employee === "object"
      ? selectedRequest.employee.employeeId || selectedRequest.employee._id
      : selectedRequest.employee;
  }, [selectedRequest]);

  // Query selected employee's live leave balances for the drawer
  const { data: empBalancesResponse } = useEmployeeLeaveBalances(
    selectedEmpId,
    selectedRequest?.startDate ? parseInt(selectedRequest.startDate.substring(0, 4), 10) : undefined
  );

  const empBalances = empBalancesResponse?.data?.balances || [];

  // Query Overlapping Team Leaves in Drawer (same department, overlapping dates)
  const selectedDept = useMemo(() => {
    if (!selectedRequest?.employee || typeof selectedRequest.employee !== "object") return "";
    return selectedRequest.employee.department;
  }, [selectedRequest]);

  const { data: teamOverlapsResponse } = useLeaveRequests(
    selectedRequest && selectedDept
      ? {
          department: selectedDept,
          startDate: selectedRequest.startDate.substring(0, 10),
          endDate: selectedRequest.endDate.substring(0, 10),
          status: "APPROVED",
          limit: 20,
        }
      : undefined
  );

  const overlappingTeamLeaves = useMemo(() => {
    if (!teamOverlapsResponse?.data || !selectedRequest) return [];
    return teamOverlapsResponse.data.filter((r) => r._id !== selectedRequest._id);
  }, [teamOverlapsResponse, selectedRequest]);

  // Real-Time Socket Notifications & Row Pulsing
  useEffect(() => {
    if (!socket) return;

    const handleLeaveCreated = (payload: { requestId?: string; employeeName?: string }) => {
      refetchRequests();
      if (payload?.requestId) {
        setPulsingRowId(payload.requestId);
        setTimeout(() => setPulsingRowId(null), 3500);
      }
    };

    const handleLeaveDecided = () => {
      refetchRequests();
    };

    socket.on("leave.requested", handleLeaveCreated);
    socket.on("leave.decided", handleLeaveDecided);

    return () => {
      socket.off("leave.requested", handleLeaveCreated);
      socket.off("leave.decided", handleLeaveDecided);
    };
  }, [socket, refetchRequests]);

  // Handle Bulk Selection
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedIds(requests.map((r) => r._id));
    } else {
      setSelectedIds([]);
    }
  };

  const handleToggleRow = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleExecuteBulk = async () => {
    if (selectedIds.length === 0) return;
    try {
      const res = await bulkDecideMutation.mutateAsync({
        requestIds: selectedIds,
        status: bulkAction,
        decisionNote: bulkDecisionNote || undefined,
      });

      setShowBulkConfirm(false);
      setSelectedIds([]);
      setBulkDecisionNote("");
      setBulkResult(res.data);
      setShowBulkResultModal(true);

      toast({
        type: "success",
        title: "Bulk Review Completed",
        description: `Processed ${res.data.total} requests: ${res.data.successful.length} succeeded, ${res.data.failed.length} failed.`,
      });
    } catch (err: any) {
      toast({
        type: "error",
        title: "Bulk Review Failed",
        description: err.message || "An error occurred during bulk decision.",
      });
    }
  };

  const handleExecuteSingleDecision = async (status: "APPROVED" | "REJECTED") => {
    if (!selectedRequest) return;
    try {
      await decideMutation.mutateAsync({
        id: selectedRequest._id,
        status,
        decisionNote: drawerDecisionNote || undefined,
      });

      toast({
        type: "success",
        title: `Leave ${status === "APPROVED" ? "Approved" : "Rejected"}`,
        description: `Request for ${
          typeof selectedRequest.employee === "object"
            ? selectedRequest.employee.name
            : selectedRequest.employee
        } has been marked ${status.toLowerCase()}.`,
      });

      setConfirmSingleAction(null);
      setSelectedRequest(null);
      setDrawerDecisionNote("");
    } catch (err: any) {
      toast({
        type: "error",
        title: "Decision Failed",
        description: err.message || "Failed to process leave decision.",
      });
    }
  };

  // ============================================================================
  // TAB 2: EMPLOYEE BALANCES & ADJUSTMENT STATE
  // ============================================================================
  const [balanceYear, setBalanceYear] = useState<number>(new Date().getFullYear());
  const [balanceDept, setBalanceDept] = useState<string>("");
  const [balanceSearch, setBalanceSearch] = useState<string>("");
  const [balancePage, setBalancePage] = useState<number>(1);

  const {
    data: allBalancesResponse,
    isLoading: isBalancesLoading,
    isError: isBalancesError,
    refetch: refetchBalances,
  } = useAllLeaveBalances({
    year: balanceYear,
    department: balanceDept || undefined,
    employeeId: balanceSearch || undefined,
    page: balancePage,
    limit: 10,
  });

  const balanceGroups = allBalancesResponse?.data || [];
  const balancePagination = allBalancesResponse?.pagination || {
    total: 0,
    page: 1,
    limit: 10,
    totalPages: 1,
  };

  // Balance Adjustment Modal State
  const [adjustTarget, setAdjustTarget] = useState<{
    employeeId: string;
    employeeName: string;
    typeId: string;
    typeName: string;
    year: number;
    currentAllotted: number;
    currentCarried: number;
  } | null>(null);

  const [adjustAllotted, setAdjustAllotted] = useState<number>(0);
  const [adjustCarried, setAdjustCarried] = useState<number>(0);
  const [adjustReason, setAdjustReason] = useState<string>("");

  const adjustMutation = useAdjustLeaveBalance();

  const handleOpenAdjustModal = (
    group: EmployeeBalanceGroup,
    b: EmployeeBalanceGroup["balances"][0]
  ) => {
    setAdjustTarget({
      employeeId: group.employee.employeeId,
      employeeName: group.employee.name,
      typeId: b.type.id,
      typeName: b.type.name,
      year: group.year,
      currentAllotted: b.allotted,
      currentCarried: b.carriedOver,
    });
    setAdjustAllotted(b.allotted);
    setAdjustCarried(b.carriedOver);
    setAdjustReason("");
  };

  const handleExecuteAdjustment = async () => {
    if (!adjustTarget) return;
    if (!adjustReason.trim() || adjustReason.trim().length < 5) {
      toast({
        type: "error",
        title: "Justification Required",
        description: "Please enter an audit reason of at least 5 characters.",
      });
      return;
    }

    try {
      await adjustMutation.mutateAsync({
        employeeId: adjustTarget.employeeId,
        typeId: adjustTarget.typeId,
        year: adjustTarget.year,
        allotted: adjustAllotted,
        carriedOver: adjustCarried,
        reason: adjustReason.trim(),
      });

      toast({
        type: "success",
        title: "Balance Adjusted",
        description: `Successfully adjusted ${adjustTarget.typeName} quota for ${adjustTarget.employeeName}.`,
      });

      setAdjustTarget(null);
    } catch (err: any) {
      toast({
        type: "error",
        title: "Adjustment Failed",
        description: err.message || "Failed to adjust balance.",
      });
    }
  };

  // Carry Forward Modal
  const [showCarryForwardModal, setShowCarryForwardModal] = useState(false);
  const [carryFromYear, setCarryFromYear] = useState<number>(new Date().getFullYear() - 1);
  const [carryToYear, setCarryToYear] = useState<number>(new Date().getFullYear());
  const carryForwardMutation = useCarryForwardLeave();

  const handleExecuteCarryForward = async () => {
    try {
      const res: any = await carryForwardMutation.mutateAsync({
        fromYear: carryFromYear,
        toYear: carryToYear,
      });

      toast({
        type: "success",
        title: "Carry-Forward Completed",
        description: res.message || `Processed carry-forward for ${res.data?.processedCount || 0} records.`,
      });
      setShowCarryForwardModal(false);
    } catch (err: any) {
      toast({
        type: "error",
        title: "Carry-Forward Failed",
        description: err.message || "Failed to process carry-forward.",
      });
    }
  };

  // ============================================================================
  // TAB 3: LEAVE TYPES SETTINGS STATE
  // ============================================================================
  const [editingType, setEditingType] = useState<LeaveTypeItem | null>(null);
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [typeForm, setTypeForm] = useState({
    name: "",
    code: "",
    paid: true,
    annualQuota: 12,
    carryAllowed: false,
    maxCarryDays: 5,
    expiryMonths: 6,
    halfDayAllowed: true,
    description: "",
  });

  const createTypeMutation = useCreateLeaveType();
  const updateTypeMutation = useUpdateLeaveType();
  const deleteTypeMutation = useDeleteLeaveType();

  const handleOpenCreateType = () => {
    setEditingType(null);
    setTypeForm({
      name: "",
      code: "",
      paid: true,
      annualQuota: 12,
      carryAllowed: false,
      maxCarryDays: 5,
      expiryMonths: 6,
      halfDayAllowed: true,
      description: "",
    });
    setShowTypeModal(true);
  };

  const handleOpenEditType = (lt: LeaveTypeItem) => {
    setEditingType(lt);
    setTypeForm({
      name: lt.name,
      code: lt.code,
      paid: lt.paid,
      annualQuota: lt.annualQuota,
      carryAllowed: lt.carryForwardRule?.allowed ?? false,
      maxCarryDays: lt.carryForwardRule?.maxDays ?? 0,
      expiryMonths: lt.carryForwardRule?.expiryMonths ?? 6,
      halfDayAllowed: lt.halfDayAllowed ?? true,
      description: lt.description || "",
    });
    setShowTypeModal(true);
  };

  const handleSaveType = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingType) {
        await updateTypeMutation.mutateAsync({
          id: editingType._id,
          payload: {
            name: typeForm.name,
            code: typeForm.code,
            paid: typeForm.paid,
            annualQuota: typeForm.annualQuota,
            carryForwardRule: {
              allowed: typeForm.carryAllowed,
              maxDays: typeForm.maxCarryDays,
              expiryMonths: typeForm.expiryMonths,
            },
            halfDayAllowed: typeForm.halfDayAllowed,
            description: typeForm.description,
          },
        });
        toast({ type: "success", title: "Leave Type Updated", description: `${typeForm.name} updated successfully.` });
      } else {
        await createTypeMutation.mutateAsync({
          name: typeForm.name,
          code: typeForm.code,
          paid: typeForm.paid,
          annualQuota: typeForm.annualQuota,
          carryForwardRule: {
            allowed: typeForm.carryAllowed,
            maxDays: typeForm.maxCarryDays,
            expiryMonths: typeForm.expiryMonths,
          },
          halfDayAllowed: typeForm.halfDayAllowed,
          description: typeForm.description,
        });
        toast({ type: "success", title: "Leave Type Created", description: `${typeForm.name} configured successfully.` });
      }
      setShowTypeModal(false);
    } catch (err: any) {
      toast({
        type: "error",
        title: "Action Failed",
        description: err.message || "Failed to save leave type.",
      });
    }
  };

  const handleToggleTypeActive = async (lt: LeaveTypeItem) => {
    try {
      if (lt.isActive) {
        await deleteTypeMutation.mutateAsync(lt._id);
        toast({ type: "info", title: "Leave Type Disabled", description: `${lt.name} is now inactive.` });
      } else {
        await updateTypeMutation.mutateAsync({ id: lt._id, payload: { isActive: true } });
        toast({ type: "success", title: "Leave Type Activated", description: `${lt.name} is now active.` });
      }
    } catch (err: any) {
      toast({ type: "error", title: "Update Failed", description: err.message });
    }
  };

  // ============================================================================
  // TAB 4: TEAM LEAVE CALENDAR OVERLAY STATE
  // ============================================================================
  const [calendarMonthDate, setCalendarMonthDate] = useState<Date>(new Date());
  const [calendarDept, setCalendarDept] = useState<string>("");

  const monthYearStr = useMemo(() => {
    const y = calendarMonthDate.getFullYear();
    const m = String(calendarMonthDate.getMonth() + 1).padStart(2, "0");
    return `${y}-${m}`;
  }, [calendarMonthDate]);

  // Fetch approved leaves covering this month
  const { data: monthLeavesResponse } = useLeaveRequests({
    startDate: `${monthYearStr}-01`,
    endDate: `${monthYearStr}-31`,
    department: calendarDept || undefined,
    status: "APPROVED",
    limit: 100,
  });

  const calendarLeaves = monthLeavesResponse?.data || [];

  // Generate days in month grid
  const calendarDays = useMemo(() => {
    const year = calendarMonthDate.getFullYear();
    const month = calendarMonthDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    const startingDayOfWeek = firstDay.getDay(); // 0 is Sunday
    const daysInMonth = lastDay.getDate();

    const days: Array<{
      dateKey: string;
      dayNumber: number;
      isCurrentMonth: boolean;
      leaves: LeaveRequestPopulated[];
    }> = [];

    // Prefix days from previous month
    for (let i = 0; i < startingDayOfWeek; i++) {
      const prevDate = new Date(year, month, -startingDayOfWeek + i + 1);
      const dateKey = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}-${String(
        prevDate.getDate()
      ).padStart(2, "0")}`;
      days.push({ dateKey, dayNumber: prevDate.getDate(), isCurrentMonth: false, leaves: [] });
    }

    // Days in current month
    for (let i = 1; i <= daysInMonth; i++) {
      const dateKey = `${year}-${String(month + 1).padStart(2, "0")}-${String(i).padStart(2, "0")}`;
      // Find leaves covering this dateKey
      const dayLeaves = calendarLeaves.filter((l) => {
        const s = l.startDate.substring(0, 10);
        const e = l.endDate.substring(0, 10);
        return dateKey >= s && dateKey <= e;
      });
      days.push({ dateKey, dayNumber: i, isCurrentMonth: true, leaves: dayLeaves });
    }

    return days;
  }, [calendarMonthDate, calendarLeaves]);

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 border border-blue-200/50 dark:border-blue-800/50 shadow-xs">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
                Leave Management Hub
              </h1>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Review employee applications, govern departmental quotas, and inspect team calendar overlays.
              </p>
            </div>
          </div>
        </div>

        {/* Tab Switcher Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl border border-slate-200/80 dark:border-slate-700 text-xs font-medium self-start sm:self-auto overflow-x-auto max-w-full">
          <button
            onClick={() => setActiveTab("requests")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "requests"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Clock className="w-3.5 h-3.5 text-blue-600" />
            <span>Requests & Queue</span>
            {pagination.total > 0 && filters.status === "PENDING" && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold">
                {pagination.total}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab("balances")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "balances"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            <span>Employee Balances</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "settings"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Settings2 className="w-3.5 h-3.5 text-purple-500" />
            <span>Types & Quotas</span>
          </button>

          <button
            onClick={() => setActiveTab("calendar")}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === "calendar"
                ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs font-semibold"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
            }`}
          >
            <Calendar className="w-3.5 h-3.5 text-emerald-500" />
            <span>Team Overlay</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: REQUESTS & APPROVALS QUEUE */}
      {/* ========================================================================= */}
      {activeTab === "requests" && (
        <div className="space-y-4">
          {/* Status Tab Filter Bar */}
          <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto gap-1">
            {STATUS_TABS.map((tab) => (
              <button
                key={tab.value}
                onClick={() => setFilters((prev) => ({ ...prev, status: tab.value, page: 1 }))}
                className={`px-4 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${
                  filters.status === tab.value
                    ? "border-blue-600 text-blue-600 dark:text-blue-400 bg-blue-50/50 dark:bg-blue-950/20 rounded-t-lg"
                    : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search & Multi-Criteria Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="relative lg:col-span-2">
              <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by employee name or ID..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <Select
              options={DEPARTMENT_OPTIONS}
              value={filters.department}
              onChange={(e) => setFilters((prev) => ({ ...prev, department: e.target.value, page: 1 }))}
              aria-label="Filter by department"
            />

            <Select
              options={[
                { value: "", label: "All Leave Types" },
                ...leaveTypes.map((lt) => ({ value: lt._id, label: `${lt.name} (${lt.code})` })),
              ]}
              value={filters.type}
              onChange={(e) => setFilters((prev) => ({ ...prev, type: e.target.value, page: 1 }))}
              aria-label="Filter by leave type"
            />

            <div className="flex gap-2">
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters((prev) => ({ ...prev, startDate: e.target.value, page: 1 }))}
                className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                title="Filter start date"
              />
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters((prev) => ({ ...prev, endDate: e.target.value, page: 1 }))}
                className="w-full px-2 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-300"
                title="Filter end date"
              />
            </div>
          </div>

          {/* Bulk Selection Actions Bar */}
          {selectedIds.length > 0 && (
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800 rounded-xl animate-in fade-in">
              <div className="flex items-center gap-3">
                <span className="text-xs font-semibold text-blue-900 dark:text-blue-200">
                  {selectedIds.length} request(s) selected
                </span>
                <button
                  onClick={() => setSelectedIds([])}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  Clear selection
                </button>
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="primary"
                  onClick={() => {
                    setBulkAction("APPROVED");
                    setShowBulkConfirm(true);
                  }}
                  className="bg-emerald-600 hover:bg-emerald-700"
                >
                  <Check className="w-3.5 h-3.5 mr-1" />
                  Approve Selected ({selectedIds.length})
                </Button>

                <Button
                  size="sm"
                  variant="danger"
                  onClick={() => {
                    setBulkAction("REJECTED");
                    setShowBulkConfirm(true);
                  }}
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  Reject Selected ({selectedIds.length})
                </Button>
              </div>
            </div>
          )}

          {/* Requests Data Table */}
          {isRequestsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full rounded-xl" />
              ))}
            </div>
          ) : isRequestsError ? (
            <ErrorState
              title="Unable to load leave requests"
              message="The request queue could not be loaded from the backend service."
              onRetry={() => refetchRequests()}
            />
          ) : requests.length === 0 ? (
            <EmptyState
              title="No leave requests found"
              description="No applications match the current filter criteria or status."
              icon={CalendarCheck}
            />
          ) : (
            <div className="overflow-hidden bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px] select-none z-10">
                    <tr>
                      <th className="py-3 px-4 w-10">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === requests.length && requests.length > 0}
                          onChange={handleSelectAll}
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          aria-label="Select all requests"
                        />
                      </th>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Type</th>
                      <th className="py-3 px-4">Dates & Duration</th>
                      <th className="py-3 px-4">Reason</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {requests.map((req) => {
                      const emp = typeof req.employee === "object" ? req.employee : null;
                      const lt = typeof req.type === "object" ? req.type : null;
                      const isPulsing = pulsingRowId === req._id;
                      const isSelected = selectedIds.includes(req._id);

                      return (
                        <tr
                          key={req._id}
                          onClick={() => setSelectedRequest(req)}
                          className={`cursor-pointer transition-colors hover:bg-slate-50/80 dark:hover:bg-slate-800/40 ${
                            isPulsing ? "animate-pulse bg-blue-50 dark:bg-blue-950/40" : ""
                          } ${isSelected ? "bg-blue-50/40 dark:bg-blue-950/20" : ""}`}
                        >
                          <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleRow(req._id)}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                              aria-label={`Select request ${req._id}`}
                            />
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-slate-200 dark:bg-slate-800 flex items-center justify-center font-bold text-slate-700 dark:text-slate-300 text-xs">
                                {emp?.name?.charAt(0) || "E"}
                              </div>
                              <div>
                                <p className="font-semibold text-slate-900 dark:text-white">
                                  {emp?.name || emp?.employeeId || "Unknown"}
                                </p>
                                <p className="text-[11px] text-slate-500">
                                  {emp?.employeeId} • {emp?.department || "General"}
                                </p>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant={lt?.paid ? "info" : "neutral"} size="sm">
                              {lt?.name || "Leave"} ({lt?.code || "LV"})
                            </Badge>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-mono text-slate-900 dark:text-slate-200 font-medium">
                              {req.startDate.substring(0, 10)}{" "}
                              {req.startDate.substring(0, 10) !== req.endDate.substring(0, 10) && (
                                <>to {req.endDate.substring(0, 10)}</>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-500 flex items-center gap-1.5 mt-0.5">
                              <span className="font-semibold text-blue-600 dark:text-blue-400">
                                {req.workingDays} working day{req.workingDays > 1 ? "s" : ""}
                              </span>
                              {req.isHalfDay && (
                                <span className="px-1.5 py-0.2 rounded bg-indigo-100 dark:bg-indigo-950 text-indigo-700 dark:text-indigo-300 text-[10px] font-bold">
                                  Half Day ({req.halfDayType === "FIRST_HALF" ? "1st" : "2nd"})
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="py-3 px-4 max-w-xs truncate text-slate-600 dark:text-slate-400" title={req.reason}>
                            {req.reason}
                          </td>
                          <td className="py-3 px-4">
                            <Badge
                              variant={
                                req.status === "APPROVED"
                                  ? "success"
                                  : req.status === "REJECTED"
                                  ? "danger"
                                  : req.status === "PENDING"
                                  ? "warning"
                                  : "neutral"
                              }
                              size="sm"
                            >
                              {req.status}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            {req.status === "PENDING" ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  onClick={() => {
                                    setSelectedRequest(req);
                                    setConfirmSingleAction("APPROVED");
                                  }}
                                  className="p-1 rounded-md text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/60 transition-colors"
                                  title="Quick Approve"
                                >
                                  <Check className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setSelectedRequest(req);
                                    setConfirmSingleAction("REJECTED");
                                  }}
                                  className="p-1 rounded-md text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/60 transition-colors"
                                  title="Quick Reject"
                                >
                                  <X className="w-4 h-4" />
                                </button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-slate-400">
                                {req.decidedAt ? new Date(req.decidedAt).toLocaleDateString() : "Decided"}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Bar */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between p-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                  <span>
                    Showing Page {pagination.page} of {pagination.totalPages} ({pagination.total} total)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={pagination.page <= 1}
                      onClick={() => setFilters((p) => ({ ...p, page: p.page - 1 }))}
                      className="p-1.5 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      disabled={pagination.page >= pagination.totalPages}
                      onClick={() => setFilters((p) => ({ ...p, page: p.page + 1 }))}
                      className="p-1.5 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: EMPLOYEE BALANCES & ADJUSTMENT */}
      {/* ========================================================================= */}
      {activeTab === "balances" && (
        <div className="space-y-4">
          {/* Balances Filter Bar */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
              <Select
                options={[
                  { value: String(new Date().getFullYear() - 1), label: String(new Date().getFullYear() - 1) },
                  { value: String(new Date().getFullYear()), label: `${new Date().getFullYear()} (Active Year)` },
                  { value: String(new Date().getFullYear() + 1), label: String(new Date().getFullYear() + 1) },
                ]}
                value={String(balanceYear)}
                onChange={(e) => {
                  setBalanceYear(Number(e.target.value));
                  setBalancePage(1);
                }}
                className="w-36"
                aria-label="Select year"
              />

              <Select
                options={DEPARTMENT_OPTIONS}
                value={balanceDept}
                onChange={(e) => {
                  setBalanceDept(e.target.value);
                  setBalancePage(1);
                }}
                className="w-44"
                aria-label="Filter department"
              />

              <div className="relative w-56">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Employee ID..."
                  value={balanceSearch}
                  onChange={(e) => {
                    setBalanceSearch(e.target.value);
                    setBalancePage(1);
                  }}
                  className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none"
                />
              </div>
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCarryForwardModal(true)}
              className="w-full sm:w-auto"
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5 text-indigo-600" />
              Annual Carry-Forward Rollover
            </Button>
          </div>

          {/* Balances Table */}
          {isBalancesLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          ) : isBalancesError ? (
            <ErrorState
              title="Unable to load employee balances"
              message="The balance directory could not be reached."
              onRetry={() => refetchBalances()}
            />
          ) : balanceGroups.length === 0 ? (
            <EmptyState
              title="No balances found"
              description="No employee records matched the selected year and department."
              icon={Layers}
            />
          ) : (
            <div className="overflow-hidden bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider text-[11px] select-none z-10">
                    <tr>
                      <th className="py-3 px-4">Employee</th>
                      <th className="py-3 px-4">Department</th>
                      <th className="py-3 px-4">Leave Quotas & Balances Breakdown</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {balanceGroups.map((group) => (
                      <tr key={group.employee.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white whitespace-nowrap">
                          {group.employee.name}
                          <span className="block text-[11px] text-slate-500 font-mono font-normal">
                            {group.employee.employeeId}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-400 whitespace-nowrap">
                          {group.employee.department || "General"}
                        </td>
                        <td className="py-3 px-4">
                          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2 py-1">
                            {group.balances.map((b) => (
                              <div
                                key={b.id}
                                className="p-2.5 rounded-lg border border-slate-200/80 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40 space-y-1.5"
                              >
                                <div className="flex items-center justify-between">
                                  <span className="font-bold text-slate-800 dark:text-slate-200">
                                    {b.type.name} ({b.type.code})
                                  </span>
                                  <button
                                    onClick={() => handleOpenAdjustModal(group, b)}
                                    className="text-[10px] text-blue-600 hover:text-blue-700 dark:text-blue-400 font-semibold flex items-center gap-1"
                                  >
                                    <Sliders className="w-3 h-3" />
                                    Adjust
                                  </button>
                                </div>
                                <div className="grid grid-cols-4 gap-1 text-[10px] text-center pt-1 border-t border-slate-200/60 dark:border-slate-700/60">
                                  <div>
                                    <span className="text-slate-400 block">Quota</span>
                                    <span className="font-bold text-slate-700 dark:text-slate-300">
                                      {b.allotted + b.carriedOver}
                                    </span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block">Used</span>
                                    <span className="font-bold text-rose-600 dark:text-rose-400">{b.used}</span>
                                  </div>
                                  <div>
                                    <span className="text-slate-400 block">Pending</span>
                                    <span className="font-bold text-amber-600 dark:text-amber-400">{b.pending}</span>
                                  </div>
                                  <div className="bg-emerald-50 dark:bg-emerald-950/40 rounded p-0.5">
                                    <span className="text-emerald-700 dark:text-emerald-400 font-bold block">Avail</span>
                                    <span className="font-bold text-emerald-800 dark:text-emerald-300">
                                      {b.available}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            ))}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {balancePagination.totalPages > 1 && (
                <div className="flex items-center justify-between p-3 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                  <span>
                    Page {balancePagination.page} of {balancePagination.totalPages} ({balancePagination.total} total)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      disabled={balancePagination.page <= 1}
                      onClick={() => setBalancePage((p) => p - 1)}
                      className="p-1.5 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      disabled={balancePagination.page >= balancePagination.totalPages}
                      onClick={() => setBalancePage((p) => p + 1)}
                      className="p-1.5 rounded border border-slate-200 dark:border-slate-700 disabled:opacity-40"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: LEAVE TYPES & QUOTAS SETTINGS */}
      {/* ========================================================================= */}
      {activeTab === "settings" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                Configured Leave Categories
              </h2>
              <p className="text-xs text-slate-500">
                Manage global annual allotments, carry-forward thresholds, and half-day permissions.
              </p>
            </div>
            <Button size="sm" variant="primary" onClick={handleOpenCreateType}>
              <Plus className="w-4 h-4 mr-1.5" />
              Add Leave Type
            </Button>
          </div>

          {isTypesLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-44 w-full rounded-xl" />
              ))}
            </div>
          ) : leaveTypes.length === 0 ? (
            <EmptyState
              title="No Leave Types Configured"
              description="Define your first leave category to allow employees to submit requests."
              icon={Settings2}
              action={
                <Button size="sm" onClick={handleOpenCreateType}>
                  Add Leave Type
                </Button>
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {leaveTypes.map((lt) => (
                <Card
                  key={lt._id}
                  className={`p-5 transition-all ${
                    !lt.isActive ? "opacity-60 bg-slate-50 dark:bg-slate-900/40" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white">{lt.name}</h3>
                        <Badge variant="neutral" size="sm" className="font-mono">
                          {lt.code}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{lt.description || "No description provided."}</p>
                    </div>
                    <Badge variant={lt.paid ? "success" : "neutral"} size="sm">
                      {lt.paid ? "Paid" : "Unpaid"}
                    </Badge>
                  </div>

                  <div className="space-y-2 py-3 border-y border-slate-100 dark:border-slate-800 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Annual Quota:</span>
                      <span className="font-bold text-slate-900 dark:text-white">{lt.annualQuota} Days / Year</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Carry Forward:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {lt.carryForwardRule?.allowed
                          ? `Max ${lt.carryForwardRule.maxDays}d (${lt.carryForwardRule.expiryMonths || 6}m exp)`
                          : "Not Allowed"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Half-Day Allowed:</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">
                        {lt.halfDayAllowed ? "Yes (0.5d increments)" : "No"}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-3 mt-1">
                    <span
                      className={`text-[11px] font-semibold ${
                        lt.isActive ? "text-emerald-600 dark:text-emerald-400" : "text-slate-400"
                      }`}
                    >
                      {lt.isActive ? "Active in Directory" : "Deactivated"}
                    </span>
                    <div className="flex items-center gap-2">
                      <Button size="sm" variant="ghost" onClick={() => handleOpenEditType(lt)}>
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant={lt.isActive ? "outline" : "secondary"}
                        onClick={() => handleToggleTypeActive(lt)}
                      >
                        {lt.isActive ? "Disable" : "Enable"}
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: TEAM LEAVE CALENDAR OVERLAY */}
      {/* ========================================================================= */}
      {activeTab === "calendar" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-4 bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs">
            <div className="flex items-center gap-3">
              <button
                onClick={() =>
                  setCalendarMonthDate(new Date(calendarMonthDate.getFullYear(), calendarMonthDate.getMonth() - 1, 1))
                }
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ChevronLeft className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </button>

              <h2 className="text-sm font-bold text-slate-900 dark:text-white min-w-36 text-center">
                {calendarMonthDate.toLocaleString("default", { month: "long", year: "numeric" })}
              </h2>

              <button
                onClick={() =>
                  setCalendarMonthDate(new Date(calendarMonthDate.getFullYear(), calendarMonthDate.getMonth() + 1, 1))
                }
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                <ChevronRight className="w-4 h-4 text-slate-600 dark:text-slate-300" />
              </button>

              <Button size="sm" variant="outline" onClick={() => setCalendarMonthDate(new Date())}>
                Today
              </Button>
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto">
              <Select
                options={DEPARTMENT_OPTIONS}
                value={calendarDept}
                onChange={(e) => setCalendarDept(e.target.value)}
                className="w-48"
                aria-label="Filter calendar department"
              />
            </div>
          </div>

          {/* Calendar Grid */}
          <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200/80 dark:border-slate-800 shadow-xs overflow-hidden">
            {/* Weekday Headers */}
            <div className="grid grid-cols-7 border-b border-slate-200 dark:border-slate-800 text-center text-xs font-bold text-slate-600 dark:text-slate-400 py-2.5 bg-slate-50 dark:bg-slate-800/40">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 dark:divide-slate-800">
              {calendarDays.map((day, idx) => (
                <div
                  key={idx}
                  className={`min-h-24 p-1.5 flex flex-col justify-between transition-colors ${
                    !day.isCurrentMonth
                      ? "bg-slate-50/50 dark:bg-slate-950/20 text-slate-300 dark:text-slate-700"
                      : "hover:bg-slate-50/60 dark:hover:bg-slate-800/30 text-slate-800 dark:text-slate-200"
                  }`}
                >
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-xs font-semibold">{day.dayNumber}</span>
                    {day.leaves.length > 0 && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-blue-100 dark:bg-blue-900/60 text-blue-700 dark:text-blue-300">
                        {day.leaves.length} off
                      </span>
                    )}
                  </div>

                  {/* Day Leave Badges */}
                  <div className="space-y-1 overflow-y-auto max-h-16">
                    {day.leaves.slice(0, 3).map((l) => {
                      const empName = typeof l.employee === "object" ? l.employee.name : "Employee";
                      const ltCode = typeof l.type === "object" ? l.type.code : "LV";
                      return (
                        <div
                          key={l._id}
                          onClick={() => setSelectedRequest(l)}
                          className="px-1.5 py-0.5 rounded text-[10px] font-medium bg-indigo-50 dark:bg-indigo-950/80 text-indigo-800 dark:text-indigo-200 border border-indigo-200/50 dark:border-indigo-800/50 truncate cursor-pointer hover:bg-indigo-100 transition-colors"
                          title={`${empName} on ${ltCode}: ${l.reason}`}
                        >
                          {empName.split(" ")[0]} ({ltCode})
                        </div>
                      );
                    })}
                    {day.leaves.length > 3 && (
                      <span className="text-[9px] text-slate-400 block pl-1">
                        +{day.leaves.length - 3} more
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* ROW-CLICK SLIDE-OVER DRAWER */}
      {/* ========================================================================= */}
      <Drawer
        isOpen={Boolean(selectedRequest)}
        onClose={() => {
          setSelectedRequest(null);
          setDrawerDecisionNote("");
        }}
        title="Leave Application Details"
        description="Inspect employee quotas, team overlap, and decide on application."
        width="xl"
      >
        {selectedRequest && (
          <div className="space-y-5">
            {/* Employee Profile Header */}
            {typeof selectedRequest.employee === "object" && selectedRequest.employee && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700 flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center text-lg font-bold shadow-xs">
                  {selectedRequest.employee.name?.charAt(0) || "E"}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                    {selectedRequest.employee.name}
                  </h3>
                  <p className="text-xs text-slate-500 truncate">
                    {selectedRequest.employee.employeeId} • {selectedRequest.employee.designation || "Staff"}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5 truncate">{selectedRequest.employee.email}</p>
                </div>
                <Badge variant="neutral" size="sm">
                  {selectedRequest.employee.department}
                </Badge>
              </div>
            )}

            {/* Leave Details Card */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Category:</span>
                <Badge variant="info" size="sm">
                  {typeof selectedRequest.type === "object"
                    ? `${selectedRequest.type.name} (${selectedRequest.type.code})`
                    : "Leave"}
                </Badge>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Date Range:</span>
                <span className="font-mono font-semibold text-slate-900 dark:text-slate-200">
                  {selectedRequest.startDate.substring(0, 10)} to {selectedRequest.endDate.substring(0, 10)}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500">Working Days Deduction:</span>
                <span className="font-bold text-blue-600 dark:text-blue-400">
                  {selectedRequest.workingDays} Day(s)
                  {selectedRequest.isHalfDay && ` (Half-Day: ${selectedRequest.halfDayType})`}
                </span>
              </div>

              <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
                <span className="text-slate-500 block mb-1">Reason for Leave:</span>
                <p className="p-2.5 rounded-lg bg-slate-50 dark:bg-slate-800/40 text-slate-700 dark:text-slate-300 italic">
                  "{selectedRequest.reason}"
                </p>
              </div>
            </div>

            {/* Live Employee Balance Snapshot */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-2">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-indigo-500" />
                  Live Balance Entitlement ({selectedRequest.startDate.substring(0, 4)})
                </h4>
              </div>

              {empBalances.length === 0 ? (
                <Skeleton className="h-14 w-full" />
              ) : (
                <div className="grid grid-cols-4 gap-2 text-center text-xs pt-1">
                  {(() => {
                    const reqTypeId =
                      typeof selectedRequest.type === "object" ? selectedRequest.type._id : selectedRequest.type;
                    const matched = empBalances.find((b) => b.type.id === reqTypeId) || empBalances[0];

                    return (
                      <>
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                          <span className="text-[10px] text-slate-400 block">Total Quota</span>
                          <span className="font-bold text-slate-800 dark:text-slate-200">
                            {matched ? matched.allotted + matched.carriedOver : "-"}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                          <span className="text-[10px] text-slate-400 block">Used</span>
                          <span className="font-bold text-rose-600 dark:text-rose-400">
                            {matched ? matched.used : "-"}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                          <span className="text-[10px] text-slate-400 block">Pending</span>
                          <span className="font-bold text-amber-600 dark:text-amber-400">
                            {matched ? matched.pending : "-"}
                          </span>
                        </div>
                        <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800">
                          <span className="text-[10px] text-emerald-700 dark:text-emerald-400 font-bold block">
                            Available
                          </span>
                          <span className="font-bold text-emerald-800 dark:text-emerald-300">
                            {matched ? matched.available : "-"}
                          </span>
                        </div>
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Overlapping Team Leave Card */}
            <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 space-y-2">
              <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-blue-500" />
                Department Team Overlap ({selectedDept || "Team"})
              </h4>

              {overlappingTeamLeaves.length === 0 ? (
                <p className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 py-1">
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  No other department members are on leave during these dates.
                </p>
              ) : (
                <div className="space-y-1.5 pt-1">
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    {overlappingTeamLeaves.length} colleague(s) on approved leave during this window:
                  </p>
                  <div className="max-h-28 overflow-y-auto space-y-1.5 pr-1">
                    {overlappingTeamLeaves.map((otl) => {
                      const empObj = typeof otl.employee === "object" ? otl.employee : null;
                      return (
                        <div
                          key={otl._id}
                          className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/60 text-xs flex justify-between items-center"
                        >
                          <div>
                            <span className="font-semibold text-slate-900 dark:text-white">
                              {empObj?.name || empObj?.employeeId}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              {otl.startDate.substring(0, 10)} to {otl.endDate.substring(0, 10)} ({otl.workingDays}d)
                            </span>
                          </div>
                          <Badge variant="warning" size="sm">
                            On Leave
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Decision Section */}
            {selectedRequest.status === "PENDING" ? (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-3">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white uppercase tracking-wider">
                  Review Decision
                </h4>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-600 dark:text-slate-400 font-medium block">
                    Decision Remarks / Note (Optional):
                  </label>
                  <textarea
                    rows={2}
                    value={drawerDecisionNote}
                    onChange={(e) => setDrawerDecisionNote(e.target.value)}
                    placeholder="Provide notes or approval reason..."
                    className="w-full p-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div className="flex gap-2.5 pt-1">
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700"
                    isLoading={decideMutation.isPending}
                    onClick={() => handleExecuteSingleDecision("APPROVED")}
                  >
                    <Check className="w-4 h-4 mr-1.5" />
                    Approve Request
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    className="flex-1"
                    isLoading={decideMutation.isPending}
                    onClick={() => handleExecuteSingleDecision("REJECTED")}
                  >
                    <X className="w-4 h-4 mr-1.5" />
                    Reject Request
                  </Button>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-2 text-xs">
                <span className="font-bold text-slate-500 block uppercase">Decision Record</span>
                <div className="flex justify-between">
                  <span className="text-slate-500">Status:</span>
                  <Badge
                    variant={selectedRequest.status === "APPROVED" ? "success" : "danger"}
                    size="sm"
                  >
                    {selectedRequest.status}
                  </Badge>
                </div>
                {selectedRequest.decidedAt && (
                  <div className="flex justify-between">
                    <span className="text-slate-500">Decided At:</span>
                    <span>{new Date(selectedRequest.decidedAt).toLocaleString()}</span>
                  </div>
                )}
                {selectedRequest.decisionNote && (
                  <div className="pt-2 border-t border-slate-200 dark:border-slate-700">
                    <span className="text-slate-500 block mb-0.5">Note:</span>
                    <p className="text-slate-800 dark:text-slate-200 italic">{selectedRequest.decisionNote}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </Drawer>

      {/* ========================================================================= */}
      {/* BULK DECISION CONFIRMATION DIALOG */}
      {/* ========================================================================= */}
      <Modal
        isOpen={showBulkConfirm}
        onClose={() => setShowBulkConfirm(false)}
        title={`Confirm Bulk ${bulkAction === "APPROVED" ? "Approval" : "Rejection"}`}
        maxWidth="md"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-400">
            You are about to <strong className="uppercase">{bulkAction}</strong> {selectedIds.length} leave
            request(s) in a single atomic batch operation.
          </p>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
              Decision Note (Optional):
            </label>
            <textarea
              rows={2}
              value={bulkDecisionNote}
              onChange={(e) => setBulkDecisionNote(e.target.value)}
              placeholder="e.g. Bulk approved following department schedule review"
              className="w-full p-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button size="sm" variant="outline" onClick={() => setShowBulkConfirm(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant={bulkAction === "APPROVED" ? "primary" : "danger"}
              isLoading={bulkDecideMutation.isPending}
              onClick={handleExecuteBulk}
              className={bulkAction === "APPROVED" ? "bg-emerald-600 hover:bg-emerald-700" : ""}
            >
              Confirm Bulk {bulkAction === "APPROVED" ? "Approve" : "Reject"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* BULK RESULT SUMMARY MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={showBulkResultModal}
        onClose={() => setShowBulkResultModal(false)}
        title="Bulk Review Execution Results"
        maxWidth="lg"
      >
        {bulkResult && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-3 text-center text-xs">
              <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800">
                <span className="text-slate-500 block">Total Processed</span>
                <span className="text-lg font-bold text-slate-900 dark:text-white">{bulkResult.total}</span>
              </div>
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-200">
                <span className="block">Successful</span>
                <span className="text-lg font-bold">{bulkResult.successful.length}</span>
              </div>
              <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-200">
                <span className="block">Failed</span>
                <span className="text-lg font-bold">{bulkResult.failed.length}</span>
              </div>
            </div>

            {bulkResult.failed.length > 0 && (
              <div className="space-y-2">
                <h4 className="text-xs font-bold text-rose-700 dark:text-rose-400 uppercase">
                  Failed Items Detail:
                </h4>
                <div className="max-h-36 overflow-y-auto space-y-1.5 border border-rose-200 dark:border-rose-900 rounded-lg p-2 bg-rose-50/40">
                  {bulkResult.failed.map((f, i) => (
                    <div key={i} className="text-xs flex justify-between items-center">
                      <span className="font-mono text-slate-700 dark:text-slate-300">{f.requestId}</span>
                      <span className="text-rose-600 font-medium">{f.reason}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button size="sm" variant="primary" onClick={() => setShowBulkResultModal(false)}>
                Done
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* BALANCE MANUAL ADJUSTMENT MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={Boolean(adjustTarget)}
        onClose={() => setAdjustTarget(null)}
        title="Manual Leave Quota Adjustment"
        maxWidth="md"
      >
        {adjustTarget && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/60 text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Employee:</span>
                <span className="font-bold text-slate-900 dark:text-white">
                  {adjustTarget.employeeName} ({adjustTarget.employeeId})
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Leave Category:</span>
                <span className="font-bold text-blue-600">{adjustTarget.typeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Target Year:</span>
                <span className="font-mono">{adjustTarget.year}</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Allotted Days:
                </label>
                <Input
                  type="number"
                  min={0}
                  value={adjustAllotted}
                  onChange={(e) => setAdjustAllotted(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                  Carried Over Days:
                </label>
                <Input
                  type="number"
                  min={0}
                  value={adjustCarried}
                  onChange={(e) => setAdjustCarried(Number(e.target.value))}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300 block">
                Audit Justification (Required):
              </label>
              <textarea
                rows={2}
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="State the formal HR rationale for this quota adjustment..."
                className="w-full p-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
              <span className="text-[10px] text-slate-400">
                Minimum 5 characters. This adjustment is immutably recorded in the compliance audit log.
              </span>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
              <Button size="sm" variant="outline" onClick={() => setAdjustTarget(null)}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                isLoading={adjustMutation.isPending}
                onClick={handleExecuteAdjustment}
              >
                Save Adjustment
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* ========================================================================= */}
      {/* ANNUAL CARRY-FORWARD MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={showCarryForwardModal}
        onClose={() => setShowCarryForwardModal(false)}
        title="Execute Annual Carry-Forward Rollover"
        maxWidth="md"
      >
        <div className="space-y-4 text-xs">
          <p className="text-slate-600 dark:text-slate-400">
            This operation evaluates unused balances for all active employees across eligible leave types and
            rolls them into the next calendar year, capped by each type's max carry-forward threshold.
          </p>

          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800 rounded-lg">
            <div>
              <label className="font-semibold block mb-1">Source Year:</label>
              <Input
                type="number"
                value={carryFromYear}
                onChange={(e) => setCarryFromYear(Number(e.target.value))}
              />
            </div>
            <div>
              <label className="font-semibold block mb-1">Destination Year:</label>
              <Input
                type="number"
                value={carryToYear}
                onChange={(e) => setCarryToYear(Number(e.target.value))}
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button size="sm" variant="outline" onClick={() => setShowCarryForwardModal(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              isLoading={carryForwardMutation.isPending}
              onClick={handleExecuteCarryForward}
            >
              Run Rollover
            </Button>
          </div>
        </div>
      </Modal>

      {/* ========================================================================= */}
      {/* ADD / EDIT LEAVE TYPE MODAL */}
      {/* ========================================================================= */}
      <Modal
        isOpen={showTypeModal}
        onClose={() => setShowTypeModal(false)}
        title={editingType ? `Edit Leave Category: ${editingType.name}` : "Configure New Leave Category"}
        maxWidth="lg"
      >
        <form onSubmit={handleSaveType} className="space-y-4 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Category Name:
              </label>
              <Input
                required
                value={typeForm.name}
                onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })}
                placeholder="e.g. Paid Time Off"
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Code:
              </label>
              <Input
                required
                value={typeForm.code}
                onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value.toUpperCase() })}
                placeholder="e.g. PTO"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Annual Quota (Days):
              </label>
              <Input
                type="number"
                min={0}
                required
                value={typeForm.annualQuota}
                onChange={(e) => setTypeForm({ ...typeForm, annualQuota: Number(e.target.value) })}
              />
            </div>
            <div>
              <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
                Compensation:
              </label>
              <Select
                options={[
                  { value: "true", label: "Paid Leave" },
                  { value: "false", label: "Unpaid Leave" },
                ]}
                value={String(typeForm.paid)}
                onChange={(e) => setTypeForm({ ...typeForm, paid: e.target.value === "true" })}
              />
            </div>
          </div>

          <div className="p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-semibold text-slate-900 dark:text-white block">
                  Carry-Forward to Next Year
                </span>
                <span className="text-[11px] text-slate-500">
                  Allow unused quota to roll over into the following calendar year.
                </span>
              </div>
              <input
                type="checkbox"
                checked={typeForm.carryAllowed}
                onChange={(e) => setTypeForm({ ...typeForm, carryAllowed: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600"
              />
            </div>

            {typeForm.carryAllowed && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-slate-200/60 dark:border-slate-700">
                <div>
                  <label className="font-medium text-slate-600 dark:text-slate-400 block mb-1">
                    Max Rollover Days:
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={typeForm.maxCarryDays}
                    onChange={(e) => setTypeForm({ ...typeForm, maxCarryDays: Number(e.target.value) })}
                  />
                </div>
                <div>
                  <label className="font-medium text-slate-600 dark:text-slate-400 block mb-1">
                    Expiry Window (Months):
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={typeForm.expiryMonths}
                    onChange={(e) => setTypeForm({ ...typeForm, expiryMonths: Number(e.target.value) })}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40">
            <div>
              <span className="font-semibold text-slate-900 dark:text-white block">
                Allow Half-Day Bookings
              </span>
              <span className="text-[11px] text-slate-500">
                Permits employees to request 0.5-day morning or afternoon off.
              </span>
            </div>
            <input
              type="checkbox"
              checked={typeForm.halfDayAllowed}
              onChange={(e) => setTypeForm({ ...typeForm, halfDayAllowed: e.target.checked })}
              className="w-4 h-4 rounded text-blue-600"
            />
          </div>

          <div>
            <label className="font-semibold text-slate-700 dark:text-slate-300 block mb-1">
              Description (Optional):
            </label>
            <textarea
              rows={2}
              value={typeForm.description}
              onChange={(e) => setTypeForm({ ...typeForm, description: e.target.value })}
              placeholder="e.g. Standard statutory paid time off for full-time employees."
              className="w-full p-2.5 text-xs rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
            />
          </div>

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800">
            <Button size="sm" variant="outline" type="button" onClick={() => setShowTypeModal(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="primary"
              type="submit"
              isLoading={createTypeMutation.isPending || updateTypeMutation.isPending}
            >
              {editingType ? "Update Category" : "Create Category"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Quick Decision Confirmation */}
      {confirmSingleAction && selectedRequest && (
        <ConfirmDialog
          isOpen={Boolean(confirmSingleAction)}
          onClose={() => setConfirmSingleAction(null)}
          onConfirm={() => handleExecuteSingleDecision(confirmSingleAction)}
          title={`Confirm ${confirmSingleAction === "APPROVED" ? "Approval" : "Rejection"}`}
          message={`Are you sure you want to mark this leave request as ${confirmSingleAction.toLowerCase()}?`}
          confirmText={`Yes, ${confirmSingleAction === "APPROVED" ? "Approve" : "Reject"}`}
          variant={confirmSingleAction === "APPROVED" ? "primary" : "danger"}
          isLoading={decideMutation.isPending}
        />
      )}
    </div>
  );
};
export default LeavePage;
