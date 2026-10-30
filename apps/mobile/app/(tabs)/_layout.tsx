import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Tabs, Redirect } from 'expo-router';
import {
  CalendarCheck,
  CalendarDays,
  House,
  LayoutDashboard,
  QrCode,
  UserRound,
  type LucideIcon,
} from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, layout, radii } from '../../src/theme/tokens';
import { useResponsive } from '../../src/lib/responsive';
import { useAuth } from '../../src/context/AuthContext';

function TabIcon({
  icon: Icon,
  color,
  focused,
}: {
  icon: LucideIcon;
  color: string;
  focused: boolean;
}) {
  return (
    <View style={[styles.iconWrap, focused ? styles.iconWrapActive : null]}>
      <Icon size={21} color={color} strokeWidth={focused ? 2.2 : 1.8} />
    </View>
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { isWide } = useResponsive();
  const { isAuthenticated, isLoading } = useAuth();

  if (!isLoading && !isAuthenticated) {
    return <Redirect href="/" />;
  }

  return (
    <Tabs
      initialRouteName="home"
      screenOptions={{
        headerShown: false,
        tabBarPosition: 'bottom',
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.muted,
        tabBarHideOnKeyboard: true,
        tabBarActiveBackgroundColor: isWide ? 'rgba(89, 101, 242, 0.12)' : 'transparent',
        tabBarStyle: isWide
          ? [
              styles.sideBar,
              {
                paddingTop: Math.max(insets.top, 16),
                paddingBottom: Math.max(insets.bottom, 16),
              },
            ]
          : [
              styles.bottomBar,
              {
                height: 58 + Math.max(insets.bottom, 8),
                paddingBottom: Math.max(insets.bottom, 8),
              },
            ],
        tabBarItemStyle: isWide ? styles.sideItem : styles.bottomItem,
        tabBarLabelStyle: styles.label,
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={String(color)} focused={focused} icon={LayoutDashboard} />
          ),
          tabBarAccessibilityLabel: 'tab-home',
        }}
      />

      <Tabs.Screen
        name="scan"
        options={{
          title: 'Scan',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={String(color)} focused={focused} icon={QrCode} />
          ),
          tabBarAccessibilityLabel: 'tab-scan',
        }}
      />

      <Tabs.Screen
        name="history"
        options={{
          title: 'Activity',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={String(color)} focused={focused} icon={CalendarDays} />
          ),
          tabBarAccessibilityLabel: 'tab-activity',
        }}
      />

      <Tabs.Screen
        name="wfh"
        options={{
          title: 'WFH',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={String(color)} focused={focused} icon={House} />
          ),
          tabBarAccessibilityLabel: 'tab-wfh',
        }}
      />

      <Tabs.Screen
        name="leave"
        options={{
          title: 'Leave',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={String(color)} focused={focused} icon={CalendarCheck} />
          ),
          tabBarAccessibilityLabel: 'tab-leave',
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={String(color)} focused={focused} icon={UserRound} />
          ),
          tabBarAccessibilityLabel: 'tab-profile',
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bottomBar: {
    backgroundColor: 'rgba(10, 12, 21, 0.98)',
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingTop: 7,
    paddingHorizontal: 6,
  },
  sideBar: {
    backgroundColor: colors.sidebar,
    borderRightWidth: 1,
    borderRightColor: colors.border,
    width: layout.sidebarWidth,
    paddingHorizontal: 10,
  },
  bottomItem: {
    borderRadius: radii.sm,
    paddingVertical: 1,
  },
  sideItem: {
    borderRadius: radii.md,
    marginVertical: 4,
    height: 48,
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingHorizontal: 14,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'rgba(89, 101, 242, 0.16)',
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 10,
    marginTop: 2,
    letterSpacing: -0.1,
  },
});
