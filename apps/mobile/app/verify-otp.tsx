import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../src/context/AuthContext";
import { SafeAreaWrapper, Input, Button, Card, StatusBadge, Icon } from "../src/components";
import { colors, spacing, typography, radii } from "../src/theme";
import { ApiError } from "../src/services/api";

export default function VerifyOtpScreen() {
  const router = useRouter();
  const { registerVerify, registerStart } = useAuth();
  const params = useLocalSearchParams<{
    employeeId: string;
    maskedEmail?: string;
    simulatedOtp?: string;
  }>();

  const employeeId = params.employeeId || "";
  const maskedEmail = params.maskedEmail || "your registered email";
  const [otp, setOtp] = useState("");
  const [simulatedOtp, setSimulatedOtp] = useState(params.simulatedOtp || "");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleVerifyOtp = async () => {
    const cleanOtp = otp.trim();
    if (!cleanOtp) {
      setError("Please enter the 6-digit verification code.");
      return;
    }
    if (cleanOtp.length !== 6) {
      setError("Verification code must be exactly 6 digits.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await registerVerify(employeeId, cleanOtp);
      const data = res?.data || (res as unknown as { employeeId?: string; verificationToken?: string });
      // Navigate to Step 3: Set Password
      router.push({
        pathname: "/set-password",
        params: {
          employeeId: data.employeeId || employeeId,
          verificationToken: data.verificationToken || "",
        },
      });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code === "ERR_INVALID_OTP") {
          setError("Incorrect verification code. Please check and try again.");
        } else if (err.code === "ERR_OTP_EXPIRED") {
          setError("This verification code has expired. Please tap 'Resend Code' below.");
        } else if (err.code === "ERR_OTP_ATTEMPTS_EXCEEDED") {
          setError("Maximum attempts exceeded. This verification code has been invalidated. Please request a new code.");
        } else {
          setError(err.message || "OTP verification failed.");
        }
      } else {
        setError("Unable to connect to VorldX attendance server.");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    setError(null);
    try {
      const res = await registerStart(employeeId);
      if (res.data.simulatedOtp) {
        setSimulatedOtp(res.data.simulatedOtp);
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setError(err.message || "Failed to resend code.");
      } else {
        setError("Network error: Unable to resend code.");
      }
    } finally {
      setResending(false);
    }
  };

  const autoFillDemoOtp = () => {
    if (simulatedOtp) {
      setOtp(simulatedOtp);
      setError(null);
    }
  };

  return (
    <SafeAreaWrapper contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <View style={styles.stepBadgeRow}>
          <StatusBadge status="ACTIVE" label="STEP 2 OF 3" />
        </View>
        <Text style={styles.title}>Enter Code</Text>
        <Text style={styles.subtitle}>
          A 6-digit verification code was generated for <Text style={styles.highlightText}>{employeeId}</Text>
        </Text>
        <Text style={styles.subtext}>Sent to: {maskedEmail}</Text>
      </View>

      {/* DEMO VERIFICATION CALLOUT */}
      {simulatedOtp ? (
        <Card style={styles.demoCard} variant="surface" testID="demo-otp-banner">
          <View style={styles.demoHeader}>
            <StatusBadge status="DEMO" label="DEMO VERIFICATION MODE" />
            <Icon name="sparkles" size={16} color={colors.accent.cyan} />
          </View>
          <Text style={styles.demoText}>
            Simulated OTP generated for non-production demonstration:
          </Text>
          <View style={styles.otpPill}>
            <Text style={styles.otpValueText}>{simulatedOtp}</Text>
          </View>
          <TouchableOpacity
            onPress={autoFillDemoOtp}
            style={styles.autoFillBtn}
            activeOpacity={0.7}
            testID="auto-fill-otp-btn"
          >
            <Icon name="flash" size={14} color={colors.accent.cyan} />
            <Text style={styles.autoFillText}>Auto-Fill Demo Code</Text>
          </TouchableOpacity>
        </Card>
      ) : null}

      <Card variant="surface" style={styles.formCard}>
        <Input
          label="6-Digit Verification Code"
          placeholder="000000"
          value={otp}
          onChangeText={(val) => {
            setOtp(val.replace(/\D/g, ""));
            if (error) setError(null);
          }}
          keyboardType="number-pad"
          maxLength={6}
          autoFocus
          leftIcon={<Icon name="key-outline" size={18} color={colors.text.secondary} />}
          testID="verify-otp-input"
        />

        {error && (
          <View style={styles.errorBanner} testID="verify-otp-error-banner">
            <Icon name="alert-circle" size={18} color={colors.text.danger} />
            <Text style={styles.errorBannerText}>{error}</Text>
          </View>
        )}

        <Button
          title="Verify & Continue"
          onPress={handleVerifyOtp}
          isLoading={loading}
          size="lg"
          testID="verify-otp-submit-btn"
          style={styles.submitBtn}
        />

        <View style={styles.resendRow}>
          <Text style={styles.resendPrompt}>Didn&apos;t receive code?</Text>
          <TouchableOpacity
            onPress={handleResendOtp}
            disabled={resending}
            style={styles.resendBtn}
            testID="resend-otp-btn"
          >
            <Text style={styles.resendBtnText}>
              {resending ? "Sending..." : "Resend Code"}
            </Text>
          </TouchableOpacity>
        </View>
      </Card>

      <View style={styles.footer}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backLink}>
          <Icon name="arrow-back" size={16} color={colors.text.secondary} />
          <Text style={styles.backLinkText}>Change Employee ID</Text>
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
    marginBottom: spacing.lg,
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
  subtext: {
    ...typography.xs,
    color: colors.text.muted,
    marginTop: 2,
  },
  demoCard: {
    backgroundColor: "rgba(99, 102, 241, 0.1)",
    borderColor: colors.accent.indigo,
    borderWidth: 1.5,
    marginBottom: spacing.lg,
    padding: spacing.md + 2,
  },
  demoHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: spacing.xs + 2,
  },
  demoText: {
    ...typography.xs,
    color: colors.text.secondary,
    marginBottom: spacing.sm,
  },
  otpPill: {
    backgroundColor: colors.background.elevated,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    alignSelf: "center",
    borderWidth: 1,
    borderColor: colors.accent.indigo,
  },
  otpValueText: {
    ...typography.xl,
    fontWeight: "900",
    fontFamily: "Courier",
    color: colors.accent.cyan,
    letterSpacing: 4,
  },
  autoFillBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.sm + 2,
    paddingVertical: spacing.xs,
  },
  autoFillText: {
    ...typography.xs,
    fontWeight: "700",
    color: colors.accent.cyan,
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
  resendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
  resendPrompt: {
    ...typography.xs,
    color: colors.text.muted,
  },
  resendBtn: {
    padding: spacing.xs,
  },
  resendBtnText: {
    ...typography.xs,
    fontWeight: "700",
    color: colors.accent.cyan,
  },
  footer: {
    alignItems: "center",
    paddingVertical: spacing.lg,
  },
  backLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.xs,
  },
  backLinkText: {
    ...typography.xs,
    color: colors.text.secondary,
    fontWeight: "600",
  },
});
