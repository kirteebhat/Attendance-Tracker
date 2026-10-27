import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, tokenStorage, getFullApiUrl } from "./client";
import { AttendanceStatus, WorkType } from "@vorldx/shared";

export interface DashboardDayTrend {
  dateKey: string;
  totalEmployees: number;
  presentCount: number;
  lateCount: number;
  wfhCount: number;
  absentCount: number;
  attendanceRate: number;
}

export interface DashboardSummaryData {
  success: boolean;
  dateKey: string;
  summary: {
    totalActiveEmployees: number;
    presentToday: number;
    lateToday: number;
    wfhToday: number;
    notYetCheckedInToday: number;
    pendingWfhRequests: number;
    attendanceRate: number;
  };
  trends: {
    last7Days: DashboardDayTrend[];
    last30Days: DashboardDayTrend[];
  };
  recentActivity: Array<{
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    performedByEmployeeId?: string;
    reason?: string;
    timestamp: string;
  }>;
}

export interface CurrentUserResponse {
  user: {
    _id: string;
    employeeId: string;
    email: string;
    role: string;
    status: string;
    lastLoginAt?: string;
  };
  employee: {
    _id: string;
    employeeId: string;
    name: string;
    email: string;
    department: string;
    designation: string;
    workType: string;
  } | null;
}

export interface EmployeeItem {
  _id: string;
  employeeId: string;
  name: string;
  email: string;
  department: string;
  designation: string;
  workType: WorkType;
  shiftId?: string | null;
  joiningDate: string;
  isActive: boolean;
  userId?: {
    _id: string;
    role: string;
    status: string;
    lastLoginAt?: string;
  } | null;
  createdAt: string;
  updatedAt?: string;
}

export interface EmployeesResponse {
  success: boolean;
  data: EmployeeItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPrevPage: boolean;
  };
}

export interface AttendanceRecordItem {
  _id: string;
  employee: {
    _id: string;
    name: string;
    email: string;
    department: string;
    designation: string;
    workType: string;
  } | null;
  employeeId: string;
  department: string;
  dateKey: string;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  status: AttendanceStatus;
  isLate: boolean;
  lateMinutes: number;
  durationMinutes: number;
  isWfh?: boolean;
  isManuallyCorrected?: boolean;
  correctionReason?: string;
  correctedBy?: {
    _id: string;
    email: string;
    employeeId: string;
  } | null;
  correctedAt?: string;
  originalValues?: {
    checkInTime?: string | null;
    checkOutTime?: string | null;
    status?: AttendanceStatus;
    durationMinutes?: number;
    isLate?: boolean;
    lateMinutes?: number;
  };
  corrections?: Array<{
    correctionReason: string;
    correctedBy: string;
    correctedAt: string;
    previousValues: Record<string, unknown>;
    newValues: Record<string, unknown>;
  }>;
}

export interface AttendanceRecordsResponse {
  success: boolean;
  data: AttendanceRecordItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface AuditLogItem {
  _id: string;
  entityType: string;
  entityId: string;
  performedBy?: string | null;
  performedByEmployeeId: string;
  action: string;
  previousValue?: unknown;
  newValue?: unknown;
  reason?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export interface AuditLogsResponse {
  success: boolean;
  data: AuditLogItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

// ==========================================
// Dashboard & Session Hooks
// ==========================================

export function useDashboardSummary() {
  return useQuery<DashboardSummaryData>({
    queryKey: ["dashboard-summary"],
    queryFn: () => api.get<DashboardSummaryData>("/api/dashboard/summary"),
    staleTime: 1000 * 30,
    refetchOnWindowFocus: true,
  });
}

export function useCurrentUser() {
  return useQuery<CurrentUserResponse>({
    queryKey: ["current-user"],
    queryFn: () => api.get<CurrentUserResponse>("/api/auth/me"),
    staleTime: 1000 * 60 * 5,
    retry: 1,
  });
}

export function useLogoutMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => api.post("/api/auth/logout"),
    onSuccess: () => {
      queryClient.clear();
    },
  });
}

