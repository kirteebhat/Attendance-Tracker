import React from "react";
import {
  Users,
  UserCheck,
  ClockAlert,
  Home,
  UserMinus,
  CalendarDays,
  RotateCw,
  Percent,
} from "lucide-react";
import { useDashboardSummary } from "../api/queries";
import { useLiveAttendanceAnalytics } from "../hooks/useLiveAttendanceAnalytics";
import { StatCard } from "../components/dashboard/StatCard";
import { TodayTimelineChart } from "../components/dashboard/TodayTimelineChart";
import { LiveScanFeed } from "../components/dashboard/LiveScanFeed";
import { DepartmentBars } from "../components/dashboard/DepartmentBars";
import { AttendanceChart } from "../components/dashboard/AttendanceChart";
import { RecentActivity } from "../components/dashboard/RecentActivity";
import { AnnouncementDashboardBlock } from "../components/dashboard/AnnouncementDashboardBlock";
import { AnimatedCounter } from "../components/ui/AnimatedCounter";
import { StatCardSkeleton, Skeleton } from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/ErrorState";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";

export const DashboardPage: React.FC = () => {
  // Executive summary query (trends & audit activity)
  const {
    data: summaryData,
    isLoading: isSummaryLoading,
    isError: isSummaryError,
    error: summaryError,
    refetch: refetchSummary,
    isFetching: isSummaryFetching,
  } = useDashboardSummary();

  // Real-time live attendance analytics hook (instant zero-flicker socket sync)
  const {
    data: liveAnalytics,
    isLoading: isAnalyticsLoading,
    isError: isAnalyticsError,
    error: analyticsError,
    refetch: refetchAnalytics,
    isFetching: isAnalyticsFetching,
    isConnected: isSocketConnected,
  } = useLiveAttendanceAnalytics();

  const handleSyncAll = () => {
    refetchSummary();
    refetchAnalytics();
  };

  const isInitialLoading = (isSummaryLoading && !summaryData) || (isAnalyticsLoading && !liveAnalytics);

  if (isInitialLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-56" />
            <Skeleton className="h-4 w-80" />
          </div>
          <Skeleton className="h-9 w-32" />
        </div>

        {/* 6 Metric Cards Skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>

        {/* Analytics Charts Skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
          <div>
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
          <div>
            <Skeleton className="h-80 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if ((isSummaryError && !summaryData) || (isAnalyticsError && !liveAnalytics)) {
    const errorMsg =
      analyticsError instanceof Error
        ? analyticsError.message
        : summaryError instanceof Error
        ? summaryError.message
        : "Failed to fetch dashboard metrics";

    return (
      <ErrorState
        title="Unable to load executive metrics"
        message={errorMsg}
        onRetry={handleSyncAll}
        isRetrying={isSummaryFetching || isAnalyticsFetching}
      />
    );
  }

  const dateKey = liveAnalytics?.dateKey || summaryData?.dateKey || "Today";
  const statusSplit = liveAnalytics?.statusSplit || {
    present: summaryData?.summary.presentToday || 0,
    late: summaryData?.summary.lateToday || 0,
    absent: 0,
    leave: 0,
    wfh: summaryData?.summary.wfhToday || 0,
    notYetCheckedIn: summaryData?.summary.notYetCheckedInToday || 0,
    totalActive: summaryData?.summary.totalActiveEmployees || 0,
    percentages: {
      present: summaryData?.summary.attendanceRate || 0,
      late: 0,
      absent: 0,
      leave: 0,
      wfh: 0,
      notYetCheckedIn: 0,
    },
  };

  const attendanceRate =
    statusSplit.totalActive > 0
      ? Math.round(((statusSplit.present + statusSplit.wfh) / statusSplit.totalActive) * 100)
      : summaryData?.summary.attendanceRate || 0;

  return (
    <div className="space-y-6">
      {/* Page Title & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              Executive Dashboard & Live Analytics
            </h1>
            <Badge variant="info" size="md">
              {dateKey}
            </Badge>
            {isSocketConnected && (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                LIVE STREAM
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            Real-time workforce attendance metrics, dynamic QR scan activity, and compliance trends.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Animated Daily Attendance Rate Indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-700 shadow-xs">
            <Percent className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
            <div className="text-xs">
              <span className="text-slate-500 dark:text-slate-400">Attendance:</span>{" "}
              <strong className="font-bold text-slate-900 dark:text-slate-100">
                <AnimatedCounter value={attendanceRate} suffix="%" />
              </strong>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={handleSyncAll}
            isLoading={isSummaryFetching || isAnalyticsFetching}
            className="shrink-0"
          >
            <RotateCw className="w-3.5 h-3.5 mr-1" />
            Sync Now
          </Button>
        </div>
      </div>

      {/* Live Announcement & Alert Block */}
      <AnnouncementDashboardBlock />

      {/* 6 Key Animated Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Active Staff"
          value={<AnimatedCounter value={statusSplit.totalActive} />}
          subtext="Total workforce"
          icon={Users}
          variant="blue"
        />
        <StatCard
          label="Present Today"
          value={<AnimatedCounter value={statusSplit.present} />}
          subtext={`${statusSplit.percentages.present}% checked in`}
          icon={UserCheck}
          variant="emerald"
        />
        <StatCard
          label="Late Arrivals"
          value={<AnimatedCounter value={statusSplit.late} />}
          subtext={`${statusSplit.percentages.late}% beyond grace`}
          icon={ClockAlert}
          variant="amber"
        />
        <StatCard
          label="Approved WFH"
          value={<AnimatedCounter value={statusSplit.wfh} />}
          subtext="Remote work days"
          icon={Home}
          variant="indigo"
        />
        <StatCard
          label="On Leave"
          value={<AnimatedCounter value={statusSplit.leave} />}
          subtext="Approved time-off"
          icon={CalendarDays}
          variant="purple"
        />
        <StatCard
          label="Awaiting Scan"
          value={<AnimatedCounter value={statusSplit.notYetCheckedIn} />}
          subtext="Not checked in yet"
          icon={UserMinus}
          variant="rose"
        />
      </div>

      {/* SECTION 1: Hourly Distribution Timeline & Live Scan Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <TodayTimelineChart
            hourlyData={liveAnalytics?.hourlyToday || []}
            timezone={liveAnalytics?.timezone}
          />
        </div>
        <div>
          <LiveScanFeed
            scans={liveAnalytics?.recentScans || []}
            isLive={isSocketConnected}
          />
        </div>
      </div>

      {/* SECTION 2: Historical Compliance Trends & Department Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          {summaryData && (
            <AttendanceChart
              last7Days={summaryData.trends.last7Days}
              last30Days={summaryData.trends.last30Days}
            />
          )}
        </div>
        <div>
          <DepartmentBars
            departments={liveAnalytics?.departmentBreakdown || []}
          />
        </div>
      </div>

      {/* SECTION 3: Recent Activity Audit Feed */}
      {summaryData && summaryData.recentActivity.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          <RecentActivity activities={summaryData.recentActivity} />
        </div>
      )}
    </div>
  );
};
