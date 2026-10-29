import React, { useState, useRef, useEffect } from "react";
import { useLocation, Link } from "react-router-dom";
import {
  Menu,
  ChevronRight,
  Wifi,
  WifiOff,
  LogOut,
  User,
  Sun,
  Moon,
  Palette,
  Bell,
  Calendar,
  ChevronLeft,
  ChevronRight as ChevronRightIcon,
  Shield,
  LifeBuoy,
  Megaphone,
  CalendarCheck,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { useTheme } from "../../context/ThemeContext";
import { Badge } from "../ui/Badge";
import { HROnlineIndicator } from "../ui/HROnlineIndicator";
import { Tooltip } from "../ui/Tooltip";
import {
  useLeaveRequests,
  useUnreadAnnouncementsCount,
  useEnquiries,
} from "../../api/queries";

interface TopbarProps {
  onOpenMobile: () => void;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
}

const routeNameMap: Record<string, string> = {
  "": "Executive Dashboard",
  dashboard: "Executive Dashboard",
  attendance: "Attendance Ledger",
  reports: "Reports & Analytics",
  wfh: "WFH Approvals",
  employees: "Employee Directory",
  policies: "Policy & Shifts",
  calendar: "Working Calendar",
  leave: "Leave Requests",
  announcements: "Announcements",
  enquiries: "Support Enquiries",
  displays: "Office QR Displays",
  security: "Security & Sessions",
  releases: "App Releases & OTA",
  "audit-logs": "Audit Trail",
  "design-system": "Design System Showcase",
  "three-d": "3D Floor View",
  unauthorized: "Unauthorized Access",
};

export const Topbar: React.FC<TopbarProps> = ({
  onOpenMobile,
  isSidebarCollapsed = false,
  onToggleSidebar,
}) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isConnected, isReconnecting } = useSocket();
  const { resolvedTheme, toggleTheme } = useTheme();

  const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  const { data: pendingLeaveData } = useLeaveRequests({ status: "PENDING", limit: 1 });
  const pendingLeaveCount = pendingLeaveData?.pagination?.total || 0;

  const { data: unreadAnnouncementsData } = useUnreadAnnouncementsCount();
  const unreadAnnouncementsCount = unreadAnnouncementsData?.unreadCount || 0;

  const { data: openEnquiriesData } = useEnquiries({ status: "OPEN", limit: 1 });
  const openEnquiriesCount = openEnquiriesData?.total || 0;

  const totalNotifications = pendingLeaveCount + unreadAnnouncementsCount + openEnquiriesCount;

  // Click outside listener for dropdowns
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) {
        setIsNotificationsOpen(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setIsNotificationsOpen(false);
        setIsProfileOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  const pathSegments = location.pathname.split("/").filter(Boolean);
  const currentTitle =
    pathSegments.length === 0
      ? routeNameMap[""]
      : routeNameMap[pathSegments[pathSegments.length - 1]] || pathSegments[pathSegments.length - 1];

  const formattedDate = new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date());

  return (
    <header className="h-16 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 px-3 sm:px-6 md:px-8 flex items-center justify-between gap-2 sm:gap-4 sticky top-0 z-30 shadow-xs transition-colors select-none">
      {/* Left: Mobile hamburger, Desktop sidebar toggle, & Breadcrumbs / Page Title */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Mobile Hamburger Drawer Trigger */}
        <button
          type="button"
          onClick={onOpenMobile}
          className="md:hidden p-2 text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label="Open mobile navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Desktop Sidebar Collapse Button */}
        {onToggleSidebar && (
          <button
            type="button"
            onClick={onToggleSidebar}
            className="hidden md:inline-flex p-2 text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            title={isSidebarCollapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
            aria-label={isSidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isSidebarCollapsed ? (
              <ChevronRightIcon className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        )}

        {/* Breadcrumb Navigation & Active Page Title */}
        <div className="flex flex-col min-w-0">
          <nav aria-label="Breadcrumb" className="hidden sm:flex items-center text-xs font-medium text-slate-500 dark:text-slate-400">
            <Link
              to="/"
              className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors"
            >
              Portal
            </Link>
            {pathSegments.length === 0 ? (
              <>
                <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 mx-1 shrink-0" />
                <span className="text-slate-800 dark:text-slate-200 font-semibold truncate" aria-current="page">
                  Executive Dashboard
                </span>
              </>
            ) : (
              pathSegments.map((segment, idx) => {
                const href = `/${pathSegments.slice(0, idx + 1).join("/")}`;
                const isLast = idx === pathSegments.length - 1;
                const title = routeNameMap[segment] || segment;

                return (
                  <React.Fragment key={href}>
                    <ChevronRight className="w-3.5 h-3.5 text-slate-400 dark:text-slate-600 mx-1 shrink-0" />
                    {isLast ? (
                      <span className="text-slate-800 dark:text-slate-200 font-semibold truncate" aria-current="page">
                        {title}
                      </span>
                    ) : (
                      <Link
                        to={href}
                        className="hover:text-blue-600 dark:hover:text-blue-400 transition-colors truncate"
                      >
                        {title}
                      </Link>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </nav>
          <h1 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100 tracking-tight truncate leading-tight">
            {currentTitle}
          </h1>
        </div>
      </div>

      {/* Center: Real Formatted Date Indicator */}
      <div className="hidden xl:flex items-center gap-1.5 px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700/60 text-xs font-medium text-slate-600 dark:text-slate-300 shrink-0">
        <Calendar className="w-3.5 h-3.5 text-blue-500" />
        <span>{formattedDate}</span>
      </div>

      {/* Right Controls: Real Socket Status, HR Presence, Notifications, Theme, Profile */}
      <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
        {/* Real-Time WebSocket Status Indicator */}
        <Tooltip
          content={
            isConnected
              ? "Live Socket Gateway connected: Streaming real-time attendance scans and approvals"
              : isReconnecting
                ? "Attempting reconnection to attendance socket cluster..."
                : "Real-time socket disconnected: Polling fallback active"
          }
        >
          <div
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border transition-colors select-none ${
              isConnected
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/50"
                : isReconnecting
                  ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/50"
                  : "bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700"
            }`}
          >
            {isConnected ? (
              <>
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                <span className="hidden sm:inline">Live Sync</span>
              </>
            ) : isReconnecting ? (
              <>
                <Wifi className="w-3.5 h-3.5 animate-spin text-amber-500" />
                <span className="hidden sm:inline">Reconnecting</span>
              </>
            ) : (
              <>
                <WifiOff className="w-3.5 h-3.5 text-slate-400" />
                <span className="hidden sm:inline">Offline</span>
              </>
            )}
          </div>
        </Tooltip>

        {/* HR Staff Online Presence Indicator */}
        <div className="hidden lg:block">
          <HROnlineIndicator variant="pill" />
        </div>

        {/* Notifications Popover */}
        <div className="relative" ref={notifRef}>
          <button
            type="button"
            onClick={() => {
              setIsNotificationsOpen(!isNotificationsOpen);
              setIsProfileOpen(false);
            }}
            className="relative p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            title={`Notifications (${totalNotifications} active)`}
            aria-label={`Open notifications menu, ${totalNotifications} active items`}
            aria-expanded={isNotificationsOpen}
          >
            <Bell className="w-4 h-4" />
            {totalNotifications > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-500 text-white font-bold text-[10px] shadow-xs">
                {totalNotifications > 9 ? "9+" : totalNotifications}
              </span>
            )}
          </button>

          {isNotificationsOpen && (
            <div
              role="region"
              aria-label="Active Notifications"
              className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/80 dark:bg-slate-800/50">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900 dark:text-slate-100">Notifications</h3>
                  {totalNotifications > 0 && (
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                      {totalNotifications} New
                    </span>
                  )}
                </div>
                <span className="text-xs text-slate-400">Live Feed</span>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800/80 max-h-80 overflow-y-auto">
                {pendingLeaveCount > 0 && (
                  <Link
                    to="/leave"
                    onClick={() => setIsNotificationsOpen(false)}
                    className="flex items-start gap-3 p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400 shrink-0">
                      <CalendarCheck className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {pendingLeaveCount} Pending Leave {pendingLeaveCount === 1 ? "Request" : "Requests"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Awaiting managerial review and approval.
                      </p>
                    </div>
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold shrink-0">
                      Review →
                    </span>
                  </Link>
                )}

                {openEnquiriesCount > 0 && (
                  <Link
                    to="/enquiries"
                    onClick={() => setIsNotificationsOpen(false)}
                    className="flex items-start gap-3 p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="p-2 rounded-xl bg-cyan-50 dark:bg-cyan-950/60 text-cyan-600 dark:text-cyan-400 shrink-0">
                      <LifeBuoy className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {openEnquiriesCount} Open Support {openEnquiriesCount === 1 ? "Ticket" : "Tickets"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Staff inquiries requiring HR attention.
                      </p>
                    </div>
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold shrink-0">
                      View →
                    </span>
                  </Link>
                )}

                {unreadAnnouncementsCount > 0 && (
                  <Link
                    to="/announcements"
                    onClick={() => setIsNotificationsOpen(false)}
                    className="flex items-start gap-3 p-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-600 dark:text-blue-400 shrink-0">
                      <Megaphone className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-900 dark:text-slate-100">
                        {unreadAnnouncementsCount} Unread {unreadAnnouncementsCount === 1 ? "Announcement" : "Announcements"}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        Company-wide updates and policy notices.
                      </p>
                    </div>
                    <span className="text-[11px] text-blue-600 dark:text-blue-400 font-semibold shrink-0">
                      Read →
                    </span>
                  </Link>
                )}

                {totalNotifications === 0 && (
                  <div className="p-6 text-center">
                    <div className="w-10 h-10 rounded-full bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto mb-2">
                      <CheckCircle2 className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">You're all caught up!</p>
                    <p className="text-[11px] text-slate-400 dark:text-slate-500 mt-0.5">
                      No pending requests, tickets, or unread updates.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Theme Switcher Toggle */}
        <Tooltip content={`Theme: ${resolvedTheme === "dark" ? "Dark (Click for Light)" : "Light (Click for Dark)"}`}>
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg border border-slate-200 dark:border-slate-700 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={`Toggle theme, current is ${resolvedTheme}`}
          >
            {resolvedTheme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-slate-600" />
            )}
          </button>
        </Tooltip>

        {/* Profile Dropdown Popover */}
        <div className="relative" ref={profileRef}>
          <button
            type="button"
            onClick={() => {
              setIsProfileOpen(!isProfileOpen);
              setIsNotificationsOpen(false);
            }}
            className="flex items-center gap-2 p-1 pl-1.5 pr-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            aria-label={`${user?.name || user?.employeeId || "User"} - Open user profile menu`}
            aria-expanded={isProfileOpen}
          >
            <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs">
              {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-3.5 h-3.5" />}
            </div>
            <div className="hidden sm:block text-left">
              <p className="text-xs font-semibold text-slate-800 dark:text-slate-100 leading-none truncate max-w-[110px]">
                {user?.name || user?.employeeId}
              </p>
              <span className="text-[10px] text-slate-400 font-mono leading-none">
                {user?.role}
              </span>
            </div>
          </button>

          {isProfileOpen && (
            <div
              role="region"
              aria-label="User Profile Menu"
              className="absolute right-0 mt-2 w-64 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-xl z-50 p-2 animate-in fade-in zoom-in-95 duration-150"
            >
              <div className="p-3 border-b border-slate-100 dark:border-slate-800">
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 truncate">
                  {user?.name || "Staff Member"}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{user?.email}</p>
                <div className="mt-2 flex items-center gap-1.5">
                  <Badge variant="info" size="sm" className="font-mono text-[10px]">
                    {user?.role}
                  </Badge>
                  <span className="text-[11px] text-slate-400 font-mono">
                    ID: {user?.employeeId || "—"}
                  </span>
                </div>
              </div>

              <div className="py-1">
                <Link
                  to="/security"
                  onClick={() => setIsProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Shield className="w-4 h-4 text-slate-400" />
                  <span>Security & Active Sessions</span>
                </Link>

                <Link
                  to="/design-system"
                  onClick={() => setIsProfileOpen(false)}
                  className="flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                >
                  <Palette className="w-4 h-4 text-indigo-400" />
                  <span>Design System Showcase</span>
                </Link>
              </div>

              <div className="pt-1 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => {
                    setIsProfileOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sign Out of Suite</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
