// app/(tabs)/_layout.tsx

import { Ionicons } from '@expo/vector-icons'
import { faMixcloud } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { useTheme } from '@react-navigation/native'
import { Tabs } from 'expo-router'
import React from 'react'

export default function TabLayout() {
  const { colors } = useTheme()
  const ACTIVE = colors.primary
  const INACTIVE = 'rgba(175, 252, 65, 0.5)'

  return (
    <Tabs
      initialRouteName="listen"
      screenOptions={{
        headerShown: false,
        tabBarShowLabel: false,
        tabBarActiveTintColor: ACTIVE,
        tabBarInactiveTintColor: INACTIVE,
        tabBarStyle: {
          backgroundColor: colors.card,
          marginTop: 12,
        },
      }}
    >
      <Tabs.Screen
        name="listen"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="radio-outline"
              size={(size ?? 26) * 1.2}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="schedule"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="calendar-outline"
              size={(size ?? 26) * 1.2}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="discord"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="logo-discord"
              size={(size ?? 26) * 1.2}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="instagram"
        options={{
          tabBarIcon: ({ color, size }) => (
            <Ionicons
              name="logo-instagram"
              size={(size ?? 26) * 1.2}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="mixcloud"
        options={{
          tabBarIcon: ({ color, size }) => (
            <FontAwesomeIcon
              icon={faMixcloud}
              size={(size ?? 24) * 1.4}
              color={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="artist/[slug]"
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
      <Tabs.Screen
        name="show/[slug]"
        options={{
          tabBarButton: () => null,
          tabBarItemStyle: { display: 'none' },
        }}
      />
    </Tabs>
  )
}