// ==========================================
// Employee Hooks
// ==========================================

export interface EmployeeFilters {
  page?: number;
  limit?: number;
  search?: string;
  department?: string;
  designation?: string;
  status?: string;
  isActive?: boolean;
  workType?: string;
  shiftId?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export function useEmployees(filters: EmployeeFilters) {
  return useQuery<EmployeesResponse>({
    queryKey: ["employees", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.set("page", String(filters.page));
      if (filters.limit) params.set("limit", String(filters.limit));
      if (filters.search) params.set("search", filters.search);
      if (filters.department) params.set("department", filters.department);
      if (filters.designation) params.set("designation", filters.designation);
      if (filters.status) params.set("status", filters.status);
      if (filters.isActive !== undefined) params.set("isActive", String(filters.isActive));
      if (filters.workType) params.set("workType", filters.workType);
      if (filters.shiftId) params.set("shiftId", filters.shiftId);
      if (filters.sortBy) params.set("sortBy", filters.sortBy);
      if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);

      return api.get<EmployeesResponse>(`/api/employees?${params.toString()}`);
    },
    staleTime: 1000 * 20,
  });
}

export function useCreateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: unknown) =>
      api.post<{ success: boolean; data: EmployeeItem }>("/api/employees", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: unknown }) =>
      api.patch<{ success: boolean; data: EmployeeItem }>(`/api/employees/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
  });
}

export function useUpdateEmployeeStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      isActive,
      reason,
    }: {
      id: string;
      isActive: boolean;
      reason?: string;
    }) =>
      api.patch<{ success: boolean; message: string; data: EmployeeItem }>(
        `/api/employees/${id}/status`,
        { isActive, reason }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useEmployeeAttendanceSnapshot(employeeId?: string) {
  return useQuery<AttendanceRecordsResponse>({
    queryKey: ["employee-attendance-snapshot", employeeId],
    queryFn: async () => {
      if (!employeeId) throw new Error("Employee ID required");
      return api.get<AttendanceRecordsResponse>(
        `/api/attendance?employeeId=${encodeURIComponent(employeeId)}&limit=7&sortBy=dateKey&sortOrder=desc`
      );
    },
    enabled: Boolean(employeeId),
    staleTime: 1000 * 30,
  });
}

// ==========================================
// Attendance Ledger Hooks
// ==========================================

export interface AttendanceFilters {
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  dateKey?: string;
  department?: string;
  employeeId?: string;
  status?: AttendanceStatus;
  workType?: string;
  search?: string;
  sortBy?: "dateKey" | "createdAt" | "employeeId" | "status";
  sortOrder?: "asc" | "desc";
}

export function useAttendanceRecords(filters: AttendanceFilters) {
  return useQuery<AttendanceRecordsResponse>({
    queryKey: ["attendance-records", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.set("page", String(filters.page));
      if (filters.limit) params.set("limit", String(filters.limit));
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);
      if (filters.dateKey) params.set("dateKey", filters.dateKey);
      if (filters.department) params.set("department", filters.department);
      if (filters.employeeId) params.set("employeeId", filters.employeeId);
      if (filters.status) params.set("status", filters.status);
      if (filters.workType) params.set("workType", filters.workType);
      if (filters.search) params.set("search", filters.search);
      if (filters.sortBy) params.set("sortBy", filters.sortBy);
      if (filters.sortOrder) params.set("sortOrder", filters.sortOrder);

      return api.get<AttendanceRecordsResponse>(`/api/attendance?${params.toString()}`);
    },
    staleTime: 1000 * 15,
  });
}

export interface AttendanceCorrectionPayload {
  status?: AttendanceStatus;
  checkInTime?: string | null;
  checkOutTime?: string | null;
  reason: string;
  isLate?: boolean;
}

export function useCorrectAttendanceRecord() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, payload }: { id: string; payload: AttendanceCorrectionPayload }) =>
      api.patch<{ success: boolean; data: AttendanceRecordItem }>(
        `/api/attendance/${id}/correct`,
        payload
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}

// ==========================================
// Audit Log Hooks
// ==========================================

export interface AuditLogFilters {
  page?: number;
  limit?: number;
  entityType?: string;
  entityId?: string;
  action?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
}

export function useAuditLogs(filters: AuditLogFilters) {
  return useQuery<AuditLogsResponse>({
    queryKey: ["audit-logs", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.set("page", String(filters.page));
      if (filters.limit) params.set("limit", String(filters.limit));
      if (filters.entityType) params.set("entityType", filters.entityType);
      if (filters.entityId) params.set("entityId", filters.entityId);
      if (filters.action) params.set("action", filters.action);
      if (filters.search) params.set("search", filters.search);
      if (filters.startDate) params.set("startDate", filters.startDate);
      if (filters.endDate) params.set("endDate", filters.endDate);

      return api.get<AuditLogsResponse>(`/api/audit-logs?${params.toString()}`);
    },
    staleTime: 1000 * 20,
  });
}

// ==========================================
// Policy & Holiday Hooks
// ==========================================

export interface PolicyShift {
  _id?: string;
  name: string;
  startTime: string;
  endTime: string;
  graceMinutes: number;
  checkInWindowStartMinutes: number;
  checkInWindowEndMinutes: number;
  checkOutWindowStartMinutes: number;
  checkOutWindowEndMinutes: number;
  isOvernight: boolean;
  isActive: boolean;
}

export interface PolicyWfhRules {
  monthlyQuota: number;
  advanceNoticeDays: number;
  allowedDaysPerWeek: number;
  autoApproval: boolean;
}

export interface AttendancePolicyData {
  _id: string;
  name: string;
  version: number;
  timezone: string;
  defaultGraceMinutes: number;
  minFullDayHours: number;
  minHalfDayHours: number;
  monthlyWfhQuota: number;
  absenceEvaluationCutoffTime: string;
  workdays: number[];
  wfhRules: PolicyWfhRules;
  shifts: PolicyShift[];
  qrRotationSeconds: number;
  qrGraceSeconds: number;
  punchCooldownMinutes: number;
  allowOvertime: boolean;
  isDefault: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface HolidayItem {
  _id: string;
  name: string;
  dateKey: string;
  description?: string;
  isRecurring: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export function useActivePolicy() {
  return useQuery<AttendancePolicyData>({
    queryKey: ["active-policy"],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: AttendancePolicyData }>("/api/policy");
      return res.data;
    },
    staleTime: 1000 * 30,
  });
}

export function useUpdatePolicy() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: Partial<AttendancePolicyData> & { reason?: string }) =>
      api.patch<{ success: boolean; message: string; data: AttendancePolicyData }>(
        "/api/policy",
        payload
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["active-policy"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
    },
  });
}

export function useHolidays(year?: number) {
  return useQuery<{ success: boolean; data: HolidayItem[] }>({
    queryKey: ["holidays", year],
    queryFn: () =>
      api.get<{ success: boolean; data: HolidayItem[] }>(
        `/api/holidays${year ? `?year=${year}` : ""}`
      ),
    staleTime: 1000 * 60,
  });
}

export function useCreateHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: {
      name: string;
      dateKey: string;
      description?: string;
      isRecurring?: boolean;
    }) =>
      api.post<{ success: boolean; message: string; data: HolidayItem }>("/api/holidays", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
    },
  });
}

export function useDeleteHoliday() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ success: boolean; message: string }>(`/api/holidays/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
    },
  });
}

