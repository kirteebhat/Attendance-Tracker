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
  LogOut,
  Building2,
  Lock,
} from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { Badge } from "../ui/Badge";
import { useFeatureFlags, FeatureFlagsMap, useLeaveRequests } from "../../api/queries";

interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: string[];
  flagKey?: keyof FeatureFlagsMap;
}

const navigation: NavItem[] = [
  { name: "Executive Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Attendance Ledger", href: "/attendance", icon: CalendarCheck },
  { name: "Reports & Analytics", href: "/reports", icon: BarChart3 },
  { name: "WFH Approvals", href: "/wfh", icon: Home },
  { name: "Employee Directory", href: "/employees", icon: Users },
  { name: "Policy & Shifts", href: "/policies", icon: Settings2 },
  { name: "Working Calendar", href: "/calendar", icon: Calendar },
  { name: "Office QR Displays", href: "/displays", icon: Tv },
  { name: "Security & Sessions", href: "/security", icon: Lock },
  { name: "Audit Trail", href: "/audit-logs", icon: ShieldCheck },
  // Extension Modules (hidden in UI when flag is off)
  { name: "Leave Requests", href: "/leave", icon: CalendarCheck, flagKey: "leave" },
  { name: "Announcements", href: "/announcements", icon: LayoutDashboard, flagKey: "announcements" },
  { name: "Enquiries & Helpdesk", href: "/enquiries", icon: Users, flagKey: "enquiries" },
  { name: "3D Floor View", href: "/three-d", icon: Tv, flagKey: "threeD" },
];

export const Sidebar: React.FC<{ onCloseMobile?: () => void }> = ({ onCloseMobile }) => {
  const { user, logout } = useAuth();
  const { data: flagData } = useFeatureFlags();
  const flags = flagData?.data;

  const isLeaveEnabled = Boolean(flags?.leave);
  const { data: pendingLeaveData } = useLeaveRequests(
    isLeaveEnabled ? { status: "PENDING", limit: 1 } : undefined
  );
  const pendingLeaveCount = pendingLeaveData?.pagination?.total || 0;

  const visibleNav = navigation.filter((item) => {
    if (item.flagKey && (!flags || !flags[item.flagKey])) {
      return false;
    }
    if (item.roles && user?.role && !item.roles.includes(user.role)) {
      return false;
    }
    return true;
  });

  return (
    <aside className="flex flex-col h-full bg-slate-900 text-slate-300 w-64 border-r border-slate-800 shrink-0 select-none">
      {/* Brand Header */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-800">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-400 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
          <Building2 className="w-5 h-5 text-white" />
        </div>
        <div>
          <span className="text-base font-bold tracking-wider text-white uppercase block leading-none">
            Vorld<span className="text-cyan-400">X</span>
          </span>
          <span className="text-[10px] text-slate-400 tracking-wider uppercase font-medium mt-1 block">
            Workforce Suite
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        <div className="px-3 pb-2 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
          Management
        </div>
        {visibleNav.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.name}
              to={item.href}
              end={item.href === "/"}
              onClick={onCloseMobile}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-blue-600 text-white shadow-sm shadow-blue-600/30"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                }`
              }
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="truncate">{item.name}</span>
              {item.href === "/leave" && pendingLeaveCount > 0 && (
                <span className="ml-auto px-2 py-0.5 text-[11px] font-bold rounded-full bg-amber-500 text-slate-950 shadow-xs">
                  {pendingLeaveCount}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* User Footer & Session Info */}
      <div className="p-4 border-t border-slate-800 bg-slate-950/40">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white truncate">
              {user?.name || user?.employeeId}
            </p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
          <Badge variant="info" size="sm" className="shrink-0 uppercase font-mono">
            {user?.role}
          </Badge>
        </div>
        <button
          onClick={() => logout()}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-medium text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors border border-slate-800"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </aside>
  );
};
