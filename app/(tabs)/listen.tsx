// app/(tabs)/listen.tsx
import React from 'react'
import { View, Button, StyleSheet } from 'react-native'
import { useTheme } from '@react-navigation/native'
import { ThemedText } from '@/components/ThemedText'
import { useAudio } from '../../context/AudioContext'

export default function ListenScreen() {
  const { colors } = useTheme()
  const { isPlaying, togglePlay } = useAudio()

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <ThemedText type="title" style={styles.title}>
        éist. Listen.
      </ThemedText>
      <Button
        title={isPlaying ? 'Pause' : 'Play'}
        color={colors.background}
        onPress={togglePlay}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    marginBottom: 16,
  },
})
