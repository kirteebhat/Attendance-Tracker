import React from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { AuthProvider } from "../src/context/AuthContext";
import { ToastProvider } from "../src/components/Toast";
import { OfflineBanner } from "../src/components/OfflineBanner";
import { colors } from "../src/theme";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ToastProvider>
          <StatusBar style="light" />
          <OfflineBanner />
          <Stack
            screenOptions={{
              headerStyle: { backgroundColor: colors.background.surface },
              headerTintColor: colors.text.primary,
              headerTitleStyle: { fontWeight: "700" },
              contentStyle: { backgroundColor: colors.background.base },
            }}
          >
            <Stack.Screen
              name="index"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="login"
              options={{
                title: "Log In",
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen
              name="register"
              options={{
                title: "Account Activation",
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen
              name="verify-otp"
              options={{
                title: "Verify Identity",
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen
              name="set-password"
              options={{
                title: "Create Password",
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen
              name="(tabs)"
              options={{
                headerShown: false,
              }}
            />
            <Stack.Screen
              name="home"
              options={{
                title: "VorldX Attendance",
                headerBackVisible: false,
                headerShadowVisible: false,
              }}
            />
            <Stack.Screen
              name="announcements"
              options={{
                title: "Announcements & Alerts",
                headerShadowVisible: false,
              }}
            />
          </Stack>
        </ToastProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
