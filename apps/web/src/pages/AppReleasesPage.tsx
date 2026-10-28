import React, { useState } from "react";
import {
  Package,
  Plus,
  Smartphone,
  Monitor,
  Tv,
  Globe,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Download,
  Calendar,
  Layers,
  Sparkles,
  ExternalLink,
  ShieldAlert,
} from "lucide-react";
import {
  useAppReleases,
  usePublishRelease,
  useDeleteRelease,
  useFeatureFlags,
  AppReleaseItem,
} from "../api/queries";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { Badge } from "../components/ui/Badge";
import { Modal } from "../components/ui/Modal";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { useToast } from "../components/ui/Toast";
import { Skeleton } from "../components/ui/Skeleton";
import { StatCard } from "../components/ui/StatCard";

export const AppReleasesPage: React.FC = () => {
  const { toast } = useToast();
  const { data: flagData } = useFeatureFlags();
  const otaEnabled = flagData?.data?.otaUpdates ?? true;

  // Filters State
  const [selectedPlatform, setSelectedPlatform] = useState<string>("ALL");
  const [selectedChannel, setSelectedChannel] = useState<string>("production");
  const [page, setPage] = useState<number>(1);

  // Modal & Form State
  const [isPublishModalOpen, setIsPublishModalOpen] = useState<boolean>(false);
  const [releaseToDelete, setReleaseToDelete] = useState<AppReleaseItem | null>(null);

  // Form Inputs
  const [formPlatform, setFormPlatform] = useState<string>("MOBILE");
  const [formVersion, setFormVersion] = useState<string>("");
  const [formVersionCode, setFormVersionCode] = useState<number>(1);
  const [formMinVersion, setFormMinVersion] = useState<string>("1.0.0");
  const [formChannel, setFormChannel] = useState<string>("production");
  const [formForceUpdate, setFormForceUpdate] = useState<boolean>(false);
  const [formDownloadUrl, setFormDownloadUrl] = useState<string>("");
  const [formNotes, setFormNotes] = useState<string>("");

  // Queries & Mutations
  const {
    data: releasesData,
    isLoading,
    isError,
    refetch,
  } = useAppReleases({
    platform: selectedPlatform,
    channel: selectedChannel === "ALL" ? undefined : selectedChannel,
    page,
    limit: 20,
  });

  const publishMutation = usePublishRelease();
  const deleteMutation = useDeleteRelease();

  const releases = releasesData?.data || [];
  const totalReleases = releasesData?.pagination?.total || 0;

  // Stats
  const mobileReleases = releases.filter((r) => r.platform === "MOBILE" || r.platform === "ANDROID");
  const latestMobile = mobileReleases[0]?.version || "1.0.0";
  const webReleases = releases.filter((r) => r.platform === "WEB");
  const latestWeb = webReleases[0]?.version || "1.2.0";

  // Form submission
  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formVersion.trim()) {
      toast({ title: "Validation Error", description: "Version string is required.", type: "error" });
      return;
    }
    if (!formNotes.trim() || formNotes.trim().length < 3) {
      toast({ title: "Validation Error", description: "Release notes must be at least 3 characters.", type: "error" });
      return;
    }

    try {
      await publishMutation.mutateAsync({
        platform: formPlatform,
        version: formVersion.trim(),
        versionCode: formVersionCode,
        minSupportedVersion: formMinVersion.trim() || "1.0.0",
        channel: formChannel,
        forceUpdate: formForceUpdate,
        downloadUrl: formDownloadUrl.trim() || undefined,
        notes: formNotes.trim(),
      });

      toast({
        title: "Release Published",
        description: `Successfully published ${formPlatform} v${formVersion} (${formChannel}).`,
        type: "success",
      });

      setIsPublishModalOpen(false);
      resetForm();
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to publish release";
      toast({ title: "Publish Failed", description: msg, type: "error" });
    }
  };

  const handleDelete = async () => {
    if (!releaseToDelete) return;
    try {
      await deleteMutation.mutateAsync(releaseToDelete._id);
      toast({
        title: "Release Removed",
        description: `Release v${releaseToDelete.version} has been removed.`,
        type: "info",
      });
      setReleaseToDelete(null);
      refetch();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to delete release";
      toast({ title: "Delete Failed", description: msg, type: "error" });
    }
  };

  const resetForm = () => {
    setFormPlatform("MOBILE");
    setFormVersion("");
    setFormVersionCode(1);
    setFormMinVersion("1.0.0");
    setFormChannel("production");
    setFormForceUpdate(false);
    setFormDownloadUrl("");
    setFormNotes("");
  };

  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case "MOBILE":
      case "ANDROID":
      case "IOS":
        return <Smartphone className="w-4 h-4 text-emerald-500" />;
      case "WEB":
        return <Globe className="w-4 h-4 text-blue-500" />;
      case "DISPLAY":
        return <Tv className="w-4 h-4 text-purple-500" />;
      default:
        return <Monitor className="w-4 h-4 text-slate-500" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
              App Releases & OTA Updates
            </h1>
            <Badge variant={otaEnabled ? "success" : "warning"} size="sm">
              {otaEnabled ? "OTA Engine Active" : "Flag Inactive"}
            </Badge>
          </div>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Publish, monitor, and enforce multi-platform application versions and OTA update channels.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="primary"
            onClick={() => setIsPublishModalOpen(true)}
            className="gap-2 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            <span>Publish New Release</span>
          </Button>
        </div>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Published"
          value={totalReleases}
          icon={Package}
          color="blue"
        />
        <StatCard
          label="Latest Mobile Version"
          value={`v${latestMobile}`}
          icon={Smartphone}
          color="emerald"
        />
        <StatCard
          label="Latest Web Version"
          value={`v${latestWeb}`}
          icon={Globe}
          color="indigo"
        />
        <StatCard
          label="Active Channel"
          value={selectedChannel.toUpperCase()}
          icon={Layers}
          color="amber"
        />
      </div>

      {/* Control Filters Bar */}
      <Card className="p-4 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          {/* Channel Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-800/80 rounded-lg">
            {["production", "development", "staging", "ALL"].map((ch) => (
              <button
                key={ch}
                onClick={() => setSelectedChannel(ch)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold capitalize transition-all ${
                  selectedChannel === ch
                    ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-xs"
                    : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                }`}
              >
                {ch}
              </button>
            ))}
          </div>

          {/* Platform Filter */}
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-500">Platform:</span>
            <select
              value={selectedPlatform}
              onChange={(e) => setSelectedPlatform(e.target.value)}
              className="px-3 py-1.5 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            >
              <option value="ALL">All Platforms</option>
              <option value="MOBILE">Mobile (Unified)</option>
              <option value="ANDROID">Android</option>
              <option value="IOS">iOS</option>
              <option value="WEB">Web Portal</option>
              <option value="DISPLAY">Display Kiosk</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Releases Table Card */}
      <Card className="overflow-hidden bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800">
        {isLoading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
            <Skeleton className="h-12 w-full rounded-lg" />
          </div>
        ) : isError ? (
          <div className="p-12 text-center text-rose-500">
            <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-80" />
            <p className="text-sm font-semibold">Failed to load application releases.</p>
            <Button variant="outline" size="sm" onClick={() => refetch()} className="mt-3">
              Retry
            </Button>
          </div>
        ) : releases.length === 0 ? (
          <div className="p-12 text-center">
            <Package className="w-10 h-10 mx-auto mb-3 text-slate-400 opacity-60" />
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-200">
              No releases found
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 max-w-sm mx-auto">
              There are no published release records matching the selected channel and platform filters.
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPublishModalOpen(true)}
              className="mt-4"
            >
              Publish Initial Release
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-3 px-4">Platform</th>
                  <th className="py-3 px-4">Version</th>
                  <th className="py-3 px-4">Min Supported</th>
                  <th className="py-3 px-4">Channel</th>
                  <th className="py-3 px-4">Enforcement</th>
                  <th className="py-3 px-4">Release Notes</th>
                  <th className="py-3 px-4">Published Date</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {releases.map((release) => (
                  <tr
                    key={release._id}
                    className="hover:bg-slate-50/80 dark:hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2">
                        {getPlatformIcon(release.platform)}
                        <span className="font-semibold text-slate-800 dark:text-slate-200">
                          {release.platform}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-slate-900 dark:text-white">
                        v{release.version}
                      </div>
                      <div className="text-[10px] text-slate-400">
                        Code #{release.versionCode}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono text-slate-600 dark:text-slate-400">
                      v{release.minSupportedVersion}
                    </td>
                    <td className="py-3 px-4">
                      <Badge variant="neutral" size="sm" className="capitalize">
                        {release.channel}
                      </Badge>
                    </td>
                    <td className="py-3 px-4">
                      {release.forceUpdate ? (
                        <Badge variant="danger" size="sm" className="gap-1">
                          <ShieldAlert className="w-3 h-3" />
                          <span>Mandatory</span>
                        </Badge>
                      ) : (
                        <Badge variant="success" size="sm" className="gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Optional</span>
                        </Badge>
                      )}
                    </td>
                    <td className="py-3 px-4 max-w-xs">
                      <p className="line-clamp-2 text-slate-600 dark:text-slate-300">
                        {release.notes}
                      </p>
                      {release.downloadUrl && (
                        <a
                          href={release.downloadUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline mt-0.5"
                        >
                          <span>Store / Bundle URL</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                      <div>{new Date(release.publishedAt).toLocaleDateString()}</div>
                      <div className="text-[10px] text-slate-400">
                        {new Date(release.publishedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setReleaseToDelete(release)}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-md transition-colors"
                        title="Delete Release"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* MODAL: PUBLISH NEW RELEASE */}
      <Modal
        isOpen={isPublishModalOpen}
        onClose={() => setIsPublishModalOpen(false)}
        title="Publish App Release & Notes"
        maxWidth="lg"
      >
        <form onSubmit={handlePublish} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Target Platform *
              </label>
              <select
                value={formPlatform}
                onChange={(e) => setFormPlatform(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              >
                <option value="MOBILE">Mobile (Android & iOS)</option>
                <option value="ANDROID">Android Dedicated</option>
                <option value="IOS">iOS Dedicated</option>
                <option value="WEB">Web Application</option>
                <option value="DISPLAY">Display Kiosk</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Channel *
              </label>
              <select
                value={formChannel}
                onChange={(e) => setFormChannel(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              >
                <option value="production">Production</option>
                <option value="development">Development</option>
                <option value="staging">Staging</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Version String (SemVer) *
              </label>
              <input
                type="text"
                placeholder="e.g. 1.3.0"
                value={formVersion}
                onChange={(e) => setFormVersion(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Version Code (Build #)
              </label>
              <input
                type="number"
                min="1"
                value={formVersionCode}
                onChange={(e) => setFormVersionCode(Number(e.target.value))}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Min Supported Version *
              </label>
              <input
                type="text"
                placeholder="e.g. 1.0.0"
                value={formMinVersion}
                onChange={(e) => setFormMinVersion(e.target.value)}
                required
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white font-mono"
              />
              <span className="text-[10px] text-slate-400 mt-0.5 block">
                Older clients will see blocking update screen
              </span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
                Download / Store URL
              </label>
              <input
                type="url"
                placeholder="https://..."
                value={formDownloadUrl}
                onChange={(e) => setFormDownloadUrl(e.target.value)}
                className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Force Update Toggle */}
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 rounded-lg flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-300 block">
                Force Immediate Update
              </span>
              <span className="text-[11px] text-amber-700 dark:text-amber-400 block">
                Prevents older clients from continuing without updating immediately.
              </span>
            </div>
            <input
              type="checkbox"
              checked={formForceUpdate}
              onChange={(e) => setFormForceUpdate(e.target.checked)}
              className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300"
            />
          </div>

          {/* Release Notes */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">
              Release Notes & Changelog *
            </label>
            <textarea
              rows={4}
              placeholder="Detail new features, bug fixes, breaking protocol changes, and performance updates..."
              value={formNotes}
              onChange={(e) => setFormNotes(e.target.value)}
              required
              className="w-full px-3 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
            />
          </div>

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsPublishModalOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              isLoading={publishMutation.isPending}
            >
              <Sparkles className="w-4 h-4 mr-1.5" />
              Publish Release
            </Button>
          </div>
        </form>
      </Modal>

      {/* CONFIRM DELETE DIALOG */}
      <ConfirmDialog
        isOpen={!!releaseToDelete}
        onClose={() => setReleaseToDelete(null)}
        onConfirm={handleDelete}
        title="Delete Release Record"
        message={`Are you sure you want to remove release ${releaseToDelete?.platform} v${releaseToDelete?.version}? Clients will no longer receive update prompts for this version.`}
        confirmText="Delete Release"
        variant="danger"
        isLoading={deleteMutation.isPending}
      />
    </div>
  );
};
