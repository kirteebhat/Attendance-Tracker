import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  KeyboardTypeOptions,
} from "react-native";
import { colors, spacing, radii, typography } from "../theme";
import { Icon } from "./Icon";

interface InputProps {
  label?: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string | null;
  helperText?: string;
  isPassword?: boolean;
  keyboardType?: KeyboardTypeOptions;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  autoFocus?: boolean;
  maxLength?: number;
  leftIcon?: React.ReactNode;
  editable?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export const Input: React.FC<InputProps> = ({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  helperText,
  isPassword = false,
  keyboardType = "default",
  autoCapitalize = "none",
  autoFocus = false,
  maxLength,
  leftIcon,
  editable = true,
  style,
  testID,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const hasError = Boolean(error);

  return (
    <View style={[styles.container, style]}>
      {label && <Text style={styles.label}>{label}</Text>}

      <View
        style={[
          styles.inputWrapper,
          isFocused && styles.inputWrapperFocused,
          hasError && styles.inputWrapperError,
          !editable && styles.inputWrapperDisabled,
        ]}
      >
        {leftIcon && <View style={styles.leftIconContainer}>{leftIcon}</View>}

        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.text.muted}
          secureTextEntry={isPassword && !isPasswordVisible}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoFocus={autoFocus}
          maxLength={maxLength}
          editable={editable}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          style={[styles.input, !editable && styles.inputDisabled]}
          testID={testID}
          accessibilityLabel={label || placeholder}
        />

        {isPassword && (
          <TouchableOpacity
            onPress={() => setIsPasswordVisible(!isPasswordVisible)}
            style={styles.rightIconButton}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={isPasswordVisible ? "Hide password" : "Show password"}
          >
            <Icon
              name={isPasswordVisible ? "eye-off-outline" : "eye-outline"}
              size={20}
              color={colors.text.secondary}
            />
          </TouchableOpacity>
        )}
      </View>

      {hasError ? (
        <Text style={styles.errorText} testID={`${testID}-error`}>
          {error}
        </Text>
      ) : helperText ? (
        <Text style={styles.helperText}>{helperText}</Text>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.sm,
    fontWeight: "700",
    color: colors.text.secondary,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: spacing.xs + 2,
  },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.background.surface,
    borderWidth: 1.5,
    borderColor: colors.background.border,
    borderRadius: radii.lg,
    paddingHorizontal: spacing.md,
    minHeight: 52,
  },
  inputWrapperFocused: {
    borderColor: colors.accent.cyan,
    shadowColor: colors.accent.cyan,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
  },
  inputWrapperError: {
    borderColor: colors.status.absent,
  },
  inputWrapperDisabled: {
    backgroundColor: colors.background.elevated,
    opacity: 0.7,
  },
  input: {
    flex: 1,
    ...typography.md,
    color: colors.text.primary,
    paddingVertical: spacing.sm + 2,
  },
  inputDisabled: {
    color: colors.text.muted,
  },
  leftIconContainer: {
    marginRight: spacing.sm,
  },
  rightIconButton: {
    padding: spacing.xs,
  },
  errorText: {
    ...typography.xs,
    color: colors.text.danger,
    marginTop: spacing.xs,
    fontWeight: "600",
  },
  helperText: {
    ...typography.xs,
    color: colors.text.muted,
    marginTop: spacing.xs,
  },
});
