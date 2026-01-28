// app/(tabs)/soundcloud.tsx

import { SelectableThemedText } from '@/components/SelectableThemedText'
import { faSoundcloud } from '@fortawesome/free-brands-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-native-fontawesome'
import { useTheme } from '@react-navigation/native'
import React, { useState } from 'react'
import {
  Alert,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

const logoImage = require('../../assets/images/eist-logo-header.png')

const COLORS = {
  eist: '#4733FF',
  lime: '#AFFC41',
  limeSubtle: 'rgba(175, 252, 65, 0.08)',
  limeBorder: 'rgba(175, 252, 65, 0.25)',
}

export default function SoundCloudScreen() {
  const { colors } = useTheme()
  const insets = useSafeAreaInsets()
  const [isLoading, setIsLoading] = useState(false)
  const [buttonPressed, setButtonPressed] = useState(false)

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
      Alert.alert('Error', 'Failed to open SoundCloud. Please try again later.', [{ text: 'OK' }])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <View
      style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top + 48 }]}
    >
      {/* Header */}
      <View style={styles.titleContainer}>
        <SelectableThemedText style={[styles.title, { color: colors.primary }]}>
          SoundCloud
        </SelectableThemedText>
        <Pressable
          style={styles.logoContainer}
          onPress={() => Linking.openURL('https://eist.radio/support')}
          accessibilityRole="link"
        >
          <View style={styles.logoBackground}>
            <Image source={logoImage} style={{ width: 57, height: 57 }} resizeMode="contain" />
          </View>
        </Pressable>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <View style={styles.iconCard}>
          <View style={styles.iconWrapper}>
            <FontAwesomeIcon icon={faSoundcloud} size={48} color={COLORS.lime} />
          </View>
          <Text style={[styles.handle, { color: colors.primary }]}>eistcork</Text>
        </View>

        <Pressable
          onPressIn={() => setButtonPressed(true)}
          onPressOut={() => setButtonPressed(false)}
          onPress={openSoundCloud}
          disabled={isLoading}
          style={[
            styles.button,
            buttonPressed && styles.buttonPressed,
            isLoading && styles.buttonDisabled,
          ]}
        >
          <FontAwesomeIcon
            icon={faSoundcloud}
            size={18}
            color={buttonPressed ? COLORS.lime : COLORS.eist}
            style={styles.buttonIcon}
          />
          <Text style={[styles.buttonText, buttonPressed && styles.buttonTextPressed]}>
            {isLoading ? 'Opening...' : 'Listen on SoundCloud'}
          </Text>
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    paddingTop: 10,
  },
  logoContainer: {
    position: 'absolute',
    top: -44,
    right: 5,
  },
  logoBackground: {
    borderRadius: 26,
    padding: 6,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 80,
  },
  iconCard: {
    alignItems: 'center',
    marginBottom: 48,
  },
  iconWrapper: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: COLORS.limeSubtle,
    borderWidth: 1,
    borderColor: COLORS.limeBorder,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  handle: {
    fontSize: 18,
    fontWeight: '600',
    letterSpacing: -0.3,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.lime,
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 8,
    width: '100%',
    maxWidth: 280,
    borderWidth: 1,
    borderColor: COLORS.lime,
  },
  buttonPressed: {
    backgroundColor: 'transparent',
    borderColor: COLORS.lime,
  },
  buttonDisabled: {
    opacity: 0.7,
  },
  buttonIcon: {
    marginRight: 10,
  },
  buttonText: {
    color: COLORS.eist,
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  buttonTextPressed: {
    color: COLORS.lime,
  },
})
