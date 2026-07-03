// components/CastButton.tsx
//
// Uses the native react-native-google-cast button (GCKUICastButton on iOS),
// which correctly drives device discovery and presents the system Cast picker.
// Discovery is started at launch (iosStartDiscoveryAfterFirstTapOnCastButton:
// false in app.config.ts), so the button becomes active as soon as a Cast
// device is found on the network. tintColor follows the caller (lilac when
// disconnected, green when casting). Wrapped in a fixed-size View so the native
// view always gets a layout box.

import React from 'react'
import { Platform, StyleProp, View, ViewStyle } from 'react-native'

// Only import on mobile platforms
let NativeCastButton: any
if (Platform.OS !== 'web') {
  try {
    NativeCastButton = require('react-native-google-cast').CastButton
  } catch (error) {
    console.warn('CastButton not available:', error)
  }
}

type CastButtonProps = {
  size?: number
  tintColor?: string
  style?: StyleProp<ViewStyle>
}

export const CastButton = ({ size = 26, tintColor, style }: CastButtonProps) => {
  // Don't render on web
  if (Platform.OS === 'web' || !NativeCastButton) {
    return null
  }

  return (
    <View style={[{ width: size, height: size }, style]}>
      <NativeCastButton style={{ width: size, height: size }} tintColor={tintColor} />
    </View>
  )
}
