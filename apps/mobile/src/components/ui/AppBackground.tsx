import React from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { gradients } from '../../theme/tokens';

export function AppBackground({ subtle = false }: { subtle?: boolean }) {
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.background]}>
      <LinearGradient
        colors={gradients.screen}
        locations={[0, 0.52, 1]}
        start={{ x: 0.05, y: 0 }}
        end={{ x: 0.95, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View
        style={[
          styles.glow,
          {
            top: -180,
            right: -150,
            backgroundColor: subtle ? 'rgba(89, 101, 242, 0.08)' : 'rgba(89, 101, 242, 0.14)',
          },
        ]}
      />
      <View
        style={[
          styles.glow,
          {
            top: 320,
            left: -210,
            backgroundColor: subtle ? 'rgba(118, 184, 255, 0.03)' : 'rgba(118, 184, 255, 0.055)',
          },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  background: {
    backgroundColor: '#07080E',
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    width: 380,
    height: 380,
    borderRadius: 190,
  },
});

