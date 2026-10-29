import React, { useState, useEffect, useMemo, useCallback } from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  UploadCloud,
  Plus,
  Trash2,
  AlertTriangle,
  Sparkles,
  Building,
  Search,
  Printer,
  Home,
  Users,
  Palmtree,
  Briefcase,
  Coffee,
  Landmark,
  Check,
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  Eye,
  Edit2,
} from "lucide-react";
import {
  useCalendarEvents,
  usePreviewHolidayImport,
  useImportHolidays,
  useCreateCalendarEvent,
  useUpdateCalendarEvent,
  useDeleteCalendarEvent,
  useWfhRequests,
  useAttendanceRecords,
  CalendarEventItem,
} from "../api/queries";
import { getFullApiUrl } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../components/ui/Toast";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import { useQueryClient } from "@tanstack/react-query";
import { AttendanceStatus } from "@vorldx/shared";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { Drawer } from "../components/ui/Drawer";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { Input } from "../components/ui/Input";
import { Skeleton } from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/ErrorState";
import { Tooltip } from "../components/ui/Tooltip";
import { ProgressRing } from "../components/ui/ProgressRing";
import { clsx } from "clsx";

type CalendarView = "month" | "week" | "year";

interface DayCellInfo {
  date: Date;
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeeklyOff: boolean;
}

