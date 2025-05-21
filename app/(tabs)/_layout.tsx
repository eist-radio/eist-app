// app/(tabs)/_layout.tsx
import React from 'react'
import { Tabs } from 'expo-router'
import { Feather } from '@expo/vector-icons'
import { useTheme } from '@react-navigation/native'

export default function TabLayout() {
  const { colors } = useTheme()
  const ACTIVE = colors.primary // #AFFC41
  const INACTIVE = 'rgba(175, 252, 65, 0.5)'

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: { backgroundColor: colors.card },
      }}
    >
      <Tabs.Screen
        name="listen"
        options={{
          title: 'Listen',
          tabBarIcon: ({ color }) => (
            <Feather name="play-circle" size={24} color={color} />
            ),
        }}
      />
      <Tabs.Screen
        name="schedule"
        options={{
          title: 'Schedule',
          tabBarIcon: ({ color }) => (
            <Feather name="calendar" size={24} color={color} />
            ),
        }}
      />
    </Tabs>
    )
}
