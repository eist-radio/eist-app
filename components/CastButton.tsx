// components/CastButton.tsx

import React from 'react'
import { Platform, StyleProp, ViewStyle } from 'react-native'

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
  style?: StyleProp<ViewStyle>
  tintColor?: string
}

export const CastButton = ({ style, tintColor }: CastButtonProps) => {
  // Don't render on web
  if (Platform.OS === 'web' || !NativeCastButton) {
    return null
  }

  return <NativeCastButton style={style} tintColor={tintColor} />
}
