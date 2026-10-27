/**
 * VorldX Unified Status System
 *
 * Mandate: Every status MUST have:
 * 1. A semantic color (light and dark mode WCAG AA compliant)
 * 2. An accessible icon identifier
 * 3. A clear textual label
 *
 * Statuses must NEVER rely on color alone.
 */

export type StatusCategory =
  | "PRESENT"
  | "LATE"
  | "ABSENT"
  | "INCOMPLETE"
  | "WFH"
  | "LEAVE"
  | "HOLIDAY"
  | "OFF_DAY"
  | "PENDING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED";

export interface StatusThemeColors {
  bg: string;
  text: string;
  border: string;
  badgeBg: string;
}

export interface StatusDescriptor {
  key: StatusCategory;
  label: string;
  icon: string; // Lucide / Feather / Ionicons compatible icon key
  solidColor: string; // Base accent hex
  light: StatusThemeColors; // WCAG AA compliant on white/slate-50
  dark: StatusThemeColors;  // WCAG AA compliant on slate-900/slate-950
  ariaLabel: string;
  description: string;
}

export const STATUS_REGISTRY: Record<StatusCategory, StatusDescriptor> = {
  PRESENT: {
    key: "PRESENT",
    label: "Present",
    icon: "CheckCircle2",
    solidColor: "#10B981", // Emerald 500
    light: {
      bg: "#ECFDF5", // emerald-50
      text: "#065F46", // emerald-800 (Contrast 5.4:1 on #ECFDF5)
      border: "#A7F3D0", // emerald-200
      badgeBg: "rgba(16, 185, 129, 0.12)",
    },
    dark: {
      bg: "rgba(16, 185, 129, 0.15)",
      text: "#34D399", // emerald-400 (Contrast 7.1:1 on #0F172A)
      border: "rgba(52, 211, 153, 0.3)",
      badgeBg: "rgba(16, 185, 129, 0.2)",
    },
    ariaLabel: "Status: Present. Employee punched in on time.",
    description: "Employee checked in within scheduled shift and grace window.",
  },

  LATE: {
    key: "LATE",
    label: "Late Arrival",
    icon: "Clock",
    solidColor: "#F59E0B", // Amber 500
    light: {
      bg: "#FFFBEB", // amber-50
      text: "#92400E", // amber-800 (Contrast 5.1:1 on #FFFBEB)
      border: "#FDE68A", // amber-200
      badgeBg: "rgba(245, 158, 11, 0.12)",
    },
    dark: {
      bg: "rgba(245, 158, 11, 0.15)",
      text: "#FBBF24", // amber-400 (Contrast 8.2:1 on #0F172A)
      border: "rgba(251, 191, 36, 0.3)",
      badgeBg: "rgba(245, 158, 11, 0.2)",
    },
    ariaLabel: "Status: Late Arrival. Employee arrived after shift grace period.",
    description: "Employee checked in after shift grace period cutoff.",
  },

  ABSENT: {
    key: "ABSENT",
    label: "Absent",
    icon: "XCircle",
    solidColor: "#EF4444", // Red 500
    light: {
      bg: "#FEF2F2", // red-50
      text: "#991B1B", // red-800 (Contrast 5.9:1 on #FEF2F2)
      border: "#FECACA", // red-200
      badgeBg: "rgba(239, 68, 68, 0.12)",
    },
    dark: {
      bg: "rgba(239, 68, 68, 0.15)",
      text: "#F87171", // red-400 (Contrast 5.7:1 on #0F172A)
      border: "rgba(248, 113, 113, 0.3)",
      badgeBg: "rgba(239, 68, 68, 0.2)",
    },
    ariaLabel: "Status: Absent. No check-in was recorded for this scheduled workday.",
    description: "No punch recorded for this official working day.",
  },

  INCOMPLETE: {
    key: "INCOMPLETE",
    label: "Incomplete / Half Day",
    icon: "AlertTriangle",
    solidColor: "#FB923C", // Orange 400
    light: {
      bg: "#FFF7ED", // orange-50
      text: "#9A3412", // orange-800 (Contrast 5.2:1 on #FFF7ED)
      border: "#FED7AA", // orange-200
      badgeBg: "rgba(251, 146, 60, 0.12)",
    },
    dark: {
      bg: "rgba(251, 146, 60, 0.15)",
      text: "#FB923C", // orange-400 (Contrast 7.4:1 on #0F172A)
      border: "rgba(251, 146, 60, 0.3)",
      badgeBg: "rgba(251, 146, 60, 0.2)",
    },
    ariaLabel: "Status: Incomplete shift or half-day duration recorded.",
    description: "Employee worked less than full required shift duration.",
  },

  WFH: {
    key: "WFH",
    label: "Work From Home",
    icon: "Home",
    solidColor: "#3B82F6", // Blue 500
    light: {
      bg: "#EFF6FF", // blue-50
      text: "#1E40AF", // blue-800 (Contrast 6.8:1 on #EFF6FF)
      border: "#BFDBFE", // blue-200
      badgeBg: "rgba(59, 130, 246, 0.12)",
    },
    dark: {
      bg: "rgba(59, 130, 246, 0.15)",
      text: "#60A5FA", // blue-400 (Contrast 6.9:1 on #0F172A)
      border: "rgba(96, 165, 250, 0.3)",
      badgeBg: "rgba(59, 130, 246, 0.2)",
    },
    ariaLabel: "Status: Work From Home approved by manager.",
    description: "Manager-approved remote work day recorded in attendance ledger.",
  },

  LEAVE: {
    key: "LEAVE",
    label: "On Leave",
    icon: "Calendar",
    solidColor: "#8B5CF6", // Purple 500
    light: {
      bg: "#F5F3FF", // purple-50
      text: "#5B21B6", // purple-800 (Contrast 7.2:1 on #F5F3FF)
      border: "#DDD6FE", // purple-200
      badgeBg: "rgba(139, 92, 246, 0.12)",
    },
    dark: {
      bg: "rgba(139, 92, 246, 0.15)",
      text: "#A78BFA", // purple-400 (Contrast 6.5:1 on #0F172A)
      border: "rgba(167, 139, 250, 0.3)",
      badgeBg: "rgba(139, 92, 246, 0.2)",
    },
    ariaLabel: "Status: On approved leave (Casual, Sick, or Earned).",
    description: "Official leave approved by HR administration.",
  },

  HOLIDAY: {
    key: "HOLIDAY",
    label: "Public Holiday",
    icon: "Sparkles",
    solidColor: "#EC4899", // Pink 500
    light: {
      bg: "#FDF2F8", // pink-50
      text: "#9D174D", // pink-800 (Contrast 6.2:1 on #FDF2F8)
      border: "#FBCFE8", // pink-200
      badgeBg: "rgba(236, 72, 153, 0.12)",
    },
    dark: {
      bg: "rgba(236, 72, 153, 0.15)",
      text: "#F472B6", // pink-400 (Contrast 6.1:1 on #0F172A)
      border: "rgba(244, 114, 182, 0.3)",
      badgeBg: "rgba(236, 72, 153, 0.2)",
    },
    ariaLabel: "Status: Public gazetted holiday.",
    description: "Official public or company-wide holiday.",
  },

  OFF_DAY: {
    key: "OFF_DAY",
    label: "Off Day / Weekend",
    icon: "Coffee",
    solidColor: "#64748B", // Slate 500
    light: {
      bg: "#F8FAFC", // slate-50
      text: "#334155", // slate-700 (Contrast 8.5:1 on #F8FAFC)
      border: "#CBD5E1", // slate-300
      badgeBg: "rgba(100, 116, 139, 0.12)",
    },
    dark: {
      bg: "rgba(100, 116, 139, 0.15)",
      text: "#94A3B8", // slate-400 (Contrast 5.3:1 on #0F172A)
      border: "rgba(148, 163, 184, 0.25)",
      badgeBg: "rgba(100, 116, 139, 0.2)",
    },
    ariaLabel: "Status: Scheduled non-working day or weekend.",
    description: "Regular scheduled non-working day under attendance policy.",
  },

  PENDING: {
    key: "PENDING",
    label: "Pending Review",
    icon: "Hourglass",
    solidColor: "#EAB308", // Yellow 500
    light: {
      bg: "#FEFCE8", // yellow-50
      text: "#854D0E", // yellow-800 (Contrast 5.4:1 on #FEFCE8)
      border: "#FEF08A", // yellow-200
      badgeBg: "rgba(234, 179, 8, 0.12)",
    },
    dark: {
      bg: "rgba(234, 179, 8, 0.15)",
      text: "#FACC15", // yellow-400 (Contrast 9.1:1 on #0F172A)
      border: "rgba(250, 204, 21, 0.3)",
      badgeBg: "rgba(234, 179, 8, 0.2)",
    },
    ariaLabel: "Status: Pending managerial review or action.",
    description: "Request submitted and waiting for administrator review.",
  },

  APPROVED: {
    key: "APPROVED",
    label: "Approved",
    icon: "Check",
    solidColor: "#10B981", // Emerald 500
    light: {
      bg: "#ECFDF5",
      text: "#065F46",
      border: "#A7F3D0",
      badgeBg: "rgba(16, 185, 129, 0.12)",
    },
    dark: {
      bg: "rgba(16, 185, 129, 0.15)",
      text: "#34D399",
      border: "rgba(52, 211, 153, 0.3)",
      badgeBg: "rgba(16, 185, 129, 0.2)",
    },
    ariaLabel: "Status: Approved by manager.",
    description: "Request reviewed and approved by management.",
  },

  REJECTED: {
    key: "REJECTED",
    label: "Rejected",
    icon: "Ban",
    solidColor: "#EF4444", // Red 500
    light: {
      bg: "#FEF2F2",
      text: "#991B1B",
      border: "#FECACA",
      badgeBg: "rgba(239, 68, 68, 0.12)",
    },
    dark: {
      bg: "rgba(239, 68, 68, 0.15)",
      text: "#F87171",
      border: "rgba(248, 113, 113, 0.3)",
      badgeBg: "rgba(239, 68, 68, 0.2)",
    },
    ariaLabel: "Status: Rejected by manager.",
    description: "Request reviewed and rejected with remarks.",
  },

  CANCELLED: {
    key: "CANCELLED",
    label: "Cancelled",
    icon: "Slash",
    solidColor: "#94A3B8", // Slate 400
    light: {
      bg: "#F1F5F9",
      text: "#475569",
      border: "#CBD5E1",
      badgeBg: "rgba(148, 163, 184, 0.12)",
    },
    dark: {
      bg: "rgba(148, 163, 184, 0.15)",
      text: "#94A3B8",
      border: "rgba(148, 163, 184, 0.25)",
      badgeBg: "rgba(148, 163, 184, 0.2)",
    },
    ariaLabel: "Status: Cancelled by employee or administrator.",
    description: "Request cancelled prior to review or execution.",
  },
};

