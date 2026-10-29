import React, { useState, useEffect } from 'react';
import {
  View,
  StyleSheet,
  Alert,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  Briefcase,
  Building2,
  CalendarDays,
  Clock3,
  Globe2,
  Hash,
  LogOut,
  Mail,
  ShieldCheck,
  UserCheck,
  type LucideIcon,
} from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../../src/context/AuthContext';
import { useToast } from '../../src/components/Toast';
import {
  Screen,
  Card,
  Button,
  Badge,
  PageHeader,
  SectionHeader,
  Avatar,
  Text,
} from '../../src/components';
import { colors, spacing } from '../../src/theme/tokens';
import { useResponsive } from '../../src/lib/responsive';
import {
  employeeApi,
  policyApi,
  EmployeeDetails,
  PolicyData,
} from '../../src/services';

function InfoRow({
  icon: Icon,
  label,
  value,
  last = false,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.infoRow, !last ? styles.rowDivider : null]}>
      <View style={styles.infoLeft}>
        <View style={styles.infoIconWrap}>
          <Icon size={16} color={colors.indigoSoft} strokeWidth={1.8} />
        </View>
        <Text variant="small" color={colors.textSecondary}>
          {label}
        </Text>
      </View>
      <Text variant="small" color={colors.text} weight="semibold" style={styles.infoValue}>
        {value}
      </Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { showToast } = useToast();
  const { isWide } = useResponsive();
  const [loggingOut, setLoggingOut] = useState(false);

  const [employeeDetails, setEmployeeDetails] = useState<EmployeeDetails | null>(null);
  const [policyData, setPolicyData] = useState<PolicyData | null>(null);

  useEffect(() => {
    let isMounted = true;
    Promise.allSettled([employeeApi.getMyProfile(), policyApi.getPolicy()])
      .then(([empRes, polRes]) => {
        if (!isMounted) return;
        if (empRes.status === 'fulfilled' && empRes.value.data) {
          setEmployeeDetails(empRes.value.data);
        }
        if (polRes.status === 'fulfilled' && polRes.value.data) {
          setPolicyData(polRes.value.data);
        }
      })
      .catch(() => {});

    return () => {
      isMounted = false;
    };
  }, []);

  const handleLogout = () => {
    const performLogout = async () => {
      setLoggingOut(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => undefined);
      try {
        await logout();
        showToast({
          title: 'Signed Out',
          message: 'You have been safely signed out.',
          type: 'info',
        });
      } catch (err) {
        console.error('Logout error:', err);
      } finally {
        setLoggingOut(false);
        if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location) {
          window.location.href = '/';
        } else {
          router.replace('/');
        }
      }
    };

    if (Platform.OS === 'web') {
      const confirmed =
        typeof window !== 'undefined' && window.confirm
          ? window.confirm('Sign out of VorldX?\nYou will need your work credentials to sign in again.')
          : true;
      if (confirmed) {
        void performLogout();
      }
    } else {
      Alert.alert(
        'Sign out of VorldX?',
        'You will need your work credentials to sign in again.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Sign out',
            style: 'destructive',
            onPress: () => {
              void performLogout();
            },
          },
        ]
      );
    }
  };

  const shift = policyData?.shifts?.[0];
  const workdaysStr = policyData?.workdays
    ? policyData.workdays
        .map((d) => ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d])
        .join(', ')
    : 'Mon, Tue, Wed, Thu, Fri';

  const joiningFormatted = employeeDetails?.joiningDate
    ? new Date(employeeDetails.joiningDate).toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    : 'March 1, 2024';

  return (
    <Screen edges={['top', 'bottom']}>
      <PageHeader
        eyebrow="VorldX Operations"
        title={user?.name ?? 'Your Profile'}
        subtitle={employeeDetails?.designation || user?.department || 'Employee Profile'}
        right={<Avatar name={user?.name ?? 'VX'} showRing size={48} />}
      />

      <View style={[styles.container, isWide && styles.containerWide]}>
        {/* 1. Identity Card */}
        <Card style={styles.identityCard} variant="raised" padding={20}>
          <View style={styles.identityRow}>
            <Avatar name={user?.name ?? 'VX'} size={68} />
            <View style={styles.identityCopy}>
              <Text variant="subheading" numberOfLines={1}>
                {user?.name ?? 'VorldX Employee'}
              </Text>
              <Text variant="small" color={colors.textSecondary} numberOfLines={1}>
                {user?.employeeId} · {user?.email}
              </Text>
              <View style={styles.badgeRow}>
                <Badge dot label={user?.role || 'EMPLOYEE'} tone="indigo" />
                <Badge label="VERIFIED" tone="success" dot />
              </View>
            </View>
          </View>
        </Card>

        {/* 2. Work Details Section */}
        <SectionHeader title="Profile details" caption="Read-only in the mobile app" />
        <Card padding={0}>
          <InfoRow icon={Hash} label="Employee ID" value={user?.employeeId ?? '—'} />
          <InfoRow icon={Mail} label="Work email" value={user?.email ?? '—'} />
          <InfoRow
            icon={Briefcase}
            label="Department"
            value={employeeDetails?.department || user?.department || 'Engineering'}
          />
          <InfoRow
            icon={Building2}
            label="Designation"
            value={employeeDetails?.designation || 'Software Engineer'}
          />
          <InfoRow
            icon={UserCheck}
            label="Employment type"
            value={employeeDetails?.workType || 'Full-Time'}
          />
          <InfoRow icon={CalendarDays} label="Joining date" value={joiningFormatted} last />
        </Card>

        {/* 3. Assigned Shift & Policy Card */}
        <SectionHeader title="Shift specifications" caption="Company attendance policy" />
        <Card padding={0}>
          <InfoRow
            icon={Clock3}
            label="Shift timings"
            value={shift ? `${shift.startTime} – ${shift.endTime}` : '09:30 AM – 06:30 PM'}
          />
          <InfoRow
            icon={ShieldCheck}
            label="Grace period"
            value={shift ? `${shift.graceMinutes} minutes` : '15 minutes'}
          />
          <InfoRow icon={Globe2} label="Working days" value={workdaysStr} last />
        </Card>

        {/* 4. Actions & Sign Out */}
        <View style={styles.actionsSection}>
          <Button
            icon={<LogOut size={16} color={colors.danger} />}
            label={loggingOut ? 'Signing out...' : 'Sign out of VorldX'}
            loading={loggingOut}
            onPress={handleLogout}
            variant="danger"
          />
          <Text variant="caption" color={colors.muted} align="center">
            VorldX Attendance · v0.1.0 · Build 2026
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    gap: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  containerWide: {
    maxWidth: 580,
    alignSelf: 'center',
  },
  identityCard: {
    width: '100%',
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
  },
  identityCopy: {
    flex: 1,
    gap: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 4,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  rowDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  infoIconWrap: {
    width: 28,
    height: 28,
    borderRadius: 6,
    backgroundColor: 'rgba(89, 101, 242, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoValue: {
    textAlign: 'right',
  },
  actionsSection: {
    gap: spacing.md,
    marginTop: spacing.md,
  },
});
