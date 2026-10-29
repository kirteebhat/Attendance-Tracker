import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { Hash, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../src/context/AuthContext';
import {
  Screen,
  Card,
  Input,
  Field,
  Button,
  Badge,
  Notice,
  Text,
  PageHeader,
  PressableScale,
} from '../src/components';
import { colors, radii, spacing } from '../src/theme/tokens';
import { useResponsive } from '../src/lib/responsive';
import { ApiError } from '../src/services/api';

export default function RegisterScreen() {
  const router = useRouter();
  const { registerStart } = useAuth();
  const { isWide } = useResponsive();

  const [employeeId, setEmployeeId] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartRegistration = async () => {
    const cleanId = employeeId.trim().toUpperCase();
    if (!cleanId) {
      setError('Please enter your employee ID.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await registerStart(cleanId);
      const raw = res as unknown as Record<string, string | undefined>;
      const targetEmpId = res.data?.employeeId || raw.employeeId || cleanId;
      const targetEmail = res.data?.maskedEmail || raw.maskedEmail || raw.email || 'registered email';
      const targetOtp = res.data?.simulatedOtp || raw.simulatedDemoOtp || raw.simulatedOtp || '';

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);

      router.push({
        pathname: '/verify-otp',
        params: {
          employeeId: targetEmpId,
          maskedEmail: targetEmail,
          simulatedOtp: targetOtp,
        },
      });
    } catch (err: unknown) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      if (err instanceof ApiError) {
        if (err.code === 'ERR_EMPLOYEE_NOT_FOUND') {
          setError(`No employee record found for ID "${cleanId}". Check your offer letter or verify with HR.`);
        } else if (err.code === 'ERR_ACCOUNT_ALREADY_REGISTERED') {
          setError(`An account is already registered for "${cleanId}". Please sign in with your password.`);
        } else if (err.code === 'ERR_EMPLOYEE_INACTIVE') {
          setError(`Employee "${cleanId}" is marked inactive. Contact HR to restore your account.`);
        } else {
          setError(err.message || 'Failed to start registration.');
        }
      } else {
        setError('Unable to connect to VorldX attendance server.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fillDemoId = () => {
    setEmployeeId('EMP-1003');
    setError(null);
    void Haptics.selectionAsync().catch(() => undefined);
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={[styles.content, isWide && styles.contentWide]}>
        {/* Back Link */}
        <TouchableOpacity
          onPress={() => {
            if (router.canGoBack()) router.back();
            else router.replace('/login');
          }}
          style={styles.backLink}
        >
          <ArrowLeft size={16} color={colors.textSecondary} />
          <Text variant="small" color={colors.textSecondary}>
            Back
          </Text>
        </TouchableOpacity>

        <View style={styles.stepBadge}>
          <Badge label="Step 1 of 3" tone="indigo" dot />
        </View>

        <PageHeader
          title="Activate Account"
          subtitle="Enter your official VorldX Employee ID to initiate verification."
        />

        <Card style={styles.card} padding={22} variant="raised">
          {error ? <Notice tone="danger" title="Lookup Failed" message={error} /> : null}

          <Field label="Employee ID" required hint="Found on your ID badge or employment letter">
            <Input
              autoCapitalize="characters"
              autoCorrect={false}
              leftIcon={Hash}
              onChangeText={(val) => {
                setEmployeeId(val);
                if (error) setError(null);
              }}
              placeholder="e.g. EMP-1003"
              returnKeyType="go"
              onSubmitEditing={handleStartRegistration}
              value={employeeId}
            />
          </Field>

          {/* Demo ID filler */}
          <PressableScale
            accessibilityRole="button"
            haptic="selection"
            onPress={fillDemoId}
            style={styles.demoPill}
          >
            <Sparkles size={14} color={colors.indigoSoft} />
            <Text variant="small" color={colors.indigoSoft} weight="medium">
              Use demo ID (EMP-1003)
            </Text>
          </PressableScale>

          <Button
            label={loading ? 'Verifying ID...' : 'Continue to OTP'}
            loading={loading}
            onPress={handleStartRegistration}
            rightIcon={
              loading ? undefined : <ArrowRight size={17} color={colors.white} strokeWidth={2.2} />
            }
          />
        </Card>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 460,
    gap: spacing.md,
    alignSelf: 'center',
    paddingVertical: spacing.md,
  },
  contentWide: {
    maxWidth: 520,
  },
  backLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 4,
  },
  stepBadge: {
    marginTop: spacing.xs,
  },
  card: {
    gap: spacing.lg,
    marginTop: spacing.sm,
  },
  demoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(89, 101, 242, 0.08)',
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: 'rgba(89, 101, 242, 0.2)',
  },
});
