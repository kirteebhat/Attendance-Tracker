import { useState, useEffect, useCallback, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSocket } from "../context/SocketContext";
import { useLiveAnalytics } from "../api/queries";
import {
  LiveAttendanceAnalyticsResponse,
  LiveScanFeedItem,
  AttendanceStatus,
  SocketEvent,
  AttendanceUpdatedPayload,
} from "@vorldx/shared";

interface UseLiveAttendanceAnalyticsOptions {
  dateKey?: string;
  department?: string;
}

export function useLiveAttendanceAnalytics(options?: UseLiveAttendanceAnalyticsOptions) {
  const { socket, isConnected } = useSocket();
  const queryClient = useQueryClient();

  // Primary API Query
  const {
    data: initialData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useLiveAnalytics({
    dateKey: options?.dateKey,
    department: options?.department,
  });

  // Local live state to enable instant mutations without page reload
  const [liveData, setLiveData] = useState<LiveAttendanceAnalyticsResponse | null>(null);
  const liveDataRef = useRef<LiveAttendanceAnalyticsResponse | null>(null);

  // Keep ref in sync
  useEffect(() => {
    liveDataRef.current = liveData;
  }, [liveData]);

  // Sync state when query data arrives
  useEffect(() => {
    if (initialData) {
      setLiveData(initialData);
    }
  }, [initialData]);

  // Handle incoming live scan socket event
  const handleIncomingPunch = useCallback(
    (payload: AttendanceUpdatedPayload) => {
      if (!liveDataRef.current) return;

      const current = liveDataRef.current;
      const todayDateKey = current.dateKey;

      // Only apply if the punch belongs to the currently displayed date
      if (payload.dateKey && payload.dateKey !== todayDateKey) {
        return;
      }

      // 1. Construct new feed item
      const newScanItem: LiveScanFeedItem = {
        id: payload.recordId || `scan_${Date.now()}_${Math.random()}`,
        employeeId: payload.employeeId,
        employeeName: payload.employeeName || payload.employeeId,
        department: payload.department || "General",
        designation: payload.designation,
        scanTime: payload.timestamp || new Date().toISOString(),
        punchType: (payload.punchType as any) || "CHECK_IN",
        status: (payload.status as AttendanceStatus) || AttendanceStatus.PRESENT,
        isLate: !!payload.isLate,
        lateMinutes: payload.lateMinutes || 0,
      };

      // 2. Prepend to recent scans feed (deduplicated by recordId + timestamp)
      const updatedRecentScans = [
        newScanItem,
        ...current.recentScans.filter((s) => s.id !== newScanItem.id),
      ].slice(0, 30);

      // 3. Update Status Split if check-in
      const isCheckIn = payload.punchType === "CHECK_IN";
      const isLateArrival = payload.isLate || payload.status === AttendanceStatus.LATE;

      let newStatusSplit = { ...current.statusSplit };
      if (isCheckIn) {
        const newPresent = newStatusSplit.present + 1;
        const newLate = isLateArrival ? newStatusSplit.late + 1 : newStatusSplit.late;
        const newNotYet = Math.max(0, newStatusSplit.notYetCheckedIn - 1);
        const total = newStatusSplit.totalActive || 1;

        newStatusSplit = {
          ...newStatusSplit,
          present: newPresent,
          late: newLate,
          notYetCheckedIn: newNotYet,
          percentages: {
            ...newStatusSplit.percentages,
            present: Number(((newPresent / total) * 100).toFixed(1)),
            late: Number(((newLate / total) * 100).toFixed(1)),
            notYetCheckedIn: Number(((newNotYet / total) * 100).toFixed(1)),
          },
        };
      }

      // 4. Update Hourly Distribution
      let scanHour = 9;
      try {
        const scanDate = new Date(payload.timestamp || new Date());
        const parts = new Intl.DateTimeFormat("en-US", {
          timeZone: current.timezone || "Asia/Kolkata",
          hour: "numeric",
          hourCycle: "h23",
        }).formatToParts(scanDate);
        scanHour = parseInt(parts.find((p) => p.type === "hour")?.value || "9", 10);
      } catch {
        scanHour = new Date().getHours();
      }

      const updatedHourly = current.hourlyToday.map((h) => {
        if (h.hour === scanHour && isCheckIn) {
          return {
            ...h,
            checkIns: h.checkIns + 1,
            onTime: isLateArrival ? h.onTime : h.onTime + 1,
            late: isLateArrival ? h.late + 1 : h.late,
          };
        }
        return h;
      });

      // 5. Update Department Breakdown
      const empDept = payload.department || "General";
      const updatedDepts = current.departmentBreakdown.map((dept) => {
        if (dept.department.toLowerCase() === empDept.toLowerCase() && isCheckIn) {
          const newPresent = dept.present + 1;
          const newLate = isLateArrival ? dept.late + 1 : dept.late;
          const newNotYet = Math.max(0, dept.notYetIn - 1);
          const attRate =
            dept.totalEmployees > 0
              ? Math.round(((newPresent + dept.wfh) / dept.totalEmployees) * 100)
              : 0;
          const punctRate =
            newPresent > 0 ? Math.round(((newPresent - newLate) / newPresent) * 100) : 100;

          return {
            ...dept,
            present: newPresent,
            late: newLate,
            notYetIn: newNotYet,
            attendanceRate: attRate,
            punctualityRate: punctRate,
          };
        }
        return dept;
      });

      // Apply the live update in-memory
      const nextState: LiveAttendanceAnalyticsResponse = {
        ...current,
        recentScans: updatedRecentScans,
        statusSplit: newStatusSplit,
        hourlyToday: updatedHourly,
        departmentBreakdown: updatedDepts,
        generatedAt: new Date().toISOString(),
      };

      setLiveData(nextState);

      // Silently update TanStack Query cache so background re-fetch remains consistent
      queryClient.setQueryData(
        ["live-attendance-analytics", options?.dateKey, options?.department],
        nextState
      );
    },
    [options?.dateKey, options?.department, queryClient]
  );

  // Subscribe to real-time events
  useEffect(() => {
    if (!socket) return;

    socket.on(SocketEvent.ATTENDANCE_UPDATED, handleIncomingPunch);
    socket.on(SocketEvent.ATTENDANCE_PUNCHED, handleIncomingPunch);
    socket.on(SocketEvent.ATTENDANCE_FEED_ITEM, handleIncomingPunch);

    return () => {
      socket.off(SocketEvent.ATTENDANCE_UPDATED, handleIncomingPunch);
      socket.off(SocketEvent.ATTENDANCE_PUNCHED, handleIncomingPunch);
      socket.off(SocketEvent.ATTENDANCE_FEED_ITEM, handleIncomingPunch);
    };
  }, [socket, handleIncomingPunch]);

  return {
    data: liveData,
    isLoading: isLoading && !liveData,
    isError,
    error,
    refetch,
    isFetching,
    isConnected,
  };
}

