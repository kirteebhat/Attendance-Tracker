import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight } from 'lucide-react-native';
import { useAuth } from '../src/context/AuthContext';
import {
  Screen,
  Button,
  Text,
  DashboardSkeleton,
  Globe3DStand,
} from '../src/components';
import { colors, spacing } from '../src/theme/tokens';
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
    <Screen edges={['top', 'bottom']} contentContainerStyle={styles.screenInner}>
      <View style={[styles.container, isWide && styles.containerWide]}>
        {/* Top Branding Section */}
        <View style={styles.brandingSection}>
          <Text variant="display" align="center" style={styles.brandTitle}>
            <Text style={styles.capLetter}>V</Text>orld<Text style={[styles.brandAccent, styles.capLetter]}>X</Text>
          </Text>
          <Text variant="subheading" color={colors.textSecondary} align="center" style={styles.tagline}>
            Workforce Attendance & Remote Operations
          </Text>
        </View>

        {/* 3D Continuously Revolving Earth Globe on Cursive 'X' Stand */}
        <View style={styles.globeSection}>
          <Globe3DStand size={isWide ? 260 : 230} />
        </View>

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
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  screenInner: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
    paddingVertical: spacing.md,
  },
  containerWide: {
    maxWidth: 540,
  },
  brandingSection: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  brandTitle: {
    fontSize: 32,
    lineHeight: 44,
    marginTop: 2,
    fontWeight: '700',
    letterSpacing: -0.5,
    textAlign: 'center',
  },
  capLetter: {
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '800',
  },
  brandAccent: {
    color: colors.indigoSoft,
  },
  tagline: {
    marginTop: -2,
    textAlign: 'center',
  },
  globeSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 4,
  },
  actionSection: {
    width: '100%',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
  },
});
