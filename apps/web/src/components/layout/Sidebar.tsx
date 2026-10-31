import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarCheck,
  Calendar,
  BarChart3,
  Home,
  Users,
  Settings2,
  Tv,
  ShieldCheck,
  Lock,
  Megaphone,
  LifeBuoy,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Badge } from "../ui/Badge";
import { Tooltip } from "../ui/Tooltip";
import {
  useFeatureFlags,
  FeatureFlagsMap,
  useLeaveRequests,
  useUnreadAnnouncementsCount,
  useEnquiries,
} from "../../api/queries";

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
  flagKey?: keyof FeatureFlagsMap;
}

export interface NavGroup {
  groupName: string;
  items: NavItem[];
}

export const navGroups: NavGroup[] = [
  {
    groupName: "Overview & Analytics",
    items: [
      { name: "Executive Dashboard", href: "/", icon: LayoutDashboard },
      { name: "Attendance Ledger", href: "/attendance", icon: CalendarCheck },
      { name: "Working Calendar", href: "/calendar", icon: Calendar },
      { name: "Reports & Analytics", href: "/reports", icon: BarChart3 },
    ],
  },
  {
    groupName: "Workforce Operations",
    items: [
      { name: "Leave Requests", href: "/leave", icon: CalendarCheck },
      { name: "WFH Approvals", href: "/wfh", icon: Home },
      { name: "Support Enquiries", href: "/enquiries", icon: LifeBuoy },
      { name: "Announcements", href: "/announcements", icon: Megaphone },
      { name: "Employee Directory", href: "/employees", icon: Users },
    ],
  },
  {
    groupName: "System & Administration",
    items: [
      { name: "Policy & Shifts", href: "/policies", icon: Settings2 },
      { name: "Office QR Displays", href: "/displays", icon: Tv },
      { name: "Security & Sessions", href: "/security", icon: Lock },
      { name: "Audit Trail", href: "/audit-logs", icon: ShieldCheck },
    ],
  },
];

