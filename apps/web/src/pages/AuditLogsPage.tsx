import React, { useState } from "react";
import {
  Search,
  RotateCw,
  Eye,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Code2,
  Columns,
} from "lucide-react";
import { useAuditLogs, AuditLogItem, AuditLogFilters } from "../api/queries";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";

export const AuditLogsPage: React.FC = () => {
  const [filters, setFilters] = useState<AuditLogFilters>({
    page: 1,
    limit: 10,
    entityType: "",
    action: "",
    search: "",
    startDate: "",
    endDate: "",
  });

  const [searchInput, setSearchInput] = useState("");
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [diffViewMode, setDiffViewMode] = useState<"structured" | "json">("structured");

  const { data: auditData, isLoading, isFetching, refetch } = useAuditLogs(filters);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFilters((prev) => ({ ...prev, search: searchInput.trim(), page: 1 }));
  };

  const handleResetFilters = () => {
    setSearchInput("");
    setFilters({
      page: 1,
      limit: 10,
      entityType: "",
      action: "",
      search: "",
      startDate: "",
      endDate: "",
    });
  };

  const pagination = auditData?.pagination;
  const logs = auditData?.data || [];
  const isFiltered = Boolean(
    filters.search || filters.entityType || filters.action || filters.startDate || filters.endDate
  );

  // Compute key-by-key delta for structured diff view
  const getStructuredDiff = (prev: unknown, next: unknown) => {
    const prevObj = typeof prev === "object" && prev !== null ? (prev as Record<string, unknown>) : {};
    const nextObj = typeof next === "object" && next !== null ? (next as Record<string, unknown>) : {};

    const allKeys = Array.from(new Set([...Object.keys(prevObj), ...Object.keys(nextObj)]));
    return allKeys.map((key) => {
      const prevVal = prevObj[key];
      const nextVal = nextObj[key];
      const hasChanged = JSON.stringify(prevVal) !== JSON.stringify(nextVal);
      return {
        key,
        prevVal: prevVal !== undefined ? JSON.stringify(prevVal) : "—",
        nextVal: nextVal !== undefined ? JSON.stringify(nextVal) : "—",
        hasChanged,
      };
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Security & Audit Trail
            </h1>
            {pagination && (
              <Badge variant="primary" className="text-xs font-semibold px-2.5 py-0.5">
                {pagination.total} Log Entries
              </Badge>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Immutable organizational forensic audit log tracking administrative modifications, decisions, and state diffs
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isFetching}
            className="flex items-center gap-1.5 text-xs font-semibold"
            title="Refresh audit logs"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isFetching ? "animate-spin text-blue-600" : ""}`} />
            <span>Refresh</span>
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <Card className="p-4 space-y-3 bg-white border border-slate-200 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          {/* Search by Actor / Reason */}
          <form onSubmit={handleSearchSubmit} className="relative sm:col-span-2">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              id="audit-search-input"
              placeholder="Search actor ID, reason..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-9 pr-16 py-2 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600 focus:bg-white"
            />
            <Button
              type="submit"
              variant="outline"
              size="sm"
              className="absolute right-1 top-1/2 -translate-y-1/2 h-6 text-[11px] px-2"
            >
              Search
            </Button>
          </form>

          {/* Entity Type Filter */}
          <div>
            <select
              id="audit-entity-filter"
              value={filters.entityType || ""}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, entityType: e.target.value, page: 1 }))
              }
              className="w-full px-2.5 py-2 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">All Entities</option>
              <option value="ATTENDANCE_RECORD">ATTENDANCE_RECORD</option>
              <option value="EMPLOYEE">EMPLOYEE</option>
              <option value="POLICY">POLICY</option>
              <option value="WFH_REQUEST">WFH_REQUEST</option>
              <option value="TERMINAL">TERMINAL</option>
              <option value="USER">USER</option>
            </select>
          </div>

          {/* Action Filter */}
          <div>
            <select
              id="audit-action-filter"
              value={filters.action || ""}
              onChange={(e) =>
                setFilters((prev) => ({ ...prev, action: e.target.value, page: 1 }))
              }
              className="w-full px-2.5 py-2 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
            >
              <option value="">All Actions</option>
              <option value="CORRECTION">CORRECTION</option>
              <option value="CREATE">CREATE</option>
              <option value="UPDATE">UPDATE</option>
              <option value="STATUS_UPDATE">STATUS_UPDATE</option>
              <option value="APPROVE">APPROVE</option>
              <option value="REJECT">REJECT</option>
              <option value="CANCEL">CANCEL</option>
              <option value="LOGIN">LOGIN</option>
            </select>
          </div>

          {/* Date Filter Input */}
          <div>
            <input
              type="date"
              id="audit-date-filter"
              value={filters.startDate || ""}
              onChange={(e) =>
                setFilters((prev) => ({
                  ...prev,
                  startDate: e.target.value,
                  endDate: e.target.value,
                  page: 1,
                }))
              }
              className="w-full px-2.5 py-1.5 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600"
              title="Filter by specific date"
            />
          </div>
        </div>

        {isFiltered && (
          <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
            <span className="text-slate-500 font-medium">Filtered view active</span>
            <button
              type="button"
              id="reset-audit-filters-btn"
              onClick={handleResetFilters}
              className="text-blue-600 hover:text-blue-800 font-semibold"
            >
              Reset all filters
            </button>
          </div>
        )}
      </Card>

      {/* Audit Table */}
      <Card className="border border-slate-200 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse" role="table">
            <thead>
              <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider select-none">
                <th className="px-5 py-3">Timestamp</th>
                <th className="px-4 py-3">Action</th>
                <th className="px-4 py-3">Entity Type</th>
                <th className="px-4 py-3">Actor / Employee</th>
                <th className="px-5 py-3">Reason / Description</th>
                <th className="px-4 py-3 text-right">Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {isLoading ? (
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-5 py-4">
                      <Skeleton className="h-4 w-28" />
                    </td>
                    <td className="px-4 py-4">
                      <Skeleton className="h-5 w-20 rounded-full" />
                    </td>
                    <td className="px-4 py-4">
                      <Skeleton className="h-4 w-24" />
                    </td>
                    <td className="px-4 py-4">
                      <Skeleton className="h-4 w-20" />
                    </td>
                    <td className="px-5 py-4">
                      <Skeleton className="h-4 w-48" />
                    </td>
                    <td className="px-4 py-4 text-right">
                      <Skeleton className="h-8 w-16 ml-auto rounded-lg" />
                    </td>
                  </tr>
                ))
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <EmptyState
                      icon={<ShieldCheck className="w-6 h-6 text-slate-400" />}
                      title="No Audit Entries Found"
                      description={
                        isFiltered
                          ? "Try clearing your filters to view organizational audit trail."
                          : "Audit events record automatically when modifications occur."
                      }
                      action={
                        isFiltered ? (
                          <Button variant="outline" size="sm" onClick={handleResetFilters}>
                            Clear Filters
                          </Button>
                        ) : undefined
                      }
                    />
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log._id} className="hover:bg-slate-50/70 transition-colors">
                    <td className="px-5 py-3.5 font-mono text-slate-700 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5">
                      <Badge
                        variant={
                          log.action === "CORRECTION"
                            ? "primary"
                            : log.action === "CREATE"
                            ? "success"
                            : log.action === "STATUS_UPDATE" || log.action === "DEACTIVATE"
                            ? "warning"
                            : log.action === "REJECT"
                            ? "danger"
                            : "neutral"
                        }
                      >
                        {log.action}
                      </Badge>
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-800 font-semibold text-[11px]">
                      {log.entityType}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-slate-700 font-medium">
                      {log.performedByEmployeeId || "System"}
                    </td>
                    <td className="px-5 py-3.5 text-slate-700 max-w-md truncate" title={log.reason}>
                      {log.reason || "—"}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Button
                        type="button"
                        id={`view-diff-btn-${log._id}`}
                        variant="outline"
                        size="sm"
                        onClick={() => setSelectedLog(log)}
                        className="h-7 text-[11px] px-2 text-slate-600 hover:text-blue-600 gap-1 font-medium"
                        title="View Audit Diff"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        <span>Diff</span>
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Bar */}
        {pagination && pagination.totalPages > 0 && (
          <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600 select-none">
            <span className="text-slate-500">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{" "}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total}{" "}
              audit records
            </span>

            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pagination.page <= 1}
                onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) - 1 }))}
                className="h-7 px-2.5 text-xs"
              >
                <ChevronLeft className="w-3.5 h-3.5 mr-0.5" />
                Previous
              </Button>
              <span className="px-2 font-semibold text-slate-800">
                Page {pagination.page} of {pagination.totalPages}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={pagination.page >= pagination.totalPages}
                onClick={() => setFilters((prev) => ({ ...prev, page: (prev.page || 1) + 1 }))}
                className="h-7 px-2.5 text-xs"
              >
                Next
                <ChevronRight className="w-3.5 h-3.5 ml-0.5" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Modal: Audit Event Before/After Diff */}
      <Modal
        isOpen={Boolean(selectedLog)}
        onClose={() => setSelectedLog(null)}
        title="Audit Event State Delta"
        description={`Action: ${selectedLog?.action} • Entity: ${selectedLog?.entityType}`}
        maxWidth="lg"
      >
        {selectedLog && (
          <div className="space-y-4 text-xs">
            {/* Metadata Bar */}
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 grid grid-cols-2 gap-2">
              <div>
                <span className="text-slate-500 block text-[11px] font-semibold">Actor</span>
                <span className="font-mono font-bold text-slate-800">
                  {selectedLog.performedByEmployeeId || "System Admin"}
                </span>
              </div>
              <div>
                <span className="text-slate-500 block text-[11px] font-semibold">Timestamp</span>
                <span className="font-mono text-slate-800">
                  {new Date(selectedLog.timestamp).toLocaleString()}
                </span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500 block text-[11px] font-semibold">
                  Justification Reason
                </span>
                <span className="text-slate-800 italic">{selectedLog.reason || "None recorded"}</span>
              </div>
            </div>

            {/* Toggle View: Structured vs Raw JSON */}
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <span className="font-bold text-slate-800 text-xs">State Change Comparison</span>
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-[11px]">
                <button
                  type="button"
                  onClick={() => setDiffViewMode("structured")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                    diffViewMode === "structured"
                      ? "bg-white font-semibold text-blue-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Columns className="w-3 h-3" />
                  <span>Key Comparison</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDiffViewMode("json")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md transition-colors ${
                    diffViewMode === "json"
                      ? "bg-white font-semibold text-blue-600 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Code2 className="w-3 h-3" />
                  <span>Raw JSON</span>
                </button>
              </div>
            </div>

            {/* View 1: Structured Key-by-Key Comparison */}
            {diffViewMode === "structured" ? (
              <div className="border border-slate-200 rounded-lg overflow-hidden">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-200 font-semibold text-slate-700">
                      <th className="py-2 px-3">Field</th>
                      <th className="py-2 px-3">Previous State</th>
                      <th className="py-2 px-3">New State</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-mono text-[11px]">
                    {getStructuredDiff(selectedLog.previousValue, selectedLog.newValue).map(
                      (row) => (
                        <tr
                          key={row.key}
                          className={
                            row.hasChanged ? "bg-amber-50/50 hover:bg-amber-50" : "hover:bg-slate-50"
                          }
                        >
                          <td className="py-2 px-3 font-semibold text-slate-800 font-sans">
                            {row.key}
                          </td>
                          <td className="py-2 px-3 text-slate-600 max-w-xs truncate">
                            {row.prevVal}
                          </td>
                          <td className="py-2 px-3 max-w-xs truncate">
                            <span
                              className={
                                row.hasChanged
                                  ? "bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold"
                                  : "text-slate-800"
                              }
                            >
                              {row.nextVal}
                            </span>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              /* View 2: Raw JSON Pre-formatted Block */
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <span className="font-semibold text-slate-700 block mb-1">Previous State</span>
                  <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg overflow-x-auto text-[11px] max-h-56">
                    {JSON.stringify(selectedLog.previousValue, null, 2) || "null"}
                  </pre>
                </div>

                <div>
                  <span className="font-semibold text-slate-700 block mb-1">New State</span>
                  <pre className="p-3 bg-slate-900 text-slate-200 rounded-lg overflow-x-auto text-[11px] max-h-56">
                    {JSON.stringify(selectedLog.newValue, null, 2) || "null"}
                  </pre>
                </div>
              </div>
            )}

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <Button type="button" variant="outline" size="sm" onClick={() => setSelectedLog(null)}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
