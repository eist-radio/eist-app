// components/SwipeNavigator.tsx

import { useNavigation } from '@react-navigation/native'
import React, { ReactNode } from 'react'
import { Dimensions, View } from 'react-native'
import { GestureHandlerRootView, PanGestureHandler, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler'

type Props = {
  children: ReactNode
}

export function SwipeNavigator({ children }: Props) {
  const screenWidth = Dimensions.get('window').width
  const navigation = useNavigation()

  const onGestureEvent = (event: PanGestureHandlerGestureEvent['nativeEvent']) => {
    // Only trigger on horizontal swipes, not vertical scrolls
    if (Math.abs(event.translationX) > Math.abs(event.translationY) && event.translationX > screenWidth * 0.25) {
      if (navigation.canGoBack()) {
        navigation.goBack()
      }
    }
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PanGestureHandler 
        onEnded={(e) => onGestureEvent(e.nativeEvent)}
        activeOffsetX={[-10, 10]}
        failOffsetY={[-10, 10]}
        shouldCancelWhenOutside={true}
      >
        <View style={{ flex: 1 }}>
          {children}
        </View>
      </PanGestureHandler>
    </GestureHandlerRootView>
  )
}
