import React, { useState, useEffect, useCallback } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileNav } from "./MobileNav";
import { VersionUpdateBanner, CURRENT_WEB_VERSION } from "../ui/VersionUpdateBanner";

const SIDEBAR_STORAGE_KEY = "vorldx_sidebar_collapsed";

export const AppShell: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SIDEBAR_STORAGE_KEY) === "true";
    } catch {
      return false;
    }
  });

  const toggleSidebar = useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(SIDEBAR_STORAGE_KEY, String(next));
      } catch {
        // ignore storage errors
      }
      return next;
    });
  }, []);

  // Global keyboard shortcut: Ctrl+B / Cmd+B toggles sidebar collapse
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "b") {
        e.preventDefault();
        toggleSidebar();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [toggleSidebar]);

  return (
    <div className="flex h-screen w-full bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden transition-colors flex-col">
      <VersionUpdateBanner />
      <div className="flex flex-1 min-h-0 w-full overflow-hidden">
        {/* Desktop Collapsible Persistent Sidebar */}
        <div className="hidden md:flex h-full shrink-0">
          <Sidebar
            collapsed={sidebarCollapsed}
            onToggleCollapse={toggleSidebar}
          />
        </div>

        {/* Mobile Navigation Drawer */}
        <MobileNav isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

        {/* Main Content Column */}
        <div className="flex-1 flex flex-col min-w-0 w-full overflow-hidden">
          <Topbar
            onOpenMobile={() => setMobileOpen(true)}
            isSidebarCollapsed={sidebarCollapsed}
            onToggleSidebar={toggleSidebar}
          />

          <main
            id="main-content"
            className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-5 md:p-8 flex flex-col justify-between"
          >
            <div className="max-w-7xl mx-auto space-y-6 w-full min-w-0">
              <Outlet />
            </div>

            {/* Platform Web Footer */}
            <footer className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-800 text-xs text-slate-400 dark:text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 max-w-7xl mx-auto w-full px-2 text-center sm:text-left select-none">
              <span>© 2026 VorldX Workforce Management Suite. All rights reserved.</span>
              <div className="flex items-center gap-2 shrink-0">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span className="font-mono">Web Engine v{CURRENT_WEB_VERSION}</span>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
};
