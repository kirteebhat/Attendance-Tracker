import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/context/AuthContext";
import { useToast } from "../src/components/Toast";
import { SafeAreaWrapper, Input, Button, Card, StatusBadge, Icon } from "../src/components";
import { colors, spacing, typography, radii } from "../src/theme";
import { ApiError } from "../src/services/api";

export default function LoginScreen() {
  const router = useRouter();
  const { login, sessionExpired, dismissSessionExpired } = useAuth();
  const { showToast } = useToast();

  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    const cleanId = identifier.trim();
    if (!cleanId) {
      setError("Please enter your employee email or ID.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await login(cleanId, password);
      showToast({
        title: "Welcome Back",
        message: "Logged in successfully.",
        type: "success",
      });
      router.replace("/(tabs)/home");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code === "ERR_ACCOUNT_LOCKED") {
          setError("Account locked due to 5 consecutive failed attempts. Please wait 15 minutes or contact HR.");
        } else if (err.code === "ERR_EMPLOYEE_INACTIVE") {
          setError("Your employee profile is inactive. Please contact HR administrator.");
        } else if (err.code === "ERR_INVALID_CREDENTIALS") {
          setError("Invalid email/employee ID or password. Please verify and try again.");
        } else {
          setError(err.message || "Failed to log in.");
        }
      } else {
        setError("Unable to connect to VorldX attendance server.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fillDemoCredentials = () => {
    setIdentifier("emp1@vorldx.demo");
    setPassword("Employee@123");
    setError(null);
  };

  return (
    <SafeAreaWrapper contentContainerStyle={styles.container}>
      {/* Session Expired Banner */}
      {sessionExpired && (
        <Card style={styles.sessionExpiredCard} variant="surface">
          <View style={styles.sessionExpiredHeader}>
            <Icon name="time-outline" size={20} color={colors.status.late} />
            <Text style={styles.sessionExpiredTitle}>Session Expired</Text>
          </View>
          <Text style={styles.sessionExpiredText}>
            Your security session has expired. Please sign in again to continue.
          </Text>
          <TouchableOpacity onPress={dismissSessionExpired} style={styles.dismissBtn}>
            <Text style={styles.dismissBtnText}>Dismiss</Text>
          </TouchableOpacity>
        </Card>
      )}

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Sign In</Text>
        <Text style={styles.subtitle}>Enter your VorldX employee credentials</Text>
      </View>

      {/* Main Form Card */}
      <Card variant="surface" style={styles.formCard}>
        <Input
          label="Email or Employee ID"
          placeholder="e.g. emp1@vorldx.demo or EMP-001"
          value={identifier}
          onChangeText={(val) => {
            setIdentifier(val);
            if (error) setError(null);
          }}
          autoCapitalize="none"
          keyboardType="email-address"
          leftIcon={<Icon name="person-outline" size={18} color={colors.text.secondary} />}
          testID="login-identifier-input"
        />

        <Input
          label="Password"
          placeholder="Enter your password"
          value={password}
          onChangeText={(val) => {
            setPassword(val);
            if (error) setError(null);
          }}
          isPassword
          leftIcon={<Icon name="lock-closed-outline" size={18} color={colors.text.secondary} />}
          testID="login-password-input"
        />

        {error && (
          <View style={styles.errorBanner} testID="login-error-banner">
            <Icon name="alert-circle" size={18} color={colors.text.danger} />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        <Button
          title="Sign In"
          onPress={handleLogin}
          isLoading={loading}
          size="lg"
          testID="login-submit-btn"
          style={styles.submitBtn}
        />

        {/* Demo Fast Fill Pill */}
        <TouchableOpacity
          onPress={fillDemoCredentials}
          style={styles.demoFillBtn}
          activeOpacity={0.7}
          testID="login-demo-fill-btn"
        >
          <StatusBadge status="DEMO" label="QUICK-FILL DEMO ACCOUNT" />
          <Text style={styles.demoFillText}>Auto-fill Ananya Sharma (EMP-001)</Text>
        </TouchableOpacity>
      </Card>

      {/* Bottom Switcher */}
      <View style={styles.footer}>
        <Text style={styles.footerPrompt}>New to VorldX?</Text>
        <TouchableOpacity
          onPress={() => router.push("/register")}
          testID="login-goto-register-btn"
          style={styles.registerLink}
        >
          <Text style={styles.registerLinkText}>Activate Employee Account</Text>
          <Icon name="arrow-forward" size={16} color={colors.accent.cyan} />
        </TouchableOpacity>
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "space-between",
  },
  sessionExpiredCard: {
    borderColor: colors.status.late,
    backgroundColor: "rgba(245, 158, 11, 0.1)",
    marginBottom: spacing.lg,
  },
  sessionExpiredHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs + 2,
    marginBottom: 4,
  },
  sessionExpiredTitle: {
    ...typography.sm,
    fontWeight: "700",
    color: colors.status.late,
  },
  sessionExpiredText: {
    ...typography.xs,
    color: colors.text.secondary,
  },
  dismissBtn: {
    alignSelf: "flex-end",
    marginTop: spacing.sm,
  },
  dismissBtnText: {
    ...typography.xs,
    fontWeight: "700",
    color: colors.status.late,
  },
  header: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  title: {
    ...typography.xxl,
    fontWeight: "800",
    color: colors.text.primary,
  },
  subtitle: {
    ...typography.sm,
    color: colors.text.secondary,
    marginTop: 4,
  },
  formCard: {
    marginBottom: spacing.xl,
  },
  errorBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.status.absentBg,
    borderColor: colors.status.absent,
    borderWidth: 1,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  errorBannerText: {
    flex: 1,
    ...typography.xs,
    color: colors.text.danger,
    fontWeight: "600",
    lineHeight: 18,
  },
  submitBtn: {
    marginTop: spacing.xs,
  },
  demoFillBtn: {
    marginTop: spacing.lg,
    paddingTop: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.background.border,
    alignItems: "center",
  },
  demoFillText: {
    ...typography.xs,
    color: colors.text.muted,
    marginTop: spacing.xs,
    fontWeight: "500",
  },
  footer: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  footerPrompt: {
    ...typography.xs,
    color: colors.text.muted,
    marginBottom: spacing.xs,
  },
  registerLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  registerLinkText: {
    ...typography.sm,
    fontWeight: "700",
    color: colors.accent.cyan,
  },
});
