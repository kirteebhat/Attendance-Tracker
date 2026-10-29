import React, { createContext, useContext, useState, useCallback, useRef } from "react";
import { View, Text, StyleSheet, Animated, TouchableOpacity } from "react-native";
import { colors, spacing, radii, typography, shadows } from "../theme";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react-native";

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
            {toast.type === "success" ? (
              <CheckCircle2 size={20} color={colors.status.present} strokeWidth={2} />
            ) : toast.type === "error" ? (
              <AlertCircle size={20} color={colors.status.absent} strokeWidth={2} />
            ) : toast.type === "warning" ? (
              <AlertTriangle size={20} color={colors.status.late} strokeWidth={2} />
            ) : (
              <Info size={20} color={colors.accent.cyan} strokeWidth={2} />
            )}
          </View>

          <View style={styles.textContainer}>
            <Text style={styles.titleText}>{toast.title}</Text>
            {toast.message && <Text style={styles.messageText}>{toast.message}</Text>}
          </View>

          <TouchableOpacity onPress={hideToast} style={styles.closeButton} activeOpacity={0.7}>
            <X size={16} color={colors.muted} strokeWidth={2} />
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
    color: colors.text,
  },
  messageText: {
    ...typography.xs,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    padding: spacing.xs,
    marginLeft: spacing.sm,
  },
});
