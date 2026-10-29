import React, { useState, useEffect, useMemo } from "react";
import {
  Megaphone,
  Plus,
  Settings,
  Sparkles,
  Search,
  Filter,
  Pin,
  Clock,
  Calendar,
  Eye,
  CheckCircle2,
  Trash2,
  Edit3,
  AlertTriangle,
  AlertCircle,
  Info,
  Bell,
  Users,
  Building,
  Shield,
  RotateCw,
  Send,
  X,
  ChevronRight,
  Sliders,
  Check,
  Flame,
} from "lucide-react";
import {
  useAdminAnnouncements,
  useAnnouncements,
  useCreateAnnouncement,
  useUpdateAnnouncement,
  useDeleteAnnouncement,
  useAnnouncementTemplates,
  useUpdateAnnouncementTemplate,
  useTriggerAutoAnnouncements,
  useMarkAnnouncementRead,
  AnnouncementItem,
  AnnouncementTemplateItem,
} from "../api/queries";
import { useSocket } from "../context/SocketContext";
import { useToast } from "../components/ui/Toast";
import { Button } from "../components/ui/Button";
import { Input } from "../components/ui/Input";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { Skeleton } from "../components/ui/Skeleton";
import { ErrorState } from "../components/ui/ErrorState";

const DEPARTMENTS = [
  "Engineering",
  "Product",
  "Design",
  "Marketing",
  "Sales",
  "Human Resources",
  "Finance",
  "Operations",
];

const ROLES = ["EMPLOYEE", "HR", "ADMIN"];

