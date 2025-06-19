// components/SwipeNavigator.tsx

import React, { ReactNode } from 'react'
import { View, Dimensions } from 'react-native'
import { useNavigation } from '@react-navigation/native'
import { PanGestureHandler, GestureHandlerRootView, PanGestureHandlerGestureEvent } from 'react-native-gesture-handler'

type Props = {
  children: ReactNode
}

export function SwipeNavigator({ children }: Props) {
  const screenWidth = Dimensions.get('window').width
  const navigation = useNavigation()

  const onGestureEvent = (event: PanGestureHandlerGestureEvent['nativeEvent']) => {
    if (event.translationX > screenWidth * 0.25) {
      if (navigation.canGoBack()) {
        navigation.goBack()
      }
    }
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <PanGestureHandler onEnded={(e) => onGestureEvent(e.nativeEvent)}>
        <View style={{ flex: 1 }}>
          {children}
        </View>
      </PanGestureHandler>
    </GestureHandlerRootView>
  )
}
