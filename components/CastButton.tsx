// components/CastButton.tsx
// Native Cast button (GCKUICastButton on iOS) in a fixed-size box. Discovery starts at launch, see app.config.ts.

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
