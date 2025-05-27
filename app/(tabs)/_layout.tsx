// app/(tabs)/_layout.tsx

import React from 'react';
import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@react-navigation/native';

export default function TabLayout() {
  const { colors } = useTheme();
  const ACTIVE = colors.primary;
  const INACTIVE = 'rgba(175, 252, 65, 0.5)';

  return (
    <Tabs
      initialRouteName="listen"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: { backgroundColor: colors.card },
      }}
    >
      {/* Live tab */}
      <Tabs.Screen
        name="listen"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="radio-outline" size={size ?? 24} color={color} />
          ),
        }}
      />

      {/* Schedule tab */}
      <Tabs.Screen
        name="schedule"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size ?? 24} color={color} />
          ),
        }}
      />

      {/* Website external link tab */}
      <Tabs.Screen
        name="website"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="globe-outline" size={size ?? 24} color={color} />
          ),
        }}
      />

      {/* Discord external link tab */}
      <Tabs.Screen
        name="discord"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="logo-discord" size={size ?? 24} color={color} />
          ),
        }}
      />

      {/* Artist detail route — no tab button */}
      <Tabs.Screen
        name="artist/[slug]"
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' } // no empty space
        }}
      />
    </Tabs>
  );
}
