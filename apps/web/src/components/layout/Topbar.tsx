import React from "react";
import { useLocation, Link } from "react-router-dom";
import { Menu, ChevronRight, Wifi, WifiOff, LogOut, User } from "lucide-react";
import { useAuth } from "../../context/AuthContext";
import { useSocket } from "../../context/SocketContext";
import { Badge } from "../ui/Badge";

interface TopbarProps {
  onOpenMobile: () => void;
}

const routeNameMap: Record<string, string> = {
  "": "Dashboard",
  attendance: "Attendance Ledger",
  wfh: "WFH Approvals",
  employees: "Employee Directory",
  policies: "Policy & Shifts",
  displays: "Office QR Displays",
  "audit-logs": "Audit Trail",
};

export const Topbar: React.FC<TopbarProps> = ({ onOpenMobile }) => {
  const location = useLocation();
  const { user, logout } = useAuth();
  const { isConnected, isReconnecting } = useSocket();

  const pathSegments = location.pathname.split("/").filter(Boolean);

  return (
    <header className="h-16 bg-white border-b border-slate-200 px-4 md:px-8 flex items-center justify-between gap-4 sticky top-0 z-30 shadow-xs">
      {/* Left: Mobile hamburger & Breadcrumbs */}
      <div className="flex items-center gap-3">
        <button
          onClick={onOpenMobile}
          className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          aria-label="Open navigation menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center text-sm font-medium">
          <Link to="/" className="text-slate-500 hover:text-blue-600 transition-colors">
            Portal
          </Link>
          {pathSegments.length === 0 ? (
            <>
              <ChevronRight className="w-4 h-4 text-slate-400 mx-1.5" />
              <span className="text-slate-900 font-semibold">Executive Dashboard</span>
            </>
          ) : (
            pathSegments.map((segment, idx) => {
              const href = `/${pathSegments.slice(0, idx + 1).join("/")}`;
              const isLast = idx === pathSegments.length - 1;
              const title = routeNameMap[segment] || segment;

              return (
                <React.Fragment key={href}>
                  <ChevronRight className="w-4 h-4 text-slate-400 mx-1.5" />
                  {isLast ? (
                    <span className="text-slate-900 font-semibold">{title}</span>
                  ) : (
                    <Link
                      to={href}
                      className="text-slate-500 hover:text-blue-600 transition-colors"
                    >
                      {title}
                    </Link>
                  )}
                </React.Fragment>
              );
            })
          )}
        </nav>
      </div>

      {/* Right: Socket Status & User Controls */}
      <div className="flex items-center gap-3">
        {/* Real-Time WebSocket Status Badge */}
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${
            isConnected
              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
              : isReconnecting
                ? "bg-amber-50 text-amber-700 border-amber-200 animate-pulse"
                : "bg-slate-100 text-slate-600 border-slate-200"
          }`}
          title={
            isConnected
              ? "Connected to live Socket.IO gateway"
              : isReconnecting
                ? "Attempting reconnection..."
                : "Socket gateway offline"
          }
        >
          {isConnected ? (
            <>
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="hidden sm:inline">Live Sync</span>
            </>
          ) : isReconnecting ? (
            <>
              <Wifi className="w-3.5 h-3.5 animate-spin text-amber-600" />
              <span className="hidden sm:inline">Reconnecting</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-slate-400" />
              <span className="hidden sm:inline">Offline</span>
            </>
          )}
        </div>

        {/* User Pill */}
        <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200">
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-semibold text-xs border border-blue-200">
            {user?.name ? user.name.charAt(0).toUpperCase() : <User className="w-4 h-4" />}
          </div>
          <div className="text-left text-xs">
            <p className="font-semibold text-slate-800 leading-tight truncate max-w-[120px]">
              {user?.name || user?.employeeId}
            </p>
            <Badge variant="info" size="sm" className="mt-0.5 text-[10px]">
              {user?.role}
            </Badge>
          </div>
        </div>

        {/* Logout Quick Action */}
        <button
          onClick={() => logout()}
          className="p-2 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors border border-transparent hover:border-rose-200"
          title="Sign Out"
          aria-label="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
