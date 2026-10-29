import React, { useState, useEffect, useMemo } from "react";
import { Link } from "react-router-dom";
import {
  useActivePolicy,
  useUpdatePolicy,
  useHolidays,
  useCreateHoliday,
  useDeleteHoliday,
  useAuditLogs,
  AttendancePolicyData,
  PolicyShift,
  HolidayItem,
} from "../api/queries";
import { getFullApiUrl } from "../api/client";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Select } from "../components/ui/Select";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";
import { useToast } from "../components/ui/Toast";
import { useSocket } from "../context/SocketContext";
import {
  Settings2,
  Clock,
  Calendar,
  Plus,
  Trash2,
  History,
  Check,
  AlertCircle,
  Save,
  Home,
  CheckCircle2,
  Download,
  ExternalLink,
} from "lucide-react";

const WORKDAY_OPTIONS = [
  { value: 0, label: "Sunday", short: "Sun" },
  { value: 1, label: "Monday", short: "Mon" },
  { value: 2, label: "Tuesday", short: "Tue" },
  { value: 3, label: "Wednesday", short: "Wed" },
  { value: 4, label: "Thursday", short: "Thu" },
  { value: 5, label: "Friday", short: "Fri" },
  { value: 6, label: "Saturday", short: "Sat" },
];

const TIMEZONE_OPTIONS = [
  { value: "Asia/Kolkata", label: "Asia/Kolkata (IST UTC+05:30)" },
  { value: "UTC", label: "UTC (Coordinated Universal Time)" },
  { value: "America/New_York", label: "America/New_York (EST/EDT)" },
  { value: "Europe/London", label: "Europe/London (GMT/BST)" },
  { value: "Asia/Dubai", label: "Asia/Dubai (GST UTC+04:00)" },
  { value: "Asia/Singapore", label: "Asia/Singapore (SGT UTC+08:00)" },
];

interface FormErrors {
  defaultGraceMinutes?: string;
  absenceCutoff?: string;
  shifts?: Record<number, string>;
  workdays?: string;
  minHours?: string;
}

