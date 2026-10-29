import React, { useState, type ReactNode } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  TouchableOpacity,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { Eye, EyeOff, type LucideIcon } from 'lucide-react-native';
import { colors, fonts, radii, spacing } from '../../theme/tokens';
import { Text } from './Text';

export interface FieldProps {
  label?: string;
  hint?: string;
  error?: string | null;
  required?: boolean;
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

export function Field({ label, hint, error, required, children, style }: FieldProps) {
  return (
    <View style={[styles.field, style]}>
      {label ? (
        <View style={styles.labelRow}>
          <Text variant="small" color={colors.textSecondary} weight="medium">
            {label}
            {required ? <Text color={colors.danger}> *</Text> : null}
          </Text>
        </View>
      ) : null}
      {children}
      {error ? (
        <Text variant="small" color={colors.danger}>
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" color={colors.muted}>
          {hint}
        </Text>
      ) : null}
    </View>
  );
}

export interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string | null | boolean;
  helperText?: string;
  leftIcon?: ReactNode | LucideIcon;
  right?: ReactNode;
  secure?: boolean;
  isPassword?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
  style?: StyleProp<ViewStyle>;
  inputStyle?: TextInputProps['style'];
  testID?: string;
}

export function Input({
  label,
  error,
  helperText,
  leftIcon: LeftIcon,
  right,
  secure = false,
  isPassword = false,
  containerStyle,
  style,
  inputStyle,
  multiline,
  onFocus,
  onBlur,
  editable = true,
  testID,
  ...props
}: InputProps) {
  const [focused, setFocused] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const isSecure = (secure || isPassword) && !revealed;
  const hasError = Boolean(error);
  const errorMessage = typeof error === 'string' ? error : null;

  const renderLeft = () => {
    if (!LeftIcon) return null;
    if (React.isValidElement(LeftIcon)) {
      return LeftIcon;
    }
    const IconComp = LeftIcon as unknown as React.ComponentType<{
      size?: number;
      color?: string;
      strokeWidth?: number;
    }>;
    return (
      <IconComp
        size={18}
        color={focused ? colors.indigoSoft : colors.muted}
        strokeWidth={1.8}
      />
    );
  };

  const inputEl = (
    <View
      style={[
        styles.inputShell,
        multiline ? styles.multilineShell : null,
        focused ? styles.focused : null,
        hasError ? styles.errored : null,
        !editable ? styles.disabled : null,
        containerStyle,
      ]}
    >
      {renderLeft()}
      <TextInput
        {...props}
        testID={testID}
        editable={editable}
        multiline={multiline}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        placeholderTextColor={colors.muted}
        secureTextEntry={isSecure}
        style={[styles.input, inputStyle]}
      />
      {secure || isPassword ? (
        <TouchableOpacity
          accessibilityLabel={revealed ? 'Hide password' : 'Show password'}
          onPress={() => setRevealed((val) => !val)}
          style={styles.eyeBtn}
        >
          {revealed ? (
            <EyeOff size={18} color={colors.muted} strokeWidth={1.8} />
          ) : (
            <Eye size={18} color={colors.muted} strokeWidth={1.8} />
          )}
        </TouchableOpacity>
      ) : right ? (
        right
      ) : null}
    </View>
  );

  if (label || errorMessage || helperText) {
    return (
      <View style={[styles.field, style]}>
        {label ? (
          <View style={styles.labelRow}>
            <Text variant="small" color={colors.textSecondary} weight="medium">
              {label}
            </Text>
          </View>
        ) : null}
        {inputEl}
        {errorMessage ? (
          <Text variant="small" color={colors.danger}>
            {errorMessage}
          </Text>
        ) : helperText ? (
          <Text variant="small" color={colors.muted}>
            {helperText}
          </Text>
        ) : null}
      </View>
    );
  }

  return inputEl;
}

const styles = StyleSheet.create({
  field: {
    gap: 6,
    width: '100%',
  },
  labelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inputShell: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: 'rgba(17, 20, 34, 0.72)',
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  multilineShell: {
    height: 108,
    alignItems: 'flex-start',
    paddingVertical: spacing.md,
  },
  focused: {
    borderColor: colors.borderActive,
    backgroundColor: 'rgba(23, 27, 47, 0.92)',
    shadowColor: colors.indigo,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 3,
  },
  errored: {
    borderColor: 'rgba(255, 107, 131, 0.6)',
  },
  disabled: {
    opacity: 0.5,
  },
  input: {
    flex: 1,
    height: '100%',
    color: colors.text,
    fontFamily: fonts.regular,
    fontSize: 14,
    padding: 0,
  },
  eyeBtn: {
    padding: 4,
  },
});

