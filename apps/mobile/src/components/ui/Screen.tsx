import React, { type ReactElement, type ReactNode } from 'react';
import {
  ScrollView,
  StyleSheet,
  View,
  type RefreshControlProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';
import { colors, layout, spacing } from '../../theme/tokens';
import { useResponsive } from '../../lib/responsive';
import { AppBackground } from './AppBackground';

export interface ScreenProps {
  children: ReactNode;
  scroll?: boolean;
  padded?: boolean;
  refreshControl?: ReactElement<RefreshControlProps>;
  contentContainerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  edges?: Edge[];
  bottomInset?: boolean;
  maxWidth?: number;
  keyboardShouldPersistTaps?: 'always' | 'never' | 'handled';
}

export function Screen({
  children,
  scroll = true,
  padded = true,
  refreshControl,
  contentContainerStyle,
  style,
  edges = ['top', 'left', 'right'],
  bottomInset = false,
  maxWidth = layout.maxWidth,
  keyboardShouldPersistTaps = 'handled',
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const { gutter } = useResponsive();
  const horizontalPadding = padded ? gutter : 0;

  const inner = (
    <View
      style={[
        styles.inner,
        { maxWidth, paddingHorizontal: horizontalPadding },
        !scroll ? styles.innerFlex : null,
        contentContainerStyle,
      ]}
    >
      {children}
    </View>
  );

  if (!scroll) {
    return (
      <View style={[styles.root, style]}>
        <AppBackground />
        <SafeAreaView edges={edges} style={styles.safeArea}>
          {inner}
        </SafeAreaView>
      </View>
    );
  }

  return (
    <View style={[styles.root, style]}>
      <AppBackground />
      <SafeAreaView edges={edges} style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            {
              paddingBottom: bottomInset
                ? Math.max(insets.bottom, 16) + spacing.xl
                : spacing.xxl,
            },
          ]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          refreshControl={refreshControl}
          showsVerticalScrollIndicator={false}
        >
          {inner}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  scrollContent: {
    flexGrow: 1,
    alignItems: 'center',
  },
  inner: {
    width: '100%',
    gap: spacing.lg,
  },
  innerFlex: {
    flex: 1,
    alignSelf: 'center',
  },
});

