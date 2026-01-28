// app/(tabs)/_layout.tsx

import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@react-navigation/native'
import { Tabs, useRouter } from 'expo-router'
import React, { useRef, useState } from 'react'
import { Platform, StyleSheet, Text, View } from 'react-native'
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler'

// Custom tab bar icon with label - inspired by NTS's clean approach
const TabIcon = ({
  name,
  label,
  color,
  focused
}: {
  name: keyof typeof Ionicons.glyphMap
  label: string
  color: string
  focused: boolean
}) => (
  <View style={styles.tabIconContainer}>
    <Ionicons
      name={name}
      size={22}
      color={color}
      style={focused ? styles.iconActive : styles.iconInactive}
    />
    <Text
      style={[
        styles.tabLabel,
        { color },
        focused && styles.tabLabelActive
      ]}
      numberOfLines={1}
    >
      {label}
    </Text>
  </View>
)

export default function TabLayout() {
  const { colors } = useTheme()
  const router = useRouter()
  const ACTIVE = colors.primary
  const INACTIVE = 'rgba(175, 252, 65, 0.4)'

  // Tab order for navigation - 6 main tabs
  const tabOrder = ['listen', 'schedule', 'archive', 'artists', 'social', 'support']
  const [currentTab, setCurrentTab] = useState<string>('listen')
  const gestureStartX = useRef<number>(0)

  const handleSwipeGesture = (event: any) => {
    const { translationX, velocityX, state, absoluteX, translationY } = event.nativeEvent

    if (state === State.BEGAN) {
      gestureStartX.current = absoluteX
    }

    if (state === State.END) {
      const edgeThreshold = Platform.OS === 'ios' ? 30 : 20
      const swipeThreshold = Platform.OS === 'ios' ? 120 : 100

      if (Math.abs(translationX) > Math.abs(translationY)) {
        const isSwipeFromEdge = gestureStartX.current < edgeThreshold
        const isSwipeRight = translationX > swipeThreshold && velocityX > (Platform.OS === 'ios' ? 400 : 300)

        if (isSwipeFromEdge && isSwipeRight) {
          const currentIndex = tabOrder.indexOf(currentTab)
          if (currentIndex > 0) {
            const previousTab = tabOrder[currentIndex - 1]
            router.push(`/(tabs)/${previousTab}`)
          }
        }
      }
    }
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PanGestureHandler
        onGestureEvent={handleSwipeGesture}
        onHandlerStateChange={handleSwipeGesture}
        activeOffsetX={Platform.OS === 'ios' ? [-15, 15] : [-10, 10]}
        failOffsetY={Platform.OS === 'ios' ? [-15, 15] : [-10, 10]}
        shouldCancelWhenOutside={true}
        simultaneousHandlers={Platform.OS === 'ios' ? undefined : undefined}
      >
        <View style={{ flex: 1 }}>
          <Tabs
            initialRouteName="listen"
            screenOptions={{
              headerShown: false,
              tabBarShowLabel: false,
              tabBarActiveTintColor: ACTIVE,
              tabBarInactiveTintColor: INACTIVE,
              tabBarStyle: {
                backgroundColor: colors.card,
                borderTopWidth: 1,
                borderTopColor: 'rgba(175, 252, 65, 0.1)',
                height: Platform.OS === 'ios' ? 84 : 64,
                paddingTop: 8,
                paddingBottom: Platform.OS === 'ios' ? 28 : 8,
                elevation: 0,
                shadowOpacity: 0,
              },
              tabBarItemStyle: {
                paddingVertical: 4,
              },
            }}
            screenListeners={{
              state: (e: any) => {
                const route = e.data.state?.routes[e.data.state.index]
                if (route?.name && tabOrder.includes(route.name)) {
                  setCurrentTab(route.name)
                }
              },
            }}
          >
            <Tabs.Screen
              name="listen"
              options={{
                tabBarIcon: ({ color, focused }) => (
                  <TabIcon
                    name={focused ? "radio" : "radio-outline"}
                    label="LIVE"
                    color={color}
                    focused={focused}
                  />
                ),
              }}
            />

            <Tabs.Screen
              name="schedule"
              options={{
                tabBarIcon: ({ color, focused }) => (
                  <TabIcon
                    name={focused ? "calendar" : "calendar-outline"}
                    label="SCHEDULE"
                    color={color}
                    focused={focused}
                  />
                ),
              }}
            />

            <Tabs.Screen
              name="archive"
              options={{
                tabBarIcon: ({ color, focused }) => (
                  <TabIcon
                    name={focused ? "library" : "library-outline"}
                    label="ARCHIVE"
                    color={color}
                    focused={focused}
                  />
                ),
              }}
            />

            <Tabs.Screen
              name="artists"
              options={{
                tabBarIcon: ({ color, focused }) => (
                  <TabIcon
                    name={focused ? "people" : "people-outline"}
                    label="ARTISTS"
                    color={color}
                    focused={focused}
                  />
                ),
              }}
            />

            <Tabs.Screen
              name="social"
              options={{
                tabBarIcon: ({ color, focused }) => (
                  <TabIcon
                    name={focused ? "chatbubbles" : "chatbubbles-outline"}
                    label="SOCIAL"
                    color={color}
                    focused={focused}
                  />
                ),
              }}
            />

            <Tabs.Screen
              name="support"
              options={{
                tabBarIcon: ({ color, focused }) => (
                  <TabIcon
                    name={focused ? "heart" : "heart-outline"}
                    label="SUPPORT"
                    color={color}
                    focused={focused}
                  />
                ),
              }}
            />

            {/* Hidden screens - still accessible via navigation but not in tab bar */}
            <Tabs.Screen
              name="discord"
              options={{
                tabBarButton: () => null,
                tabBarItemStyle: { display: 'none' },
              }}
            />
            <Tabs.Screen
              name="instagram"
              options={{
                tabBarButton: () => null,
                tabBarItemStyle: { display: 'none' },
              }}
            />
            <Tabs.Screen
              name="soundcloud"
              options={{
                tabBarButton: () => null,
                tabBarItemStyle: { display: 'none' },
              }}
            />
            <Tabs.Screen
              name="mixcloud"
              options={{
                tabBarButton: () => null,
                tabBarItemStyle: { display: 'none' },
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
            <Tabs.Screen
              name="archive/[slug]"
              options={{
                tabBarButton: () => null,
                tabBarItemStyle: { display: 'none' },
              }}
            />
          </Tabs>
        </View>
      </PanGestureHandler>
    </GestureHandlerRootView>
  )
}

const styles = StyleSheet.create({
  tabIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minWidth: 50,
  },
  iconActive: {
    opacity: 1,
  },
  iconInactive: {
    opacity: 0.85,
  },
  tabLabel: {
    fontSize: 9,
    fontWeight: '600',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  tabLabelActive: {
    fontWeight: '700',
  },
})
