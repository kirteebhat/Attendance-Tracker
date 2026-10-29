import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { QrCode, ShieldCheck, Clock, ArrowRight } from 'lucide-react-native';
import { useAuth } from '../src/context/AuthContext';
import {
  Screen,
  Card,
  Button,
  Badge,
  Text,
  DashboardSkeleton,
} from '../src/components';
import { colors, radii, spacing } from '../src/theme/tokens';
import { useResponsive } from '../src/lib/responsive';

export default function WelcomeScreen() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useAuth();
  const { isWide } = useResponsive();

  useEffect(() => {
    if (!isLoading && isAuthenticated && user) {
      router.replace('/(tabs)/home');
    }
  }, [isAuthenticated, isLoading, user, router]);

  if (isLoading) {
    return (
      <Screen>
        <DashboardSkeleton />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <View style={[styles.container, isWide && styles.containerWide]}>
        {/* Top Branding Section */}
        <View style={styles.brandingSection}>
          <View style={styles.logoBadgeContainer}>
            <View style={styles.logoIcon}>
              <QrCode size={34} color={colors.indigoSoft} strokeWidth={2} />
            </View>
          </View>

          <Badge label="VORLDX ENTERPRISE SUITE" tone="indigo" dot />

          <Text variant="display" style={styles.brandTitle}>
            Vorld<Text style={styles.brandAccent}>X</Text>
          </Text>
          <Text variant="subheading" color={colors.textSecondary} style={styles.tagline}>
            Workforce Attendance & Remote Operations
          </Text>

          <Text variant="body" color={colors.muted} align="center" style={styles.description}>
            Cryptographic dynamic QR check-ins, automated grace period evaluation, and transparent remote work accounting.
          </Text>
        </View>

        {/* Feature Highlights Card */}
        <Card style={styles.featureCard} variant="raised" padding={18}>
          <View style={styles.featureItem}>
            <View style={styles.featureIconWrap}>
              <ShieldCheck size={18} color={colors.success} strokeWidth={2} />
            </View>
            <View style={styles.featureTextContainer}>
              <Text variant="bodyMedium" weight="semibold">
                Cryptographic QR Punch
              </Text>
              <Text variant="small" color={colors.muted}>
                Dynamic 30s rotating lobby codes with zero client timestamps
              </Text>
            </View>
          </View>

          <View style={styles.featureDivider} />

          <View style={styles.featureItem}>
            <View style={styles.featureIconWrap}>
              <Clock size={18} color={colors.indigoSoft} strokeWidth={2} />
            </View>
            <View style={styles.featureTextContainer}>
              <Text variant="bodyMedium" weight="semibold">
                Authoritative Punctuality
              </Text>
              <Text variant="small" color={colors.muted}>
                Grace minutes and shift boundaries evaluated server-side
              </Text>
            </View>
          </View>
        </Card>

        {/* Action Buttons */}
        <View style={styles.actionSection}>
          <Button
            label="Log In to Account"
            onPress={() => router.push('/login')}
            variant="primary"
            size="lg"
            testID="btn-login"
            rightIcon={<ArrowRight size={17} color={colors.white} strokeWidth={2.2} />}
          />

          <Button
            label="Activate New Account"
            onPress={() => router.push('/register')}
            variant="secondary"
            size="lg"
            testID="btn-register"
          />
        </View>

        {/* Footer Info */}
        <View style={styles.footer}>
          <Text variant="caption" color={colors.muted} align="center">
            Encrypted & NTP-synchronized · Built for VorldX Industries
          </Text>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  containerWide: {
    maxWidth: 540,
  },
  brandingSection: {
    alignItems: 'center',
    gap: spacing.sm,
    paddingTop: spacing.lg,
  },
  logoBadgeContainer: {
    marginBottom: spacing.xs,
  },
  logoIcon: {
    width: 68,
    height: 68,
    borderRadius: 22,
    backgroundColor: 'rgba(89, 101, 242, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(89, 101, 242, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: colors.indigo,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 6,
  },
  brandTitle: {
    fontSize: 34,
    lineHeight: 40,
    marginTop: 4,
  },
  brandAccent: {
    color: colors.indigoSoft,
  },
  tagline: {
    marginTop: -2,
  },
  description: {
    maxWidth: 340,
    lineHeight: 20,
    marginTop: 4,
  },
  featureCard: {
    gap: spacing.md,
  },
  featureItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  featureIconWrap: {
    width: 38,
    height: 38,
    borderRadius: radii.md,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  featureTextContainer: {
    flex: 1,
    gap: 2,
  },
  featureDivider: {
    height: 1,
    backgroundColor: colors.border,
  },
  actionSection: {
    width: '100%',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: spacing.md,
  },
});
