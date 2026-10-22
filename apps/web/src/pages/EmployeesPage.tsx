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

  // 2. Drawer & Modal States
  const [isFormDrawerOpen, setIsFormDrawerOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<EmployeeItem | null>(null);
  const [statusTargetEmployee, setStatusTargetEmployee] = useState<EmployeeItem | null>(null);
  const [statusReason, setStatusReason] = useState("");
  const [profileEmployee, setProfileEmployee] = useState<EmployeeItem | null>(null);
  const [duplicateIdError, setDuplicateIdError] = useState<string | null>(null);

  // 3. Data Queries & Mutations
  const { data: employeeData, isLoading, isFetching, refetch } = useEmployees(filters);
  const { data: policyData } = useActivePolicy();
  const createMutation = useCreateEmployee();
  const updateMutation = useUpdateEmployee();
  const statusMutation = useUpdateEmployeeStatus();
  const { data: attendanceSnapshot, isLoading: isSnapshotLoading } = useEmployeeAttendanceSnapshot(
    profileEmployee?.employeeId
  );

  // 4. Form Hook
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
  const handleOpenEdit = (emp: EmployeeItem) => {
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
        // Edit existing employee
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
        // Create new employee
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

      // Detect duplicate employeeId or email
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

  // Status Change Confirmation
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

  const pagination = employeeData?.pagination;
  const employees = employeeData?.data || [];
  const isFiltered = Boolean(
    filters.search || filters.department || filters.status || filters.workType
  );

  return (
    <div className="space-y-6">
      {/* Page Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Employee Directory
            </h1>
            {pagination && (
              <Badge variant="info" size="md">
                {pagination.total} Total Staff
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
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

      {/* Filter Toolbar */}
      <Card className="p-4 space-y-3 bg-white border border-slate-200 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
          {/* Search Input */}
          <form onSubmit={handleSearchSubmit} className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, ID or email..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-20 py-2 text-xs rounded-lg bg-slate-50 border border-slate-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:bg-white"
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
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
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
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
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
              className="w-full px-3 py-2 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
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
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500">Filtered view active</span>
            <button
              onClick={handleResetFilters}
              className="text-blue-600 hover:text-blue-800 font-semibold"
            >
              Reset all filters
            </button>
          </div>
        )}
      </Card>

      {/* Employees Table Card */}
      <Card className="border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider select-none">
                <th
                  onClick={() => handleSort("name")}
                  className="px-6 py-3 cursor-pointer hover:bg-slate-100/80 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Employee</span>
                    {filters.sortBy === "name" ? (
                      filters.sortOrder === "asc" ? (
                        <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </th>
                <th
                  onClick={() => handleSort("department")}
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100/80 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Department & Role</span>
                    {filters.sortBy === "department" ? (
                      filters.sortOrder === "asc" ? (
                        <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
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
                  className="px-4 py-3 cursor-pointer hover:bg-slate-100/80 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span>Joining Date</span>
                    {filters.sortBy === "joiningDate" ? (
                      filters.sortOrder === "asc" ? (
                        <ArrowUp className="w-3.5 h-3.5 text-blue-600" />
                      ) : (
                        <ArrowDown className="w-3.5 h-3.5 text-blue-600" />
                      )
                    ) : (
                      <ArrowUpDown className="w-3.5 h-3.5 text-slate-400" />
                    )}
                  </div>
                </th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-6 py-4">
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
                  <td colSpan={7} className="px-6 py-12 text-center">
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

                  return (
                    <tr
                      key={emp._id}
                      className="hover:bg-slate-50/70 transition-colors group"
                    >
                      {/* Employee Identification */}
                      <td className="px-6 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-slate-100 border border-slate-200 text-slate-700 flex items-center justify-center font-bold text-xs shrink-0">
                            {initials}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900 flex items-center gap-1.5">
                              <span>{emp.name}</span>
                            </div>
                            <div className="text-[11px] text-slate-400 flex items-center gap-1">
                              <span className="font-mono text-slate-600 font-medium">
                                {emp.employeeId}
                              </span>
                              <span>&bull;</span>
                              <span>{emp.email}</span>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Department & Role */}
                      <td className="px-4 py-3.5">
                        <div className="font-medium text-slate-900">{emp.department}</div>
                        <div className="text-[11px] text-slate-500">{emp.designation}</div>
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
                            <span className="font-medium text-slate-800">{shiftInfo.name}</span>
                            <span className="text-[10px] text-slate-400 block font-mono">
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
                      <td className="px-4 py-3.5 font-mono text-slate-600 text-[11px]">
                        {emp.joiningDate}
                      </td>

                      {/* Action Buttons */}
                      <td className="px-6 py-3.5 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setProfileEmployee(emp)}
                            className="p-1.5 h-8 text-slate-500 hover:text-blue-600"
                            title="View Profile & Snapshot"
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEdit(emp)}
                            className="p-1.5 h-8 text-slate-500 hover:text-amber-600"
                            title="Edit Employee"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setStatusTargetEmployee(emp);
                              setStatusReason("");
                            }}
                            className={`p-1.5 h-8 ${
                              emp.isActive
                                ? "text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                                : "text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50"
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
          <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 select-none">
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
                className="px-2 py-1 rounded bg-white border border-slate-200 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
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
              <span className="px-3 py-1 font-semibold text-slate-800">
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
              isLoading={isSubmitting}
            >
              {editingEmployee ? "Save Changes" : "Create Employee"}
            </Button>
          </>
        }
      >
        <form onSubmit={handleSubmit(onSubmitForm)} className="space-y-4">
          {/* Duplicate ID Warning Banner */}
          {duplicateIdError && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-rose-900 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold block">Duplicate ID Error</span>
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
      {/* Modal: Activate / Deactivate Confirmation                */}
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
                ? "bg-rose-50 border-rose-200 text-rose-900"
                : "bg-emerald-50 border-emerald-200 text-emerald-900"
            }`}
          >
            {statusTargetEmployee?.isActive ? (
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
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
            <label className="block text-xs font-semibold text-slate-700 tracking-wide uppercase mb-1.5">
              Reason for Status Transition (Audit Trail)
            </label>
            <textarea
              rows={2}
              value={statusReason}
              onChange={(e) => setStatusReason(e.target.value)}
              placeholder="e.g. Resignation, administrative leave, or return to active duties"
              className="w-full px-3 py-2 text-xs rounded-lg bg-white border border-slate-300 text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600"
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
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 text-white flex items-center justify-center font-bold text-lg shadow-md shadow-blue-500/20 shrink-0">
                {profileEmployee.name
                  .split(" ")
                  .map((n) => n[0])
                  .slice(0, 2)
                  .join("")}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-slate-900 text-base truncate">
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
                <p className="text-xs text-slate-500">{profileEmployee.designation}</p>
                <p className="text-[11px] text-slate-400 font-mono mt-0.5">
                  {profileEmployee.email}
                </p>
              </div>
            </div>

            {/* Profile Meta Grid */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Department</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-blue-600" />
                  {profileEmployee.department}
                </span>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Work Type</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Briefcase className="w-3.5 h-3.5 text-indigo-600" />
                  {profileEmployee.workType.replace("_", " ")}
                </span>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Joining Date</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5 font-mono">
                  <Calendar className="w-3.5 h-3.5 text-cyan-600" />
                  {profileEmployee.joiningDate}
                </span>
              </div>

              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <span className="text-slate-400 block mb-0.5">Shift Schedule</span>
                <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-amber-600" />
                  {profileEmployee.shiftId && shiftsMap.get(profileEmployee.shiftId)
                    ? shiftsMap.get(profileEmployee.shiftId)?.name
                    : "Standard General"}
                </span>
              </div>
            </div>

            {/* Attendance Snapshot */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Recent Attendance Snapshot
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    setProfileEmployee(null);
                    navigate(`/attendance?employeeId=${profileEmployee.employeeId}`);
                  }}
                  className="text-xs text-blue-600 hover:text-blue-800 font-semibold"
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
                <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-white">
                  {attendanceSnapshot.data.map((record) => (
                    <div
                      key={record._id}
                      className="p-3 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-mono font-semibold text-slate-800">
                          {record.dateKey}
                        </span>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
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
                <div className="p-6 bg-slate-50 border border-slate-200 rounded-xl text-center text-xs text-slate-400">
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
