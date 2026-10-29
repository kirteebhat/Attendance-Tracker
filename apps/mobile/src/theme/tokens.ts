import { Platform } from 'react-native';
import { STATUS_REGISTRY, getStatusDescriptor, type StatusCategory } from '@vorldx/shared';

export { STATUS_REGISTRY, getStatusDescriptor, type StatusCategory };

// -----------------------------------------------------------------------------
// Safal's Cyberpunk / Liquid Glass Color Palette
// -----------------------------------------------------------------------------
export const colors = {
  bg: '#07080E',
  bgRaised: '#0D101B',
  sidebar: '#0A0C15',
  surface: 'rgba(20, 23, 39, 0.72)',
  surfaceStrong: 'rgba(17, 20, 34, 0.94)',
  surfaceSoft: 'rgba(30, 34, 56, 0.45)',
  indigoDeep: '#1D2158',
  indigo: '#5965F2',
  indigoSoft: '#8C95FF',
  lavender: '#9194BA',
  text: '#F4F5FF',
  textSecondary: '#B3B7CE',
  muted: '#7E849E',
  success: '#45D6A6',
  warning: '#F5C76B',
  danger: '#FF6B83',
  info: '#76B8FF',
  leave: '#C4A7FF',
  border: 'rgba(184, 190, 255, 0.13)',
  borderActive: 'rgba(133, 145, 255, 0.42)',
  white: '#FFFFFF',
  black: '#000000',

  // Backward-compatible nested mappings for existing colleague references
  background: {
    base: '#07080E',
    surface: 'rgba(20, 23, 39, 0.72)',
    elevated: 'rgba(17, 20, 34, 0.94)',
    hover: 'rgba(30, 34, 56, 0.45)',
    border: 'rgba(184, 190, 255, 0.13)',
    borderLight: 'rgba(184, 190, 255, 0.22)',
  },
  accent: {
    blue: '#5965F2',
    blueHover: '#4A55DB',
    cyan: '#76B8FF',
    cyanMuted: 'rgba(118, 184, 255, 0.15)',
    indigo: '#5965F2',
    indigoMuted: 'rgba(89, 101, 242, 0.15)',
  },
  status: {
    present: '#45D6A6',
    presentBg: 'rgba(69, 214, 166, 0.14)',
    late: '#F5C76B',
    lateBg: 'rgba(245, 199, 107, 0.14)',
    absent: '#FF6B83',
    absentBg: 'rgba(255, 107, 131, 0.14)',
    wfh: '#76B8FF',
    wfhBg: 'rgba(118, 184, 255, 0.14)',
    demo: '#C4A7FF',
    demoBg: 'rgba(196, 167, 255, 0.14)',
  },
} as const;

export const alpha = {
  indigo08: 'rgba(89, 101, 242, 0.08)',
  indigo12: 'rgba(89, 101, 242, 0.12)',
  indigo18: 'rgba(89, 101, 242, 0.18)',
  success12: 'rgba(69, 214, 166, 0.12)',
  warning12: 'rgba(245, 199, 107, 0.12)',
  danger12: 'rgba(255, 107, 131, 0.12)',
  info12: 'rgba(118, 184, 255, 0.12)',
  leave12: 'rgba(196, 167, 255, 0.12)',
  white06: 'rgba(255, 255, 255, 0.06)',
  white10: 'rgba(255, 255, 255, 0.1)',
} as const;

export const gradients = {
  primary: ['#5965F2', '#7B79FF'] as const,
  primaryDeep: ['#3E48C9', '#5965F2'] as const,
  orb: ['#1D2158', '#5965F2'] as const,
  success: ['#2CB68B', '#45D6A6'] as const,
  danger: ['#D94261', '#FF6B83'] as const,
  screen: ['#07080E', '#0A0C17', '#07080E'] as const,
  card: ['rgba(31, 35, 61, 0.78)', 'rgba(14, 17, 30, 0.72)'] as const,
} as const;

export const fonts = {
  regular: 'PlusJakartaSans_400Regular',
  medium: 'PlusJakartaSans_500Medium',
  semibold: 'PlusJakartaSans_600SemiBold',
  bold: 'PlusJakartaSans_700Bold',
  mono: 'SpaceMono_400Regular',
  monoBold: 'SpaceMono_700Bold',
} as const;

export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 40,
  giant: 56,
} as const;

export const radii = {
  xs: 6,
  sm: 10,
  md: 14,
  lg: 18,
  xl: 24,
  xxl: 30,
  pill: 999,
  full: 9999,
} as const;

export const layout = {
  maxWidth: 760,
  phoneGutter: 18,
  tabBarHeight: 62,
  sidebarWidth: 104,
} as const;

export const shadows = {
  card: Platform.select({
    ios: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 18 },
      shadowOpacity: 0.28,
      shadowRadius: 28,
    },
    android: { elevation: 4 },
    default: {},
  }),
  glow: Platform.select({
    ios: {
      shadowColor: colors.indigo,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.45,
      shadowRadius: 24,
    },
    android: { elevation: 8 },
    default: {},
  }),
  glowBlue: {
    shadowColor: '#5965F2',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
} as const;

export const tones = {
  neutral: { fg: colors.textSecondary, bg: alpha.white06, border: colors.border },
  indigo: { fg: colors.indigoSoft, bg: alpha.indigo12, border: 'rgba(89, 101, 242, 0.32)' },
  success: { fg: colors.success, bg: alpha.success12, border: 'rgba(69, 214, 166, 0.3)' },
  warning: { fg: colors.warning, bg: alpha.warning12, border: 'rgba(245, 199, 107, 0.3)' },
  danger: { fg: colors.danger, bg: alpha.danger12, border: 'rgba(255, 107, 131, 0.3)' },
  info: { fg: colors.info, bg: alpha.info12, border: 'rgba(118, 184, 255, 0.3)' },
  leave: { fg: colors.leave, bg: alpha.leave12, border: 'rgba(196, 167, 255, 0.3)' },
} as const;

export type Tone = keyof typeof tones;

export const typography = {
  xs: { fontSize: 11, lineHeight: 15, fontFamily: fonts.regular },
  sm: { fontSize: 13, lineHeight: 18, fontFamily: fonts.regular },
  md: { fontSize: 15, lineHeight: 21, fontFamily: fonts.regular },
  lg: { fontSize: 17, lineHeight: 24, fontFamily: fonts.medium },
  xl: { fontSize: 20, lineHeight: 28, fontFamily: fonts.semibold },
  xxl: { fontSize: 24, lineHeight: 32, fontFamily: fonts.bold },
  hero: { fontSize: 32, lineHeight: 40, fontFamily: fonts.bold },
} as const;

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
