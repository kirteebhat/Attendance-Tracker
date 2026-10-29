import React, { useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { MobileNav } from "./MobileNav";
import { VersionUpdateBanner, CURRENT_WEB_VERSION } from "../ui/VersionUpdateBanner";

export const AppShell: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState<boolean>(false);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden transition-colors flex-col">
      <VersionUpdateBanner />
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Desktop Persistent Sidebar */}
        <div className="hidden md:flex h-full">
          <Sidebar />
        </div>

        {/* Mobile Drawer */}
        <MobileNav isOpen={mobileOpen} onClose={() => setMobileOpen(false)} />

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Topbar onOpenMobile={() => setMobileOpen(true)} />
          <main className="flex-1 overflow-y-auto p-4 md:p-8 flex flex-col justify-between">
            <div className="max-w-7xl mx-auto space-y-6 w-full">
              <Outlet />
            </div>

            {/* Platform Web Footer */}
            <footer className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 dark:text-slate-500 flex items-center justify-between max-w-7xl mx-auto w-full px-2">
              <span>© 2026 VorldX Workforce Management Suite. All rights reserved.</span>
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Web Version v{CURRENT_WEB_VERSION}</span>
              </div>
            </footer>
          </main>
        </div>
      </div>
    </div>
  );
};