// ==========================================
// WFH Review Queue Hooks
// ==========================================

export interface WfhRequestItem {
  _id: string;
  employee?: {
    _id: string;
    name: string;
    email: string;
    department: string;
    designation: string;
  } | string;
  employeeId: string;
  department: string;
  dateKey: string;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED" | "CANCELLED";
  reviewedBy?: {
    _id: string;
    email?: string;
  } | string | null;
  reviewerRemarks?: string | null;
  reviewedAt?: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface WfhRequestsResponse {
  success: boolean;
  data: WfhRequestItem[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface WfhFilters {
  page?: number;
  limit?: number;
  status?: string;
  department?: string;
  month?: string;
  search?: string;
}

export function useWfhRequests(filters: WfhFilters) {
  return useQuery<WfhRequestsResponse>({
    queryKey: ["wfh-requests", filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.page) params.set("page", String(filters.page));
      if (filters.limit) params.set("limit", String(filters.limit));
      if (filters.status && filters.status !== "ALL") params.set("status", filters.status);
      if (filters.department) params.set("department", filters.department);
      if (filters.month) params.set("month", filters.month);
      if (filters.search) params.set("search", filters.search);

      return api.get<WfhRequestsResponse>(`/api/wfh/admin/requests?${params.toString()}`);
    },
    staleTime: 1000 * 15,
  });
}

export function useReviewWfhRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({
      id,
      status,
      remarks,
    }: {
      id: string;
      status: "APPROVED" | "REJECTED";
      remarks?: string;
    }) =>
      api.patch<{ success: boolean; message: string; request: WfhRequestItem }>(
        `/api/wfh/requests/${id}/review`,
        { status, remarks }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wfh-requests"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-summary"] });
      queryClient.invalidateQueries({ queryKey: ["attendance-records"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}

// ==========================================
// QR Displays / Terminals Hooks
// ==========================================

export interface DisplayTerminalItem {
  id: string;
  _id?: string;
  terminalId: string;
  name: string;
  location: string;
  pairingCode?: string;
  pairingCodeExpiresAt?: string;
  isPaired: boolean;
  isActive: boolean;
  status: "ACTIVE" | "INACTIVE" | "UNPAIRED" | "REVOKED" | "DISABLED";
  tokenEpoch: number;
  pairedAt?: string;
  lastSeen?: string;
  createdAt: string;
  updatedAt: string;
}

export function useDisplays() {
  return useQuery<{ success: boolean; data: DisplayTerminalItem[] }>({
    queryKey: ["displays"],
    queryFn: () => api.get<{ success: boolean; data: DisplayTerminalItem[] }>("/api/displays"),
    staleTime: 1000 * 10,
  });
}

export function useRegisterDisplay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: { name: string; location: string }) =>
      api.post<{ success: boolean; message: string; data: DisplayTerminalItem }>(
        "/api/displays",
        payload
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["displays"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}

export function useUpdateDisplayStatus() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, isActive, reason }: { id: string; isActive: boolean; reason?: string }) =>
      api.patch<{ success: boolean; message: string; data: DisplayTerminalItem }>(
        `/api/displays/${id}/status`,
        { isActive, reason }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["displays"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}

export function useAuthorizeDisplay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ success: boolean; message: string; data: DisplayTerminalItem }>(
        `/api/displays/${id}/authorize`
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["displays"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}

export function useRevokeDisplay() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      api.post<{ success: boolean; message: string; data: DisplayTerminalItem }>(
        `/api/displays/${id}/revoke`,
        { reason }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["displays"] });
      queryClient.invalidateQueries({ queryKey: ["audit-logs"] });
    },
  });
}