export const PoliciesPage: React.FC = () => {
  const { toast } = useToast();
  const { socket } = useSocket();

  const {
    data: activePolicy,
    isLoading: isPolicyLoading,
    refetch: refetchPolicy,
  } = useActivePolicy();

  const currentYear = new Date().getFullYear();
  const { data: holidaysResponse, isLoading: isHolidaysLoading } = useHolidays(currentYear);
  const holidays = holidaysResponse?.data || [];

  const { data: auditResponse, isLoading: isAuditLoading } = useAuditLogs({
    entityType: "POLICY",
    limit: 10,
  });
  const policyAuditEvents = auditResponse?.data || [];

  const updatePolicyMutation = useUpdatePolicy();
  const createHolidayMutation = useCreateHoliday();
  const deleteHolidayMutation = useDeleteHoliday();

  // Form State
  const [formData, setFormData] = useState<Partial<AttendancePolicyData>>({
    name: "Standard Company Attendance Policy",
    timezone: "Asia/Kolkata",
    defaultGraceMinutes: 15,
    minFullDayHours: 8,
    minHalfDayHours: 4,
    monthlyWfhQuota: 4,
    absenceEvaluationCutoffTime: "23:59",
    workdays: [1, 2, 3, 4, 5],
    allowOvertime: false,
    wfhRules: {
      monthlyQuota: 4,
      advanceNoticeDays: 1,
      allowedDaysPerWeek: 2,
      autoApproval: false,
    },
    shifts: [],
  });

  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [justificationReason, setJustificationReason] = useState("");
  const [activeTab, setActiveTab] = useState<"policy" | "holidays" | "history">("policy");

  // Holiday Modal State
  const [showAddHolidayModal, setShowAddHolidayModal] = useState(false);
  const [holidayToDelete, setHolidayToDelete] = useState<HolidayItem | null>(null);
  const [holidayForm, setHolidayForm] = useState({
    name: "",
    dateKey: "",
    description: "",
    isRecurring: false,
  });

  // Populate local form state when active policy is loaded
  useEffect(() => {
    if (activePolicy) {
      setFormData({
        name: activePolicy.name,
        timezone: activePolicy.timezone || "Asia/Kolkata",
        defaultGraceMinutes: activePolicy.defaultGraceMinutes,
        minFullDayHours: activePolicy.minFullDayHours,
        minHalfDayHours: activePolicy.minHalfDayHours,
        monthlyWfhQuota: activePolicy.monthlyWfhQuota,
        absenceEvaluationCutoffTime: activePolicy.absenceEvaluationCutoffTime || "23:59",
        workdays: [...activePolicy.workdays],
        allowOvertime: activePolicy.allowOvertime,
        wfhRules: { ...activePolicy.wfhRules },
        shifts: activePolicy.shifts.map((s) => ({ ...s })),
      });
    }
  }, [activePolicy]);

  // Listen for real-time policy updates over Socket.IO
  useEffect(() => {
    if (!socket) return;
    const handlePolicyUpdated = () => {
      refetchPolicy();
      toast({
        title: "Policy Synchronized",
        description: "Attendance policy was refreshed from server broadcast.",
        type: "info",
      });
    };
    socket.on("policy.updated", handlePolicyUpdated);
    return () => {
      socket.off("policy.updated", handlePolicyUpdated);
    };
  }, [socket, refetchPolicy, toast]);

  // Compute Diffs between active policy and current form
  const diffSummary = useMemo(() => {
    if (!activePolicy) return [];
    const diffs: Array<{ label: string; from: string; to: string }> = [];

    if (formData.defaultGraceMinutes !== activePolicy.defaultGraceMinutes) {
      diffs.push({
        label: "Grace Period",
        from: `${activePolicy.defaultGraceMinutes} mins`,
        to: `${formData.defaultGraceMinutes} mins`,
      });
    }

    if (formData.absenceEvaluationCutoffTime !== activePolicy.absenceEvaluationCutoffTime) {
      diffs.push({
        label: "Absence Evaluation Cutoff",
        from: activePolicy.absenceEvaluationCutoffTime || "23:59",
        to: formData.absenceEvaluationCutoffTime || "23:59",
      });
    }

    if (formData.timezone !== activePolicy.timezone) {
      diffs.push({
        label: "Timezone",
        from: activePolicy.timezone,
        to: formData.timezone || "Asia/Kolkata",
      });
    }

    if (formData.monthlyWfhQuota !== activePolicy.monthlyWfhQuota) {
      diffs.push({
        label: "Monthly WFH Quota",
        from: `${activePolicy.monthlyWfhQuota} days`,
        to: `${formData.monthlyWfhQuota} days`,
      });
    }

    if (formData.minFullDayHours !== activePolicy.minFullDayHours) {
      diffs.push({
        label: "Full Day Work Hours",
        from: `${activePolicy.minFullDayHours} hrs`,
        to: `${formData.minFullDayHours} hrs`,
      });
    }

    // Workdays check
    const currentWorkdays = (formData.workdays || []).slice().sort().join(",");
    const originalWorkdays = (activePolicy.workdays || []).slice().sort().join(",");
    if (currentWorkdays !== originalWorkdays) {
      const formatDays = (days: number[]) =>
        days
          .map((d) => WORKDAY_OPTIONS.find((o) => o.value === d)?.short)
          .filter(Boolean)
          .join(", ");
      diffs.push({
        label: "Working Days",
        from: formatDays(activePolicy.workdays),
        to: formatDays(formData.workdays || []),
      });
    }

    // Shifts count or config check
    if (JSON.stringify(formData.shifts) !== JSON.stringify(activePolicy.shifts)) {
      diffs.push({
        label: "Shift Schedules",
        from: `${activePolicy.shifts?.length || 0} configured shifts`,
        to: `${formData.shifts?.length || 0} configured shifts`,
      });
    }

    return diffs;
  }, [activePolicy, formData]);

  const validateForm = (): boolean => {
    const errors: FormErrors = {};

    // Grace period validation
    const grace = Number(formData.defaultGraceMinutes);
    if (isNaN(grace) || grace < 0 || grace > 60) {
      errors.defaultGraceMinutes = "Grace period must be between 0 and 60 minutes";
    }

    // Workdays validation
    if (!formData.workdays || formData.workdays.length === 0) {
      errors.workdays = "Select at least one operating workday";
    }

    // Work hours validation
    if (
      formData.minFullDayHours &&
      formData.minHalfDayHours &&
      formData.minFullDayHours <= formData.minHalfDayHours
    ) {
      errors.minHours = "Full day threshold must exceed half day threshold";
    }

    // Shifts validation
    if (formData.shifts && formData.shifts.length > 0) {
      const shiftErrors: Record<number, string> = {};
      formData.shifts.forEach((shift, index) => {
        if (!shift.name.trim()) {
          shiftErrors[index] = "Shift name is required";
        } else if (!shift.isOvernight && shift.endTime <= shift.startTime) {
          shiftErrors[index] = "End time must be after start time unless flagged as overnight";
        }
      });
      if (Object.keys(shiftErrors).length > 0) {
        errors.shifts = shiftErrors;
      }
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleOpenConfirm = () => {
    if (!validateForm()) {
      toast({
        title: "Validation Error",
        description: "Please fix all errors highlighted in the policy form before proceeding.",
        type: "error",
      });
      return;
    }
    if (diffSummary.length === 0) {
      toast({
        title: "No Changes Detected",
        description: "The form matches the currently active policy.",
        type: "info",
      });
      return;
    }
    setShowConfirmModal(true);
  };

  const handleSavePolicy = async () => {
    try {
      await updatePolicyMutation.mutateAsync({
        ...formData,
        reason: justificationReason.trim() || undefined,
      });
      toast({
        title: "Policy Updated Successfully",
        description: `New policy version saved and active across all attendance punches.`,
        type: "success",
      });
      setShowConfirmModal(false);
      setJustificationReason("");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to update policy";
      toast({
        title: "Policy Update Failed",
        description: message,
        type: "error",
      });
    }
  };

  const handleToggleWorkday = (dayValue: number) => {
    const currentDays = formData.workdays || [];
    if (currentDays.includes(dayValue)) {
      setFormData({ ...formData, workdays: currentDays.filter((d) => d !== dayValue) });
    } else {
      setFormData({ ...formData, workdays: [...currentDays, dayValue].sort() });
    }
  };

  const handleAddShift = () => {
    const newShift: PolicyShift = {
      name: "New Shift Schedule",
      startTime: "09:00",
      endTime: "18:00",
      graceMinutes: 15,
      checkInWindowStartMinutes: 60,
      checkInWindowEndMinutes: 180,
      checkOutWindowStartMinutes: 60,
      checkOutWindowEndMinutes: 180,
      isOvernight: false,
      isActive: true,
    };
    setFormData({
      ...formData,
      shifts: [...(formData.shifts || []), newShift],
    });
  };

  const handleRemoveShift = (index: number) => {
    const updated = (formData.shifts || []).filter((_, i) => i !== index);
    setFormData({ ...formData, shifts: updated });
  };

  const handleShiftChange = (index: number, field: keyof PolicyShift, value: unknown) => {
    const updated = [...(formData.shifts || [])];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, shifts: updated });
  };

  const handleCreateHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayForm.name.trim() || !holidayForm.dateKey) {
      toast({
        title: "Required Fields Missing",
        description: "Holiday name and date are mandatory.",
        type: "error",
      });
      return;
    }
    try {
      await createHolidayMutation.mutateAsync(holidayForm);
      toast({
        title: "Holiday Added",
        description: `${holidayForm.name} added to ${holidayForm.dateKey}.`,
        type: "success",
      });
      setHolidayForm({ name: "", dateKey: "", description: "", isRecurring: false });
      setShowAddHolidayModal(false);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to add holiday";
      toast({ title: "Failed to Add Holiday", description: message, type: "error" });
    }
  };

  const handleDeleteHoliday = (holiday: HolidayItem) => {
    setHolidayToDelete(holiday);
  };

  const confirmDeleteHoliday = async () => {
    if (!holidayToDelete) return;
    try {
      await deleteHolidayMutation.mutateAsync(holidayToDelete._id);
      toast({
        title: "Holiday Deleted",
        description: `${holidayToDelete.name} was removed from the calendar.`,
        type: "info",
      });
      setHolidayToDelete(null);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete holiday";
      toast({ title: "Delete Failed", description: message, type: "error" });
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header & Version Indicator */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Attendance Policies & Shifts
            </h1>
            {activePolicy && (
              <Badge variant="primary" className="text-xs font-semibold px-2.5 py-0.5">
                v{activePolicy.version} Active
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Configure shift timings, punctuality tolerances, remote work quotas, and official
            holidays
          </p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "policy" && (
            <Button
              type="button"
              variant="primary"
              onClick={handleOpenConfirm}
              isLoading={updatePolicyMutation.isPending}
              className="gap-2 shadow-sm font-semibold"
            >
              <Save className="w-4 h-4" />
              Save Policy Changes
            </Button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-sm font-medium">
        <button
          onClick={() => setActiveTab("policy")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors ${
            activeTab === "policy"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Settings2 className="w-4 h-4" />
          Shift & Policy Rules
        </button>

        <button
          onClick={() => setActiveTab("holidays")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors ${
            activeTab === "holidays"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <Calendar className="w-4 h-4" />
          Holidays Calendar ({holidays.length})
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`flex items-center gap-2 px-4 py-2.5 border-b-2 transition-colors ${
            activeTab === "history"
              ? "border-blue-600 text-blue-600 font-semibold"
              : "border-transparent text-slate-600 hover:text-slate-900"
          }`}
        >
          <History className="w-4 h-4" />
          Policy Version History
        </button>
      </div>

      {/* TAB 1: POLICY & SHIFTS CONFIGURATION */}
      {activeTab === "policy" && (
        <div className="space-y-6">
          {isPolicyLoading ? (
            <div className="space-y-4">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-64 w-full" />
            </div>
          ) : (
            <>
              {/* Core Parameters Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Card 1: Punctuality & Grace Period */}
                <Card className="p-5 space-y-4 border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-800 font-bold border-b border-slate-100 pb-3">
                    <Clock className="w-5 h-5 text-blue-600" />
                    <span>Punctuality & Grace</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Default Grace Period (Minutes)
                    </label>
                    <Input
                      id="grace-period-input"
                      type="number"
                      min={0}
                      max={60}
                      value={formData.defaultGraceMinutes ?? 15}
                      onChange={(e) =>
                        setFormData({ ...formData, defaultGraceMinutes: Number(e.target.value) })
                      }
                      error={formErrors.defaultGraceMinutes}
                      placeholder="15"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Check-ins after shift start + grace minutes are flagged as LATE.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Absence Evaluation Cutoff Time
                    </label>
                    <Input
                      type="time"
                      value={formData.absenceEvaluationCutoffTime || "23:59"}
                      onChange={(e) =>
                        setFormData({ ...formData, absenceEvaluationCutoffTime: e.target.value })
                      }
                      placeholder="23:59"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Scheduled automated job marks unpunched employees as ABSENT after this time.
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Organization Timezone
                    </label>
                    <Select
                      value={formData.timezone || "Asia/Kolkata"}
                      onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                      options={TIMEZONE_OPTIONS}
                    />
                  </div>
                </Card>

                {/* Card 2: Workdays Configuration */}
                <Card className="p-5 space-y-4 border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-800 font-bold border-b border-slate-100 pb-3">
                    <Calendar className="w-5 h-5 text-indigo-600" />
                    <span>Official Workdays</span>
                  </div>

                  <p className="text-xs text-slate-600">
                    Select the active days of the week when attendance is monitored and required.
                  </p>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    {WORKDAY_OPTIONS.map((day) => {
                      const isSelected = (formData.workdays || []).includes(day.value);
                      return (
                        <button
                          key={day.value}
                          type="button"
                          onClick={() => handleToggleWorkday(day.value)}
                          className={`flex items-center justify-between px-3 py-2 text-xs font-semibold rounded-lg border transition-all ${
                            isSelected
                              ? "bg-blue-50 border-blue-500 text-blue-700 shadow-xs"
                              : "bg-white border-slate-200 text-slate-500 hover:border-slate-300"
                          }`}
                        >
                          <span>{day.label}</span>
                          {isSelected && <Check className="w-3.5 h-3.5 text-blue-600" />}
                        </button>
                      );
                    })}
                  </div>
                  {formErrors.workdays && (
                    <p className="text-xs text-red-600 font-medium">{formErrors.workdays}</p>
                  )}
                </Card>

                {/* Card 3: Remote Work (WFH) Rules */}
                <Card className="p-5 space-y-4 border-slate-200 shadow-sm">
                  <div className="flex items-center gap-2 text-slate-800 font-bold border-b border-slate-100 pb-3">
                    <Home className="w-5 h-5 text-emerald-600" />
                    <span>WFH & Duration Rules</span>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Monthly WFH Quota (Days / Employee)
                    </label>
                    <Input
                      type="number"
                      min={0}
                      max={31}
                      value={formData.monthlyWfhQuota ?? 4}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setFormData({
                          ...formData,
                          monthlyWfhQuota: val,
                          wfhRules: { ...formData.wfhRules!, monthlyQuota: val },
                        });
                      }}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Full Day Threshold
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={24}
                        value={formData.minFullDayHours ?? 8}
                        onChange={(e) =>
                          setFormData({ ...formData, minFullDayHours: Number(e.target.value) })
                        }
                      />
                      <span className="text-[10px] text-slate-500">hours minimum</span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Half Day Threshold
                      </label>
                      <Input
                        type="number"
                        min={1}
                        max={12}
                        value={formData.minHalfDayHours ?? 4}
                        onChange={(e) =>
                          setFormData({ ...formData, minHalfDayHours: Number(e.target.value) })
                        }
                      />
                      <span className="text-[10px] text-slate-500">hours minimum</span>
                    </div>
                  </div>
                  {formErrors.minHours && (
                    <p className="text-xs text-red-600 font-medium">{formErrors.minHours}</p>
                  )}
                </Card>
              </div>

              {/* Shifts Management Section */}
              <Card className="p-6 border-slate-200 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="text-base font-bold text-slate-900">
                      Configured Working Shifts
                    </h3>
                    <p className="text-xs text-slate-500">
                      Standard daytime and overnight shifts with check-in/out tolerance windows
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleAddShift}
                    className="gap-1.5 text-xs font-semibold"
                  >
                    <Plus className="w-4 h-4 text-blue-600" />
                    Add Shift
                  </Button>
                </div>

                {(!formData.shifts || formData.shifts.length === 0) ? (
                  <EmptyState
                    icon={<Clock className="w-6 h-6 text-slate-400" />}
                    title="No Shifts Configured"
                    description="Add at least one standard shift for roster assignments."
                  />
                ) : (
                  <div className="space-y-4">
                    {formData.shifts.map((shift, idx) => {
                      const shiftError = formErrors.shifts?.[idx];
                      return (
                        <div
                          key={shift._id || idx}
                          className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 hover:bg-white hover:border-slate-300 transition-all space-y-3"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                            <div className="flex items-center gap-3 flex-1">
                              <span className="w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold flex items-center justify-center">
                                {idx + 1}
                              </span>
                              <Input
                                value={shift.name}
                                onChange={(e) => handleShiftChange(idx, "name", e.target.value)}
                                placeholder="Shift Name (e.g. Standard General)"
                                className="font-semibold text-slate-800 bg-white"
                              />
                            </div>

                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white px-2.5 py-1.5 rounded-md border border-slate-200 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={shift.isOvernight}
                                  onChange={(e) =>
                                    handleShiftChange(idx, "isOvernight", e.target.checked)
                                  }
                                  className="rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span>Overnight (crosses midnight)</span>
                              </label>

                              <label className="flex items-center gap-1.5 text-xs font-medium text-slate-700 bg-white px-2.5 py-1.5 rounded-md border border-slate-200 cursor-pointer">
                                <input
                                  type="checkbox"
                                  checked={shift.isActive}
                                  onChange={(e) =>
                                    handleShiftChange(idx, "isActive", e.target.checked)
                                  }
                                  className="rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span>Active</span>
                              </label>

                              {formData.shifts!.length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveShift(idx)}
                                  className="p-1.5 text-slate-400 hover:text-red-600 rounded-md hover:bg-red-50 transition-colors"
                                  title="Remove Shift"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 pt-1">
                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Start Time
                              </label>
                              <Input
                                type="time"
                                value={shift.startTime}
                                onChange={(e) =>
                                  handleShiftChange(idx, "startTime", e.target.value)
                                }
                                className="bg-white text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                End Time
                              </label>
                              <Input
                                type="time"
                                value={shift.endTime}
                                onChange={(e) => handleShiftChange(idx, "endTime", e.target.value)}
                                className="bg-white text-xs"
                              />
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Grace Tolerance
                              </label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  min={0}
                                  max={60}
                                  value={shift.graceMinutes}
                                  onChange={(e) =>
                                    handleShiftChange(idx, "graceMinutes", Number(e.target.value))
                                  }
                                  className="bg-white text-xs pr-6"
                                />
                                <span className="absolute right-2 top-2 text-[10px] text-slate-400">
                                  min
                                </span>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Check-in Window
                              </label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  min={0}
                                  value={shift.checkInWindowStartMinutes}
                                  onChange={(e) =>
                                    handleShiftChange(
                                      idx,
                                      "checkInWindowStartMinutes",
                                      Number(e.target.value)
                                    )
                                  }
                                  className="bg-white text-xs pr-6"
                                />
                                <span className="absolute right-2 top-2 text-[10px] text-slate-400">
                                  min
                                </span>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                                Check-out Window
                              </label>
                              <div className="relative">
                                <Input
                                  type="number"
                                  min={0}
                                  value={shift.checkOutWindowEndMinutes}
                                  onChange={(e) =>
                                    handleShiftChange(
                                      idx,
                                      "checkOutWindowEndMinutes",
                                      Number(e.target.value)
                                    )
                                  }
                                  className="bg-white text-xs pr-6"
                                />
                                <span className="absolute right-2 top-2 text-[10px] text-slate-400">
                                  min
                                </span>
                              </div>
                            </div>
                          </div>

                          {shiftError && (
                            <p className="text-xs text-red-600 font-medium flex items-center gap-1">
                              <AlertCircle className="w-3.5 h-3.5" />
                              {shiftError}
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>
            </>
          )}
        </div>
      )}

      {/* TAB 2: HOLIDAYS MANAGER */}
      {activeTab === "holidays" && (
        <Card className="p-6 border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Official Company Holidays ({currentYear})
              </h3>
              <p className="text-xs text-slate-500">
                Official holidays exempt employees from automated absentee penalties and required punches
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  window.open(getFullApiUrl(`/api/calendar/export.ics?year=${currentYear}`), "_blank");
                }}
                className="gap-1.5 text-xs font-semibold"
                title="Download RFC 5545 iCalendar stream"
              >
                <Download className="w-3.5 h-3.5 text-slate-600" />
                Export .ICS
              </Button>
              <Link to="/calendar">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs font-semibold text-blue-700 border-blue-200 hover:bg-blue-50"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-blue-600" />
                  Working Calendar
                </Button>
              </Link>
              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setShowAddHolidayModal(true)}
                className="gap-1.5 text-xs font-semibold"
              >
                <Plus className="w-4 h-4" />
                Add Holiday
              </Button>
            </div>
          </div>

          {isHolidaysLoading ? (
            <Skeleton className="h-40 w-full" />
          ) : holidays.length === 0 ? (
            <EmptyState
              icon={<Calendar className="w-6 h-6 text-slate-400" />}
              title="No Holidays Scheduled"
              description="No public or company holidays have been scheduled for this calendar year."
              action={
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setShowAddHolidayModal(true)}
                >
                  Schedule Holiday
                </Button>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-700 font-semibold">
                    <th className="py-2.5 px-3">Holiday Name</th>
                    <th className="py-2.5 px-3">Date Key</th>
                    <th className="py-2.5 px-3">Recurring</th>
                    <th className="py-2.5 px-3">Description</th>
                    <th className="py-2.5 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {holidays.map((h) => (
                    <tr key={h._id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">{h.name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">{h.dateKey}</td>
                      <td className="py-2.5 px-3">
                        {h.isRecurring ? (
                          <Badge variant="primary" className="text-[10px]">
                            Annual Recurring
                          </Badge>
                        ) : (
                          <Badge variant="neutral" className="text-[10px]">
                            One-Time
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500">
                        {h.description || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDeleteHoliday(h)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                          title="Delete Holiday"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: POLICY VERSION HISTORY */}
      {activeTab === "history" && (
        <Card className="p-6 border-slate-200 shadow-sm space-y-4">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-base font-bold text-slate-900">
              Policy Version History & Audit Trail
            </h3>
            <p className="text-xs text-slate-500">
              Immutable historical policy versions retained for retroactive punch verification
            </p>
          </div>

          {isAuditLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : policyAuditEvents.length === 0 ? (
            <EmptyState
              icon={<History className="w-6 h-6 text-slate-400" />}
              title="No Version History Found"
              description="Policy changes and version updates will appear here."
            />
          ) : (
            <div className="space-y-4">
              {policyAuditEvents.map((event) => {
                const versionNumber = (event.metadata?.newVersion as number) || (event.metadata?.version as number);
                return (
                  <div
                    key={event._id}
                    className="p-4 rounded-xl border border-slate-200 bg-white hover:border-slate-300 transition-all space-y-2"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge variant="primary" className="text-xs font-bold">
                          {versionNumber ? `Version ${versionNumber}` : "Policy Update"}
                        </Badge>
                        <span className="text-xs font-semibold text-slate-800">
                          by {event.performedByEmployeeId || "System Admin"}
                        </span>
                      </div>
                      <span className="text-[11px] text-slate-500">
                        {new Date(event.timestamp).toLocaleString()}
                      </span>
                    </div>

                    <p className="text-xs text-slate-600">
                      <span className="font-semibold text-slate-700">Reason: </span>
                      {event.reason || "Scheduled policy adjustment"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {/* CONFIRMATION MODAL WITH SUMMARY OF CHANGES */}
      <Modal
        isOpen={showConfirmModal}
        onClose={() => setShowConfirmModal(false)}
        title="Confirm Policy Changes"
        maxWidth="md"
      >
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-xs text-amber-800">
              <span className="font-bold">Notice: </span>
              Saving will increment the policy version to{" "}
              <strong className="underline">v{(activePolicy?.version || 1) + 1}</strong>. Future
              attendance scans and punctuality evaluations will strictly enforce these rules.
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              Detected Changes Summary:
            </h4>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-slate-50/50">
              {diffSummary.map((diff, i) => (
                <div key={i} className="p-2.5 text-xs flex items-center justify-between">
                  <span className="font-semibold text-slate-700">{diff.label}</span>
                  <div className="flex items-center gap-2 font-mono text-[11px]">
                    <span className="text-slate-500 line-through bg-slate-200/60 px-1.5 py-0.5 rounded">
                      {diff.from}
                    </span>
                    <span className="text-slate-400">→</span>
                    <span className="text-emerald-700 font-bold bg-emerald-100/70 px-1.5 py-0.5 rounded">
                      {diff.to}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Justification Reason (Recorded to Audit Trail)
            </label>
            <Input
              id="policy-change-reason-input"
              value={justificationReason}
              onChange={(e) => setJustificationReason(e.target.value)}
              placeholder="e.g. Adjusted winter grace period for engineering shifts"
            />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowConfirmModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              id="confirm-policy-update-btn"
              variant="primary"
              size="sm"
              onClick={handleSavePolicy}
              isLoading={updatePolicyMutation.isPending}
              className="gap-1.5 font-semibold"
            >
              <CheckCircle2 className="w-4 h-4" />
              Apply & Increment Version
            </Button>
          </div>
        </div>
      </Modal>

      {/* ADD HOLIDAY MODAL */}
      <Modal
        isOpen={showAddHolidayModal}
        onClose={() => setShowAddHolidayModal(false)}
        title="Add Company Holiday"
        maxWidth="sm"
      >
        <form onSubmit={handleCreateHoliday} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Holiday Name *
            </label>
            <Input
              value={holidayForm.name}
              onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
              placeholder="e.g. Diwali / Republic Day"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Date (YYYY-MM-DD) *
            </label>
            <Input
              type="date"
              value={holidayForm.dateKey}
              onChange={(e) => setHolidayForm({ ...holidayForm, dateKey: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Description (Optional)
            </label>
            <Input
              value={holidayForm.description}
              onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
              placeholder="National festival"
            />
          </div>

          <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={holidayForm.isRecurring}
              onChange={(e) => setHolidayForm({ ...holidayForm, isRecurring: e.target.checked })}
              className="rounded text-blue-600 focus:ring-blue-500"
            />
            <span>Recurring Annual Holiday</span>
          </label>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAddHolidayModal(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={createHolidayMutation.isPending}
            >
              Add Holiday
            </Button>
          </div>
        </form>
      </Modal>

      {/* Accessible Confirmation Dialog for Holiday Deletion */}
      <ConfirmDialog
        isOpen={!!holidayToDelete}
        onClose={() => setHolidayToDelete(null)}
        onConfirm={confirmDeleteHoliday}
        title="Delete Holiday"
        message={
          holidayToDelete
            ? `Are you sure you want to remove '${holidayToDelete.name}' (${holidayToDelete.dateKey}) from the holiday schedule?`
            : ""
        }
        confirmText="Delete Holiday"
        cancelText="Keep Holiday"
        variant="danger"
        isLoading={deleteHolidayMutation.isPending}
      />
    </div>
  );
};
