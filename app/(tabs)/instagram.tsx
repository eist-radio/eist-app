// app/(tabs)/instagram.tsx

import React from 'react'
import { View, Text, StyleSheet, Linking } from 'react-native'
import { useTheme } from '@react-navigation/native'
import { useFocusEffect } from '@react-navigation/native'
import { useRouter } from 'expo-router'

export default function InstagramScreen() {
  const router = useRouter()
  const { colors } = useTheme()

  useFocusEffect(
    React.useCallback(() => {
      // Fire the link immediately
      Linking.openURL('https://www.instagram.com/eistradio').catch(console.warn)

      const timer = setTimeout(() => {
        router.replace('/listen')
      }, 600)

      return () => clearTimeout(timer)
    }, [router])
  )

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.primary }]}>
        Opening Instagram...
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    paddingHorizontal: 16,
  },
})