// ==========================================
// Reporting & Analytics Hooks
// ==========================================

export interface ReportFilterParams {
  startDate?: string;
  endDate?: string;
  department?: string;
  employeeId?: string;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface AttendanceSummaryReportResponse {
  success: boolean;
  data: AttendanceRecordItem[];
  summary: {
    totalRecords: number;
    presentCount: number;
    lateCount: number;
    halfDayCount: number;
    wfhCount: number;
    absentCount: number;
    totalHours: number;
  };
  pagination: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export interface EmployeeWiseReportItem {
  employeeId: string;
  name: string;
  department: string;
  designation?: string;
  workType?: string;
  totalDays: number;
  presentDays: number;
  lateDays: number;
  halfDays: number;
  wfhDays: number;
  absentDays: number;
  totalWorkMinutes: number;
  totalWorkHours: number;
  attendanceRate: number;
}

export interface DepartmentWiseReportItem {
  department: string;
  headcount: number;
  totalRecords: number;
  presentCount: number;
  lateCount: number;
  wfhCount: number;
  absentCount: number;
  totalWorkMinutes: number;
  totalWorkHours: number;
  attendanceRate: number;
}

export interface LateReportItem {
  _id: string;
  dateKey: string;
  employeeId: string;
  name: string;
  department: string;
  designation?: string;
  checkInTime?: string;
  lateMinutes: number;
  status: string;
}

export interface WfhReportItem {
  _id: string;
  dateKey: string;
  employeeId: string;
  name: string;
  department: string;
  designation?: string;
  reason: string;
  status: string;
  reviewerRemarks?: string;
  reviewedAt?: string;
  createdAt: string;
}

export function useAttendanceSummaryReport(params: ReportFilterParams) {
  return useQuery<AttendanceSummaryReportResponse>({
    queryKey: ["report-attendance", params],
    queryFn: () => {
      const q = new URLSearchParams();
      if (params.startDate) q.set("startDate", params.startDate);
      if (params.endDate) q.set("endDate", params.endDate);
      if (params.department) q.set("department", params.department);
      if (params.status) q.set("status", params.status);
      if (params.search) q.set("search", params.search);
      if (params.page) q.set("page", String(params.page));
      if (params.limit) q.set("limit", String(params.limit));
      return api.get<AttendanceSummaryReportResponse>(`/api/reports/attendance?${q.toString()}`);
    },
    staleTime: 1000 * 30,
  });
}

export function useEmployeeWiseReport(params: ReportFilterParams) {
  return useQuery<{
    success: boolean;
    data: EmployeeWiseReportItem[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }>({
    queryKey: ["report-employee-wise", params],
    queryFn: () => {
      const q = new URLSearchParams();
      if (params.startDate) q.set("startDate", params.startDate);
      if (params.endDate) q.set("endDate", params.endDate);
      if (params.department) q.set("department", params.department);
      if (params.search) q.set("search", params.search);
      if (params.page) q.set("page", String(params.page));
      if (params.limit) q.set("limit", String(params.limit));
      return api.get(`/api/reports/employee-wise?${q.toString()}`);
    },
    staleTime: 1000 * 30,
  });
}

export function useDepartmentWiseReport(params: ReportFilterParams) {
  return useQuery<{
    success: boolean;
    data: DepartmentWiseReportItem[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }>({
    queryKey: ["report-department-wise", params],
    queryFn: () => {
      const q = new URLSearchParams();
      if (params.startDate) q.set("startDate", params.startDate);
      if (params.endDate) q.set("endDate", params.endDate);
      if (params.department) q.set("department", params.department);
      return api.get(`/api/reports/department-wise?${q.toString()}`);
    },
    staleTime: 1000 * 30,
  });
}

export function useLateReport(params: ReportFilterParams) {
  return useQuery<{
    success: boolean;
    data: LateReportItem[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }>({
    queryKey: ["report-late", params],
    queryFn: () => {
      const q = new URLSearchParams();
      if (params.startDate) q.set("startDate", params.startDate);
      if (params.endDate) q.set("endDate", params.endDate);
      if (params.department) q.set("department", params.department);
      if (params.search) q.set("search", params.search);
      if (params.page) q.set("page", String(params.page));
      if (params.limit) q.set("limit", String(params.limit));
      return api.get(`/api/reports/late?${q.toString()}`);
    },
    staleTime: 1000 * 30,
  });
}

export function useWfhReport(params: ReportFilterParams) {
  return useQuery<{
    success: boolean;
    data: WfhReportItem[];
    pagination: { total: number; page: number; limit: number; totalPages: number };
  }>({
    queryKey: ["report-wfh", params],
    queryFn: () => {
      const q = new URLSearchParams();
      if (params.startDate) q.set("startDate", params.startDate);
      if (params.endDate) q.set("endDate", params.endDate);
      if (params.department) q.set("department", params.department);
      if (params.status) q.set("status", params.status);
      if (params.search) q.set("search", params.search);
      if (params.page) q.set("page", String(params.page));
      if (params.limit) q.set("limit", String(params.limit));
      return api.get(`/api/reports/wfh?${q.toString()}`);
    },
    staleTime: 1000 * 30,
  });
}

export async function downloadReportCsv(endpoint: string, filename: string) {
  const token = tokenStorage.getAccessToken();
  const res = await fetch(getFullApiUrl(endpoint), {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error(`CSV export failed with status ${res.status}`);
  const blob = await res.blob();
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.URL.revokeObjectURL(url);
}

export interface FeatureFlagsMap {
  leave: boolean;
  announcements: boolean;
  enquiries: boolean;
  calendarImport: boolean;
  threeD: boolean;
  otaUpdates: boolean;
}

export function useFeatureFlags() {
  return useQuery<{ success: boolean; data: FeatureFlagsMap }>({
    queryKey: ["feature-flags"],
    queryFn: () => api.get("/api/feature-flags"),
    staleTime: 1000 * 30,
  });
}

export function useUpdateFeatureFlag() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { key: string; enabled: boolean; reason?: string }) =>
      api.patch("/api/admin/feature-flags", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["feature-flags"] });
    },
  });
}

// =============================================================================
// Staff Authentication, Sessions, Hardware Security & Audit
// =============================================================================

export interface StaffSessionItem {
  id: string;
  ipAddress: string;
  userAgent: string;
  lastActivityAt: string;
  expiresAt: string;
  isCurrent: boolean;
  device?: {
    _id: string;
    deviceName: string;
    platform: string;
    deviceFingerprint: string;
  } | null;
}

export interface TrustedDeviceItem {
  _id: string;
  deviceFingerprint: string;
  deviceName: string;
  platform: "iOS" | "Android" | "Web" | "Windows" | "macOS";
  lastUsedAt: string;
  trustedUntil: string;
  isRevoked: boolean;
  createdAt: string;
}

export function useStaffSessions() {
  return useQuery<{ success: boolean; data: StaffSessionItem[] }>({
    queryKey: ["staff-sessions"],
    queryFn: () => api.get("/api/auth/staff/sessions"),
    staleTime: 1000 * 10,
    refetchInterval: 15000,
  });
}

export function useRevokeSession() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (sessionId: string) => api.delete(`/api/auth/staff/sessions/${sessionId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-sessions"] });
    },
  });
}

export function useRevokeAllSessions() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post("/api/auth/staff/sessions/revoke-all", {}),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-sessions"] });
    },
  });
}

export function useTrustedDevices() {
  return useQuery<{ success: boolean; data: TrustedDeviceItem[] }>({
    queryKey: ["trusted-devices"],
    queryFn: () => api.get("/api/auth/staff/devices"),
    staleTime: 1000 * 30,
  });
}

export function useRevokeTrustedDevice() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (deviceId: string) => api.delete(`/api/auth/staff/devices/${deviceId}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trusted-devices"] });
    },
  });
}

