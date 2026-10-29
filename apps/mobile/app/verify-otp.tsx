import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { KeyRound, ArrowRight, ArrowLeft, Sparkles } from 'lucide-react-native';
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

export default function VerifyOtpScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    employeeId: string;
    maskedEmail: string;
    simulatedOtp?: string;
  }>();

  const { registerVerify, registerStart } = useAuth();
  const { isWide } = useResponsive();

  const employeeId = params.employeeId || '';
  const maskedEmail = params.maskedEmail || 'your email';
  const initialSimulatedOtp = params.simulatedOtp || '';

  const [otp, setOtp] = useState('');
  const [currentSimulatedOtp, setCurrentSimulatedOtp] = useState(initialSimulatedOtp);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resendSuccess, setResendSuccess] = useState(false);

  const handleVerify = async () => {
    const cleanOtp = otp.trim();
    if (!cleanOtp || cleanOtp.length !== 6) {
      setError('Please enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await registerVerify(employeeId, cleanOtp);
      const raw = res as unknown as Record<string, string | undefined>;
      const verificationToken = res.data?.verificationToken || raw.verificationToken || '';

      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);

      router.push({
        pathname: '/set-password',
        params: {
          employeeId,
          verificationToken,
        },
      });
    } catch (err: unknown) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      if (err instanceof ApiError) {
        if (err.code === 'ERR_OTP_EXPIRED') {
          setError('Verification code has expired. Please tap "Resend Code" to get a new one.');
        } else if (err.code === 'ERR_INVALID_OTP') {
          setError('Invalid 6-digit verification code. Please check and try again.');
        } else {
          setError(err.message || 'Failed to verify code.');
        }
      } else {
        setError('Unable to connect to VorldX attendance server.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError(null);
    setResendSuccess(false);

    try {
      const res = await registerStart(employeeId);
      const raw = res as unknown as Record<string, string | undefined>;
      const targetOtp = res.data?.simulatedOtp || raw.simulatedDemoOtp || raw.simulatedOtp || '';
      if (targetOtp) setCurrentSimulatedOtp(targetOtp);
      setResendSuccess(true);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    } catch {
      setError('Failed to resend verification code. Please try again later.');
    } finally {
      setResending(false);
    }
  };

  const fillSimulatedOtp = () => {
    if (currentSimulatedOtp) {
      setOtp(currentSimulatedOtp);
      setError(null);
      void Haptics.selectionAsync().catch(() => undefined);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={[styles.content, isWide && styles.contentWide]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <ArrowLeft size={16} color={colors.textSecondary} />
          <Text variant="small" color={colors.textSecondary}>
            Back to Step 1
          </Text>
        </TouchableOpacity>

        <View style={styles.stepBadge}>
          <Badge label="Step 2 of 3" tone="indigo" dot />
        </View>

        <PageHeader
          title="Verify Identity"
          subtitle={`Enter the 6-digit OTP code sent to ${maskedEmail}`}
        />

        <Card style={styles.card} padding={22} variant="raised">
          {error ? <Notice tone="danger" title="Verification Failed" message={error} /> : null}
          {resendSuccess ? (
            <Notice tone="success" title="Code Resent" message="A new OTP has been dispatched." />
          ) : null}

          <Field label="6-Digit OTP" required hint="Code expires in 10 minutes">
            <Input
              autoCapitalize="none"
              keyboardType="number-pad"
              maxLength={6}
              leftIcon={KeyRound}
              onChangeText={(val) => {
                setOtp(val);
                if (error) setError(null);
              }}
              placeholder="000000"
              returnKeyType="go"
              onSubmitEditing={handleVerify}
              value={otp}
            />
          </Field>

          {/* Demo Simulated OTP pill */}
          {currentSimulatedOtp ? (
            <PressableScale
              accessibilityRole="button"
              haptic="selection"
              onPress={fillSimulatedOtp}
              style={styles.demoPill}
            >
              <Sparkles size={14} color={colors.indigoSoft} />
              <Text variant="small" color={colors.indigoSoft} weight="medium">
                Simulated demo OTP: {currentSimulatedOtp} (Tap to fill)
              </Text>
            </PressableScale>
          ) : null}

          <Button
            label={loading ? 'Verifying...' : 'Verify & Continue'}
            loading={loading}
            onPress={handleVerify}
            rightIcon={
              loading ? undefined : <ArrowRight size={17} color={colors.white} strokeWidth={2.2} />
            }
          />

          <View style={styles.resendRow}>
            <Text variant="small" color={colors.textSecondary}>
              Didn't receive code?
            </Text>
            <TouchableOpacity onPress={handleResend} disabled={resending} style={styles.resendBtn}>
              <Text variant="small" color={colors.indigoSoft} weight="semibold">
                {resending ? 'Sending...' : 'Resend Code'}
              </Text>
            </TouchableOpacity>
          </View>
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
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: spacing.xs,
  },
  resendBtn: {
    paddingVertical: 4,
  },
});
