import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/Card";
import { Badge } from "../ui/Badge";
import { Clock, Shield, CheckCircle, XCircle, FileEdit, UserCheck } from "lucide-react";

interface ActivityItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  performedByEmployeeId?: string;
  reason?: string;
  timestamp: string;
}

export const RecentActivity: React.FC<{ activities: ActivityItem[] }> = ({ activities }) => {
  const getActionBadge = (action: string) => {
    switch (action.toUpperCase()) {
      case "APPROVE":
        return (
          <Badge variant="present" size="sm">
            Approved
          </Badge>
        );
      case "REJECT":
        return (
          <Badge variant="absent" size="sm">
            Rejected
          </Badge>
        );
      case "CORRECTION":
        return (
          <Badge variant="late" size="sm">
            Correction
          </Badge>
        );
      case "CREATE":
        return (
          <Badge variant="info" size="sm">
            Created
          </Badge>
        );
      case "LOGIN":
        return (
          <Badge variant="neutral" size="sm">
            Login
          </Badge>
        );
      default:
        return (
          <Badge variant="neutral" size="sm">
            {action}
          </Badge>
        );
    }
  };

  const getActionIcon = (action: string) => {
    switch (action.toUpperCase()) {
      case "APPROVE":
        return <CheckCircle className="w-4 h-4 text-emerald-600" />;
      case "REJECT":
        return <XCircle className="w-4 h-4 text-rose-600" />;
      case "CORRECTION":
        return <FileEdit className="w-4 h-4 text-amber-600" />;
      case "LOGIN":
        return <UserCheck className="w-4 h-4 text-blue-600" />;
      default:
        return <Shield className="w-4 h-4 text-slate-500" />;
    }
  };

  const formatTime = (isoString: string) => {
    try {
      const d = new Date(isoString);
      return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    } catch {
      return isoString;
    }
  };

  return (
    <Card className="flex flex-col h-full">
      <CardHeader className="py-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Activity Audit Feed</CardTitle>
            <p className="text-xs text-slate-500 mt-0.5">
              Real-time system events, decisions, and administrative modifications
            </p>
          </div>
          <Clock className="w-4 h-4 text-slate-400" />
        </div>
      </CardHeader>
      <CardContent className="p-0 flex-1 overflow-y-auto max-h-[340px]">
        {activities.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            No recent system activity recorded yet.
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {activities.map((item) => (
              <div
                key={item.id}
                className="p-4 hover:bg-slate-50/80 transition-colors flex items-start gap-3"
              >
                <div className="mt-0.5 p-1.5 bg-slate-100 rounded-lg shrink-0">
                  {getActionIcon(item.action)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold text-slate-800 truncate">
                      {item.entityType.replace(/_/g, " ")}: {item.performedByEmployeeId || "System"}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono shrink-0">
                      {formatTime(item.timestamp)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {getActionBadge(item.action)}
                    {item.reason && (
                      <span className="text-xs text-slate-600 truncate">{item.reason}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
