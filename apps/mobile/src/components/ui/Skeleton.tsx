import React, { useEffect, useRef } from 'react';
import { StyleSheet, View, Animated, type StyleProp, type ViewStyle } from 'react-native';
import { radii } from '../../theme/tokens';

export function SkeletonBlock({
  width = '100%',
  height = 16,
  radius = radii.sm,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 800,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 800,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius: radius, opacity },
        style,
      ]}
    />
  );
}

export function Skeleton({
  width,
  height,
  borderRadius = radii.sm,
  style,
}: {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return <SkeletonBlock width={width} height={height} radius={borderRadius} style={style} />;
}

export function DashboardSkeleton() {
  return (
    <View style={styles.stack}>
      <SkeletonBlock width="42%" height={14} />
      <SkeletonBlock width="72%" height={32} />
      <SkeletonBlock height={170} radius={radii.lg} style={styles.gap} />
      <View style={styles.row}>
        <SkeletonBlock height={88} radius={radii.md} style={styles.flex} />
        <SkeletonBlock height={88} radius={radii.md} style={styles.flex} />
      </View>
      <View style={styles.row}>
        <SkeletonBlock height={88} radius={radii.md} style={styles.flex} />
        <SkeletonBlock height={88} radius={radii.md} style={styles.flex} />
      </View>
      <SkeletonBlock height={180} radius={radii.lg} style={styles.gap} />
    </View>
  );
}

export function ListSkeleton({ rows = 4 }: { rows?: number }) {
  return (
    <View style={styles.stack}>
      {Array.from({ length: rows }).map((_, index) => (
        <SkeletonBlock key={index} height={72} radius={radii.md} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: 'rgba(145, 148, 186, 0.14)',
  },
  stack: {
    gap: 12,
    width: '100%',
  },
  gap: {
    marginTop: 6,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  flex: {
    flex: 1,
  },
});

