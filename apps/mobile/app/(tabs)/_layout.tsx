import React from "react";
import { Pressable } from "react-native";
import { Tabs } from "expo-router";
import { Icon } from "../../src/components/Icon";
import { colors, typography } from "../../src/theme";

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.background.surface,
          borderBottomColor: colors.border.subtle,
          borderBottomWidth: 1,
        },
        headerTintColor: colors.text.primary,
        headerTitleStyle: {
          ...typography.md,
          fontWeight: "800",
        },
        headerShadowVisible: false,
        tabBarStyle: {
          backgroundColor: colors.background.surface,
          borderTopColor: colors.border.subtle,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarActiveTintColor: colors.accent.cyan,
        tabBarInactiveTintColor: colors.text.muted,
        tabBarLabelStyle: {
          ...typography.xs,
          fontWeight: "700",
          marginTop: 2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          href: null,
        }}
      />

      <Tabs.Screen
        name="home"
        options={{
          title: "Home",
          headerTitle: "VorldX Attendance",
          tabBarIcon: ({ color, focused }) => (
            <Icon name={focused ? "home" : "home-outline"} size={22} color={color} />
          ),
          tabBarAccessibilityLabel: "tab-home",
          tabBarButton: (props) => <Pressable {...(props as any)} testID="tab-home" />,
        }}
      />

      <Tabs.Screen
        name="scan"
        options={{
          title: "Scan",
          headerTitle: "QR Punch Terminal",
          tabBarIcon: ({ color, focused }) => (
            <Icon name={focused ? "qr-code" : "qr-code-outline"} size={22} color={color} />
          ),
          tabBarAccessibilityLabel: "tab-scan",
          tabBarButton: (props) => <Pressable {...(props as any)} testID="tab-scan" />,
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: "History",
          headerTitle: "Attendance History",
          tabBarIcon: ({ color, focused }) => (
            <Icon name={focused ? "calendar" : "calendar-outline"} size={22} color={color} />
          ),
          tabBarAccessibilityLabel: "tab-history",
          tabBarButton: (props) => <Pressable {...(props as any)} testID="tab-history" />,
        }}
      />

      <Tabs.Screen
        name="wfh"
        options={{
          title: "WFH",
          headerTitle: "Work From Home",
          tabBarIcon: ({ color, focused }) => (
            <Icon name={focused ? "briefcase" : "briefcase-outline"} size={22} color={color} />
          ),
          tabBarAccessibilityLabel: "tab-wfh",
          tabBarButton: (props) => <Pressable {...(props as any)} testID="tab-wfh" />,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",
          headerTitle: "My Profile",
          tabBarIcon: ({ color, focused }) => (
            <Icon name={focused ? "person" : "person-outline"} size={22} color={color} />
          ),
          tabBarAccessibilityLabel: "tab-profile",
          tabBarButton: (props) => <Pressable {...(props as any)} testID="tab-profile" />,
        }}
      />
    </Tabs>
  );
}

