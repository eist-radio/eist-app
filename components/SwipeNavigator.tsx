// components/SwipeNavigator.tsx

import { useNavigation } from '@react-navigation/native'
import React, { ReactNode } from 'react'
import { Dimensions, Platform, View } from 'react-native'
import {
    GestureHandlerRootView,
    PanGestureHandler,
    PanGestureHandlerGestureEvent,
    State
} from 'react-native-gesture-handler'

type Props = {
  children: ReactNode
  horizontalEnabled?: boolean
  allowIOSBackSwipe?: boolean
}

export function SwipeNavigator({ 
  children, 
  horizontalEnabled = true, 
  allowIOSBackSwipe = true 
}: Props) {
  const screenWidth = Dimensions.get('window').width
  const navigation = useNavigation()

  // If horizontal swipes are disabled, just render children without any gesture handler
  if (!horizontalEnabled) {
    return <View style={{ flex: 1 }}>{children}</View>
  }

  const onGestureEvent = (event: PanGestureHandlerGestureEvent) => {
    const { nativeEvent } = event
    
    // Only handle END state to avoid conflicts with scrolling
    if (nativeEvent.state !== State.END) {
      return
    }

    // Check if gesture started from the left edge (for back navigation)
    const edgeThreshold = screenWidth * 0.1 // 10% from left edge
    const startedFromEdge = nativeEvent.absoluteX <= edgeThreshold
    
    // Use higher thresholds for Android to prevent accidental triggers
    const horizontalThreshold = Platform.OS === 'ios' ? screenWidth * 0.3 : screenWidth * 0.35
    const velocityThreshold = Platform.OS === 'ios' ? 600 : 1200
    
    // Check if it's a horizontal swipe with sufficient distance and velocity
    const isHorizontalSwipe = Math.abs(nativeEvent.translationX) > Math.abs(nativeEvent.translationY) * 1.2
    const hasSufficientDistance = Math.abs(nativeEvent.translationX) > horizontalThreshold
    const hasSufficientVelocity = Math.abs(nativeEvent.velocityX) > velocityThreshold
    
    // Only trigger on right-to-left swipes (going back) that started from the edge
    const isRightToLeft = nativeEvent.translationX < 0 && nativeEvent.velocityX < 0
    
    if (startedFromEdge && isHorizontalSwipe && hasSufficientDistance && hasSufficientVelocity && isRightToLeft) {
      if (navigation.canGoBack()) {
        navigation.goBack()
      }
    }
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PanGestureHandler 
        onGestureEvent={onGestureEvent}
        // Use higher active offset for Android to prevent conflicts with scrolling
        activeOffsetX={Platform.OS === 'ios' ? [-20, 20] : [-30, 30]}
        // Increase Y offset to better distinguish between horizontal swipes and vertical scrolls
        activeOffsetY={Platform.OS === 'ios' ? [-25, 25] : [-40, 40]}
        shouldCancelWhenOutside={true}
      >
        <View style={{ flex: 1 }}>
          {children}
        </View>
      </PanGestureHandler>
    </GestureHandlerRootView>
  )
}