export function useForceLogoutStaff() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, reason }: { userId: string; reason?: string }) =>
      api.post(`/api/auth/staff/force-logout/${userId}`, { reason }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-sessions"] });
    },
  });
}

// ==========================================
// Working Calendar & Holiday Engine Hooks
// ==========================================

export interface CalendarEventItem {
  _id: string;
  type: "holiday" | "companyOffDay" | "meeting" | "event";
  title: string;
  description?: string;
  startDate: string;
  endDate: string;
  isFullDay: boolean;
  source: "manual" | "imported";
  audience?: {
    scope: string;
    departments?: string[];
  };
}

export interface DayTypeResponse {
  success: boolean;
  dateKey: string;
  timezone: string;
  dayType: "workday" | "weekly-off" | "public-holiday" | "company-off-day";
  isWorkingDay: boolean;
}

export interface WorkingDaysResponse {
  success: boolean;
  start: string;
  end: string;
  timezone: string;
  workingDaysCount: number;
}

export interface HolidayPreviewItem {
  date: string;
  name: string;
  description?: string;
  action: "create" | "already_exists" | "skip_manual_conflict";
  existingTitle?: string;
  reason?: string;
}

export interface HolidayPreviewResponse {
  success: boolean;
  provider: string;
  countryCode: string;
  year: number;
  totalFound: number;
  toImport: number;
  conflicts: number;
  alreadyImported: number;
  items: HolidayPreviewItem[];
}