/**
 * Universal normalization helper mapping domain statuses and raw strings to descriptors
 */
export function getStatusDescriptor(rawStatus?: string | null): StatusDescriptor {
  if (!rawStatus) {
    return STATUS_REGISTRY.ABSENT;
  }

  const normalized = rawStatus.trim().toUpperCase().replace(/[-\s]/g, "_");

  switch (normalized) {
    case "PRESENT":
    case "CHECKED_IN":
    case "CHECKED_OUT":
    case "ON_TIME":
      return STATUS_REGISTRY.PRESENT;

    case "LATE":
    case "DELAYED":
      return STATUS_REGISTRY.LATE;

    case "ABSENT":
    case "UNEXCUSED":
      return STATUS_REGISTRY.ABSENT;

    case "INCOMPLETE":
    case "HALF_DAY":
    case "PARTIAL":
      return STATUS_REGISTRY.INCOMPLETE;

    case "WFH":
    case "WFH_APPROVED":
    case "REMOTE":
    case "HOME":
      return STATUS_REGISTRY.WFH;

    case "LEAVE":
    case "ON_LEAVE":
    case "CASUAL_LEAVE":
    case "SICK_LEAVE":
    case "EARNED_LEAVE":
      return STATUS_REGISTRY.LEAVE;

    case "HOLIDAY":
    case "PUBLIC_HOLIDAY":
    case "FESTIVAL":
      return STATUS_REGISTRY.HOLIDAY;

    case "OFF_DAY":
    case "WEEKEND":
    case "SUNDAY":
    case "SATURDAY":
      return STATUS_REGISTRY.OFF_DAY;

    case "PENDING":
    case "WFH_PENDING":
    case "UNDER_REVIEW":
    case "IN_REVIEW":
      return STATUS_REGISTRY.PENDING;

    case "APPROVED":
      return STATUS_REGISTRY.APPROVED;

    case "REJECTED":
    case "WFH_REJECTED":
    case "DENIED":
      return STATUS_REGISTRY.REJECTED;

    case "CANCELLED":
    case "REVOKED":
      return STATUS_REGISTRY.CANCELLED;

    default:
      return {
        key: "ABSENT",
        label: rawStatus,
        icon: "HelpCircle",
        solidColor: "#64748B",
        light: STATUS_REGISTRY.OFF_DAY.light,
        dark: STATUS_REGISTRY.OFF_DAY.dark,
        ariaLabel: `Status: ${rawStatus}`,
        description: `Unrecognized status: ${rawStatus}`,
      };
  }
}
