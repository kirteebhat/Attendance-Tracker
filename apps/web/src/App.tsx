import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ThemeProvider } from "./context/ThemeContext";
import { AuthProvider } from "./context/AuthContext";
import { SocketProvider } from "./context/SocketContext";
import { ToastProvider } from "./components/ui/Toast";
import { ProtectedRoute } from "./routes/ProtectedRoute";
import { RoleGuard } from "./routes/RoleGuard";
import { AppShell } from "./components/layout/AppShell";
import { LoginPage } from "./pages/LoginPage";
import { DashboardPage } from "./pages/DashboardPage";
import { AttendanceLedgerPage } from "./pages/AttendanceLedgerPage";
import { ReportsPage } from "./pages/ReportsPage";
import { WfhPage } from "./pages/WfhPage";
import { EmployeesPage } from "./pages/EmployeesPage";
import { PoliciesPage } from "./pages/PoliciesPage";
import { DisplaysPage } from "./pages/DisplaysPage";
import { AuditLogsPage } from "./pages/AuditLogsPage";
import { SecurityPage } from "./pages/SecurityPage";
import { CalendarPage } from "./pages/CalendarPage";
import { DesignSystemPage } from "./pages/DesignSystemPage";
import { UnauthorizedPage } from "./pages/UnauthorizedPage";
import { NotFoundPage } from "./pages/NotFoundPage";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
          <SocketProvider>
            <BrowserRouter>
              <Routes>
                {/* Public Authentication Route */}
                <Route path="/login" element={<LoginPage />} />

                {/* Protected Administrative Application Shell */}
                <Route element={<ProtectedRoute />}>
                  <Route element={<AppShell />}>
                    {/* Role-Guarded HR & Admin Routes */}
                    <Route element={<RoleGuard allowedRoles={["HR", "ADMIN", "HR_ADMIN"]} />}>
                      <Route path="/" element={<DashboardPage />} />
                      <Route path="/dashboard" element={<Navigate to="/" replace />} />
                      <Route path="/attendance" element={<AttendanceLedgerPage />} />
                      <Route path="/reports" element={<ReportsPage />} />
                      <Route path="/wfh" element={<WfhPage />} />
                      <Route path="/employees" element={<EmployeesPage />} />
                      <Route path="/policies" element={<PoliciesPage />} />
                      <Route path="/calendar" element={<CalendarPage />} />
                      <Route path="/displays" element={<DisplaysPage />} />
                      <Route path="/audit-logs" element={<AuditLogsPage />} />
                      <Route path="/security" element={<SecurityPage />} />
                      <Route path="/settings/security" element={<Navigate to="/security" replace />} />
                      <Route path="/design-system" element={<DesignSystemPage />} />
                    </Route>

                    {/* Common Protected Fallbacks */}
                    <Route path="/unauthorized" element={<UnauthorizedPage />} />
                    <Route path="*" element={<NotFoundPage />} />
                  </Route>
                </Route>
              </Routes>
            </BrowserRouter>
          </SocketProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  </QueryClientProvider>
  );
};

export default App;