export function useCalendarEvents(year?: number) {
  return useQuery<{ success: boolean; data: CalendarEventItem[] }>({
    queryKey: ["calendar-events", year],
    queryFn: () =>
      api.get<{ success: boolean; data: CalendarEventItem[] }>(
        `/api/calendar/events${year ? `?year=${year}` : ""}`
      ),
    staleTime: 1000 * 60,
  });
}

export function useDayType(date: string, enabled = true) {
  return useQuery<DayTypeResponse>({
    queryKey: ["calendar-day-type", date],
    queryFn: () => api.get<DayTypeResponse>(`/api/calendar/day-type?date=${date}`),
    enabled: enabled && !!date,
    staleTime: 1000 * 60 * 5,
  });
}

export function useWorkingDaysCount(start: string, end: string, enabled = true) {
  return useQuery<WorkingDaysResponse>({
    queryKey: ["calendar-working-days", start, end],
    queryFn: () =>
      api.get<WorkingDaysResponse>(`/api/calendar/working-days?start=${start}&end=${end}`),
    enabled: enabled && !!start && !!end && start <= end,
    staleTime: 1000 * 60 * 5,
  });
}

export function usePreviewHolidayImport(year: number, country = "IN", enabled = false) {
  return useQuery<HolidayPreviewResponse>({
    queryKey: ["calendar-preview-holidays", year, country],
    queryFn: () =>
      api.get<HolidayPreviewResponse>(
        `/api/calendar/holidays/preview?year=${year}&country=${country}`
      ),
    enabled: enabled && !!year,
  });
}

