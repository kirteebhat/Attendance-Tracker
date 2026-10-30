import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Mail, Lock, ArrowRight, ArrowLeft, Clock } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { useAuth } from '../src/context/AuthContext';
import { useToast } from '../src/components/Toast';
import {
  Screen,
  Card,
  Input,
  Field,
  Button,
  Notice,
  Text,
} from '../src/components';
import { colors, spacing } from '../src/theme/tokens';
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

  return (
    <Screen
      edges={['top', 'bottom']}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.screenInner}
    >
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
            <Text variant="display" align="center" style={styles.headline} numberOfLines={1}>
              Your workday, in one place.
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
              <Text variant="title" align="center">Welcome back</Text>
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
                  placeholder="EMP-1001 or aarav.sharma@vorldx.demo"
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
          </Card>
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  keyboardWrap: {
    width: '100%',
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  content: {
    width: '100%',
    maxWidth: 460,
    gap: spacing.lg,
    paddingVertical: spacing.md,
    alignSelf: 'center',
    justifyContent: 'center',
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
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: spacing.xs,
  },
  headline: {
    fontSize: 24,
    lineHeight: 30,
    fontWeight: '700',
    textAlign: 'center',
  },
  card: {
    gap: spacing.lg,
  },
  formHeader: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  fields: {
    gap: spacing.md,
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
});
