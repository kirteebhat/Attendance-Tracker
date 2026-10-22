import React, { useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../src/context/AuthContext";
import { useToast } from "../src/components/Toast";
import { SafeAreaWrapper, Input, Button, Card, StatusBadge, Icon } from "../src/components";
import { colors, spacing, typography, radii } from "../src/theme";
import { ApiError } from "../src/services/api";

export default function SetPasswordScreen() {
  const router = useRouter();
  const { registerComplete } = useAuth();
  const { showToast } = useToast();

  const params = useLocalSearchParams<{
    employeeId: string;
    verificationToken: string;
  }>();

  const employeeId = params.employeeId || "";
  const verificationToken = params.verificationToken || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleCompleteRegistration = async () => {
    if (!password) {
      setError("Please create a password.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await registerComplete(employeeId, verificationToken, password);

      showToast({
        title: "Account Activated!",
        message: "Your employee account has been created. Welcome to VorldX!",
        type: "success",
      });

      router.replace("/(tabs)/home");
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code === "ERR_VERIFICATION_TOKEN_EXPIRED") {
          setError("Your verification session has expired. Please restart the registration.");
        } else {
          setError(err.message || "Failed to set password.");
        }
      } else {
        setError("Unable to connect to VorldX attendance server.");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaWrapper contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.stepBadgeRow}>
          <StatusBadge status="ACTIVE" label="STEP 3 OF 3" />
        </View>
        <Text style={styles.title}>Create Password</Text>
        <Text style={styles.subtitle}>
          Secure your account for <Text style={styles.highlightText}>{employeeId}</Text>
        </Text>
      </View>

      <Card variant="surface" style={styles.formCard}>
        <Input
          label="New Password"
          placeholder="At least 8 characters"
          value={password}
          onChangeText={(val) => {
            setPassword(val);
            if (error) setError(null);
          }}
          isPassword
          leftIcon={<Icon name="lock-closed-outline" size={18} color={colors.text.secondary} />}
          testID="set-password-input"
        />

        <Input
          label="Confirm Password"
          placeholder="Re-enter your password"
          value={confirmPassword}
          onChangeText={(val) => {
            setConfirmPassword(val);
            if (error) setError(null);
          }}
          isPassword
          leftIcon={<Icon name="checkmark-done-outline" size={18} color={colors.text.secondary} />}
          testID="set-confirm-password-input"
        />

        {error && (
          <View style={styles.errorBanner} testID="set-password-error-banner">
            <Icon name="alert-circle" size={18} color={colors.text.danger} />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        <View style={styles.requirementsBox}>
          <Text style={styles.reqTitle}>Password Requirements:</Text>
          <Text style={styles.reqItem}>• Minimum 8 characters in length</Text>
          <Text style={styles.reqItem}>• Letters, numbers, and symbols supported</Text>
        </View>

        <Button
          title="Complete Activation"
          onPress={handleCompleteRegistration}
          isLoading={loading}
          size="lg"
          testID="set-password-submit-btn"
          style={styles.submitBtn}
        />
      </Card>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "space-between",
  },
  header: {
    marginTop: spacing.md,
    marginBottom: spacing.xl,
  },
  stepBadgeRow: {
    marginBottom: spacing.sm,
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
  highlightText: {
    color: colors.accent.cyan,
    fontWeight: "700",
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
  requirementsBox: {
    backgroundColor: colors.background.elevated,
    borderRadius: radii.md,
    padding: spacing.md,
    marginBottom: spacing.lg,
    gap: 4,
  },
  reqTitle: {
    ...typography.xs,
    fontWeight: "700",
    color: colors.text.secondary,
  },
  reqItem: {
    ...typography.xs,
    color: colors.text.muted,
  },
  submitBtn: {
    marginTop: spacing.xs,
  },
});