export const CalendarPage: React.FC = () => {
  const { user } = useAuth();
  const { prefersReducedMotion } = useTheme();
  const isHrOrAdmin = user?.role === "HR" || user?.role === "ADMIN" || user?.role === "HR_ADMIN";

  // Date & View Navigation State
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [view, setView] = useState<CalendarView>("month");

  // Selected Date State (Defaults to Today)
  const [selectedDateKey, setSelectedDateKey] = useState<string>(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  });

  // Filter & Search State
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Overlay Toggles State
  const [showLeaveOverlay, setShowLeaveOverlay] = useState<boolean>(true);
  const [showWfhOverlay, setShowWfhOverlay] = useState<boolean>(true);
  const [showAbsenceOverlay, setShowAbsenceOverlay] = useState<boolean>(true);

  // Drawer (Add / Edit / View Entry) State
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerMode, setDrawerMode] = useState<"add" | "edit" | "view">("add");
  const [selectedEvent, setSelectedEvent] = useState<CalendarEventItem | null>(null);
  const [drawerDate, setDrawerDate] = useState<string>(new Date().toISOString().split("T")[0]);

  // Form State
  const [entryForm, setEntryForm] = useState({
    title: "",
    type: "holiday" as "holiday" | "companyOffDay" | "meeting" | "event",
    startDate: new Date().toISOString().split("T")[0],
    endDate: new Date().toISOString().split("T")[0],
    isFullDay: true,
    startTime: "09:00",
    endTime: "18:00",
    description: "",
    location: "",
    audienceScope: "all" as "all" | "department" | "role",
  });

  // Delete & Undo Confirmation State
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [eventToDelete, setEventToDelete] = useState<CalendarEventItem | null>(null);

  // Import Holidays Modal State
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCountry, setImportCountry] = useState("IN");
  const [importYear, setImportYear] = useState<number>(currentDate.getFullYear());

  const { toast, undo } = useToast();
  const { socket } = useSocket();
  const queryClient = useQueryClient();

  const activeYear = currentDate.getFullYear();
  const activeMonth = currentDate.getMonth(); // 0-indexed

  // 1. Calendar Events Query
  const {
    data: eventsResponse,
    isLoading: isEventsLoading,
    isError: isEventsError,
    error: eventsError,
    refetch: refetchEvents,
  } = useCalendarEvents(activeYear);

  // 2. Approved WFH Requests Query for Overlay
  const { data: wfhResponse } = useWfhRequests({
    status: "APPROVED",
    limit: 100,
  });

  // 3. Absences Query for Overlay
  const { data: attendanceResponse } = useAttendanceRecords({
    status: AttendanceStatus.ABSENT,
    limit: 100,
  });

  // Mutations
  const createMutation = useCreateCalendarEvent();
  const updateMutation = useUpdateCalendarEvent();
  const deleteMutation = useDeleteCalendarEvent();
  const importMutation = useImportHolidays();

  // Import Preview Query
  const {
    data: previewData,
    isLoading: isPreviewLoading,
    isError: isPreviewError,
    refetch: refetchPreview,
  } = usePreviewHolidayImport(importYear, importCountry, showImportModal);

  // Raw Events List
  const allEvents: CalendarEventItem[] = useMemo(() => {
    return eventsResponse?.data || [];
  }, [eventsResponse]);

  // Real-time Socket Event Subscription
  useEffect(() => {
    if (!socket) return;
    const handleCalendarUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["holidays"] });
      toast({
        title: "Calendar Live Sync",
        description: "Calendar updated in real-time by another administrator.",
        type: "info",
      });
    };

    socket.on("calendar.updated", handleCalendarUpdated);
    return () => {
      socket.off("calendar.updated", handleCalendarUpdated);
    };
  }, [socket, queryClient, toast]);

  // Navigation Functions
  const goPrevious = useCallback(() => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (view === "month") next.setMonth(next.getMonth() - 1);
      else if (view === "week") next.setDate(next.getDate() - 7);
      else if (view === "year") next.setFullYear(next.getFullYear() - 1);
      return next;
    });
  }, [view]);

  const goNext = useCallback(() => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      if (view === "month") next.setMonth(next.getMonth() + 1);
      else if (view === "week") next.setDate(next.getDate() + 7);
      else if (view === "year") next.setFullYear(next.getFullYear() + 1);
      return next;
    });
  }, [view]);

  const goToday = useCallback(() => {
    const today = new Date();
    setCurrentDate(today);
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    setSelectedDateKey(`${y}-${m}-${d}`);
  }, []);

  const handleSelectPreviousDay = useCallback(() => {
    const [y, m, d] = selectedDateKey.split("-").map(Number);
    const prev = new Date(Date.UTC(y, m - 1, d - 1));
    const nextKey = `${prev.getUTCFullYear()}-${String(prev.getUTCMonth() + 1).padStart(2, "0")}-${String(prev.getUTCDate()).padStart(2, "0")}`;
    setSelectedDateKey(nextKey);
    if (prev.getUTCMonth() !== activeMonth || prev.getUTCFullYear() !== activeYear) {
      setCurrentDate(new Date(prev.getUTCFullYear(), prev.getUTCMonth(), 1));
    }
  }, [selectedDateKey, activeMonth, activeYear]);

  const handleSelectNextDay = useCallback(() => {
    const [y, m, d] = selectedDateKey.split("-").map(Number);
    const next = new Date(Date.UTC(y, m - 1, d + 1));
    const nextKey = `${next.getUTCFullYear()}-${String(next.getUTCMonth() + 1).padStart(2, "0")}-${String(next.getUTCDate()).padStart(2, "0")}`;
    setSelectedDateKey(nextKey);
    if (next.getUTCMonth() !== activeMonth || next.getUTCFullYear() !== activeYear) {
      setCurrentDate(new Date(next.getUTCFullYear(), next.getUTCMonth(), 1));
    }
  }, [selectedDateKey, activeMonth, activeYear]);

  const handleSelectToday = useCallback(() => {
    const today = new Date();
    const y = today.getFullYear();
    const m = String(today.getMonth() + 1).padStart(2, "0");
    const d = String(today.getDate()).padStart(2, "0");
    setSelectedDateKey(`${y}-${m}-${d}`);
    setCurrentDate(today);
  }, []);

  // Keyboard Navigation Listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if user is inside an input, textarea, select, or modal/drawer is open
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return;
      if (isDrawerOpen || showImportModal || showDeleteConfirm) return;

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goPrevious();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goNext();
      } else if (e.key === "t" || e.key === "T") {
        e.preventDefault();
        goToday();
      } else if (e.key === "m" || e.key === "M") {
        e.preventDefault();
        setView("month");
      } else if (e.key === "w" || e.key === "W") {
        e.preventDefault();
        setView("week");
      } else if (e.key === "y" || e.key === "Y") {
        e.preventDefault();
        setView("year");
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goPrevious, goNext, goToday, isDrawerOpen, showImportModal, showDeleteConfirm]);

  // Map overlays by dateKey for O(1) cell lookup
  const wfhByDate = useMemo(() => {
    const map = new Map<string, Array<{ employeeId: string; name?: string; reason?: string }>>();
    if (!wfhResponse?.data) return map;
    for (const r of wfhResponse.data) {
      if (r.status === "APPROVED" && r.dateKey) {
        const list = map.get(r.dateKey) || [];
        const empName = typeof r.employee === "object" && r.employee !== null ? r.employee.name : String(r.employee || r.employeeId);
        list.push({ employeeId: r.employeeId, name: empName, reason: r.reason });
        map.set(r.dateKey, list);
      }
    }
    return map;
  }, [wfhResponse]);

  const absencesByDate = useMemo(() => {
    const map = new Map<string, Array<{ employeeId: string; name?: string }>>();
    if (!attendanceResponse?.data) return map;
    for (const rec of attendanceResponse.data) {
      if (rec.status === AttendanceStatus.ABSENT && rec.dateKey) {
        const list = map.get(rec.dateKey) || [];
        const empName = typeof rec.employee === "object" && rec.employee !== null ? rec.employee.name : String(rec.employee || rec.employeeId);
        list.push({ employeeId: rec.employeeId, name: empName });
        map.set(rec.dateKey, list);
      }
    }
    return map;
  }, [attendanceResponse]);

  // Events filtered by type and search query
  const filteredEvents = useMemo(() => {
    return allEvents.filter((evt) => {
      if (typeFilter !== "all" && evt.type !== typeFilter) return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        return (
          evt.title.toLowerCase().includes(q) ||
          (evt.description && evt.description.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [allEvents, typeFilter, searchQuery]);

  // Map events by dateKey for fast calendar grid rendering
  const eventsByDate = useMemo(() => {
    const map = new Map<string, CalendarEventItem[]>();
    for (const evt of filteredEvents) {
      const sKey = new Date(evt.startDate).toISOString().split("T")[0];
      const eKey = new Date(evt.endDate).toISOString().split("T")[0];

      // Insert for all dates in range
      let curr = sKey;
      let count = 0;
      while (curr <= eKey && count < 60) {
        const list = map.get(curr) || [];
        list.push(evt);
        map.set(curr, list);

        const [y, m, d] = curr.split("-").map(Number);
        const nextDate = new Date(Date.UTC(y, m - 1, d + 1));
        const yStr = nextDate.getUTCFullYear();
        const mStr = String(nextDate.getUTCMonth() + 1).padStart(2, "0");
        const dStr = String(nextDate.getUTCDate()).padStart(2, "0");
        curr = `${yStr}-${mStr}-${dStr}`;
        count++;
      }
    }
    return map;
  }, [filteredEvents]);

  // Selected Day Information & Status Calculation
  const selectedDayInfo = useMemo(() => {
    const [y, m, d] = selectedDateKey.split("-").map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayOfWeek = dateObj.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const isToday = selectedDateKey === todayKey;

    const events = eventsByDate.get(selectedDateKey) || [];
    const wfh = wfhByDate.get(selectedDateKey) || [];
    const absences = absencesByDate.get(selectedDateKey) || [];

    const holiday = events.find((e) => e.type === "holiday");
    const offDay = events.find((e) => e.type === "companyOffDay");

    let statusType: "holiday" | "offDay" | "weeklyOff" | "workday" = "workday";
    let statusLabel = "Mandatory Workday";

    if (holiday) {
      statusType = "holiday";
      statusLabel = `Public Holiday (${holiday.title})`;
    } else if (offDay) {
      statusType = "offDay";
      statusLabel = `Company Off-Day (${offDay.title})`;
    } else if (isWeekend) {
      statusType = "weeklyOff";
      statusLabel = "Weekly Off (Weekend)";
    }

    const formattedDate = dateObj.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    const totalPersonnel = 100;
    const attendanceCapacity =
      statusType === "holiday" || statusType === "offDay"
        ? 0
        : Math.max(0, Math.min(100, Math.round(((totalPersonnel - absences.length) / totalPersonnel) * 100)));

    return {
      dateObj,
      formattedDate,
      isWeekend,
      isToday,
      events,
      wfh,
      absences,
      statusType,
      statusLabel,
      attendanceCapacity,
    };
  }, [selectedDateKey, eventsByDate, wfhByDate, absencesByDate]);

  // Compute Month Summary
  const monthSummary = useMemo(() => {
    const daysInMonth = new Date(activeYear, activeMonth + 1, 0).getDate();
    let workingDays = 0;
    let holidays = 0;
    let companyOffDays = 0;
    let weeklyOffs = 0;
    let wfhDays = 0;

    for (let day = 1; day <= daysInMonth; day++) {
      const d = new Date(activeYear, activeMonth, day);
      const dayOfWeek = d.getDay(); // 0 is Sun, 6 is Sat
      const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
      const dStr = `${activeYear}-${String(activeMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

      const dayEvents = eventsByDate.get(dStr) || [];
      const hasHoliday = dayEvents.some((e) => e.type === "holiday");
      const hasOffDay = dayEvents.some((e) => e.type === "companyOffDay");

      if (hasHoliday) {
        holidays++;
      } else if (hasOffDay) {
        companyOffDays++;
      } else if (isWeekend) {
        weeklyOffs++;
      } else {
        workingDays++;
      }

      if (wfhByDate.has(dStr)) {
        wfhDays++;
      }
    }

    return {
      daysInMonth,
      workingDays,
      holidays,
      companyOffDays,
      weeklyOffs,
      wfhDays,
    };
  }, [activeYear, activeMonth, eventsByDate, wfhByDate]);

  // Format header period title
  const periodTitle = useMemo(() => {
    if (view === "month") {
      return currentDate.toLocaleDateString("en-US", { month: "long", year: "numeric" });
    } else if (view === "week") {
      const d = new Date(currentDate);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(d.setDate(diff));
      const sunday = new Date(d.setDate(diff + 6));
      return `Week of ${monday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${sunday.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;
    } else {
      return `Calendar Year ${activeYear}`;
    }
  }, [view, currentDate, activeYear]);

  // Generate Month Grid Day Cells
  const monthGridCells: DayCellInfo[] = useMemo(() => {
    const firstDayOfMonth = new Date(activeYear, activeMonth, 1);
    const lastDayOfMonth = new Date(activeYear, activeMonth + 1, 0);

    // Monday-based index: 0 = Mon, ..., 6 = Sun
    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const cells: DayCellInfo[] = [];
    const todayStr = new Date().toISOString().split("T")[0];

    // Previous month filler days
    const prevMonthLastDay = new Date(activeYear, activeMonth, 0).getDate();
    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = new Date(activeYear, activeMonth - 1, prevMonthLastDay - i);
      const dateKey = d.toISOString().split("T")[0];
      const dow = d.getDay();
      cells.push({
        date: d,
        dateKey,
        dayNumber: prevMonthLastDay - i,
        isCurrentMonth: false,
        isToday: dateKey === todayStr,
        isWeeklyOff: dow === 0 || dow === 6,
      });
    }

    // Current month days
    for (let d = 1; d <= lastDayOfMonth.getDate(); d++) {
      const cur = new Date(activeYear, activeMonth, d);
      const dateKey = `${activeYear}-${String(activeMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const dow = cur.getDay();
      cells.push({
        date: cur,
        dateKey,
        dayNumber: d,
        isCurrentMonth: true,
        isToday: dateKey === todayStr,
        isWeeklyOff: dow === 0 || dow === 6,
      });
    }

    // Next month filler days to complete grid (up to 35 or 42 cells)
    const totalRemaining = (7 - (cells.length % 7)) % 7;
    for (let d = 1; d <= totalRemaining; d++) {
      const cur = new Date(activeYear, activeMonth + 1, d);
      const dateKey = cur.toISOString().split("T")[0];
      const dow = cur.getDay();
      cells.push({
        date: cur,
        dateKey,
        dayNumber: d,
        isCurrentMonth: false,
        isToday: dateKey === todayStr,
        isWeeklyOff: dow === 0 || dow === 6,
      });
    }

    return cells;
  }, [activeYear, activeMonth]);

  // Open Drawer to Add Event on a specific date
  const handleOpenAddDrawer = (dateKey?: string) => {
    if (!isHrOrAdmin) {
      toast({
        title: "Permission Notice",
        description: "Only HR administrators can declare holidays or schedule organizational events.",
        type: "info",
      });
      return;
    }
    const target = dateKey || new Date().toISOString().split("T")[0];
    setDrawerDate(target);
    setDrawerMode("add");
    setSelectedEvent(null);
    setEntryForm({
      title: "",
      type: "holiday",
      startDate: target,
      endDate: target,
      isFullDay: true,
      startTime: "09:00",
      endTime: "18:00",
      description: "",
      location: "",
      audienceScope: "all",
    });
    setIsDrawerOpen(true);
  };

  // Open Drawer to Edit existing event
  const handleOpenEditDrawer = (evt: CalendarEventItem) => {
    setSelectedEvent(evt);
    setDrawerMode(isHrOrAdmin ? "edit" : "view");
    const sDate = new Date(evt.startDate);
    const eDate = new Date(evt.endDate);
    const sDateKey = sDate.toISOString().split("T")[0];
    const eDateKey = eDate.toISOString().split("T")[0];

    const sTime = `${String(sDate.getHours()).padStart(2, "0")}:${String(sDate.getMinutes()).padStart(2, "0")}`;
    const eTime = `${String(eDate.getHours()).padStart(2, "0")}:${String(eDate.getMinutes()).padStart(2, "0")}`;

    setEntryForm({
      title: evt.title,
      type: evt.type,
      startDate: sDateKey,
      endDate: eDateKey,
      isFullDay: evt.isFullDay !== false,
      startTime: sTime === "00:00" ? "09:00" : sTime,
      endTime: eTime === "00:00" ? "18:00" : eTime,
      description: evt.description || "",
      location: (evt as any).location || "",
      audienceScope: (evt.audience?.scope as any) || "all",
    });
    setIsDrawerOpen(true);
  };

  // Handle Form Submit (Add or Edit)
  const handleSubmitEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!entryForm.title.trim()) {
      toast({ title: "Validation Error", description: "Event title is mandatory.", type: "error" });
      return;
    }

    const startIso = entryForm.isFullDay
      ? new Date(`${entryForm.startDate}T00:00:00.000Z`).toISOString()
      : new Date(`${entryForm.startDate}T${entryForm.startTime}:00`).toISOString();

    const endIso = entryForm.isFullDay
      ? new Date(`${entryForm.endDate}T23:59:59.999Z`).toISOString()
      : new Date(`${entryForm.endDate}T${entryForm.endTime}:00`).toISOString();

    if (startIso > endIso) {
      toast({ title: "Validation Error", description: "End date/time cannot be before start.", type: "error" });
      return;
    }

    try {
      if (drawerMode === "add") {
        await createMutation.mutateAsync({
          title: entryForm.title.trim(),
          type: entryForm.type,
          startDate: startIso,
          endDate: endIso,
          isFullDay: entryForm.isFullDay,
          description: entryForm.description?.trim(),
          location: entryForm.location?.trim(),
          audience: { scope: entryForm.audienceScope },
        });
        toast({
          title: "Entry Created",
          description: `Successfully added '${entryForm.title}' to the calendar.`,
          type: "success",
        });
      } else if (drawerMode === "edit" && selectedEvent) {
        await updateMutation.mutateAsync({
          id: selectedEvent._id,
          payload: {
            title: entryForm.title.trim(),
            type: entryForm.type,
            startDate: startIso,
            endDate: endIso,
            isFullDay: entryForm.isFullDay,
            description: entryForm.description?.trim(),
            location: entryForm.location?.trim(),
            audience: { scope: entryForm.audienceScope },
          },
        });
        toast({
          title: "Entry Updated",
          description: `Saved updates to '${entryForm.title}'.`,
          type: "success",
        });
      }
      setIsDrawerOpen(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to save calendar entry";
      toast({ title: "Operation Failed", description: msg, type: "error" });
    }
  };

  // Handle Event Deletion with Undo Toast
  const handleConfirmDelete = async () => {
    if (!eventToDelete) return;
    const backup = { ...eventToDelete };

    try {
      await deleteMutation.mutateAsync(backup._id);
      setShowDeleteConfirm(false);
      setIsDrawerOpen(false);

      // Trigger Undo Toast
      undo(
        "Event Removed",
        async () => {
          try {
            await createMutation.mutateAsync({
              title: backup.title,
              type: backup.type,
              startDate: backup.startDate,
              endDate: backup.endDate,
              isFullDay: backup.isFullDay,
              description: backup.description,
              location: (backup as any).location,
              audience: backup.audience as any,
            });
            toast({
              title: "Restored",
              description: `'${backup.title}' was successfully restored to the calendar.`,
              type: "success",
            });
          } catch {
            toast({ title: "Error", description: "Failed to undo deletion.", type: "error" });
          }
        },
        `'${backup.title}' deleted. Click undo to restore.`,
        7000
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to remove entry";
      toast({ title: "Delete Failed", description: msg, type: "error" });
    }
  };

  // Handle Holiday Import
  const handleExecuteImport = async () => {
    try {
      const res = await importMutation.mutateAsync({ year: importYear, country: importCountry });
      toast({
        title: "Holidays Imported",
        description: `Imported ${res.importedCount} gazetted holidays. ${res.skippedCount} manual conflicts preserved.`,
        type: "success",
      });
      setShowImportModal(false);
      refetchEvents();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to import holidays";
      toast({ title: "Import Failed", description: msg, type: "error" });
    }
  };

  // Download ICS
  const handleDownloadIcs = () => {
    const url = getFullApiUrl(`/api/calendar/export.ics?year=${activeYear}`);
    window.open(url, "_blank");
    toast({
      title: "Downloading Calendar (.ICS)",
      description: `RFC 5545 calendar stream initiated for year ${activeYear}.`,
      type: "success",
    });
  };

  // Print Calendar Layout
  const handlePrint = () => {
    window.print();
  };

  // Event Badges & Styling Helper
  const getEventBadge = (evt: CalendarEventItem) => {
    switch (evt.type) {
      case "holiday":
        return {
          bg: "bg-indigo-50 text-indigo-700 border-indigo-200 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800",
          icon: <Landmark className="w-3 h-3 text-indigo-600 shrink-0" />,
          label: "Public Holiday",
        };
      case "companyOffDay":
        return {
          bg: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800",
          icon: <Building className="w-3 h-3 text-amber-600 shrink-0" />,
          label: "Company Off-Day",
        };
      case "meeting":
        return {
          bg: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/60 dark:text-purple-300 dark:border-purple-800",
          icon: <Users className="w-3 h-3 text-purple-600 shrink-0" />,
          label: "Meeting",
        };
      default:
        return {
          bg: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/60 dark:text-sky-300 dark:border-sky-800",
          icon: <Sparkles className="w-3 h-3 text-sky-600 shrink-0" />,
          label: "Corporate Event",
        };
    }
  };

  return (
    <div className="space-y-6">
      {/* PRINT-ONLY CORPORATE HEADER */}
      <div className="hidden print:block pb-4 mb-4 border-b border-slate-300">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900 uppercase tracking-wider">
              VorldX Workforce Suite — Organizational Calendar
            </h1>
            <p className="text-xs text-slate-600">
              Period: {periodTitle} • Timezone: Asia/Kolkata (IST UTC+05:30) • Authoritative Attendance Schedule
            </p>
          </div>
          <div className="text-right text-xs text-slate-500">
            Generated: {new Date().toLocaleDateString()}
          </div>
        </div>
      </div>

      {/* TOP HEADER CONTROLS (Screen Only) */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800 no-print">
        {/* Left: Title & Live Pulse */}
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              Working Calendar
            </h1>
            <Badge variant="primary" size="md">
              {activeYear}
            </Badge>
            {/* Live Socket Sync Pulse */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800/60 rounded-full text-[11px] font-semibold text-emerald-700 dark:text-emerald-400"
              title="Live Socket connection: Changes reflect instantly across all sessions"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live Sync Active</span>
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time working days governance, holiday synchronization, and scheduled event management.
          </p>
        </div>

        {/* Right: Actions (Import, Export, Print, Add Entry) */}
        <div className="flex items-center flex-wrap gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleDownloadIcs}
            className="gap-1.5 text-xs font-semibold"
            title="Download RFC 5545 stream for Outlook / Google Calendar"
          >
            <Download className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            Download ICS
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="gap-1.5 text-xs font-semibold"
            title="Print clean A4 layout"
          >
            <Printer className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
            Print Layout
          </Button>

          {isHrOrAdmin && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setImportYear(activeYear);
                  setShowImportModal(true);
                }}
                className="gap-1.5 text-xs font-semibold text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-900/60 hover:bg-blue-50 dark:hover:bg-blue-950/30"
              >
                <UploadCloud className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                Import Holidays
              </Button>

              <Button
                variant="primary"
                size="sm"
                onClick={() => handleOpenAddDrawer()}
                className="gap-1.5 text-xs font-semibold"
              >
                <Plus className="w-3.5 h-3.5" />
                Add Calendar Entry
              </Button>
            </>
          )}
        </div>
      </div>

      {/* MONTH SUMMARY STATS BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="p-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-center shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Working Days
          </span>
          <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 mt-0.5 block">
            {monthSummary.workingDays}
          </span>
          <span className="text-[10px] text-slate-400">Attendance mandatory</span>
        </Card>

        <Card className="p-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-center shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Public Holidays
          </span>
          <span className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 mt-0.5 block">
            {monthSummary.holidays}
          </span>
          <span className="text-[10px] text-slate-400">Gazetted / declared</span>
        </Card>

        <Card className="p-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-center shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Company Off-Days
          </span>
          <span className="text-xl font-extrabold text-amber-600 dark:text-amber-400 mt-0.5 block">
            {monthSummary.companyOffDays}
          </span>
          <span className="text-[10px] text-slate-400">Exempt from punch</span>
        </Card>

        <Card className="p-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-center shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Weekly-Offs
          </span>
          <span className="text-xl font-extrabold text-slate-700 dark:text-slate-300 mt-0.5 block">
            {monthSummary.weeklyOffs}
          </span>
          <span className="text-[10px] text-slate-400">Saturdays & Sundays</span>
        </Card>

        <Card className="p-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-center shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            WFH Scheduled
          </span>
          <span className="text-xl font-extrabold text-sky-600 dark:text-sky-400 mt-0.5 block">
            {monthSummary.wfhDays}
          </span>
          <span className="text-[10px] text-slate-400">Approved remote</span>
        </Card>

        <Card className="p-3 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-center shadow-xs">
          <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
            Total Days
          </span>
          <span className="text-xl font-extrabold text-slate-900 dark:text-white mt-0.5 block">
            {monthSummary.daysInMonth}
          </span>
          <span className="text-[10px] text-slate-400">{currentDate.toLocaleString("default", { month: "short" })} duration</span>
        </Card>
      </div>

      {/* TOOLBAR: NAVIGATION + VIEW SELECTOR + OVERLAYS + LEGEND */}
      <Card className="p-4 border-slate-200 dark:border-slate-800 shadow-xs space-y-3.5 no-print">
        {/* Row 1: Period Navigator & View Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Navigation Controls */}
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={goPrevious}
              className="px-2"
              title="Previous period (Left Arrow)"
            >
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goToday}
              className="text-xs font-semibold px-3"
              title="Jump to today (T)"
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={goNext}
              className="px-2"
              title="Next period (Right Arrow)"
            >
              <ChevronRight className="w-4 h-4" />
            </Button>

            <span className="text-base font-bold text-slate-900 dark:text-white ml-2">
              {periodTitle}
            </span>
          </div>

          {/* View Toggle Tabs */}
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
            <button
              onClick={() => setView("month")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                view === "month"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
              title="Month View (Press M)"
            >
              Month View
            </button>
            <button
              onClick={() => setView("week")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                view === "week"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
              title="Week View (Press W)"
            >
              Week View
            </button>
            <button
              onClick={() => setView("year")}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-all ${
                view === "year"
                  ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                  : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
              }`}
              title="Year View (Press Y)"
            >
              Year View
            </button>
          </div>
        </div>

        {/* Row 2: Overlay Toggles + Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs">
          {/* Overlay Switches */}
          <div className="flex items-center flex-wrap gap-2">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
              Overlays:
            </span>

            <button
              onClick={() => setShowLeaveOverlay(!showLeaveOverlay)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                showLeaveOverlay
                  ? "bg-teal-50 dark:bg-teal-950/60 border-teal-300 dark:border-teal-800 text-teal-800 dark:text-teal-300"
                  : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400"
              }`}
            >
              <Palmtree className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />
              <span>Approved Leave</span>
              {showLeaveOverlay && <Check className="w-3 h-3 text-teal-700 ml-0.5" />}
            </button>

            <button
              onClick={() => setShowWfhOverlay(!showWfhOverlay)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                showWfhOverlay
                  ? "bg-sky-50 dark:bg-sky-950/60 border-sky-300 dark:border-sky-800 text-sky-800 dark:text-sky-300"
                  : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400"
              }`}
            >
              <Home className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
              <span>WFH Days</span>
              {showWfhOverlay && <Check className="w-3 h-3 text-sky-700 ml-0.5" />}
            </button>

            <button
              onClick={() => setShowAbsenceOverlay(!showAbsenceOverlay)}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-colors ${
                showAbsenceOverlay
                  ? "bg-rose-50 dark:bg-rose-950/60 border-rose-300 dark:border-rose-800 text-rose-800 dark:text-rose-300"
                  : "bg-slate-50 dark:bg-slate-800/40 border-slate-200 dark:border-slate-700 text-slate-400"
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
              <span>Team Absences</span>
              {showAbsenceOverlay && <Check className="w-3 h-3 text-rose-700 ml-0.5" />}
            </button>
          </div>

          {/* Search Box, Type Filter & Shortcuts hint */}
          <div className="flex items-center gap-2">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="px-2.5 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-xs text-slate-800 dark:text-slate-200"
            >
              <option value="all">All Types</option>
              <option value="holiday">Public Holidays</option>
              <option value="companyOffDay">Company Off-Days</option>
              <option value="meeting">Meetings</option>
              <option value="event">Corporate Events</option>
            </select>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              <input
                type="text"
                placeholder="Filter events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-md text-xs w-36 text-slate-800 dark:text-slate-200 placeholder-slate-400"
              />
            </div>

            <span className="hidden xl:inline text-[11px] text-slate-400 font-mono">
              Shortcuts: ← / → • T • M / W / Y
            </span>
          </div>
        </div>

        {/* Row 3: Color + Icon Legend */}
        <div className="flex items-center flex-wrap gap-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-600 dark:text-slate-300">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Legend:
          </span>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-emerald-500 shrink-0" />
            <Briefcase className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
            <span>Working Day</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-slate-300 dark:bg-slate-600 shrink-0" />
            <Coffee className="w-3.5 h-3.5 text-slate-500" />
            <span>Weekly Off</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-indigo-500 shrink-0" />
            <Landmark className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400" />
            <span className="font-semibold text-indigo-700 dark:text-indigo-400">Public Holiday</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-amber-500 shrink-0" />
            <Building className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
            <span className="font-semibold text-amber-700 dark:text-amber-400">Company Off-Day</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-purple-500 shrink-0" />
            <Users className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
            <span>Meeting</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded-full bg-sky-500 shrink-0" />
            <Sparkles className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
            <span>Corporate Event</span>
          </div>
        </div>
      </Card>

      {/* CALENDAR BODY */}
      {isEventsLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-96 w-full rounded-xl" />
        </div>
      ) : isEventsError ? (
        <ErrorState
          title="Failed to Load Calendar"
          message={eventsError instanceof Error ? eventsError.message : "Network error"}
          onRetry={() => refetchEvents()}
        />
      ) : (
        <>
          {/* ========================================================= */}
          {/* VIEW 1: MONTH VIEW (7-COLUMN GRID) */}
          {/* ========================================================= */}
          {view === "month" && (
            <Card
              className={clsx(
                "border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden",
                prefersReducedMotion ? "" : "animate-page-enter"
              )}
            >
              {/* Day of Week Headers */}
              <div className="grid grid-cols-7 bg-slate-100 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700 text-center font-bold text-xs text-slate-700 dark:text-slate-300 py-2.5">
                <div>Mon</div>
                <div>Tue</div>
                <div>Wed</div>
                <div>Thu</div>
                <div>Fri</div>
                <div className="text-slate-400">Sat</div>
                <div className="text-slate-400">Sun</div>
              </div>

              {/* 35 or 42 Cells Grid */}
              <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y divide-slate-100 dark:divide-slate-800 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
                {monthGridCells.map((cell) => {
                  const dayEvents = eventsByDate.get(cell.dateKey) || [];
                  const dayWfh = showWfhOverlay ? wfhByDate.get(cell.dateKey) || [] : [];
                  const dayAbsences = showAbsenceOverlay ? absencesByDate.get(cell.dateKey) || [] : [];

                  const isHoliday = dayEvents.some((e) => e.type === "holiday");
                  const isOffDay = dayEvents.some((e) => e.type === "companyOffDay");
                  const isSelected = cell.dateKey === selectedDateKey;

                  // Background tinting
                  let bgClass = "bg-white dark:bg-slate-900";
                  if (!cell.isCurrentMonth) {
                    bgClass = "bg-slate-50/60 dark:bg-slate-950/40 opacity-50";
                  } else if (isHoliday) {
                    bgClass = "bg-indigo-50/40 dark:bg-indigo-950/20";
                  } else if (isOffDay) {
                    bgClass = "bg-amber-50/40 dark:bg-amber-950/20";
                  } else if (cell.isWeeklyOff) {
                    bgClass = "bg-slate-50/70 dark:bg-slate-950/50";
                  }

                  return (
                    <div
                      key={cell.dateKey}
                      onClick={() => setSelectedDateKey(cell.dateKey)}
                      className={clsx(
                        "min-h-[110px] p-2 flex flex-col justify-between transition-all group relative cursor-pointer hover:bg-blue-50/40 dark:hover:bg-blue-950/20",
                        bgClass,
                        isSelected
                          ? "ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900 bg-indigo-50/60 dark:bg-indigo-950/40 z-20 shadow-xs"
                          : cell.isToday
                          ? "ring-2 ring-blue-600 ring-inset dark:ring-blue-500 font-bold z-10"
                          : ""
                      )}
                    >
                      {/* Top Header of Cell: Date Number & Badges */}
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs ${
                              cell.isToday
                                ? "bg-blue-600 text-white font-extrabold shadow-xs"
                                : cell.isCurrentMonth
                                  ? "text-slate-800 dark:text-slate-200 font-semibold"
                                  : "text-slate-400"
                            }`}
                          >
                            {cell.dayNumber}
                          </span>

                          {cell.isToday && (
                            <span className="text-[10px] font-extrabold text-blue-600 dark:text-blue-400 uppercase tracking-wider">
                              Today
                            </span>
                          )}
                        </div>

                        {/* Hover Quick Add Button (HR/Admin) */}
                        {isHrOrAdmin && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenAddDrawer(cell.dateKey);
                            }}
                            className="opacity-0 group-hover:opacity-100 p-1 text-slate-400 hover:text-blue-600 rounded transition-opacity"
                            title="Add event on this date"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>

                      {/* Middle: Events & Overlays */}
                      <div className="space-y-1 my-1 overflow-hidden">
                        {/* Calendar Events (Holidays, Meetings, Corporate Events) */}
                        {dayEvents.slice(0, 3).map((evt) => {
                          const badge = getEventBadge(evt);
                          const timeStr = evt.isFullDay
                            ? "All Day"
                            : `${evt.startDate.split("T")[1]?.slice(0, 5) || "09:00"} - ${evt.endDate.split("T")[1]?.slice(0, 5) || "18:00"}`;

                          return (
                            <Tooltip
                              key={evt._id}
                              content={
                                <div className="p-1 space-y-1 max-w-xs text-left">
                                  <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                                    {badge.icon}
                                    <span>{evt.title}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-300 flex items-center gap-2">
                                    <span>{timeStr}</span>
                                    {evt.audience?.scope && (
                                      <span className="uppercase font-mono text-[9px] bg-slate-700 px-1 py-0.5 rounded">
                                        {evt.audience.scope}
                                      </span>
                                    )}
                                  </div>
                                  {evt.description && (
                                    <p className="text-[11px] text-slate-300 leading-snug line-clamp-3">
                                      {evt.description}
                                    </p>
                                  )}
                                </div>
                              }
                            >
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditDrawer(evt);
                                }}
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium border truncate transition-transform hover:scale-[1.01] ${badge.bg}`}
                              >
                                {badge.icon}
                                <span className="truncate">{evt.title}</span>
                              </div>
                            </Tooltip>
                          );
                        })}

                        {dayEvents.length > 3 && (
                          <div className="text-[10px] font-bold text-slate-500 pl-1">
                            +{dayEvents.length - 3} more events
                          </div>
                        )}

                        {/* Overlays: WFH Count */}
                        {dayWfh.length > 0 && (
                          <Tooltip
                            content={
                              <div className="p-1 text-left max-w-xs">
                                <div className="font-bold text-sky-300 flex items-center gap-1 text-xs">
                                  <Home className="w-3.5 h-3.5" />
                                  <span>{dayWfh.length} Approved Remote (WFH)</span>
                                </div>
                                <ul className="mt-1 text-[11px] text-slate-200 space-y-0.5">
                                  {dayWfh.slice(0, 4).map((w, idx) => (
                                    <li key={idx}>
                                      • {w.name || w.employeeId}
                                      {w.reason ? `: "${w.reason}"` : ""}
                                    </li>
                                  ))}
                                  {dayWfh.length > 4 && <li>+{dayWfh.length - 4} more...</li>}
                                </ul>
                              </div>
                            }
                          >
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-[10px] font-semibold text-sky-800 dark:text-sky-300 truncate">
                              <Home className="w-3 h-3 text-sky-600 shrink-0" />
                              <span>{dayWfh.length} WFH</span>
                            </div>
                          </Tooltip>
                        )}

                        {/* Overlays: Absence Count */}
                        {dayAbsences.length > 0 && (
                          <Tooltip
                            content={
                              <div className="p-1 text-left max-w-xs">
                                <div className="font-bold text-rose-300 flex items-center gap-1 text-xs">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  <span>{dayAbsences.length} Recorded Absences</span>
                                </div>
                                <ul className="mt-1 text-[11px] text-slate-200 space-y-0.5">
                                  {dayAbsences.slice(0, 4).map((a, idx) => (
                                    <li key={idx}>• {a.name || a.employeeId}</li>
                                  ))}
                                  {dayAbsences.length > 4 && <li>+{dayAbsences.length - 4} more...</li>}
                                </ul>
                              </div>
                            }
                          >
                            <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-[10px] font-semibold text-rose-800 dark:text-rose-300 truncate">
                              <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                              <span>{dayAbsences.length} Absent</span>
                            </div>
                          </Tooltip>
                        )}
                      </div>

                      {/* Bottom Footer: Day Type indicator */}
                      <div className="text-right">
                        {isHoliday ? (
                          <span className="text-[9px] font-extrabold text-indigo-700 dark:text-indigo-400 uppercase tracking-wider">
                            Public Holiday
                          </span>
                        ) : isOffDay ? (
                          <span className="text-[9px] font-extrabold text-amber-700 dark:text-amber-400 uppercase tracking-wider">
                            Company Off
                          </span>
                        ) : cell.isWeeklyOff ? (
                          <span className="text-[9px] text-slate-400 dark:text-slate-500 uppercase tracking-wider">
                            Weekly-Off
                          </span>
                        ) : (
                          <span className="text-[9px] text-emerald-600 dark:text-emerald-500 uppercase tracking-wider">
                            Workday
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* ========================================================= */}
          {/* VIEW 2: WEEK VIEW (7-DAY COLUMN DETAILED SPREAD) */}
          {/* ========================================================= */}
          {view === "week" && (
            <div
              className={clsx(
                "grid grid-cols-1 md:grid-cols-7 gap-3",
                prefersReducedMotion ? "" : "animate-page-enter"
              )}
            >
              {Array.from({ length: 7 }).map((_, i) => {
                const d = new Date(currentDate);
                const day = d.getDay();
                const diff = d.getDate() - day + (day === 0 ? -6 : 1) + i;
                const weekDayDate = new Date(d.setDate(diff));
                const dateKey = weekDayDate.toISOString().split("T")[0];
                const isToday = dateKey === new Date().toISOString().split("T")[0];
                const isSelected = dateKey === selectedDateKey;
                const dayName = weekDayDate.toLocaleDateString("en-US", { weekday: "short" });
                const dayNumber = weekDayDate.getDate();

                const dayEvents = eventsByDate.get(dateKey) || [];
                const dayWfh = showWfhOverlay ? wfhByDate.get(dateKey) || [] : [];
                const dayAbsences = showAbsenceOverlay ? absencesByDate.get(dateKey) || [] : [];

                return (
                  <Card
                    key={dateKey}
                    onClick={() => setSelectedDateKey(dateKey)}
                    className={clsx(
                      "p-3 border-slate-200 dark:border-slate-800 shadow-xs flex flex-col justify-between min-h-[360px] cursor-pointer transition-all hover:border-indigo-400 dark:hover:border-indigo-600",
                      isSelected
                        ? "ring-2 ring-indigo-500 ring-offset-1 dark:ring-offset-slate-900 bg-indigo-50/40 dark:bg-indigo-950/30"
                        : isToday
                        ? "ring-2 ring-blue-600 dark:ring-blue-500 bg-blue-50/15"
                        : "bg-white dark:bg-slate-900"
                    )}
                  >
                    <div>
                      {/* Day Header */}
                      <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
                        <div>
                          <span className="text-xs font-semibold text-slate-500 uppercase block">
                            {dayName}
                          </span>
                          <span
                            className={`text-lg font-bold ${
                              isToday ? "text-blue-600 dark:text-blue-400" : "text-slate-900 dark:text-white"
                            }`}
                          >
                            {dayNumber}
                          </span>
                        </div>
                        {isToday && (
                          <Badge variant="primary" size="sm">
                            Today
                          </Badge>
                        )}
                      </div>

                      {/* Events List for Day */}
                      <div className="mt-3 space-y-2">
                        {dayEvents.length === 0 && dayWfh.length === 0 && dayAbsences.length === 0 && (
                          <p className="text-[11px] text-slate-400 italic pt-2">No events</p>
                        )}

                        {dayEvents.map((evt) => {
                          const badge = getEventBadge(evt);
                          const timeStr = evt.isFullDay
                            ? "All Day"
                            : `${evt.startDate.split("T")[1]?.slice(0, 5) || "09:00"} - ${evt.endDate.split("T")[1]?.slice(0, 5) || "18:00"}`;

                          return (
                            <Tooltip
                              key={evt._id}
                              content={
                                <div className="p-1 space-y-1 max-w-xs text-left">
                                  <div className="flex items-center gap-1.5 font-bold text-white text-xs">
                                    {badge.icon}
                                    <span>{evt.title}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-300">
                                    <span>{timeStr}</span>
                                    {evt.audience?.scope && (
                                      <span className="ml-1.5 uppercase font-mono text-[9px] bg-slate-700 px-1 py-0.5 rounded">
                                        {evt.audience.scope}
                                      </span>
                                    )}
                                  </div>
                                  {evt.description && (
                                    <p className="text-[11px] text-slate-300 leading-snug line-clamp-3">
                                      {evt.description}
                                    </p>
                                  )}
                                </div>
                              }
                            >
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenEditDrawer(evt);
                                }}
                                className={`p-2 rounded-lg border text-xs cursor-pointer transition-transform hover:scale-[1.01] ${badge.bg}`}
                              >
                                <div className="flex items-center justify-between">
                                  <div className="flex items-center gap-1 font-bold">
                                    {badge.icon}
                                    <span>{evt.title}</span>
                                  </div>
                                  <span className="text-[10px] uppercase font-semibold">
                                    {evt.isFullDay ? "All Day" : "Scheduled"}
                                  </span>
                                </div>
                                {evt.description && (
                                  <p className="text-[11px] text-slate-600 dark:text-slate-300 mt-1 line-clamp-2">
                                    {evt.description}
                                  </p>
                                )}
                              </div>
                            </Tooltip>
                          );
                        })}

                        {/* WFH Overlays */}
                        {dayWfh.length > 0 && (
                          <div className="p-2 bg-sky-50 dark:bg-sky-950/50 border border-sky-200 dark:border-sky-800 rounded-lg text-xs text-sky-900 dark:text-sky-300">
                            <div className="flex items-center gap-1 font-bold">
                              <Home className="w-3.5 h-3.5 text-sky-600" />
                              <span>{dayWfh.length} WFH Approvals</span>
                            </div>
                            <ul className="text-[10px] mt-1 space-y-0.5 text-slate-600 dark:text-slate-400">
                              {dayWfh.slice(0, 3).map((w, idx) => (
                                <li key={idx}>• {w.name || w.employeeId}</li>
                              ))}
                              {dayWfh.length > 3 && <li>+{dayWfh.length - 3} more...</li>}
                            </ul>
                          </div>
                        )}

                        {/* Absence Overlays */}
                        {dayAbsences.length > 0 && (
                          <div className="p-2 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 rounded-lg text-xs text-rose-900 dark:text-rose-300">
                            <div className="flex items-center gap-1 font-bold">
                              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                              <span>{dayAbsences.length} Absences Recorded</span>
                            </div>
                            <ul className="text-[10px] mt-1 space-y-0.5 text-slate-600 dark:text-slate-400">
                              {dayAbsences.slice(0, 2).map((a, idx) => (
                                <li key={idx}>• {a.name || a.employeeId}</li>
                              ))}
                              {dayAbsences.length > 2 && <li>+{dayAbsences.length - 2} more...</li>}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Bottom Add button */}
                    {isHrOrAdmin && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenAddDrawer(dateKey);
                        }}
                        className="w-full mt-3 text-xs gap-1 py-1"
                      >
                        <Plus className="w-3 h-3" />
                        Add Entry
                      </Button>
                    )}
                  </Card>
                );
              })}
            </div>
          )}

          {/* ========================================================= */}
          {/* VIEW 3: YEAR VIEW (12 MINI-MONTH CALENDARS) */}
          {/* ========================================================= */}
          {view === "year" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, monthIndex) => {
                const monthDate = new Date(activeYear, monthIndex, 1);
                const monthName = monthDate.toLocaleDateString("en-US", { month: "long" });
                const daysInMonth = new Date(activeYear, monthIndex + 1, 0).getDate();
                const startDay = (monthDate.getDay() + 6) % 7; // Mon=0

                return (
                  <Card
                    key={monthIndex}
                    onClick={() => {
                      const next = new Date(currentDate);
                      next.setMonth(monthIndex);
                      setCurrentDate(next);
                      setView("month");
                    }}
                    className="p-3 border-slate-200 dark:border-slate-800 shadow-xs cursor-pointer hover:border-blue-500 hover:shadow-md transition-all group bg-white dark:bg-slate-900"
                    title={`Click to view ${monthName} ${activeYear} in Month View`}
                  >
                    <div className="flex items-center justify-between pb-1.5 border-b border-slate-100 dark:border-slate-800">
                      <span className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-blue-600">
                        {monthName}
                      </span>
                      <span className="text-[10px] text-slate-400 font-mono">{activeYear}</span>
                    </div>

                    {/* Mini Day of Week headers */}
                    <div className="grid grid-cols-7 text-center text-[10px] font-bold text-slate-400 py-1">
                      <div>M</div>
                      <div>T</div>
                      <div>W</div>
                      <div>T</div>
                      <div>F</div>
                      <div>S</div>
                      <div>S</div>
                    </div>

                    {/* Mini day numbers */}
                    <div className="grid grid-cols-7 text-center text-[10px] gap-y-1 py-1">
                      {Array.from({ length: startDay }).map((_, i) => (
                        <div key={`empty-${i}`} />
                      ))}

                      {Array.from({ length: daysInMonth }).map((_, i) => {
                        const dayNum = i + 1;
                        const dateKey = `${activeYear}-${String(monthIndex + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
                        const dayEvents = eventsByDate.get(dateKey) || [];
                        const isHoliday = dayEvents.some((e) => e.type === "holiday");
                        const isOffDay = dayEvents.some((e) => e.type === "companyOffDay");
                        const isToday = dateKey === new Date().toISOString().split("T")[0];

                        return (
                          <div
                            key={dateKey}
                            className={`w-5 h-5 mx-auto rounded-full flex items-center justify-center font-medium ${
                              isToday
                                ? "bg-blue-600 text-white font-bold"
                                : isHoliday
                                  ? "bg-indigo-600 text-white font-bold"
                                  : isOffDay
                                    ? "bg-amber-500 text-white font-bold"
                                    : "text-slate-700 dark:text-slate-300"
                            }`}
                          >
                            {dayNum}
                          </div>
                        );
                      })}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* ========================================================= */}
      {/* SELECTED DATE RECORDS & SUMMARIES PANEL */}
      {/* ========================================================= */}
      <Card
        id="selected-day-records-panel"
        className={clsx(
          "border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden bg-white dark:bg-slate-900 transition-colors no-print",
          prefersReducedMotion ? "" : "animate-page-enter"
        )}
      >
        {/* Panel Header */}
        <div className="p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-50/70 dark:bg-slate-800/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-indigo-50 dark:bg-indigo-950/60 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 shrink-0">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                  {selectedDayInfo.formattedDate}
                </h2>
                {selectedDayInfo.isToday && (
                  <Badge variant="primary" size="sm">
                    Today
                  </Badge>
                )}
                <span
                  className={clsx(
                    "text-xs px-2.5 py-0.5 rounded-full font-semibold border flex items-center gap-1",
                    selectedDayInfo.statusType === "holiday"
                      ? "bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800"
                      : selectedDayInfo.statusType === "offDay"
                      ? "bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                      : selectedDayInfo.statusType === "weeklyOff"
                      ? "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700"
                      : "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                  )}
                >
                  {selectedDayInfo.statusType === "holiday" ? (
                    <Landmark className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  ) : selectedDayInfo.statusType === "offDay" ? (
                    <Building className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  ) : selectedDayInfo.statusType === "weeklyOff" ? (
                    <Coffee className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  ) : (
                    <Briefcase className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  )}
                  {selectedDayInfo.statusLabel}
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Authoritative daily roster, scheduled meetings, gazetted holidays, and approved remote work.
              </p>
            </div>
          </div>

          {/* Stepper + Add Button */}
          <div className="flex items-center gap-2 self-start md:self-auto">
            <div className="flex items-center gap-1 bg-white dark:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 p-0.5">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectPreviousDay}
                className="px-2 py-1 h-7 text-xs"
                title="Previous Day"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectToday}
                className="text-xs font-semibold px-2.5 py-1 h-7"
                title="Jump to Today"
              >
                Today
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleSelectNextDay}
                className="px-2 py-1 h-7 text-xs"
                title="Next Day"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </Button>
            </div>

            {isHrOrAdmin && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => handleOpenAddDrawer(selectedDateKey)}
                className="gap-1.5 text-xs font-semibold h-8"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Event on This Day</span>
              </Button>
            )}
          </div>
        </div>

        {/* 4 Mini Summary Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:p-5 border-b border-slate-100 dark:border-slate-800 bg-slate-50/40 dark:bg-slate-900/40">
          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Scheduled Events
              </span>
              <span className="text-xl font-extrabold text-indigo-600 dark:text-indigo-400 block mt-0.5">
                {selectedDayInfo.events.length}
              </span>
            </div>
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/60 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Approved Remote
              </span>
              <span className="text-xl font-extrabold text-sky-600 dark:text-sky-400 block mt-0.5">
                {selectedDayInfo.wfh.length}
              </span>
            </div>
            <div className="p-2 bg-sky-50 dark:bg-sky-950/60 rounded-lg text-sky-600 dark:text-sky-400">
              <Home className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Absences Logged
              </span>
              <span className="text-xl font-extrabold text-rose-600 dark:text-rose-400 block mt-0.5">
                {selectedDayInfo.absences.length}
              </span>
            </div>
            <div className="p-2 bg-rose-50 dark:bg-rose-950/60 rounded-lg text-rose-600 dark:text-rose-400">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>

          <div className="p-3 bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700/60 flex items-center justify-between">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">
                Estimated Capacity
              </span>
              <span className="text-xl font-extrabold text-emerald-600 dark:text-emerald-400 block mt-0.5">
                {selectedDayInfo.statusType === "holiday" || selectedDayInfo.statusType === "offDay" ? "Off" : `${selectedDayInfo.attendanceCapacity}%`}
              </span>
            </div>
            <ProgressRing
              value={selectedDayInfo.attendanceCapacity}
              size={36}
              variant={selectedDayInfo.statusType === "holiday" ? "indigo" : selectedDayInfo.attendanceCapacity > 80 ? "success" : "warning"}
            />
          </div>
        </div>

        {/* Detailed Records Content */}
        <div className="p-4 sm:p-5 space-y-6">
          {/* Section 1: Scheduled Events & Holidays */}
          <div>
            <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <CalendarIcon className="w-4 h-4 text-indigo-500" />
              <span>Events & Organizational Schedules ({selectedDayInfo.events.length})</span>
            </h3>

            {selectedDayInfo.events.length === 0 ? (
              <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/30">
                No holidays, company off-days, or corporate meetings declared for this date.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {selectedDayInfo.events.map((evt) => {
                  const badge = getEventBadge(evt);
                  return (
                    <div
                      key={evt._id}
                      className={clsx(
                        "p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-3 bg-white dark:bg-slate-800/80 hover:shadow-xs",
                        badge.bg
                      )}
                    >
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 font-bold text-sm text-slate-900 dark:text-white">
                            {badge.icon}
                            <span>{evt.title}</span>
                          </div>
                          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/80 dark:bg-slate-900/80 shadow-xs border border-slate-200 dark:border-slate-700">
                            {badge.label}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-600 dark:text-slate-400 flex-wrap">
                          <div className="flex items-center gap-1">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <span>
                              {evt.isFullDay
                                ? "Full Day"
                                : `${evt.startDate.split("T")[1]?.slice(0, 5) || "09:00"} - ${evt.endDate.split("T")[1]?.slice(0, 5) || "18:00"}`}
                            </span>
                          </div>
                          {(evt as any).location && (
                            <div className="flex items-center gap-1">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span>{(evt as any).location}</span>
                            </div>
                          )}
                          {evt.audience?.scope && (
                            <span className="uppercase font-mono text-[10px] px-1.5 py-0.5 rounded bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-300">
                              Scope: {evt.audience.scope}
                            </span>
                          )}
                        </div>

                        {evt.description && (
                          <p className="text-xs text-slate-600 dark:text-slate-300 pt-1 line-clamp-2 leading-relaxed">
                            {evt.description}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60 dark:border-slate-700/60">
                        {isHrOrAdmin ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEditDrawer(evt)}
                            className="text-xs h-7 gap-1 px-2.5"
                          >
                            <Edit2 className="w-3 h-3" />
                            Edit
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenEditDrawer(evt)}
                            className="text-xs h-7 gap-1 px-2.5"
                          >
                            <Eye className="w-3 h-3" />
                            View Details
                          </Button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Section 2: Approved Remote Work (WFH) & Absences Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Approved WFH */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Home className="w-4 h-4 text-sky-500" />
                <span>Approved Remote Staff ({selectedDayInfo.wfh.length})</span>
              </h3>

              {selectedDayInfo.wfh.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/30">
                  No remote work approvals scheduled for this day.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {selectedDayInfo.wfh.map((w, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border border-sky-100 dark:border-sky-900/40 bg-sky-50/60 dark:bg-sky-950/20 flex items-center justify-between text-xs"
                    >
                      <div>
                        <span className="font-semibold text-slate-900 dark:text-white">
                          {w.name || w.employeeId}
                        </span>
                        {w.reason && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                            "{w.reason}"
                          </p>
                        )}
                      </div>
                      <Badge variant="primary" size="sm" className="bg-sky-100 text-sky-800 border-sky-200 dark:bg-sky-900/60 dark:text-sky-300 dark:border-sky-800 shrink-0">
                        WFH
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recorded Absences */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-rose-500" />
                <span>Recorded Absences ({selectedDayInfo.absences.length})</span>
              </h3>

              {selectedDayInfo.absences.length === 0 ? (
                <div className="p-4 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 dark:text-slate-500 bg-slate-50/50 dark:bg-slate-900/30">
                  Zero absences logged for this date. Full attendance baseline.
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                  {selectedDayInfo.absences.map((a, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-lg border border-rose-100 dark:border-rose-900/40 bg-rose-50/60 dark:bg-rose-950/20 flex items-center justify-between text-xs"
                    >
                      <span className="font-semibold text-slate-900 dark:text-white">
                        {a.name || a.employeeId}
                      </span>
                      <Badge variant="danger" size="sm" className="shrink-0">
                        Absent
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ========================================================= */}
      {/* DRAWER: ADD / EDIT / VIEW ENTRY */}
      {/* ========================================================= */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title={
          drawerMode === "add"
            ? "Add Calendar Entry"
            : drawerMode === "edit"
              ? "Edit Calendar Entry"
              : "Calendar Event Details"
        }
        description={`Target Date: ${drawerDate}`}
        width="lg"
      >
        <form onSubmit={handleSubmitEntry} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Event Title *
            </label>
            <Input
              type="text"
              placeholder="e.g. Republic Day / Quarterly All-Hands"
              value={entryForm.title}
              onChange={(e) => setEntryForm({ ...entryForm, title: e.target.value })}
              required
              disabled={drawerMode === "view"}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Event Type *
              </label>
              <select
                value={entryForm.type}
                onChange={(e) =>
                  setEntryForm({
                    ...entryForm,
                    type: e.target.value as "holiday" | "companyOffDay" | "meeting" | "event",
                  })
                }
                disabled={drawerMode === "view"}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900"
              >
                <option value="holiday">Official Public Holiday</option>
                <option value="companyOffDay">Company Off-Day</option>
                <option value="meeting">Team Meeting / Town Hall</option>
                <option value="event">Corporate Event</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Audience Scope
              </label>
              <select
                value={entryForm.audienceScope}
                onChange={(e) =>
                  setEntryForm({
                    ...entryForm,
                    audienceScope: e.target.value as "all" | "department" | "role",
                  })
                }
                disabled={drawerMode === "view"}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900"
              >
                <option value="all">All Staff (Company-Wide)</option>
                <option value="department">By Department</option>
                <option value="role">By Role (HR / Admin)</option>
              </select>
            </div>
          </div>

          {/* Date Range Inputs */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Start Date *
              </label>
              <Input
                type="date"
                value={entryForm.startDate}
                onChange={(e) => setEntryForm({ ...entryForm, startDate: e.target.value })}
                required
                disabled={drawerMode === "view"}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                End Date *
              </label>
              <Input
                type="date"
                value={entryForm.endDate}
                onChange={(e) => setEntryForm({ ...entryForm, endDate: e.target.value })}
                required
                disabled={drawerMode === "view"}
              />
            </div>
          </div>

          {/* All Day Toggle */}
          <div className="flex items-center gap-2 pt-1">
            <input
              type="checkbox"
              id="isFullDayToggle"
              checked={entryForm.isFullDay}
              onChange={(e) => setEntryForm({ ...entryForm, isFullDay: e.target.checked })}
              disabled={drawerMode === "view"}
              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
            />
            <label htmlFor="isFullDayToggle" className="text-xs text-slate-700 dark:text-slate-300 font-medium">
              All Day Event (Exempts whole shift from punch requirement)
            </label>
          </div>

          {/* Optional Time inputs when not all day */}
          {!entryForm.isFullDay && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Start Time
                </label>
                <Input
                  type="time"
                  value={entryForm.startTime}
                  onChange={(e) => setEntryForm({ ...entryForm, startTime: e.target.value })}
                  disabled={drawerMode === "view"}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  End Time
                </label>
                <Input
                  type="time"
                  value={entryForm.endTime}
                  onChange={(e) => setEntryForm({ ...entryForm, endTime: e.target.value })}
                  disabled={drawerMode === "view"}
                />
              </div>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Location / Video Link (Optional)
            </label>
            <Input
              type="text"
              placeholder="e.g. Main Auditorium / Zoom Link"
              value={entryForm.location}
              onChange={(e) => setEntryForm({ ...entryForm, location: e.target.value })}
              disabled={drawerMode === "view"}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Description & Justification
            </label>
            <textarea
              rows={3}
              value={entryForm.description}
              onChange={(e) => setEntryForm({ ...entryForm, description: e.target.value })}
              placeholder="Details regarding the event or holiday..."
              disabled={drawerMode === "view"}
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs text-slate-800 dark:text-slate-200 bg-white dark:bg-slate-900"
            />
          </div>

          {/* Drawer Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
            {drawerMode === "edit" && isHrOrAdmin ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setEventToDelete(selectedEvent);
                  setShowDeleteConfirm(true);
                }}
                className="text-rose-600 border-rose-200 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <Trash2 className="w-3.5 h-3.5 mr-1" />
                Remove Entry
              </Button>
            ) : (
              <div />
            )}

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsDrawerOpen(false)}
              >
                Cancel
              </Button>
              {drawerMode !== "view" && (
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={createMutation.isPending || updateMutation.isPending}
                >
                  {drawerMode === "add" ? "Save Event" : "Update Event"}
                </Button>
              )}
            </div>
          </div>
        </form>
      </Drawer>

      {/* ========================================================= */}
      {/* CONFIRM DELETE DIALOG */}
      {/* ========================================================= */}
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleConfirmDelete}
        title="Remove Calendar Entry"
        message={`Are you sure you want to delete '${eventToDelete?.title}' from the calendar? You can undo this action immediately from the toast notification.`}
        confirmText="Yes, Remove"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />

      {/* ========================================================= */}
      {/* MODAL: IMPORT NATIONAL HOLIDAYS WITH PREVIEW */}
      {/* ========================================================= */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import National Holidays"
        maxWidth="3xl"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Select Country
              </label>
              <select
                value={importCountry}
                onChange={(e) => setImportCountry(e.target.value)}
                className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-md text-xs bg-white dark:bg-slate-900"
              >
                <option value="IN">India (Gazetted National Holidays)</option>
                <option value="US">United States (Federal Holidays)</option>
                <option value="GB">United Kingdom (Bank Holidays)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Year
              </label>
              <select
                value={importYear}
                onChange={(e) => setImportYear(Number(e.target.value))}
                className="w-full px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-md text-xs bg-white dark:bg-slate-900"
              >
                <option value={activeYear - 1}>{activeYear - 1}</option>
                <option value={activeYear}>{activeYear} (Active Year)</option>
                <option value={activeYear + 1}>{activeYear + 1}</option>
              </select>
            </div>
          </div>

          {/* Preview Metrics Banner & Table */}
          {(() => {
            const previewItems = previewData?.items || (previewData as any)?.data?.items || [];
            const toImportCount =
              (previewData as any)?.toImportCount ??
              (previewData as any)?.toImport ??
              previewItems.filter((i: any) => i.action === "create").length;
            const alreadyImportedCount =
              (previewData as any)?.alreadyImportedCount ??
              (previewData as any)?.alreadyImported ??
              previewItems.filter(
                (i: any) => i.action === "already_exists" || i.action === "skip_already_imported"
              ).length;
            const manualConflictCount =
              (previewData as any)?.manualConflictCount ??
              (previewData as any)?.conflicts ??
              previewItems.filter((i: any) => i.action === "skip_manual_conflict").length;

            return (
              <>
                <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/40 border border-blue-100 dark:border-blue-900 rounded-lg text-xs text-blue-900 dark:text-blue-300">
                  <div>
                    <span className="font-bold">Provider:</span>{" "}
                    {previewData?.provider ||
                      (previewData as any)?.data?.provider ||
                      "Configured Adapter"}{" "}
                    ({importCountry})
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-emerald-700 dark:text-emerald-400">
                      {toImportCount} To Import
                    </span>
                    <span className="text-slate-500">{alreadyImportedCount} In Calendar</span>
                    {manualConflictCount > 0 && (
                      <span className="font-bold text-amber-700 dark:text-amber-400">
                        {manualConflictCount} Manual Protected
                      </span>
                    )}
                  </div>
                </div>

                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Preview of national holidays before database merge. Any custom holiday entered
                  manually by an HR user is protected and will never be overwritten.
                </p>

                {/* Preview Table */}
                {isPreviewLoading ? (
                  <Skeleton className="h-48 w-full rounded-lg" />
                ) : isPreviewError ? (
                  <div className="p-4 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-lg text-center space-y-2">
                    <p className="text-xs text-rose-700 dark:text-rose-300 font-medium">
                      Failed to load holiday preview from backend service.
                    </p>
                    <Button variant="outline" size="sm" onClick={() => refetchPreview()}>
                      Retry Preview
                    </Button>
                  </div>
                ) : previewItems.length === 0 ? (
                  <div className="p-8 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      No holiday items found for {importCountry} ({importYear}).
                    </p>
                  </div>
                ) : (
                  <div className="max-h-64 overflow-y-auto border border-slate-200 dark:border-slate-700 rounded-lg">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 font-semibold">
                        <tr>
                          <th className="py-2 px-3">Date</th>
                          <th className="py-2 px-3">Holiday Name</th>
                          <th className="py-2 px-3">Action Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {previewItems.map((item: any) => (
                          <tr
                            key={item.date}
                            className="hover:bg-slate-50 dark:hover:bg-slate-800/40"
                          >
                            <td className="py-2 px-3 font-mono font-semibold text-slate-800 dark:text-slate-200">
                              {item.date}
                            </td>
                            <td className="py-2 px-3 font-medium text-slate-900 dark:text-white">
                              {item.name}
                            </td>
                            <td className="py-2 px-3">
                              {item.action === "create" ? (
                                <Badge variant="success" size="sm">
                                  Ready to Import
                                </Badge>
                              ) : item.action === "skip_manual_conflict" ? (
                                <Badge variant="warning" size="sm">
                                  Skip Manual Conflict
                                </Badge>
                              ) : (
                                <Badge variant="neutral" size="sm">
                                  Already In Calendar
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Modal Actions */}
                <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                  <Button variant="outline" size="sm" onClick={() => setShowImportModal(false)}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleExecuteImport}
                    isLoading={importMutation.isPending}
                    disabled={isPreviewLoading || toImportCount === 0}
                  >
                    <UploadCloud className="w-4 h-4 mr-1.5" />
                    Import {toImportCount} Holidays
                  </Button>
                </div>
              </>
            );
          })()}
        </div>
      </Modal>
    </div>
  );
};
