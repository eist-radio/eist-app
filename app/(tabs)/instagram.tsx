// app/(tabs)/instagram.tsx

import { SwipeNavigator } from '@/components/SwipeNavigator'
import { ThemedText } from '@/components/ThemedText'
import { Ionicons } from '@expo/vector-icons'
import { useTheme } from '@react-navigation/native'
import React, { useState } from 'react'
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export default function InstagramScreen() {
  const { colors } = useTheme()
  const [isLoading, setIsLoading] = useState(false)

  const openInstagram = async () => {
    setIsLoading(true)
    try {
      const url = 'https://www.instagram.com/eistradio'
      const canOpen = await Linking.canOpenURL(url)
      
      if (canOpen) {
        await Linking.openURL(url)
      } else {
        Alert.alert(
          'Cannot Open Instagram',
          'Unable to open Instagram. Please make sure you have an internet connection or the Instagram app installed.',
          [{ text: 'OK' }]
        )
      }
    } catch {
      Alert.alert(
        'Error',
        'Failed to open Instagram. Please try again later.',
        [{ text: 'OK' }]
      )
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <SwipeNavigator>
      <ScrollView 
        style={[styles.container, { backgroundColor: colors.background }]}
        contentContainerStyle={styles.content}
      >
        <View style={styles.header}>
          <Ionicons
            name="logo-instagram"
            size={160}
            color={colors.primary}
          />
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.followButton,
              { 
                backgroundColor: colors.primary,
                opacity: isLoading ? 0.7 : 1
              }
            ]}
            onPress={openInstagram}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Opening...' : 'Follow us on Instagram'}
            </Text>
          </TouchableOpacity>

                     <ThemedText 
             type="default" 
             style={[styles.disclaimer, { color: colors.text }]}
           >
             Opens Instagram in your browser or the Instagram app if installed.
           </ThemedText>
        </View>
      </ScrollView>
    </SwipeNavigator>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  icon: {
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    textAlign: 'center',
  },
  descriptionContainer: {
    flex: 1,
    alignItems: 'center',
  },
  subtitle: {
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 16,
    textAlign: 'center',
  },
  description: {
    fontSize: 16,
    lineHeight: 24,
    textAlign: 'center',
    marginBottom: 32,
    maxWidth: 320,
  },
  featuresContainer: {
    alignItems: 'flex-start',
    gap: 16,
  },
  feature: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  featureText: {
    fontSize: 16,
  },
  buttonContainer: {
    alignItems: 'center',
    justifyContent: 'flex-end',
    flex: 1,
  },
  followButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 16,
  },
  buttonIcon: {
    marginRight: 8,
    color: '#4733FF',
  },
  buttonText: {
    color: '#4733FF',
    fontSize: 18,
    fontWeight: '600',
  },
  disclaimer: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.7,
    maxWidth: 280,
  },
})
