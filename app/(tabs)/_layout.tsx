// app/(tabs)/_layout.tsx

import { Ionicons } from '@expo/vector-icons'
import { faMixcloud, faSoundcloud } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { useTheme } from '@react-navigation/native'
import { Tabs, useRouter } from 'expo-router'
import React, { useRef, useState } from 'react'
import { View } from 'react-native'
import { GestureHandlerRootView, PanGestureHandler, State } from 'react-native-gesture-handler'

export default function TabLayout() {
  const { colors } = useTheme()
  const router = useRouter()
  const ACTIVE = colors.primary
  const INACTIVE = 'rgba(175, 252, 65, 0.5)'
  
  // Tab order for navigation
  const tabOrder = ['listen', 'schedule', 'discord', 'instagram', 'soundcloud', 'mixcloud']
  const [currentTab, setCurrentTab] = useState<string>('listen')
  const gestureStartX = useRef<number>(0)
  
  const handleSwipeGesture = (event: any) => {
    const { translationX, velocityX, state, absoluteX, translationY } = event.nativeEvent
    
    if (state === State.BEGAN) {
      gestureStartX.current = absoluteX
    }
    
    if (state === State.END) {
      const edgeThreshold = 20 // Start within 20px of left edge
      const swipeThreshold = 100 // Must swipe at least 100px
      
      // Only handle horizontal swipes, ignore vertical scrolls
      if (Math.abs(translationX) > Math.abs(translationY)) {
        // Check if gesture started from left edge and moved right
        const isSwipeFromEdge = gestureStartX.current < edgeThreshold
        const isSwipeRight = translationX > swipeThreshold && velocityX > 300
        
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
        activeOffsetX={[-10, 10]}
        failOffsetY={[-10, 10]}
        shouldCancelWhenOutside={true}
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
                marginTop: 12,
                borderTopWidth: 0,
                elevation: 0,
                shadowOpacity: 0,
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
              name="soundcloud"
              options={{
                tabBarIcon: ({ color, size }) => (
                  <FontAwesomeIcon
                    icon={faSoundcloud}
                    size={(size ?? 24) * 1.4}
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
        </View>
      </PanGestureHandler>
    </GestureHandlerRootView>
  )
}
