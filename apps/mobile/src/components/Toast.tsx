import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity } from "react-native";
import { colors, spacing, radii, typography, shadows } from "../theme";
import { Icon } from "./Icon";

export type ToastType = "success" | "error" | "warning" | "info";

export interface ToastOptions {
  title: string;
  message?: string;
  type?: ToastType;
  duration?: number;
}

interface ToastContextValue {
  showToast: (optionsOrTitle: ToastOptions | string, message?: string, type?: ToastType) => void;
  hideToast: () => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toast, setToast] = useState<ToastOptions | null>(null);
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const translateYAnim = useRef(new Animated.Value(-40)).current;
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const hideToast = useCallback(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }),
      Animated.timing(translateYAnim, { toValue: -40, duration: 250, useNativeDriver: true }),
    ]).start(() => {
      setToast(null);
    });
  }, [fadeAnim, translateYAnim]);

  const showToast = useCallback(
    (optionsOrTitle: ToastOptions | string, message?: string, type?: ToastType) => {
      const options: ToastOptions =
        typeof optionsOrTitle === "string"
          ? { title: optionsOrTitle, message, type: type || "info" }
          : optionsOrTitle;

      if (timerRef.current) clearTimeout(timerRef.current);
      setToast(options);

      Animated.parallel([
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }),
        Animated.timing(translateYAnim, { toValue: 0, duration: 300, useNativeDriver: true }),
      ]).start();

      const duration = options.duration ?? 4000;
      if (duration > 0) {
        timerRef.current = setTimeout(() => {
          hideToast();
        }, duration);
      }
    },
    [fadeAnim, translateYAnim, hideToast]
  );

  return (
    <ToastContext.Provider value={{ showToast, hideToast }}>
      {children}
      {toast && (
        <Animated.View
          style={[
            styles.toastContainer,
            styles[`type_${toast.type || "info"}`],
            { opacity: fadeAnim, transform: [{ translateY: translateYAnim }] },
          ]}
          testID="toast-banner"
          accessibilityRole="alert"
        >
          <View style={styles.iconContainer}>
            <Icon
              name={
                toast.type === "success"
                  ? "checkmark-circle"
                  : toast.type === "error"
                  ? "alert-circle"
                  : toast.type === "warning"
                  ? "warning"
                  : "information-circle"
              }
              size={22}
              color={
                toast.type === "success"
                  ? colors.status.present
                  : toast.type === "error"
                  ? colors.status.absent
                  : toast.type === "warning"
                  ? colors.status.late
                  : colors.accent.cyan
              }
            />
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.titleText}>{toast.title}</Text>
            {toast.message && <Text style={styles.messageText}>{toast.message}</Text>}
          </View>

          <TouchableOpacity onPress={hideToast} style={styles.closeButton} activeOpacity={0.7}>
            <Icon name="close" size={18} color={colors.text.muted} />
          </TouchableOpacity>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
};

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }
  return context;
}

const styles = StyleSheet.create({
  toastContainer: {
    position: "absolute",
    top: 50,
    left: spacing.lg,
    right: spacing.lg,
    zIndex: 9999,
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md + 2,
    borderRadius: radii.xl,
    backgroundColor: colors.background.elevated,
    borderWidth: 1.5,
    borderColor: colors.background.border,
    ...shadows.card,
  },
  type_success: {
    borderColor: colors.status.present,
  },
  type_error: {
    borderColor: colors.status.absent,
  },
  type_warning: {
    borderColor: colors.status.late,
  },
  type_info: {
    borderColor: colors.accent.cyan,
  },
  iconContainer: {
    marginRight: spacing.md,
  },
  textContainer: {
    flex: 1,
  },
  titleText: {
    ...typography.sm,
    fontWeight: "700",
    color: colors.text.primary,
  },
  messageText: {
    ...typography.xs,
    color: colors.text.secondary,
    marginTop: 2,
  },
  closeButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
});
