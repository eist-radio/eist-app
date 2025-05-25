// app/(tabs)/discord.tsx
import React from 'react'
import { View, Text, StyleSheet, Linking } from 'react-native'
import { useTheme, useFocusEffect } from '@react-navigation/native'
import { useRouter } from 'expo-router'

export default function DiscordScreen() {
  const router = useRouter()
  const { colors } = useTheme()

  useFocusEffect(
    React.useCallback(() => {
      // Open Discord link immediately
      Linking.openURL('https://discord.gg/4eHnAAUmFN').catch(console.warn)

      // After a short delay, navigate back to /listen
      const timer = setTimeout(() => {
        router.replace('/listen')
      }, 600)

      return () => clearTimeout(timer)
    }, [router])
  )

  return (
    <View style={styles.container}>
      <Text style={[styles.title, { color: colors.primary }]}>
        Opening Discord...
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
