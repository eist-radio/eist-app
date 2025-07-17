import { SwipeNavigator } from '@/components/SwipeNavigator'
import { faSoundcloud } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { useTheme } from '@react-navigation/native'
import React, { useState } from 'react'
import { Alert, Linking, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native'

export default function SoundCloudScreen() {
  const { colors } = useTheme()
  const [isLoading, setIsLoading] = useState(false)

  const openSoundCloud = async () => {
    setIsLoading(true)
    try {
      const url = 'https://soundcloud.com/eistcork'
      const canOpen = await Linking.canOpenURL(url)
      
      if (canOpen) {
        await Linking.openURL(url)
      } else {
        Alert.alert(
          'Cannot Open SoundCloud',
          'Unable to open SoundCloud. Please make sure you have an internet connection or the SoundCloud app installed.',
          [{ text: 'OK' }]
        )
      }
    } catch {
      Alert.alert(
        'Error',
        'Failed to open SoundCloud. Please try again later.',
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
          <FontAwesomeIcon
            icon={faSoundcloud}
            size={160}
            color={colors.primary}
          />
        </View>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={[
              styles.openButton,
              { 
                backgroundColor: colors.primary,
                opacity: isLoading ? 0.7 : 1
              }
            ]}
            onPress={openSoundCloud}
            disabled={isLoading}
          >
            <Text style={styles.buttonText}>
              {isLoading ? 'Opening...' : 'Listen back on SoundCloud'}
            </Text>
          </TouchableOpacity>
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
    marginBottom: 32,
    marginTop: 106,
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
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 12,
    marginBottom: 16,
  },
  buttonIcon: {
    color: '#4733FF',
    marginRight: 8,
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