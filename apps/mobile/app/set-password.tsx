import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Lock, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../src/context/AuthContext';
import { useToast } from '../src/components/Toast';
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
} from '../src/components';
import { colors, radii, spacing } from '../src/theme/tokens';
import { useResponsive } from '../src/lib/responsive';
import { ApiError } from '../src/services/api';

export default function SetPasswordScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    employeeId: string;
    verificationToken: string;
  }>();

  const { registerComplete } = useAuth();
  const { showToast } = useToast();
  const { isWide } = useResponsive();

  const employeeId = params.employeeId || '';
  const verificationToken = params.verificationToken || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSetPassword = async () => {
    if (!password) {
      setError('Please enter a password.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long.');
      return;
    }

    const hasUpper = /[A-Z]/.test(password);
    const hasLower = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);

    if (!hasUpper || !hasLower || !hasNumber || !hasSpecial) {
      setError('Password must contain uppercase, lowercase, a number, and a special character.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await registerComplete(employeeId, verificationToken, password);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      showToast({
        title: 'Account Activated',
        message: 'Your password is set and your account is ready!',
        type: 'success',
      });
      router.replace('/(tabs)/home');
    } catch (err: unknown) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      if (err instanceof ApiError) {
        if (err.code === 'ERR_VERIFICATION_TOKEN_EXPIRED') {
          setError('Session expired. Please restart the registration process.');
        } else {
          setError(err.message || 'Failed to complete registration.');
        }
      } else {
        setError('Unable to connect to VorldX attendance server.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={[styles.content, isWide && styles.contentWide]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <ArrowLeft size={16} color={colors.textSecondary} />
          <Text variant="small" color={colors.textSecondary}>
            Back to Step 2
          </Text>
        </TouchableOpacity>

        <View style={styles.stepBadge}>
          <Badge label="Step 3 of 3" tone="success" dot />
        </View>

        <PageHeader
          title="Create Password"
          subtitle="Choose a secure password to finalize your account activation."
        />

        <Card style={styles.card} padding={22} variant="raised">
          {error ? <Notice tone="danger" title="Password Error" message={error} /> : null}

          <Field label="New Password" required hint="Minimum 8 characters with symbols">
            <Input
              autoCapitalize="none"
              leftIcon={Lock}
              isPassword
              onChangeText={(val) => {
                setPassword(val);
                if (error) setError(null);
              }}
              placeholder="Enter new password"
              returnKeyType="next"
              value={password}
            />
          </Field>

          <Field label="Confirm Password" required>
            <Input
              autoCapitalize="none"
              leftIcon={Lock}
              isPassword
              onChangeText={(val) => {
                setConfirmPassword(val);
                if (error) setError(null);
              }}
              placeholder="Confirm new password"
              returnKeyType="go"
              onSubmitEditing={handleSetPassword}
              value={confirmPassword}
            />
          </Field>

          {/* Password criteria cues */}
          <View style={styles.criteriaCard}>
            <Text variant="caption" color={colors.muted}>
              Password Requirements
            </Text>
            <View style={styles.criteriaRow}>
              <CheckCircle2
                size={14}
                color={password.length >= 8 ? colors.success : colors.muted}
              />
              <Text
                variant="small"
                color={password.length >= 8 ? colors.text : colors.muted}
              >
                At least 8 characters
              </Text>
            </View>
            <View style={styles.criteriaRow}>
              <CheckCircle2
                size={14}
                color={
                  /[A-Z]/.test(password) && /[a-z]/.test(password)
                    ? colors.success
                    : colors.muted
                }
              />
              <Text
                variant="small"
                color={
                  /[A-Z]/.test(password) && /[a-z]/.test(password)
                    ? colors.text
                    : colors.muted
                }
              >
                Uppercase & lowercase letters
              </Text>
            </View>
            <View style={styles.criteriaRow}>
              <CheckCircle2
                size={14}
                color={
                  /[0-9]/.test(password) && /[!@#$%^&*]/.test(password)
                    ? colors.success
                    : colors.muted
                }
              />
              <Text
                variant="small"
                color={
                  /[0-9]/.test(password) && /[!@#$%^&*]/.test(password)
                    ? colors.text
                    : colors.muted
                }
              >
                Number and special symbol (!@#$%^&*)
              </Text>
            </View>
          </View>

          <Button
            label={loading ? 'Activating Account...' : 'Complete Activation'}
            loading={loading}
            onPress={handleSetPassword}
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
  criteriaCard: {
    gap: 8,
    padding: spacing.md,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 1,
    borderColor: 'rgba(184, 190, 255, 0.08)',
  },
  criteriaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});
