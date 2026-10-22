import React, { useEffect } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "../src/context/AuthContext";
import { SafeAreaWrapper, Button, Card, StatusBadge, Skeleton, Icon } from "../src/components";
import { colors, spacing, typography, radii } from "../src/theme";

export default function WelcomeScreen() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // If already logged in, redirect directly to home
    if (!isLoading && isAuthenticated && user) {
      router.replace("/(tabs)/home");
    }
  }, [isAuthenticated, isLoading, user, router]);

  if (isLoading) {
    return (
      <SafeAreaWrapper contentContainerStyle={styles.loadingContainer}>
        <Skeleton width={120} height={120} borderRadius={60} style={{ alignSelf: "center", marginBottom: spacing.xl }} />
        <Skeleton width="70%" height={28} style={{ alignSelf: "center", marginBottom: spacing.md }} />
        <Skeleton width="90%" height={16} style={{ alignSelf: "center" }} />
      </SafeAreaWrapper>
    );
  }

  return (
    <SafeAreaWrapper contentContainerStyle={styles.container}>
      {/* Top Branding Section */}
      <View style={styles.brandingSection}>
        <View style={styles.logoBadgeContainer}>
          <View style={styles.logoIcon}>
            <Icon name="qr-code-outline" size={36} color={colors.accent.cyan} />
          </View>
        </View>

        <View style={styles.titleWrapper}>
          <StatusBadge status="DEMO" label="VORLDX ENTERPRISE SUITE" style={styles.badge} />
          <Text style={styles.brandTitle}>
            Vorld<Text style={styles.brandAccent}>X</Text>
          </Text>
          <Text style={styles.tagline}>Workforce Attendance & Punctuality</Text>
        </View>

        <Text style={styles.description}>
          High-precision dynamic QR check-ins, automated grace period evaluation, and transparent work-from-home accounting.
        </Text>
      </View>

      {/* Feature Highlights Card */}
      <Card style={styles.featureCard} variant="surface">
        <View style={styles.featureItem}>
          <View style={[styles.featureIcon, { backgroundColor: colors.accent.cyanMuted }]}>
            <Icon name="shield-checkmark" size={18} color={colors.accent.cyan} />
          </View>
          <View style={styles.featureTextContainer}>
            <Text style={styles.featureTitle}>Cryptographic QR Punch</Text>
            <Text style={styles.featureSubtitle}>Dynamic 30s rotating lobby codes with replay defense</Text>
          </View>
        </View>

        <View style={styles.featureDivider} />

        <View style={styles.featureItem}>
          <View style={[styles.featureIcon, { backgroundColor: colors.accent.indigoMuted }]}>
            <Icon name="time" size={18} color={colors.accent.indigo} />
          </View>
          <View style={styles.featureTextContainer}>
            <Text style={styles.featureTitle}>Server-Side Punctuality</Text>
            <Text style={styles.featureSubtitle}>Grace minutes and shift boundaries calculated strictly on the backend</Text>
          </View>
        </View>
      </Card>

      {/* Action Buttons */}
      <View style={styles.actionSection}>
        <Button
          title="Log In to Account"
          onPress={() => router.push("/login")}
          variant="primary"
          size="lg"
          testID="welcome-login-btn"
          style={styles.actionBtn}
        />

        <Button
          title="Activate New Account"
          onPress={() => router.push("/register")}
          variant="secondary"
          size="lg"
          testID="welcome-register-btn"
          style={styles.actionBtn}
        />
      </View>

      {/* Footer Info */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          Secure Authentication • Built with Expo &amp; TypeScript
        </Text>
      </View>
    </SafeAreaWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    justifyContent: "space-between",
  },
  loadingContainer: {
    justifyContent: "center",
    alignItems: "center",
  },
  brandingSection: {
    alignItems: "center",
    marginTop: spacing.xl,
    marginBottom: spacing.xxl,
  },
  logoBadgeContainer: {
    marginBottom: spacing.lg,
  },
  logoIcon: {
    width: 72,
    height: 72,
    borderRadius: radii.xxl,
    backgroundColor: colors.background.elevated,
    borderWidth: 2,
    borderColor: colors.accent.cyan,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: colors.accent.cyan,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  titleWrapper: {
    alignItems: "center",
    marginBottom: spacing.sm,
  },
  badge: {
    marginBottom: spacing.xs + 2,
  },
  brandTitle: {
    ...typography.hero,
    fontWeight: "900",
    color: colors.text.primary,
    letterSpacing: -1,
  },
  brandAccent: {
    color: colors.accent.cyan,
  },
  tagline: {
    ...typography.md,
    fontWeight: "600",
    color: colors.text.secondary,
    marginTop: 2,
  },
  description: {
    ...typography.sm,
    color: colors.text.muted,
    textAlign: "center",
    maxWidth: 320,
    marginTop: spacing.md,
    lineHeight: 20,
  },
  featureCard: {
    marginVertical: spacing.lg,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  featureIcon: {
    width: 36,
    height: 36,
    borderRadius: radii.md,
    alignItems: "center",
    justifyContent: "center",
    marginRight: spacing.md,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    ...typography.sm,
    fontWeight: "700",
    color: colors.text.primary,
  },
  featureSubtitle: {
    ...typography.xs,
    color: colors.text.muted,
    marginTop: 2,
  },
  featureDivider: {
    height: 1,
    backgroundColor: colors.background.border,
    marginVertical: spacing.md,
  },
  actionSection: {
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  actionBtn: {
    width: "100%",
  },
  footer: {
    marginTop: spacing.xl,
    alignItems: "center",
  },
  footerText: {
    ...typography.xs,
    color: colors.text.muted,
  },
});