interface SidebarProps {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onCloseMobile?: () => void;
  isMobileDrawer?: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  collapsed = false,
  onToggleCollapse,
  onCloseMobile,
  isMobileDrawer = false,
}) => {
  const { user } = useAuth();
  const { data: flagData } = useFeatureFlags();
  const flags = flagData?.data;

  const { data: pendingLeaveData } = useLeaveRequests({ status: "PENDING", limit: 1 });
  const pendingLeaveCount = pendingLeaveData?.pagination?.total || 0;

  const { data: unreadAnnouncementsData } = useUnreadAnnouncementsCount();
  const unreadAnnouncementsCount = unreadAnnouncementsData?.unreadCount || 0;

  const { data: openEnquiriesData } = useEnquiries({ status: "OPEN", limit: 1 });
  const openEnquiriesCount = openEnquiriesData?.total || 0;

  const getBadgeCount = (href: string): number => {
    if (href === "/leave") return pendingLeaveCount;
    if (href === "/enquiries") return openEnquiriesCount;
    if (href === "/announcements") return unreadAnnouncementsCount;
    return 0;
  };

  const getBadgeColor = (href: string): string => {
    if (href === "/leave") return "bg-amber-400 text-slate-950";
    if (href === "/enquiries") return "bg-cyan-400 text-slate-950";
    if (href === "/announcements") return "bg-blue-400 text-white";
    return "bg-slate-700 text-white";
  };

  return (
    <aside
      className={`flex flex-col h-full bg-slate-900 text-slate-300 border-r border-slate-800 shrink-0 select-none transition-all duration-200 ease-in-out ${
        collapsed ? "w-20" : "w-64"
      }`}
      aria-label="Sidebar Navigation"
    >
      {/* Brand Header */}
      <div
        className={`flex items-center border-b border-slate-800 transition-all duration-200 ${
          collapsed ? "justify-center p-4" : "justify-between px-5 py-4"
        }`}
      >
        <div className="flex items-center gap-3 min-w-0">
          <img
            src="/splash-icon.png"
            alt="VorldX"
            className="w-10 h-10 object-contain shrink-0 drop-shadow-md select-none"
          />
          {!collapsed && (
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-base font-extrabold tracking-wider text-white uppercase block leading-none">
                  Vorld<span className="text-blue-600">X</span>
                </span>
              </div>
              <span className="text-[10px] text-slate-400 tracking-wider uppercase font-medium mt-1 block truncate">
                Workforce Suite
              </span>
            </div>
          )}
        </div>

        {/* Collapse Toggle (Desktop only) */}
        {!isMobileDrawer && onToggleCollapse && (
          <button
            type="button"
            onClick={onToggleCollapse}
            className={`p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
              collapsed ? "hidden md:inline-flex mt-2" : "hidden md:inline-flex"
            }`}
            title={collapsed ? "Expand sidebar (Ctrl+B)" : "Collapse sidebar (Ctrl+B)"}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
          </button>
        )}
      </div>

      {/* Grouped Navigation Links */}
      <nav
        className="flex-1 px-3 py-4 space-y-6 overflow-y-auto overflow-x-hidden custom-scrollbar"
        role="navigation"
        aria-label="Main Navigation"
      >
        {navGroups.map((group) => {
          const visibleItems = group.items.filter((item) => {
            if (item.flagKey && (!flags || !flags[item.flagKey])) {
              return false;
            }
            if (item.roles && user?.role && !item.roles.includes(user.role)) {
              return false;
            }
            return true;
          });

          if (visibleItems.length === 0) return null;

          return (
            <div key={group.groupName} className="space-y-1">
              {!collapsed ? (
                <div className="px-3 pb-1 text-[11px] font-bold text-slate-400 dark:text-slate-400 uppercase tracking-wider">
                  {group.groupName}
                </div>
              ) : (
                <div className="my-2 border-t border-slate-800/80 mx-2" title={group.groupName}>
                  <span className="sr-only">{group.groupName}</span>
                </div>
              )}

              {visibleItems.map((item) => {
                const Icon = item.icon;
                const badgeCount = getBadgeCount(item.href);
                const badgeColor = getBadgeColor(item.href);

                const linkElement = (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    end={item.href === "/"}
                    onClick={onCloseMobile}
                    className={({ isActive }) =>
                      `relative group flex items-center transition-all duration-150 select-none ${
                        collapsed
                          ? "justify-center w-11 h-11 mx-auto rounded-xl"
                          : "gap-3 px-3 py-2.5 rounded-xl text-sm font-medium"
                      } ${
                        isActive
                          ? "bg-blue-600 text-white font-semibold shadow-xs shadow-blue-500/25"
                          : "text-slate-400 hover:text-slate-100 hover:bg-slate-800/60"
                      }`
                    }
                  >
                    {({ isActive }) => (
                      <>
                        {/* Active left indicator pill for expanded mode */}
                        {isActive && !collapsed && (
                          <span
                            className="absolute left-0 top-2 bottom-2 w-1 bg-cyan-400 rounded-r-full shadow-xs"
                            aria-hidden="true"
                          />
                        )}

                        <div className="relative shrink-0 flex items-center justify-center">
                          <Icon className="w-4 h-4 shrink-0 transition-transform duration-150 group-hover:scale-105" />
                          {collapsed && badgeCount > 0 && (
                            <span
                              className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-cyan-400 text-slate-950 font-bold text-[9px] shadow-xs"
                              aria-label={`${badgeCount} unread`}
                            >
                              {badgeCount > 9 ? "9+" : badgeCount}
                            </span>
                          )}
                        </div>

                        {!collapsed && (
                          <>
                            <span className="truncate flex-1">{item.name}</span>
                            {badgeCount > 0 && (
                              <span
                                className={`px-2 py-0.5 text-[11px] font-bold rounded-full shadow-xs shrink-0 ${badgeColor}`}
                              >
                                {badgeCount}
                              </span>
                            )}
                          </>
                        )}
                      </>
                    )}
                  </NavLink>
                );

                if (collapsed) {
                  return (
                    <Tooltip
                      key={item.name}
                      content={
                        badgeCount > 0
                          ? `${item.name} (${badgeCount} active)`
                          : item.name
                      }
                      position="right"
                      className="w-full flex justify-center"
                    >
                      {linkElement}
                    </Tooltip>
                  );
                }

                return linkElement;
              })}
            </div>
          );
        })}
      </nav>

      {/* User Footer & Session Info */}
      <div className={`border-t border-slate-800 bg-slate-950/40 ${collapsed ? "p-3" : "p-4"}`}>
        {!collapsed ? (
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-white truncate">
                {user?.name || user?.employeeId}
              </p>
              <p className="text-xs text-slate-400 truncate">{user?.email}</p>
            </div>
            <Badge variant="info" size="sm" className="shrink-0 uppercase font-mono text-[10px]">
              {user?.role}
            </Badge>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <Tooltip content={`${user?.name || user?.email} (${user?.role})`} position="right">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs border border-blue-400/30">
                {user?.name ? user.name.charAt(0).toUpperCase() : "U"}
              </div>
            </Tooltip>
          </div>
        )}
      </div>
    </aside>
  );
};
