// components/SwipeNavigator.tsx

import { useNavigation } from '@react-navigation/native'
import React, { ReactNode } from 'react'
import { Dimensions, Platform, View } from 'react-native'
import { GestureHandlerRootView, PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler'

type Props = {
  children: ReactNode
}

export function SwipeNavigator({ children }: Props) {
  const screenWidth = Dimensions.get('window').width
  const navigation = useNavigation()

  const onGestureEvent = (event: PanGestureHandlerGestureEvent['nativeEvent']) => {
    // Only trigger on horizontal swipes, not vertical scrolls
    // Increase threshold for iOS to prevent accidental triggers
    const threshold = Platform.OS === 'ios' ? screenWidth * 0.4 : screenWidth * 0.25
    
    if (Math.abs(event.translationX) > Math.abs(event.translationY) && 
        Math.abs(event.translationX) > threshold &&
        event.velocityX > 500) { // Add velocity check for more intentional swipes
      if (navigation.canGoBack()) {
        navigation.goBack()
      }
    }
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PanGestureHandler 
        onEnded={(e) => onGestureEvent(e.nativeEvent)}
        activeOffsetX={Platform.OS === 'ios' ? [-20, 20] : [-10, 10]} // Increase offset for iOS
        activeOffsetY={Platform.OS === 'ios' ? [-15, 15] : [-10, 10]} // Use activeOffsetY instead of failOffsetY
        shouldCancelWhenOutside={true}
      >
        <View style={{ flex: 1 }}>
          {children}
        </View>
      </PanGestureHandler>
    </GestureHandlerRootView>
  )
}
