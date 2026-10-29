import * as Haptics from 'expo-haptics';
import React, { useRef, useCallback } from 'react';
import {
  Animated,
  Pressable,
  type GestureResponderEvent,
  type PressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

export interface PressableScaleProps extends Omit<PressableProps, 'style' | 'children'> {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: boolean | 'selection';
  children?: React.ReactNode;
}

export function PressableScale({
  style,
  scaleTo = 0.97,
  haptic = false,
  onPress,
  onPressIn,
  onPressOut,
  disabled,
  children,
  ...props
}: PressableScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = useCallback(
    (event: GestureResponderEvent) => {
      Animated.spring(scale, {
        toValue: disabled ? 1 : scaleTo,
        friction: 6,
        tension: 140,
        useNativeDriver: true,
      }).start();

      if (haptic && !disabled) {
        const promise =
          haptic === 'selection'
            ? Haptics.selectionAsync()
            : Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        void promise.catch(() => undefined);
      }
      onPressIn?.(event);
    },
    [disabled, haptic, onPressIn, scaleTo, scale]
  );

  const handlePressOut = useCallback(
    (event: GestureResponderEvent) => {
      Animated.spring(scale, {
        toValue: 1,
        friction: 6,
        tension: 140,
        useNativeDriver: true,
      }).start();
      onPressOut?.(event);
    },
    [onPressOut, scale]
  );

  return (
    <AnimatedPressable
      {...props}
      disabled={disabled}
      onPress={disabled ? undefined : onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      style={[
        style,
        {
          transform: [{ scale }],
          opacity: disabled ? 0.48 : 1,
        },
      ]}
    >
      {children}
    </AnimatedPressable>
  );
}
