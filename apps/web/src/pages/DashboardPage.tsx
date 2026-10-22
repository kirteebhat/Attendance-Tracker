import React from "react";
import {
  Users,
  UserCheck,
  ClockAlert,
  Home,
  UserMinus,
  FileText,
  RotateCw,
  Percent,
} from "lucide-react";
import { useDashboardSummary } from "../api/queries";
import { StatCard } from "../components/dashboard/StatCard";
import { AttendanceChart } from "../components/dashboard/AttendanceChart";
import { RecentActivity } from "../components/dashboard/RecentActivity";
import { StatCardSkeleton, Skeleton } from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/ErrorState";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";

export const DashboardPage: React.FC = () => {
  const { data, isLoading, isError, error, refetch, isFetching } = useDashboardSummary();

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        {/* Header Skeleton */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <Skeleton className="h-7 w-48" />
            <Skeleton className="h-4 w-72" />
          </div>
          <Skeleton className="h-9 w-28" />
        </div>

        {/* 6 Metric Cards Skeletons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <StatCardSkeleton key={i} />
          ))}
        </div>

        {/* Charts & Activity Skeletons */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
          <div>
            <Skeleton className="h-96 w-full rounded-xl" />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !data) {
    return (
      <ErrorState
        title="Unable to load executive metrics"
        message={error instanceof Error ? error.message : "Failed to fetch dashboard summary"}
        onRetry={() => refetch()}
        isRetrying={isFetching}
      />
    );
  }

  const { summary, trends, recentActivity, dateKey } = data;

  return (
    <div className="space-y-6">
      {/* Page Title & Status Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Executive Dashboard
            </h1>
            <Badge variant="info" size="md">
              {dateKey}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time workforce attendance metrics, dynamic QR scan activity, and compliance trends.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Daily Attendance Rate Indicator */}
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 bg-white rounded-lg border border-slate-200 shadow-xs">
            <Percent className="w-4 h-4 text-emerald-600" />
            <div className="text-xs">
              <span className="text-slate-500">Attendance:</span>{" "}
              <span className="font-bold text-slate-900">{summary.attendanceRate}%</span>
            </div>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            isLoading={isFetching}
            className="shrink-0"
          >
            <RotateCw className="w-3.5 h-3.5 mr-1" />
            Sync Now
          </Button>
        </div>
      </div>

      {/* 6 Key Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <StatCard
          label="Active Staff"
          value={summary.totalActiveEmployees}
          subtext="Total workforce"
          icon={Users}
          variant="blue"
        />
        <StatCard
          label="Present Today"
          value={summary.presentToday}
          subtext="On-premise check-ins"
          icon={UserCheck}
          variant="emerald"
        />
        <StatCard
          label="Late Arrivals"
          value={summary.lateToday}
          subtext="Beyond grace cutoff"
          icon={ClockAlert}
          variant="amber"
        />
        <StatCard
          label="Approved WFH"
          value={summary.wfhToday}
          subtext="Remote work days"
          icon={Home}
          variant="indigo"
        />
        <StatCard
          label="Not Yet In"
          value={summary.notYetCheckedInToday}
          subtext="Awaiting first scan"
          icon={UserMinus}
          variant="rose"
        />
        <StatCard
          label="Pending WFH"
          value={summary.pendingWfhRequests}
          subtext="Awaiting HR review"
          icon={FileText}
          variant="cyan"
        />
      </div>

      {/* Two Column Grid: Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <AttendanceChart last7Days={trends.last7Days} last30Days={trends.last30Days} />
        </div>
        <div>
          <RecentActivity activities={recentActivity} />
        </div>
      </div>
    </div>
  );
};

