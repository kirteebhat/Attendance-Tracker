import React, { useState } from "react";
import { useTheme } from "../context/ThemeContext";
import {
  STATUS_REGISTRY,
  StatusCategory,
} from "@vorldx/shared";
import {
  StatusBadge,
  StatCard,
  LivePulseIndicator,
  EmptyState,
  ErrorState,
  Skeleton,
  Drawer,
  ConfirmDialog,
  Button,
  useToast,
} from "../components/ui";
import {
  Users,
  CheckCircle2,
  Clock,
  Sparkles,
  Sun,
  Moon,
  Laptop,
  Layers,
  Palette,
  ShieldCheck,
  RotateCw,
} from "lucide-react";

export const DesignSystemPage: React.FC = () => {
  const { theme, setTheme, prefersReducedMotion } = useTheme();
  const { success, error, info, undo } = useToast();

  const [counterTrigger, setCounterTrigger] = useState(0);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [undoStatus, setUndoStatus] = useState<string | null>(null);

  const statuses: StatusCategory[] = [
    "PRESENT",
    "LATE",
    "ABSENT",
    "INCOMPLETE",
    "WFH",
    "LEAVE",
    "HOLIDAY",
    "OFF_DAY",
    "PENDING",
    "APPROVED",
    "REJECTED",
    "CANCELLED",
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 p-6 md:p-10 transition-colors">
      <div className="max-w-7xl mx-auto space-y-12">
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-200 dark:border-slate-800">
          <div>
            <div className="flex items-center gap-2 text-indigo-600 dark:text-indigo-400 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-4 h-4" />
              <span>VorldX Enterprise Design System</span>
            </div>
            <h1 className="text-3xl font-black tracking-tight mt-1">Design System & Component Showcase</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-2xl">
              Unified design tokens, WCAG AA contrast compliance, dual-theme tokens, motion-reduced accessibility, and a shared status matrix across web, display kiosk, and mobile.
            </p>
          </div>

          {/* Theme Controls */}
          <div className="flex items-center gap-3 bg-white dark:bg-slate-900 p-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm shrink-0">
            <span className="text-xs font-semibold px-2 text-slate-500 dark:text-slate-400">Theme:</span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setTheme("light")}
                className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  theme === "light"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                title="Light Mode"
              >
                <Sun className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Light</span>
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  theme === "dark"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                title="Dark Mode"
              >
                <Moon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Dark</span>
              </button>
              <button
                onClick={() => setTheme("system")}
                className={`p-2 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-colors ${
                  theme === "system"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
                title="System Default"
              >
                <Laptop className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">System</span>
              </button>
            </div>
          </div>
        </header>

        {/* Accessibility & Motion Badge Bar */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="p-4 rounded-xl border border-emerald-200 dark:border-emerald-800/40 bg-emerald-50/60 dark:bg-emerald-950/20 flex items-center gap-3">
            <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">WCAG 2.1 AA Compliant</p>
              <p className="text-xs text-emerald-700/80 dark:text-emerald-400/80">Every status badge and text element satisfies ≥ 4.5:1 contrast.</p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-blue-200 dark:border-blue-800/40 bg-blue-50/60 dark:bg-blue-950/20 flex items-center gap-3">
            <Palette className="w-5 h-5 text-blue-600 dark:text-blue-400 shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-blue-800 dark:text-blue-300">No Color Alone</p>
              <p className="text-xs text-blue-700/80 dark:text-blue-400/80">All 12 statuses strictly pair color + icon + text label + ARIA.</p>
            </div>
          </div>

          <div className="p-4 rounded-xl border border-indigo-200 dark:border-indigo-800/40 bg-indigo-50/60 dark:bg-indigo-950/20 flex items-center gap-3">
            <Layers className="w-5 h-5 text-indigo-600 dark:text-indigo-400 shrink-0" />
            <div>
              <p className="text-xs font-bold uppercase tracking-wider text-indigo-800 dark:text-indigo-300">Reduced Motion State</p>
              <p className="text-xs text-indigo-700/80 dark:text-indigo-400/80">
                {prefersReducedMotion ? "Detected: Animations disabled" : "Active: 60fps smooth easing enabled"}
              </p>
            </div>
          </div>
        </section>

        {/* Section 1: Shared Status System Matrix */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight">1. Universal Status System Matrix</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Defined in packages/shared and consumed across Web Portal, Display Kiosk, and Mobile App.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {statuses.map((s) => {
              const descriptor = STATUS_REGISTRY[s];
              return (
                <div
                  key={s}
                  className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xs flex flex-col justify-between gap-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <StatusBadge status={s} size="md" />
                    <span className="text-[10px] font-mono uppercase text-slate-400 dark:text-slate-500">
                      {descriptor.icon}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
                    {descriptor.description}
                  </p>
                  <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] font-mono text-slate-400">
                    <span>Key: {s}</span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: descriptor.solidColor }} />
                      {descriptor.solidColor}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Section 2: Stat Cards with Animated Counters */}
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold tracking-tight">2. Stat Cards with Animated Counters</h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Smooth cubic easing using requestAnimationFrame, auto-suppressed when prefers-reduced-motion is active.
              </p>
            </div>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setCounterTrigger((c) => c + 1)}
              className="flex items-center gap-1.5"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Re-run Counters
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" key={counterTrigger}>
            <StatCard
              label="Total Employees"
              value={142}
              icon={Users}
              trend={{ value: "+8%", direction: "up", label: "vs last month" }}
              live={false}
              color="default"
            />
            <StatCard
              label="Present Today"
              value={128}
              icon={CheckCircle2}
              trend={{ value: "90.1%", direction: "up", label: "attendance rate" }}
              live={true}
              color="emerald"
            />
            <StatCard
              label="Late Arrivals"
              value={9}
              icon={Clock}
              trend={{ value: "-3", direction: "down", label: "fewer than yesterday" }}
              live={false}
              color="amber"
            />
            <StatCard
              label="On-Time Punctuality"
              value={94.5}
              suffix="%"
              decimals={1}
              icon={Sparkles}
              trend={{ value: "Target: 90%", direction: "neutral" }}
              live={true}
              color="blue"
            />
          </div>
        </section>

        {/* Section 3: Live Pulse Indicators */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">3. Live-Pulse Radar Indicators</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              High-visibility connection monitors with accessible ARIA live attributes and ping suppression on reduced motion.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center gap-8 shadow-xs">
            <LivePulseIndicator variant="live" label="Live Socket (Active)" size="md" />
            <LivePulseIndicator variant="syncing" label="Syncing Attendance Logs" size="md" />
            <LivePulseIndicator variant="warning" label="High Latency / Degraded" size="md" />
            <LivePulseIndicator variant="offline" label="Kiosk Offline" size="md" />
          </div>
        </section>

        {/* Section 4: Interactive Overlays: Drawer, Confirm Dialog, and Undo Toast */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">4. Interactive Overlays & Actions</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Full keyboard accessibility (Escape to close, focus trap, tab navigation) and undo toasts.
            </p>
          </div>

          <div className="p-6 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-wrap items-center gap-4 shadow-xs">
            <Button variant="primary" onClick={() => setIsDrawerOpen(true)}>
              Open Slide-over Drawer
            </Button>

            <Button variant="danger" onClick={() => setIsConfirmOpen(true)}>
              Open Confirm Dialog
            </Button>

            <Button
              variant="secondary"
              onClick={() => {
                setUndoStatus("Attendance punch revoked");
                undo(
                  "Punch record deleted",
                  () => {
                    setUndoStatus("Action undone: Record restored!");
                    success("Action Undone", "The punch record was restored.");
                  },
                  "You have 5 seconds to revert this action."
                );
              }}
            >
              Trigger Undo Toast (5s Countdown)
            </Button>

            <Button variant="outline" onClick={() => success("Saved Successfully", "Your settings were persisted.")}>
              Show Success Toast
            </Button>

            <Button variant="outline" onClick={() => error("Network Error", "Unable to connect to the backend.")}>
              Show Error Toast
            </Button>
          </div>

          {undoStatus && (
            <p className="text-xs font-mono text-indigo-600 dark:text-indigo-400">
              Undo callback state: {undoStatus}
            </p>
          )}
        </section>

        {/* Section 5: Empty & Error States */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">5. Empty & Error States</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              User-friendly fallbacks with clear call-to-actions and retry callbacks.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <EmptyState
              title="No Pending WFH Requests"
              description="All remote work requests have been reviewed by managers. Great job staying on top of the queue!"
              actionText="View Past History"
              onAction={() => info("Action Triggered", "Navigating to request history...")}
            />

            <ErrorState
              title="WebSocket Connection Failed"
              message="The live sync channel timed out. Check your network or try reconnecting to the kiosk feed."
              onRetry={() => success("Reconnected", "Live socket channel restored.")}
            />
          </div>
        </section>

        {/* Section 6: Skeleton Loading Variants */}
        <section className="space-y-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight">6. Accessible Skeleton Variants</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Shimmer placeholders preventing layout shifts during asynchronous data fetches.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
              <p className="text-xs font-semibold text-slate-500">Avatar + Details Skeleton</p>
              <div className="flex items-center gap-3">
                <Skeleton variant="circular" className="w-10 h-10" />
                <div className="space-y-2 flex-1">
                  <Skeleton variant="text" className="w-3/4 h-4" />
                  <Skeleton variant="text" className="w-1/2 h-3" />
                </div>
              </div>
            </div>

            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
              <p className="text-xs font-semibold text-slate-500">Badge & Button Skeleton</p>
              <div className="flex items-center gap-2">
                <Skeleton variant="badge" />
                <Skeleton variant="badge" />
                <Skeleton variant="badge" />
              </div>
              <Skeleton variant="text" className="w-full h-8 rounded-lg mt-2" />
            </div>

            <div className="p-5 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3">
              <p className="text-xs font-semibold text-slate-500">Metric Card Skeleton</p>
              <div className="flex items-center justify-between">
                <Skeleton variant="text" className="w-20 h-3" />
                <Skeleton variant="circular" className="w-6 h-6" />
              </div>
              <Skeleton variant="text" className="w-24 h-7" />
            </div>
          </div>
        </section>
      </div>

      {/* Slide-over Drawer Instance */}
      <Drawer
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        title="Employee Attendance Drawer"
        description="Detailed shift inspection and punch logs."
        footer={
          <>
            <Button variant="secondary" size="sm" onClick={() => setIsDrawerOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setIsDrawerOpen(false);
                success("Changes Saved", "Employee record updated.");
              }}
            >
              Save Record
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700/60">
            <h4 className="text-sm font-semibold mb-2">Shift Overview</h4>
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500">Current Status:</span>
              <StatusBadge status="PRESENT" size="sm" />
            </div>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            This drawer preserves background state and context, allowing administrators to inspect employee attendance records without losing their scroll position in the main table.
          </p>
        </div>
      </Drawer>

      {/* Confirm Dialog Instance */}
      <ConfirmDialog
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          setIsConfirmOpen(false);
          error("Action Confirmed", "Attendance shift deleted.");
        }}
        title="Delete Shift Entry"
        message="Are you sure you want to permanently delete this shift? This will recalculate the monthly punctuality score."
        variant="danger"
        confirmText="Yes, Delete Entry"
      />
    </div>
  );
};
