// app/(tabs)/_layout.tsx
import React from 'react'
import { Tabs } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@react-navigation/native'

export default function TabLayout() {
  const { colors } = useTheme()
  const ACTIVE = colors.primary
  const INACTIVE = 'rgba(175, 252, 65, 0.5)'

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: { backgroundColor: colors.card },
      }}
    >
      <Tabs.Screen
        name="listen"
        options={{
          // no title needed, label is hidden anyway
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="play" size={size ?? 24} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar" size={size ?? 24} color={color} />
          ),
        }}
      />
    </Tabs>
  )
}
