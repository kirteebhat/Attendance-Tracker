import React, { useState, useMemo } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useNavigate } from "react-router-dom";
import {
  UserPlus,
  Search,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Eye,
  Pencil,
  Power,
  AlertTriangle,
  CheckCircle2,
  RotateCw,
  Building2,
  Briefcase,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  CheckSquare,
  Square,
  X,
} from "lucide-react";
import {
  useEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useUpdateEmployeeStatus,
  useActivePolicy,
  useEmployeeAttendanceSnapshot,
  EmployeeItem,
  EmployeeFilters,
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
import { WorkType, AttendanceStatus } from "@vorldx/shared";

// Form validation schema matching backend EmployeeCreateSchema / EmployeeUpdateSchema
const employeeFormSchema = z.object({
  employeeId: z
    .string()
    .min(3, "Employee ID must be at least 3 characters")
    .max(20, "Employee ID cannot exceed 20 characters")
    .trim(),
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name cannot exceed 100 characters")
    .trim(),
  email: z.string().email("Please provide a valid email address").trim(),
  department: z.string().min(2, "Department is required").trim(),
  designation: z.string().min(2, "Designation is required").trim(),
  workType: z.nativeEnum(WorkType),
  shiftId: z.string().optional(),
  joiningDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Joining date must be YYYY-MM-DD"),
});

type EmployeeFormData = z.infer<typeof employeeFormSchema>;

const DEPARTMENTS = [
  "Engineering",
  "Product",
  "Operations",
  "Marketing",
  "HR",
  "Executive",
  "Finance",
  "Design",
];

export const EmployeesPage: React.FC = () => {
  const navigate = useNavigate();
  const { success, error } = useToast();

  // 1. Table Filters and Pagination State
  const [filters, setFilters] = useState<EmployeeFilters>({
    page: 1,
    limit: 10,
    search: "",
    department: "",
    status: "",
    workType: "",
    sortBy: "createdAt",
    sortOrder: "desc",
  });

  const [searchInput, setSearchInput] = useState("");

  // 2. Selection & Bulk Action States
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkActionTarget, setBulkActionTarget] = useState<"activate" | "deactivate" | null>(null);
  const [isBulkProcessing, setIsBulkProcessing] = useState(false);

  // 3. Drawer & Modal States
  const [isFormDrawerOpen, setIsFormDrawerOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeItem | null>(null);
  const [statusTargetEmployee, setStatusTargetEmployee] = useState<EmployeeItem | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const [profileEmployee, setProfileEmployee] = useState<EmployeeItem | null>(null);
  const [duplicateIdError, setDuplicateIdError] = useState<string | null>(null);

  // 4. Data Queries & Mutations
  const { data: employeeData, isLoading, isFetching, refetch } = useEmployees(filters);
  const { data: policyData } = useActivePolicy();
  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const statusMutation = useUpdateEmployeeStatus();
  const { data: attendanceSnapshot, isLoading: isSnapshotLoading } = useEmployeeAttendanceSnapshot(
    profileEmployee?.employeeId
  );

  // 5. Form Hook
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<EmployeeFormData>({
    resolver: zodResolver(employeeFormSchema),
    defaultValues: {
      employeeId: "",
      name: "",
      email: "",
      department: "Engineering",
      designation: "",
      workType: WorkType.FULL_TIME,
      shiftId: "",
      joiningDate: new Date().toISOString().slice(0, 10),
    },
  });

  // Shifts lookup map
  const shiftsMap = useMemo(() => {
    const map = new Map<string, { name: string; startTime: string; endTime: string }>();
    if (policyData?.shifts) {
      policyData.shifts.forEach((s) => {
        if (s._id) {
          map.set(s._id, { name: s.name, startTime: s.startTime, endTime: s.endTime });
        }
      });
    }
    return map;
  }, [policyData]);

  const pagination = employeeData?.pagination;
  const employees = employeeData?.data || [];
  const isFiltered = Boolean(
    filters.search || filters.department || filters.status || filters.workType
  );

  // Row Selection Helpers
  const isAllPageSelected =
    employees.length > 0 && employees.every((emp) => selectedIds.includes(emp._id));

  const handleToggleSelectAll = () => {
    if (isAllPageSelected) {
      setSelectedIds([]);
    } else {
      setSelectedIds(employees.map((emp) => emp._id));
    }
  };

  const handleToggleSelectRow = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  // Open Form Drawer for New Employee
  const handleOpenAdd = () => {
    setEditingEmployee(null);
    setDuplicateIdError(null);
    reset({
      employeeId: `EMP-${Math.floor(100 + Math.random() * 900)}`,
      name: "",
      email: "",
      department: "Engineering",
      designation: "Software Engineer",
      workType: WorkType.FULL_TIME,
      shiftId: policyData?.shifts?.[0]?._id || "",
      joiningDate: new Date().toISOString().slice(0, 10),
    });
    setIsFormDrawerOpen(true);
  };

  // Open Form Drawer for Editing
  const handleOpenEdit = (emp: EmployeeItem, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingEmployee(emp);
    setDuplicateIdError(null);
    reset({
      employeeId: emp.employeeId,
      name: emp.name,
      email: emp.email,
      department: emp.department,
      designation: emp.designation,
      workType: emp.workType,
      shiftId: emp.shiftId || "",
      joiningDate: emp.joiningDate,
    });
    setIsFormDrawerOpen(true);
  };

  // Submit Add or Edit Form
  const onSubmitForm = async (formData: EmployeeFormData) => {
    setDuplicateIdError(null);
    try {
      if (editingEmployee) {
        await updateMutation.mutateAsync({
          id: editingEmployee._id,
          data: {
            name: formData.name,
            email: formData.email,
            department: formData.department,
            designation: formData.designation,
            workType: formData.workType,
            shiftId: formData.shiftId || undefined,
            joiningDate: formData.joiningDate,
          },
        });
        success("Employee Updated", `${formData.name} was successfully updated.`);
      } else {
        await createMutation.mutateAsync({
          ...formData,
          shiftId: formData.shiftId || undefined,
        });
        success(
          "Employee Onboarded",
          `${formData.name} (${formData.employeeId}) has been added to the directory.`
        );
      }
      setIsFormDrawerOpen(false);
    } catch (err: unknown) {
      const errorObj = err as { message?: string; status?: number; code?: string };
      const msg = errorObj.message || "Failed to save employee record";

      if (
        errorObj.status === 409 ||
        msg.toLowerCase().includes("already exists") ||
        msg.toLowerCase().includes("duplicate")
      ) {
        if (msg.toLowerCase().includes("id") || msg.toLowerCase().includes("employee")) {
          setDuplicateIdError(msg);
          setError("employeeId", { message: "Employee ID is already in use" });
        } else {
          setDuplicateIdError(msg);
          setError("email", { message: "Email is already in use" });
        }
      } else {
        error("Operation Failed", msg);
      }
    }
  };

  // Single Status Change Confirmation
  const handleConfirmStatusChange = async () => {
    if (!statusTargetEmployee) return;
    const targetStatus = !statusTargetEmployee.isActive;

    try {
      await statusMutation.mutateAsync({
        id: statusTargetEmployee._id,
        isActive: targetStatus,
        reason: statusReason || undefined,
      });

      success(
        targetStatus ? "Employee Activated" : "Employee Deactivated",
        `${statusTargetEmployee.name} is now ${targetStatus ? "ACTIVE" : "INACTIVE"}.`
      );

      setStatusTargetEmployee(null);
      setStatusReason("");
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      error("Status Update Failed", errorObj.message || "Unable to update employee status");
    }
  };

  // Bulk Status Update Execution
  const handleExecuteBulkStatus = async () => {
    if (!bulkActionTarget || selectedIds.length === 0) return;
    setIsBulkProcessing(true);
    const targetStatus = bulkActionTarget === "activate";

    try {
      const results = await Promise.allSettled(
        selectedIds.map((id) =>
          statusMutation.mutateAsync({
            id,
            isActive: targetStatus,
            reason: `Bulk ${targetStatus ? "activation" : "deactivation"} via employee directory`,
          })
        )
      );

      const fulfilled = results.filter((r) => r.status === "fulfilled").length;
      const rejected = results.filter((r) => r.status === "rejected").length;

      if (fulfilled > 0) {
        success(
          "Bulk Action Completed",
          `Successfully ${targetStatus ? "activated" : "deactivated"} ${fulfilled} employee(s).${
            rejected > 0 ? ` (${rejected} failed)` : ""
          }`
        );
      } else {
        error("Bulk Action Failed", "None of the selected employee statuses could be updated.");
      }

      setSelectedIds([]);
      setBulkActionTarget(null);
    } catch (err: unknown) {
      const errorObj = err as { message?: string };
      error("Bulk Action Failed", errorObj.message || "An unexpected error occurred.");
    } finally {
      setIsBulkProcessing(false);
    }
  };

  // Sorting Handler
  const handleSort = (field: string) => {
    setFilters((prev) => {
      const isSame = prev.sortBy === field;
      const nextOrder = isSame && prev.sortOrder === "asc" ? "desc" : "asc";
      return { ...prev, sortBy: field, sortOrder: nextOrder, page: 1 };
    });
  };

  // Search submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((prev) => ({ ...prev, search: searchInput.trim(), page: 1 }));
  };

  // Reset Filters
  const handleResetFilters = () => {
    setSearchInput("");
    setFilters({
      page: 1,
      limit: 10,
      search: "",
      department: "",
      status: "",
      workType: "",
      sortBy: "createdAt",
      sortOrder: "desc",
    });
  };

  return (
    <div className="space-y-6">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              Employee Directory
            </h1>
            {pagination && (
              <Badge variant="info" size="md">
                {pagination.total} Total Staff
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Workforce roster, shift assignments, status activation/deactivation, and profile snapshots
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5"
            title="Refresh employee roster"
          >
            <RotateCw className={`w-4 h-4 ${isFetching ? "animate-spin text-blue-600" : ""}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleOpenAdd}
            className="flex items-center gap-1.5 shadow-xs"
          >
            <UserPlus className="w-4 h-4" />
            <span>Add Employee</span>
          </Button>
        </div>
      </div>

      {/* Bulk Selection Bar */}
      {selectedIds.length > 0 && (
        <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-900 rounded-xl text-xs text-blue-900 dark:text-blue-100 shadow-xs animate-in fade-in duration-150">
          <div className="flex items-center gap-2 font-semibold">
            <span className="px-2 py-0.5 bg-blue-600 text-white rounded-md text-[11px]">
              {selectedIds.length}
            </span>
            <span>employee(s) selected on this page</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkActionTarget("activate")}
              className="text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/50 border-emerald-300 dark:border-emerald-800 text-xs h-7 px-2.5"
            >
              Bulk Activate
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setBulkActionTarget("deactivate")}
              className="text-rose-700 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 border-rose-300 dark:border-rose-800 text-xs h-7 px-2.5"
            >
              Bulk Deactivate
            </Button>
            <button
              type="button"
              onClick={() => setSelectedIds([])}
              className="p-1 text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
              title="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <Card className="p-4 space-y-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, ID or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-20 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:bg-white dark:focus-visible:bg-slate-900"
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-7 text-xs px-2.5"
            >
              Search
            </Button>
          </form>

          {/* Department Filter */}
          <div>
            <select
              value={filters.department || ""}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, department: e.target.value, page: 1 }))
              }
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <option value="">All Departments</option>
              {DEPARTMENTS.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={filters.status || ""}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, status: e.target.value, page: 1 }))
              }
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </select>
          </div>

          {/* Work Type Filter */}
          <div>
            <select
              value={filters.workType || ""}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, workType: e.target.value, page: 1 }))
              }
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            >
              <option value="">All Work Types</option>
              <option value={WorkType.FULL_TIME}>Full Time</option>
              <option value={WorkType.PART_TIME}>Part Time</option>
              <option value={WorkType.CONTRACT}>Contract</option>
              <option value={WorkType.INTERN}>Intern</option>
            </select>
          </div>
        </div>

        {/* Active Filters Clear Row */}
        {isFiltered && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
            <span className="text-slate-500 dark:text-slate-400">Filtered view active</span>
            <button
              onClick={handleResetFilters}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-800 font-semibold"
            >
              Reset all filters
            </button>
          </div>
        )}
      </Card>

      {/* Employees Table Card */}
      <Card className="border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xs bg-white dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="sticky top-0 bg-slate-50/95 dark:bg-slate-900/95 backdrop-blur-xs border-b border-slate-200 dark:border-slate-800 text-[11px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider select-none z-10">
                <th className="px-4 py-3 w-10 text-center">
                  <button
                    type="button"
                    onClick={handleToggleSelectAll}
                    className="text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 inline-flex items-center"
                    title={isAllPageSelected ? "Deselect all on this page" : "Select all on this page"}
                  >
                    {isAllPageSelected ? (
                      <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th
                  onClick={() => handleSort("name")}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Employee</span>
                    {filters.sortBy === "name" ? (
                      filters.sortOrder === "asc" ? (
                        <ArrowUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("department")}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Department & Role</span>
                    {filters.sortBy === "department" ? (
                      filters.sortOrder === "asc" ? (
                        <ArrowUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </th>
                <th className="px-4 py-3">Work Type</th>
                <th className="px-4 py-3">Assigned Shift</th>
                <th className="px-4 py-3">Status</th>
                <th
                  onClick={() => handleSort("joiningDate")}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100/80 dark:hover:bg-slate-800/80 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Joining Date</span>
                    {filters.sortBy === "joiningDate" ? (
                      filters.sortOrder === "asc" ? (
                        <ArrowUp className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-4 text-center">
                      <Skeleton className="w-4 h-4 mx-auto rounded" />
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-3">
                        <Skeleton className="w-8 h-8 rounded-full" />
                        <div className="space-y-1">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-20" />
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <Skeleton className="h-4 w-28 mb-1" />
                      <Skeleton className="h-3 w-20" />
                    </td>
                    <td className="px-4 py-4">
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </td>
                    <td className="px-4 py-4">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-4 py-4">
                      <Skeleton className="h-5 w-16 rounded-full" />
                    </td>
                    <td className="px-4 py-4">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Skeleton className="h-8 w-20 ml-auto rounded-lg" />
                    </td>
                  </tr>
                ))
              ) : employees.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center">
                    <EmptyState
                      title="No employees found"
                      description={
                        isFiltered
                          ? "Try adjusting your search criteria or clearing filters."
                          : "No employees currently in roster. Click 'Add Employee' to onboard staff."
                      }
                      action={
                        isFiltered ? (
                          <Button variant="outline" size="sm" onClick={handleResetFilters}>
                            Clear Filters
                          </Button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                employees.map((emp) => {
                  const shiftInfo = emp.shiftId ? shiftsMap.get(emp.shiftId) : null;
                  const initials = emp.name
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();
                  const isSelected = selectedIds.includes(emp._id);
                  const isProfileActive = profileEmployee?._id === emp._id;

                  return (
                    <tr
                      key={emp._id}
                      onClick={() => setProfileEmployee(emp)}
                      className={`cursor-pointer transition-colors group ${
                        isProfileActive
                          ? "bg-blue-50/90 dark:bg-blue-950/50 ring-1 ring-blue-500/30"
                          : isSelected
                          ? "bg-blue-50/50 dark:bg-blue-950/30"
                          : "hover:bg-slate-50/70 dark:hover:bg-slate-800/40"
                      }`}
                    >
                      {/* Checkbox */}
                      <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          onClick={(e) => handleToggleSelectRow(emp._id, e)}
                          className="text-slate-400 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>

                      {/* Employee Identification */}
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 flex items-center justify-center font-bold text-xs shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-1.5">
                              <span>{emp.name}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 dark:text-slate-400 flex items-center gap-1">
                              <span className="font-mono text-slate-600 dark:text-slate-300 font-medium">
                                {emp.employeeId}
                              </span>
                              <span>&bull;</span>
                              <span className="truncate max-w-[140px] sm:max-w-none">{emp.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Department & Role */}
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-900 dark:text-slate-100">{emp.department}</div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400">{emp.designation}</div>
                      </td>

                      {/* Work Type */}
                      <td className="px-4 py-3.5">
                        <Badge
                          variant={
                            emp.workType === WorkType.FULL_TIME
                              ? "info"
                              : emp.workType === WorkType.CONTRACT
                              ? "warning"
                              : "neutral"
                          }
                          size="sm"
                        >
                          {emp.workType.replace("_", " ")}
                        </Badge>
                      </td>

                      {/* Shift */}
                      <td className="px-4 py-3.5">
                        {shiftInfo ? (
                          <div>
                            <span className="font-medium text-slate-800 dark:text-slate-200">{shiftInfo.name}</span>
                            <span className="text-[10px] text-slate-400 dark:text-slate-500 block font-mono">
                              {shiftInfo.startTime} - {shiftInfo.endTime}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Default Shift</span>
                        )}
                      </td>

                      {/* Active Status Badge */}
                      <td className="px-4 py-3.5">
                        {emp.isActive ? (
                          <Badge variant="success" size="sm" className="inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Active</span>
                          </Badge>
                        ) : (
                          <Badge variant="danger" size="sm" className="inline-flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                            <span>Inactive</span>
                          </Badge>
                        )}
                      </td>

                      {/* Joining Date */}
                      <td className="px-4 py-3.5 font-mono text-slate-600 dark:text-slate-300 text-[11px]">
                        {emp.joiningDate}
                      </td>

                      {/* Action Buttons */}
                      <td className="px-6 py-3.5 text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setProfileEmployee(emp)}
                            className="p-1.5 h-8 text-slate-500 hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
                            title="View Profile & Snapshot"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => handleOpenEdit(emp, e)}
                            className="p-1.5 h-8 text-slate-500 hover:text-amber-600 dark:text-slate-400 dark:hover:text-amber-400"
                            title="Edit Employee"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              setStatusTargetEmployee(emp);
                              setStatusReason("");
                            }}
                            className={`p-1.5 h-8 ${
                              emp.isActive
                                ? "text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                                : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                            }`}
                            title={emp.isActive ? "Deactivate employee" : "Activate employee"}
                          >
                            <Power className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination && pagination.totalPages > 0 && (
          <div className="px-6 py-3.5 bg-slate-50 dark:bg-slate-900/80 border-t border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 dark:text-slate-400 select-none">
            <div className="flex items-center gap-2">
              <span>Rows per page:</span>
              <select
                value={filters.limit || 10}
                onChange={(e) =>
                  setFilters((prev) => ({
                    ...prev,
                    limit: parseInt(e.target.value, 10),
                    page: 1,
                  }))
                }
                className="px-2 py-1 rounded bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-800 dark:text-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
              >
                <option value={10}>10</option>
                <option value={20}>20</option>
                <option value={50}>50</option>
              </select>
              <span className="text-slate-400 ml-2">
                Showing {Math.min((pagination.page - 1) * pagination.limit + 1, pagination.total)} to{" "}
                {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}{" "}
                employees
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) - 1 }))}
                className="h-8 px-2.5"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline ml-1">Previous</span>
              </Button>
              <span className="px-3 py-1 font-semibold text-slate-800 dark:text-slate-200">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))}
                className="h-8 px-2.5"
              >
                <span className="hidden sm:inline mr-1">Next</span>
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* ======================================================== */}
      {/* Drawer: Add / Edit Employee                              */}
      {/* ======================================================== */}
      <Drawer
        isOpen={isFormDrawerOpen}
        onClose={() => setIsFormDrawerOpen(false)}
        title={editingEmployee ? `Edit Employee: ${editingEmployee.name}` : "Onboard New Employee"}
        description={
          editingEmployee
            ? "Update profile details, role, department, or shift assignment."
            : "Register a new corporate employee into the workforce directory."
        }
        width="lg"
        footer={
          <>
            <Button
              variant="outline"
              size="md"
              type="button"
              onClick={() => setIsFormDrawerOpen(false)}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              size="md"
              type="button"
              onClick={handleSubmit(onSubmitForm)}
              isLoading={isSubmitting || createMutation.isPending || updateMutation.isPending}
            >
              {editingEmployee ? "Save Changes" : "Create Employee"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4">
          {duplicateIdError && (
            <div className="p-3.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-xl flex items-start gap-2.5 text-rose-900 dark:text-rose-200 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Duplicate Identifier</span>
                {duplicateIdError}
              </div>
            </div>
          )}

          <div>
            <Input
              label="Employee ID (Corporate Identifier)"
              placeholder="e.g. EMP-101"
              disabled={Boolean(editingEmployee)}
              error={errors.employeeId?.message}
              helperText={
                editingEmployee
                  ? "Employee ID cannot be modified once created."
                  : "Unique organization identifier (3-20 characters)."
              }
              {...register("employeeId")}
            />
          </div>

          <div>
            <Input
              label="Full Name"
              placeholder="e.g. Ananya Sharma"
              error={errors.name?.message}
              {...register("name")}
            />
          </div>

          <div>
            <Input
              type="email"
              label="Work Email Address"
              placeholder="e.g. ananya.sharma@vorldx.demo"
              error={errors.email?.message}
              {...register("email")}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Select
                label="Department"
                error={errors.department?.message}
                {...register("department")}
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Input
                label="Designation"
                placeholder="e.g. Senior Software Engineer"
                error={errors.designation?.message}
                {...register("designation")}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Select
                label="Work Type"
                error={errors.workType?.message}
                {...register("workType")}
              >
                <option value={WorkType.FULL_TIME}>Full Time</option>
                <option value={WorkType.PART_TIME}>Part Time</option>
                <option value={WorkType.CONTRACT}>Contract</option>
                <option value={WorkType.INTERN}>Intern</option>
              </Select>
            </div>

            <div>
              <Input
                type="date"
                label="Joining Date"
                error={errors.joiningDate?.message}
                {...register("joiningDate")}
              />
            </div>
          </div>

          <div>
            <Select
              label="Assigned Shift Schedule"
              error={errors.shiftId?.message}
              helperText="Policy grace period and shift windows apply based on this schedule."
              {...register("shiftId")}
            >
              <option value="">Default Company Shift</option>
              {policyData?.shifts?.map((shift) => (
                <option key={shift._id} value={shift._id}>
                  {shift.name} ({shift.startTime} - {shift.endTime})
                </option>
              ))}
            </Select>
          </div>
        </form>
      </Drawer>

      {/* ======================================================== */}
      {/* Modal: Single Activate / Deactivate Confirmation         */}
      {/* ======================================================== */}
      <Modal
        isOpen={Boolean(statusTargetEmployee)}
        onClose={() => setStatusTargetEmployee(null)}
        title={
          statusTargetEmployee?.isActive
            ? `Deactivate ${statusTargetEmployee.name}?`
            : `Activate ${statusTargetEmployee?.name}?`
        }
        description={
          statusTargetEmployee?.isActive
            ? "Deactivating an employee immediately blocks login and QR attendance check-ins without deleting historical attendance logs."
            : "Activating this employee will restore their login access and allow them to punch attendance."
        }
        maxWidth="md"
      >
        <div className="space-y-4">
          <div
            className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs ${
              statusTargetEmployee?.isActive
                ? "bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-900 text-rose-900 dark:text-rose-200"
                : "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900 text-emerald-900 dark:text-emerald-200"
            }`}
          >
            {statusTargetEmployee?.isActive ? (
              <ShieldAlert className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
            )}
            <div>
              <span className="font-semibold block">
                {statusTargetEmployee?.isActive ? "Security Notice" : "Confirmation"}
              </span>
              Employee ID:{" "}
              <span className="font-mono font-bold">{statusTargetEmployee?.employeeId}</span>
              <br />
              Department: {statusTargetEmployee?.department}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 tracking-wide uppercase mb-1.5">
              Reason for Status Transition (Audit Trail)
            </label>
            <textarea
              rows={2}
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="e.g. Resignation, administrative leave, or return to active duties"
              className="w-full px-3 py-2 text-xs rounded-lg bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setStatusTargetEmployee(null)}
            >
              Cancel
            </Button>
            <Button
              variant={statusTargetEmployee?.isActive ? "danger" : "primary"}
              size="sm"
              isLoading={statusMutation.isPending}
              onClick={handleConfirmStatusChange}
            >
              {statusTargetEmployee?.isActive ? "Confirm Deactivation" : "Confirm Activation"}
            </Button>
          </div>
        </div>
      </Modal>

      {/* ======================================================== */}
      {/* ConfirmDialog: Bulk Status Change                        */}
      {/* ======================================================== */}
      <ConfirmDialog
        isOpen={Boolean(bulkActionTarget)}
        onClose={() => setBulkActionTarget(null)}
        onConfirm={handleExecuteBulkStatus}
        title={
          bulkActionTarget === "activate"
            ? `Activate ${selectedIds.length} Selected Employees?`
            : `Deactivate ${selectedIds.length} Selected Employees?`
        }
        message={
          bulkActionTarget === "activate"
            ? `This action will restore active credentials and enable QR scanning for ${selectedIds.length} employees.`
            : `This action will immediately disable access and block QR scanning for ${selectedIds.length} employees.`
        }
        variant={bulkActionTarget === "deactivate" ? "danger" : "primary"}
        confirmText={bulkActionTarget === "activate" ? "Activate All" : "Deactivate All"}
        isLoading={isBulkProcessing}
      />

      {/* ======================================================== */}
      {/* Drawer: Employee Profile & Attendance Snapshot           */}
      {/* ======================================================== */}
      <Drawer
        isOpen={Boolean(profileEmployee)}
        onClose={() => setProfileEmployee(null)}
        title={profileEmployee?.name || "Employee Profile"}
        description={`ID: ${profileEmployee?.employeeId || ""} • ${profileEmployee?.department || ""}`}
        width="lg"
        footer={
          <Button
            variant="outline"
            size="md"
            onClick={() => setProfileEmployee(null)}
          >
            Close Profile
          </Button>
        }
      >
        {profileEmployee && (
          <div className="space-y-6">
            {/* Identity Card */}
            <div className="p-4 bg-slate-50 dark:bg-slate-800/80 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-500/20 shrink-0">
                {profileEmployee.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-base truncate">
                    {profileEmployee.name}
                  </h3>
                  {profileEmployee.isActive ? (
                    <Badge variant="success" size="sm">
                      Active
                    </Badge>
                  ) : (
                    <Badge variant="danger" size="sm">
                      Inactive
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400">{profileEmployee.designation}</p>
                <p className="text-[11px] text-slate-400 dark:text-slate-500 font-mono mt-0.5">
                  {profileEmployee.email}
                </p>
              </div>
            </div>

            {/* Profile Meta Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Department</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  {profileEmployee.department}
                </span>
              </div>

              <div className="p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Work Type</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
                  {profileEmployee.workType.replace("_", " ")}
                </span>
              </div>

              <div className="p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Joining Date</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
                  {profileEmployee.joiningDate}
                </span>
              </div>

              <div className="p-3 bg-white dark:bg-slate-800/50 rounded-lg border border-slate-200 dark:border-slate-700">
                <span className="text-slate-400 dark:text-slate-500 block mb-0.5">Shift Schedule</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                  {profileEmployee.shiftId && shiftsMap.get(profileEmployee.shiftId)
                    ? shiftsMap.get(profileEmployee.shiftId)?.name
                    : "Standard General"}
                </span>
              </div>
            </div>

            {/* Attendance Snapshot */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 dark:text-slate-100 uppercase tracking-wider">
                  Recent Attendance Snapshot
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setProfileEmployee(null);
                    navigate(`/attendance?employeeId=${profileEmployee.employeeId}`);
                  }}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 font-semibold"
                >
                  View Full Ledger &rarr;
                </button>
              </div>

              {isSnapshotLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                  <Skeleton className="h-10 w-full" />
                </div>
              ) : attendanceSnapshot?.data && attendanceSnapshot.data.length > 0 ? (
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden divide-y divide-slate-100 dark:divide-slate-800 bg-white dark:bg-slate-800/60">
                  {attendanceSnapshot.data.map((record) => (
                    <div
                      key={record._id}
                      className="p-3 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-semibold text-slate-800 dark:text-slate-200">
                          {record.dateKey}
                        </span>
                        <div className="text-[11px] text-slate-400 dark:text-slate-400 flex items-center gap-1 mt-0.5">
                          <span>In: {record.checkInTime ? new Date(record.checkInTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"}</span>
                          <span>&bull;</span>
                          <span>Out: {record.checkOutTime ? new Date(record.checkOutTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "--:--"}</span>
                          {record.durationMinutes > 0 && (
                            <>
                              <span>&bull;</span>
                              <span>{Math.floor(record.durationMinutes / 60)}h {record.durationMinutes % 60}m</span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {record.isLate && (
                          <Badge variant="warning" size="sm">
                            Late ({record.lateMinutes}m)
                          </Badge>
                        )}
                        <Badge
                          variant={
                            record.status === AttendanceStatus.PRESENT
                              ? "success"
                              : record.status === AttendanceStatus.LATE
                              ? "warning"
                              : record.status === AttendanceStatus.WFH_APPROVED
                              ? "info"
                              : record.status === AttendanceStatus.CHECKED_OUT
                              ? "primary"
                              : "neutral"
                          }
                          size="sm"
                        >
                          {record.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 rounded-xl text-center text-xs text-slate-400">
                  No attendance punches recorded yet for this employee.
                </div>
              )}
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
