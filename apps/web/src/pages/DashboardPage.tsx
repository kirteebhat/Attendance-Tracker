import React, { useMemo } from "react";
import {
  Users,
  UserCheck,
  ClockAlert,
  Home,
  UserMinus,
  CalendarDays,
  RotateCw,
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
import { ProgressRing } from "../components/ui/ProgressRing";

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

  // Compute authentic trend comparisons from summaryData.trends.last7Days if at least 2 days exist
  const { presentTrend, lateTrend, wfhTrend } = useMemo(() => {
    const last7Days = summaryData?.trends?.last7Days || [];
    if (last7Days.length < 2) {
      return { presentTrend: undefined, lateTrend: undefined, wfhTrend: undefined };
    }

    const todayItem = last7Days[last7Days.length - 1];
    const yesterdayItem = last7Days[last7Days.length - 2];

    return {
      presentTrend: {
        value: todayItem.presentCount - yesterdayItem.presentCount,
        isPositiveGood: true,
        label: "vs yesterday",
      },
      lateTrend: {
        value: todayItem.lateCount - yesterdayItem.lateCount,
        isPositiveGood: false, // fewer late arrivals is better
        label: "vs yesterday",
      },
      wfhTrend: {
        value: todayItem.wfhCount - yesterdayItem.wfhCount,
        isPositiveGood: true,
        label: "vs yesterday",
      },
    };
  }, [summaryData?.trends?.last7Days]);

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
            <Skeleton className="h-80 w-full rounded-2xl" />
          </div>
          <div>
            <Skeleton className="h-80 w-full rounded-2xl" />
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-80 w-full rounded-2xl" />
          </div>
          <div>
            <Skeleton className="h-80 w-full rounded-2xl" />
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
    present: summaryData?.summary?.presentToday || 0,
    late: summaryData?.summary?.lateToday || 0,
    absent: 0,
    leave: 0,
    wfh: summaryData?.summary?.wfhToday || 0,
    notYetCheckedIn: summaryData?.summary?.notYetCheckedInToday || 0,
    totalActive: summaryData?.summary?.totalActiveEmployees || 0,
    percentages: {
      present: summaryData?.summary?.attendanceRate || 0,
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
      : summaryData?.summary?.attendanceRate || 0;

  return (
    <div className="space-y-6">
      {/* Page Title & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 dark:text-slate-100 tracking-tight">
              Executive Dashboard
            </h1>
            <Badge variant="info" size="md">
              {dateKey}
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Attendance Rate Indicator */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 shadow-xs">
            <ProgressRing value={attendanceRate} size={36} strokeWidth={3.5} variant="primary" />
            <div className="text-xs">
              <span className="text-slate-500 dark:text-slate-400 block text-[10px] uppercase font-semibold">Attendance</span>{" "}
              <strong className="font-extrabold text-slate-900 dark:text-slate-100 text-sm">
                <AnimatedCounter value={attendanceRate} suffix="%" firstLoadOnly />
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

      {/* 6 Key Animated Metric Cards with Click-Through and Authentic Trends */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Active Staff"
          value={<AnimatedCounter value={statusSplit.totalActive} firstLoadOnly />}
          subtext="Total workforce"
          icon={Users}
          variant="blue"
          to="/employees"
        />
        <StatCard
          label="Present Today"
          value={<AnimatedCounter value={statusSplit.present} firstLoadOnly />}
          subtext={`${statusSplit.percentages.present}% checked in`}
          icon={UserCheck}
          variant="emerald"
          to={`/attendance?status=PRESENT&dateKey=${dateKey}`}
          trend={presentTrend}
        />
        <StatCard
          label="Late Arrivals"
          value={<AnimatedCounter value={statusSplit.late} firstLoadOnly />}
          subtext={`${statusSplit.percentages.late}% beyond grace`}
          icon={ClockAlert}
          variant="amber"
          to={`/attendance?status=LATE&dateKey=${dateKey}`}
          trend={lateTrend}
        />
        <StatCard
          label="Approved WFH"
          value={<AnimatedCounter value={statusSplit.wfh} firstLoadOnly />}
          subtext="Remote work days"
          icon={Home}
          variant="indigo"
          to={`/attendance?status=WFH_APPROVED&dateKey=${dateKey}`}
          trend={wfhTrend}
        />
        <StatCard
          label="On Leave"
          value={<AnimatedCounter value={statusSplit.leave} firstLoadOnly />}
          subtext="Approved time-off"
          icon={CalendarDays}
          variant="purple"
          to="/leave"
        />
        <StatCard
          label="Awaiting Scan"
          value={<AnimatedCounter value={statusSplit.notYetCheckedIn} firstLoadOnly />}
          subtext="Not checked in yet"
          icon={UserMinus}
          variant="rose"
          to={`/attendance?status=ABSENT&dateKey=${dateKey}`}
        />
      </div>

      {/* SECTION 1: Hourly Distribution Timeline (or 30D Heatmap) & Live Scan Feed */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 min-w-0">
          <TodayTimelineChart
            hourlyData={liveAnalytics?.hourlyToday || []}
            heatmapData={liveAnalytics?.heatmap30Days}
            timezone={liveAnalytics?.timezone}
          />
        </div>
        <div className="min-w-0">
          <LiveScanFeed
            scans={liveAnalytics?.recentScans || []}
            isLive={isSocketConnected}
          />
        </div>
      </div>

      {/* SECTION 2: Historical Compliance Trends & Department Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 min-w-0">
          <AttendanceChart
            last7Days={summaryData?.trends?.last7Days || []}
            last30Days={summaryData?.trends?.last30Days || []}
            isLoading={isSummaryLoading}
          />
        </div>
        <div className="min-w-0">
          <DepartmentBars
            departments={liveAnalytics?.departmentBreakdown || []}
            isLoading={isAnalyticsLoading}
          />
        </div>
      </div>

      {/* SECTION 3: Recent Activity Audit Feed */}
      {summaryData?.recentActivity && summaryData.recentActivity.length > 0 && (
        <div className="grid grid-cols-1 gap-6">
          <RecentActivity activities={summaryData.recentActivity} />
        </div>
      )}
    </div>
  );
};