export const AnnouncementsPage: React.FC = () => {
  const { toast } = useToast();
  const { socket } = useSocket();

  // Active Tab: all | manual | auto
  const [sourceTab, setSourceTab] = useState<"all" | "manual" | "auto">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [page, setPage] = useState<number>(1);

  // Queries
  const {
    data: adminData,
    isLoading,
    isError,
    error,
    refetch,
    isFetching,
  } = useAdminAnnouncements({
    source: sourceTab === "all" ? undefined : sourceTab,
    status: statusFilter === "all" ? undefined : statusFilter,
    priority: priorityFilter === "all" ? undefined : priorityFilter,
    search: searchQuery ? searchQuery.trim() : undefined,
    page,
    limit: 15,
  });

  const { data: templatesData, refetch: refetchTemplates } = useAnnouncementTemplates();
  const templates = templatesData?.data || [];

  // Mutations
  const createMutation = useCreateAnnouncement();
  const updateMutation = useUpdateAnnouncement();
  const deleteMutation = useDeleteAnnouncement();
  const updateTemplateMutation = useUpdateAnnouncementTemplate();
  const triggerAutoMutation = useTriggerAutoAnnouncements();
  const markReadMutation = useMarkAnnouncementRead();

  // Modals
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [editingAnnouncement, setEditingAnnouncement] = useState<AnnouncementItem | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Composer Form State
  const [formTitle, setFormTitle] = useState("");
  const [formBody, setFormBody] = useState("");
  const [formPriority, setFormPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [formPinned, setFormPinned] = useState(false);
  const [formStartsAt, setFormStartsAt] = useState<string>(() => {
    const d = new Date();
    d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 16);
  });
  const [formExpiresAt, setFormExpiresAt] = useState<string>("");
  const [formAudienceScope, setFormAudienceScope] = useState<"all" | "department" | "role">("all");
  const [formDepartments, setFormDepartments] = useState<string[]>([]);
  const [formRoles, setFormRoles] = useState<string[]>([]);
  const [composerTab, setComposerTab] = useState<"compose" | "preview">("compose");

  // Selected Template for editing
  const [selectedTemplateKey, setSelectedTemplateKey] = useState<string | null>(null);
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.key === selectedTemplateKey) || templates[0],
    [templates, selectedTemplateKey]
  );
  const [tplTitle, setTplTitle] = useState("");
  const [tplBody, setTplBody] = useState("");
  const [tplPriority, setTplPriority] = useState<"LOW" | "MEDIUM" | "HIGH" | "URGENT">("MEDIUM");
  const [tplEnabled, setTplEnabled] = useState(true);

  // Sync selected template into form
  useEffect(() => {
    if (selectedTemplate) {
      setTplTitle(selectedTemplate.titleTemplate);
      setTplBody(selectedTemplate.bodyTemplate);
      setTplPriority(selectedTemplate.priority || "MEDIUM");
      setTplEnabled(selectedTemplate.isEnabled);
    }
  }, [selectedTemplate]);

  // Real-time socket sync
  useEffect(() => {
    if (!socket) return;
    const handleSync = () => {
      refetch();
    };
    socket.on("announcement.published", handleSync);
    socket.on("announcement.pinned", handleSync);

    return () => {
      socket.off("announcement.published", handleSync);
      socket.off("announcement.pinned", handleSync);
    };
  }, [socket, refetch]);

  // Handle open composer (new or edit)
  const openComposer = (item?: AnnouncementItem) => {
    if (item) {
      setEditingAnnouncement(item);
      setFormTitle(item.title);
      setFormBody(item.body);
      setFormPriority(item.priority);
      setFormPinned(item.pinned);

      const s = new Date(item.startsAt);
      s.setMinutes(s.getMinutes() - s.getTimezoneOffset());
      setFormStartsAt(s.toISOString().slice(0, 16));

      if (item.expiresAt) {
        const e = new Date(item.expiresAt);
        e.setMinutes(e.getMinutes() - e.getTimezoneOffset());
        setFormExpiresAt(e.toISOString().slice(0, 16));
      } else {
        setFormExpiresAt("");
      }

      setFormAudienceScope(item.audience?.scope || "all");
      setFormDepartments(item.audience?.departments || []);
      setFormRoles(item.audience?.roles || []);
    } else {
      setEditingAnnouncement(null);
      setFormTitle("");
      setFormBody("");
      setFormPriority("MEDIUM");
      setFormPinned(false);

      const d = new Date();
      d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
      setFormStartsAt(d.toISOString().slice(0, 16));
      setFormExpiresAt("");

      setFormAudienceScope("all");
      setFormDepartments([]);
      setFormRoles([]);
    }
    setComposerTab("compose");
    setIsComposerOpen(true);
  };

  const handleSaveAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim() || !formBody.trim()) {
      toast({
        title: "Required Fields Missing",
        description: "Please provide both an announcement title and description body.",
        type: "error",
      });
      return;
    }

    try {
      const payload = {
        title: formTitle.trim(),
        body: formBody.trim(),
        priority: formPriority,
        pinned: formPinned,
        startsAt: formStartsAt ? new Date(formStartsAt).toISOString() : new Date().toISOString(),
        expiresAt: formExpiresAt ? new Date(formExpiresAt).toISOString() : null,
        audience: {
          scope: formAudienceScope,
          departments: formAudienceScope === "department" ? formDepartments : [],
          roles: formAudienceScope === "role" ? formRoles : [],
        },
      };

      if (editingAnnouncement) {
        await updateMutation.mutateAsync({
          id: editingAnnouncement._id,
          payload,
        });
        toast({
          title: "Announcement Updated",
          description: "Changes have been successfully saved and broadcasted.",
          type: "success",
        });
      } else {
        await createMutation.mutateAsync(payload);
        toast({
          title: "Announcement Published",
          description: "New announcement is now live for all matching employees.",
          type: "success",
        });
      }

      setIsComposerOpen(false);
      refetch();
    } catch (err: any) {
      toast({
        title: "Save Failed",
        description: err.message || "Failed to save announcement.",
        type: "error",
      });
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteMutation.mutateAsync(id);
      toast({
        title: "Announcement Deleted",
        description: "The announcement has been permanently removed.",
        type: "success",
      });
      setDeletingId(null);
      refetch();
    } catch (err: any) {
      toast({
        title: "Deletion Failed",
        description: err.message || "Failed to delete announcement.",
        type: "error",
      });
    }
  };

  const handleSaveTemplate = async () => {
    if (!selectedTemplate) return;
    try {
      await updateTemplateMutation.mutateAsync({
        key: selectedTemplate.key,
        payload: {
          titleTemplate: tplTitle.trim(),
          bodyTemplate: tplBody.trim(),
          priority: tplPriority,
          isEnabled: tplEnabled,
        },
      });
      toast({
        title: "Template Saved",
        description: `Template '${selectedTemplate.name}' updated successfully.`,
        type: "success",
      });
      refetchTemplates();
    } catch (err: any) {
      toast({
        title: "Template Update Failed",
        description: err.message || "Could not update template.",
        type: "error",
      });
    }
  };

  const handleTriggerAuto = async () => {
    try {
      const res = await triggerAutoMutation.mutateAsync();
      toast({
        title: "Auto-Check Complete",
        description: `Calendar and event triggers evaluated. Generated ${res.count} new announcements.`,
        type: "success",
      });
      refetch();
    } catch (err: any) {
      toast({
        title: "Trigger Failed",
        description: err.message || "Failed to trigger auto check.",
        type: "error",
      });
    }
  };

  const toggleDept = (dept: string) => {
    if (formDepartments.includes(dept)) {
      setFormDepartments(formDepartments.filter((d) => d !== dept));
    } else {
      setFormDepartments([...formDepartments, dept]);
    }
  };

  const toggleRole = (r: string) => {
    if (formRoles.includes(r)) {
      setFormRoles(formRoles.filter((item) => item !== r));
    } else {
      setFormRoles([...formRoles, r]);
    }
  };

  const insertVariable = (variable: string) => {
    setTplBody((prev) => `${prev} {${variable}}`);
  };

  const announcements = adminData?.data || [];
  const pagination = adminData?.pagination;

  // Helper for priority display
  const getPriorityBadge = (p: string) => {
    switch (p) {
      case "URGENT":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 border border-red-300 dark:border-red-800">
            <Flame className="w-3.5 h-3.5 text-red-600" />
            URGENT
          </span>
        );
      case "HIGH":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
            <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
            HIGH
          </span>
        );
      case "LOW":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
            <Bell className="w-3.5 h-3.5 text-slate-500" />
            LOW
          </span>
        );
      case "MEDIUM":
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300 border border-blue-300 dark:border-blue-800">
            <Info className="w-3.5 h-3.5 text-blue-600" />
            MEDIUM
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. Header & Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200 dark:border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-blue-600 text-white shadow-md shadow-blue-500/20">
              <Megaphone className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                  Announcements & Broadcasts
                </h1>
                <Badge variant="info" size="sm">
                  Live Feed
                </Badge>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Publish company broadcasts, manage automated holiday & meeting alerts, and monitor employee read status.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleTriggerAuto}
            isLoading={triggerAutoMutation.isPending}
            title="Scan calendar and policies to trigger any automated announcements right now"
          >
            <Sparkles className="w-4 h-4 mr-1.5 text-cyan-500" />
            <span>Force Auto Check</span>
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsTemplateModalOpen(true)}
          >
            <Sliders className="w-4 h-4 mr-1.5 text-indigo-500" />
            <span>Automated Templates</span>
          </Button>

          <Button
            variant="primary"
            size="sm"
            onClick={() => openComposer()}
            className="shadow-sm shadow-blue-600/30"
          >
            <Plus className="w-4 h-4 mr-1.5" />
            <span>New Announcement</span>
          </Button>
        </div>
      </div>

      {/* 2. Filter Bar: Source Tabs, Status, Priority & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 p-3 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-xs">
        {/* Source Filter Tabs */}
        <div className="flex items-center bg-slate-100 dark:bg-slate-800/80 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => {
              setSourceTab("all");
              setPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
              sourceTab === "all"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            All Announcements
          </button>
          <button
            type="button"
            onClick={() => {
              setSourceTab("manual");
              setPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${
              sourceTab === "manual"
                ? "bg-white dark:bg-slate-900 text-blue-600 dark:text-cyan-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            Manual ({adminData?.data?.filter((a) => a.source === "manual").length ?? "..."})
          </button>
          <button
            type="button"
            onClick={() => {
              setSourceTab("auto");
              setPage(1);
            }}
            className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all flex items-center gap-1.5 ${
              sourceTab === "auto"
                ? "bg-white dark:bg-slate-900 text-cyan-600 dark:text-cyan-400 shadow-xs"
                : "text-slate-600 dark:text-slate-400 hover:text-slate-900"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-cyan-500" />
            <span>Auto Templates</span>
          </button>
        </div>

        {/* Status, Priority & Search */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Now</option>
            <option value="scheduled">Scheduled Future</option>
            <option value="expired">Expired</option>
          </select>

          {/* Priority Filter */}
          <select
            value={priorityFilter}
            onChange={(e) => {
              setPriorityFilter(e.target.value);
              setPage(1);
            }}
            className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
          >
            <option value="all">All Priorities</option>
            <option value="URGENT">Urgent Only</option>
            <option value="HIGH">High Priority</option>
            <option value="MEDIUM">Medium Priority</option>
            <option value="LOW">Low Priority</option>
          </select>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Search announcements..."
              className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500 w-44 sm:w-56"
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={() => refetch()}
            isLoading={isFetching}
            className="px-2"
            title="Refresh Feed"
          >
            <RotateCw className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* 3. Announcements List / Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 space-y-3 animate-pulse"
            >
              <div className="flex justify-between items-center">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-5 w-24" />
              </div>
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
            </div>
          ))}
        </div>
      ) : isError ? (
        <ErrorState
          title="Failed to Load Announcements"
          message={error instanceof Error ? error.message : "Network error"}
          onRetry={() => refetch()}
          isRetrying={isFetching}
        />
      ) : announcements.length === 0 ? (
        <Card className="p-12 text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-cyan-400 flex items-center justify-center">
            <Megaphone className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              No Announcements Found
            </h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {searchQuery || statusFilter !== "all" || priorityFilter !== "all" || sourceTab !== "all"
                ? "No announcements matched your active filter criteria. Try resetting filters."
                : "Broadcast company-wide news, urgent alerts, and automated holiday notices to your team."}
            </p>
          </div>
          <div className="flex items-center justify-center gap-3 pt-2">
            <Button variant="primary" size="sm" onClick={() => openComposer()}>
              <Plus className="w-4 h-4 mr-1.5" />
              Create Announcement
            </Button>
          </div>
        </Card>
      ) : (
        <div className="space-y-3">
          {announcements.map((item) => {
            const isAuto = item.source === "auto" || Boolean(item.isAuto);
            const isExpired = item.expiresAt ? new Date(item.expiresAt) < new Date() : false;
            const isFuture = new Date(item.startsAt) > new Date();

            return (
              <div
                key={item._id}
                className={`p-5 rounded-xl border bg-white dark:bg-slate-900 transition-all hover:shadow-md ${
                  item.pinned
                    ? "border-amber-300 dark:border-amber-800/60 shadow-xs"
                    : "border-slate-200 dark:border-slate-800"
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                  {/* Left Column: Details */}
                  <div className="space-y-2 flex-1 min-w-0">
                    {/* Header Badges */}
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      {item.pinned && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border border-amber-300 dark:border-amber-800">
                          <Pin className="w-3.5 h-3.5 text-amber-600 fill-amber-600" />
                          PINNED
                        </span>
                      )}

                      {getPriorityBadge(item.priority)}

                      {isAuto ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-bold bg-cyan-100 text-cyan-800 dark:bg-cyan-950/40 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800">
                          <Sparkles className="w-3.5 h-3.5 text-cyan-600" />
                          AUTO TEMPLATE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md font-medium bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-300 dark:border-slate-700">
                          MANUAL
                        </span>
                      )}

                      {/* Status badge */}
                      {isExpired ? (
                        <span className="px-2 py-0.5 rounded-md font-semibold bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border border-rose-200 dark:border-rose-800">
                          EXPIRED
                        </span>
                      ) : isFuture ? (
                        <span className="px-2 py-0.5 rounded-md font-semibold bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border border-purple-200 dark:border-purple-800">
                          SCHEDULED
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-md font-semibold bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                          ACTIVE
                        </span>
                      )}

                      {/* Audience Badge */}
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-slate-600 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700">
                        {item.audience?.scope === "department" ? (
                          <>
                            <Building className="w-3.5 h-3.5" />
                            <span>Dept: {item.audience.departments?.join(", ") || "All"}</span>
                          </>
                        ) : item.audience?.scope === "role" ? (
                          <>
                            <Shield className="w-3.5 h-3.5" />
                            <span>Role: {item.audience.roles?.join(", ") || "All"}</span>
                          </>
                        ) : (
                          <>
                            <Users className="w-3.5 h-3.5" />
                            <span>All Staff</span>
                          </>
                        )}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 className="text-base font-bold text-slate-900 dark:text-white">
                      {item.title}
                    </h3>

                    {/* Body */}
                    <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                      {item.body}
                    </p>

                    {/* Timing & Read Stats */}
                    <div className="flex flex-wrap items-center gap-4 pt-2 text-[11px] text-slate-500 dark:text-slate-400">
                      <span className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        <span>Starts: {new Date(item.startsAt).toLocaleString()}</span>
                      </span>

                      {item.expiresAt && (
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          <span>Expires: {new Date(item.expiresAt).toLocaleString()}</span>
                        </span>
                      )}

                      <span className="flex items-center gap-1 font-semibold text-slate-700 dark:text-slate-300">
                        <Eye className="w-3.5 h-3.5 text-blue-500" />
                        <span>{item.readCount ?? item.readBy?.length ?? 0} confirmed reads</span>
                      </span>
                    </div>
                  </div>

                  {/* Right Column: Actions */}
                  <div className="flex items-center gap-2 sm:self-start shrink-0 pt-2 sm:pt-0">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => openComposer(item)}
                      title="Edit Announcement"
                    >
                      <Edit3 className="w-3.5 h-3.5 mr-1" />
                      <span>Edit</span>
                    </Button>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setDeletingId(item._id)}
                      className="text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                      title="Delete Announcement"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination */}
          {pagination && pagination.pages > 1 && (
            <div className="flex items-center justify-between pt-4 text-xs text-slate-500">
              <span>
                Showing page {pagination.page} of {pagination.pages} ({pagination.total} total)
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page <= 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={pagination.page >= pagination.pages}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. COMPOSER MODAL (With Live Preview) */}
      <Modal
        isOpen={isComposerOpen}
        onClose={() => setIsComposerOpen(false)}
        title={editingAnnouncement ? "Edit Announcement" : "Compose Broadcast Announcement"}
        maxWidth="lg"
      >
        <div className="space-y-4">
          {/* Subheader / Tabs for Compose vs Preview */}
          <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-2">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setComposerTab("compose")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors ${
                  composerTab === "compose"
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                Compose & Audience
              </button>
              <button
                type="button"
                onClick={() => setComposerTab("preview")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 ${
                  composerTab === "preview"
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Live Feed Preview</span>
              </button>
            </div>
            <span className="text-[11px] text-slate-400">
              Targeted broadcasts emit instant socket updates
            </span>
          </div>

          {composerTab === "compose" ? (
            <form onSubmit={handleSaveAnnouncement} className="space-y-4">
              {/* Title */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Announcement Title *
                </label>
                <Input
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="e.g. Town Hall Meeting Tomorrow at 2 PM"
                  required
                  maxLength={150}
                />
              </div>

              {/* Priority & Pinned */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Priority Level
                  </label>
                  <select
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as any)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-slate-800 dark:text-slate-200 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500"
                  >
                    <option value="LOW">Low (Casual Bulletin)</option>
                    <option value="MEDIUM">Medium (General Notice)</option>
                    <option value="HIGH">High (Urgent Attention)</option>
                    <option value="URGENT">Urgent (Requires Immediate Action)</option>
                  </select>
                </div>

                <div className="flex items-center sm:pt-6">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formPinned}
                      onChange={(e) => setFormPinned(e.target.checked)}
                      className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                    />
                    <span className="text-xs font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-1">
                      <Pin className="w-3.5 h-3.5 text-amber-500" />
                      Pin to Top of Feed
                    </span>
                  </label>
                </div>
              </div>

              {/* Body */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                  Message Body *
                </label>
                <textarea
                  value={formBody}
                  onChange={(e) => setFormBody(e.target.value)}
                  placeholder="Write full message details, instructions, or meeting agenda..."
                  rows={4}
                  required
                  maxLength={5000}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                <div className="flex justify-between items-center text-[10px] text-slate-400 mt-1">
                  <span>Markdown & links supported</span>
                  <span>{formBody.length} / 5000 chars</span>
                </div>
              </div>

              {/* Audience Scoping */}
              <div className="p-3.5 rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
                <label className="block text-xs font-bold text-slate-800 dark:text-slate-200">
                  Target Audience Scope
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormAudienceScope("all")}
                    className={`p-2 rounded-lg text-xs font-bold border text-center transition-all ${
                      formAudienceScope === "all"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    All Staff
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormAudienceScope("department")}
                    className={`p-2 rounded-lg text-xs font-bold border text-center transition-all ${
                      formAudienceScope === "department"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    By Department
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormAudienceScope("role")}
                    className={`p-2 rounded-lg text-xs font-bold border text-center transition-all ${
                      formAudienceScope === "role"
                        ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700"
                    }`}
                  >
                    By Role
                  </button>
                </div>

                {/* Multi-select Departments */}
                {formAudienceScope === "department" && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Select Target Departments (minimum 1):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {DEPARTMENTS.map((dept) => {
                        const selected = formDepartments.includes(dept);
                        return (
                          <button
                            key={dept}
                            type="button"
                            onClick={() => toggleDept(dept)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                              selected
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {dept}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Multi-select Roles */}
                {formAudienceScope === "role" && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                      Select Target Roles (minimum 1):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {ROLES.map((r) => {
                        const selected = formRoles.includes(r);
                        return (
                          <button
                            key={r}
                            type="button"
                            onClick={() => toggleRole(r)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium border transition-colors ${
                              selected
                                ? "bg-blue-600 text-white border-blue-600"
                                : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100"
                            }`}
                          >
                            {r}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Schedule Timing */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Start Showing At
                  </label>
                  <Input
                    type="datetime-local"
                    value={formStartsAt}
                    onChange={(e) => setFormStartsAt(e.target.value)}
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                    Expires At (Optional)
                  </label>
                  <Input
                    type="datetime-local"
                    value={formExpiresAt}
                    onChange={(e) => setFormExpiresAt(e.target.value)}
                  />
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setIsComposerOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  size="sm"
                  isLoading={createMutation.isPending || updateMutation.isPending}
                >
                  <Send className="w-4 h-4 mr-1.5" />
                  <span>{editingAnnouncement ? "Save Changes" : "Publish Broadcast"}</span>
                </Button>
              </div>
            </form>
          ) : (
            /* LIVE PREVIEW TAB */
            <div className="space-y-4">
              <p className="text-xs text-slate-500">
                This is how the announcement will appear on the employee portal and mobile banner:
              </p>

              <div
                className={`p-5 rounded-2xl border ${
                  formPriority === "URGENT"
                    ? "border-red-400 bg-red-50/40 dark:bg-red-950/20"
                    : formPriority === "HIGH"
                    ? "border-amber-400 bg-amber-50/40 dark:bg-amber-950/20"
                    : "border-blue-400 bg-blue-50/40 dark:bg-blue-950/20"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-xl bg-white dark:bg-slate-800 shadow-xs shrink-0">
                    <Megaphone className="w-5 h-5 text-blue-600" />
                  </div>
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2">
                      {formPinned && (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
                          PINNED
                        </span>
                      )}
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-blue-100 text-blue-800">
                        {formPriority}
                      </span>
                      <span className="text-[11px] text-slate-500">Just Now</span>
                    </div>

                    <h4 className="text-base font-bold text-slate-900 dark:text-white">
                      {formTitle || "Sample Announcement Headline"}
                    </h4>

                    <p className="text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                      {formBody || "Detailed message will render here with full typography spacing."}
                    </p>
                  </div>
                </div>
              </div>

              <div className="flex justify-end pt-3">
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setComposerTab("compose")}
                >
                  Back to Editor
                </Button>
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* 5. TEMPLATES & AUTOMATIONS MODAL */}
      <Modal
        isOpen={isTemplateModalOpen}
        onClose={() => setIsTemplateModalOpen(false)}
        title="Automated Announcement Templates"
        maxWidth="lg"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
            Configure default automated broadcasts generated from the calendar engine and system events. Each template can be customized with placeholder variables and toggled on or off individually.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Template Selector List */}
            <div className="space-y-1 md:border-r md:border-slate-200 dark:md:border-slate-800 md:pr-3">
              {templates.map((tpl) => (
                <button
                  key={tpl.key}
                  type="button"
                  onClick={() => setSelectedTemplateKey(tpl.key)}
                  className={`w-full text-left p-2.5 rounded-lg text-xs transition-all ${
                    (selectedTemplateKey || templates[0]?.key) === tpl.key
                      ? "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-cyan-400 font-bold border border-blue-200 dark:border-blue-900"
                      : "text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span>{tpl.name}</span>
                    <span
                      className={`w-2 h-2 rounded-full ${
                        tpl.isEnabled ? "bg-emerald-500" : "bg-slate-400"
                      }`}
                      title={tpl.isEnabled ? "Active" : "Disabled"}
                    />
                  </div>
                  <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                    {tpl.key}
                  </span>
                </button>
              ))}
            </div>

            {/* Template Editor Form */}
            <div className="md:col-span-2 space-y-3.5">
              {selectedTemplate ? (
                <>
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-800">
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        {selectedTemplate.name}
                      </h4>
                      <p className="text-[11px] text-slate-500">
                        {selectedTemplate.description}
                      </p>
                    </div>

                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={tplEnabled}
                        onChange={(e) => setTplEnabled(e.target.checked)}
                        className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
                      />
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300">
                        {tplEnabled ? "Enabled" : "Disabled"}
                      </span>
                    </label>
                  </div>

                  {/* Title Template */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Title Template Pattern
                    </label>
                    <Input
                      value={tplTitle}
                      onChange={(e) => setTplTitle(e.target.value)}
                      placeholder="Title pattern with {variables}"
                    />
                  </div>

                  {/* Body Template */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Body Message Pattern
                    </label>
                    <textarea
                      value={tplBody}
                      onChange={(e) => setTplBody(e.target.value)}
                      rows={3}
                      className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2.5 text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-blue-500 font-mono"
                    />
                  </div>

                  {/* Variable chips */}
                  <div>
                    <span className="text-[11px] font-semibold text-slate-500 block mb-1">
                      Available Replacement Tokens (Click to insert):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {selectedTemplate.variables?.map((v) => (
                        <button
                          key={v}
                          type="button"
                          onClick={() => insertVariable(v)}
                          className="px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-blue-600 dark:text-cyan-400 font-mono text-xs hover:bg-blue-50 border border-slate-200 dark:border-slate-700 transition-colors"
                        >
                          +{`{${v}}`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Priority */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                      Default Broadcast Priority
                    </label>
                    <select
                      value={tplPriority}
                      onChange={(e) => setTplPriority(e.target.value as any)}
                      className="text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-800 dark:text-slate-200"
                    >
                      <option value="LOW">Low</option>
                      <option value="MEDIUM">Medium</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>

                  {/* Save Template Button */}
                  <div className="flex justify-end pt-2">
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={handleSaveTemplate}
                      isLoading={updateTemplateMutation.isPending}
                    >
                      <Check className="w-4 h-4 mr-1.5" />
                      Save Template Rules
                    </Button>
                  </div>
                </>
              ) : (
                <div className="p-8 text-center text-xs text-slate-400">
                  Select a template to customize its text pattern and tokens.
                </div>
              )}
            </div>
          </div>
        </div>
      </Modal>

      {/* 6. DELETE CONFIRMATION MODAL */}
      <Modal
        isOpen={Boolean(deletingId)}
        onClose={() => setDeletingId(null)}
        title="Delete Announcement"
        maxWidth="sm"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 dark:text-slate-300">
            Are you sure you want to permanently delete this announcement? This action cannot be undone and will remove it from all employee dashboards.
          </p>
          <div className="flex justify-end gap-2.5">
            <Button variant="outline" size="sm" onClick={() => setDeletingId(null)}>
              Cancel
            </Button>
            <Button
              variant="danger"
              size="sm"
              isLoading={deleteMutation.isPending}
              onClick={() => deletingId && handleDelete(deletingId)}
            >
              Delete Permanently
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
export default AnnouncementsPage;

