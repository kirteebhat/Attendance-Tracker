import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Link, Stack } from 'expo-router';
import { AlertCircle, ArrowLeft } from 'lucide-react-native';
import { Screen, Card, Button, Text } from '../src/components';
import { colors, radii, spacing } from '../src/theme/tokens';
import { useResponsive } from '../src/lib/responsive';

export default function NotFoundScreen() {
  const { isWide } = useResponsive();

  return (
    <>
      <Stack.Screen options={{ title: 'Page Not Found', headerShown: false }} />
      <Screen edges={['top', 'bottom']}>
        <View style={[styles.container, isWide && styles.containerWide]}>
          <Card style={styles.card}>
            <View style={styles.iconWrap}>
              <AlertCircle size={40} color={colors.status.late} strokeWidth={1.8} />
            </View>

            <Text variant="heading" align="center" style={styles.title}>
              Screen Not Found
            </Text>

            <Text variant="small" color={colors.muted} align="center" style={styles.description}>
              The link or screen you requested does not exist or has been moved.
            </Text>

            <Link href="/(tabs)/home" asChild>
              <Button
                label="Return to Dashboard"
                icon={<ArrowLeft size={16} color={colors.text} strokeWidth={2} />}
                variant="primary"
                fullWidth
              />
            </Link>
          </Card>
        </View>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
  },
  containerWide: {
    maxWidth: 480,
    alignSelf: 'center',
    width: '100%',
  },
  card: {
    width: '100%',
    alignItems: 'center',
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radii.xl,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.md,
  },
  title: {
    marginBottom: spacing.xs,
  },
  description: {
    marginBottom: spacing.lg,
    maxWidth: 280,
    lineHeight: 20,
  },
});

