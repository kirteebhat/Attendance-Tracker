import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, Lock, ArrowRight, ArrowLeft, Sparkles, Clock } from 'lucide-react-native';
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
  PressableScale,
} from '../src/components';
import { colors, radii, spacing } from '../src/theme/tokens';
import { useResponsive } from '../src/lib/responsive';
import { ApiError } from '../src/services/api';

export default function LoginScreen() {
  const router = useRouter();
  const { login, sessionExpired, dismissSessionExpired } = useAuth();
  const { showToast } = useToast();
  const { isWide } = useResponsive();

  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    const cleanId = identifier.trim();
    if (!cleanId) {
      setError('Please enter your employee email or ID.');
      return;
    }
    if (!password) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(cleanId, password);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
      showToast({
        title: 'Welcome Back',
        message: 'Logged in successfully.',
        type: 'success',
      });
      router.replace('/(tabs)/home');
    } catch (err: unknown) {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => undefined);
      if (err instanceof ApiError) {
        if (err.code === 'ERR_ACCOUNT_LOCKED') {
          setError('Account locked due to 5 consecutive failed attempts. Please wait 15 minutes or contact HR.');
        } else if (err.code === 'ERR_EMPLOYEE_INACTIVE') {
          setError('Your employee profile is inactive. Please contact HR administrator.');
        } else if (err.code === 'ERR_INVALID_CREDENTIALS') {
          setError('Invalid email/employee ID or password. Please verify and try again.');
        } else {
          setError(err.message || 'Failed to log in.');
        }
      } else {
        setError('Unable to connect to VorldX attendance server. Check your connection.');
      }
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setIdentifier('aarav.sharma@vorldx.demo');
    setPassword('Employee@2026!');
    setError(null);
    void Haptics.selectionAsync().catch(() => undefined);
  };

  return (
    <Screen edges={['top', 'bottom']} keyboardShouldPersistTaps="handled">
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.keyboardWrap}
      >
        <View style={[styles.content, isWide && styles.contentWide]}>
          {/* Back button */}
          <TouchableOpacity
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/');
            }}
            style={styles.backLink}
          >
            <ArrowLeft size={16} color={colors.textSecondary} />
            <Text variant="small" color={colors.textSecondary}>
              Back
            </Text>
          </TouchableOpacity>

          {/* Hero Section */}
          <View style={styles.hero}>
            <Badge label="Employee Attendance" tone="indigo" dot />
            <Text variant="display" style={styles.headline}>
              Your workday,{'\n'}in one place.
            </Text>
            <Text variant="body" color={colors.textSecondary} style={styles.heroSub}>
              Scan in at the office, check in from home, and keep your attendance and remote work requests together.
            </Text>
          </View>

          {/* Session Expired Banner */}
          {sessionExpired && (
            <Notice
              tone="warning"
              icon={<Clock size={18} color={colors.warning} />}
              title="Session Expired"
              message="Your security session has expired. Please sign in again to continue."
              actionLabel="Dismiss"
              onAction={dismissSessionExpired}
            />
          )}

          {/* Main Card */}
          <Card style={styles.card} padding={22} variant="raised">
            <View style={styles.formHeader}>
              <Text variant="title">Welcome back</Text>
              <Text variant="small" color={colors.muted}>
                Sign in with your employee email or ID.
              </Text>
            </View>

            {error ? (
              <Notice tone="danger" title="Could not sign in" message={error} />
            ) : null}

            <View style={styles.fields}>
              <Field label="Work email or Employee ID" required>
                <Input
                  autoCapitalize="none"
                  autoCorrect={false}
                  leftIcon={Mail}
                  onChangeText={(val) => {
                    setIdentifier(val);
                    if (error) setError(null);
                  }}
                  placeholder="e.g. EMP-1001 or aarav.sharma@vorldx.demo"
                  returnKeyType="next"
                  value={identifier}
                />
              </Field>

              <Field label="Password" required>
                <Input
                  autoCapitalize="none"
                  leftIcon={Lock}
                  isPassword
                  onChangeText={(val) => {
                    setPassword(val);
                    if (error) setError(null);
                  }}
                  onSubmitEditing={handleLogin}
                  placeholder="Your password"
                  returnKeyType="go"
                  value={password}
                />
              </Field>

              {/* Demo credentials helper pill */}
              <PressableScale
                accessibilityRole="button"
                haptic="selection"
                onPress={fillDemoCredentials}
                style={styles.demoPill}
              >
                <Sparkles size={14} color={colors.indigoSoft} />
                <Text variant="small" color={colors.indigoSoft} weight="medium">
                  Auto-fill demo account (Aarav Sharma)
                </Text>
              </PressableScale>
            </View>

            <Button
              label={loading ? 'Signing in...' : 'Sign in'}
              loading={loading}
              onPress={handleLogin}
              rightIcon={
                loading ? undefined : (
                  <ArrowRight size={17} color={colors.white} strokeWidth={2.2} />
                )
              }
            />

            {/* Registration Link */}
            <View style={styles.registerPrompt}>
              <Text variant="small" color={colors.textSecondary}>
                First time using VorldX?
              </Text>
              <TouchableOpacity
                onPress={() => router.push('/register')}
                style={styles.registerLink}
              >
                <Text variant="small" color={colors.indigoSoft} weight="semibold">
                  Activate your account
                </Text>
              </TouchableOpacity>
            </View>

            <View style={styles.footer}>
              <View style={styles.divider} />
              <Text variant="caption" color={colors.muted} align="center">
                Employees only · Admin & HR use the web dashboard
              </Text>
            </View>
          </Card>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  keyboardWrap: {
    width: '100%',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 460,
    gap: spacing.lg,
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
    alignSelf: 'flex-start',
  },
  hero: {
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  headline: {
    fontSize: 32,
    lineHeight: 38,
    marginTop: 4,
  },
  heroSub: {
    fontSize: 14,
    lineHeight: 21,
    marginTop: 2,
  },
  card: {
    gap: spacing.lg,
  },
  formHeader: {
    gap: 4,
  },
  fields: {
    gap: spacing.md,
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
  registerPrompt: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingTop: spacing.xs,
  },
  registerLink: {
    paddingVertical: 4,
  },
  footer: {
    gap: spacing.md,
    paddingTop: spacing.xs,
  },
  divider: {
    height: 1,
    backgroundColor: colors.border,
  },
});
