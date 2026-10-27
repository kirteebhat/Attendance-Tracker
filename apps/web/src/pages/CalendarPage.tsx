import React, { useState, useEffect } from "react";
import {
  Calendar as CalendarIcon,
  Download,
  UploadCloud,
  Plus,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Sparkles,
  CalendarCheck,
  Building,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  useCalendarEvents,
  useDayType,
  useWorkingDaysCount,
  usePreviewHolidayImport,
  useImportHolidays,
  useDeleteCalendarEvent,
  CalendarEventItem,
} from "../api/queries";
import { getFullApiUrl, api } from "../api/client";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../components/ui/Toast";
import { useQueryClient } from "@tanstack/react-query";
import { Card } from "../components/ui/Card";
import { Button } from "../components/ui/Button";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { Input } from "../components/ui/Input";
import { Skeleton } from "../components/ui/Skeleton";
import { EmptyState } from "../components/ui/EmptyState";

export const CalendarPage: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [activeTab, setActiveTab] = useState<"all" | "holiday" | "companyOffDay" | "event">("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Tools state
  const todayStr = new Date().toISOString().split("T")[0];
  const [inspectDate, setInspectDate] = useState<string>(todayStr);
  const [calcStart, setCalcStart] = useState<string>(`${selectedYear}-01-01`);
  const [calcEnd, setCalcEnd] = useState<string>(`${selectedYear}-01-31`);

  // Modals state
  const [showImportModal, setShowImportModal] = useState(false);
  const [importCountry, setImportCountry] = useState("IN");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    title: "",
    type: "holiday" as "holiday" | "companyOffDay" | "meeting" | "event",
    startDate: todayStr,
    endDate: todayStr,
    description: "",
  });

  const { toast } = useToast();
  const { socket } = useSocket();
  const queryClient = useQueryClient();

  // Queries
  const { data: eventsData, isLoading, refetch } = useCalendarEvents(selectedYear);
  const { data: dayTypeData, isLoading: isDayTypeLoading } = useDayType(inspectDate);
  const { data: workingDaysData, isLoading: isWorkingDaysLoading } = useWorkingDaysCount(
    calcStart,
    calcEnd
  );

  // Import Preview Query & Mutation
  const { data: previewData, isLoading: isPreviewLoading, refetch: refetchPreview } =
    usePreviewHolidayImport(selectedYear, importCountry, showImportModal);
  const importMutation = useImportHolidays();
  const deleteMutation = useDeleteCalendarEvent();

  // Real-time socket sync
  useEffect(() => {
    if (!socket) return;
    const handleCalendarUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-day-type"] });
      queryClient.invalidateQueries({ queryKey: ["calendar-working-days"] });
      toast({
        title: "Calendar Synchronized",
        description: "Calendar events updated via live real-time broadcast.",
        type: "info",
      });
    };

    socket.on("calendar.updated", handleCalendarUpdated);
    return () => {
      socket.off("calendar.updated", handleCalendarUpdated);
    };
  }, [socket, queryClient, toast]);

  const events: CalendarEventItem[] = eventsData?.data || [];

  const filteredEvents = events.filter((evt) => {
    if (activeTab !== "all" && evt.type !== activeTab) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return evt.title.toLowerCase().includes(q) || (evt.description && evt.description.toLowerCase().includes(q));
    }
    return true;
  });

  const handleExportIcs = () => {
    const url = getFullApiUrl(`/api/calendar/export.ics?year=${selectedYear}`);
    window.open(url, "_blank");
    toast({
      title: "Calendar Export Initiated",
      description: `Downloading RFC 5545 iCalendar stream for year ${selectedYear}.`,
      type: "success",
    });
  };

  const handleExecuteImport = async () => {
    try {
      const res = await importMutation.mutateAsync({ year: selectedYear, country: importCountry });
      toast({
        title: "Holidays Imported Successfully",
        description: `Imported ${res.importedCount} public holidays (${res.skippedCount} manual conflicts preserved).`,
        type: "success",
      });
      setShowImportModal(false);
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to import holidays";
      toast({ title: "Import Failed", description: msg, type: "error" });
    }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!confirm(`Are you sure you want to remove '${title}' from the calendar?`)) return;
    try {
      await deleteMutation.mutateAsync(id);
      toast({ title: "Event Removed", description: `'${title}' deleted from calendar.`, type: "success" });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete event";
      toast({ title: "Deletion Failed", description: msg, type: "error" });
    }
  };

  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!createForm.title.trim()) {
      toast({ title: "Validation Error", description: "Title is required", type: "error" });
      return;
    }
    try {
      await api.post("/api/calendar/events", {
        ...createForm,
        startDate: new Date(createForm.startDate).toISOString(),
        endDate: new Date(createForm.endDate + "T23:59:59.999Z").toISOString(),
      });
      toast({ title: "Event Created", description: `Added '${createForm.title}' to calendar.`, type: "success" });
      setShowCreateModal(false);
      setCreateForm({
        title: "",
        type: "holiday",
        startDate: todayStr,
        endDate: todayStr,
        description: "",
      });
      queryClient.invalidateQueries({ queryKey: ["calendar-events"] });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to create event";
      toast({ title: "Error", description: msg, type: "error" });
    }
  };

  const getDayTypeBadge = (dayType?: string) => {
    switch (dayType) {
      case "workday":
        return <Badge variant="success">Standard Workday</Badge>;
      case "weekly-off":
        return <Badge variant="neutral">Weekly-Off (Weekend)</Badge>;
      case "public-holiday":
        return <Badge variant="primary">Official Public Holiday</Badge>;
      case "company-off-day":
        return <Badge variant="warning">Company Off-Day</Badge>;
      default:
        return <Badge variant="neutral">Unknown</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight">
              Working Calendar & Holidays
            </h1>
            <Badge variant="primary" size="md">
              {selectedYear}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Authoritative source of truth for shift workdays, gazetted public holidays, and working day counters.
          </p>
        </div>

        {/* Global Calendar Controls */}
        <div className="flex items-center flex-wrap gap-2.5">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 shadow-xs focus:ring-2 focus:ring-blue-500"
          >
            <option value={currentYear - 1}>{currentYear - 1}</option>
            <option value={currentYear}>{currentYear} (Current)</option>
            <option value={currentYear + 1}>{currentYear + 1}</option>
          </select>

          <Button
            variant="outline"
            size="sm"
            onClick={handleExportIcs}
            className="gap-1.5 text-xs font-semibold"
          >
            <Download className="w-4 h-4 text-slate-600" />
            Export .ICS
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowImportModal(true)}
            className="gap-1.5 text-xs font-semibold"
          >
            <UploadCloud className="w-4 h-4 text-blue-600" />
            Import Holidays
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => setShowCreateModal(true)}
            className="gap-1.5 text-xs font-semibold"
          >
            <Plus className="w-4 h-4" />
            Add Event / Off-Day
          </Button>
        </div>
      </div>

      {/* Interactive Utilities: Day Type Inspector & Range Calculator */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Tool 1: Day Type Inspector */}
        <Card className="p-4 border-slate-200 shadow-xs space-y-3 bg-gradient-to-br from-white to-blue-50/20">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-blue-600" />
              <h3 className="text-sm font-bold text-slate-900">Day Type Inspector</h3>
            </div>
            <span className="text-[11px] text-slate-500 font-mono">Asia/Kolkata</span>
          </div>

          <p className="text-xs text-slate-600">
            Authoritatively checks how the attendance policy and holiday engine classifies any date.
          </p>

          <div className="flex items-center gap-3">
            <input
              type="date"
              value={inspectDate}
              onChange={(e) => setInspectDate(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs font-mono text-slate-800 focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex-1 flex items-center gap-2">
              {isDayTypeLoading ? (
                <Skeleton className="h-6 w-32" />
              ) : (
                <>
                  {getDayTypeBadge(dayTypeData?.dayType)}
                  <span className="text-xs text-slate-500">
                    {dayTypeData?.isWorkingDay ? "Attendance Required" : "No Punches Required"}
                  </span>
                </>
              )}
            </div>
          </div>
        </Card>

        {/* Tool 2: Working Days Range Calculator */}
        <Card className="p-4 border-slate-200 shadow-xs space-y-3 bg-gradient-to-br from-white to-indigo-50/20">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-indigo-600" />
              <h3 className="text-sm font-bold text-slate-900">Working Days Range Calculator</h3>
            </div>
            <Badge variant="info" size="sm">
              Timezone-Safe
            </Badge>
          </div>

          <p className="text-xs text-slate-600">
            Computes billable/compliance working days between two dates, excluding weekends and official off-days.
          </p>

          <div className="flex items-center flex-wrap gap-2">
            <input
              type="date"
              value={calcStart}
              onChange={(e) => setCalcStart(e.target.value)}
              className="px-2.5 py-1 border border-slate-200 rounded-md text-xs font-mono text-slate-800"
            />
            <span className="text-xs text-slate-400">to</span>
            <input
              type="date"
              value={calcEnd}
              onChange={(e) => setCalcEnd(e.target.value)}
              className="px-2.5 py-1 border border-slate-200 rounded-md text-xs font-mono text-slate-800"
            />
            <div className="ml-auto flex items-center gap-2">
              {isWorkingDaysLoading ? (
                <Skeleton className="h-6 w-20" />
              ) : (
                <div className="px-3 py-1 bg-indigo-50 border border-indigo-200 rounded-md text-xs font-bold text-indigo-800">
                  {workingDaysData?.workingDaysCount ?? 0} Working Days
                </div>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Main Schedule & Events Table */}
      <Card className="p-5 border-slate-200 shadow-xs space-y-4">
        {/* Table Filter Tabs & Search */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              onClick={() => setActiveTab("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === "all"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Events ({events.length})
            </button>
            <button
              onClick={() => setActiveTab("holiday")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === "holiday"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Public Holidays ({events.filter((e) => e.type === "holiday").length})
            </button>
            <button
              onClick={() => setActiveTab("companyOffDay")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === "companyOffDay"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Company Off-Days ({events.filter((e) => e.type === "companyOffDay").length})
            </button>
            <button
              onClick={() => setActiveTab("event")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                activeTab === "event"
                  ? "bg-blue-600 text-white shadow-xs"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              Corporate Events ({events.filter((e) => e.type === "event" || e.type === "meeting").length})
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                placeholder="Search events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 border border-slate-200 rounded-lg text-xs w-48 text-slate-800 placeholder-slate-400 focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <Button variant="outline" size="sm" onClick={() => refetch()} title="Refresh Calendar">
              <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
            </Button>
          </div>
        </div>

        {/* Content Table */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-lg" />
            ))}
          </div>
        ) : filteredEvents.length === 0 ? (
          <EmptyState
            icon={<CalendarIcon className="w-8 h-8 text-slate-300" />}
            title="No Calendar Events Found"
            description={
              searchQuery
                ? "No calendar events matched your search query."
                : `No events or holidays declared for year ${selectedYear}. Use 'Import Holidays' to pull national holidays.`
            }
            action={
              <Button size="sm" variant="primary" onClick={() => setShowImportModal(true)}>
                <UploadCloud className="w-4 h-4 mr-1.5" />
                Import National Holidays
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50/75 text-slate-700 font-semibold">
                  <th className="py-2.5 px-3">Event Title</th>
                  <th className="py-2.5 px-3">Date / Window</th>
                  <th className="py-2.5 px-3">Type</th>
                  <th className="py-2.5 px-3">Source</th>
                  <th className="py-2.5 px-3">Description</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEvents.map((evt) => {
                  const sDate = new Date(evt.startDate).toISOString().split("T")[0];
                  const eDate = new Date(evt.endDate).toISOString().split("T")[0];
                  const dateDisplay = sDate === eDate ? sDate : `${sDate} → ${eDate}`;

                  return (
                    <tr key={evt._id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {evt.title}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-700">{dateDisplay}</td>
                      <td className="py-2.5 px-3">
                        {evt.type === "holiday" ? (
                          <Badge variant="primary">Public Holiday</Badge>
                        ) : evt.type === "companyOffDay" ? (
                          <Badge variant="warning">Company Off-Day</Badge>
                        ) : (
                          <Badge variant="info">Event</Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-3">
                        {evt.source === "imported" ? (
                          <Badge variant="neutral" className="text-[10px]">
                            Imported
                          </Badge>
                        ) : (
                          <Badge variant="success" className="text-[10px]">
                            Manual Entry
                          </Badge>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-500 truncate max-w-xs">
                        {evt.description || "—"}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => handleDelete(evt._id, evt.title)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded transition-colors"
                          title="Delete Event"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* MODAL 1: PREVIEW & IMPORT HOLIDAYS */}
      <Modal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        title="Import National Holidays"
        maxWidth="max-w-3xl"
      >
        <div className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-100 rounded-lg text-xs text-blue-900">
            <div>
              <span className="font-bold">Provider:</span> {previewData?.provider || "Configured Adapter"}{" "}
              ({importCountry}) • <span className="font-bold">Year:</span> {selectedYear}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-emerald-700">{previewData?.toImport ?? 0} To Import</span>
              <span className="text-slate-500">{previewData?.alreadyImported ?? 0} Existing</span>
              {(previewData?.conflicts ?? 0) > 0 && (
                <span className="font-bold text-amber-700">{previewData?.conflicts} Manual Protected</span>
              )}
            </div>
          </div>

          <p className="text-xs text-slate-600">
            Previewing holidays from the official national holiday provider. The merge engine guarantees that manual
            entries will never be overwritten.
          </p>

          {isPreviewLoading ? (
            <Skeleton className="h-48 w-full rounded-lg" />
          ) : (
            <div className="max-h-72 overflow-y-auto border border-slate-200 rounded-lg">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold">
                  <tr>
                    <th className="py-2 px-3">Date</th>
                    <th className="py-2 px-3">Holiday Name</th>
                    <th className="py-2 px-3">Action Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {previewData?.items?.map((item) => (
                    <tr key={item.date} className="hover:bg-slate-50">
                      <td className="py-2 px-3 font-mono font-semibold text-slate-800">{item.date}</td>
                      <td className="py-2 px-3 font-medium text-slate-900">{item.name}</td>
                      <td className="py-2 px-3">
                        {item.action === "create" ? (
                          <Badge variant="success" size="sm">
                            Ready to Import
                          </Badge>
                        ) : item.action === "already_exists" ? (
                          <Badge variant="neutral" size="sm">
                            Already In Calendar
                          </Badge>
                        ) : (
                          <Badge variant="warning" size="sm">
                            Skip Manual Conflict
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" onClick={() => setShowImportModal(false)}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExecuteImport}
              isLoading={importMutation.isPending}
              disabled={isPreviewLoading || (previewData?.toImport ?? 0) === 0}
            >
              <UploadCloud className="w-4 h-4 mr-1.5" />
              Import {previewData?.toImport ?? 0} Holidays
            </Button>
          </div>
        </div>
      </Modal>

      {/* MODAL 2: ADD EVENT / OFF-DAY */}
      <Modal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        title="Add Calendar Event / Off-Day"
      >
        <form onSubmit={handleCreateEvent} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Event Title *</label>
            <Input
              type="text"
              placeholder="e.g. Founders Day / Annual Off-Site"
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Event Type *</label>
              <select
                value={createForm.type}
                onChange={(e) =>
                  setCreateForm({
                    ...createForm,
                    type: e.target.value as "holiday" | "companyOffDay" | "meeting" | "event",
                  })
                }
                className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800 bg-white"
              >
                <option value="holiday">Public Holiday</option>
                <option value="companyOffDay">Company Off-Day</option>
                <option value="event">Corporate Event</option>
                <option value="meeting">Meeting / Town Hall</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date *</label>
              <Input
                type="date"
                value={createForm.startDate}
                onChange={(e) => setCreateForm({ ...createForm, startDate: e.target.value })}
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">End Date *</label>
            <Input
              type="date"
              value={createForm.endDate}
              onChange={(e) => setCreateForm({ ...createForm, endDate: e.target.value })}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Description (Optional)</label>
            <textarea
              rows={3}
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs text-slate-800"
              placeholder="Brief summary of event or non-working day reason"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button variant="outline" size="sm" type="button" onClick={() => setShowCreateModal(false)}>
              Cancel
            </Button>
            <Button variant="primary" size="sm" type="submit">
              Save Event
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