export function useImportHolidays() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: { year: number; country?: string }) =>
      api.post<{ success: boolean; importedCount: number; skippedCount: number }>(
        "/api/calendar/holidays/import",
        {
          year: payload.year,
          countryCode: payload.country || "IN",
          country: payload.country || "IN",
        }
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
    },
  });
}

export function useCreateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (payload: {
      title: string;
      type: "holiday" | "companyOffDay" | "meeting" | "event";
      startDate: string;
      endDate: string;
      isFullDay?: boolean;
      description?: string;
      location?: string;
      audience?: { scope: "all" | "department" | "role"; departments?: string[]; roles?: string[] };
    }) => api.post<{ success: boolean; data: CalendarEventItem }>("/api/calendar/events", payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
    },
  });
}

export function useUpdateCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      payload,
    }: {
      id: string;
      payload: Partial<{
        title: string;
        type: "holiday" | "companyOffDay" | "meeting" | "event";
        startDate: string;
        endDate: string;
        isFullDay?: boolean;
        description?: string;
        location?: string;
        audience?: { scope: "all" | "department" | "role"; departments?: string[]; roles?: string[] };
      }>;
    }) =>
      api.put<{ success: boolean; data: CalendarEventItem }>(`/api/calendar/events/${id}`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
    },
  });
}

export function useDeleteCalendarEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      api.delete<{ success: boolean; message: string }>(`/api/calendar/events/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
    },
  });
}




