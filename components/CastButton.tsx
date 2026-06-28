// components/CastButton.tsx
//
// The native react-native-google-cast CastButton auto-hides whenever no Cast
// devices are discoverable on the network, so on the redesigned Listen page it
// was invisible most of the time. We instead render an always-visible cast
// glyph (lilac when disconnected, green when casting per the caller's tint) and
// open the system Cast dialog on press via CastContext.showCastDialog().

import React from 'react'
import { Platform, Pressable, StyleProp, ViewStyle } from 'react-native'
import Svg, { Path } from 'react-native-svg'

// Only import the cast SDK on mobile platforms.
let CastContext: any
if (Platform.OS !== 'web') {
  try {
    CastContext = require('react-native-google-cast').default
  } catch (error) {
    console.warn('CastContext not available:', error)
  }
}

type CastButtonProps = {
  size?: number
  tintColor?: string
  style?: StyleProp<ViewStyle>
}

export const CastButton = ({ size = 26, tintColor = '#AFFC41', style }: CastButtonProps) => {
  // Don't render on web
  if (Platform.OS === 'web') {
    return null
  }

  const onPress = async () => {
    try {
      await CastContext?.showCastDialog?.()
    } catch (error) {
      console.warn('Failed to open cast dialog:', error)
    }
  }

  return (
    <Pressable onPress={onPress} hitSlop={12} accessibilityRole="button" accessibilityLabel="Cast" style={style}>
      <Svg width={size} height={size} viewBox="0 0 24 24" fill={tintColor}>
        <Path d="M1 18v3h3c0-1.66-1.34-3-3-3zm0-4v2c2.76 0 5 2.24 5 5h2c0-3.87-3.13-7-7-7zm0-4v2c4.97 0 9 4.03 9 9h2c0-6.08-4.93-11-11-11zm20-7H3c-1.1 0-2 .9-2 2v3h2V5h18v14h-7v2h7c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
      </Svg>
    </Pressable>
  )
}
