import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/context/AuthContext";
import { SafeAreaWrapper, Input, Button, Card, StatusBadge, Icon } from "../src/components";
import { colors, spacing, typography, radii } from "../src/theme";
import { ApiError } from "../src/services/api";

export default function RegisterScreen() {
  const router = useRouter();
  const { registerStart } = useAuth();

  const [employeeId, setEmployeeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleStartRegistration = async () => {
    const cleanId = employeeId.trim().toUpperCase();
    if (!cleanId) {
      setError("Please enter your employee ID.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await registerStart(cleanId);
      const raw = res as unknown as Record<string, string | undefined>;
      const targetEmpId = res.data?.employeeId || raw.employeeId || cleanId;
      const targetEmail = res.data?.maskedEmail || raw.maskedEmail || raw.email || "registered email";
      const targetOtp = res.data?.simulatedOtp || raw.simulatedDemoOtp || raw.simulatedOtp || "";

      // Navigate to Step 2: Verify OTP
      router.push({
        pathname: "/verify-otp",
        params: {
          employeeId: targetEmpId,
          maskedEmail: targetEmail,
          simulatedOtp: targetOtp,
        },
      });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code === "ERR_EMPLOYEE_NOT_FOUND") {
          setError(`No employee record found for ID "${cleanId}". Please check your offer letter or verify with HR.`);
        } else if (err.code === "ERR_ACCOUNT_ALREADY_REGISTERED") {
          setError(`An account is already registered for "${cleanId}". Please sign in with your password.`);
        } else if (err.code === "ERR_EMPLOYEE_INACTIVE") {
          setError(`Employee "${cleanId}" is marked inactive. Contact HR to restore your account.`);
        } else {
          setError(err.message || "Failed to start registration.");
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
          <StatusBadge status="ACTIVE" label="STEP 1 OF 3" />
        </View>
        <Text style={styles.title}>Activate Account</Text>
        <Text style={styles.subtitle}>
          Enter your official VorldX Employee ID to initiate verification
        </Text>
      </View>

      <Card variant="surface" style={styles.formCard}>
        <Input
          label="Employee ID"
          placeholder="e.g. EMP-001 or EMP-010"
          value={employeeId}
          onChangeText={(val) => {
            setEmployeeId(val.toUpperCase());
            if (error) setError(null);
          }}
          autoCapitalize="characters"
          leftIcon={<Icon name="card-outline" size={18} color={colors.text.secondary} />}
          testID="register-employee-id-input"
        />

        {error && (
          <View style={styles.errorBanner} testID="register-error-banner">
            <Icon name="alert-circle" size={18} color={colors.text.danger} />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        <Button
          title="Send Verification Code"
          onPress={handleStartRegistration}
          isLoading={loading}
          size="lg"
          testID="register-submit-btn"
          style={styles.submitBtn}
        />

        <View style={styles.infoBox}>
          <Icon name="information-circle-outline" size={16} color={colors.text.accent} />
          <Text style={styles.infoBoxText}>
            A one-time verification code will be dispatched to your corporate email on file. In demo mode, the code is provided directly on screen.
          </Text>
        </View>
      </Card>

      <View style={styles.footer}>
        <Text style={styles.footerPrompt}>Already have an active account?</Text>
        <TouchableOpacity
          onPress={() => router.push("/login")}
          testID="register-goto-login-btn"
          style={styles.loginLink}
        >
          <Text style={styles.loginLinkText}>Sign In</Text>
        </TouchableOpacity>
      </View>
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
    lineHeight: 20,
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
  infoBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.background.elevated,
    borderRadius: radii.md,
    padding: spacing.md,
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  infoBoxText: {
    flex: 1,
    ...typography.xs,
    color: colors.text.muted,
    lineHeight: 16,
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
  loginLink: {
    padding: spacing.xs,
  },
  loginLinkText: {
    ...typography.sm,
    fontWeight: "700",
    color: colors.accent.cyan,
  },
});
