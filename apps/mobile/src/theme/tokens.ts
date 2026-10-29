import { STATUS_REGISTRY, getStatusDescriptor, StatusCategory } from "@vorldx/shared";

export { STATUS_REGISTRY, getStatusDescriptor, type StatusCategory };

export function getMobileStatusTheme(status: string | StatusCategory) {
  const descriptor = getStatusDescriptor(status);
  return {
    label: descriptor.label,
    icon: descriptor.icon,
    solidColor: descriptor.solidColor,
    color: descriptor.dark.text,
    bg: descriptor.dark.bg,
    border: descriptor.dark.border,
    ariaLabel: descriptor.ariaLabel,
  };
}

export const colors = {
  background: {
    base: "#070D1E", // Deepest midnight navy
    surface: "#0B132B", // Primary card & surface background
    elevated: "#111C38", // Elevated cards & modals
    hover: "#1C2541", // Interactive slate
    border: "#243254", // Border slate
    borderLight: "#3A506B",
  },
  border: {
    subtle: "#243254", // Border slate
    light: "#3A506B",
    active: "#06B6D4",
    accent: "#06B6D4",
  },
  accent: {
    blue: "#2563EB", // Primary electric blue
    blueHover: "#1D4ED8",
    cyan: "#06B6D4", // Vibrant cyan accent
    cyanMuted: "rgba(6, 182, 212, 0.15)",
    indigo: "#6366F1", // Indigo accent
    indigoMuted: "rgba(99, 102, 241, 0.15)",
  },
  status: {
    present: "#10B981", // Emerald
    presentBg: "rgba(16, 185, 129, 0.15)",
    late: "#F59E0B", // Amber
    lateBg: "rgba(245, 158, 11, 0.15)",
    absent: "#EF4444", // Rose
    absentBg: "rgba(239, 68, 68, 0.15)",
    wfh: "#6366F1", // Indigo
    wfhBg: "rgba(99, 102, 241, 0.15)",
    leave: "#06B6D4", // Cyan
    leaveBg: "rgba(6, 182, 212, 0.15)",
    holiday: "#8B5CF6", // Purple
    holidayBg: "rgba(139, 92, 246, 0.15)",
    pending: "#F59E0B", // Amber
    pendingBg: "rgba(245, 158, 11, 0.15)",
    approved: "#10B981", // Emerald
    approvedBg: "rgba(16, 185, 129, 0.15)",
    rejected: "#EF4444", // Rose
    rejectedBg: "rgba(239, 68, 68, 0.15)",
    demo: "#8B5CF6", // Violet demo badge
    demoBg: "rgba(139, 92, 246, 0.15)",
    warning: "#F59E0B",
    danger: "#EF4444",
    success: "#10B981",
  },
  text: {
    primary: "#F8FAFC", // High contrast white
    secondary: "#94A3B8", // Slate secondary
    muted: "#64748B", // Dim slate
    accent: "#38BDF8", // Sky blue text accent
    danger: "#F87171", // Rose error text
    success: "#34D399", // Emerald success text
  },
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radii = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  full: 9999,
} as const;

export const typography = {
  xs: { fontSize: 11, lineHeight: 15 },
  sm: { fontSize: 13, lineHeight: 18 },
  md: { fontSize: 15, lineHeight: 21 },
  lg: { fontSize: 17, lineHeight: 24 },
  xl: { fontSize: 20, lineHeight: 28 },
  xxl: { fontSize: 24, lineHeight: 32 },
  hero: { fontSize: 32, lineHeight: 40 },
  sizes: {
    xs: 11,
    sm: 13,
    md: 15,
    lg: 17,
    xl: 20,
    xxl: 24,
  },
} as const;

export const shadows = {
  card: {
    shadowColor: "#000000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  glowBlue: {
    shadowColor: "#2563EB",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  glowCyan: {
    shadowColor: "#06B6D4",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

